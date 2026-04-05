# API 参考

[English](./API_REFERENCE.md)

本文档同时描述 `miniprogram-minium-cli` 的命令行 API 和结构化 plan API。

## 命令行 API

## 命令列表

- `exec`
- `prepare-runtime`
- `install`
- `help`

## `exec`

执行结构化小程序自动化计划。

### 语法

```bash
miniprogram-minium-cli exec (--plan <file> | --plan-json <json>) [options]
```

### 必需输入

必须且只能提供以下两者之一：

- `--plan <file>`
- `--plan-json <json>`

两者不能同时使用。

### 计划来源参数

#### `--plan <file>`

执行磁盘中的计划文件。

- 类型：字符串
- 是否必需：当未提供 `--plan-json` 时必需
- 相对路径规则：CLI 按当前执行目录解析这个 plan 文件路径
- plan 内部相对路径规则：按 plan 文件所在目录解析

#### `--plan-json <json>`

执行内联 JSON 计划字符串。

- 类型：字符串
- 是否必需：当未提供 `--plan` 时必需
- JSON 内部相对路径规则：按当前执行目录解析

### 执行覆盖参数

#### `--project-path <path>`

覆盖 `environment.projectPath`。

- 类型：字符串
- 影响：当 plan 中存在 `session.start.input.projectPath` 时，也会同步覆盖

#### `--wechat-devtool-path <path>`

覆盖 `environment.wechatDevtoolPath`。

- 类型：字符串

#### `--artifacts-dir <path>`

覆盖 `environment.artifactsDir`。

- 类型：字符串
- 默认值：`.minium-cli/runs`

#### `--test-port <port>`

覆盖 `environment.testPort`。

- 类型：字符串输入，内部会转换为数字

#### `--runtime-mode <mode>`

覆盖 `environment.runtimeMode`。

- 类型：字符串
- 常见取值：
  - `auto`
  - `real`
  - `placeholder`

#### `--auto-screenshot <mode>`

覆盖 `environment.autoScreenshot`。

- 类型：字符串
- 支持取值：
  - `off`
  - `on-success`
  - `always`

行为说明：

- `off`：只有显式 `artifact.screenshot` 步骤和失败取证会产出截图
- `on-success`：会话存活期间，在成功步骤后自动截图
- `always`：保留成功步骤截图，并在步骤失败但会话仍可用时补充截图

#### `--json`

将结构化执行结果输出到 stdout。

- 类型：开关参数
- 默认：关闭

### 输出

`exec` 会产生：

- 默认终端摘要输出
- 使用 `--json` 时的结构化 JSON 输出
- 默认位于 `.minium-cli/runs` 的运行产物，除非显式覆盖

常见产物文件：

- `plan.json`
- `summary.json`
- `result.json`
- `comparison.json`
- 截图文件

### 退出码

- `0`：执行通过
- `1`：动作失败或断言失败
- `2`：用法错误，或环境 / 会话相关失败
- `3`：plan 校验失败
- `4`：运行时启动失败，或其他未知执行失败

## `prepare-runtime`

在不执行 plan 的前提下准备托管运行时。

### 语法

```bash
miniprogram-minium-cli prepare-runtime [--json]
```

### 参数

#### `--json`

输出结构化的运行时准备结果。

- 类型：开关参数
- 默认：关闭

### 输出

该命令会准备：

- `uv`
- 托管 Python 运行时
- Python 项目环境

使用 `--json` 时，输出通常包含：

- `uvBin`
- `pythonRequest`
- `details`
- `cacheBaseDir`

## `install`

将随包附带的 bundled skills 安装到当前执行目录下的 `./.agents/skills`，或安装到其他 coding agent 的自定义 skills 根目录。

### 语法

```bash
miniprogram-minium-cli install --skills [--path <path>] [--json]
```

### 必需输入

- `--skills`

当前安装流程明确只覆盖 bundled skill 的安装。

