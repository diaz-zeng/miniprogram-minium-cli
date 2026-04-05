## 1. 搭建标准 skill 目录

- [x] 1.1 在仓库下创建标准目录 `skills/miniprogram-minium-cli/`
- [x] 1.2 在 `skills/miniprogram-minium-cli/` 中创建主入口文件 `SKILL.md`
- [x] 1.3 在 `skills/miniprogram-minium-cli/` 中创建 `references/` 目录用于渐进式披露资料
- [x] 1.4 评估并决定首版同时生成 `agents/openai.yaml`

## 2. 编写主 skill 入口

- [x] 2.1 编写 `SKILL.md` 的 frontmatter，明确 skill 名称和触发描述
- [x] 2.2 在 `SKILL.md` 中写明这是面向 `miniprogram-minium-cli` 的产品使用类 skill
- [x] 2.3 在 `SKILL.md` 中写明执行层边界，禁止把 CLI 当作 planner、MCP endpoint 或任意命令执行器
- [x] 2.4 在 `SKILL.md` 中写明渐进式披露规则，按任务类型引导读取对应 `references/` 文件

## 3. 补充按场景拆分的引用资料

- [x] 3.1 新增运行时准备引用资料，说明何时以及如何使用已文档化的运行时准备流程
- [x] 3.2 新增 plan 编写与校验引用资料，说明如何依据 README、API 文档和示例生成合法 plan
- [x] 3.3 新增执行引用资料，说明如何使用已文档化的 `exec` 工作流执行 plan
- [x] 3.4 新增结果分析引用资料，说明如何优先读取 `summary.json`、`result.json`、`comparison.json` 与截图
- [x] 3.5 新增 skill 安装引用资料，说明如何使用 `install --skills` 安装随包 skill

## 4. 提供 CLI 安装入口

- [x] 4.1 为 CLI 新增 `install --skills` 命令解析与帮助输出
- [x] 4.2 实现 bundled skill 的默认安装目录解析，默认落在当前执行目录下的 `./.agents/skills`
- [x] 4.3 实现 `--path <path>` 覆盖默认安装根目录
- [x] 4.4 实现 `--json` 安装结果输出，返回目标目录和已安装 skill 路径
- [x] 4.5 将 `skills/` 目录纳入 npm 包分发内容

## 5. 对齐仓库文档与规范

- [x] 5.1 更新 `AGENTS.md`，说明该 product-use skill 的定位与边界
- [x] 5.2 更新 `README.md` 与 `docs/README.zh-CN.md`，补充 skill 安装与使用入口
- [x] 5.3 更新 `docs/API_REFERENCE.md` 与 `docs/API_REFERENCE.zh-CN.md`，补充 `install` 命令说明
- [x] 5.4 保持 skill 内容不包含 OpenSpec 或仓库协作流程指导

## 6. 验证 skill 可用性

- [x] 6.1 检查 skill 目录结构是否符合标准仓库 skill 规范
- [x] 6.2 验证该 skill 是否能覆盖运行时准备、plan 编写、执行、skill 安装和结果分析五类核心场景
- [x] 6.3 验证 skill 中引用的命令、plan 字段和产物名称与现有仓库文档保持一致
- [x] 6.4 新增并通过 CLI 测试，覆盖 `install --skills` 的参数解析、报错和实际安装路径
