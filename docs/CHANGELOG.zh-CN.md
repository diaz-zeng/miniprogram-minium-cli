# 变更日志

[English](../CHANGELOG.md)

本文件记录项目中所有值得关注的变更。

格式参考 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)，版本遵循 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)。

## [Unreleased]

## [1.0.0] - 2026-04-05

### Added

- 在 `skills/miniprogram-minium-cli/` 下提供由仓库维护的一方产品使用类 skill，可供不同 coding agent 复用。
- 支持通过 `install --skills` 安装随包 skill，并支持通过开放的 `skills` 工具从仓库直接安装。

### Changed

- 将已发布的 beta 版本线正式提升为首个稳定版 `1.0.0`。
- 默认的随包 skill 安装目录调整为当前执行目录下的 `./.agents/skills`，同时可通过 `--path` 安装到共享全局或特定 agent 目录。

## [1.0.0-beta.0] - 2026-04-05

### Added

- `miniprogram-minium-cli` 的首个公开 Beta 版本。
- 通过 `exec --plan` 执行结构化计划文件。
- 通过 `exec --plan-json` 直接执行内联 JSON 计划。
- 基于 `uv` 的托管 Python 运行时，用于驱动 Minium 执行。
- 自动截图模式与显式截图步骤。
- 基于 TaroJS 的示例小程序与本地回归计划。
- 通过微信开发者工具接入真实 Minium 执行链路。
- 结构化运行产物，包括摘要、结果、对比文件与截图。
- 英文 CLI 输出与双语项目文档。

### Changed

- CLI 当前只聚焦执行能力，计划生成应由 agent 或外部工具完成。
- 默认运行产物目录调整为 `.minium-cli/runs`。
- Node.js 层已统一为 TypeScript 实现。
