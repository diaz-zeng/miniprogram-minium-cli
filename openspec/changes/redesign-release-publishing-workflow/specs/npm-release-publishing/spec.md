## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Repository SHALL publish a canary npm build from same-repository PR head branches
仓库 SHALL 在同仓库 PR 的源分支创建、重新打开或收到新推送时，通过 GitHub Actions 执行依赖安装、测试、构建，并发布一个可安装的 canary 版本到 npm。

#### Scenario: Publish a canary build from a PR head branch
- **WHEN** 一个来自同仓库分支的 PR 被创建、重新打开，或其源分支收到新的推送
- **THEN** 系统 SHALL 基于 PR 源分支的最新 `head.sha` 执行依赖安装、测试和构建
- **THEN** 系统 SHALL 发布一个基于该 PR 目标版本线稳定版本派生的唯一 canary 版本到 npm `canary` tag

### Requirement: Prerelease publishing SHALL derive a unique temporary version from the stable version in `package.json`
预发布流水线 SHALL 从当前版本线的 `package.json` 中读取稳定版本号作为正式发布基线，并派生唯一的临时 prerelease 版本；该临时版本 MUST 不回写仓库。该约束同时适用于 `next/*` 上的 alpha 发布、`release/*` 上的 beta 发布和同仓库 PR 上的 canary 发布。

#### Scenario: Derive an alpha prerelease version without mutating the repository
- **WHEN** `next/2.0.0` 分支中的 `package.json.version` 为稳定 semver `2.0.0`
- **THEN** 系统 SHALL 生成唯一的临时 alpha 版本，例如 `2.0.0-alpha.<unique-identifiers>`
- **THEN** 工作流结束后仓库中的 `package.json` 内容 SHALL 保持不变

#### Scenario: Derive a beta prerelease version without mutating the repository
- **WHEN** `release/1.5.0` 分支中的 `package.json.version` 为稳定 semver `1.5.0`
- **THEN** 系统 SHALL 生成唯一的临时 beta 版本，例如 `1.5.0-beta.<unique-identifiers>`
- **THEN** 工作流结束后仓库中的 `package.json` 内容 SHALL 保持不变

#### Scenario: Derive a canary prerelease version without mutating the repository
- **WHEN** 一个同仓库 PR 的源分支触发 canary 发布，且其目标版本线中的 `package.json.version` 为稳定 semver
- **THEN** 系统 SHALL 生成唯一的临时 canary 版本，例如 `1.5.0-canary-pr-42.<unique-identifiers>`
- **THEN** 工作流结束后仓库中的 `package.json` 内容 SHALL 保持不变

#### Scenario: Reject a prerelease workflow when the repository version is already a prerelease
- **WHEN** 任何 alpha、beta 或 canary workflow 读取到的 `package.json.version` 已经包含 prerelease 后缀
- **THEN** 系统 SHALL 终止 prerelease 发布流程
- **THEN** 系统 SHALL 提示仓库版本必须表示该版本线的目标正式版，而不是临时 alpha、beta 或 canary 版本

#### Scenario: Reject alpha, beta, and canary publishing when the stable base version already exists on npm
- **WHEN** 当前版本线中的 `package.json.version` 为稳定 semver，例如 `1.5.0`
- **AND** npm registry 中已经存在同名包的正式版 `1.5.0`
- **THEN** alpha、beta 和 canary 发布流程 SHALL 在执行 `npm publish` 之前失败退出
- **THEN** 系统 SHALL 提示维护者改用新的版本线或推进版本目标，而不是继续沿用已经正式发布过的稳定版本

### Requirement: Repository versioning SHALL use `package.json` as the source of truth for the target stable release on each active version line
仓库 SHALL 使用每条活跃版本线中的 `package.json.version` 作为该版本线目标正式版的单一事实源，并通过对应的分支和 PR 流程显式推进版本。

#### Scenario: Prepare a new MINOR release line
- **WHEN** 维护者计划开始一个新的 MINOR 发布周期，例如从稳定版 `1.4.0` 进入 `1.5.0`
- **THEN** 系统 SHALL 允许维护者创建 `release/1.5.0` 并把 `package.json.version` 设为 `1.5.0`
- **THEN** 后续该分支上的 beta prerelease 和指向该分支的 canary prerelease SHALL 都基于 `1.5.0` 派生

#### Scenario: Prepare a new MAJOR release line
- **WHEN** 维护者计划开始一个新的 MAJOR 发布周期，例如从稳定版 `1.4.0` 进入 `2.0.0`
- **THEN** 系统 SHALL 允许维护者创建 `next/2.0.0` 并把 `package.json.version` 设为 `2.0.0`
- **THEN** 后续该分支上的 alpha prerelease SHALL 基于 `2.0.0` 派生

#### Scenario: Prepare a new hotfix line
- **WHEN** 维护者计划为稳定版 `1.4.0` 发布补丁 `1.4.1`
- **THEN** 系统 SHALL 允许维护者创建 `hotfix/1.4.1` 并把 `package.json.version` 设为 `1.4.1`

## REMOVED Requirements

### Requirement: Repository SHALL publish an npm prerelease from `main` after PR-merged changes
**Reason**: `main` 不再作为预发布集成线，而只作为正式稳定发布线；预发布职责改由 `next/*` 和 `release/*` 承担。
**Migration**: 将原本依赖 `main` 自动发布 `next` 的流程迁移到 `release/x.x.x` 的 beta 发布和 `next/x.x.x` 的 alpha 发布。

### Requirement: Repository SHALL publish a stable npm release from a matching `v*` tag
**Reason**: 正式发布入口从手工推 tag 改为 release PR 合入 `main`，tag 只作为发布成功后的自动产物。
**Migration**: 使用 `next/* -> main`、`release/* -> main` 或 `hotfix/* -> main` 的正式发布 PR 触发稳定版发布，并让 workflow 自动创建 tag。

### Requirement: Stable release publishing MUST validate tag-version consistency before publish
**Reason**: tag 已不再是正式发布触发器，因此“发布前校验 tag 与版本一致”不再是主门禁。
**Migration**: 改为在正式发布前校验 merged PR 来源分支、分支版本、`package.json.version`、npm 已发布状态，以及 GitHub tag / Release 是否已存在。
