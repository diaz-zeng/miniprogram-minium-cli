## 1. Documentation Alignment

- [x] 1.1 更新 `README.md`，补充 `canary` / `next` / `latest` 三个发布通道的语义、安装方式与触发条件。
- [x] 1.2 更新 `docs/README.zh-CN.md`，同步维护者发布流程与“稳定基线已正式发布时拒绝 beta/canary”的规则。
- [x] 1.3 更新 `docs/CONTRIBUTING.zh-CN.md`，补充版本推进顺序和预发布失败时的操作指引。

## 2. OpenSpec Delta

- [x] 2.1 为 `npm-release-publishing` capability 新增规范增量，覆盖 PR canary 发布行为。
- [x] 2.2 为 `npm-release-publishing` capability 新增规范增量，要求在稳定基线版本已正式发布到 npm 时拒绝继续发布 beta / canary。
- [x] 2.3 复核现有主 spec，确认这次变更以新的 change 增量记录即可，不直接裸改主规范。
