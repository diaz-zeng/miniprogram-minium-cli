## Why

当前 `network.json` 主要以 session 内事件快照的方式暴露网络证据，缺少按 `requestId`、`listenerId`、`interceptId` 追踪完整上下文的稳定索引；当一次 run 中存在与当前分析目标无关的请求时，agent 直接分析全量产物会引入明显噪音。随着网络监听、断言和拦截已经成为常见调试路径，我们需要把网络产物升级为更稳定、更易过滤的结构，并为 product-use skill 提供默认的低噪音分析入口。

## What Changes

- **BREAKING** 将当前以 `sessionCount/eventCount/sessions[]` 为主的 `network.json` 结构，重构为带 `schemaVersion` 的事件日志加实体索引格式，使调用方可以稳定地从 `events`、`requests`、`listeners`、`intercepts` 追踪网络事实。
- 扩展网络相关步骤与运行产物之间的引用关系，使 `result.json` 中的网络证据能够稳定回链到新的 `network.json` 结构，而不要求调用方先扫描整份全量事件列表。
- 在 repository-managed product-use skill 中新增网络产物过滤脚本，默认从 `result.json` 和 step 级网络证据推导低噪音的网络子图，再按需回退到完整 `network.json`。
- 更新 skill 主入口、引用资料、CLI 文档和测试，使“先看结构化结果，再用过滤脚本缩小范围，最后才查看完整网络产物”的分析路径成为文档化默认流程。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `miniapp-cli-test-execution`: 扩展网络相关运行产物契约，要求网络感知型 run 产出带稳定引用和实体索引的 `network.json`，并使相关步骤结果能够回链到该产物中的关键网络实体。
- `cli-agent-skills`: 扩展 repository-managed skill 的产物分析指导，要求 agent 在分析网络失败时优先使用仓库内置的过滤脚本获得低噪音视图，而不是直接读取完整 `network.json`。

## Impact

- `python/miniprogram_minium_cli/` 下的网络状态模型、运行时观测逻辑、执行结果聚合与 `network.json` 落盘逻辑。
- `result.json` / `network.json` 的结构化字段、相关 CLI 文档，以及依赖当前网络产物形状的测试与示例。
- `skills/miniprogram-minium-cli/` 下的主 skill、引用资料与新增网络过滤脚本。
- 对现有网络产物消费者的兼容性评估，因为 `network.json` 的顶层结构与引用方式会发生变化。
