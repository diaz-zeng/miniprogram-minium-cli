# npm-release-publishing Specification

## Purpose
定义仓库如何通过 GitHub Actions 向 npm 发布 `miniprogram-minium-cli` 的预发布版与正式版，并约束版本号来源、分支发布入口、dist-tag 语义与发布认证策略。

## Requirements

### Requirement: Repository SHALL publish a MAJOR prerelease from active `next/*` branches
仓库 SHALL 在活跃 `next/x.x.x` 分支收到新的提交时，通过 GitHub Actions 执行依赖安装、测试、构建，并发布一个可安装的 MAJOR 预发布版本。

#### Scenario: Publish an alpha build from a MAJOR release branch
- **WHEN** 一个提交到达 `next/2.0.0` 之类的活跃 MAJOR 分支
- **THEN** 系统 SHALL 执行依赖安装、测试和构建
- **THEN** 系统 SHALL 发布一个基于该分支稳定版本派生的唯一 alpha 版本到 npm `alpha` tag

### Requirement: Repository SHALL publish a MINOR prerelease from active `release/*` branches
仓库 SHALL 在活跃 `release/x.x.x` 分支收到新的提交时，通过 GitHub Actions 执行依赖安装、测试、构建，并发布一个可安装的 MINOR 预发布版本。

#### Scenario: Publish a beta build from a MINOR release branch
- **WHEN** 一个提交到达 `release/1.5.0` 之类的活跃 MINOR 分支
- **THEN** 系统 SHALL 执行依赖安装、测试和构建
- **THEN** 系统 SHALL 发布一个基于该分支稳定版本派生的唯一 beta 版本到 npm `next` tag

### Requirement: Repository SHALL publish a stable npm release after a formal release PR is merged into `main`
仓库 SHALL 在 `next/*`、`release/*` 或 `hotfix/*` 的正式发布 PR 合入 `main` 后，通过 GitHub Actions 执行稳定版发布，并将该版本暴露为默认安装通道。

#### Scenario: Publish a stable release from a merged MINOR release PR
- **WHEN** 一个源分支为 `release/1.5.0` 的 PR 合入 `main`
- **THEN** 系统 SHALL 将该合并识别为一次 MINOR 正式发布
- **THEN** 系统 SHALL 将 `1.5.0` 发布到 npm `latest`

#### Scenario: Publish a stable release from a merged MAJOR release PR
- **WHEN** 一个源分支为 `next/2.0.0` 的 PR 合入 `main`
- **THEN** 系统 SHALL 将该合并识别为一次 MAJOR 正式发布
- **THEN** 系统 SHALL 将 `2.0.0` 发布到 npm `latest`

#### Scenario: Publish a stable release from a merged hotfix PR
- **WHEN** 一个源分支为 `hotfix/1.4.1` 的 PR 合入 `main`
- **THEN** 系统 SHALL 将该合并识别为一次 PATCH 正式发布
- **THEN** 系统 SHALL 将 `1.4.1` 发布到 npm `latest`

### Requirement: Prerelease publishing SHALL derive a unique temporary version from the stable version in `package.json`
预发布流水线 SHALL 从当前版本线的 `package.json` 中读取稳定版本号作为正式发布基线，并派生唯一的临时 prerelease 版本；该临时版本 MUST 不回写仓库。该约束同时适用于 `next/*` 上的 alpha 发布和 `release/*` 上的 beta 发布。

#### Scenario: Derive an alpha prerelease version without mutating the repository
- **WHEN** `next/2.0.0` 分支中的 `package.json.version` 为稳定 semver `2.0.0`
- **THEN** 系统 SHALL 生成唯一的临时 alpha 版本，例如 `2.0.0-alpha.<unique-identifiers>`
- **THEN** 工作流结束后仓库中的 `package.json` 内容 SHALL 保持不变

#### Scenario: Derive a beta prerelease version without mutating the repository
- **WHEN** `release/1.5.0` 分支中的 `package.json.version` 为稳定 semver `1.5.0`
- **THEN** 系统 SHALL 生成唯一的临时 beta 版本，例如 `1.5.0-beta.<unique-identifiers>`
- **THEN** 工作流结束后仓库中的 `package.json` 内容 SHALL 保持不变

