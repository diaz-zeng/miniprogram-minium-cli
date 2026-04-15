## Context

当前仓库的发布体系围绕两条假设构建：`main` 上的合入持续产出 `next` 预发布，`v*` tag 触发 `latest` 正式发布。这套模型在单一开发主线下较简单，但它把“发布意图”绑定在 tag 或主干 push 上，无法很好表达经过评审的 MAJOR、MINOR、PATCH 三类版本演进，也难以给正式发布提供清晰的门禁和审计路径。

新的设计需要同时解决三类问题：

1. 让分支语义直接映射到 semver 语义，避免所有版本活动都挤在 `main`。
2. 让正式发布由 release PR 驱动，而不是由手工推 tag 驱动。
3. 保持 npm 通道的可安装性和可理解性，让维护者和使用者都能分辨 PR 构建、预发布构建和正式构建。

仓库约束包括：

- 继续使用 GitHub Actions 作为唯一自动发布执行环境。
- 继续优先采用 npm trusted publishing 与 provenance。
- 保留现有 PR canary 能力，方便验证分支构建。
- 尽量复用 `scripts/release/` 中已有的版本计算和校验思路，但要允许脚本前提被重写。

## Goals / Non-Goals

**Goals:**

- 定义一个以分支为中心的发布治理模型，使 `main`、`next/*`、`release/*`、`hotfix/*` 的职责明确且互不混淆。
- 让正式发布统一通过 `next/* -> main`、`release/* -> main`、`hotfix/* -> main` 的 release PR 完成，并在发布成功后自动创建 git tag 与 GitHub Release。
- 为 MAJOR、MINOR、PATCH 三类版本线定义稳定的 npm dist-tag 语义与版本生成规则。
- 为多条活跃版本线定义前向同步规则，减少 hotfix 和正式发布后的分叉风险。
- 为 GitHub Actions 设计 fail-closed 的正式发布路径，在校验不通过时宁可不发布，也不误发布。

**Non-Goals:**

- 不在本次设计中引入 changesets、release-please 或其他第三方发布编排系统。
- 不在本次设计中实现自动生成 changelog 的完整内容策略，只定义 GitHub Release 和 tag 的创建时机。
- 不把本仓库改造成长期维护多条稳定分支的 LTS 模式；这里只处理一个当前稳定线、一个活跃 MAJOR 线、一个活跃 MINOR 线和按需出现的 hotfix 线。
- 不在本次设计中处理“fork PR 也自动发布 npm 预发布包”的能力，PR canary 仍限定在同仓库分支。

## Decisions

### 1. `main` 改为稳定发布线，只接收正式发布 PR

`main` 不再承载“每次合入都发布 `next`”的职责，而只表示“当前已正式发布的稳定代码”。进入 `main` 的合并分为三类：

- `next/x.x.x -> main`：MAJOR 正式发布
- `release/x.x.x -> main`：MINOR 正式发布
- `hotfix/x.x.x -> main`：PATCH 正式发布

这样做的原因是：

- `main` 的每一次变更都可以和一次正式发布一一对应，审计路径更短。
- 正式发布不再由 tag 表达意图，而由经过 review 的 release PR 表达意图。
- 可以让 `main` 的 branch protection 更严格，不必同时兼顾日常功能开发和正式发版。

备选方案是保留 `main` 作为日常集成线，只把 stable 触发器从 tag 改为 release PR。该方案会让 `main` 同时承担“beta 出包线”和“正式接收线”两种角色，语义仍然混杂，因此不采用。

### 2. 以分支名承载 semver 意图：`next/*` 负责 MAJOR，`release/*` 负责 MINOR，`hotfix/*` 负责 PATCH

分支命名与目标版本必须直接对应：

- `next/2.0.0` 代表下一个 MAJOR 版本线，允许 breaking changes。
- `release/1.5.0` 代表下一个 MINOR 版本线，承接向后兼容的新功能与修复。
- `hotfix/1.4.1` 代表当前稳定版的 PATCH 修复线，只做线上修复。

每条分支中的 `package.json.version` 必须与分支版本一致，且表示该分支的目标正式版，而不是临时预发布号。

这样做的原因是：

- 维护者从分支名就能知道版本语义和合并目标，不需要额外解释。
- `package.json.version` 继续保持“目标正式版”的语义，只是作用域从 `main` 改为“当前版本线”。
- 便于 workflow 通过分支名前缀和版本号进行自动校验。

