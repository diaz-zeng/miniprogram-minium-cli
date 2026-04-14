## ADDED Requirements

### Requirement: Execution engine SHALL support structured network interception rules with explicit scope
系统 SHALL 支持结构化网络拦截规则，使执行计划能够在当前会话内按 matcher 注册、移除和清理拦截器，而不依赖外部代理或全局 mock 服务。

#### Scenario: Register an interception rule for a matched request
- **WHEN** 执行计划添加一个带有 matcher 的网络拦截规则
- **THEN** 系统 SHALL 返回该规则的显式标识、作用域摘要和生效状态
- **THEN** 后续命中该 matcher 的请求 SHALL 按该规则处理

#### Scenario: Remove or clear interception rules
- **WHEN** 执行计划移除指定拦截规则或清空当前会话中的全部拦截规则
- **THEN** 系统 SHALL 停止对这些规则后续命中的请求应用拦截行为
- **THEN** 返回结果 SHALL 明确说明被移除的规则数量或规则标识

### Requirement: Execution engine SHALL support deterministic interception outcomes
系统 SHALL 对命中拦截规则的请求提供确定性的处理结果，至少包括透传、强制失败、人工延迟和直接返回 mock 响应。

#### Scenario: Continue a matched request without mutation
- **WHEN** 某个请求命中“透传”型拦截规则
- **THEN** 系统 SHALL 允许该请求继续执行真实网络流程
- **THEN** 拦截结果 SHALL 记录该规则已命中但未改写最终响应

#### Scenario: Fail or delay a matched request
- **WHEN** 某个请求命中“失败注入”或“延迟注入”型拦截规则
- **THEN** 系统 SHALL 分别返回结构化失败结果或在指定延迟后再继续后续处理
- **THEN** 网络事件证据 SHALL 记录命中的规则和最终处理结果

#### Scenario: Fulfill a matched request with mock data
- **WHEN** 某个请求命中“mock 响应”型拦截规则
- **THEN** 系统 SHALL 直接返回结构化 mock 响应，而不依赖真实后端返回
- **THEN** 响应证据 SHALL 包含 mock 状态码、headers 与 body 摘要

### Requirement: Interception lifecycle SHALL remain bounded to the active session and run
系统 SHALL 将网络拦截规则限制在当前活跃会话与当前运行内，避免跨会话、跨运行污染后续测试。

#### Scenario: Close a session with active interception rules
- **WHEN** 会话关闭时仍存在活跃的网络拦截规则
- **THEN** 系统 SHALL 自动清理这些规则
- **THEN** 后续新会话 SHALL 不继承上一个会话的拦截配置

#### Scenario: Run ends without explicitly clearing interception rules
- **WHEN** 一次执行结束时仍存在未显式清理的拦截规则
- **THEN** 系统 SHALL 在运行结束清理阶段移除这些规则
- **THEN** 运行摘要或网络产物 SHALL 记录这些规则已被自动清理

### Requirement: Network interception MUST remain within structured testing semantics
系统 MUST 将网络拦截能力限制在声明式、结构化的测试语义内，不得向计划暴露任意脚本回调、任意请求改写函数或任意代理配置透传。

#### Scenario: Plan requests an arbitrary interception callback
- **WHEN** 执行计划尝试传入任意脚本、函数体或未声明的动态逻辑用于处理匹配请求
- **THEN** 系统 SHALL 拒绝该请求
- **THEN** 错误结果 SHALL 明确说明只能使用受支持的结构化拦截动作

#### Scenario: Plan requests unsupported mock response fields
- **WHEN** 执行计划为 mock 响应提供不受支持的字段或不合法的输入形状
- **THEN** 系统 SHALL 返回 `PLAN_ERROR`
- **THEN** 错误结果 SHALL 指明非法字段、缺失字段或不受支持的 mock 结构
