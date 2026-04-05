## Context

`miniprogram-minium-cli` 已经定义了一个清晰的 AI-first 产品边界：由外部 agent 生成结构化 plan，CLI 负责校验并执行。当前缺失的是一个仓库内维护的产品使用类 skill，用来教 AI 如何在这个边界内工作，避免它临时猜命令、发明不支持的 plan 字段，或者错误理解运行产物。

这次变更会同时触及：

- `AGENTS.md` 中的 agent 协作约束
- 仓库内遵循标准规范的 `skills/` 目录
- `README.md`、`docs/API_REFERENCE.md` 等现有产品文档
- agent-facing 使用层与 CLI 执行层之间的契约边界

这个设计必须保持以下约束：

- CLI 仍然是执行层，而不是自然语言规划器
- 受 `uv` 管理的 Python 运行时模型保持不变
- 命令帮助、plan schema 与执行输出仍然是 agent 行为的事实来源
- 最终交付的是产品使用类 skill，不包含 OpenSpec 变更工作流内容

主要相关方包括 agent 作者、仓库维护者，以及后续为 CLI 增加新能力并需要保持 skill 层同步的贡献者。

## Goals / Non-Goals

**Goals:**

- 定义一个一方维护的产品使用类 skill，帮助 AI 更正确、更稳定地使用 CLI。
- 通过渐进式披露覆盖常见工作流，包括运行时准备、plan 编写指导、plan 执行和运行结果解读。
- 复用仓库现有文档和示例，作为命令与 schema 的唯一权威来源。
- 显式强调“只负责执行”的边界，避免 skill 鼓励不受支持的 planner 或通用 shell agent 行为。
- 让单个 skill 在统一入口的同时保持可维护，后续新增 CLI 能力时可以通过补充引用资料扩展。

**Non-Goals:**

- 不为 CLI 增加内建 planner、MCP server 或任意命令执行工作流。
- 不在这次变更中重设计 CLI 命令面或受管运行时架构。
- 第一阶段不引入 postinstall、远程拉取或动态生成 skill 这类额外分发机制。
- 不在产品使用类 skill 中混入 OpenSpec、仓库规范变更或其他协作流程指导。

## Decisions

### 1. 将产品使用类 skill 存放在遵循标准规范的仓库级 skill 目录中

决策：

- 新增的产品使用类 skill 使用标准 skill 目录结构存放在仓库内，采用 `skills/miniprogram-minium-cli/` 的组织方式。
- 该 skill 保持自包含，至少包含 `SKILL.md`；按标准规范可选包含 `agents/openai.yaml`、`references/`、`scripts/`、`assets/` 等资源。
- 第一阶段的分发单位是“仓库中的标准化 skill 资产”，并把同一份 skill 目录纳入 npm 包产物，以支撑 CLI 自安装和开放 `skills` 生态发现。

原因：

- 标准 skill 规范强调“每个 skill 是一个自包含目录”，用仓库级 `skills/` 目录更符合这一约定，也更适合作为产品能力资产。
- 当 CLI 需要支持 `install --skills` 时，skill 资产还必须随 npm 包一起分发，否则全局安装后的 CLI 无法找到自己的 bundled skill。
- 这个 skill 本质上是 prompt 与工作流指导资产，服务于贡献者和 agent 工具链，而不是终端用户执行 CLI 所必需的运行时依赖。

备选方案：

- 只保留仓库内 `skills/` 目录，不把 skill 一起打进 npm 包。
  - 优点：发布包契约更小。
  - 缺点：CLI 无法为全局或 `npx` 安装用户提供 `install --skills`，也无法和实际分发方式保持一致。
- 继续沿用 `.codex/skills/` 一类偏内部工作流目录。
  - 优点：可以复用现有仓库中的临时约定。
  - 缺点：不够标准化，也不利于把这项能力明确表达为产品级仓库资产。

结论：