备选方案是继续在 `main` 上维护“下一个稳定版”，分支只承载实现内容。该方案会让 MAJOR/MINOR/PATCH 三种节奏共享一套版本含义，无法自然表达并行版本线，因此不采用。

### 3. npm 通道按风险层级和分支类型分配：PR=`canary`，MAJOR=`alpha`，MINOR=`next`，稳定版=`latest`

新的 npm dist-tag 语义定义如下：

- `canary`：同仓库 PR 源分支构建
- `alpha`：`next/x.x.x` 分支的 MAJOR 预发布构建
- `next`：`release/x.x.x` 分支的 MINOR beta 构建
- `latest`：所有正式发布

版本格式保持“仓库版本为稳定版，CI 临时派生预发布后缀，不回写仓库”的原则：

- PR：`1.5.0-canary-pr-42.<run-id>.<attempt>.<sha>`
- MAJOR：`2.0.0-alpha.<run-id>.<attempt>.<sha>`
- MINOR：`1.5.0-beta.<run-id>.<attempt>.<sha>`

这样做的原因是：

- `next/*` 与 `release/*` 可以并行存在，必须有不同的 npm dist-tag 才不会相互覆盖。
- `alpha` 与 `beta(next)` 比 `canary` 更稳定，也比 `latest` 风险更高，层级清晰。
- 继续复用已有 prerelease 版本派生机制，无需把临时版本写回 git 历史。

备选方案是让 `next/*` 与 `release/*` 共用 npm `next` tag。该方案会让安装方无法分辨“MAJOR 预览”和“MINOR 候选”，且两条线会互相覆盖 dist-tag，因此不采用。

### 4. 正式发布改为 `push to main` 上的“发布路由 + fail-closed 校验”，不再监听 tag push

正式发布 workflow 的触发器改为 `push` 到 `main`，但它不是“每次 main push 都发布”，而是先识别此次 push 对应的 merged PR 类型，然后进行发布路由：

- 源自 `next/*` 的 merged PR → MAJOR 正式发布
- 源自 `release/*` 的 merged PR → MINOR 正式发布
- 源自 `hotfix/*` 的 merged PR → PATCH 正式发布
- 其他来源 → 不发布并明确跳过

发布 job 必须执行以下硬校验：

- 该提交必须对应 merged PR，拒绝 direct push
- PR 源分支前缀必须在允许列表中
- 源分支版本与 `package.json.version` 一致
- npm 上不存在该稳定版
- GitHub 上不存在同名 tag / Release
- Environment 审批已通过

这样做的原因是：

- 正式发布入口只剩下一条，更容易审计和维护。
- fail-closed 行为能显著降低误发布概率。
- 不再需要保留“手工推 tag 触发发布”这条高风险入口。

备选方案是继续监听 `push.tags`，但只允许 workflow 创建 tag。该方案虽然比完全手工安全，但 tag 仍然是发布触发器，流程依然分裂，因此不采用。

### 5. tag、GitHub Release 与 changelog 驱动的 release body 由 stable workflow 在 npm 发布成功后自动创建

stable publish job 在成功发布 npm `latest` 之后，使用具有 `contents: write` 权限的 `GITHUB_TOKEN` 创建：

- 对应版本的 git tag，例如 `v1.5.0`
- 对应版本的 GitHub Release
- 以 `CHANGELOG.md` 当前版本章节为主体、自动生成 release notes 为补充的 Release 正文

优先通过 GitHub Release API 一次性提交 `tag_name` 与 `target_commitish`，让 GitHub 在 tag 不存在时自动补建 tag，再生成 Release。

这样做的原因是：

- tag 从“发布开关”降级为“发布产物”，安全边界更清晰。
- GitHub Release 与 npm 正式发布天然绑定，不会出现 npm 已发而 Release 未建或 tag 错位的情况。
- 让 Release 说明以仓库中可评审的 changelog 为准，同时保留 GitHub 自动汇总 PR/提交的便利性。
- 使用 `GITHUB_TOKEN` 创建的事件默认不会再次触发 workflow，可避免递归触发旧逻辑。

实现上，stable workflow 应先从 `CHANGELOG.md` 提取当前版本段落；若未找到对应条目，则正式发布直接失败。随后 workflow 再以该段落作为 Release body 主体，并把 GitHub 自动生成的 release notes 追加为附录或补充段落。

