# release-branch-governance Specification

## Purpose
定义仓库的版本线职责、`main` 的正式发布入口约束，以及多条发布线之间的前向同步规则。

## Requirements

### Requirement: Repository SHALL assign semver responsibilities by release branch type
仓库 SHALL 使用命名分支来表达版本线职责，并将 `main`、`next/*`、`release/*`、`hotfix/*` 分别映射到稳定线、MAJOR 线、MINOR 线和 PATCH 线。

#### Scenario: Create a MAJOR release line
- **WHEN** 维护者从当前稳定线开启一次新的 MAJOR 周期
- **THEN** 系统 SHALL 使用 `next/x.x.x` 命名该分支
- **THEN** 该分支 SHALL 被视为允许 breaking changes 的 MAJOR 版本线

#### Scenario: Create a MINOR release line
- **WHEN** 维护者从当前稳定线开启一次新的 MINOR 周期
- **THEN** 系统 SHALL 使用 `release/x.x.x` 命名该分支
- **THEN** 该分支 SHALL 被视为承接向后兼容功能和修复的 MINOR 版本线

#### Scenario: Create a PATCH release line
- **WHEN** 维护者为当前稳定版修复线上问题
- **THEN** 系统 SHALL 使用 `hotfix/x.x.x` 命名该分支
- **THEN** 该分支 SHALL 只承接 PATCH 范围内的修复

### Requirement: `main` SHALL accept only formal release pull requests
仓库 SHALL 将 `main` 定义为当前稳定发布线，并且只允许通过正式发布 PR 接收来自版本线的变更。

#### Scenario: Merge a MINOR release into `main`
- **WHEN** 一个源分支为 `release/x.x.x` 的 PR 合入 `main`
- **THEN** 系统 SHALL 将该合并视为一次 MINOR 正式发布入口

#### Scenario: Merge a MAJOR release into `main`
- **WHEN** 一个源分支为 `next/x.x.x` 的 PR 合入 `main`
- **THEN** 系统 SHALL 将该合并视为一次 MAJOR 正式发布入口

#### Scenario: Merge a PATCH release into `main`
- **WHEN** 一个源分支为 `hotfix/x.x.x` 的 PR 合入 `main`
- **THEN** 系统 SHALL 将该合并视为一次 PATCH 正式发布入口

### Requirement: Release branch versions SHALL match `package.json.version`
每条活跃版本线中的 `package.json.version` SHALL 与该分支名中的目标版本完全一致，并表示该分支要发布的稳定版本。

#### Scenario: Validate a MINOR release branch version
- **WHEN** 分支名为 `release/1.5.0`
- **THEN** 系统 SHALL 要求该分支中的 `package.json.version` 为 `1.5.0`

#### Scenario: Validate a MAJOR release branch version
- **WHEN** 分支名为 `next/2.0.0`
- **THEN** 系统 SHALL 要求该分支中的 `package.json.version` 为 `2.0.0`

#### Scenario: Validate a hotfix branch version
- **WHEN** 分支名为 `hotfix/1.4.1`
- **THEN** 系统 SHALL 要求该分支中的 `package.json.version` 为 `1.4.1`

### Requirement: Repository SHALL define forward-only propagation across active release lines
仓库 SHALL 为正式发布后的修复和治理变更定义固定的前向同步方向，以避免多条版本线长期分叉。

#### Scenario: Forward-port a hotfix after PATCH release
- **WHEN** 一个 `hotfix/x.x.x` 分支已经合入 `main` 并完成 PATCH 正式发布
- **THEN** 系统 SHALL 要求维护者将该修复同步到当前活跃的 `release/*`
- **THEN** 系统 SHALL 要求维护者将该修复同步到当前活跃的 `next/*`

#### Scenario: Forward-port a MINOR release after formal publish
- **WHEN** 一个 `release/x.x.x` 分支已经合入 `main` 并完成 MINOR 正式发布
- **THEN** 系统 SHALL 要求维护者将通用修复和治理变更同步到当前活跃的 `next/*`

#### Scenario: Prevent backward propagation from MAJOR to MINOR
- **WHEN** 一个变更只存在于 `next/x.x.x` MAJOR 版本线
- **THEN** 系统 SHALL NOT 要求该变更自动回灌到 `release/x.x.x`

### Requirement: Repository SHALL limit concurrently active release lines
仓库 SHALL 限制同时活跃的 MAJOR 和 MINOR 版本线数量，以控制发布治理复杂度。

#### Scenario: Keep a single active MAJOR line
- **WHEN** 仓库已经存在一个活跃的 `next/x.x.x` 分支
- **THEN** 系统 SHALL 要求维护者在关闭或发布该分支前不再创建第二条活跃 `next/*`

#### Scenario: Keep a single active MINOR line
- **WHEN** 仓库已经存在一个活跃的 `release/x.x.x` 分支
- **THEN** 系统 SHALL 要求维护者在关闭或发布该分支前不再创建第二条活跃 `release/*`