- 在仓库中建立遵循标准规范的 `skills/miniprogram-minium-cli/` 目录，并把该产品使用类 skill 作为标准 skill 单元维护。

### 1.1 通过 `install --skills` 暴露随包 skill 安装入口

决策：

- CLI 新增 `install --skills` 命令，用于把当前包中附带的 skill 安装到兼容本地 agent 的 skills 根目录。
- 默认安装根目录为当前执行目录下的 `./.agents/skills`。
- 命令支持 `--path <path>` 覆盖默认安装根目录，并支持 `--json` 输出结构化安装结果。
- 仓库中的 `skills/` 目录同时保持与开放 `skills` 生态工具兼容，以支持 `npx skills add ...` 一类从仓库直接安装的方式。

原因：

- 参考 `playwright-cli` 的做法，显式安装入口比要求用户手动复制目录更易发现，也更适合 agent 自动化调用。
- 当 skill 已随包分发时，CLI 自己负责安装可以降低路径推断和用户操作成本。
- JSON 输出可以让其他 agent 或脚本稳定消费安装结果。

备选方案：

- 只在 README 中说明“手动复制 `skills/` 目录”。
  - 优点：实现更简单。
  - 缺点：体验较差，也不利于 agent 自动化使用。
- 安装时动态生成 skill，而不是复制随包目录。
  - 优点：看起来更灵活。
  - 缺点：会增加不可控差异，也背离标准 skill 目录分发模型。

结论：

- 采用“随包分发 skill 目录 + `install --skills` 复制安装”的方式。

### 2. 使用单个 skill 作为统一入口，并在内部采用渐进式披露

决策：

- 首版只提供一个产品使用类 skill，作为 AI 使用 CLI 的统一入口。
- `SKILL.md` 只保留触发条件、总流程、边界约束和分流规则。
- 运行时准备、plan 编写与校验、执行、结果分析等细节放入 `references/` 中，由 skill 在需要时按任务场景加载，实现渐进式披露。

原因：

- 当前目标是交付“一个产品使用指南型 skill”，统一入口比多个 skill 更易于触发和采用。
- 渐进式披露可以避免把所有细节都堆进 `SKILL.md`，兼顾入口简洁与内容完整。
- 当某个工作流阶段发生变化时，只需局部更新对应 reference 文件，而不需要把 skill 拆成多个独立单元。

备选方案：

- 为每个工作流阶段分别创建独立 skill。
  - 优点：每个 skill 更聚焦。
  - 缺点：入口分散，agent 需要先判断该用哪个 skill，与当前目标不一致。
- 只做一个超长 `SKILL.md`，不做渐进式披露。
  - 优点：文件更少。
  - 缺点：主 skill 容易过胖，后续维护和触发成本都会升高。

结论：

- 采用“一个 skill + `references/` 渐进式披露”的单 skill 方案。

### 3. 以仓库文档和示例为事实来源，skill 只做操作层封装

决策：

- Skill 不重新定义一套独立的命令契约。
- Skill 的指导必须显式建立在 `README.md`、`docs/API_REFERENCE.md`、示例 plan 以及 OpenSpec 已定义能力边界之上。
- 如果某个命令、flag、plan 字段或输出文件没有被文档或 spec 说明，skill 不应自行发明。

原因：

- 当前仓库已经有命令面与 plan 语义的正式文档；如果把这套契约再复制一遍进 skill 提示词，后续极易漂移。
- 当 agent 被要求先读取稳定文档再采取行动时，行为通常更可靠。
- 这样也能降低维护成本：命令契约变更时，主要更新文档；skill 只需要更新操作层工作流说明和按需引用资料。

备选方案：

- 在 skill 中直接内嵌完整 CLI 参考。
  - 优点：skill 自包含。
  - 缺点：与文档重复，过时更快。
- 让 skill 主要依赖从代码中自行推断行为。
  - 优点：看起来更灵活。
  - 缺点：歧义更高，agent 行为也更不稳定。

