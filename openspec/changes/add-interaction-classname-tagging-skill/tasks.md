## 1. 搭建 interactive classname tagging skill 目录

- [x] 1.1 在仓库顶层创建 `skills/interactive-classname-tagging/` 标准 skill 目录
- [x] 1.2 在 `skills/interactive-classname-tagging/` 中创建主入口文件 `SKILL.md`
- [x] 1.3 在 `skills/interactive-classname-tagging/` 中创建 `references/` 目录用于渐进式披露资料
- [x] 1.4 评估首版是否需要同时提供 `agents/openai.yaml`

## 2. 编写主 skill 入口与核心规则

- [x] 2.1 在 `SKILL.md` 中写明该 skill 的触发场景，限定为开发阶段对可交互元素进行专用打标
- [x] 2.2 在 `SKILL.md` 中写明交互节点判定范围，覆盖点击、输入、切换、选择、提交和导航等关键元素
- [x] 2.3 在 `SKILL.md` 中写明“显式专用标识必打”规则，明确普通业务 `className` 不算自动化锚点
- [x] 2.4 在 `SKILL.md` 中写明专用标识格式固定为 `minium-anchor-<4位hash>`
- [x] 2.5 在 `SKILL.md` 中写明最小增量修改原则，要求仅在必要节点补充专用标识而不重写历史样式类

## 3. 补充引用资料与命名约束

- [x] 3.1 新增 `references/when-to-tag.md`，说明哪些交互节点默认需要打标、哪些展示节点默认不需要打标
- [x] 3.2 新增 `references/naming-convention.md`，说明 `minium-anchor-<4位hash>` 的格式、生成原则与唯一性要求
- [x] 3.3 在命名规范中固定 4 位 hash 的基础生成种子为“相对文件路径 + 元素树路径 + 交互类型”
- [x] 3.4 在命名规范中补充 hash 冲突处理规则，要求冲突时在基础种子末尾追加递增序号并在当前页面或组件作用域内保持唯一
- [x] 3.5 新增 `references/examples.md`，提供已有业务类共存、交互节点补标、非交互节点不补标等前后对比例子

## 4. 对齐仓库文档与使用说明

- [x] 4.1 更新相关仓库文档，说明该 skill 与 `miniprogram-minium-cli` 产品使用类 skill 的职责边界
- [x] 4.2 在面向贡献者的说明中补充“目标元素必须显式拥有 `minium-anchor-<4位hash>` 专用标识”的约束
- [x] 4.3 检查新增文档是否保持与 OpenSpec proposal、design、specs 一致

## 5. 验证 skill 内容可执行

- [x] 5.1 检查 skill 目录结构是否符合仓库标准 skill 约定
- [x] 5.2 验证主 `SKILL.md` 与引用资料是否完整覆盖打标范围、专用格式、冲突处理和示例场景
- [x] 5.3 以至少一个真实页面或组件为样例，验证 agent 能为目标交互元素补充 `minium-anchor-<4位hash>` 且不误把普通业务类当作锚点
- [x] 5.4 复核所有示例与规则，确认不存在旧的语义化命名或 `qa-` 前缀残留
