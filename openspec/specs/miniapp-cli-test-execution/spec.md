# miniapp-cli-test-execution Specification

## Purpose
定义 CLI 如何把结构化计划执行为一次完整测试运行，包括执行顺序、运行摘要、产物落盘、退出码和托管运行时准备，以支撑脚本化和 CI 场景中的重复调用。
## Requirements
### Requirement: CLI SHALL execute a test plan as an ordered run
系统 SHALL 将一个结构化计划作为一次有序测试运行执行，并按步骤顺序推进会话、动作、断言、手势与取证能力。

#### Scenario: Execute a single plan successfully
- **WHEN** 用户请求执行一个合法计划且所有步骤都成功完成
- **THEN** 系统 SHALL 按计划顺序执行全部步骤
- **THEN** 系统 SHALL 返回该次运行成功的执行摘要

#### Scenario: A plan step fails during execution
- **WHEN** 某一步骤在执行期间发生动作失败、断言失败或环境错误
- **THEN** 系统 SHALL 停止或按计划中的失败策略处理后续步骤
- **THEN** 系统 SHALL 在运行摘要中记录失败步骤、错误类别和相关证据

### Requirement: CLI SHALL produce a structured run summary and deterministic exit code
系统 SHALL 为每次测试运行生成结构化执行摘要，并通过明确退出码表达最终运行状态。

#### Scenario: Run completes successfully
- **WHEN** 一次测试运行中的所有步骤均成功
- **THEN** 系统 SHALL 生成包含步骤统计、耗时和产物位置的运行摘要
- **THEN** CLI 进程 SHALL 以成功退出码结束

#### Scenario: Run completes with assertion or action failure
- **WHEN** 一次测试运行出现断言失败、动作失败或等待超时
- **THEN** 系统 SHALL 生成包含失败步骤摘要和证据路径的运行摘要
- **THEN** CLI 进程 SHALL 以与失败类别对应的非零退出码结束

### Requirement: CLI SHALL persist execution artifacts by run
系统 SHALL 按运行维度落盘截图、调试上下文和结果摘要，以支持故障排查与历史回放。

#### Scenario: Persist artifacts for a run
- **WHEN** 一次测试运行产生截图、错误详情或结果摘要
- **THEN** 系统 SHALL 按运行标识将这些产物写入本地产物目录
- **THEN** 运行摘要 SHALL 包含主要产物的路径引用

#### Scenario: Run has no failure artifacts
- **WHEN** 一次测试运行成功完成且未产生失败截图
- **THEN** 系统 SHALL 仍然生成该次运行的摘要产物
- **THEN** 结果中 SHALL 明确区分通用产物与失败证据是否存在

### Requirement: CLI execution SHALL support scripted and repeated invocation
系统 SHALL 支持从脚本、批处理或 CI 中重复调用相同计划，而不要求人工交互才能完成执行。

#### Scenario: Run the same plan multiple times
- **WHEN** 上层脚本多次调用同一个计划文件执行
- **THEN** 系统 SHALL 在每次运行中独立生成新的运行标识和产物目录
- **THEN** 各次运行的执行结果 SHALL 可被单独追踪和比较

#### Scenario: Run in a non-interactive environment
- **WHEN** CLI 在非交互式终端或 CI 环境中执行计划
- **THEN** 系统 SHALL 在不依赖人工确认的前提下完成计划执行
- **THEN** 系统 SHALL 通过标准输出摘要、结果文件和退出码暴露执行结果

### Requirement: CLI SHALL manage a private `uv`-backed Python runtime for execution
系统 SHALL 以 CLI 私有托管方式通过 `uv` 准备和使用 Python 执行运行时，使用户无需手动管理全局 Python 环境，且不会污染用户机器上的全局解释器或包安装状态。

#### Scenario: Lazily prepare a managed runtime on first execution
- **WHEN** CLI 首次执行需要 Python 内核且本地尚未存在可复用的托管运行时
- **THEN** 系统 SHALL 在 CLI 自身的用户级缓存目录中准备 `uv`、托管 Python 与项目环境
- **THEN** 系统 SHALL 仅让当前 CLI 执行链路使用该运行时

#### Scenario: Reuse the managed runtime on later executions
- **WHEN** CLI 再次执行且检测到兼容的托管运行时已存在
- **THEN** 系统 SHALL 复用该托管运行时
- **THEN** 系统 SHALL 不要求用户重新安装或重新配置全局 Python 环境

#### Scenario: Warm up the managed runtime explicitly
- **WHEN** 用户执行 CLI 提供的运行时预热命令
- **THEN** 系统 SHALL 提前准备 `uv`、托管 Python 与项目环境
- **THEN** 系统 SHALL 不要求用户立即执行真实测试计划

#### Scenario: Reject configured managed Python version below 3.11
- **WHEN** CLI 的托管 Python 版本请求被配置为低于 3.11
- **THEN** 系统 SHALL 拒绝按该配置准备运行时
- **THEN** 系统 SHALL 明确提示需要 Python 3.11 或更高版本

#### Scenario: Managed runtime does not modify the global environment
- **WHEN** CLI 准备或使用托管 Python 运行时
- **THEN** 系统 SHALL 不修改用户全局 `PATH`、全局 `python`、全局 `pip` 或 shell 配置
- **THEN** 系统 SHALL 不把依赖安装到用户全局 Python 包目录

### Requirement: CLI execution SHALL clean up runtime resources predictably
系统 SHALL 在测试运行结束时以可预测方式清理会话和底层资源，避免污染后续执行。

#### Scenario: Plan explicitly closes the session
- **WHEN** 计划中包含显式关闭会话的步骤且该步骤成功执行
- **THEN** 系统 SHALL 释放相关运行时资源
- **THEN** 运行摘要 SHALL 反映该会话已被正常关闭

#### Scenario: Plan exits without an explicit close step
- **WHEN** 计划执行结束时仍存在未关闭的活跃会话
- **THEN** 系统 SHALL 执行兜底资源清理
- **THEN** 运行摘要 SHALL 标记该会话是被自动清理还是因错误而残留
