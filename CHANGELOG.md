# Changelog

[中文](./docs/CHANGELOG.zh-CN.md)

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-04-05

### Added

- A first-party repository skill under `skills/miniprogram-minium-cli/` for product usage across coding agents.
- Skill installation through `install --skills` and repository-based installation through the open `skills` tool.

### Changed

- Promoted the published beta line to the first stable `1.0.0` release.
- The default bundled skill installation root is now `./.agents/skills` under the current working directory, while `--path` supports shared global or agent-specific roots.

## [1.0.0-beta.0] - 2026-04-05

### Added

- First public beta release of `miniprogram-minium-cli`.
- Structured plan execution through `exec --plan`.
- Inline JSON execution through `exec --plan-json`.
- A managed `uv`-backed Python runtime for Minium execution.
- Automatic screenshot modes and explicit screenshot steps.
- A TaroJS demo miniapp and regression plans for local verification.
- Real Minium integration through WeChat DevTools.
- Structured run outputs including summaries, results, comparisons, and screenshots.
- English command output and bilingual project documentation.

### Changed

- The CLI now focuses on execution only. Plan generation is expected to be handled by agents or external tooling.
- The default run output directory is `.minium-cli/runs`.
- The Node.js layer is implemented in TypeScript.
