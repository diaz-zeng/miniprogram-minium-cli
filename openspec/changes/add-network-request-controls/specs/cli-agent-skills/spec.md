## MODIFIED Requirements

### Requirement: Repository SHALL provide a first-party product-use skill for common CLI workflows
仓库 SHALL 提供一个由项目维护的一方产品使用类 skill，用于指导 AI agent 完成 `miniprogram-minium-cli` 的常见使用流程，而不是依赖临时提示词猜测命令和步骤；当执行结果已经会落盘为结构化产物时，该 skill SHALL 优先引导 agent 先依据 CLI 结论判断当前验证目标是否已满足，仅在需要进一步证据时再按需读取这些产物，而不是默认要求 `exec` 总是附带 `--json`。

#### Scenario: Agent executes a documented plan workflow
- **WHEN** AI agent 需要执行一个 plan 文件或内联 plan JSON
- **THEN** 系统 SHALL 通过该 skill 指导 agent 使用已文档化的 `exec` 工作流
- **THEN** 该 skill SHALL 引导 agent 关注 plan 输入、执行命令与运行产物，而不是发明新的执行入口

#### Scenario: Agent validates a run that already persists structured artifacts
- **WHEN** AI agent 的目标只是确认一次执行是否通过、定位失败步骤，或进一步分析已落盘的 `summary.json`、`result.json`、`comparison.json`、`network.json` 等结构化产物
- **THEN** 该 skill SHALL 优先指导 agent 使用不带 `--json` 的 `miniprogram-minium-cli exec` 命令
- **THEN** 当 CLI 结论已经满足当前验证目标时，该 skill SHALL 不默认要求 agent 继续读取落盘产物
- **THEN** 当执行结果不符合预期，或需要进一步证据时，该 skill SHALL 引导 agent 从运行目录中的结构化产物按需读取事实，而不是把完整结构化结果默认回传到当前上下文

#### Scenario: Agent explicitly needs structured stdout in the current context
- **WHEN** AI agent 所在的调用链必须直接消费 stdout 中的结构化 JSON，或上层调用方明确要求立即返回结构化执行结果
- **THEN** 该 skill SHALL 允许并指导 agent 使用 `miniprogram-minium-cli exec ... --json`
- **THEN** 该 skill SHALL 将 `--json` 表达为按需启用的模式，而不是默认推荐参数
