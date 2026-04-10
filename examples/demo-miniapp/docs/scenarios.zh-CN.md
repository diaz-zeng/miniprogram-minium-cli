[English](./scenarios.md)

# 场景矩阵

这个文档把示例页面和它们对应要验证的 CLI 能力对应起来，方便后续扩展回归计划时保持设计一致。

## 页面说明

### 登录页

源码：`src/pages/login/index.tsx`

用途：

- 验证基于 `id` 的精确定位
- 验证点击驱动的页面跳转
- 提供稳定的 smoke 起始页

典型覆盖：

- `element.query`
- `element.click`
- `wait.for`
- `assert.pagePath`

### 首页

源码：`src/pages/home/index.tsx`

用途：

- 验证基于部分文本的模糊定位
- 验证文本输入和本地状态更新
- 验证弹层打开与关闭流程

典型覆盖：

- `element.input`
- `assert.elementText`
- `assert.elementVisible`
- 精确与模糊定位混合使用

### Bridge 实验页

源码：`src/pages/bridge-lab/index.tsx`

用途：

- 为 bridge 类 regression plan 提供稳定起点
- 明确展示高优先级、中优先级与受 AppID 限制的 bridge 覆盖分组
- 暴露可见的 `touristappid` 提示，方便跳过型计划使用显式页面锚点

典型覆盖：

- `storage.*`
- `navigation.*`
- `app.*`
- `settings.*`
- `clipboard.*`
- `ui.*`
- `location.*`
- `media.*`
- `file.*`
- `device.*`
- `auth.*`
- `subscription.requestMessage`

### 手势页

源码：`src/pages/gesture/index.tsx`

用途：

- 验证 `gesture.touchTap`
- 验证单指和双指手势状态处理
- 验证页面内的手势结果反馈

典型覆盖：

- `gesture.touchTap`
- `gesture.touchStart`
- `gesture.touchMove`
- `gesture.touchEnd`

### 光标实验页

源码：`src/pages/cursor-lab/index.tsx`

用途：

- 验证按住并拖动光标的交互
- 验证多指配合下在当前光标位置打标
- 验证激活光标、首次打点、移动和再次打点等关键节点的显式截图
- 验证强状态页面里的混合定位策略

典型覆盖：

- `gesture.touchStart`
- `gesture.touchMove`
- `gesture.touchTap`
- 指针移动后的精确坐标断言

### 回顾面板页

源码：`src/pages/review-board/index.tsx`

用途：

- 验证打标后的回顾信息渲染
- 验证第二个页面上的平移与缩放交互
- 提供可见参照物，方便对比缩放前后的截图差异
- 验证手势能力在编辑页之外也能复用

典型覆盖：

- 页面断言
- 手势序列
- 打标摘要断言

## 计划风格

这套回归计划刻意混合了两种风格：

- 精确计划：通过稳定的 `id` 选择器提供低噪音的 smoke 基线
- 模糊或混合计划：更接近模型生成和真实用户表达方式，适合验证高级定位能力

如果你想先建立稳定基线，优先运行精确计划；如果你想验证 CLI 的更高层定位能力，再运行模糊或混合计划。

bridge 相关计划还额外分成三类：

- 默认 bridge 计划：使用 `runtimeMode: "auto"`，覆盖在示例小程序里默认应可使用的 bridge 能力
- placeholder bridge 计划：使用 `runtimeMode: "placeholder"`，覆盖依赖相机、上传域名、设备容器或其他外部条件的 API
- 受限 bridge 计划：保留 `runtimeMode: "auto"`，但通过 `requiresDeveloperAppId` 标记让执行器在 `touristappid` 下自动跳过