结论：

- Skill 负责把文档化契约转成可执行工作流，而不是替代文档本身。

### 4. 在主 skill 中显式重复“执行层边界”

决策：

- 主 `SKILL.md` 应明确一组关键 guardrails：
  - agent 必须生成或消费结构化 plan，而不是自由拼接命令式脚本
  - 不允许发明未支持的动作或步骤类型
  - CLI 不是 planner、MCP endpoint，也不是任意 shell 自动化工具
  - 结果解读要优先使用 `summary.json`、`result.json`、`comparison.json` 与截图等结构化运行产物

原因：

- 当前最大的产品风险不是“功能不够多”，而是 AI 漂移到不受支持的使用方式。
- 把这些边界直接写进这个 skill，比只依赖全局 `AGENTS.md` 更稳妥。
- 这也能与现有 `ai-first-cli-orchestration` spec 保持一致。

备选方案：

- 只把边界约束放在 `AGENTS.md` 里。
  - 优点：集中管理。
  - 缺点：局部上下文较弱，agent 执行具体 skill 时更容易忽略。

结论：

- 保持执行层边界是这个产品使用类 skill 设计的一等目标。

### 5. 第一阶段采用“skill 与文档先行”，只做最小发布集成

决策：

- 首版实现只新增一个 skill 目录及其渐进式披露资料，以及保障其可发现性和可维护性的最小文档更新。
- 第一阶段只做必要的 npm 打包清单调整与文档补充，不引入新的运行时机制、安装钩子或动态分发流程。

原因：

- 这样风险最低，也最容易快速验证效果。
- 第一阶段的核心价值来自“让 AI 更会用现有 CLI”，而不是新增运行时能力或多 skill 编排。
- 如果后续确实需要对外部分发这个 skill，可以在验证内容模型有效后，再单独设计发布策略。

备选方案：

- 立即引入 skill 安装器或 postinstall 流程。
  - 优点：可自动覆盖更多外部使用者。
  - 缺点：在内容方案尚未验证前就增加了不必要的运维复杂度。

结论：

- 先做仓库原生单 skill 与配套文档，分发机制后置。

## Risks / Trade-offs

- [Skill 内容与 CLI 行为逐渐漂移] -> 缓解：skill 与 `references/` 都要锚定到现有文档和示例，并在命令面变化时同步更新。
- [单个 skill 的主文件逐渐膨胀] -> 缓解：把细节持续下沉到 `references/`，让 `SKILL.md` 只保留总流程和分流规则。
- [不同 agent 的本地或全局 skills 根目录不一致] -> 缓解：默认使用当前执行目录下的本地 `./.agents/skills`，并通过 `--path` 和开放 `skills` 生态安装方式覆盖其他 agent。
- [Skill 无意中鼓励了越界规划行为] -> 缓解：在主 skill 中重复执行边界约束，并与修改后的 orchestration spec 保持一致。

## Migration Plan

1. 在仓库的 `skills/` 目录下新增 `miniprogram-minium-cli/` 标准 skill 目录。
2. 编写精简的 `SKILL.md`，把触发条件、边界约束和分流逻辑固定下来。
3. 按工作流阶段补充 `references/` 资料，让 skill 能按需加载运行时准备、plan 编写、执行和结果分析说明。
4. 更新仓库协作文档，让贡献者知道这个单 skill 的定位，以及哪些文档是权威来源。
5. 验证该 skill 是否已经覆盖最常见的 agent 工作流，且不需要 CLI 运行时代码变更。

## Open Questions

- 是否需要补充更多示例 plan，让单 skill 的 plan 编写引用资料可以直接覆盖典型小程序场景模板？
- `agents/openai.yaml` 在首版是否就要一并生成，还是先只交付 `SKILL.md` 与 `references/`？
- 未来是否真的需要把该 skill 对仓库外部分发，还是仓库本地可用性已经满足主要使用场景？
