## Why

当前仓库的正式发布依赖 `v*` tag 直接触发，预发布则绑定到 `main` 分支，这使“发布意图”主要由 tag 或主干 push 表达，而不是由经过评审的 release PR 表达。随着仓库需要同时管理 MAJOR、MINOR、PATCH 三类版本演进，现有模型已经难以提供足够清晰的分支职责、发布门禁和审计路径，因此需要用新的分支驱动发布体系整体替换旧流水线。

## What Changes

- **BREAKING** 以 `main` 接收正式发布 PR 的模式替换“`main` 自动发布 `next` + `v*` tag 触发正式版”的旧模型。
- 引入新的发布分支规范：
  - `next/x.x.x` 负责 MAJOR 版本研发与预览发布。
  - `release/x.x.x` 负责 MINOR 版本研发与 beta 发布。
  - `hotfix/x.x.x` 负责 PATCH 修复与稳定版修复发布。
  - `main` 仅代表当前稳定发布线，并接收正式发布 PR。
- 重新定义 npm 发布通道与触发方式：
  - PR 源分支继续发布 `canary`。
  - `next/x.x.x` 分支发布 MAJOR 预发布通道。
  - `release/x.x.x` 分支发布 MINOR 预发布通道。
  - `hotfix/*`、`release/*`、`next/*` 合入 `main` 后发布 `latest`。
- 用 GitHub Actions 在正式发布成功后自动创建 git tag 与 GitHub Release，移除“手工推 tag 触发正式发布”的入口。
- 补充版本线生命周期、前向同步、release PR 识别、Environment 审批和版本校验规则，并更新相关文档与辅助脚本。

## Capabilities

### New Capabilities
- `release-branch-governance`: 定义 `main`、`next/*`、`release/*`、`hotfix/*` 的职责、生命周期、合并方向、前向同步规则与正式发布入口。

### Modified Capabilities
- `npm-release-publishing`: 将现有发布要求从 tag/main 驱动改为分支驱动，重写各 npm dist-tag 的语义、触发条件、正式发布门禁，以及自动创建 tag / GitHub Release 的要求。

## Impact

- `.github/workflows/` 下的所有现有发布 workflow，需要重新设计或替换。
- `scripts/release/` 下的版本计算、触发校验、分支识别和发布后处理脚本。
- `package.json` 中与发版相关的脚本入口。
- `README.md`、`docs/README.zh-CN.md`、`CONTRIBUTING.md`、`docs/CONTRIBUTING.zh-CN.md` 等维护者工作流文档。
- GitHub 仓库侧的分支保护、Environment 审批、Actions 权限，以及 npm trusted publishing 配置。
