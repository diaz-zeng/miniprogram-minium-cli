# API Reference

[中文](./API_REFERENCE.zh-CN.md)

This document describes the command-line API and the structured plan API of `miniprogram-minium-cli`.

## Command-Line API

## Commands

- `exec`
- `prepare-runtime`
- `install`
- `help`

## `exec`

Execute a structured mini program automation plan.

### Syntax

```bash
miniprogram-minium-cli exec (--plan <file> | --plan-json <json>) [options]
```

### Required Input

You must provide exactly one of the following:

- `--plan <file>`
- `--plan-json <json>`

They are mutually exclusive.

### Plan Source Options

#### `--plan <file>`

Execute a plan file from disk.

- Type: string
- Required: no, if `--plan-json` is provided
- Relative path behavior: the CLI resolves the plan file path from the current working directory
- Plan-internal relative paths: resolved from the plan file directory

#### `--plan-json <json>`

Execute an inline JSON plan string.

- Type: string
- Required: no, if `--plan` is provided
- Relative path behavior inside the JSON payload: resolved from the current working directory

### Execution Override Options

#### `--project-path <path>`

Override `environment.projectPath`.

- Type: string
- Effect: updates both the root environment and `session.start.input.projectPath` when present

#### `--wechat-devtool-path <path>`

Override `environment.wechatDevtoolPath`.

- Type: string

#### `--artifacts-dir <path>`

Override `environment.artifactsDir`.

- Type: string
- Default when omitted: `.minium-cli/runs`

#### `--test-port <port>`

Override `environment.testPort`.

- Type: string input, converted to number

#### `--runtime-mode <mode>`

Override `environment.runtimeMode`.

- Type: string
- Common values:
  - `auto`
  - `real`
  - `placeholder`

#### `--auto-screenshot <mode>`

Override `environment.autoScreenshot`.

- Type: string
- Supported values:
  - `off`
  - `on-success`
  - `always`

Behavior:

- `off`: only explicit `artifact.screenshot` steps and failure forensics produce screenshots
- `on-success`: automatically capture screenshots after successful steps while a session is active
- `always`: keep successful-step screenshots and attach additional screenshots when a step fails and the session is still available

#### `--json`

Print the structured execution result to stdout.

- Type: flag
- Default: disabled

### Output

`exec` produces:

- terminal summary output by default
- JSON output when `--json` is used
- run artifacts under `.minium-cli/runs` unless overridden

Typical artifact files:

- `plan.json`
- `summary.json`
- `result.json`
- `comparison.json`
- screenshots

### Exit Codes

- `0`: execution passed
- `1`: action failure or assertion failure
- `2`: usage error or environment/session-related failure
- `3`: plan validation failure
- `4`: runtime launch failure or unknown execution failure

## `prepare-runtime`

Prepare the managed runtime without executing a plan.

### Syntax

```bash
miniprogram-minium-cli prepare-runtime [--json]
```

### Options

#### `--json`

Print structured runtime preparation details.

- Type: flag
- Default: disabled

### Output

The command prepares:

- `uv`
- the managed Python runtime
- the Python project environment

When `--json` is used, the output includes fields such as:

- `uvBin`
- `pythonRequest`
- `details`
- `cacheBaseDir`

## `install`

Install the packaged bundled skills into `./.agents/skills` under the current working directory, or a custom skills root for other coding agents.

### Syntax

```bash
miniprogram-minium-cli install --skills [--path <path>] [--json]
```

### Required Input

- `--skills`

The current install workflow is explicitly scoped to bundled skill installation.

### Options

#### `--path <path>`

Install into a custom skills root.

- Type: string
- Default when omitted:
  - `./.agents/skills` under the current working directory

Use this option when you want a shared global directory or when Claude Code, GitHub Copilot, or another coding agent expects a different local skills root.

#### `--json`

Print structured installation details.

- Type: flag
- Default: disabled

### Output

The command installs every bundled skill directory from the package into the target skills root.

When `--json` is used, the output includes fields such as:

- `targetRoot`
- `packageRoot`
- `installed`

### Invocation patterns

The command can be invoked in all of the following ways:

