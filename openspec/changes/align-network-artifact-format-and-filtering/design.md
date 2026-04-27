## Context

当前仓库已经具备网络监听、等待、断言和拦截能力，但 `network.json` 仍然沿用“按 session 导出当前快照”的模型：

- 顶层是 `sessionCount`、`eventCount`、`sessions[]`
- 每个 session 只暴露 `listeners`、`interceptRules` 和 `events`
- `events` 内联请求与响应详情，但缺少按 `requestId` 聚合后的完整生命周期索引

这个结构能满足基础调试，却有三个明显问题：

1. agent 想围绕某个失败 step 缩小分析范围时，没有一个稳定的“从 step 跳到相关请求子图”的入口。
2. 即使在当前更常见的单 session run 中，调用方也需要先跨 `sessions[]` 这一层容器再去扫描和聚合事件；而在低频的多 session run 中，这种成本会进一步放大。
3. repository-managed skill 当前只有“读 `network.json`”这一条路径，没有像 `playwright-plan-executor` 那样提供低噪音过滤脚本。

与此同时，当前执行结果模型已经为这次变更提供了两个有利条件：

- `result.json` 保留了 `stepResults[]`，可以在不破坏现有 `output` 语义的前提下补充跨产物引用。
- `install --skills` 会整目录复制 `skills/<skill-name>/`，因此过滤脚本放在 `skills/miniprogram-minium-cli/scripts/` 可以随 bundled skill 一起安装，见 [src/skills.ts](/Users/bytedance/personal_workspace/miniprogram-minium-cli/src/skills.ts:31)。

本次 change 既改运行产物契约，也改 product-use skill 的默认分析路径，属于跨模块、带兼容影响的设计型变更，先写清楚数据模型和迁移路径是必要的。

## Goals / Non-Goals

**Goals:**

- 把 `network.json` 升级为更接近 `playwright-plan-executor` 的“事件日志 + 实体索引”模型，让人和 agent 都能更快定位网络上下文。
- 保留当前小程序网络能力的核心语义：请求/响应观察、监听器生命周期、拦截规则生命周期，以及网络相关 step 的结构化证据。
- 让 `result.json` 中的网络相关 step 能稳定回链到新 `network.json` 中的事件、请求、监听器和拦截器。
- 在 `skills/miniprogram-minium-cli/` 中提供一个默认可执行的过滤脚本，把 step 级网络证据收缩成低噪音网络子图。
- 让 skill、README、API 文档与测试统一到“先看 `result.json` / step 证据，再跑过滤脚本，最后才看完整 `network.json`”的分析流程。

**Non-Goals:**

- 不把当前网络能力扩展到 WebSocket、SSE、HAR 回放、流式响应或任意脚本式请求改写。
- 不要求 `network.json` 在字段命名或内部实现上与 `playwright-plan-executor` 完全一致；目标是结构层次和分析路径对齐，而不是逐字段照抄。
- 不为了过滤脚本去整体重写 `result.json` 的现有 step result 结构；现有 `stepResults[].output` 仍然保留。
- 不在本期引入新的公开 CLI 命令；过滤能力通过 bundled skill 中的脚本提供。

## Decisions

### 1. `network.json` 改为 run 级扁平结构，主模型对齐为 `schemaVersion + events + requests + listeners + intercepts`

新的 `network.json` 顶层固定为：

```json
{
  "schemaVersion": 1,
  "events": [],
  "requests": {},
  "listeners": {},
  "intercepts": {},
  "meta": {}
}
```

其中：

- `events` 是运行级追加日志，记录网络事实与生命周期变化。
- `requests` 是按 `requestId` 聚合后的请求索引。
- `listeners` 是监听器索引。
- `intercepts` 是拦截规则索引。
- `meta` 保留运行级摘要，例如总事件数、总 session 数、字段裁剪说明等。

不再以 `sessions[]` 作为主导结构导出；session 维度改为记录在每个实体和事件上，例如 `sessionId` 字段。新的主模型优先服务当前更常见的单 session 分析路径，同时继续兼容低频多 session run。

原因：

- 调用方分析网络问题时，最常见的问题是“某个请求的完整生命周期是什么”，而不是“某个 session 当前还剩哪些快照对象”。
- 扁平结构更容易被 agent、脚本和文档直接引用，也更接近 `playwright-plan-executor` 已验证过的分析模型。
- session 仍然重要，但它是实体属性，不应该再成为调用方在单 session 主路径里也必须先跨越的一层容器。

