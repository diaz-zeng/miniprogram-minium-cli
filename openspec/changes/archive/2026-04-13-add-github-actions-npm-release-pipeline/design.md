## Context

这个仓库是一个单包 Node.js CLI，当前已经有 `prepack`、`build` 和 `test` 等发包基础，但缺少受控的自动化发布路径。用户希望 `main` 分支在每次通过 PR 合入后都能产出一个可安装的 npm 预发布版本，同时保留通过 `v*` tag 触发正式发布的能力。由于 npm 不允许同名同版本重复发布，而仓库又要求 `main` 只能通过 PR 变更，因此不能把每一次预发布都建模成一次提交版本号的 PR；否则版本噪音会迅速淹没正常开发。设计的关键在于：让仓库中的版本号继续充当“下一个正式版”的单一事实源，同时让 CI 在不污染仓库历史的前提下派生唯一的预发布版本。

## Goals / Non-Goals

**Goals:**
- 在 `main` 分支每次合入后自动执行安装、测试、构建并发布 npm `next` 通道的预发布版本。
- 在 `v*` tag 推送后自动发布 npm 正式版，并校验 tag 与 `package.json` 版本完全一致。
- 让 `package.json` 中的版本号继续表示“下一个正式版”，并通过 PR 显式推进。
- 将版本计算、tag 校验等关键逻辑收敛为可复用脚本或明确步骤，降低 workflow 内联 shell 的脆弱性。
- 优先采用 npm trusted publishing 与 provenance，减少长期凭证管理成本。

**Non-Goals:**
- 不在本次 change 中引入多包 monorepo、changesets 或自动生成 changelog 的完整发布体系。
- 不支持在 `main` 上直接提交或回写 `beta` 版本号。
- 不在本次 change 中实现“仅部分文件变更才发布 prerelease”的复杂条件过滤。
- 不修改 CLI 的功能契约、plan schema 或运行时行为。

## Decisions

### 1. `main` 分支中的 `package.json.version` 表示“下一个正式版”
仓库中的版本号保持为稳定 semver，例如 `1.3.0`，表示“下一次准备正式发布时将发布的版本”。这意味着正式发布完成后，需要再通过一个 PR 将版本推进到下一开发目标，例如 `1.3.1` 或 `1.4.0`。

这样做的原因是：
- 版本来源始终唯一，代码、评审、tag 和 npm 正式版语义一致。
- 符合 `main` 只能通过 PR 变更的约束。
- 避免每次预发布都制造一次“只改 beta 号”的噪音 PR。

备选方案是把 `main` 长期保持在 `1.3.0-beta.N`。该方案会让“仓库当前版本”失去正式发布基线语义，也会把 beta 递增变成高频维护负担，因此不采用。

### 2. 预发布版本由 CI 临时派生，不回写仓库
`main` workflow 从 `package.json.version` 读取稳定基线版本，并在工作流运行期间临时派生一个唯一 prerelease 版本，例如 `1.3.0-beta.<run_id>.<run_attempt>.<short_sha>`。workflow 使用该临时版本执行 `npm publish --tag next`，但不提交回仓库，也不创建 git tag。

这样做的原因是：
- npm 要求每次发布版本唯一，CI 临时派生可以满足唯一性。
- `run_id + run_attempt + short_sha` 可以同时覆盖重复运行和提交可追溯性。
- 不污染仓库历史，且可以在失败后安全重跑。

备选方案是使用 `npm version prerelease --preid beta` 并提交结果。该方案会把 CI 状态回写主分支，不符合当前分支治理方式，因此不采用。

### 3. 预发布与正式发布使用不同触发器和 npm dist-tag
`main` 上的 workflow 仅负责发布 prerelease 到 npm `next` tag；`v*` tag workflow 仅负责发布稳定版到默认 `latest` tag。两条流水线都执行安装、测试和构建，但只有 tag 流水线要求 tag 与 `package.json` 版本严格一致。

