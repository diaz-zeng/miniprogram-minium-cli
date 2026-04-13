## 1. Release Workflow Foundations

- [x] 1.1 新增发布辅助脚本，用于计算 prerelease 版本并校验 tag 与 `package.json` 版本一致性。
- [x] 1.2 在 `package.json` 中补充与发布辅助脚本对应的可复用命令入口，便于本地调试和 CI 调用。
- [x] 1.3 为版本计算与版本校验逻辑补充自动化测试，覆盖稳定版本、非法 prerelease 基线和 tag 不一致场景。

## 2. Main Prerelease Publishing

- [x] 2.1 新增 `main` 分支 GitHub Actions workflow，在 push 到 `main` 时执行依赖安装、测试和构建。
- [x] 2.2 在 `main` workflow 中基于仓库稳定版本派生唯一 prerelease 版本，并确保该版本仅用于当前 CI 运行而不回写仓库。
- [x] 2.3 在 `main` workflow 中将派生版本发布到 npm `next` tag，并输出可追溯的版本信息。

## 3. Tagged Stable Publishing

- [x] 3.1 新增 `v*` tag 正式发布 workflow，在发布前校验 tag 与 `package.json` 版本完全一致。
- [x] 3.2 在正式发布 workflow 中执行依赖安装、测试、构建和 npm 正式发布，并优先使用 trusted publishing 所需权限配置。
- [x] 3.3 为正式发布失败场景补充清晰日志和错误提示，覆盖 tag 不匹配与认证缺失等常见问题。

## 4. Documentation And Release Process

- [x] 4.1 更新 `README.md` 与 `docs/README.zh-CN.md`，说明 prerelease / stable release 的触发方式、npm tag 语义与安装示例。
- [x] 4.2 更新贡献文档，说明“`package.json.version` 表示下一个正式版”的版本管理规则，以及正式发版后如何通过 PR 推进下一版本。
- [x] 4.3 记录 GitHub 与 npm 所需的仓库配置前置条件，包括 trusted publishing 或过渡认证方案。
