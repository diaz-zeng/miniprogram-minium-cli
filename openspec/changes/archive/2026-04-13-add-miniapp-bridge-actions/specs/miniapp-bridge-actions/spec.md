## ADDED Requirements

### Requirement: Execution engine SHALL support structured storage bridge actions
系统 SHALL 提供结构化存储桥接动作，以便执行计划可以直接读写、删除、清空和查询小程序本地存储，而不依赖页面间接行为。

#### Scenario: Set and get a storage value
- **WHEN** 执行计划请求写入一个结构化存储键值并随后读取该键
- **THEN** 系统 SHALL 通过受控桥接动作完成存储写入与读取
- **THEN** 返回结果 SHALL 包含被写入或读取的键摘要与可序列化结果

#### Scenario: Remove or clear storage
- **WHEN** 执行计划请求删除指定键或清空全部本地存储
- **THEN** 系统 SHALL 执行对应的存储桥接动作
- **THEN** 返回结果 SHALL 明确说明目标键或存储空间已被移除或清空

### Requirement: Execution engine SHALL support structured navigation bridge actions
系统 SHALL 提供结构化路由桥接动作，以便执行计划可直接触发小程序页面跳转与回退，并与当前会话页面状态保持一致。

#### Scenario: Navigate to a target page
- **WHEN** 执行计划请求执行 `navigateTo`、`redirectTo`、`reLaunch` 或 `switchTab` 类桥接动作
- **THEN** 系统 SHALL 触发目标路由动作
- **THEN** 返回结果 SHALL 包含更新后的当前页面路径或路由结果摘要

#### Scenario: Navigate back from the current page
- **WHEN** 执行计划请求执行结构化回退动作
- **THEN** 系统 SHALL 触发页面回退并更新会话中的最近页面路径
- **THEN** 若回退未发生，系统 SHALL 返回结构化动作失败信息

### Requirement: Execution engine SHALL support structured app context bridge actions
系统 SHALL 提供应用上下文桥接动作，以便执行计划读取启动参数、系统信息和账号信息等非 UI 状态。

#### Scenario: Read launch options and system information
- **WHEN** 执行计划请求读取启动参数或系统信息
- **THEN** 系统 SHALL 返回可序列化的启动参数或系统信息摘要
- **THEN** 返回结果 SHALL 适合被后续计划步骤或断言消费

#### Scenario: Read account information
- **WHEN** 执行计划请求读取账号信息
- **THEN** 系统 SHALL 返回当前运行态可用的账号信息摘要
- **THEN** 不可用字段 SHALL 以结构化方式留空或省略，而不是返回原始驱动对象

### Requirement: Execution engine SHALL support structured settings and clipboard bridge actions
系统 SHALL 提供结构化设置、授权与剪贴板桥接动作，使计划能够读取设置、请求授权、打开设置页以及读写剪贴板内容。

#### Scenario: Read settings or request authorization
- **WHEN** 执行计划请求读取当前设置状态或触发授权相关桥接动作
- **THEN** 系统 SHALL 返回结构化设置结果或授权结果摘要
- **THEN** 对于权限拒绝、未支持或前置条件缺失的情况，系统 SHALL 返回 `ACTION_ERROR`

#### Scenario: Set and get clipboard content
- **WHEN** 执行计划请求写入或读取剪贴板内容
- **THEN** 系统 SHALL 执行相应的剪贴板桥接动作
- **THEN** 返回结果 SHALL 包含结构化文本摘要或读取结果

### Requirement: Execution engine SHALL support structured feedback UI bridge actions
系统 SHALL 提供结构化反馈 UI 桥接动作，以便执行计划显式触发和关闭 toast、loading、modal 或 action sheet 等基础反馈界面。

#### Scenario: Show transient feedback UI
- **WHEN** 执行计划请求显示 toast 或 loading
- **THEN** 系统 SHALL 触发对应反馈 UI
- **THEN** 返回结果 SHALL 包含动作成功摘要与相关输入参数摘要

#### Scenario: Control modal or action sheet feedback
- **WHEN** 执行计划请求显示或处理 modal、action sheet 等反馈界面
- **THEN** 系统 SHALL 以结构化方式执行对应桥接动作
- **THEN** 结果 SHALL 反映已触发的反馈类型与已知选择结果

