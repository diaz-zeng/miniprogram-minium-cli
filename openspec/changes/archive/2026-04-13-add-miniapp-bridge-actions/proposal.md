## Why

当前 CLI 只暴露了页面、元素、等待、断言、手势和截图等验收型步骤，但底层 Minium 已具备通过 `call_wx_method` / `call_wx_method_async` 触达更多小程序基础能力的条件。随着测试场景扩展到存储、路由、权限、剪贴板、位置、媒体和文件等领域，需要把这些高频基础能力沉淀为结构化步骤，而不是继续依赖 UI 间接触发或暴露底层通用桥接接口。

## What Changes

- 新增一组由 Minium `wx` 方法桥接支撑的结构化基础能力，覆盖高优先级和中优先级能力范围。
- 为这些能力定义稳定的步骤类型、输入输出模型、错误语义与适配边界。
- 明确同步类与异步类能力的接入策略，避免把 CLI 扩展成任意运行时控制入口。
- 在示例小程序中补齐这些桥接能力对应的页面场景、说明文档和可执行测试 plan。
- 为依赖开发者自有 AppID 的桥接场景提供 `touristappid` 检测与自动跳过语义，避免在受限运行态下产生误导性失败。
- 为计划校验、执行摘要、文档和测试基线预留统一扩展点。
- 同步更新仓库内 product-use skill，使 agent 能基于结构化步骤正确使用新增桥接能力，而不是依赖零散提示词猜测用法。

## Capabilities

### New Capabilities
- `miniapp-bridge-actions`: 提供基于底层 `wx` 方法桥接的结构化小程序基础动作，包括高优先级与中优先级基础能力分组。

### Modified Capabilities

## Impact

- `src/plan.ts` 中的步骤类型白名单与计划校验逻辑
- `docs/API_REFERENCE.md` 与 `docs/API_REFERENCE.zh-CN.md`
- `skills/miniprogram-minium-cli/` 下与 plan 编写、执行和结果分析相关的引用资料
- Python 执行引擎、动作模型与 Minium 运行时适配层
- `examples/demo-miniapp` 中的桥接能力演示页面、场景说明与受限场景标注
- `examples/demo-regression` 中覆盖桥接能力的测试 plan 与运行说明
- 运行结果输出、错误摘要与测试覆盖
