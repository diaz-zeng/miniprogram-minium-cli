## MODIFIED Requirements

### Requirement: Structured plan input MUST remain bounded to miniapp automation and testing semantics
系统 MUST 将可执行计划输入以及配套的 agent-facing skill 指导限制在小程序自动化与测试语义范围内，不得把 CLI 扩展为任意命令执行器、MCP 协议入口、内建规划器或通用脚本代理。

#### Scenario: Request includes out-of-scope MCP workflow
- **WHEN** 用户提供的计划中包含 MCP server、tool 注册、stdio 暴露或其他协议层工作方式相关步骤
- **THEN** 系统 SHALL 拒绝执行该计划
- **THEN** 系统 SHALL 说明该请求超出当前 CLI 的能力边界

#### Scenario: Request includes arbitrary host command execution
- **WHEN** 用户在自动化计划中插入与小程序验收无关的任意 shell 命令或通用脚本执行
- **THEN** 系统 SHALL 拒绝执行该类步骤
- **THEN** 系统 SHALL 保持计划仅包含受支持的自动化与测试步骤类型

#### Scenario: Repository-provided skills guide CLI usage
- **WHEN** AI agent 通过仓库提供的 skills 学习或执行 CLI 工作流
- **THEN** 这些 skills SHALL 引导 agent 使用已文档化的结构化 plan 与执行命令
- **THEN** 这些 skills SHALL NOT 把 CLI 描述成自然语言规划器、MCP endpoint 或任意主机自动化工具
