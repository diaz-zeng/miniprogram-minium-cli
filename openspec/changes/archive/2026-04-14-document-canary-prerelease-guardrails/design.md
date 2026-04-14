## Context

当前仓库已经实现了三条不同触发条件的 npm 发布路径：

- `pull_request` 上的 PR 源分支 canary 发布
- `push` 到 `main` 后的 beta / prerelease 发布
- `v*` tag 触发的 stable 发布

同时，发布脚本新增了一个关键守卫：如果 `package.json.version` 对应的稳定版已经存在于 npm，beta 和 canary 流水线都必须在发布前失败。这样可以避免仓库在 `1.2.3` 已正式发布后，继续产出 `1.2.3-beta.*` 或 `1.2.3-canary.*` 这类语义上倒退的版本。

这次 change 不涉及新的产品代码能力，而是一次“规范与文档对齐”工作：把已经落地的发布行为和约束沉淀成维护者可依赖的说明。

## Goals / Non-Goals

**Goals**

- 让公开文档准确描述 `canary`、`next`、`latest` 三条通道
- 明确说明不同 workflow 的触发时机和面向对象
- 明确说明预发布基线版本守卫，避免维护者误以为正式版发布后还可以继续沿用旧基线
- 通过 OpenSpec change 把新增行为纳入 `npm-release-publishing` capability 的规范增量

**Non-Goals**

- 不调整当前版本号命名算法
- 不引入新的 npm dist-tag
- 不修改 stable tag 发布的触发方式
- 不在本次 change 中处理“每个 PR 独立 dist-tag”之类的后续演进

## Decisions

### 决策一：文档直接按“三通道模型”描述发布语义

README 与中文镜像统一明确：

- `canary`：同仓库 PR 源分支更新时发布，用于验证单个 PR 的最新构建
- `next`：`main` 合入后发布，用于验证即将成为下一正式版的集成结果
- `latest`：匹配的 `v*` tag 发布的正式版

这样维护者与使用方都能快速判断该安装哪个通道。

### 决策二：把“已存在正式版则拒绝预发布”定义为发布规则，而不是实现细节

这个限制会直接影响维护者的发布操作顺序，因此必须进入文档和规范，而不能只隐藏在脚本实现里。文档中需要明确说明：

- 如果 `package.json.version` 的稳定版已经发布到 npm，beta / canary workflow 会失败
- 正确做法是先通过 PR 把 `package.json.version` bump 到下一个目标稳定版本

### 决策三：主 spec 通过新的 change 增量更新，不直接裸改主规范

由于这次变更修改的是既有 capability `npm-release-publishing` 的行为边界，应该通过新的 OpenSpec change 编写 delta spec，待后续归档或同步时再更新主 spec。这样可以保留规范演进轨迹，并符合仓库当前的 OpenSpec 工作方式。

## Risks / Trade-offs

- [文档更新后仍有人沿用旧认知] → 在 README 和贡献文档中都写出“正式版已存在则必须先 bump 版本”的强提示。
- [`@canary` tag 可能被其他 PR 更新覆盖] → 文档中强调 `@canary` 代表“当前最新 canary”，如果需要某个 PR 的精确构建，应安装完整版本号。
- [主 spec 尚未同步时可能出现短期双轨] → 通过新 change 记录规范增量，后续按 OpenSpec 流程归档或同步，避免无记录的直接编辑。

## Migration Plan

1. 更新 README 与中文镜像，补齐发布通道和版本守卫说明。
2. 更新贡献文档，补齐维护者发布顺序和失败排查要点。
3. 在新建的 OpenSpec change 中为 `npm-release-publishing` capability 写入规范增量。
4. 后续在合适时机通过 OpenSpec 归档或同步流程将增量合入主 spec。
