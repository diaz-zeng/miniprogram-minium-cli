# miniprogram-minium-cli

[![npm version](https://img.shields.io/npm/v/miniprogram-minium-cli)](https://www.npmjs.com/package/miniprogram-minium-cli)
[![npm downloads](https://img.shields.io/npm/dm/miniprogram-minium-cli)](https://www.npmjs.com/package/miniprogram-minium-cli)
[![GitHub last commit](https://img.shields.io/github/last-commit/diaz-zeng/miniprogram-minium-cli)](https://github.com/diaz-zeng/miniprogram-minium-cli)
[![GitHub license](https://img.shields.io/github/license/diaz-zeng/miniprogram-minium-cli)](https://github.com/diaz-zeng/miniprogram-minium-cli/blob/main/LICENSE)

[English](../README.md)

`miniprogram-minium-cli` 是一个用于执行结构化小程序自动化计划的命令行产品。

它面向 agent 驱动的工作流：

- agent 生成 plan
- CLI 负责校验并执行 plan
- CLI 将结构化结果和截图写入 `.minium-cli/runs`

当前包使用 [Minium](https://pypi.org/project/minium/) 作为底层自动化引擎。

## 产品定位

`miniprogram-minium-cli` 是执行层，不是规划层。

它的职责是：

- 接收结构化 plan
- 准备托管运行时
- 连接微信开发者工具
- 执行受支持的自动化步骤
- 产出机器可读和人可读的运行结果

它不是 MCP Server，也不依赖内置自然语言 planner。

## 功能范围

当前产品支持：

- 通过 `--plan` 执行文件计划
- 通过 `--plan-json` 执行内联 JSON 计划
- 精确定位与模糊文本匹配
- 点击、输入、等待与断言
- 面向 `wx.request`、`wx.uploadFile`、`wx.downloadFile` 的网络监听与拦截能力，支持监听、等待、断言、失败注入、延迟和 mock 返回
- 通过结构化 bridge 步骤调用存储、路由、应用上下文、设置、剪贴板、反馈 UI、定位、媒体、文件、设备、鉴权与订阅等小程序能力
- 显式截图与自动截图
- 单指和多指手势
- 产出 `summary.json`、`result.json`、`comparison.json`、`network.json` 以及截图文件

## Step 分类

自动化 plan 由四类步骤组合而成：

- 会话与产物步骤，例如 `session.start`、`artifact.screenshot`、`session.close`
- UI 步骤，例如 `element.click`、`element.input`、`page.read`、`wait.for`、`gesture.*`
- 网络步骤，例如 `network.listen.start`、`network.wait`、`network.intercept.add`、`assert.networkRequest`、`assert.networkResponse`
- bridge 步骤，例如 `storage.set`、`navigation.navigateTo`、`clipboard.get`、`settings.authorize`、`auth.login`、`location.get`
- 断言步骤，例如 `assert.pagePath`、`assert.elementText`、`assert.elementVisible`

bridge 步骤通过结构化 step type 暴露一组受控的小程序原生能力，而不是直接透传原始 `wx` 方法调用。

完整的 step 列表和每个 step 的输入字段请查看 [API_REFERENCE.zh-CN.md](./API_REFERENCE.zh-CN.md)。

## 网络能力

网络步骤允许 plan 在不写任意脚本的前提下，观察和控制请求行为。

- 使用 `network.listen.start` 和 `network.listen.stop` 管理会话级网络证据收集
- 使用 `network.wait`、`assert.networkRequest`、`assert.networkResponse` 断言某个动作后是否发出了目标请求或收到了目标响应
- 使用 `network.intercept.add`、`network.intercept.remove`、`network.intercept.clear` 对匹配请求执行透传、失败、延迟或 mock 返回
- 当你需要完整证据时，查看 `network.json`，其中包含归一化网络事件、监听器命中信息和拦截规则命中统计

常见 matcher 字段包括 `url`、`urlPattern`、`method`、`resourceType`、`query`、`headers`、`body`、`statusCode`、`responseHeaders` 和 `responseBody`。

当前运行时说明：

- placeholder 模式为仓库自带示例和回归计划提供确定性的内存态网络事件
- real runtime 通过 Minium hook 接入 `wx.request`、`wx.uploadFile`、`wx.downloadFile`
- 响应体断言仍然属于 best-effort，最终能断言到什么字段取决于底层运行时 callback 实际暴露的数据

## 计划输入

CLI 支持两种 plan 输入方式。

完整的 plan 结构、命令参数和 step 级字段说明请查看 [API_REFERENCE.zh-CN.md](./API_REFERENCE.zh-CN.md)。

### 文件计划

当 plan 已存在于磁盘上时，使用 `--plan <file>`。

plan 内的相对路径按 plan 文件所在目录解析。

### 内联 JSON 计划

当 agent 希望生成后立即执行时，使用 `--plan-json <json>`。

内联 JSON 中的相对路径按当前执行目录解析。

## 安装

```bash
pnpm add -g miniprogram-minium-cli
```

宿主机要求：

- Node.js `>= 18`

CLI 会按需准备并复用自己的私有 `uv` 托管 Python 运行时。用户不需要为这个工具单独维护全局 Python 环境。

将随包 skills 安装到默认本地 skills 目录：

```bash
miniprogram-minium-cli install --skills
```

也可以通过开放的 `skills` 工具直接从这个仓库安装：

```bash
npx skills add diaz-zeng/miniprogram-minium-cli --skill miniprogram-minium-cli
```

如果想先查看这个仓库暴露了哪些 skills，可以先执行：

```bash
npx skills add diaz-zeng/miniprogram-minium-cli --list
```

安装到自定义 skills 根目录：

```bash
miniprogram-minium-cli install --skills --path /path/to/skills
```

默认情况下，该命令会安装到当前执行目录下的 `./.agents/skills`。如果你要给 Claude Code、GitHub Copilot 或其他 coding agent 使用，请通过 `--path` 指向对应 agent 的本地或全局 skills 目录。

如果对应 agent 已经支持开放的 `skills` 生态，也可以直接执行 `npx skills add diaz-zeng/miniprogram-minium-cli --skill miniprogram-minium-cli` 从仓库安装。

## 随包 Skills

当前仓库随包提供以下 skills：

- `miniprogram-minium-cli`：面向运行时准备、plan 编写、执行、skill 安装和结果分析的产品使用指导
- `interactive-classname-tagging`：面向开发阶段的交互元素专用打标指导，要求显式使用 `minium-anchor-<4hex>` 标识

如果要通过开放的 `skills` 工具单独安装这个新 skill，可以执行：

```bash
npx skills add diaz-zeng/miniprogram-minium-cli --skill interactive-classname-tagging
```

## 发布通道

这个仓库会维护三个 npm 通道：

- `alpha`：活跃 `next/x.y.z` 分支发布的 MAJOR 预发布版
- `next`：活跃 `release/x.y.z` 分支发布的 MINOR beta 版
- `latest`：正式发布 PR 合入 `main` 后发布的稳定版
如果要显式安装预发布通道，请执行：

```bash
pnpm add -g miniprogram-minium-cli@alpha
pnpm add -g miniprogram-minium-cli@next
```

## 维护者发布流程

这个仓库把每条活跃版本线中的 `package.json.version` 作为该版本线目标正式版的唯一事实源。

1. `main` 永远代表当前稳定版本，只接收正式发布 PR。
2. 使用 `release/x.y.z` 管理下一个 MINOR 版本，使用 `next/x.y.z` 管理下一个 MAJOR 版本，使用 `hotfix/x.y.z` 管理当前稳定版的 PATCH 修复。
3. 确保分支名和 `package.json.version` 完全一致，例如 `release/1.5.0` 对应 `package.json.version = 1.5.0`。
4. `release/x.y.z` 分支上的 push 会发布 MINOR beta 版本，例如 `1.5.0-beta.<run-id>.<attempt>.<sha>`，并打到 npm `next`。
5. `next/x.y.z` 分支上的 push 会发布 MAJOR alpha 版本，例如 `2.0.0-alpha.<run-id>.<attempt>.<sha>`，并打到 npm `alpha`。
6. 当某条版本线准备正式发版时，把对应的正式发布 PR 合入 `main`。stable workflow 会校验合入来源、发布 npm `latest`、自动创建 `vX.Y.Z` tag，并自动创建 GitHub Release。
7. 正式版 GitHub Release 会把 `CHANGELOG.md` 中对应版本的章节作为主体内容，并附加自动生成的 release notes；如果 changelog 缺失，该次正式发布会直接失败。
8. 每次 PATCH 或 MINOR 正式发布完成后，都要把适用修复继续前向同步到当前活跃的 `release/*` 和 `next/*` 版本线。

重要发布守卫：

- 如果活跃版本线中的稳定版本已经正式存在于 npm，`alpha` 和 `next` 预发布流水线都会在执行 `npm publish` 前直接失败。
- 如果 `main` 上的 stable workflow 无法解析出一个已经合入的正式发布 PR，workflow 会 fail closed，而不是继续发版。
- 如果 stable workflow 找不到当前版本在 `CHANGELOG.md` 中对应的章节，workflow 会 fail closed，而不是创建空的 GitHub Release。
- 浮动的 `@alpha`、`@next` dist-tag 永远指向当前该通道最新一次成功发布；如果你要安装精确构建，请直接使用完整版本号。

如果需要在本地调试发布辅助脚本，可以执行：

```bash
pnpm run release:assert-release-branch -- --branch release/1.5.0
pnpm run release:assert-unpublished-base
pnpm run release:assert-stable-unpublished
pnpm run release:compute-prerelease -- --preid beta --run-id 123 --run-attempt 1 --sha abcdef1
pnpm run release:extract-changelog -- --version 1.5.0
```

GitHub Actions 发布流程优先使用 npm trusted publishing。如果仓库暂时还没有配置 trusted publishing，也可以通过仓库 secrets 提供 `NPM_TOKEN` 作为过渡方案。

## 快速开始

预热托管运行时：

```bash
miniprogram-minium-cli prepare-runtime
```

执行计划文件：

```bash
miniprogram-minium-cli exec \
  --plan ./plans/login-check.json \
  --wechat-devtool-path /path/to/wechat-devtools-cli
```

执行内联 JSON 计划：

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

执行带 bridge 步骤的内联计划：

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

## 命令说明

完整的命令、参数和 plan 格式说明请查看 [API_REFERENCE.zh-CN.md](./API_REFERENCE.zh-CN.md)。

### `exec`

```bash
miniprogram-minium-cli exec (--plan <file> | --plan-json <json>) [--project-path <path>] [--wechat-devtool-path <path>] [--runtime-mode <mode>] [--auto-screenshot <mode>] [--json]
```

用途：

- 校验并执行结构化 plan

主要参数：

- `--plan <file>`：执行文件计划
- `--plan-json <json>`：执行内联 JSON 计划
- `--project-path <path>`：覆盖 `environment.projectPath`
- `--wechat-devtool-path <path>`：覆盖 `environment.wechatDevtoolPath`
- `--artifacts-dir <path>`：覆盖 `environment.artifactsDir`
- `--test-port <port>`：覆盖 `environment.testPort`
- `--runtime-mode <mode>`：覆盖 `environment.runtimeMode`
- `--auto-screenshot <mode>`：设置截图策略
- `--json`：输出结构化执行结果

截图模式：

- `off`
- `on-success`
- `always`

### `prepare-runtime`

```bash
miniprogram-minium-cli prepare-runtime [--json]
```

用途：

- 预加载 `uv`
- 准备托管 Python 运行时
- 降低首次真实执行的冷启动成本

### `install`

```bash
miniprogram-minium-cli install --skills [--path <path>] [--json]
```

用途：

- 将随包附带的 `miniprogram-minium-cli` skill 安装到当前执行目录下的 `./.agents/skills`，或安装到其他 coding agent 的自定义 skills 根目录

主要参数：

- `--skills`：安装当前包中附带的所有 bundled skills
- `--path <path>`：安装到自定义 skills 根目录，而不是当前执行目录下默认的 `./.agents/skills`
- `--json`：输出结构化安装结果

默认安装目录：

- 当前执行目录下的 `./.agents/skills`

如果你想安装到共享全局目录，或要给 Claude Code、GitHub Copilot 等其他 coding agent 使用，请通过 `--path` 指向目标 skills 目录。

## 运行产物

默认运行产物目录：

```text
.minium-cli/runs
```

每次执行都会生成独立的 run 目录，包含：

- `plan.json`
- `summary.json`
- `result.json`
- `comparison.json`
- 按配置生成的截图，以及失败取证截图

## 运行时行为

- CLI 在第一次真正需要 Python 执行时懒加载运行时
- 托管运行时只对当前 CLI 生效
- CLI 不会修改用户的全局 Python、pip、PATH 或 shell 配置
- 默认请求 Python `3.14`
- 托管运行时最低支持 Python `3.11`

## 使用限制

仍然使用 `touristappid` 的项目，只应把真实运行结果视为受限验证。

它不适合作为以下流程的代表性真实验证方式：

- `wx.showModal`
- `wx.showActionSheet`
- `wx.authorize`
- `wx.getLocation`
- `wx.chooseLocation`
- `wx.getUserProfile`
- `wx.requestSubscribeMessage`

如果这些流程是重点，请改用开发者自有 AppID，而不是继续使用 `touristappid`。

## 选型说明

### 为什么选择 Minium，而不是 miniprogram-automator

这个产品选择 Minium，主要基于三点：

1. CLI 需要一个适合可复用 plan、断言、产物和复杂交互回放的强执行后端，而不是仅仅依赖一个薄封装。
2. 产品明确依赖多阶段手势执行，包括状态化的单指和多指交互。
3. 产品面向的是 agent 生成 plan 之后的稳定执行，而不是一个轻量级的纯 Node 脚本接口。

## 许可证

MIT。详见 [LICENSE](../LICENSE)。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=diaz-zeng/miniprogram-minium-cli&type=Date)](https://www.star-history.com/#diaz-zeng/miniprogram-minium-cli&Date)
