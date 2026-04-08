# interactive-classname-tagging-skill Specification

## Purpose
定义一个仓库维护的开发期 skill，用于指导 AI agent 为小程序可交互元素显式补充专用 `className` 自动化锚点，并约束打标范围、命名格式、冲突处理和引用资料组织方式。

## Requirements

### Requirement: Repository SHALL provide a first-party skill for dedicated interactive classname tagging
仓库 SHALL 提供一个由项目维护的一方 skill，用于指导 AI agent 在开发阶段为可交互元素显式补充专用的 `className` 标识，而不是依赖零散提示词临时约定打标方式。

#### Scenario: Agent needs guidance for interactive element tagging
- **WHEN** AI agent 在仓库中新增或修改页面、组件，且涉及点击、输入、切换、选择、提交等交互元素
- **THEN** 系统 SHALL 通过该 skill 指导 agent 判断哪些节点需要补充专用的 `className`
- **THEN** 该 skill SHALL 以仓库级独立目录形式存在于 `skills/` 目录下，便于 agent 工具链稳定发现

#### Scenario: Contributor inspects repository-managed skills
- **WHEN** 贡献者或 agent 工具链浏览仓库中的 skills
- **THEN** 系统 SHALL 通过一致的 skill 目录结构暴露该能力
- **THEN** 该目录 SHALL 至少包含主 `SKILL.md`，并可包含 `references/` 等补充资料

### Requirement: The skill SHALL scope dedicated tagging to interactive or automation-critical nodes
该 skill SHALL 把专用打标范围限定为默认需要被自动化、录制回放或调试稳定定位的交互节点，不得默认要求对所有展示节点进行无差别打标。

#### Scenario: Interactive node requires a dedicated classname
- **WHEN** agent 识别到一个节点承担点击、输入、切换、提交或导航等交互语义
- **THEN** 该 skill SHALL 将该节点视为默认候选，指导 agent 检查并补充专用的 `className`
- **THEN** 该 guidance SHALL 优先覆盖事件绑定节点或最贴近交互语义的承载节点

#### Scenario: Presentational node does not require tagging by default
- **WHEN** agent 分析到一个纯布局容器、纯文本展示节点或装饰性包装层，且该节点不承担交互语义
- **THEN** 该 skill SHALL 不要求默认为该节点新增 `className`
- **THEN** agent SHALL 仅在该节点被明确作为自动化关键锚点时才考虑补充标识

### Requirement: The skill SHALL require explicit dedicated markers with minimal incremental edits
该 skill SHALL 要求 agent 采用“识别交互节点、校验是否已有专用标识、在缺失时显式补充专用标识”的顺序，避免把普通业务类名误当作自动化锚点，同时避免引入大面积无意义 diff。

#### Scenario: Existing business classname does not waive dedicated tagging
- **WHEN** agent 发现目标交互节点已经存在普通业务用途的 `className`，但缺少符合仓库约定的专用标识
- **THEN** 该 skill SHALL 指导 agent 仍然为该节点额外补充专用 `className`
- **THEN** agent SHALL 不把普通样式类、布局类或业务类直接视为自动化专用锚点

#### Scenario: Add a dedicated classname only where the dedicated marker is missing
- **WHEN** 目标交互节点缺少专用标识，且自动化或调试场景需要可靠定位
- **THEN** 该 skill SHALL 指导 agent 仅在必要节点上新增专用 `className`
- **THEN** agent SHALL 避免同时给外层包装节点和内层实际交互节点重复补充专用标识，除非二者都承担独立交互职责

### Requirement: The skill SHALL enforce the `minium-anchor-<4位hash>` format for new dedicated classnames
该 skill SHALL 要求新增的专用 `className` 固定采用 `minium-anchor-<4位hash>` 格式，其中 `<4位hash>` 为长度固定的 4 位小写十六进制短 hash。

#### Scenario: Agent names a newly added dedicated classname
- **WHEN** agent 需要为一个新增的专用交互标识命名
- **THEN** 该 skill SHALL 指导 agent 使用 `minium-anchor-<4位hash>` 格式生成名称
- **THEN** 该 skill SHALL 固定使用“相对文件路径 + 元素树路径 + 交互类型”作为基础生成种子
- **THEN** 生成的名称 SHALL 与普通业务样式类明显区分，并在相同稳定上下文下保持可复现

#### Scenario: Generated short hash collides within the current scope
- **WHEN** agent 为当前页面或组件中的两个不同交互节点生成了相同的 `minium-anchor-<4位hash>`
- **THEN** 该 skill SHALL 要求 agent 检测并判定该命名冲突
- **THEN** agent SHALL 在原始基础种子末尾追加递增冲突序号并重新计算，直到当前作用域内的专用标识唯一

### Requirement: The skill SHALL use progressive disclosure and remain tool-agnostic
该 skill SHALL 通过主入口与引用资料的方式组织打标规则，并说明其主要服务于自动化测试、录制回放、问题排查和 AI 辅助修改场景，同时不得把规则绑定到单一执行器。

#### Scenario: Agent needs detailed tagging rules
- **WHEN** agent 只需要查看“何时打标”“如何命名”或“示例前后对比”中的某一类信息
- **THEN** 该 skill SHALL 允许 agent 读取对应的引用资料，而不是把所有细节堆叠在主 `SKILL.md` 中
- **THEN** 主 `SKILL.md` SHALL 保持为触发条件、流程和 guardrails 的统一入口

#### Scenario: Different automation consumers rely on the same tagging rule
- **WHEN** 打标后的 `className` 需要被自动化测试、录制回放或调试流程消费
- **THEN** 该 skill SHALL 说明这些标识的价值是提供稳定交互锚点
- **THEN** 该 skill SHALL 不把命名规则写死到某一个 CLI 命令、测试框架或执行器实现上
