## Context

当前仓库的执行链路分为三层：

- Node 侧负责计划加载与校验，入口主要在 `src/plan.ts` 与 `src/cli/main.ts`
- Python 侧负责真实执行，入口在 `python/miniprogram_minium_cli/engine.py`
- 具体的小程序动作由 `ActionService`、`SessionService`、`GestureService` 与 `MiniumRuntimeAdapter` 协作完成

现有能力已经覆盖 UI 动作、断言、手势、bridge-backed 小程序能力，以及 `summary.json`、`result.json`、`comparison.json` 等运行产物，但“网络请求”仍然是一个空白层：

- 计划 schema 中没有网络相关 step 类型
- Python 执行引擎没有会话级网络状态，也没有网络证据产物
- `MiniumRuntimeAdapter` 目前只封装了 UI 查询、手势、截图与结构化 `wx` bridge 动作，没有请求观测与拦截接口

这次改动是一个典型的跨层改动：既要扩展 plan schema，又要增加 Python 执行子系统，还要让运行产物与错误语义保持一致。因此需要先通过设计文档把边界、命名、状态模型和风险点收敛清楚。

约束条件如下：

- 对外仍然只能暴露结构化、可校验的 step，不允许开放任意脚本执行或任意网络 API 透传
- 需要兼容现有 `uv` 托管 Python 运行时和当前 Node -> Python JSON 协议
- 需要兼容重复执行与 CI 消费，因此网络证据必须稳定、可落盘、可比较
- 需要同时考虑 real runtime 与 placeholder runtime，保证示例计划和本地演示场景可运行

## Goals / Non-Goals

**Goals:**

- 让计划可以检测某个动作之后是否发出了任意请求或特定请求
- 让计划可以基于 URL、Method、query/params、headers、body 等结构化条件过滤请求
- 让计划可以等待匹配请求出现，并对请求次数、发生顺序、响应状态等常见条件进行断言
- 让计划可以对匹配请求执行透传、失败注入、延迟注入或 mock 响应返回
- 让网络事件、断言结果和拦截结果进入现有步骤输出与运行产物体系，供人和机器消费
- 保持能力边界清晰，让 agent 和用户只需要组合结构化 step，而不需要理解底层 Minium 细节

**Non-Goals:**

- 不提供通用抓包代理或完整浏览器 DevTools 面板替代品
- 不在第一阶段覆盖 WebSocket、UDP、流式分块响应等复杂传输形态
- 不向计划开放任意 JavaScript 注入、任意函数回调或任意请求修改脚本
- 不把网络 mock 做成独立的全局 mock server；所有能力都应绑定到单次执行和会话生命周期
- 不保证第一阶段完整保留所有二进制请求体或响应体；二进制场景优先返回可摘要信息

## Decisions

### 1. 引入“会话级网络状态”，而不是做无状态的临时抓取

设计上在 Python 侧为每个活跃会话维护一份会话级网络状态，至少包含：

- 已安装的网络监听器
- 已注册的拦截规则
- 归一化后的网络事件日志
- 事件自增序号与时间戳

所有网络相关 step 都只操作当前会话的网络状态，不跨会话共享。

原因：

- 现有执行模型已经是 session 驱动，网络能力跟随会话边界最自然
- 监听、等待、断言、拦截本质上都依赖“过去发生了什么”和“当前有哪些规则生效”，这需要可累积状态
- 会话级状态易于在 `session.close` 和执行结束时自动清理，避免跨 run 污染

备选方案：

- 方案 A：每次断言时直接从底层运行时即时抓取网络日志  
  缺点是很难保证请求顺序、次数和时间窗口的稳定性，也难以支撑拦截生命周期。
- 方案 B：使用全局进程级网络状态  
  缺点是多会话和重复执行时容易串数据，与当前 session 语义不一致。

### 2. 为观测、断言、拦截统一一套“结构化 matcher”

网络能力共用同一套 matcher 对象，避免每类 step 各自定义一套过滤语义。matcher 至少支持以下维度：

- 请求 URL 精确匹配与模式匹配
- HTTP Method
- query / params
- headers
- body
- 可选的资源类型或请求类别，例如 `request`、`upload`、`download`

在断言类 step 中，再叠加：

- `count` / `minCount` / `maxCount`
- `withinMs`
- `orderedAfter` / `orderedBefore`
- 针对响应的状态码、headers、body 条件（仅在运行时可获得时生效）

原因：

- 同一套 matcher 可以贯穿监听、等待、断言、拦截，学习成本低，校验逻辑可复用
- 后续如果需要把 matcher 暴露给 skill 或 planner，也能保持统一的计划表达
- 统一 matcher 后，事件日志和错误信息也能复用同一种证据摘要格式

备选方案：

