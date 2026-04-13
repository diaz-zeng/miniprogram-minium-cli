[English](../README.md)

# TaroJS 示例小程序

这个 TaroJS 小程序是 `miniprogram-minium-cli` 随仓库维护的验证目标，用来在受控范围内持续验证 CLI 的自动化能力。

## 文档目标

这个示例小程序主要用于验证：

- 基于 `id` 的精确定位
- 基于部分文本的模糊定位
- 页面跳转、等待、文本断言与输入
- 点击、单指和双指手势
- 光标拖动、打标和回顾面板交互
- 交互验收和界面验收需要的关键截图节点

## 安装

```bash
cd examples/demo-miniapp
pnpm install
```

## 构建微信小程序

```bash
pnpm run build:weapp
```

本地持续调试时可以使用：

```bash
pnpm run dev:weapp
```

构建完成后，直接用微信开发者工具打开这个项目根目录即可。`project.config.json` 已经把 `miniprogramRoot` 指向了 `dist/`。

## `touristappid` 说明

这个示例项目默认使用 `touristappid`，这样仓库可以在不依赖私有凭据的前提下被克隆、安装和构建。

当目标项目使用 `touristappid` 时，CLI 会在真实运行时启动阶段启用一条兼容路径，并关闭 Minium 的原生弹窗 mock。

这条兼容路径适合验证仓库里的这些能力：

- 页面跳转
- 精确和模糊元素查找
- 文本输入
- 等待与断言
- 点击与手势验证

但它不适合作为以下流程的代表性验证方式，因为这些流程依赖被 mock 的原生弹窗或授权 API：

- `wx.showModal`
- `wx.showActionSheet`
- `wx.authorize`
- `wx.getLocation`
- `wx.chooseLocation`
- `wx.getUserProfile`
- `wx.requestSubscribeMessage`

这个限制适用于所有仍在使用 `touristappid` 的项目，包括开发早期的本地验证项目。如果你需要验证这些原生授权流程，应该把项目切换为开发者自有 AppID。

## 文档索引

- [English](../README.md)
- [场景矩阵](./scenarios.zh-CN.md)
- [Scenario Matrix](./scenarios.md)
