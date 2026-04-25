# Changelog

[中文](./docs/CHANGELOG.zh-CN.md)

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.4.0] - 2026-04-25

### Added

- Run-level `network.json` artifact indexes for events, requests, listeners, and intercepts, plus per-step `networkEvidence` links in `result.json`.
- Network artifact filtering helper at `skills/miniprogram-minium-cli/scripts/filter-network-artifact.mjs` for reducing large run artifacts to the request graph relevant to selected steps.
- `file.stage` bridge action for staging deterministic upload fixtures into miniapp user data before `file.upload`.
- Local fixture-server regression coverage through `examples/demo-regression/network-fixture-server.mjs` and `15-network-local-server.real.plan.json`, covering real `wx.request`, `wx.uploadFile`, and `wx.downloadFile` execution in WeChat DevTools.

### Changed

- Network waits and assertions now use the aligned artifact model so matched request and response evidence is easier for agents to inspect without scanning the full event log.
- Demo network regression docs now distinguish fast synthetic placeholder baselines from the real local-server network acceptance plan.
- Archived the completed `add-network-request-controls` OpenSpec change and added main specs for network observation and interception.
- Updated the release target version to `1.4.0`.

## [1.3.0] - 2026-04-17

### Added

- Structured network observation controls for miniapp execution, including `network.listen.start`, `network.listen.stop`, `network.listen.clear`, `network.wait`, `assert.networkRequest`, and `assert.networkResponse`.
- Structured network interception controls through `network.intercept.add`, `network.intercept.remove`, and `network.intercept.clear` for mock, fail, and delay behaviors.
- Network-focused demo regression plans under `examples/demo-regression/12-network-observation.placeholder.plan.json`, `13-network-failure.placeholder.plan.json`, and `14-network-transfer.placeholder.plan.json`.
- OpenSpec change artifacts for network request controls under `openspec/changes/add-network-request-controls/`.

### Changed

- The placeholder runtime now records network request and response events for bridge-driven file and navigation flows so bundled plans can assert network behavior end to end.
- The real Minium runtime now initializes network observation hooks for listener-based and matcher-only network waits/assertions, including runtimes that omit callback IDs.
- Listener lifecycle handling now preserves shared observations when clearing one listener and prevents stale events from leaking into a later listener that reuses the same `listenerId`.
- The product skill, API reference, README guidance, and bundled examples now document the new network observation and interception workflow.

## [1.2.2] - 2026-04-15

### Changed

- Published `1.2.2` as a verification build for the new branch-driven release automation.
- Its user-facing functionality is unchanged from `1.2.0`; this version exists only to validate the updated publishing workflow.

## [1.2.1] - 2026-04-13

### Changed

- Published `1.2.1` as a release-automation verification build. Its functionality is identical to `1.2.0`; this version exists only to validate the automated packaging and publishing flow.

## [1.2.0] - 2026-04-13

### Added

- Structured miniapp bridge actions for storage, navigation, app context, settings, clipboard, feedback UI, location, media, file, device, auth, and subscription flows.
- Bridge-focused demo coverage in `examples/demo-miniapp/src/pages/bridge-lab/` and bundled regression plans `09-bridge-high-priority.exact.plan.json`, `10-bridge-medium.placeholder.plan.json`, and `11-bridge-tourist-skip.exact.plan.json`.
- Bridge-focused product-use skill guidance under `skills/miniprogram-minium-cli/`, including a dedicated `references/bridge-actions.md` reference for plan authoring, execution, and run analysis.

### Changed

- Local development now uses `pnpm` instead of `npm`, including repository scripts, lockfiles, and setup documentation.
- Bridge-backed execution now retries real Minium session startup to reduce flaky `session.start` failures during acceptance runs.
- Real-runtime tap gesture dispatch now triggers page tap state updates more reliably in the gesture demo flows.
- Placeholder runtime page resolution now normalizes initial page paths before querying demo elements, which keeps placeholder bridge assertions aligned with the bundled plans.
- The bridge lab tourist AppID note now renders plain `touristappid` text so real-runtime assertions match the bundled regression plans.
- Completed acceptance verification for all bundled demo regression plans, including a dedicated tourist-AppID validation pass for the restricted bridge skip scenario.
- User-facing skill installation docs now only describe two supported paths: `miniprogram-minium-cli install --skills` and repository installation through the open `skills` tool.

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