### 参数

#### `--path <path>`

安装到自定义 skills 根目录。

- 类型：字符串
- 默认值：
  - 当前执行目录下的 `./.agents/skills`

如果你想安装到共享全局目录，或 Claude Code、GitHub Copilot 等其他 coding agent 需要不同的本地 skills 根目录，请使用这个参数覆盖默认值。

#### `--json`

输出结构化安装结果。

- 类型：开关参数
- 默认：关闭

### 输出

该命令会把当前包中附带的每个 bundled skill 目录安装到目标 skills 根目录中。

使用 `--json` 时，输出通常包含：

- `targetRoot`
- `packageRoot`
- `installed`

### 调用方式

这个命令可以通过以下几种方式调用：

```bash
miniprogram-minium-cli install --skills
npx --no-install miniprogram-minium-cli install --skills
npx miniprogram-minium-cli install --skills
```

这个仓库里的 skill 也可以通过开放的 `skills` 工具安装：

```bash
npx skills add diaz-zeng/miniprogram-minium-cli --skill miniprogram-minium-cli
```

## `help`

显示内置帮助信息。

### 语法

```bash
miniprogram-minium-cli help
miniprogram-minium-cli --help
miniprogram-minium-cli -h
```

## 路径解析规则

CLI 中有两套不同的路径解析规则：

1. 命令行文件路径，例如 `--plan`，按当前执行目录解析。
2. 已加载 plan 内部的相对路径，按以下规则解析：
   - 使用 `--plan` 时，按 plan 文件所在目录解析
   - 使用 `--plan-json` 时，按当前执行目录解析

## 结构化 Plan API

## 总览

一个 plan 是一个 JSON 对象，包含以下顶层字段：

- `version`
- `kind`
- `createdAt`
- `metadata`
- `environment`
- `execution`
- `steps`

当前 CLI 接受的固定约束是：

- `version = 1`
- `kind = "miniapp-test-plan"`
- `execution.mode = "serial"`

draft plan 作为数据是合法的，但 `exec` 只接受 `metadata.draft = false` 的可执行计划。

## 顶层结构

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

## 顶层字段说明

### `version`

- 类型：number
- 必填：是
- 允许值：`1`

### `kind`

- 类型：string
- 必填：是
- 允许值：`miniapp-test-plan`

### `createdAt`

- 类型：string
- 必填：否
- 推荐格式：ISO 8601 UTC 时间戳

### `metadata`

- 类型：object
- 必填：是

字段：

- `name`
  - 类型：string
  - 必填：是
  - 用途：plan 的可读名称
- `draft`
  - 类型：boolean
  - 必填：是
  - 用途：标记计划是否可执行
- `source`
  - 类型：object
  - 必填：否
  - 用途：可选的来源信息
- `planner`
  - 类型：object
  - 必填：否
  - 用途：可选的 agent 或 planner 元数据

可选 `metadata.source` 字段：

- `type`: string
- `prompt`: string

可选 `metadata.planner` 字段：

- `mode`: string
- `notes`: string[]

### `environment`

- 类型：object
- 必填：是

字段：

- `projectPath`
  - 类型：string 或 `null`
  - 必填：是
  - 用途：默认的小程序项目路径
- `artifactsDir`
  - 类型：string 或 `null`
  - 必填：是
  - 用途：运行产物的基础输出目录
- `wechatDevtoolPath`
  - 类型：string 或 `null`
  - 必填：是
  - 用途：真实运行时使用的微信开发者工具 CLI 路径
- `testPort`
  - 类型：number
  - 必填：是
  - 用途：开发者工具和 Minium 使用的自动化端口
- `language`
  - 类型：string
  - 必填：是
  - 用途：输出语言，例如 `en-US` 或 `zh-CN`
- `runtimeMode`
  - 类型：string
  - 必填：否
  - 常见值：
    - `auto`
    - `real`
    - `placeholder`
