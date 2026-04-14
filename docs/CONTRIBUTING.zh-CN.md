# 贡献指南

[English](../CONTRIBUTING.md)

感谢你参与 `miniprogram-minium-cli` 的开发。

这个仓库包含：

- 基于 TypeScript 的 Node.js CLI 层
- 基于 Minium 的 Python 执行运行时
- 用于跟踪产品与实现变更的 OpenSpec 制品

## 开发原则

- 保持 CLI 聚焦于执行、校验与产物管理。
- 保持 Python 运行时只对 CLI 私有，不要引入对用户全局 Python 环境的依赖。
- CLI 帮助信息与运行时输出保持英文。
- 仓库级文档默认使用英文，除非某个文件明确要求使用其他语言。
- 优先设计结构化、机器可读的接口。

## 本地环境

要求：

- Node.js `>= 18`
- `pnpm`

安装依赖：

```bash
pnpm install
```

## 开发命令

构建 TypeScript 层：

```bash
pnpm run build
```

运行类型检查：

```bash
pnpm run typecheck
```

运行测试：

```bash
pnpm test
```

预热托管运行时：

```bash
node lib/index.js prepare-runtime
```

## 项目结构

- `src/`：TypeScript CLI 层
- `python/`：Python 运行时与 Minium 集成
- `tests/`：Node 侧自动化测试
- `examples/`：仅用于本地开发和验证的示例资产
- `openspec/`：OpenSpec 变更、规格与实现跟踪

## 文档要求

- `README.md` 是主英文产品文档。
- `docs/README.zh-CN.md` 是中文镜像文档。
- 修改其中一份 README 时，应同步检查另一份是否需要更新。
- 示例相关的详细说明应放在 `examples/` 目录下，而不是根 README 中。
- 保持 `skills/` 目录下由仓库维护的 skills 与已文档化的 CLI 行为和 plan 语义一致。

## OpenSpec 流程要求

- 通过 `openspec/changes/<change>/` 下的 OpenSpec 制品跟踪用户可见能力变更。
- 当某个 change 新增或修改了已文档化的 CLI 命令、plan schema、步骤类型、运行产物或其他面向 agent 的工作流时，应显式评估是否需要同步更新 `skills/` 目录下的仓库技能。
- 如果 skill 指导内容会因此过期，就应把 skill 更新纳入同一个 OpenSpec change，而不是留作无关的后续补丁。
- 只要该变更包含 skill 相关工作，就应在 `proposal.md`、`design.md` 或 `tasks.md` 等制品中体现出来，方便评审时核对 agent-facing workflow 是否仍然一致。

## 测试要求

在提交变更前，至少运行：

```bash
pnpm run typecheck
pnpm test
```

如果修改了运行时行为，条件允许时也应做对应执行链路的手动验证。

## 发布流程要求

- `package.json.version` 表示下一个目标正式版，而不是当前某一次预发布迭代号。
- 如果要开始新的发布周期，应先通过常规 PR 更新下一个正式版本，再依赖 `main` 上的自动预发布。
- 同仓库 PR 源分支上的 push 会自动发布 npm `canary` 通道，用于验证该 PR 的最新构建。
- 合入到 `main` 的变更会自动发布到 npm `next` 通道。
- 如果 `package.json.version` 对应的稳定版已经正式发布到 npm，`canary` 和 `next` workflow 都会失败，必须先把版本推进到下一个目标正式版。
- 正式版只通过匹配的 `v*` tag 发布，且 workflow 必须看到与 `package.json` 完全一致的版本号。
- 正式版发布完成后，应再开一个后续 PR，把 `package.json.version` 推进到下一目标正式版。
- GitHub Actions 发布优先使用 npm trusted publishing；如果暂时无法配置，再把 `NPM_TOKEN` 作为临时兜底方案。

## 提交信息规范

- 提交信息使用英文。
- 遵循 Conventional Commits。

示例：

- `feat: add inline json plan execution`
- `fix: resolve gesture dispatch target coordinates`
- `docs: rewrite root readme as product guide`

## Pull Request 建议

- 保持变更聚焦、易审阅。
- 清楚说明用户可见行为的变化。
- 明确指出运行时、兼容性或发布层面的影响。
- 在描述中附上测试与手动验证结果。
