## MODIFIED Requirements

### Requirement: CLI SHALL persist execution artifacts by run
系统 SHALL 按运行维度落盘截图、调试上下文、结果摘要与网络证据，以支持故障排查与历史回放。

#### Scenario: Persist artifacts for a run
- **WHEN** 一次测试运行产生截图、错误详情、结果摘要或网络证据
- **THEN** 系统 SHALL 按运行标识将这些产物写入本地产物目录
- **THEN** 运行摘要 SHALL 包含主要产物的路径引用

#### Scenario: Persist network evidence for network-aware runs
- **WHEN** 一次测试运行使用了网络监听、网络等待、网络断言或请求拦截能力
- **THEN** 系统 SHALL 为该次运行落盘结构化网络证据产物
- **THEN** 结果中 SHALL 包含该网络证据产物的路径引用与稳定引用入口

#### Scenario: Run has no failure artifacts
- **WHEN** 一次测试运行成功完成且未产生失败截图
- **THEN** 系统 SHALL 仍然生成该次运行的摘要产物
- **THEN** 若本次运行存在网络证据，结果中 SHALL 明确区分通用产物、网络产物与失败证据是否存在

## ADDED Requirements

### Requirement: CLI SHALL persist normalized network artifacts with event logs and entity indexes
当一次运行使用了网络监听、网络等待、网络断言或请求拦截能力时，系统 SHALL 将 `network.json` 落盘为归一化的运行级网络产物，并在事件日志之外提供请求、监听器与拦截器索引。

#### Scenario: network.json exposes normalized event logs and indexes
- **WHEN** 一次 run 生成了 `network.json`
- **THEN** 该产物 SHALL 至少暴露 `schemaVersion`、`events`、`requests`、`listeners` 与 `intercepts`
- **THEN** `events` SHALL 记录请求/响应观测、监听器生命周期、拦截器生命周期以及网络相关 step 的命中或失败结果

#### Scenario: Clear or remove operations preserve historical network evidence
- **WHEN** 调用方执行 `network.listen.clear`、`network.intercept.remove` 或 `network.intercept.clear`
- **THEN** 系统 SHALL 仅更新当前缓存或 active 状态，并追加对应生命周期事件
- **THEN** 系统 SHALL 不删除先前已经产生并落入 `network.json` 的历史网络事件与实体索引

#### Scenario: Run-scoped network references remain unique across sessions
- **WHEN** 同一次 run 中有多个 session 贡献了网络证据
- **THEN** `network.json` 中对事件、请求、监听器和拦截器的公开引用 SHALL 在该 run 内保持唯一
- **THEN** 调用方 SHALL 能在不扫描嵌套 session 快照的前提下直接定位这些网络实体

### Requirement: CLI SHALL expose stable network evidence references from step results
网络相关 step 的结果 SHALL 通过稳定引用回链到 `network.json` 中的相关事件、请求、监听器或拦截器，而不是仅依赖分散的临时输出字段。

#### Scenario: Successful network step references network evidence
- **WHEN** 某个网络相关 step 成功命中请求、响应、监听器或拦截规则
- **THEN** 对应 step 结果 SHALL 包含 `details.networkEvidence`
- **THEN** 每条证据 SHALL 至少能够引用 `network.json` 路径以及相关的 `eventId`、`requestId`、`listenerId` 或 `interceptId`

#### Scenario: Failed network step preserves stable evidence when available
- **WHEN** 某个网络相关 step 失败，但失败过程仍然关联了已观测到的监听器、拦截器、请求或失败事件
- **THEN** 对应 step 结果 SHALL 仍然包含可用的 `details.networkEvidence`
- **THEN** 调用方 SHALL 能通过这些稳定引用跳回 `network.json` 继续分析失败上下文
