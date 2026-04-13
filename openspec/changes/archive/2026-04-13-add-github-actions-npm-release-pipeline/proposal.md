## Why

当前仓库已经具备 npm 包发布基础，但发布动作仍依赖人工操作，既不利于在 `main` 上持续产出可安装的预发布版本，也容易在正式发版时出现版本号、tag 与 npm 实际发布版本不一致的问题。考虑到 `main` 只能通过 PR 变更，仓库需要一套明确的版本演进规则和 GitHub Actions 发布流水线，把“预发布验证”和“正式发布”拆成可审计、可重复的自动化流程。

## What Changes

- 新增基于 GitHub Actions 的 npm 发布流水线，在 `main` 分支合入后自动发布 `next` 通道的预发布版本。
- 新增基于 `v*` tag 的正式发布流水线，在 tag 与 `package.json` 版本一致时发布 npm 正式版。
- 定义版本管理规则：`main` 分支中的 `package.json` 维护“下一个正式版号”，预发布版本号由 CI 临时派生，不回写仓库。
- 为发布流程补充可复用的版本计算与校验逻辑，避免把关键规则散落在 workflow shell 片段中。
- 更新仓库文档，说明 prerelease / release 的触发条件、版本变更方式、npm tag 语义以及失败时的排查路径。

## Capabilities

### New Capabilities
- `npm-release-publishing`: 提供基于 GitHub Actions 的 npm 预发布与正式发布流水线，并约束版本号来源、tag 校验和发布通道语义。

### Modified Capabilities

## Impact

- `.github/workflows/` 下的 CI / 发布 workflow 文件
- 可能新增的 `scripts/release/` 版本计算与校验脚本
- `package.json` 中与发布相关的辅助脚本
- `README.md`、`docs/README.zh-CN.md`、`docs/CONTRIBUTING.zh-CN.md` 等发布说明文档
- GitHub 仓库的 Actions 权限配置与 npm 发布认证配置
