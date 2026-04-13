# cli-agent-skills Specification

## Purpose
定义仓库级产品使用类 skill 如何指导 AI agent 使用 `miniprogram-minium-cli`，并约束这类 skill 的目录结构、事实来源、渐进式披露方式与安装行为。

## Requirements

### Requirement: Repository SHALL provide a first-party product-use skill for common CLI workflows
仓库 SHALL 提供一个由项目维护的一方产品使用类 skill，用于指导 AI agent 完成 `miniprogram-minium-cli` 的常见使用流程，而不是依赖临时提示词猜测命令和步骤。

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
- **THEN** 该 skill SHALL 帮助 agent 基于已有产物进行总结与排错

### Requirement: The product-use skill SHALL treat repository documentation as the canonical CLI contract
该产品使用类 skill SHALL 将仓库文档、示例与 OpenSpec 规范视为 CLI 行为的权威来源，不得自行发明未被文档或规范定义的命令、参数、plan 字段或输出语义。

#### Scenario: Skill guides plan authoring from documented schema
- **WHEN** AI agent 使用 skill 生成或校验一个 plan
- **THEN** 该 skill SHALL 引导 agent 依据仓库中已存在的 plan schema、命令参考和示例进行编写
- **THEN** 生成结果 SHALL 与现有文档描述保持一致

#### Scenario: Requested command detail is undocumented
- **WHEN** AI agent 试图使用一个未在仓库文档、示例或 OpenSpec 规范中定义的命令、flag、步骤类型或输出字段
- **THEN** 对应 skill SHALL 不把该能力当作已支持事实输出
- **THEN** 该 skill SHALL 引导 agent 回到仓库中的权威资料进行确认

#### Scenario: Contributor adds a documented agent-facing capability
- **WHEN** 贡献者通过 OpenSpec change 新增或修改了已文档化的 CLI 命令、plan schema、步骤类型、运行产物或其他 agent-facing workflow
- **THEN** 系统 SHALL 要求该 change 显式评估 `skills/` 下的 repository-managed skills 是否需要同步更新
- **THEN** 若现有 skill 指导将因此过期，对应 skill 或其引用资料 SHALL 在同一个 change 中一并更新

#### Scenario: Change only affects internal implementation details
- **WHEN** 某个 change 仅影响内部实现细节，且不会改变已文档化的 CLI 契约或 agent-facing workflow
- **THEN** 系统 SHALL 允许该 change 不修改 repository-managed skills
- **THEN** 贡献者 SHALL 不得为了形式一致而伪造无意义的 skill 变更

### Requirement: The product-use skill SHALL use progressive disclosure for workflow details
该产品使用类 skill SHALL 通过渐进式披露组织不同工作流阶段的细节，使 agent 在统一入口下按需读取对应资料，而不是把所有内容都塞进主 skill 文件。

#### Scenario: Agent needs a focused workflow detail
- **WHEN** AI agent 的目标只是准备运行时、执行 plan 或分析产物中的某一个阶段
- **THEN** 该 skill SHALL 引导 agent 读取与该阶段直接相关的引用资料
- **THEN** 主 `SKILL.md` SHALL 保持为总入口，而不是承载所有细节

#### Scenario: Maintainer extends CLI capabilities
- **WHEN** 仓库贡献者为 CLI 增加新的文档化能力
- **THEN** 系统 SHALL 允许通过新增或更新对应的引用资料来扩展 agent 工作流
- **THEN** 该扩展 SHALL 不要求把单个 `SKILL.md` 持续膨胀成超大文件

### Requirement: Repository-managed skills SHALL follow the standard skill directory convention
仓库管理的产品使用类 skill SHALL 遵循标准 skill 目录规范，以便 agent 工具链和贡献者可以稳定发现、读取和扩展这些能力。

#### Scenario: Add the repository-managed product-use skill
- **WHEN** 仓库新增这个面向 CLI 的产品使用类 skill
- **THEN** 该 skill SHALL 以独立目录形式存在于仓库级 `skills/` 目录下
- **THEN** 该目录 SHALL 至少包含 `SKILL.md`，并可按标准规范包含 `agents/openai.yaml`、`references/` 与其他可选资源目录

#### Scenario: Contributor inspects repository-managed skills
- **WHEN** 贡献者或 agent 工具链浏览仓库中的 skills
- **THEN** 系统 SHALL 通过一致的目录结构暴露该 skill
- **THEN** 该 skill 的基础文件布局 SHALL 与标准 skill 规范保持一致，以降低发现和维护成本

#### Scenario: Open skills tooling installs from repository layout
- **WHEN** 其他 coding agent 或开放 `skills` 生态工具从仓库读取 `skills/` 目录
- **THEN** 系统 SHALL 通过 `skills/miniprogram-minium-cli/` 暴露该 skill
- **THEN** 该目录结构 SHALL 保持与标准 `skills` 工具链兼容

### Requirement: CLI SHALL install bundled product-use skills into a local skills directory by default
CLI SHALL 提供安装入口，把当前包中附带的产品使用类 skill 默认安装到当前执行目录下的本地 skills 根目录中。

#### Scenario: Install bundled skills into the default local directory
- **WHEN** 用户执行 `miniprogram-minium-cli install --skills`
- **THEN** 系统 SHALL 把包内附带的 skill 安装到当前执行目录下的 `./.agents/skills`
- **THEN** 安装结果 SHALL 保持标准 skill 目录结构

#### Scenario: Install bundled skills into a custom directory
- **WHEN** 用户执行 `miniprogram-minium-cli install --skills --path <path>`
- **THEN** 系统 SHALL 把包内附带的 skill 安装到指定的 skills 根目录，例如共享全局目录或其他 agent 的本地目录
- **THEN** 安装结果 SHALL 保持标准 skill 目录结构

#### Scenario: Return structured installation output
- **WHEN** 用户执行 `miniprogram-minium-cli install --skills --json`
- **THEN** 系统 SHALL 输出结构化安装结果
- **THEN** 结果 SHALL 至少包含目标根目录与已安装 skill 的路径信息