备选方案：

- 方案 A：保留 `sessions[]`，仅在 session 内新增 `requests` 索引。
  缺点是连单 session 主路径都要多层遍历，skill 过滤脚本也必须额外处理 session 嵌套。
- 方案 B：只保留 `requests` 索引，不保留事件日志。
  缺点是 `listen.clear`、`intercept.remove`、断言命中/失败等生命周期事实会丢失。

### 2. 为兼容低频多 session run，导出层采用 run-scoped canonical ID

当前 `NetworkState` 的计数器是 session 级的。虽然当前主路径大多仍是单 session run，但实现上确实允许在一个 run 中存在多个 session，因此不同 session 都可能出现 `request-1`、`rule-1`、`listener-1`。新的 artifact 不再直接暴露这些局部 ID，而是在导出时生成 run-scoped canonical ID，例如：

- `requestId`: `<sessionId>/request-1`
- `eventId`: `<sessionId>/response-2`
- `listenerId`: `<sessionId>/home-network`
- `interceptId`: `<sessionId>/rule-1`

同时，每个实体保留 `sessionId` 作为显式字段，避免调用方再从 ID 文本反解。

原因：

- 单 session 主路径不需要为 ID 冲突付出额外心智负担；而在低频多 session run 中，导出层 canonicalization 可以避免键冲突。
- 在运行时内部继续保留现有 session 局部 ID，迁移成本更小；只在导出和引用层做 run-scoped 映射，能减少对等待/断言主路径的干扰。

备选方案：

- 方案 A：把所有计数器改成执行器级全局计数器。
  缺点是会扩大运行时改动面，并使 session 级状态更难局部测试。
- 方案 B：继续输出局部 ID，并要求调用方连同 `sessionId` 一起解析。
  缺点是 artifact 顶层已经扁平化，再暴露局部 ID 会让脚本和 agent 更容易踩坑。

### 3. `events[]` 不再只记录 `request/response`，而是升级为可追溯生命周期日志

新的 `events[]` 至少覆盖以下事件类型：

- `listener.started`
- `listener.stopped`
- `listener.cleared`
- `intercept.added`
- `intercept.removed`
- `intercept.cleared`
- `intercept.matched`
- `request.observed`
- `response.observed`
- `step.network.wait.matched`
- `step.network.wait.failed`
- `step.assert.networkRequest.matched`
- `step.assert.networkRequest.failed`
- `step.assert.networkResponse.matched`
- `step.assert.networkResponse.failed`

每条事件使用统一 envelope：

```json
{
  "eventId": "...",
  "type": "request.observed",
  "time": "...",
  "sessionId": "...",
  "summary": "...",
  "requestId": "...",
  "listenerId": "...",
  "interceptId": "...",
  "stepId": "...",
  "data": {}
}
```

其中 `data` 只放轻量、与跳转有关的补充字段，例如 `matchedRequestIds`、`removedRequestIds`、`eventIds` 或计数摘要；完整请求/监听器/拦截器细节放在索引对象里。

原因：

- 事件日志应该回答“发生过什么”，而不是重复承载所有大字段。
- `listen.clear`、`intercept.remove` 这类操作如果只保留最终状态，就会让较早 step 的证据悬空。
- 与 `playwright-plan-executor` 一样，把 step 对网络事实的消费也记进日志，过滤脚本才能围绕 step 证据做子图收缩。

备选方案：

- 方案 A：继续沿用当前 `NetworkEvent`，只补更多字段。
  缺点是事件类型过粗，难以表达监听器和断言生命周期。
- 方案 B：把 step 的命中/失败只写在 `result.json`，不写入 `network.json`。
  缺点是跨文件追踪时缺少统一真相源。

### 4. `requests` / `listeners` / `intercepts` 作为实体索引，承载完整上下文

新的实体索引设计如下：

- `requests[requestId]`：保留 `url`、`method`、`resourceType`、`query`、`headers`、`body`、`pagePath`、`statusCode`、`responseHeaders`、`responseBody`、`outcome`、`listenerIds`、`interceptIds`、`eventIds`、`firstEventId`、`lastEventId`、`sessionId`
- `listeners[listenerId]`：保留 `matcher`、`captureResponses`、`active`、`startedAt`、`stoppedAt`、`hitCount`、`eventIds`、`firstEventId`、`lastEventId`、`sessionId`
- `intercepts[interceptId]`：保留 `matcher`、`behavior`、`active`、`addedAt`、`removedAt`、`hitCount`、`eventIds`、`firstEventId`、`lastEventId`、`sessionId`

