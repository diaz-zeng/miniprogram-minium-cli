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
- 显式截图与自动截图
- 单指和多指手势
- 产出 `summary.json`、`result.json`、`comparison.json` 以及截图文件

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
npm install -g miniprogram-minium-cli
```

宿主机要求：

- Node.js `>= 18`

CLI 会按需准备并复用自己的私有 `uv` 托管 Python 运行时。用户不需要为这个工具单独维护全局 Python 环境。

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