这样做的原因是：
- `next` 与 `latest` 的消费语义清晰，安装方可以主动选择预发布或稳定版。
- 主干持续可用而不影响默认安装体验。
- 正式发布流程更容易做发布门禁与回溯审计。

备选方案是 `main` 只做 `npm publish --dry-run`。该方案更简单，但无法提供真实可安装的预发布包，不满足当前目标，因此不采用。

### 4. 将版本计算与 tag 校验提取为仓库脚本
workflow 不直接把复杂的版本拼接和 tag 对比逻辑写成长串 shell，而是通过仓库内脚本完成，例如：
- `scripts/release/compute-prerelease-version.mjs`
- `scripts/release/validate-tag-version.mjs`

这样做的原因是：
- 逻辑可测试、可复用、可本地调试。
- workflow 更短，更容易审查。
- 未来若切换 prerelease 命名规则或增加校验条件，只需修改脚本。

备选方案是全部写在 YAML 的 `run:` 片段中。该方案实现更快，但后续维护和测试都更脆弱，因此不采用。

### 5. 正式发布前必须校验 tag 与仓库版本完全一致
当触发 `v1.3.0` 这类 tag 发布时，workflow 必须读取 `package.json.version` 并确认它等于 `1.3.0`。如果不一致，workflow 应立即失败，拒绝发布。

这样做的原因是：
- 防止错误 tag 触发错误版本的正式发布。
- 保证 git tag、仓库版本和 npm 正式版三者一致。
- 让回滚和问题定位更直接。

备选方案是以 tag 为准，在 CI 中强行改写 `package.json`。该方案会让已评审代码与最终发布产物不一致，因此不采用。

### 6. 发布认证优先采用 trusted publishing
发布 workflow 优先使用 GitHub Actions OIDC 对 npm 的 trusted publishing，并启用 provenance 所需权限；只有在环境受限时才退回 `NPM_TOKEN` 方案。

这样做的原因是：
- 降低长期保存 npm token 的安全风险。
- 与 npm 当前官方推荐方式一致。
- provenance 信息对供应链审计更友好。

备选方案是默认依赖长期 `NPM_TOKEN`。该方案更通用，但安全边界较弱，因此不作为首选。

## Risks / Trade-offs

- [风险] `main` 每次合入都发布 prerelease，可能导致 `next` 通道更新频繁。 → 缓解：在文档中明确 `next` 的消费语义，并保持版本号可追溯。
- [风险] 仓库维护者忘记在正式发布后通过 PR 推进下一个正式版本。 → 缓解：在发布文档中加入明确的发版后步骤，并在 PR / release checklist 中体现。
- [风险] 预发布版本计算规则若不稳定，重跑 workflow 可能产生冲突。 → 缓解：版本中纳入 `run_id` 与 `run_attempt`，避免重复版本。
- [风险] tag 校验缺失会导致错误版本发布到 `latest`。 → 缓解：把版本一致性校验作为正式发布 workflow 的前置硬门禁。
- [风险] trusted publishing 的仓库与 npm 配置若未完成，workflow 会失败。 → 缓解：文档同时说明 trusted publishing 和 fallback 凭证模式，并在 workflow 输出中给出清晰错误上下文。

## Migration Plan

1. 为仓库新增 release 辅助脚本，封装 prerelease 版本计算与 tag 版本校验。
2. 新增 `main` 分支 prerelease workflow，完成依赖安装、测试、构建、临时版本注入与 `next` 发布。
3. 新增 `v*` tag 正式发布 workflow，完成版本校验、构建与正式 `npm publish`。
4. 更新 README 与贡献文档，说明版本管理规则、发布通道和推荐的 release 操作顺序。
5. 在 npm / GitHub 仓库配置中启用 trusted publishing；若暂未具备条件，则配置 `NPM_TOKEN` 作为过渡方案。
6. 使用测试分支或临时包名验证 workflow 行为后，再在正式仓库启用自动发布。

## Open Questions

- 是否需要在后续 change 中补充 changelog / GitHub Release note 的自动生成。
- 是否需要为 prerelease 发布增加更细粒度的触发过滤，例如仅在包内容变化时发布。
