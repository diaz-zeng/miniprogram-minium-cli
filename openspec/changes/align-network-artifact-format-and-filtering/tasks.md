## 1. 网络产物模型重构

- [x] 1.1 在 Python 侧新增 run-level 网络产物构建逻辑，把当前 `sessions[]` 快照导出转换为 `schemaVersion`、`events`、`requests`、`listeners`、`intercepts`、`meta` 结构
- [x] 1.2 为请求观测、响应观测、监听器生命周期、拦截器生命周期和网络相关 step 命中/失败补充统一事件日志记录
- [x] 1.3 在导出层为事件、请求、监听器和拦截器生成 run-scoped 稳定引用，并保留 `sessionId` 以兼容低频多 session run

## 2. Step 结果与证据引用

- [x] 2.1 扩展执行结果模型，为网络相关 step 增加 `details.networkEvidence`，同时保持现有 `stepResults[].output` 兼容字段不变
- [x] 2.2 为 `network.wait`、`assert.networkRequest`、`assert.networkResponse`、`network.listen.*`、`network.intercept.*` 成功与失败路径补充稳定的网络证据引用
- [x] 2.3 更新 `result.json`、`summary.json` 与 `comparison.json` 的生成逻辑，使其引用新的网络产物结构并排除易变的网络证据字段

## 3. Skill 过滤脚本与分析路径

- [x] 3.1 在 `skills/miniprogram-minium-cli/scripts/` 下新增 `filter-network-artifact.mjs`，支持 `--result`、`--network`、`--step-id` 与 `--pretty`
- [x] 3.2 让过滤脚本默认从 `result.json` 和 `details.networkEvidence` 推导相关网络子图，并输出低噪音的 `events`、`requests`、`listeners`、`intercepts` 与 `meta`
- [x] 3.3 更新 `skills/miniprogram-minium-cli/SKILL.md` 与 `references/run-analysis.md`，把“`result.json` -> `networkEvidence` -> filter helper -> full network.json`”写成默认分析流程

## 4. 文档、示例与回归验证

- [x] 4.1 更新 `README.md`、`docs/README.zh-CN.md`、`docs/API_REFERENCE.md` 与 `docs/API_REFERENCE.zh-CN.md`，说明新的 `network.json` 结构、`details.networkEvidence` 和过滤脚本用法
- [x] 4.2 更新现有 CLI / smoke 测试，覆盖新的 `network.json` 形状、稳定网络证据引用和清理操作不删除历史网络证据的行为
- [x] 4.3 为过滤脚本补充测试，覆盖默认 step 选择、显式 `--step-id`、显式 `--network`、缺少 `networkEvidence` 和低频多 session 引用场景
