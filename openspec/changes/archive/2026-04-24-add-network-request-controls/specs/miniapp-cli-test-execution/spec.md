## MODIFIED Requirements

### Requirement: CLI SHALL produce a structured run summary and deterministic exit code
系统 SHALL 为每次测试运行生成结构化执行摘要，并通过明确退出码表达最终运行状态；当执行涉及网络监听、网络断言或请求拦截时，运行摘要 SHALL 同步暴露网络相关统计、失败信息或产物引用，以便脚本、CI 和调试工具稳定消费。

#### Scenario: Run completes successfully
- **WHEN** 一次测试运行中的所有步骤均成功
- **THEN** 系统 SHALL 生成包含步骤统计、耗时和产物位置的运行摘要
- **THEN** 若本次运行包含网络相关步骤，运行摘要 SHALL 额外包含网络事件统计或对应产物引用
- **THEN** CLI 进程 SHALL 以成功退出码结束

#### Scenario: Run completes with assertion or action failure
- **WHEN** 一次测试运行出现断言失败、动作失败或等待超时
- **THEN** 系统 SHALL 生成包含失败步骤摘要和证据路径的运行摘要
- **THEN** 若失败与网络等待、网络断言或网络拦截有关，运行摘要 SHALL 标识对应网络失败上下文
- **THEN** CLI 进程 SHALL 以与失败类别对应的非零退出码结束

### Requirement: CLI SHALL persist execution artifacts by run
系统 SHALL 按运行维度落盘截图、调试上下文、网络证据和结果摘要，以支持故障排查与历史回放。

#### Scenario: Persist artifacts for a run
- **WHEN** 一次测试运行产生截图、错误详情、网络事件或结果摘要
- **THEN** 系统 SHALL 按运行标识将这些产物写入本地产物目录
- **THEN** 运行摘要 SHALL 包含主要产物的路径引用

#### Scenario: Persist network evidence for network-aware runs
- **WHEN** 一次测试运行使用了网络监听、网络断言或请求拦截能力
- **THEN** 系统 SHALL 为该次运行落盘结构化网络证据产物
- **THEN** 结果中 SHALL 包含网络证据路径或稳定引用，以便后续调试与机器消费

#### Scenario: Run has no failure artifacts
- **WHEN** 一次测试运行成功完成且未产生失败截图
- **THEN** 系统 SHALL 仍然生成该次运行的摘要产物
- **THEN** 若本次运行存在网络证据，结果中 SHALL 明确区分通用产物、网络产物与失败证据是否存在
