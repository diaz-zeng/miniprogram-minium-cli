## Why

当前仓库只有一个最小化的 CLI 占位入口，尚未承载任何真实的小程序自动化与测试能力。参考 GitHub 仓库 `https://github.com/diaz-zeng/miniprogram-minium-mcp` 这个同样采用 spec-driven 工作流的项目，以及其已归档的 `session`、`actions`、`gestures` 相关 specs/changes，我们需要把其中与 MCP 协议无关的核心能力沉淀为一个 AI-first CLI 执行层，让开发者或上层 agent 可以通过结构化计划完成小程序自动化、断言、取证与测试执行。

## What Changes

- 新增一个 AI-first 的命令行应用执行层，支持接收上层 agent 或工具生成的结构化计划，并由 CLI 负责校验、执行与结果汇总。
- 新增面向小程序项目的运行时会话管理能力，包括项目启动、开发者工具自动化端口准备、运行态附着、状态读取与资源释放。
- 新增页面查询、点击、输入、等待、多触点手势等自动化动作能力，覆盖 `https://github.com/diaz-zeng/miniprogram-minium-mcp` 已验证的小程序验收主链路。
- 新增页面路径、元素文本、元素可见性等结构化断言能力，并将失败取证、截图与上下文摘要纳入统一测试输出。
- 新增适合 CLI 场景的测试编排入口，包括文件计划执行、内联 JSON 计划执行、脚本化执行和结果汇总输出。
- 明确排除 MCP Server、MCP tool 注册、stdio 协议暴露及任何面向 MCP 客户端的工作方式，CLI 仅提供本地命令行交互与可复用内部模块。

## Capabilities

### New Capabilities
- `ai-first-cli-orchestration`: 定义 AI-first CLI 执行层的计划输入、执行编排、结果汇总与用户交互边界。
- `miniapp-acceptance-session`: 参考 `https://github.com/diaz-zeng/miniprogram-minium-mcp` 仓库中的 `openspec/specs/miniapp-acceptance-session`，定义小程序项目运行时准备、会话创建、状态读取、超时与关闭的行为要求，但输出形态面向 CLI 而非 MCP。
- `miniapp-acceptance-actions`: 参考 `https://github.com/diaz-zeng/miniprogram-minium-mcp` 仓库中的 `openspec/specs/miniapp-acceptance-actions`，定义元素查询、点击、输入、等待、断言、错误模型与失败取证。
- `miniapp-acceptance-gestures`: 参考 `https://github.com/diaz-zeng/miniprogram-minium-mcp` 仓库中的 `openspec/specs/miniapp-acceptance-gestures` 及其 archive changes，定义多触点手势能力与会话内触点状态管理。
- `miniapp-cli-test-execution`: 定义单任务执行、批量执行、脚本化回放、执行摘要、退出码以及面向 CLI 的测试结果组织方式。

### Modified Capabilities

无。

## Impact

- 受影响代码：CLI 入口、命令解析、执行编排层、Minium 运行时适配层、断言与测试执行层、产物管理层。
- 受影响依赖：需要引入命令行框架、配置管理、测试结果输出能力，并复用或迁移 `https://github.com/diaz-zeng/miniprogram-minium-mcp` 中与 MCP 无关的核心运行时逻辑和已验证的 spec 语义。
- 受影响系统：本地微信开发者工具、小程序项目目录、自动化端口配置、截图与调试产物目录。
- 兼容性影响：现有仓库几乎为空实现，本次变更以新增能力为主；对外接口应避免与 MCP 命名和调用模型绑定，优先形成稳定的 CLI 命令与内部领域模型。
