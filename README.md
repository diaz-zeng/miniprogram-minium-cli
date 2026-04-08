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
- explicit screenshots and automatic screenshots
- single-finger and multi-finger gestures
- structured outputs including `summary.json`, `result.json`, `comparison.json`, and screenshot files

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
npm install -g miniprogram-minium-cli
```

Host requirement:

- Node.js `>= 18`

The CLI prepares and reuses its own private `uv`-managed Python runtime on demand. It does not require the user to install or manage a global Python environment for this tool.

Install the bundled skills into the default local skills directory:

```bash
miniprogram-minium-cli install --skills
```

Install the bundled skills through `npx` when the package is available locally:

```bash
npx --no-install miniprogram-minium-cli install --skills
```

Install directly through `npx` without a prior global install:

```bash
npx miniprogram-minium-cli install --skills
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
