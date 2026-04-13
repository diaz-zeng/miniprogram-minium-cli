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

## 测试要求

在提交变更前，至少运行：

```bash
pnpm run typecheck
pnpm test
```

如果修改了运行时行为，条件允许时也应做对应执行链路的手动验证。

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
