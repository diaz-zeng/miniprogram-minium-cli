## ADDED Requirements

### Requirement: CLI execution engine SHALL create and manage acceptance sessions explicitly
系统 SHALL 提供显式的小程序验收会话创建与关闭能力，并为每个成功创建的会话分配唯一 `session_id`，供后续步骤复用。

#### Scenario: Start a session from a miniapp project path
- **WHEN** 执行计划提供本地小程序项目路径并请求启动会话
- **THEN** 系统 SHALL 完成开发者工具自动化端口准备、运行态附着和基础状态初始化
- **THEN** 系统 SHALL 返回唯一 `session_id` 与当前会话摘要

#### Scenario: Close an active session
- **WHEN** 执行计划请求关闭一个有效会话
- **THEN** 系统 SHALL 释放该会话对应的底层连接和内存资源
- **THEN** 后续针对该 `session_id` 的步骤 SHALL 返回会话不可用错误

### Requirement: Session-scoped steps SHALL require a valid session identifier
所有依赖运行态上下文的页面读取、交互、等待、断言、手势和取证步骤 MUST 要求有效的 `session_id`，并基于该会话执行。

#### Scenario: Execute a session-scoped step with a valid session
- **WHEN** 执行器使用有效 `session_id` 执行页面、动作、断言或手势步骤
- **THEN** 系统 SHALL 在该会话关联的小程序运行态上执行该步骤

#### Scenario: Execute a session-scoped step with an invalid session
- **WHEN** 执行器传入不存在、已关闭或已过期的 `session_id`
- **THEN** 系统 SHALL 返回 `SESSION_ERROR`
- **THEN** 错误结果 SHALL 说明该会话无效的原因

### Requirement: Session state SHALL preserve runtime context across plan steps
系统 SHALL 在会话生命周期内保留运行时上下文，至少包括最近页面路径、最后活跃时间、最近一次截图路径和最近一次失败摘要，以支持连续步骤执行。

#### Scenario: Context updates after successful steps
- **WHEN** 同一会话内连续执行页面读取、动作、截图或断言步骤
- **THEN** 系统 SHALL 更新该会话保存的最近上下文摘要
- **THEN** 后续步骤 SHALL 能读取到最新的会话状态

#### Scenario: Session expires after inactivity
- **WHEN** 会话空闲超过设定超时时间
- **THEN** 系统 SHALL 自动清理该会话占用的资源
- **THEN** 后续步骤 SHALL 收到会话已失效的结构化错误

### Requirement: Session management SHALL expose current page and evidence context
系统 SHALL 提供读取当前页面与基础证据上下文的能力，以便执行计划在不执行业务动作时也能判断当前运行态。

#### Scenario: Read current page from an active session
- **WHEN** 执行计划请求读取当前页面信息
- **THEN** 系统 SHALL 返回当前页面路径
- **THEN** 返回结果 SHALL 包含页面可读摘要或可用上下文信息

#### Scenario: Capture a screenshot from an active session
- **WHEN** 执行计划请求当前会话截图
- **THEN** 系统 SHALL 在本地产物目录下生成截图文件
- **THEN** 返回结果 SHALL 包含截图路径和所属 `session_id`

### Requirement: Session management SHALL remain bounded to acceptance-only semantics
系统 MUST 将会话管理边界限制在验收与测试范围内，不得通过会话能力暴露底层 Minium 对象、任意脚本执行入口或任意运行态修改接口。

#### Scenario: Request unsupported low-level runtime control
- **WHEN** 执行计划尝试访问未被允许的底层驱动对象或通用脚本执行能力
- **THEN** 系统 SHALL 拒绝该请求
- **THEN** 返回结果 SHALL 明确说明该请求超出验收型 CLI 的能力边界
