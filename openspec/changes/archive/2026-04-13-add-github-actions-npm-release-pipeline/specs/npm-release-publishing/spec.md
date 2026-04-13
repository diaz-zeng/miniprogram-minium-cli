## ADDED Requirements

### Requirement: Repository SHALL publish an npm prerelease from `main` after PR-merged changes
仓库 SHALL 在 `main` 分支接收到新的合入提交后，通过 GitHub Actions 执行依赖安装、测试、构建，并发布一个可安装的 npm 预发布版本。

#### Scenario: Publish a prerelease from `main`
- **WHEN** 一个通过 PR 合入的提交到达 `main` 分支
- **THEN** 系统 SHALL 执行与正式发布一致的基础校验流程，包括依赖安装、测试和构建
- **THEN** 系统 SHALL 发布一个基于仓库正式版本派生的 prerelease 版本到 npm `next` tag

### Requirement: Prerelease publishing SHALL derive a unique temporary version from the stable version in `package.json`
预发布流水线 SHALL 从 `package.json` 中读取稳定版本号作为正式发布基线，并派生唯一的临时 prerelease 版本；该临时版本 MUST 不回写仓库。

#### Scenario: Derive a prerelease version without mutating the repository
- **WHEN** `package.json` 中的版本号为稳定 semver，例如 `1.3.0`
- **THEN** 系统 SHALL 生成唯一的临时 prerelease 版本，例如 `1.3.0-beta.<unique-identifiers>`
- **THEN** 工作流结束后仓库中的 `package.json` 内容 SHALL 保持不变

#### Scenario: Reject a prerelease workflow when the repository version is already a prerelease
- **WHEN** `main` 分支中的 `package.json.version` 已经包含 prerelease 后缀
- **THEN** 系统 SHALL 终止 prerelease 发布流程
- **THEN** 系统 SHALL 提示仓库版本必须表示“下一个正式版”而不是临时 beta 版本

### Requirement: Repository SHALL publish a stable npm release from a matching `v*` tag
仓库 SHALL 在接收到 `v*` 格式的 git tag 时，通过 GitHub Actions 发布 npm 正式版本，并把该版本暴露为稳定安装通道。

#### Scenario: Publish a stable release from a matching tag
- **WHEN** 仓库收到形如 `v1.3.0` 的 tag，且 `package.json.version` 为 `1.3.0`
- **THEN** 系统 SHALL 执行正式发布所需的依赖安装、测试和构建步骤
- **THEN** 系统 SHALL 将该版本发布为 npm 稳定版

### Requirement: Stable release publishing MUST validate tag-version consistency before publish
正式发布流程 MUST 在执行 `npm publish` 前校验 git tag 与仓库版本完全一致；若不一致，系统 MUST 拒绝发布。

#### Scenario: Refuse a stable release when tag and package version differ
- **WHEN** 触发正式发布的 tag 去掉 `v` 前缀后与 `package.json.version` 不一致
- **THEN** 系统 SHALL 在发布前失败退出
- **THEN** 系统 SHALL 输出结构化或明确的人类可读错误，指出 tag 与仓库版本不一致

### Requirement: Repository versioning SHALL use `package.json` as the source of truth for the next stable release
仓库 SHALL 使用 `package.json.version` 作为下一次正式发版的单一事实源，并通过常规 PR 流程显式推进该版本号。

#### Scenario: Prepare the next release line through a PR
- **WHEN** 维护者计划开始一个新的发布周期，例如从已发布的 `1.2.0` 进入 `1.3.0`
- **THEN** 系统 SHALL 允许维护者通过一个 PR 把 `package.json.version` 更新为 `1.3.0`
- **THEN** 后续 `main` 分支上的 prerelease SHALL 基于 `1.3.0` 派生，而不是要求每次 merge 都提交新的 beta 版本号

#### Scenario: Advance to the next stable target after a formal release
- **WHEN** `1.3.0` 已经通过 tag 正式发布
- **THEN** 仓库流程 SHALL 要求维护者通过新的 PR 将版本推进到下一个稳定目标，例如 `1.3.1` 或 `1.4.0`
- **THEN** 后续 prerelease SHALL 以新的稳定目标作为派生基线

### Requirement: npm publishing SHOULD prefer trusted publishing with provenance
仓库的 npm 发布流水线 SHOULD 优先使用 GitHub Actions 的 trusted publishing，并为 provenance 生成提供所需权限；若未满足前置配置，系统 SHALL 提供清晰的替代配置说明。

#### Scenario: Publish through trusted publishing
- **WHEN** 仓库和 npm 包已经配置好 trusted publishing
- **THEN** 系统 SHALL 使用 GitHub Actions OIDC 完成 npm 发布认证
- **THEN** 发布流程 SHALL 具备 provenance 所需的权限配置

#### Scenario: Surface actionable guidance when trusted publishing is not configured
- **WHEN** 发布 workflow 因 trusted publishing 缺少前置配置而失败
- **THEN** 系统 SHALL 输出可操作的错误提示
- **THEN** 该提示 SHALL 说明需要补齐 trusted publishing 配置或使用受支持的过渡认证方案
