## Why

当前 CLI 已经明确定位为“由外部 agent 生成计划、CLI 负责执行”的执行层，但仓库里还没有专门的产品使用类 skill 来教 AI 如何正确发现命令面、组装合法 plan、以及稳定解读执行产物。现在补齐一个由项目维护的一方 skill，并在内部通过渐进式披露组织内容，可以让 AI 更一致地使用 `miniprogram-minium-cli`，减少提示漂移、误用命令和越界行为。

## What Changes

- 为仓库新增一个面向 AI 的产品使用类 skill，引导 agent 按照 CLI 既有的执行工作流使用 `miniprogram-minium-cli`，而不是临时猜测命令或能力边界。
- 在该 skill 内通过渐进式披露覆盖核心场景，包括运行时准备、plan 编写与校验、plan 执行、运行结果与产物解读。
- 为 CLI 增加安装随包 skill 的命令入口，使用户或 agent 可以通过命令把 bundled skill 默认安装到当前执行目录下的本地 skills 目录，或通过自定义路径安装到共享全局目录或其他 agent 的 skills 根目录。
- 让仓库级 `skills/` 目录同时兼容开放 `skills` 生态工具，以便支持 `npx skills add ...` 一类从仓库直接安装的方式。
- 为这个 skill 增加明确的使用边界和约束，确保它强化的是“小程序自动化测试执行层”的使用方式，而不是把 CLI 扩展成通用规划器或任意命令执行器。
- 说明该 skill 与现有 README、API 文档、示例和仓库协作约定的关系，方便后续贡献者持续扩展和维护。

## Capabilities

### New Capabilities
- `cli-agent-skills`：提供一个仓库内维护的一方产品使用类 skill，并通过标准结构与渐进式披露帮助 AI 以一致、可维护、符合 spec 的方式发现、调用并排查 CLI 工作流。

### Modified Capabilities
- `ai-first-cli-orchestration`：补充执行层契约如何被 agent-facing skill 暴露与约束，明确该 skill 必须保持 CLI “只负责执行、不负责规划”的边界。

## Impact

- 会影响 `AGENTS.md`、标准仓库 skill 目录、README/API 文档引用关系，以及相关示例或说明文件。
- 可能影响仓库中文件组织、npm 打包内容和可发现性设计，因为 skills 需要放在一个稳定、易于 agent 和贡献者定位的位置，并同时支持 CLI 自安装与开放 `skills` 生态发现。
- 不改变当前受 `uv` 管理的 Python 私有运行时模型；本次变更聚焦在 AI 使用 CLI 的指导层，而不是运行时本身。