### Requirement: Execution engine SHALL support structured bridge actions for location, media, file, device, auth, and subscription flows
系统 SHALL 为中优先级基础能力提供结构化桥接动作，至少覆盖位置、媒体选择、文件传输、图片处理、设备交互、登录会话与订阅消息等领域。

#### Scenario: Execute a location or device bridge action
- **WHEN** 执行计划请求获取位置、选择位置、打开地图、扫码或拨打电话等结构化桥接动作
- **THEN** 系统 SHALL 执行对应桥接动作并返回结构化结果
- **THEN** 返回结果 SHALL 包含关键业务字段或失败摘要

#### Scenario: Execute a media or file bridge action
- **WHEN** 执行计划请求选择图片、选择媒体、拍照、上传文件、下载文件或获取图片信息
- **THEN** 系统 SHALL 执行对应桥接动作
- **THEN** 对于异步结果，系统 SHALL 返回稳定的结构化完成结果或超时失败

#### Scenario: Execute an auth or subscription bridge action
- **WHEN** 执行计划请求执行登录、会话校验或订阅消息桥接动作
- **THEN** 系统 SHALL 返回结构化登录、会话或订阅结果
- **THEN** 结果 SHALL 不泄漏底层驱动对象或未经约束的原始回包

### Requirement: Bridge-backed actions MUST remain bounded to structured miniapp testing semantics
系统 MUST 将桥接能力限制为已声明的结构化步骤与白名单方法，不得向执行计划暴露原始 `call_wx_method`、原始 `call_wx_method_async`、任意方法名透传或任意脚本执行能力。

#### Scenario: Plan requests a raw wx bridge method call
- **WHEN** 执行计划尝试直接调用原始桥接方法或传入任意方法名
- **THEN** 系统 SHALL 拒绝该请求
- **THEN** 返回结果 SHALL 明确说明需要使用受支持的结构化步骤类型

#### Scenario: Bridge action uses unsupported parameters
- **WHEN** 执行计划为结构化桥接步骤提供不符合 schema 的参数
- **THEN** 系统 SHALL 返回 `PLAN_ERROR`
- **THEN** 错误结果 SHALL 指明非法字段、缺失字段或不受支持的输入形状

### Requirement: Repository SHALL provide demo scenarios and runnable plans for bridge-backed actions
仓库 SHALL 在示例小程序和示例 regression plans 中提供与桥接能力对应的演示场景、用户可见状态和可执行计划，以支持本地验证与回归运行。

#### Scenario: Add demo coverage for high-priority bridge actions
- **WHEN** 仓库接入高优先级桥接能力
- **THEN** 示例小程序 SHALL 提供对应页面状态或交互场景
- **THEN** 示例 regression plans SHALL 提供覆盖这些能力的可执行计划

#### Scenario: Add demo coverage for medium-priority bridge actions
- **WHEN** 仓库接入中优先级桥接能力
- **THEN** 示例小程序 SHALL 提供对应页面状态或交互场景
- **THEN** 示例 regression plans SHALL 提供覆盖这些能力的可执行计划或受限说明

### Requirement: Execution engine SHALL skip AppID-restricted bridge scenarios under touristappid
对于显式声明需要开发者自有 AppID 的桥接场景或计划，系统 SHALL 在检测到目标项目仍使用 `touristappid` 时返回跳过结果，而不是继续执行并产生误导性失败。

#### Scenario: Skip an AppID-restricted bridge scenario under touristappid
- **WHEN** 执行计划中的桥接步骤或场景声明需要开发者自有 AppID，且目标项目 `project.config.json` 中的 `appid` 为 `touristappid`
- **THEN** 系统 SHALL 将该步骤或场景标记为跳过
- **THEN** 运行摘要 SHALL 记录跳过原因与受限能力说明

#### Scenario: Execute an AppID-restricted bridge scenario under a developer-owned AppID
- **WHEN** 执行计划中的桥接步骤或场景声明需要开发者自有 AppID，且目标项目不使用 `touristappid`
- **THEN** 系统 SHALL 正常执行该步骤或场景
- **THEN** 结果 SHALL 按对应桥接动作的成功或失败语义返回