备选方案是先建 tag，再由独立 workflow 建 Release。该方案链路更长、失败面更多，因此不采用。

### 6. 定义单向前向同步规则，保持版本线收敛

为避免多条版本线长期分叉，采用如下同步方向：

- `hotfix/* -> main` 发布后，修复必须继续同步到活跃 `release/*`
- `hotfix/* -> main` 发布后，修复必须继续同步到活跃 `next/*`
- `release/* -> main` 发布后，通用修复和治理变更应同步到活跃 `next/*`
- `next/*` 不向后同步到 `release/*`

这样做的原因是：

- 线上补丁必须进入后续版本线，否则老问题会在下一次 MINOR/MAJOR 中回归。
- MAJOR 线允许 breaking changes，不能倒灌回 MINOR 线。
- 同步方向固定后，维护者更容易判断补丁应该怎样传播。

备选方案是完全依赖最终合并时处理冲突。该方案短期省事，但会在 release PR 阶段集中爆发大量冲突，因此不采用。

### 7. 限制活跃版本线数量，控制复杂度

为了避免分支治理失控，仓库在任意时刻最多维护：

- 1 条活跃 `next/*`
- 1 条活跃 `release/*`
- 按需出现的 `hotfix/*`

这样做的原因是：

- 对当前单包 CLI 仓库来说，更多并行版本线会显著增加同步和审计成本。
- 仍然能覆盖“同时准备一次 MAJOR 和一次 MINOR”的常见场景。

备选方案是允许任意数量的 `release/*` 与 `next/*` 并行。该方案更灵活，但对仓库当前规模而言复杂度过高，因此不采用。

## Risks / Trade-offs

- [风险] 新模型比当前 `main + tag` 模型复杂，维护者需要学习新的分支语义。 → 缓解：在 README 和 CONTRIBUTING 中提供清晰的发布状态机与示例流程。
- [风险] `next/*` 与 `release/*` 并行存在时，前向同步容易被遗漏。 → 缓解：在设计和 tasks 中明确同步步骤，并在 PR 模板或 checklist 中体现。
- [风险] `main` 只接正式发布 PR 可能改变团队当前开发习惯。 → 缓解：把目标分支选择规则写入贡献文档，并通过分支保护减少绕过路径。
- [风险] GitHub API 创建 Release/tag 或 npm publish 之间可能部分成功。 → 缓解：按“先 npm，后 GitHub 产物”的顺序执行，并在重复执行时先检查 tag / Release 是否已存在。
- [风险] `CHANGELOG.md` 未及时更新会阻塞正式发布。 → 缓解：将 changelog 更新纳入 release PR 必查项，并在 workflow 中给出明确失败提示。
- [风险] 引入 `alpha` dist-tag 会增加用户理解成本。 → 缓解：在文档中把 `canary`、`alpha`、`next`、`latest` 的适用场景明确列出。

## Migration Plan

1. 用新的 OpenSpec delta 重写 `npm-release-publishing` 要求，并新增 `release-branch-governance` capability。
2. 替换现有 `.github/workflows/publish-release.yml`、`.github/workflows/publish-prerelease.yml`、`.github/workflows/publish-canary-pr.yml` 等发布工作流，使其符合新的分支模型。
3. 调整 `scripts/release/` 下的脚本假设，补充分支识别、发布路由、tag / Release 创建前校验等能力。
4. 更新 `package.json` 中的 release 辅助脚本名称与说明，移除仅服务旧 tag 模型的入口。
5. 更新 `README.md`、`docs/README.zh-CN.md`、`CONTRIBUTING.md`、`docs/CONTRIBUTING.zh-CN.md` 中的维护者工作流。
6. 在 GitHub 仓库设置中配置或更新：
   - `main` 分支保护
   - release 分支命名约定
   - 正式发布 Environment 审批
   - Actions 权限与 npm trusted publishing
7. 在测试仓库或安全环境下验证：
   - PR canary
   - `release/*` 预发布
   - `next/*` 预发布
   - `hotfix/*` / `release/*` / `next/*` 合入 `main` 的正式发布、自动打 tag、自动建 GitHub Release

## Open Questions

- `hotfix/*` 是否需要在分支更新阶段提供单独的预发布通道，还是只在合入 `main` 后直接发布 `latest`。
- 是否需要通过 PR 模板、label 或 branch naming 之外的额外机制来强约束“普通 feature PR 不能直接进 `main`”。
