## 1. 发布能力与分支治理契约落地

- [x] 1.1 校对 `release-branch-governance` 与 `npm-release-publishing` 两份 delta spec，确认 requirement 名称、删除项和迁移说明与现有主 spec 可正确合并
- [x] 1.2 明确仓库最终采用的 npm 通道映射，包括 `canary`、`alpha`、`next`、`latest` 的语义和安装说明
- [x] 1.3 确认 `main`、`next/*`、`release/*`、`hotfix/*` 的目标分支规则、前向同步规则和活跃分支数量约束

## 2. GitHub Actions 与发布脚本重构

- [x] 2.1 替换现有 `.github/workflows` 中基于 `main` 自动 prerelease 和基于 `v*` tag 正式发布的旧 workflow
- [x] 2.2 新增或重构 PR canary workflow，使其继续支持同仓库 PR 分支发布 `canary`
- [x] 2.3 新增或重构 `release/*` 分支 workflow，使其发布 MINOR beta 到 npm `next`
- [x] 2.4 新增或重构 `next/*` 分支 workflow，使其发布 MAJOR alpha 到 npm `alpha`
- [x] 2.5 新增或重构 `main` stable workflow，使其基于 merged release PR 路由 MAJOR、MINOR、PATCH 正式发布
- [x] 2.6 调整 `scripts/release/` 下的脚本，补充分支识别、版本线校验、stable 发布前校验和 tag / GitHub Release 自动创建逻辑
- [x] 2.7 增加从 `CHANGELOG.md` 提取当前版本章节并拼接 GitHub 自动 release notes 的能力，缺失章节时让正式发布失败
- [x] 2.8 更新 `package.json` 中与发布相关的脚本入口，移除只服务旧 tag 模型的命令

## 3. 仓库配置与维护者流程迁移

- [x] 3.1 更新 `README.md` 与 `docs/README.zh-CN.md`，重写维护者发布流程、分支职责和 npm 通道说明
- [x] 3.2 更新 `CONTRIBUTING.md` 与 `docs/CONTRIBUTING.zh-CN.md`，明确普通 feature PR 不再直接进入 `main`
- [x] 3.3 补充或更新发布 checklist，覆盖 release PR、changelog 更新、hotfix 前向同步和正式发布后的自动产物检查
- [ ] 3.4 在 GitHub 仓库设置中配置或确认 `main` 分支保护、release Environment 审批、Actions 权限和 npm trusted publishing

## 4. 验证与切换

- [x] 4.1 为新的 release 脚本补充或更新测试，覆盖 alpha、beta、canary、stable 的版本派生、changelog 提取与校验行为
- [ ] 4.2 在安全环境或测试仓库验证 PR canary、`release/*` beta、`next/*` alpha 的完整发布链路
- [ ] 4.3 验证 `hotfix/* -> main`、`release/* -> main`、`next/* -> main` 的 stable 发布、自动建 tag、自动建 GitHub Release
- [ ] 4.4 验证旧的 tag 触发正式发布入口已经被移除或失效，不会再造成误发布
