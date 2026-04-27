# miniapp-network-observation Specification

## Purpose
定义执行引擎如何在小程序测试运行中观测、等待和断言网络请求与响应，并为步骤输出和运行产物提供稳定的网络证据模型。
## Requirements
### Requirement: Execution engine SHALL support structured network observation with filterable matchers
系统 SHALL 提供结构化网络观测能力，使执行计划能够在单次会话内监听出站请求与可用响应，并基于统一 matcher 对其进行过滤。

#### Scenario: Start observing requests with a matcher
- **WHEN** 执行计划启动一个网络监听步骤，并提供 URL、Method、query、headers、body 等任一过滤条件
- **THEN** 系统 SHALL 在当前会话内开始记录后续命中的网络事件
- **THEN** 监听结果 SHALL 以结构化方式标识监听器 ID、matcher 摘要和命中统计

#### Scenario: Observe all requests without a matcher
- **WHEN** 执行计划启动一个未提供过滤条件的网络监听步骤
- **THEN** 系统 SHALL 将该监听器视为匹配当前会话内的全部受支持网络请求
- **THEN** 后续断言或等待步骤 SHALL 能引用该监听器观察到的事件

### Requirement: Execution engine SHALL support waiting for matched network activity
系统 SHALL 支持等待匹配请求或响应出现，使计划能够把网络活动作为显式同步点，而不是依赖不稳定的固定等待时间。

#### Scenario: Wait for a matched request after a user action
- **WHEN** 某个用户动作之后，执行计划等待符合 matcher 的请求出现
- **THEN** 系统 SHALL 在超时时间内轮询或订阅匹配事件
- **THEN** 一旦命中，系统 SHALL 返回该次匹配的结构化证据摘要

#### Scenario: Waiting times out without a match
- **WHEN** 执行计划等待匹配请求或响应，但在指定超时时间内没有命中
- **THEN** 系统 SHALL 返回超时失败
- **THEN** 失败结果 SHALL 包含 matcher 摘要、超时时间和已观测到的相关事件计数

### Requirement: Execution engine SHALL support structured network assertions on requests and responses
系统 SHALL 支持对已观测网络事件进行结构化断言，至少覆盖“是否发生过任意请求”、“是否发生过特定请求”、“请求次数”、“请求顺序”以及在可用时对响应状态或响应内容的断言。

#### Scenario: Assert that any request happened after an action
- **WHEN** 执行计划在某个动作之后断言发生过任意网络请求
- **THEN** 系统 SHALL 判断该时间窗口内是否存在至少一个网络事件
- **THEN** 断言结果 SHALL 明确返回是否命中以及命中的事件数量

#### Scenario: Assert that a specific request matched expected fields
- **WHEN** 执行计划断言存在符合 URL、Method、query、headers 或 body 条件的特定请求
- **THEN** 系统 SHALL 基于统一 matcher 执行匹配
- **THEN** 断言结果 SHALL 返回命中的事件摘要，或在未命中时返回断言失败

#### Scenario: Assert request count or ordering
- **WHEN** 执行计划断言某类请求的命中次数、最小次数、最大次数或两个命中事件的先后顺序
- **THEN** 系统 SHALL 基于归一化事件序列计算这些条件
- **THEN** 若条件不满足，系统 SHALL 返回包含实际计数或实际顺序信息的断言失败

### Requirement: Execution engine SHALL expose normalized network evidence predictably
系统 SHALL 为网络观测结果提供稳定的结构化证据表示，使步骤输出、运行产物和后续断言消费相同的事件模型。

#### Scenario: Response details are available
- **WHEN** 运行时能够获取到匹配请求对应的响应状态码、响应头或响应体摘要
- **THEN** 系统 SHALL 将这些响应字段归一化后附加到网络事件证据中
- **THEN** 后续步骤 SHALL 能基于这些字段继续等待或断言

#### Scenario: Response details are not available
- **WHEN** 当前运行时无法稳定获取完整响应字段
- **THEN** 系统 SHALL 仍然输出请求级证据和可获得的最小响应摘要
- **THEN** 系统 SHALL 以结构化方式标明哪些响应字段不可用，而不是伪造空成功结果
