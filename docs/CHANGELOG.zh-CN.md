# 变更日志

[English](../CHANGELOG.md)

本文件记录项目中所有值得关注的变更。

格式参考 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)，版本遵循 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)。

## [Unreleased]

## [1.3.0] - 2026-04-17

### Added

- 新增结构化网络观测能力，支持在 miniapp 执行计划中使用 `network.listen.start`、`network.listen.stop`、`network.listen.clear`、`network.wait`、`assert.networkRequest` 与 `assert.networkResponse`。
- 新增结构化网络拦截能力，支持通过 `network.intercept.add`、`network.intercept.remove` 与 `network.intercept.clear` 实现 mock、fail、delay 等行为。
- 新增网络能力专项回归计划：`examples/demo-regression/12-network-observation.placeholder.plan.json`、`13-network-failure.placeholder.plan.json`、`14-network-transfer.placeholder.plan.json`。
- 新增网络请求控制相关的 OpenSpec 变更制品，位于 `openspec/changes/add-network-request-controls/`。

### Changed

- placeholder 运行时现在会为 bridge 驱动的文件与导航流程记录网络请求/响应事件，使随仓库计划能够端到端断言网络行为。
- 真实 Minium 运行时现在会为基于 listener 和仅依赖 matcher 的网络等待/断言初始化网络观测 hook，并兼容缺失 callback id 的运行时实现。
- listener 生命周期处理已增强：清理单个 listener 时会保留共享观测结果，同时避免复用同名 `listenerId` 时误读旧事件。
- 产品 skill、API 参考、README 指引与随仓库示例现已同步覆盖新的网络观测与拦截工作流。

## [1.2.2] - 2026-04-15

### Changed

- 发布 `1.2.2` 仅用于验证新的分支驱动发布自动化流程。
- 该版本在用户可见功能上与 `1.2.0` 保持一致，不包含额外功能变更。

## [1.2.1] - 2026-04-13

### Changed

- 发布 `1.2.1` 仅用于验证自动化打包与发布流程。该版本在功能上与 `1.2.0` 完全一致，不包含额外功能变更。

## [1.2.0] - 2026-04-13

### Added

- 新增结构化 miniapp bridge actions，覆盖存储、路由、应用上下文、设置、剪贴板、反馈 UI、位置、媒体、文件、设备、鉴权与订阅消息等能力域。
- 在 `examples/demo-miniapp/src/pages/bridge-lab/` 中新增 bridge 专用示例页面，并新增 `09-bridge-high-priority.exact.plan.json`、`10-bridge-medium.placeholder.plan.json`、`11-bridge-tourist-skip.exact.plan.json` 三个随仓库回归计划。
- 在 `skills/miniprogram-minium-cli/` 中补齐 bridge 能力的产品使用指引，并新增专门的 `references/bridge-actions.md` 供 plan 编写、执行与结果分析使用。

### Changed

- 本地开发环境已从 `npm` 切换到 `pnpm`，相关仓库脚本、锁文件与安装文档已同步更新。
- bridge 执行链路在真实 Minium 会话启动阶段增加了重试逻辑，用于降低验收运行中的 `session.start` 偶发失败。
- 真实运行时下的 tap 手势派发已增强，`gesture` 示例页中的点击状态更新更稳定。
- placeholder 运行时在查询示例页面元素前会先规范化初始页面路径，使 placeholder bridge 断言与随仓库计划保持一致。
- bridge lab 页面中的 tourist AppID 提示已改为渲染纯文本 `touristappid`，避免真实运行时断言与回归计划文案不一致。
- 已完成全部随仓库 demo regression plan 的验收验证，其中受限 bridge 跳过场景额外补充了一次 `touristappid` 专项验证。
- 面向用户的 skill 安装文档现已收敛为两条路径：`miniprogram-minium-cli install --skills`，或通过开放 `skills` 工具从仓库安装。

## [1.1.0] - 2026-04-08

### Added

- 在 `skills/interactive-classname-tagging/` 下新增一个由仓库维护的一方 skill，用于开发阶段的交互元素自动化专用打标。
- 新增专用打标规范，要求目标交互元素显式使用 `minium-anchor-<4hex>`，而不是依赖业务类名或布局类名。

### Changed

- 随包 skills 的相关文档已更新为同时描述两个仓库 skill，以及它们通过 `install --skills` 和开放 `skills` 工具的安装方式。
- 随包 skill 安装测试已补充校验，确保 `interactive-classname-tagging` 会与 `miniprogram-minium-cli` 一起被打包并安装。

## [1.0.0] - 2026-04-05

### Added

- 在 `skills/miniprogram-minium-cli/` 下提供由仓库维护的一方产品使用类 skill，可供不同 coding agent 复用。
- 支持通过 `install --skills` 安装随包 skill，并支持通过开放的 `skills` 工具从仓库直接安装。

### Changed

- 将已发布的 beta 版本线正式提升为首个稳定版 `1.0.0`。
- 默认的随包 skill 安装目录调整为当前执行目录下的 `./.agents/skills`，同时可通过 `--path` 安装到共享全局或特定 agent 目录。

## [1.0.0-beta.0] - 2026-04-05

### Added

- `miniprogram-minium-cli` 的首个公开 Beta 版本。
- 通过 `exec --plan` 执行结构化计划文件。
- 通过 `exec --plan-json` 直接执行内联 JSON 计划。
- 基于 `uv` 的托管 Python 运行时，用于驱动 Minium 执行。
- 自动截图模式与显式截图步骤。
- 基于 TaroJS 的示例小程序与本地回归计划。
- 通过微信开发者工具接入真实 Minium 执行链路。
- 结构化运行产物，包括摘要、结果、对比文件与截图。
- 英文 CLI 输出与双语项目文档。

### Changed

- CLI 当前只聚焦执行能力，计划生成应由 agent 或外部工具完成。
- 默认运行产物目录调整为 `.minium-cli/runs`。
- Node.js 层已统一为 TypeScript 实现。
