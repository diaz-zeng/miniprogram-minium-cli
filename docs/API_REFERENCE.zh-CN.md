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
- 网络相关 run 的 `network.json`
- 截图文件

对于网络相关 run：

- `network.json` 的固定 run 级结构为 `schemaVersion`、`events`、`requests`、`listeners`、`intercepts`、`meta`
- `result.json.stepResults[]` 可能通过 `details.networkEvidence` 暴露稳定引用，直接回跳到 `network.json`
- 可以通过随仓库 skill 一起分发的 helper 脚本过滤网络产物：

```bash
node skills/miniprogram-minium-cli/scripts/filter-network-artifact.mjs --result /path/to/result.json --pretty
```

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

当前安装流程明确只覆盖 bundled skills 的安装。

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

对用户只保留以下两种安装路径说明：

```bash
miniprogram-minium-cli install --skills
```

这个仓库里的 skills 也可以通过开放的 `skills` 工具按单个 skill 安装：

```bash
npx skills add diaz-zeng/miniprogram-minium-cli --skill miniprogram-minium-cli
npx skills add diaz-zeng/miniprogram-minium-cli --skill interactive-classname-tagging
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
- `network.listen.start`
- `network.listen.stop`
- `network.listen.clear`
- `network.wait`
- `assert.pagePath`
- `assert.elementText`
- `assert.elementVisible`
- `assert.networkRequest`
- `assert.networkResponse`
- `gesture.touchStart`
- `gesture.touchMove`
- `gesture.touchTap`
- `gesture.touchEnd`
- `network.intercept.add`
- `network.intercept.remove`
- `network.intercept.clear`
- `storage.set`
- `storage.get`
- `storage.info`
- `storage.remove`
- `storage.clear`
- `navigation.navigateTo`
- `navigation.redirectTo`
- `navigation.reLaunch`
- `navigation.switchTab`
- `navigation.back`
- `app.getLaunchOptions`
- `app.getSystemInfo`
- `app.getAccountInfo`
- `settings.get`
- `settings.authorize`
- `settings.open`
- `clipboard.set`
- `clipboard.get`
- `ui.showToast`
- `ui.hideToast`
- `ui.showLoading`
- `ui.hideLoading`
- `ui.showModal`
- `ui.showActionSheet`
- `location.get`
- `location.choose`
- `location.open`
- `media.chooseImage`
- `media.chooseMedia`
- `media.takePhoto`
- `media.getImageInfo`
- `media.saveImageToPhotosAlbum`
- `file.stage`
- `file.upload`
- `file.download`
- `device.scanCode`
- `device.makePhoneCall`
- `auth.login`
- `auth.checkSession`
- `subscription.requestMessage`
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

## Bridge 通用输入字段

bridge 类步骤可以额外携带以下公共可选字段：

- `requiresDeveloperAppId`: boolean
  - 用来标记该步骤需要开发者自有 AppID。
  - 当目标项目使用 `touristappid` 时，执行器会跳过该步骤，而不是把它计为产品失败。
- `skipReason`: string
  - 可选的人类可读跳过原因，会记录到 skipped step 输出中。
- `timeoutMs`: number
  - bridge 动作支持等待或异步完成时，可用来覆盖默认超时。

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

### 网络 matcher 结构

网络监听、等待、断言和拦截步骤共用一个 `matcher` 对象。

支持的 matcher 字段：

- `url`: string
- `urlPattern`: string
- `method`: string
- `resourceType`: `request` | `upload` | `download`
- `query`: object
- `headers`: object
- `body`: 任意 JSON 可序列化值
- `statusCode`: number
- `responseHeaders`: object
- `responseBody`: 任意 JSON 可序列化值

### `network.listen.start`

为当前活动会话启动一个有作用域的网络监听器。

可选 input：

- `listenerId`: string
- `matcher`: object
- `captureResponses`: boolean
- `maxEvents`: number

### `network.listen.stop`

停止一个已注册的网络监听器。

必填 input：

- `listenerId`: string

### `network.listen.clear`

清空一个监听器或当前会话内全部监听器缓冲的网络事件。

已经落入 `network.json` 的历史网络证据不会被删除。`clear` 只会重置后续 listener 作用域下 `wait` / `assert` 使用的活动视图，并向网络产物追加生命周期事件。

可选 input：

- `listenerId`: string

### `network.wait`

等待一个匹配的请求或响应出现。

必填 input：

- `listenerId`: string，或者
- `matcher`: object

可选 input：

- `event`: `request` | `response`
- `timeoutMs`: number

### `assert.networkRequest`

对请求侧的网络证据做断言。

可选 input：

- `listenerId`: string
- `matcher`: object
- `count`: number
- `minCount`: number
- `maxCount`: number
- `withinMs`: number
- `orderedAfter`: string
- `orderedBefore`: string

校验说明：

- 不提供 matcher 字段时，语义是“断言发生过任意请求”
- `count` 不能和 `minCount` 或 `maxCount` 同时使用

### `assert.networkResponse`

对响应侧的网络证据做断言。

可选 input：

- `listenerId`: string
- `matcher`: object
- `count`: number
- `minCount`: number
- `maxCount`: number
- `withinMs`: number
- `orderedAfter`: string
- `orderedBefore`: string

校验说明：

- 响应断言复用同一个 matcher 结构
- `count` 不能和 `minCount` 或 `maxCount` 同时使用

### `network.intercept.add`

为匹配请求注册一个结构化拦截规则。

必填 input：

- `matcher`: object
- `behavior`: object

可选 input：

- `ruleId`: string

支持的 behavior 形式：

- `{ "action": "continue" }`
- `{ "action": "fail", "errorMessage": "forced failure", "errorCode": "NETWORK_MOCK" }`
- `{ "action": "delay", "delayMs": 500 }`
- `{ "action": "mock", "response": { "statusCode": 200, "headers": { "content-type": "application/json" }, "body": { "ok": true } } }`

### `network.intercept.remove`

移除一个已注册的拦截规则。

必填 input：

- `ruleId`: string

### `network.intercept.clear`

清空当前活动会话中的全部拦截规则。

必填 input：

- 无

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

### Bridge 存储步骤

支持的步骤：

- `storage.set`
- `storage.get`
- `storage.info`
- `storage.remove`
- `storage.clear`

关键输入规则：

- `storage.set` 需要 `key` 和 `value`
- `storage.get` 与 `storage.remove` 需要 `key`
- `storage.info` 与 `storage.clear` 不要求额外字段

结果形状：

- 在 `result` 下返回可序列化的存储值或存储摘要

### Bridge 路由步骤

支持的步骤：

- `navigation.navigateTo`
- `navigation.redirectTo`
- `navigation.reLaunch`
- `navigation.switchTab`
- `navigation.back`

关键输入规则：

- `navigateTo`、`redirectTo`、`reLaunch`、`switchTab` 需要 `url`
- `navigation.back` 接受可选的 `delta`

结果形状：

- 返回更新后的 `current_page_path`
- bridge 结果元数据里可能包含解析后的 `pagePath` 和路由参数

### Bridge 应用上下文步骤

支持的步骤：

- `app.getLaunchOptions`
- `app.getSystemInfo`
- `app.getAccountInfo`

关键输入规则：

- 不要求额外字段

结果形状：

- 在 `result` 下返回可序列化的启动参数、系统信息或账号信息

### Bridge 设置与剪贴板步骤

支持的步骤：

- `settings.get`
- `settings.authorize`
- `settings.open`
- `clipboard.set`
- `clipboard.get`

关键输入规则：

- `settings.authorize` 需要 `scope`
- `clipboard.set` 需要 `text`

结果形状：

- 在 `result` 下返回结构化的设置、授权或剪贴板结果

### Bridge 反馈 UI 步骤

支持的步骤：

- `ui.showToast`
- `ui.hideToast`
- `ui.showLoading`
- `ui.hideLoading`
- `ui.showModal`
- `ui.showActionSheet`

关键输入规则：

- `ui.showToast` 需要 `title`
- `ui.showLoading` 需要 `title`
- `ui.showModal` 需要 `title` 和 `content`
- `ui.showActionSheet` 需要非空 `itemList`

结果形状：

- 返回结构化的反馈 UI 摘要，例如标题、选择结果或当前 UI 状态

### Bridge 位置、媒体、文件、设备、鉴权与订阅步骤

支持的步骤：

- `location.get`
- `location.choose`
- `location.open`
- `media.chooseImage`
- `media.chooseMedia`
- `media.takePhoto`
- `media.getImageInfo`
- `media.saveImageToPhotosAlbum`
- `file.stage`
- `file.upload`
- `file.download`
- `device.scanCode`
- `device.makePhoneCall`
- `auth.login`
- `auth.checkSession`
- `subscription.requestMessage`

关键输入规则：

- `location.open` 需要 `latitude` 和 `longitude`
- `media.getImageInfo` 需要 `src`
- `media.saveImageToPhotosAlbum` 需要 `filePath`
- `file.stage` 需要类似 `minium://user-data/upload.txt` 的 `filePath`，并提供 `content` 或 `contentBase64`
- `file.upload` 需要 `url`、`filePath` 和 `name`
- `file.download` 需要 `url`
- `file.upload` 默认使用 `POST`，`file.download` 默认使用 `GET`，以便 real runtime 下的网络 mock 稳定匹配
- `device.makePhoneCall` 需要 `phoneNumber`
- `subscription.requestMessage` 需要非空 `tmplIds`

