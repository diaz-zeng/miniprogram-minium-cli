# miniprogram-minium-cli

[![npm version](https://img.shields.io/npm/v/miniprogram-minium-cli)](https://www.npmjs.com/package/miniprogram-minium-cli)
[![npm downloads](https://img.shields.io/npm/dm/miniprogram-minium-cli)](https://www.npmjs.com/package/miniprogram-minium-cli)
[![GitHub last commit](https://img.shields.io/github/last-commit/diaz-zeng/miniprogram-minium-cli)](https://github.com/diaz-zeng/miniprogram-minium-cli)
[![GitHub license](https://img.shields.io/github/license/diaz-zeng/miniprogram-minium-cli)](https://github.com/diaz-zeng/miniprogram-minium-cli/blob/main/LICENSE)

[中文](./docs/README.zh-CN.md)

`miniprogram-minium-cli` is a command-line product for executing structured mini program automation plans.

It is designed for agent-driven workflows:

- the agent generates a plan
- the CLI validates and executes that plan
- the CLI writes structured results and screenshots to `.minium-cli/runs`

This package uses [Minium](https://pypi.org/project/minium/) as the underlying automation engine.

## Product Positioning

`miniprogram-minium-cli` is an execution layer, not a planner.

Its responsibility is to:

- accept a structured plan
- prepare the managed runtime
- connect to WeChat DevTools
- execute supported automation steps
- produce machine-readable and human-readable run artifacts

It does not include an MCP server, and it does not depend on a built-in natural-language planner.

## Functional Scope

The current product supports:

- plan execution from files through `--plan`
- plan execution from inline JSON through `--plan-json`
- exact selectors and fuzzy text matching
- clicks, text input, waits, and assertions
- network observation and interception for `wx.request`, `wx.uploadFile`, and `wx.downloadFile`, including listener, wait, assertion, fail, delay, and mock controls
- bridge-backed miniapp actions for storage, navigation, app context, settings, clipboard, feedback UI, location, media, file, device, auth, and subscription flows
- explicit screenshots and automatic screenshots
- single-finger and multi-finger gestures
- structured outputs including `summary.json`, `result.json`, `comparison.json`, `network.json`, and screenshot files

## Step Categories

Automation plans combine four step categories:

- session and artifact steps such as `session.start`, `artifact.screenshot`, and `session.close`
- UI steps such as `element.click`, `element.input`, `page.read`, `wait.for`, and `gesture.*`
- network steps such as `network.listen.start`, `network.wait`, `network.intercept.add`, `assert.networkRequest`, and `assert.networkResponse`
- bridge-backed steps such as `storage.set`, `navigation.navigateTo`, `clipboard.get`, `settings.authorize`, `auth.login`, and `location.get`
- assertion steps such as `assert.pagePath`, `assert.elementText`, and `assert.elementVisible`

Bridge-backed steps expose a controlled subset of mini program native capabilities through structured plan types instead of a raw `wx` method passthrough.

For the full step catalog and per-step input fields, see [API_REFERENCE.md](./docs/API_REFERENCE.md).

## Network Controls

Network steps let a plan observe or control request-side behavior without dropping into ad hoc scripts.

- use `network.listen.start` and `network.listen.stop` to scope evidence collection to a session
- use `network.wait`, `assert.networkRequest`, and `assert.networkResponse` to verify that a click or bridge step emitted the expected request or response
- use `network.intercept.add`, `network.intercept.remove`, and `network.intercept.clear` to continue, fail, delay, or mock matching requests
- inspect `network.json` when you need the normalized event log, matched listener IDs, and interception hit counts

Typical network matcher fields include `url`, `urlPattern`, `method`, `resourceType`, `query`, `headers`, `body`, `statusCode`, `responseHeaders`, and `responseBody`.

Current runtime notes:

- placeholder mode provides deterministic in-memory network events for bundled examples and regression plans
- real runtime is wired through Minium hooks for `wx.request`, `wx.uploadFile`, and `wx.downloadFile`
- response-body assertions remain best-effort because Minium only exposes what the underlying runtime callback returns

## Plan Input

The CLI accepts two plan input modes.

For the complete plan schema, command surface, and step-level field reference, see [API_REFERENCE.md](./docs/API_REFERENCE.md).

### File-Based Plan

Use `--plan <file>` when the plan already exists on disk.

Relative paths inside the plan are resolved from the plan file directory.

### Inline JSON Plan

Use `--plan-json <json>` when an agent wants to execute a generated plan immediately.

Relative paths inside the inline JSON are resolved from the current working directory.

## Installation

```bash
pnpm add -g miniprogram-minium-cli
```

Host requirement:

- Node.js `>= 18`

The CLI prepares and reuses its own private `uv`-managed Python runtime on demand. It does not require the user to install or manage a global Python environment for this tool.

Install the bundled skills into the default local skills directory:

```bash
miniprogram-minium-cli install --skills
```

Install directly from this repository through the open `skills` tool:

```bash
npx skills add diaz-zeng/miniprogram-minium-cli --skill miniprogram-minium-cli
```

List the skills exposed by this repository before installing:

```bash
npx skills add diaz-zeng/miniprogram-minium-cli --list
```

Install into a custom skills root:

```bash
miniprogram-minium-cli install --skills --path /path/to/skills
```

By default, the command installs into `./.agents/skills` under the current working directory. For Claude Code, GitHub Copilot, and other coding agents, use `--path` to target an agent-specific local or global skills directory.

If your agent already supports the open `skills` ecosystem, you can also install from the repository with `npx skills add diaz-zeng/miniprogram-minium-cli --skill miniprogram-minium-cli`.

## Bundled Skills

The repository currently bundles these skills:

- `miniprogram-minium-cli`: product-use guidance for runtime setup, plan authoring, execution, skill installation, and run analysis
- `interactive-classname-tagging`: development-time guidance for explicit `minium-anchor-<4hex>` markers on interactive miniapp elements

Install a specific repository skill through the open `skills` tool:

```bash
npx skills add diaz-zeng/miniprogram-minium-cli --skill interactive-classname-tagging
```

## Release Channels

The repository publishes three npm channels:

- `canary`: the PR validation channel published from same-repository PR head branches
- `next`: the integration prerelease channel published automatically from `main` after merged PR changes
- `latest`: the stable release published from a matching `v*` git tag

Install the prerelease channels explicitly:

```bash
pnpm add -g miniprogram-minium-cli@canary
pnpm add -g miniprogram-minium-cli@next
```

## Maintainer Release Flow

This repository treats `package.json.version` as the source of truth for the next stable release.

1. Open a PR that updates `package.json.version` to the next intended stable version, such as `1.3.0`.
2. While that PR is open, same-repository pushes to the PR head branch publish a unique canary build such as `1.3.0-canary-pr-42.<run-id>.<attempt>.<sha>` to npm `canary`.
3. Merge feature and fix PRs into `main` as usual. Each merge publishes a unique prerelease such as `1.3.0-beta.<run-id>.<attempt>.<sha>` to npm `next`.
4. When the release is ready, create and push a matching git tag such as `v1.3.0`. The release workflow validates that the tag matches `package.json.version` before publishing `latest`.
5. After the stable release lands, open another PR that advances `package.json.version` to the next stable target, such as `1.3.1` or `1.4.0`.

Important release guard:

- If the stable version in `package.json` is already published to npm, the `canary` and `next` workflows fail before `npm publish`.
- In that case, bump `package.json.version` to the next intended stable release before pushing more PR or `main` changes.
- The floating `@canary` tag always points to the latest canary publish across PRs. If you need a specific PR build, install the full version string instead of relying on `@canary`.

For local debugging of the release helpers:

```bash
pnpm run release:assert-unpublished-base
pnpm run release:compute-prerelease -- --run-id 123 --run-attempt 1 --sha abcdef1
pnpm run release:validate-tag -- --tag v1.2.0
```

GitHub Actions publishing is designed for npm trusted publishing first. If trusted publishing is not configured yet, the publish steps also accept `NPM_TOKEN` as a temporary fallback through repository secrets.

## Quick Start

Warm up the managed runtime:

```bash
miniprogram-minium-cli prepare-runtime
```

Execute a plan file:

```bash
miniprogram-minium-cli exec \
  --plan ./plans/login-check.json \
  --wechat-devtool-path /path/to/wechat-devtools-cli
```

Execute an inline plan:

```bash
miniprogram-minium-cli exec --plan-json '{
  "version": 1,
  "kind": "miniapp-test-plan",
  "metadata": { "draft": false, "name": "inline-demo" },
  "execution": { "mode": "serial", "failFast": true },
  "environment": {
    "projectPath": "./miniapp",
    "artifactsDir": null,
    "wechatDevtoolPath": null,
    "testPort": 9420,
    "language": "en-US",
    "runtimeMode": "placeholder",
    "autoScreenshot": "off"
  },
  "steps": [
    {
      "id": "step-1",
      "type": "session.start",
      "input": { "projectPath": "./miniapp" }
    },
    {
      "id": "step-2",
      "type": "session.close",
      "input": {}
    }
  ]
}' --json
```

Execute a bridge-backed inline plan:

```bash
miniprogram-minium-cli exec --plan-json '{
  "version": 1,
  "kind": "miniapp-test-plan",
  "metadata": { "draft": false, "name": "bridge-inline-demo" },
  "execution": { "mode": "serial", "failFast": true },
  "environment": {
    "projectPath": "./miniapp",
    "artifactsDir": null,
    "wechatDevtoolPath": null,
    "testPort": 9420,
    "language": "en-US",
    "runtimeMode": "auto",
    "autoScreenshot": "off"
  },
  "steps": [
    {
      "id": "start",
      "type": "session.start",
      "input": { "projectPath": "./miniapp" }
    },
    {
      "id": "set-storage",
      "type": "storage.set",
      "input": { "key": "demo-key", "value": "demo-value" }
    },
    {
      "id": "get-storage",
      "type": "storage.get",
      "input": { "key": "demo-key" }
    },
    {
      "id": "close",
      "type": "session.close",
      "input": {}
    }
  ]
}' --json
```

## Command Reference

For the complete command, parameter, and plan format reference, see [API_REFERENCE.md](./docs/API_REFERENCE.md).

### `exec`

```bash
miniprogram-minium-cli exec (--plan <file> | --plan-json <json>) [--project-path <path>] [--wechat-devtool-path <path>] [--runtime-mode <mode>] [--auto-screenshot <mode>] [--json]
```

Purpose:

- validate and execute a structured plan

Primary options:

- `--plan <file>`: execute a plan file
- `--plan-json <json>`: execute an inline JSON plan
- `--project-path <path>`: override `environment.projectPath`
- `--wechat-devtool-path <path>`: override `environment.wechatDevtoolPath`
- `--artifacts-dir <path>`: override `environment.artifactsDir`
- `--test-port <port>`: override `environment.testPort`
- `--runtime-mode <mode>`: override `environment.runtimeMode`
- `--auto-screenshot <mode>`: set screenshot strategy
- `--json`: print structured execution output

Screenshot modes:

- `off`
- `on-success`
- `always`

### `prepare-runtime`

```bash
miniprogram-minium-cli prepare-runtime [--json]
```

Purpose:

- preload `uv`
- prepare the managed Python runtime
- reduce cold-start cost before the first real execution

### `install`

```bash
miniprogram-minium-cli install --skills [--path <path>] [--json]
```

Purpose:

- install all bundled repository skills into `./.agents/skills` under the current working directory, or a custom skills root for other coding agents

Primary options:

- `--skills`: install all bundled skills from this package
- `--path <path>`: install into a custom skills root instead of `./.agents/skills` under the current working directory
- `--json`: print structured installation output

Default installation root:

- `./.agents/skills` under the current working directory

Use `--path` when you want a shared global directory or an agent-specific local skills directory.

## Execution Output

By default, execution outputs are written to:

```text
.minium-cli/runs
```

Each run produces a dedicated run directory containing:

- `plan.json`
- `summary.json`
- `result.json`
- `comparison.json`
- screenshots when configured or when failure forensics are triggered

## Runtime Behavior

- the CLI lazily prepares its runtime when Python execution is first needed
- the managed runtime is private to this CLI
- the CLI does not modify the user's global Python, pip, PATH, or shell configuration
- the CLI requests Python `3.14` by default
- the minimum supported Python version for the managed runtime is `3.11`

## Operating Constraints

Projects that still use `touristappid` should treat real-runtime results as limited validation only.

They are not representative for flows that depend on native dialogs or authorization APIs such as:

- `wx.showModal`
- `wx.showActionSheet`
- `wx.authorize`
- `wx.getLocation`
- `wx.chooseLocation`
- `wx.getUserProfile`
- `wx.requestSubscribeMessage`

If those flows matter, use a developer-owned AppID instead of `touristappid`.

## Product Rationale

### Why Minium Instead of miniprogram-automator

Minium is the better fit for this product for three reasons:

1. The CLI needs a strong execution backend for reusable plans, assertions, artifacts, and complex interaction playback, not just a thin DevTools wrapper.
2. The product requires multi-step touch interaction, including stateful single-finger and multi-finger gesture execution.
3. The product is optimized for agent-generated plan execution rather than for a lightweight Node-only scripting surface.

## License

MIT. See [LICENSE](./LICENSE).

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=diaz-zeng/miniprogram-minium-cli&type=Date)](https://www.star-history.com/#diaz-zeng/miniprogram-minium-cli&Date)