当前 `NetworkState` 会从运行时直接收集请求与监听器命中关系。本次改动不要求实时逻辑完全按新 artifact 结构运行，但要求最终导出的 payload 具备这些聚合索引。

原因：

- agent 和脚本通常先知道一个 `requestId` 或 `listenerId`，再反查相关事件与对象；聚合索引能把这条路径变成 O(1)。
- 当前事件内联了完整请求/响应，会造成请求信息在多事件中重复；改成索引后，artifact 更适合机器消费。

备选方案：

- 方案 A：在 `events[]` 中继续重复内联完整 `request` / `response`。
  优点是单条事件点开就能看；缺点是重复大、过滤脚本难做最小子图输出。

### 5. `result.json` 保留现有 `stepResults[]` 形状，但为网络相关 step 新增 `details.networkEvidence`

当前 `stepResults[]` 结构已经被测试和文档使用：

```json
{
  "id": "...",
  "type": "...",
  "ok": true,
  "status": "passed",
  "output": {},
  "error": null,
  "durationMs": 0
}
```

本次不重写它，而是新增可选的 `details` 字段：

```json
{
  "details": {
    "networkEvidence": [
      {
        "artifactPath": ".../network.json",
        "eventId": "...",
        "requestId": "...",
        "listenerId": "...",
        "interceptId": "...",
        "summary": "..."
      }
    ]
  }
}
```

设计要求：

- 保留现有 `output.matched_count`、`output.matched_event_ids`、`output.rule_id` 等兼容字段，避免不必要地破坏现有消费方。
- 新增的 `details.networkEvidence` 只承担“稳定跳转引用”职责，不替代 `output` 的业务语义。
- `comparison.json` 继续只保留稳定摘要；由于当前 comparison 规范化逻辑本就不输出 `details`，新的 `networkEvidence` 默认不会进入 comparison，从而避免把 run-scoped IDs 带入比较噪音中。

原因：

- 过滤脚本需要一个统一且稳定的入口，而不是硬编码推断不同 step 的不同 `output` 字段。
- 把引用放在 `details`，能明确区分“step 业务结果”和“跨产物证据指针”。

备选方案：

- 方案 A：仅依赖现有 `output.matched_event_ids`、`first_event_id` 等字段。
  缺点是字段分散、命名不统一，也无法覆盖 `intercept.clear` / `listener.clear` 这类步骤。
- 方案 B：仿照 `playwright-plan-executor` 把整个 result 结构改成 `steps[].details` 模型。
  缺点是超出本次 change 的必要范围。

### 6. 过滤脚本作为 bundled skill 资产发布，接口参考 `playwright-plan-executor`，但输出与提示遵守本仓库英文约定

新增脚本路径：

- `skills/miniprogram-minium-cli/scripts/filter-network-artifact.mjs`

脚本接口对齐为：

```bash
node skills/miniprogram-minium-cli/scripts/filter-network-artifact.mjs \
  --result /path/to/result.json \
  [--network /path/to/network.json] \
  [--step-id <id>] \
  [--pretty]
```

主要行为：

- 默认从 `result.json.artifacts.networkPath` 或 `stepResults[].details.networkEvidence[].artifactPath` 推导 `network.json`
- 当未显式传 `--step-id` 时，选择所有带 `networkEvidence` 的 step 作为种子
- 以 `eventId`、`requestId`、`listenerId`、`interceptId` 为入口，在 `events` 和三类索引间做子图闭包扩展
- 输出 `{ schemaVersion, events, requests, listeners, intercepts, meta }`
- `meta` 至少包含输入路径、选中的 step、命中数量和省略数量

脚本文案、帮助文本和错误消息使用英文，而不是直接复制 `playwright-plan-executor` 当前的中文文案。这是为了遵守本仓库“repository-facing documentation, code comments, commit messages, and command descriptions in English”的规则。

原因：

- skill 目录会被 `install --skills` 整体复制，脚本放在 skill 目录内才是可分发资产，而不是只存在源码仓库里。
- 过滤脚本是 skill 的一部分，不需要新增 CLI 子命令，也能让 agent 有默认低噪音入口。

