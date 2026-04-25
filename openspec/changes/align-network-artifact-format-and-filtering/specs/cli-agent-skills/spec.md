## MODIFIED Requirements

### Requirement: Repository SHALL provide a first-party product-use skill for common CLI workflows
仓库 SHALL 提供一个由项目维护的一方产品使用类 skill，用于指导 AI agent 完成 `miniprogram-minium-cli` 的常见使用流程，而不是依赖临时提示词猜测命令和步骤；当运行涉及网络证据时，该 skill SHALL 把“读取结构化结果、使用低噪音过滤帮助脚本、按需回退到完整网络产物”作为文档化默认流程的一部分。

#### Scenario: Agent prepares the managed runtime
- **WHEN** AI agent 需要在首次执行 plan 前检查或准备运行环境
- **THEN** 系统 SHALL 通过该 skill 指导 agent 使用仓库已支持的运行时准备流程
- **THEN** 该流程 SHALL 与现有 CLI 命令和受管运行时模型保持一致

#### Scenario: Agent executes a documented plan workflow
- **WHEN** AI agent 需要执行一个 plan 文件或内联 plan JSON
- **THEN** 系统 SHALL 通过该 skill 指导 agent 使用已文档化的 `exec` 工作流
- **THEN** 该 skill SHALL 引导 agent 关注 plan 输入、执行命令与运行产物，而不是发明新的执行入口

#### Scenario: Agent interprets run artifacts
- **WHEN** AI agent 需要分析一次 CLI 运行结果
- **THEN** 系统 SHALL 通过该 skill 指导 agent 优先读取结构化产物，例如 `summary.json`、`result.json`、`comparison.json` 与截图文件
- **THEN** 当运行涉及网络证据时，该 skill SHALL 指导 agent 先从 step 级证据引用出发，再决定是否展开网络分析

#### Scenario: Agent uses the documented low-noise path for network-aware runs
- **WHEN** AI agent 需要分析一次包含 `network.json` 的运行结果
- **THEN** 该 skill SHALL 指导 agent 先查看 `result.json` 中相关 step 的 `details.networkEvidence`
- **THEN** 在打开完整 `network.json` 之前，该 skill SHALL 优先指导 agent 使用仓库内置的网络过滤帮助脚本

## ADDED Requirements

### Requirement: Repository-managed product-use skill SHALL provide a bundled network artifact filter helper
仓库管理的产品使用类 skill SHALL 提供一个随 skill 一起分发的网络产物过滤帮助脚本，用于把 step 级网络证据收缩为低噪音的网络子图，而不是默认要求 agent 直接解析完整 `network.json`。

#### Scenario: Install bundled skills with the network filter helper
- **WHEN** 用户执行 `miniprogram-minium-cli install --skills`
- **THEN** 安装结果 SHALL 在 `skills/miniprogram-minium-cli/` 目录下包含该网络过滤帮助脚本
- **THEN** 其他基于 skill 目录的 agent 工具链 SHALL 能在安装后的 skill 目录中直接调用它

#### Scenario: Run analysis guidance documents the helper command
- **WHEN** AI agent 依据该 skill 分析一次网络相关运行结果
- **THEN** skill 主入口或其引用资料 SHALL 提供该帮助脚本的明确调用方式
- **THEN** 该调用方式 SHALL 以 `result.json` 和 step 级网络证据为默认输入，而不是要求调用方手工先过滤完整 `network.json`
