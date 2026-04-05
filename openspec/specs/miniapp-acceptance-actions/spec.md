# miniapp-acceptance-actions Specification

## Purpose
定义小程序验收执行中的核心交互能力，包括结构化定位、元素查询、点击、输入、等待与断言，并要求失败时返回统一的错误与取证结果。
## Requirements
### Requirement: Execution engine SHALL support structured element querying
系统 SHALL 提供结构化元素查询能力，使用可校验的定位器对象描述目标元素，而不是要求调用方直接操作底层元素句柄。

#### Scenario: Query elements with a supported locator
- **WHEN** 执行计划提供受支持的定位器对象查询元素
- **THEN** 系统 SHALL 返回可序列化的查询结果摘要
- **THEN** 查询结果 SHALL 至少包含匹配数量或首个匹配元素的关键信息

#### Scenario: Query elements with an unsupported locator type
- **WHEN** 执行计划提供当前版本不支持的定位器类型
- **THEN** 系统 SHALL 返回参数校验错误
- **THEN** 错误结果 SHALL 指明支持的定位器类型范围

### Requirement: Execution engine SHALL support core acceptance actions on queried targets
系统 SHALL 支持验收主链路所需的核心动作能力，至少包括点击、输入与基于会话的页面级读取，并在执行时使用会话上下文与结构化定位器。

#### Scenario: Click a target element successfully
- **WHEN** 执行计划提供有效 `session_id` 与可点击目标定位器并发起点击
- **THEN** 系统 SHALL 在该目标元素上执行点击动作
- **THEN** 返回结果 SHALL 说明动作执行成功

#### Scenario: Input text into a target element successfully
- **WHEN** 执行计划提供有效 `session_id`、目标定位器和输入文本并发起输入
- **THEN** 系统 SHALL 将文本输入到目标元素
- **THEN** 返回结果 SHALL 包含动作完成的确认信息

#### Scenario: Action target is not interactable
- **WHEN** 目标元素不存在、不可见或不可交互
- **THEN** 系统 SHALL 返回 `ACTION_ERROR`
- **THEN** 错误结果 SHALL 包含定位器摘要和失败原因

### Requirement: Execution engine SHALL support explicit waiting for acceptance conditions
系统 SHALL 提供等待条件成立的能力，以支持页面稳定、元素出现、元素可见或其他首期支持的验收条件。

#### Scenario: Wait succeeds before timeout
- **WHEN** 执行计划请求等待一个受支持的条件且该条件在超时前满足
- **THEN** 系统 SHALL 返回等待成功结果
- **THEN** 返回结果 SHALL 包含实际等待到的条件摘要

#### Scenario: Wait times out
- **WHEN** 执行计划请求等待一个受支持的条件但在超时前未满足
- **THEN** 系统 SHALL 返回 `ACTION_ERROR`
- **THEN** 错误结果 SHALL 标明超时并附带可用证据

### Requirement: Execution engine SHALL provide structured assertions for acceptance checks
系统 SHALL 提供结构化断言能力，至少覆盖页面路径、元素文本与元素存在性或可见性校验，并返回适合 CLI 测试结果汇总的断言结果。

#### Scenario: Assert current page path successfully
- **WHEN** 执行计划断言当前页面路径与期望值一致
- **THEN** 系统 SHALL 返回断言成功结果

#### Scenario: Assert element text successfully
- **WHEN** 执行计划断言某元素文本与期望值一致
- **THEN** 系统 SHALL 返回断言成功结果
- **THEN** 返回结果 SHALL 包含被校验的实际观测值摘要

#### Scenario: Assertion fails
- **WHEN** 页面路径、元素文本或可见性断言不成立
- **THEN** 系统 SHALL 返回 `ASSERTION_FAILED`
- **THEN** 错误结果 SHALL 同时包含期望值、实际值和证据路径

### Requirement: Action and assertion failures SHALL produce evidence artifacts automatically
系统 MUST 在动作失败、等待超时或断言失败时自动执行一次基础取证，并把证据路径与调试上下文纳入返回结果。

#### Scenario: Evidence is captured on assertion failure
- **WHEN** 任一断言失败
- **THEN** 系统 SHALL 自动生成截图或其他首期定义的证据产物
- **THEN** 返回结果 SHALL 包含证据文件路径

#### Scenario: Evidence is captured on action failure
- **WHEN** 点击、输入或等待动作失败
- **THEN** 系统 SHALL 返回包含 `error_code`、`message`、`details` 和 `artifacts` 的结构化错误
- **THEN** `details` SHALL 包含页面路径、定位器摘要或超时信息中的至少一部分
