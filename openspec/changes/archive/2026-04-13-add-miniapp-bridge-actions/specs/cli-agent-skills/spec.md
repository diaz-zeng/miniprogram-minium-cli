## MODIFIED Requirements

### Requirement: The product-use skill SHALL treat repository documentation as the canonical CLI contract
该产品使用类 skill SHALL 将仓库文档、示例与 OpenSpec 规范视为 CLI 行为的权威来源，不得自行发明未被文档或规范定义的命令、参数、plan 字段或输出语义。

#### Scenario: Contributor adds a documented agent-facing capability
- **WHEN** 贡献者通过 OpenSpec change 新增或修改了已文档化的 CLI 命令、plan schema、步骤类型、运行产物或其他 agent-facing workflow
- **THEN** 系统 SHALL 要求该 change 显式评估 `skills/` 下的 repository-managed skills 是否需要同步更新
- **THEN** 若现有 skill 指导将因此过期，对应 skill 或其引用资料 SHALL 在同一个 change 中一并更新

#### Scenario: Change only affects internal implementation details
- **WHEN** 某个 change 仅影响内部实现细节，且不会改变已文档化的 CLI 契约或 agent-facing workflow
- **THEN** 系统 SHALL 允许该 change 不修改 repository-managed skills
- **THEN** 贡献者 SHALL 不得为了形式一致而伪造无意义的 skill 变更