- 方案 A：每种 step 自己维护字段  
  缺点是 API 演进容易分叉，文档和校验会快速膨胀。
- 方案 B：接受自由文本表达式  
  缺点是不可校验、不可预测，也不符合本仓库结构化计划的产品定位。

### 3. 能力按“监听/等待/断言/拦截”四类 step 暴露，而不是做一个大而全的万能 step

计划层建议新增四类 step 家族：

- 监听类：启动监听、停止监听、清空监听缓冲
- 等待类：等待某个匹配请求或响应出现
- 断言类：断言是否命中、命中次数、顺序、响应状态等
- 拦截类：注册规则、移除规则、清空规则

命名上继续沿用现有 `domain.action` 风格，例如：

- `network.listen.start`
- `network.listen.stop`
- `network.wait`
- `assert.networkRequest`
- `assert.networkResponse`
- `network.intercept.add`
- `network.intercept.remove`
- `network.intercept.clear`

原因：

- 当前 CLI step 体系已经按能力拆分，用户和 agent 更容易组合显式步骤
- 监听、断言、拦截的生命周期不同，拆开后更容易看懂执行顺序和失败位置
- “一个大 step 同时包含监听、等待、断言、mock”会让输入结构过于复杂，也不利于校验和错误提示

备选方案：

- 单一 `network.expect` / `network.control` 大 step  
  优点是表面上 step 数量更少；缺点是语义过重，输入 shape 容易变成难维护的分支树。

### 4. 真实运行时优先基于受控网络 hook 做实现，placeholder 运行时复用同一契约

Python 侧新增网络子系统，并由 `MiniumRuntimeAdapter` 提供统一接口，例如：

- 安装网络 hook
- 读取新事件
- 注册/移除拦截规则
- 清理网络状态

在 real runtime 中，优先在受控运行时内部对小程序网络入口做 hook，第一阶段覆盖：

- `wx.request`
- `wx.uploadFile`
- `wx.downloadFile`

hook 负责：

- 在请求发出前记录标准化请求摘要
- 命中拦截规则时决定透传、失败、延迟或直接构造 mock 结果
- 在请求完成后补齐响应摘要与最终状态

在 placeholder runtime 中，复用同一套事件模型与输出契约，用内存态模拟请求产生、失败和 mock 返回，以支持 demo 与回归计划。

原因：

- 相比依赖外部代理或被动抓取 DevTools 日志，受控 hook 更容易拿到请求入参，也更适合做 deterministic mock 和失败注入
- placeholder 与 real runtime 共用事件模型后，spec 和测试样例可以共享大部分计划结构
- 该方案仍然遵守“只暴露结构化 step”的原则，底层 hook 只是实现细节，不会向用户暴露原始脚本能力

备选方案：

- 方案 A：完全依赖 DevTools 网络日志  
  适合观察，不适合稳定拦截，也不一定能完整拿到请求体。
- 方案 B：让用户自己起代理服务器  
  会把产品复杂度转嫁给用户，不符合 CLI 一体化执行层定位。

### 5. 把网络证据做成独立运行产物，同时在步骤输出里保留摘要

在现有 `summary.json`、`result.json`、`comparison.json` 之外，新增运行级网络产物，例如 `network.json`，记录：

- 归一化网络事件列表
- 监听器命中统计
- 拦截规则命中统计
- 被截断字段说明

同时在相关 step 的 `output` 中保留摘要信息，例如：

- 命中的请求数量
- 首次/最近一次命中事件 ID
- 关联的拦截规则 ID
- 相关证据在 `network.json` 中的索引或引用

`comparison.json` 中只保留稳定字段，不直接内嵌完整网络事件明细，避免时间戳、请求 ID、动态头部导致比对噪音。

原因：

- 完整网络日志通常比普通 step 输出更大，独立文件更适合调试
- 步骤输出仍需保留摘要，否则 CLI 与上层 agent 不能快速知道某一步到底匹配了什么
- 对比产物需要“稳定优先”，不应被易变网络细节污染

备选方案：

- 方案 A：只写 step 输出，不写独立文件  
  缺点是大型网络日志会让 `result.json` 过重。
- 方案 B：只写独立文件，不写 step 摘要  
  缺点是上层调用者必须额外二次读取文件，降低可用性。

### 6. 错误语义沿用现有错误码分层

网络相关能力继续复用当前错误码体系：

- matcher 结构非法、step 组合非法：`PLAN_ERROR`
- 运行时不支持网络 hook、hook 安装失败、底层能力不可用：`ENVIRONMENT_ERROR`
- 网络等待超时、拦截动作执行失败：`ACTION_ERROR`
- 请求断言不满足：`ASSERTION_FAILED`

原因：

- 当前 CLI 已将错误码映射到明确退出码，新增错误类型不必再发明一套并行体系
- 对 CI 和脚本调用方来说，沿用现有语义最稳定

