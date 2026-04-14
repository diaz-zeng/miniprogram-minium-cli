## Why

当前仓库的发布实现已经支持两类预发布行为：

- `main` 合入后自动向 npm `next` 发布 beta 版本
- PR 源分支更新后自动向 npm `canary` 发布 canary 版本

但仓库文档和主规范仍停留在“`main` 自动 prerelease + tag 正式发布”的旧模型，没有完整表达 PR canary 通道，也没有描述新增的版本守卫规则：如果 `package.json.version` 对应的稳定版已经正式发布到 npm，就不允许继续基于这个版本派生 `-beta.*` 或 `-canary.*`。这会导致实现、文档和规范之间出现偏差，维护者也难以快速判断什么时候需要先 bump 版本，再继续发布预发布构建。

## What Changes

- 更新产品文档，补充 `canary` / `next` / `latest` 三个发布通道的语义、触发方式和安装方式。
- 更新维护者发布流程说明，明确 PR canary、`main` beta、tag stable 之间的关系。
- 在文档中补充新的版本守卫规则：如果稳定基线版本已正式存在于 npm，beta 和 canary 流水线必须失败，并要求维护者先推进 `package.json.version`。
- 为 `npm-release-publishing` capability 增补规范，覆盖 PR canary 发布行为以及“稳定基线已正式发布时拒绝继续预发布”的约束。

## Capabilities

### New Capabilities

### Modified Capabilities
- `npm-release-publishing`：补充 PR canary 通道和 prerelease 基线版本守卫规则，使规范与当前实现保持一致。

## Impact

- `README.md`
- `docs/README.zh-CN.md`
- `docs/CONTRIBUTING.zh-CN.md`
- `openspec/specs/npm-release-publishing/spec.md` 对应的增量规范
- 维护者对版本推进与发布失败排查的操作方式
