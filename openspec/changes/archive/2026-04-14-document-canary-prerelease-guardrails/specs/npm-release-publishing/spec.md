## ADDED Requirements

### Requirement: Repository SHALL publish a canary npm build from same-repository PR head branches
仓库 SHALL 在同仓库 PR 的源分支创建、重新打开或收到新推送时，通过 GitHub Actions 执行依赖安装、测试、构建，并发布一个可安装的 canary 版本到 npm。

#### Scenario: Publish a canary build from a PR head branch
- **WHEN** 一个来自同仓库分支的 PR 被创建、重新打开，或其源分支收到新的推送
- **THEN** 系统 SHALL 基于 PR 源分支的最新 `head.sha` 执行依赖安装、测试和构建
- **THEN** 系统 SHALL 发布一个基于仓库稳定版本派生的唯一 canary 版本到 npm `canary` tag

## MODIFIED Requirements

### Requirement: Prerelease publishing SHALL derive a unique temporary version from the stable version in `package.json`
预发布流水线 SHALL 从 `package.json` 中读取稳定版本号作为正式发布基线，并派生唯一的临时 prerelease 版本；该临时版本 MUST 不回写仓库。该约束同时适用于 `main` 上的 beta / prerelease 发布和 PR 上的 canary 发布。

#### Scenario: Derive a beta prerelease version without mutating the repository
- **WHEN** `package.json` 中的版本号为稳定 semver，例如 `1.3.0`
- **THEN** 系统 SHALL 生成唯一的临时 beta 版本，例如 `1.3.0-beta.<unique-identifiers>`
- **THEN** 工作流结束后仓库中的 `package.json` 内容 SHALL 保持不变

#### Scenario: Derive a canary prerelease version without mutating the repository
- **WHEN** `package.json` 中的版本号为稳定 semver，例如 `1.3.0`
- **AND** 一个同仓库 PR 的源分支触发 canary 发布
- **THEN** 系统 SHALL 生成唯一的临时 canary 版本，例如 `1.3.0-canary-pr-42.<unique-identifiers>`
- **THEN** 工作流结束后仓库中的 `package.json` 内容 SHALL 保持不变

#### Scenario: Reject a prerelease workflow when the repository version is already a prerelease
- **WHEN** 任何 beta 或 canary workflow 读取到的 `package.json.version` 已经包含 prerelease 后缀
- **THEN** 系统 SHALL 终止 prerelease 发布流程
- **THEN** 系统 SHALL 提示仓库版本必须表示“下一个正式版”而不是临时 beta 或 canary 版本

#### Scenario: Reject beta and canary publishing when the stable base version already exists on npm
- **WHEN** `package.json.version` 为稳定 semver，例如 `1.2.3`
- **AND** npm registry 中已经存在同名包的正式版 `1.2.3`
- **THEN** beta 和 canary 发布流程 SHALL 在执行 `npm publish` 之前失败退出
- **THEN** 系统 SHALL 提示维护者先通过 PR 将 `package.json.version` 推进到下一个目标正式版本，再继续预发布

### Requirement: Repository versioning SHALL use `package.json` as the source of truth for the next stable release
仓库 SHALL 使用 `package.json.version` 作为下一次正式发版的单一事实源，并通过常规 PR 流程显式推进该版本号。

#### Scenario: Prepare the next release line through a PR
- **WHEN** 维护者计划开始一个新的发布周期，例如从已发布的 `1.2.0` 进入 `1.3.0`
- **THEN** 系统 SHALL 允许维护者通过一个 PR 把 `package.json.version` 更新为 `1.3.0`
- **THEN** 后续 `main` 分支上的 beta prerelease 和同仓库 PR 上的 canary prerelease SHALL 都基于 `1.3.0` 派生，而不是要求每次 merge 或每次 push 都提交新的预发布版本号

#### Scenario: Advance to the next stable target after a formal release
- **WHEN** `1.3.0` 已经通过 tag 正式发布
- **THEN** 仓库流程 SHALL 要求维护者通过新的 PR 将版本推进到下一个稳定目标，例如 `1.3.1` 或 `1.4.0`
- **THEN** 后续 beta 和 canary prerelease SHALL 以新的稳定目标作为派生基线
