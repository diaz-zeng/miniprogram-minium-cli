# ai-first-cli-orchestration Specification

## Purpose
定义 `miniprogram-minium-cli` 的执行层边界，约束其如何接收外部生成的结构化计划、校验计划并稳定执行，同时保证 CLI 始终保持在小程序自动化与测试语义范围内。
## Requirements
### Requirement: CLI SHALL accept structured plan input from external planners
系统 SHALL 支持接收由外部 agent 或工具生成的结构化执行计划，而不是在 CLI 内部依赖自然语言规划循环。

#### Scenario: Execute a saved structured plan
- **WHEN** 用户通过 CLI 提供一个符合 schema 的计划文件
- **THEN** 系统 SHALL 接受该计划作为执行输入
- **THEN** 该计划 SHALL 明确步骤顺序、目标页面、动作、断言与产物输出位置

#### Scenario: Execute an inline structured plan
- **WHEN** 用户通过 CLI 提供一个内联 JSON 形式的结构化计划
- **THEN** 系统 SHALL 接受该计划作为执行输入
- **THEN** 系统 SHALL 按当前执行目录解析其中的相对路径

### Requirement: CLI SHALL support explicit execution of structured plans
系统 SHALL 支持直接执行结构化计划，以便相同测试流程可以被审查、复用、回放和脚本化调用。

#### Scenario: Execute a saved plan file
- **WHEN** 用户提供一个符合计划 schema 的计划文件并请求执行
- **THEN** 系统 SHALL 按计划中的步骤顺序执行自动化任务
- **THEN** 系统 SHALL 生成对应的执行摘要与产物

#### Scenario: Plan input is provided by inline JSON
- **WHEN** 用户提供符合计划 schema 的 JSON 字符串并请求执行
- **THEN** 系统 SHALL 按计划中的步骤顺序执行自动化任务
- **THEN** 系统 SHALL 生成对应的执行摘要与产物

#### Scenario: Plan file violates schema
- **WHEN** 用户提供的计划文件或 JSON 计划缺少必要字段、步骤类型非法或结构不符合约定 schema
- **THEN** 系统 SHALL 返回参数或计划解析错误
- **THEN** 系统 SHALL 指明不合法的字段或步骤位置

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

### Requirement: CLI execution-facing output SHALL support Chinese and English
系统 SHALL 对执行阶段面向用户的可读输出提供中文和英文支持，并根据环境语言选择合适语言；非中文环境 MUST 输出英文。

#### Scenario: Execution output in a Chinese environment
- **WHEN** 系统运行在中文语言环境且用户请求执行计划
- **THEN** 执行结果、错误提示和补充说明中的可读内容 SHALL 使用中文

#### Scenario: Execution output in a non-Chinese environment
- **WHEN** 系统运行在非中文语言环境且用户请求执行计划
- **THEN** 执行结果、错误提示和补充说明中的可读内容 SHALL 使用英文
- **THEN** 计划文件中的结构化字段名 SHALL 保持稳定