备选方案：

- 方案 A：把过滤逻辑做成 CLI 子命令。
  缺点是超出本次需求，并扩大公开产品面。
- 方案 B：只在文档中教 agent 手工读 `network.json`。
  缺点是没有把“低噪音默认路径”产品化。

### 7. 为了兼容当前实现，运行时内部先允许“双模型”，对外只导出新 artifact

内部迁移分两层：

- 运行时采集层可以先继续用当前 `NetworkState` 和现有等待/断言逻辑跑通主路径
- 导出层新增 run-level artifact builder，把 session 级状态转换成新 `network.json`；后续再逐步把生命周期事件和索引回收进更统一的内部状态模型

这意味着第一阶段不强制要求所有内部对象一次性重构完，但要求：

- 对外落盘与 `result.json` 引用全部切到新 artifact 结构
- 新增事件类型（如 `listener.started`、`step.assert.*`）必须在内部可记录，不允许只在文档层声明

原因：

- 当前网络能力已经有现成测试和行为，完全重写内部状态模型会拉大变更面。
- 用户要求的是从 `main` 起 change 并推进产品能力，不是为了追求一次性纯化内部实现而停滞。

备选方案：

- 方案 A：先完整重写内部状态，再改导出。
  缺点是交付周期更长，回归风险更大。
- 方案 B：只在导出层套一层简单转换，不记录新的生命周期事件。
  缺点是无法真正达到“类似 `playwright-plan-executor` 的格式”。

## Risks / Trade-offs

- [run-scoped canonical ID 会改变现有 `network.json` 消费方式] → 明确标记为 **BREAKING**，并在 README、API reference、skill 文档与测试中同步更新。
- [当前 session 级状态导出为 run 级结构时可能遗漏某些生命周期事件] → 先补 listener/intercept/step 消费事件的统一记录入口，再实现 artifact builder，避免只做表面字段搬运。
- [新增 `details.networkEvidence` 后，调用方可能把它误当作稳定 comparison 字段] → 继续让 `comparison.json` 仅保留现有稳定摘要，不把 `details` 纳入 comparison 规范化结果。
- [过滤脚本如果依赖过多内部字段，会在后续 artifact 演进时脆弱] → 只依赖 `networkEvidence` 和 artifact 顶层公开索引，不解析未文档化的内部临时字段。
- [把脚本放进 skill 目录后，如果引用文档不更新，agent 仍可能直接读完整 `network.json`] → 同一 change 内同步更新 `SKILL.md` 和 `references/run-analysis.md`，把过滤脚本提升为默认推荐路径。

## Migration Plan

1. 扩展网络状态和导出层，定义新的 run-level `network.json` payload，并为多 session 导出增加 canonical ID 映射。
2. 在网络监听、拦截、等待和断言路径中补充生命周期事件记录，使 `events[]` 能表达监听器、拦截器和 step 消费事实。
3. 为网络相关 step result 增加 `details.networkEvidence`，同时保留当前 `output` 里的兼容字段。
4. 更新 `README.md`、`docs/API_REFERENCE.md`、`skills/miniprogram-minium-cli/SKILL.md` 和 `references/run-analysis.md`，把推荐分析流程改成“result -> filter helper -> full network artifact”。
5. 新增 `skills/miniprogram-minium-cli/scripts/filter-network-artifact.mjs` 及其测试，覆盖单 step、多 step、显式 `--network`、缺少 `networkEvidence`、多 session 引用等场景。
6. 更新现有 smoke/CLI 测试和网络示例，验证新 `network.json` 结构与过滤脚本输出。

回滚策略：

- 若新 artifact builder 或 `networkEvidence` 引用在主路径上发现严重兼容问题，可回滚到旧导出逻辑，同时保留运行时采集增强；因为变更集中在导出与文档层，这种回滚不会要求撤销底层 hook 能力。

## Open Questions

- 是否需要在新 `network.json.meta` 中继续保留旧模型里的 `sessionCount` / `eventCount` 这类摘要字段，作为人类快速浏览入口？当前倾向是保留，但不再作为主结构。
- 过滤脚本是否要支持“直接只给 `network.json`，不依赖 `result.json`”的退化模式？当前倾向是保留 `--network` 仅作为路径覆盖，而不是单独支持无 `result.json` 模式，因为低噪音过滤的种子本身来自 step 证据。