- `autoScreenshot`
  - 类型：string
  - 必填：否
  - 允许值：
    - `off`
    - `on-success`
    - `always`
- `sessionTimeoutSeconds`
  - 类型：number
  - 必填：否
  - 用途：覆盖默认会话超时时间

### `execution`

- 类型：object
- 必填：是

字段：

- `mode`
  - 类型：string
  - 必填：是
  - 允许值：`serial`
- `failFast`
  - 类型：boolean
  - 必填：是
  - 用途：为 `true` 时在第一步失败后停止执行

### `steps`

- 类型：array
- 必填：是
- 运行时要求：可执行计划不能为空

每个元素都必须包含：

- `id`: string
- `type`: 支持的步骤类型
- `input`: object

## 支持的步骤类型

当前 CLI 支持以下 step type：

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

## Locator 结构

面向元素的步骤会使用 locator 对象。CLI 接收结构化 JSON locator，并将其交给运行时处理。

常见 locator 写法包括：

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

具体匹配行为取决于运行时后端，但更稳定、推荐的形式是：

- `id`
- `text`
- `textContains`

## Step 说明

### `session.start`

启动一个小程序自动化会话。

必填 input：

- `projectPath`: string；如果根层 `environment.projectPath` 已设置，则这里可省略

可选 input：

- `runtimeMode`: string
- `sessionTimeoutSeconds`: number

### `page.read`

读取当前页面上下文。

必填 input：

- 无

### `element.query`

查询元素并返回结构化元素信息。

必填 input：

- `locator`: object

### `element.click`

点击元素。

必填 input：

- `locator`: object

### `element.input`

向元素输入文本。

必填 input：

- `locator`: object
- `text`: string

### `wait.for`

等待某个条件成立。

必填 input：

- `condition`: object

常见条件形式：

- `{ "pagePathEquals": "pages/home/index" }`
- `{ "elementVisible": { "id": "submit-button" } }`
- `{ "elementTextContains": { "locator": { "id": "status" }, "value": "Saved" } }`

可选 input：

- `timeoutMs`: number
- `pollIntervalMs`: number

### `assert.pagePath`

断言当前页面路径。

必填 input：

- `expectedPath`: string

### `assert.elementText`

断言元素文本完全匹配。

必填 input：

- `locator`: object
- `expectedText`: string

### `assert.elementVisible`

断言元素可见。

必填 input：

- `locator`: object

### 手势步骤

支持的手势步骤：

- `gesture.touchStart`
- `gesture.touchMove`
- `gesture.touchTap`
- `gesture.touchEnd`

常见 input 字段：

- `pointerId`: number，所有手势步骤都必填
- `locator`: object，可选，但在画布或元素上派发事件时推荐提供
- `x`: number，可选坐标
- `y`: number，可选坐标

校验规则：

- `gesture.touchEnd` 只要求 `pointerId`
- 其他手势步骤必须提供 `locator`，或者同时提供 `x` 和 `y`
- `locator` 和 `x/y` 可以同时存在，语义是“将事件派发到这个目标，并使用这组坐标作为触点位置”

### `artifact.screenshot`

在 plan 中某个明确时机执行显式截图。

必填 input：

- 无

可选 input：

- `prefix`: string

### `session.close`

关闭当前活动会话。

必填 input：

- 无

## 最小可执行计划

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

## 校验说明

CLI 会在以下情况下拒绝执行：

- `version` 不是 `1`
- `kind` 不是 `miniapp-test-plan`
- `execution.mode` 不是 `serial`
- `execution.failFast` 不是布尔值
- `environment.autoScreenshot` 不是 `off`、`on-success` 或 `always`
- 可执行 plan 的 `steps` 缺失或为空
- 存在不支持的 step type
- 某个 step 缺少 `locator`、`pointerId`、`expectedPath` 或 `expectedText` 等必填字段
- plan 在 `exec` 时仍被标记为 draft