```bash
miniprogram-minium-cli install --skills
npx --no-install miniprogram-minium-cli install --skills
npx miniprogram-minium-cli install --skills
```

The repository skill can also be installed through the open `skills` tool:

```bash
npx skills add diaz-zeng/miniprogram-minium-cli --skill miniprogram-minium-cli
```

## `help`

Show the built-in help output.

### Syntax

```bash
miniprogram-minium-cli help
miniprogram-minium-cli --help
miniprogram-minium-cli -h
```

## Path Resolution Rules

There are two different path resolution rules in the CLI:

1. Command-line file paths such as `--plan` are resolved from the current working directory.
2. Relative paths inside a loaded plan are resolved from:
   - the plan file directory when `--plan` is used
   - the current working directory when `--plan-json` is used

## Structured Plan API

## Overview

A plan is a JSON object with the following top-level fields:

- `version`
- `kind`
- `createdAt`
- `metadata`
- `environment`
- `execution`
- `steps`

The CLI currently accepts:

- `version = 1`
- `kind = "miniapp-test-plan"`
- `execution.mode = "serial"`

Draft plans are valid as data, but `exec` only accepts runnable plans where `metadata.draft = false`.

## Top-Level Schema

```json
{
  "version": 1,
  "kind": "miniapp-test-plan",
  "createdAt": "2026-04-05T10:00:00.000Z",
  "metadata": {
    "name": "login-check",
    "draft": false
  },
  "environment": {
    "projectPath": "./miniapp",
    "artifactsDir": null,
    "wechatDevtoolPath": null,
    "testPort": 9420,
    "language": "en-US",
    "runtimeMode": "auto",
    "autoScreenshot": "off",
    "sessionTimeoutSeconds": 120
  },
  "execution": {
    "mode": "serial",
    "failFast": true
  },
  "steps": []
}
```

## Top-Level Fields

### `version`

- Type: number
- Required: yes
- Allowed value: `1`

### `kind`

- Type: string
- Required: yes
- Allowed value: `miniapp-test-plan`

### `createdAt`

- Type: string
- Required: no
- Recommended format: ISO 8601 UTC timestamp

### `metadata`

- Type: object
- Required: yes

Fields:

- `name`
  - Type: string
  - Required: yes
  - Purpose: human-readable plan name
- `draft`
  - Type: boolean
  - Required: yes
  - Purpose: marks whether the plan is executable
- `source`
  - Type: object
  - Required: no
  - Purpose: optional upstream provenance
- `planner`
  - Type: object
  - Required: no
  - Purpose: optional agent or planner metadata

Optional `metadata.source` fields:

- `type`: string
- `prompt`: string

Optional `metadata.planner` fields:

- `mode`: string
- `notes`: string[]

### `environment`

- Type: object
- Required: yes

Fields:

- `projectPath`
  - Type: string or `null`
  - Required: yes
  - Purpose: default mini program project path
- `artifactsDir`
  - Type: string or `null`
  - Required: yes
  - Purpose: base output directory for run artifacts
- `wechatDevtoolPath`
  - Type: string or `null`
  - Required: yes
  - Purpose: path to the WeChat DevTools CLI when real runtime is used
- `testPort`
  - Type: number
  - Required: yes
  - Purpose: automation port used for DevTools and Minium
- `language`
  - Type: string
  - Required: yes
  - Purpose: output language, such as `en-US` or `zh-CN`
- `runtimeMode`
  - Type: string
  - Required: no
  - Common values:
    - `auto`
    - `real`
    - `placeholder`
- `autoScreenshot`
  - Type: string
  - Required: no
  - Allowed values:
    - `off`
    - `on-success`
    - `always`
- `sessionTimeoutSeconds`
  - Type: number
  - Required: no
  - Purpose: session timeout override

### `execution`

- Type: object
- Required: yes

Fields:

- `mode`
  - Type: string
  - Required: yes
  - Allowed value: `serial`
- `failFast`
  - Type: boolean
  - Required: yes
  - Purpose: stop after the first failed step when `true`

### `steps`

- Type: array
- Required: yes
- Runtime requirement: must not be empty for executable plans

Each item must contain:

- `id`: string
- `type`: supported step type
- `input`: object