备选方案：

- 新增 `NETWORK_ERROR`  
  可读性更直观，但会扩散退出码和兼容成本，收益不高。

## Risks / Trade-offs

- [运行时 hook 能力与 Minium/DevTools 版本兼容性不确定] → 在 `session.start` 后执行显式能力探测；若当前环境不支持，则返回清晰的 `ENVIRONMENT_ERROR`，不要静默降级成“监听不到任何请求”。
- [请求体、响应体可能包含敏感信息或体积过大] → 默认对 headers/body 做大小限制与敏感字段脱敏，并允许后续 spec 增加“仅摘要”模式。
- [监听器和拦截器是有状态的，容易跨步骤误伤] → 所有规则必须具备显式 ID、作用域和清理动作；`session.close` 与 run 结束时统一兜底清理。
- [mock 与真实后端行为可能出现语义偏差] → 第一阶段只支持有限且确定性的 mock 语义，例如固定状态码、headers、JSON/text body，不试图复刻完整网络栈。
- [网络事件过多会拉大运行产物并影响 comparison 稳定性] → 对事件字段做归一化、裁剪和分层存储，完整明细放 `network.json`，稳定摘要放 `result/comparison`。
- [上传、下载、二进制响应的匹配语义更复杂] → 第一阶段先支持请求级摘要匹配与结果状态断言，对二进制 body 不承诺完整可比性。

## Migration Plan

1. 在 Node 侧扩展 `SUPPORTED_STEP_TYPES`、计划校验逻辑以及 API 文档生成来源。
2. 在 Python 侧引入网络状态模型与网络服务层，并为执行引擎接入新的 step 分发分支。
3. 在 `MiniumRuntimeAdapter` 中增加 real/placeholder 两套网络实现，先打通 `wx.request`，再补充上传/下载。
4. 扩展 `summary.json`、`result.json`、`comparison.json` 与新增 `network.json` 的写入逻辑。
5. 为示例小程序和 demo plans 补充网络请求、失败注入、mock 返回、顺序断言等回归用例。
6. 以增量方式发布；该能力是新增能力，不涉及现有计划迁移。旧计划保持兼容，不使用网络 step 时行为不变。

### 7. repository-managed skill 采用“产物优先，结构化 stdout 按需开启”的执行指导

虽然 CLI 支持 `exec --json` 把完整结构化结果直接打印到 stdout，但这在 agent 场景下并不总是最优：

- 运行结果本来就会按 run 落盘到 `summary.json`、`result.json`、`comparison.json` 与 `network.json`
- 网络能力引入后，结构化结果可能明显变大，直接回传到对话上下文会放大 token 消耗
- 很多验证任务只需要知道运行是否通过、失败在哪一步、以及去哪个产物里继续读证据，并不需要把完整 JSON 直接回传

因此这次 change 同步要求 repository-managed product-use skill 调整执行指导：

- 默认执行 plan 时，优先使用不带 `--json` 的 `exec` 命令
- 当任务目标只是验证计划是否通过时，skill SHALL 先引导 agent 依据 CLI 结论判断是否符合预期，而不是默认展开读取所有落盘产物
- 当执行结果不符合预期，或调用方明确需要进一步证据时，skill SHALL 再引导 agent 按需读取 run 目录下的结构化产物
- 只有在“当前 shell 管道必须直接消费 stdout JSON”或“上层调用方明确要求把结构化结果直接返回当前上下文”时，skill 才建议附带 `--json`

这样做的原因：

- 保持 CLI 契约不变，不需要为了 token 优化额外增加 flag 或特殊模式
- 让 agent 行为与现有产物模型保持一致，优先复用已经稳定落盘的事实来源
- 对网络场景尤其有效，因为 `network.json` 和 `result.json` 往往比简短结论大得多
- 进一步避免 agent 在结果本来已经符合预期时无差别读取 `summary.json`、`result.json` 或 `network.json`，从而减少不必要的 token 消耗

备选方案：

- 方案 A：修改 CLI 默认输出，让 `--json` 产物只输出精简版摘要  
  缺点是会改变现有 `--json` 的预期语义，并影响脚本使用方。
- 方案 B：新增单独的“summary-only” flag  
  缺点是会扩展 CLI 表面，并把本可通过 skill 指导解决的问题推成产品能力复杂度。

## Open Questions

- real runtime 中安装受控网络 hook 的最佳注入点是什么：在 `session.start` 时初始化一次，还是在首次网络 step 时惰性安装？
- 当前底层运行时能否稳定拿到响应体全文；若不能，phase 1 是否应该把响应体断言定义为“尽力而为，运行时可用时生效”？
- 上传与下载请求的 body、file metadata、返回值摘要在第一阶段应该标准化到什么粒度，才能兼顾实用性和复杂度？
