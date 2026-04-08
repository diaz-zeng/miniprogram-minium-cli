## Why

当前仓库已经提供面向 CLI 使用的产品类 skill，但还没有一个专门指导 agent 在开发阶段为可交互元素进行稳定打标的 skill。随着小程序自动化、录制回放和 AI 辅助开发场景增多，如果点击、输入等关键元素缺少一致的 `className` 标识，后续测试编写、问题定位和协作约束都会变得脆弱且依赖人工约定。

## What Changes

- 新增一个仓库级开发辅助 skill，指导 agent 在开发阶段为可交互元素显式补充稳定、可读、可维护、面向自动化消费的专用 `className` 标识。
- 明确该 skill 适用的元素范围，例如点击、输入、选择、提交、切换等需要被自动化或调试可靠定位的交互节点。
- 规定该 skill 在分析页面或组件时不得把普通业务样式类视为自动化锚点；即使目标元素已有 `className`，只要缺少约定化专用标识，仍需补充专用打标。
- 为该 skill 补充固定打标格式 `minium-anchor-<4位hash>`、增量修改原则以及与测试、录制、回放场景相关的约束说明。
- 说明该 skill 与现有仓库文档、技能目录结构和 agent 协作规则的关系，确保后续贡献者可以继续扩展。

## Capabilities

### New Capabilities
- `interactive-classname-tagging-skill`: 提供一个仓库维护的开发期 skill，指导 agent 为可交互元素显式补充一致的专用 `className` 标识，以提升自动化执行、测试编写和调试定位的稳定性。

### Modified Capabilities

## Impact

- 会影响仓库级 `skills/` 目录及该 skill 对应的 `SKILL.md`、引用资料和可能的 agent 配置文件。
- 可能影响 `README.md`、`docs/API_REFERENCE.md`、`AGENTS.md` 或其他面向贡献者的说明文档，以便声明该 skill 的定位、边界和使用方式。
- 不直接修改 CLI 执行接口或 Python 运行时模型，本次变更聚焦在开发期协作约束和 agent 指导能力。