结果形状：

- 在 `result` 下返回可序列化 bridge 结果
- 异步能力要么收敛为最终结构化结果，要么返回 `ACTION_ERROR`
- real runtime 可上传由 `file.stage` 写入小程序用户数据目录的文件

已 stage 文件上传示例：

```json
[
  {
    "id": "stage-upload-file",
    "type": "file.stage",
    "input": {
      "filePath": "minium://user-data/bridge-demo.txt",
      "content": "upload fixture"
    }
  },
  {
    "id": "upload-staged-file",
    "type": "file.upload",
    "input": {
      "url": "https://service.invalid/upload",
      "filePath": "minium://user-data/bridge-demo.txt",
      "name": "artifact"
    }
  }
]
```

### `touristappid` 下的 Bridge 跳过语义

当某个 bridge 步骤显式设置 `requiresDeveloperAppId: true`，或者属于内置受限步骤集合时，执行器会读取目标项目的 `project.config.json`。

如果项目 AppID 是 `touristappid`：

- 该步骤结果会使用 `status: "skipped"`
- 输出中会包含 `skip_reason`
- 执行摘要会记录该 skipped step，而不是把它算作失败

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
- 网络 matcher 使用了不受支持的字段，或输入形状非法
- `network.wait` 同时缺少 `listenerId` 和 `matcher`
- `assert.networkRequest` 或 `assert.networkResponse` 同时使用了 `count` 与 `minCount` / `maxCount`
- `network.intercept.add` 缺少 `matcher`，或 `behavior` 结构不合法
- 某个 step 缺少 `locator`、`pointerId`、`expectedPath`、`expectedText`、`key`、`url` 或 `tmplIds` 等必填字段
- bridge 步骤使用了不支持的参数形状
- plan 在 `exec` 时仍被标记为 draft
