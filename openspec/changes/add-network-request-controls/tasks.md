## 1. 计划模型与校验扩展

- [x] 1.1 在 `src/plan.ts` 中新增网络相关 step 类型，并补充 `SUPPORTED_STEP_TYPES` 与必要的辅助集合
- [x] 1.2 为网络监听、等待、断言、拦截 step 增加结构化输入校验，覆盖 matcher、超时、计数和 mock 响应形状
- [x] 1.3 在 `docs/API_REFERENCE.md` 与 `docs/API_REFERENCE.zh-CN.md` 中补充网络 step 的输入字段、约束和示例

## 2. Python 执行引擎接线

- [x] 2.1 为 Python 侧定义会话级网络状态模型，覆盖监听器、拦截规则、网络事件和事件序号
- [x] 2.2 在执行引擎中新增网络相关 step 的分发逻辑，并保持现有错误码与步骤输出语义一致
- [x] 2.3 为网络监听、等待、断言、拦截增加服务层接口，复用统一 matcher 和证据摘要结构

## 3. Minium 运行时网络能力

- [x] 3.1 在 `MiniumRuntimeAdapter` 中增加网络观测与拦截接口，并明确 real runtime 与 placeholder runtime 的公共契约
- [x] 3.2 在 real runtime 中接入受控网络 hook，优先覆盖 `wx.request`，并支持透传、失败、延迟和 mock 响应
- [x] 3.3 为 `wx.uploadFile` 和 `wx.downloadFile` 增加请求观测与基础拦截支持，至少输出稳定的请求与结果摘要
- [x] 3.4 在 placeholder runtime 中实现内存态网络事件与拦截模拟，使 demo 与回归计划可在无真实后端时运行
- [x] 3.5 在会话关闭和运行结束路径中补充网络监听器与拦截规则的兜底清理

## 4. 运行产物与结果输出

- [x] 4.1 为网络相关步骤定义稳定的 `output` 结构，包含监听器 ID、命中统计、事件引用和拦截规则命中摘要
- [x] 4.2 在运行产物中新增 `network.json`，写入归一化网络事件、规则命中统计和字段裁剪说明
- [x] 4.3 更新 `summary.json`、`result.json` 和 `comparison.json` 的生成逻辑，使其引用网络产物并避免把易变字段直接写入 comparison 结果
- [x] 4.4 如有必要，补充 CLI 文本输出与 JSON 输出中的网络摘要字段，保证 CI 与脚本调用方可直接消费

## 5. 示例、测试与文档收尾

- [x] 5.1 为示例小程序补充可稳定触发网络请求的页面或交互，用于验证监听、断言和拦截场景
- [x] 5.2 新增或更新回归计划，覆盖“动作后是否发请求”“特定请求过滤”“失败注入”“mock 返回”“请求顺序/次数断言”等场景
- [x] 5.3 为 Node 侧计划校验与 Python 侧执行逻辑补充测试，至少覆盖非法 matcher、等待超时、mock 响应和自动清理规则
- [x] 5.4 更新 `README.md`、`docs/README.zh-CN.md` 与仓库内 skill 指南，说明网络能力的使用方式、限制和典型示例