#### Scenario: Reject a prerelease workflow when the repository version is already a prerelease
- **WHEN** 任何 alpha 或 beta workflow 读取到的 `package.json.version` 已经包含 prerelease 后缀
- **THEN** 系统 SHALL 终止 prerelease 发布流程
- **THEN** 系统 SHALL 提示仓库版本必须表示该版本线的目标正式版，而不是临时 alpha 或 beta 版本

#### Scenario: Reject alpha and beta publishing when the stable base version already exists on npm
- **WHEN** 当前版本线中的 `package.json.version` 为稳定 semver，例如 `1.5.0`
- **AND** npm registry 中已经存在同名包的正式版 `1.5.0`
- **THEN** alpha 和 beta 发布流程 SHALL 在执行 `npm publish` 之前失败退出
- **THEN** 系统 SHALL 提示维护者改用新的版本线或推进版本目标，而不是继续沿用已经正式发布过的稳定版本

### Requirement: Stable release publishing SHALL create the git tag and GitHub Release after npm publish succeeds
正式发布流程 SHALL 在 npm `latest` 发布成功后自动创建对应的 git tag 和 GitHub Release，不再依赖手工推 tag 作为发布入口。

#### Scenario: Create git release artifacts after stable publish
- **WHEN** 一个正式发布 workflow 已经成功将稳定版本发布到 npm
- **THEN** 系统 SHALL 自动创建对应版本的 git tag，例如 `v1.5.0`
- **THEN** 系统 SHALL 自动创建对应版本的 GitHub Release

### Requirement: Stable release publishing SHALL use the current version's changelog section as the primary GitHub Release body
正式发布流程 SHALL 从 `CHANGELOG.md` 中提取当前稳定版本对应的章节，作为 GitHub Release 正文主体，并可附加自动生成的 release notes 作为补充内容。

#### Scenario: Create a GitHub Release body from the current changelog section
- **WHEN** 一个正式发布 workflow 正在为版本 `1.5.0` 创建 GitHub Release
- **THEN** 系统 SHALL 从 `CHANGELOG.md` 中提取 `1.5.0` 对应的章节内容
- **THEN** 系统 SHALL 将该章节内容写入 GitHub Release 正文主体
- **THEN** 系统 MAY 在正文后附加自动生成的 release notes 作为补充说明

#### Scenario: Refuse to create a stable GitHub Release when the changelog entry is missing
- **WHEN** 一个正式发布 workflow 无法在 `CHANGELOG.md` 中找到当前稳定版本对应的章节
- **THEN** 系统 SHALL 终止正式发布流程
- **THEN** 系统 SHALL 输出明确错误，提示维护者先补齐该版本的 changelog

### Requirement: Repository versioning SHALL use `package.json` as the source of truth for the target stable release on each active version line
仓库 SHALL 使用每条活跃版本线中的 `package.json.version` 作为该版本线目标正式版的单一事实源，并通过对应的分支和 PR 流程显式推进版本。

#### Scenario: Prepare a new MINOR release line
- **WHEN** 维护者计划开始一个新的 MINOR 发布周期，例如从稳定版 `1.4.0` 进入 `1.5.0`
- **THEN** 系统 SHALL 允许维护者创建 `release/1.5.0` 并把 `package.json.version` 设为 `1.5.0`
- **THEN** 后续该分支上的 beta prerelease SHALL 都基于 `1.5.0` 派生

#### Scenario: Prepare a new MAJOR release line
- **WHEN** 维护者计划开始一个新的 MAJOR 发布周期，例如从稳定版 `1.4.0` 进入 `2.0.0`
- **THEN** 系统 SHALL 允许维护者创建 `next/2.0.0` 并把 `package.json.version` 设为 `2.0.0`
- **THEN** 后续该分支上的 alpha prerelease SHALL 基于 `2.0.0` 派生

#### Scenario: Prepare a new hotfix line
- **WHEN** 维护者计划为稳定版 `1.4.0` 发布补丁 `1.4.1`
- **THEN** 系统 SHALL 允许维护者创建 `hotfix/1.4.1` 并把 `package.json.version` 设为 `1.4.1`

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
