# 变更日志

[English](../CHANGELOG.md)

本文件记录项目中所有值得关注的变更。

格式参考 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)，版本遵循 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)。

## [Unreleased]

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
