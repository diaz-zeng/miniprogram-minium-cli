# Changelog

[中文](./docs/CHANGELOG.zh-CN.md)

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Structured miniapp bridge actions for storage, navigation, app context, settings, clipboard, feedback UI, location, media, file, device, auth, and subscription flows.
- Bridge-focused demo coverage in `examples/demo-miniapp/src/pages/bridge-lab/` and bundled regression plans `09-bridge-high-priority.exact.plan.json`, `10-bridge-medium.placeholder.plan.json`, and `11-bridge-tourist-skip.exact.plan.json`.
- Acceptance tracking for `add-miniapp-bridge-actions` through `openspec/changes/add-miniapp-bridge-actions/acceptance-checklist.md`.

### Changed

- Bridge-backed execution now retries real Minium session startup to reduce flaky `session.start` failures during acceptance runs.
- Real-runtime tap gesture dispatch now triggers page tap state updates more reliably in the gesture demo flows.
- Placeholder runtime page resolution now normalizes initial page paths before querying demo elements, which keeps placeholder bridge assertions aligned with the bundled plans.
- The bridge lab tourist AppID note now renders plain `touristappid` text so real-runtime assertions match the bundled regression plans.
- Completed acceptance verification for all bundled demo regression plans, including a dedicated tourist-AppID validation pass for the restricted bridge skip scenario.

## [1.1.0] - 2026-04-08

### Added

- A first-party repository skill under `skills/interactive-classname-tagging/` for development-time interactive automation markers.
- Dedicated marker guidance that requires `minium-anchor-<4hex>` on target interactive elements instead of relying on business or layout classes.

### Changed

- The bundled skills documentation now describes both repository skills and their install paths through `install --skills` and the open `skills` tool.
- Bundled skill installation tests now verify that `interactive-classname-tagging` is packaged and installed together with `miniprogram-minium-cli`.

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