## Step Types

The CLI currently supports these step types:

- `session.start`
- `page.read`
- `element.query`
- `element.click`
- `element.input`
- `wait.for`
- `assert.pagePath`
- `assert.elementText`
- `assert.elementVisible`
- `gesture.touchStart`
- `gesture.touchMove`
- `gesture.touchTap`
- `gesture.touchEnd`
- `artifact.screenshot`
- `session.close`

## Locator Shape

Steps that target elements use a locator object. The CLI accepts locator objects as structured JSON and routes them to the runtime.

Common locator forms include:

```json
{ "id": "login-button" }
```

```json
{ "text": "Log in" }
```

```json
{ "textContains": "Review scale" }
```

```json
{ "selector": ".primary-action" }
```

The exact matching behavior depends on the active runtime backend, but the recommended stable forms are:

- `id`
- `text`
- `textContains`

## Step Reference

### `session.start`

Starts a mini program automation session.

Required input:

- `projectPath`: string, unless `environment.projectPath` is already set

Optional input:

- `runtimeMode`: string
- `sessionTimeoutSeconds`: number

### `page.read`

Reads the current page context.

Required input:

- none

### `element.query`

Queries an element and returns structured element information.

Required input:

- `locator`: object

### `element.click`

Clicks an element.

Required input:

- `locator`: object

### `element.input`

Inputs text into an element.

Required input:

- `locator`: object
- `text`: string

### `wait.for`

Waits until a condition becomes true.

Required input:

- `condition`: object

Common condition forms:

- `{ "pagePathEquals": "pages/home/index" }`
- `{ "elementVisible": { "id": "submit-button" } }`
- `{ "elementTextContains": { "locator": { "id": "status" }, "value": "Saved" } }`

Optional input:

- `timeoutMs`: number
- `pollIntervalMs`: number

### `assert.pagePath`

Asserts the current page path.

Required input:

- `expectedPath`: string

### `assert.elementText`

Asserts exact element text.

Required input:

- `locator`: object
- `expectedText`: string

### `assert.elementVisible`

Asserts that an element is visible.

Required input:

- `locator`: object

### Gesture Steps

Supported gesture steps:

- `gesture.touchStart`
- `gesture.touchMove`
- `gesture.touchTap`
- `gesture.touchEnd`

Common input fields:

- `pointerId`: number, required for all gesture steps
- `locator`: object, optional but recommended when dispatching against a canvas or element
- `x`: number, optional coordinate
- `y`: number, optional coordinate

Validation rule:

- `gesture.touchEnd` only requires `pointerId`
- other gesture steps require either a `locator`, or both `x` and `y`
- `locator` and `x/y` may appear together, which means "dispatch to this target using these coordinates"

### `artifact.screenshot`

Captures an explicit screenshot at a specific point in the plan.

Required input:

- none

Optional input:

- `prefix`: string

### `session.close`

Closes the active session.

Required input:

- none

## Minimal Runnable Plan

```json
{
  "version": 1,
  "kind": "miniapp-test-plan",
  "metadata": {
    "name": "minimal-plan",
    "draft": false
  },
  "environment": {
    "projectPath": "./miniapp",
    "artifactsDir": null,
    "wechatDevtoolPath": null,
    "testPort": 9420,
    "language": "en-US",
    "runtimeMode": "placeholder",
    "autoScreenshot": "off"
  },
  "execution": {
    "mode": "serial",
    "failFast": true
  },
  "steps": [
    {
      "id": "step-1",
      "type": "session.start",
      "input": {
        "projectPath": "./miniapp"
      }
    },
    {
      "id": "step-2",
      "type": "session.close",
      "input": {}
    }
  ]
}
```

## Validation Notes

The CLI rejects a plan when:

- `version` is not `1`
- `kind` is not `miniapp-test-plan`
- `execution.mode` is not `serial`
- `execution.failFast` is not a boolean
- `environment.autoScreenshot` is not one of `off`, `on-success`, or `always`
- `steps` is missing or empty for a runnable plan
- a step type is not supported
- a step misses required fields such as `locator`, `pointerId`, `expectedPath`, or `expectedText`
- the plan is marked as draft during `exec`
