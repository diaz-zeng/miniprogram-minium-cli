# miniapp-acceptance-gestures Specification

## Purpose
定义面向验收场景的基础触点手势能力，覆盖状态化单指、多指交互、目标解析与失败证据要求，使复杂触摸操作可以通过结构化计划稳定复用。
## Requirements
### Requirement: Execution engine SHALL expose basic gesture primitives for acceptance flows
系统 SHALL 为 CLI 执行计划暴露最小可行的触点原语，以支持跨多个步骤组合小程序复合手势，而不要求调用方直接构造底层 Minium 事件对象。

#### Scenario: Start and hold a pointer on a target
- **WHEN** 执行计划提供有效 `session_id`、`pointer_id` 和合法目标并调用 `touch_start`
- **THEN** 系统 SHALL 在该目标上创建一个处于按下状态的活跃触点
- **THEN** 返回结果 SHALL 包含该触点摘要和当前活跃触点集合摘要

#### Scenario: Move an active pointer
- **WHEN** 执行计划提供有效 `session_id`、已处于按下状态的 `pointer_id` 和合法移动目标并调用 `touch_move`
- **THEN** 系统 SHALL 基于该会话的活跃触点状态执行移动
- **THEN** 返回结果 SHALL 包含更新后的触点位置摘要和当前活跃触点集合摘要

#### Scenario: Release an active pointer
- **WHEN** 执行计划提供有效 `session_id` 和已处于按下状态的 `pointer_id` 并调用 `touch_end`
- **THEN** 系统 SHALL 结束该触点并将其从活跃触点集合中移除
- **THEN** 返回结果 SHALL 反映该触点已释放后的活跃触点集合摘要

#### Scenario: Tap a target with a secondary pointer while another pointer remains active
- **WHEN** 执行计划在同一会话中保持一个触点仍处于按下状态，并使用另一个 `pointer_id` 调用 `touch_tap`
- **THEN** 系统 SHALL 在不释放已有活跃触点的前提下完成第二个触点的点击
- **THEN** 返回结果 SHALL 说明已有活跃触点仍被保留

### Requirement: Gesture operations SHALL support high-level target resolution
系统 SHALL 允许手势原语使用高层目标参数，而不是要求调用方直接提交底层 `touches` 或 `changedTouches` 结构。

#### Scenario: Resolve a locator target for a gesture
- **WHEN** 执行计划使用结构化定位器作为 `touch_start`、`touch_move` 或 `touch_tap` 的目标
- **THEN** 系统 SHALL 将该目标解析为可执行的页面位置
- **THEN** 返回结果 SHALL 包含解析后的目标摘要

#### Scenario: Resolve absolute coordinates for a gesture
- **WHEN** 执行计划使用页面绝对坐标作为 `touch_move` 或 `touch_tap` 的目标
- **THEN** 系统 SHALL 直接基于该坐标执行手势
- **THEN** 返回结果 SHALL 回显被执行的坐标摘要

### Requirement: Gesture capability SHALL preserve bounded multi-pointer semantics
系统 MUST 将首期手势能力限制在验收语义下的基础触点原语和最多两指的复合交互，不得把 CLI 扩展为任意事件脚本执行器。

#### Scenario: Reject unsupported raw event injection
- **WHEN** 执行计划试图直接提交底层事件数组、原始 `touches` 或 `changedTouches`，或提交任意手势脚本
- **THEN** 系统 SHALL 拒绝该请求
- **THEN** 返回结果 SHALL 说明该请求超出当前手势能力边界

#### Scenario: Reject more than two active pointers
- **WHEN** 执行计划在同一会话中尝试创建超过两个同时处于按下状态的活跃触点
- **THEN** 系统 SHALL 返回结构化错误
- **THEN** 错误结果 SHALL 说明当前版本仅支持两指以内的复合交互

### Requirement: Gesture failures SHALL provide structured evidence and pointer context
系统 MUST 在手势动作失败时同时提供截图证据和触点上下文摘要，以支持排查复杂交互失败原因。

#### Scenario: Gesture target cannot be resolved or executed
- **WHEN** `touch_start`、`touch_move`、`touch_end` 或 `touch_tap` 因目标无效、触点状态不一致或底层执行失败而失败
- **THEN** 系统 SHALL 返回 `ACTION_ERROR`
- **THEN** 错误结果 SHALL 包含 `pointer_id`、事件类型、活跃触点摘要和证据路径中的至少一部分

#### Scenario: Gesture failure captures screenshot evidence
- **WHEN** 任一手势动作失败
- **THEN** 系统 SHALL 自动生成截图或其他首期定义的证据产物
- **THEN** 返回结果 SHALL 包含对应的证据文件路径
