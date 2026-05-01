# WORKLOG-04 — Phase 4 + Bug 修复轮 4-5（最新）

> 前序: [WORKLOG-03-interaction.md](WORKLOG-03-interaction.md)

## 项目概述

将古老的 Apophysis 7X16 分形火焰渲染器（Delphi VCL 桌面应用）现代化为基于 WebGPU 的浏览器应用。

**原项目**: Apophysis 7X16 — Delphi VCL 编译的 32/64 位桌面应用，CPU 多线程渲染
**新项目**: ash — TypeScript + Vue 3 + WebGPU Compute Pipeline，浏览器内运行

---

## Phase 4: 最终变换 + 后置仿射 + XML 导出 + 渲染参数 UI

### Feature 1: 最终变换（Final Transform）

最终变换是在所有常规迭代收敛后、写入直方图之前，对每个点应用一次的特殊变换。它是 Apophysis 的核心功能，许多经典火焰设计依赖它。

#### GPU 端

- **XForm struct 扩展**: 新增 `post: array<f32, 6>` 字段（后置仿射系数），struct 从 97 扩展到 103 个 float（388→412 字节）
- **Params struct 扩展**: 新增 `has_final_xform: u32` 字段，buffer 从 28×4 扩展到 29×4 字节
- **新 binding**: `@group(0) @binding(4) var<storage, read> final_xform: XForm;`
- **后置仿射**: 在 `post_rotate_x`/`post_rotate_y` 之后、直方图写入之前应用 `xf.post` 仿射变换
- **最终变换**: 在 `it >= fuse` 块内、直方图写入之前，如果 `has_final_xform != 0` 则应用 final_xform 的完整变换链（仿射→变体→后旋转→后置仿射）
- 两个 iterate shader（ITERATE_SHADER + ITERATE_COMPACT_SHADER）同步修改

#### Buffer 层

- `XFORM_STRUCT_SIZE`: 从 97×4 扩展到 103×4 字节（+6 for post[6]）
- `buildXFormBuffer`: 在 `paramBase + 55`..`paramBase + 60` 写入 post 系数（默认 [1,0,0,1,0,0]）
- 新函数 `buildFinalXFormBuffer(xform: XForm | undefined)`: 构建单个 XForm buffer，undefined 时返回零填充 buffer
- `buildParamsBuffer`: 新增 `u32[26] = has_final_xform` 标志

#### Pipeline 层

- 新增 `finalXformBuffer: GPUBuffer`（binding 4）
- `createIterateBindGroup` 新增 `{ binding: 4, resource: { buffer: this.finalXformBuffer } }`
- `render()`/`renderToImageData()` 写入 final xform 数据
- `destroy()` 销毁 finalXformBuffer

#### Store 层

- 新增 `editingFinalXform: ref<boolean>` — 编辑器是否正在编辑最终变换
- 新增 `setFinalXform(xform: XForm | undefined)` — 设置/清除最终变换（带 pushHistory）
- 新增 `updateFinalXform(updates: Partial<XForm>)` — 更新最终变换的字段
- `updateXform` 新增 `updates.post` 处理

#### UI 层

- **TransformList.vue**: 底部新增「最终变换」条目，带 +/- 切换按钮，样式区分（蓝色斜体）
- **TransformEditor.vue**: 当 `editingFinalXform` 时操作 `flame.finalXform`；新增「后置仿射」6 系数编辑区

#### Parser 层

- `parseXForm`: 读取 `post` 属性（空格分隔 6 个数字），`'post'` 加入 `XFORM_RESERVED_ATTRS`
- `parseSingleFlame`: 解析 `<finalxform>` 元素
- `XMLParser` isArray 配置新增 `'finalxform'`

### Feature 2: XML 导出

- 新函数 `exportFlameXML(flame: Flame): string` — 生成标准 Apophysis `.flame` XML 格式
- 序列化所有渲染参数（brightness/gamma/contrast/vibrancy/white_level 等）
- 序列化每个 xform（coefs/post/weight/color/symmetry + 变体权重 + 变体参数）
- 序列化 `<finalxform>`（如果存在）
- 序列化调色板为 hex 字符串
- Store 新增 `exportToXML()` 方法
- Toolbar 新增「保存 .flame」按钮

### Feature 3: 渲染参数 UI

- ControlPanel.vue 新增 `gammaThreshold` 滑块（0.001–0.5）和 `whiteLevel` 滑块（1–1000）
- 这两个参数已通过 `buildParamsBuffer` 传递到 GPU，此前仅缺少 UI 控件

### 涉及文件

| 文件 | 改动 |
|------|------|
| `renderer/buffers.ts` | XFORM_STRUCT_SIZE +6, buildXFormBuffer 写入 post, 新 buildFinalXFormBuffer, buildParamsBuffer +has_final_xform |
| `renderer/shaders/iterate.wgsl.ts` | XForm struct +post, Params struct +has_final_xform, binding 4, 后置仿射逻辑, 最终变换逻辑（两个 shader） |
| `renderer/pipeline.ts` | PARAMS_SIZE 29×4, finalXformBuffer, binding 4, 写入/销毁 |
| `stores/flame.ts` | editingFinalXform, setFinalXform, updateFinalXform, exportToXML, updateXform +post |
| `parser/flame-xml.ts` | parseXForm +post, parseSingleFlame +finalxform, exportFlameXML |
| `components/TransformList.vue` | 最终变换条目, +/- 切换 |
| `components/TransformEditor.vue` | isFinal 模式, 后置仿射编辑区, update/updatePostCoef |
| `components/Toolbar.vue` | 保存 .flame 按钮 |
| `components/ControlPanel.vue` | gammaThreshold + whiteLevel 滑块 |
| `i18n/locales/zh-CN.ts` | 8 个新 key |
| `i18n/locales/en.ts` | 8 个新 key |

### 验证

- `pnpm run typecheck` ✅
- `pnpm run build` ✅（261KB / gzip 76KB，+25KB）
- `pnpm run test-render` ✅（GPU readback: 26,295 / 1,500,000 non-black）

---

## Bug 修复轮 4 — 撤销/重做 + 调色板

### Fix 14: 撤销/重做破坏 Map 类型（致命）✅

- **现象**: 撤销或重做后，画布交互（拖拽/滚轮/旋转）不再触发渲染，canvas 上原有图像保留但无法更新
- **根因 1**: `deepClone()` 使用 `JSON.parse(JSON.stringify(obj))`，而 `XForm.variations` 和 `XForm.variationParams` 是 `Map` 类型。`JSON.stringify(Map)` 输出 `{}`，反序列化后变成普通空对象，不再是 `Map`。后续渲染调用 `xf.variations.get(vname)` 抛出 `TypeError: {}.get is not a function`，被 `doRender()` 的 `try/catch` 静默捕获
- **根因 2**: 初步修复时改用 `structuredClone()`，但 `structuredClone` 对 Vue `shallowRef` 的值可能抛出 `DataCloneError`，导致所有 `pushHistory()` 调用失败，进而所有交互（包括平移）都无法触发渲染
- **最终修复**: 手写递归 `deepClone`，精确处理 Map/Array/普通对象：
  ```ts
  function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj
    if (obj instanceof Map) return new Map(Array.from(obj.entries(), ([k, v]) => [k, deepClone(v)])) as T
    if (Array.isArray(obj)) return obj.map(v => deepClone(v)) as T
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      result[key] = deepClone((obj as Record<string, unknown>)[key])
    }
    return result as T
  }
  ```
- **涉及文件**: `stores/flame.ts`

### Fix 15: 旋转/缩放产生双历史条目（中等）✅

- **现象**: 旋转操作产生 `rotate` 和 `angle` 两个独立历史条目，缩放产生 `center` 和 `scale` 两个独立条目。单次撤销到达不一致的中间状态
- **修复**: 新增 `batchUpdateRenderParams(updates: Partial<Flame>)` 方法，单次 `pushHistory()` + 批量写入。`RenderCanvas.vue` 中 `commitDrag()` 旋转分支和 `commitWheel()` 改为单次调用
- **涉及文件**: `stores/flame.ts`, `components/RenderCanvas.vue`

### Fix 16: 调色板选择后下拉框重置 + 调色板不可用（严重）✅

- **现象**: 选择调色板后下拉框立即重置到占位符；调色板切换无视觉反馈
- **根因**: `PaletteBar.vue` 中 `selectedPreset.value = ''` 在选择后立即重置；下拉框与 flame 状态无双向绑定
- **修复**: 完全重写 PaletteBar 组件:
  - **预设缩略图网格**: 所有预设调色板渲染为一排水平可滚动的渐变缩略条，点击选择，白色边框高亮当前选中
  - **旋转滑块**: range slider（-128 到 +128），循环旋转当前调色板的 256 色数组，实时触发渲染
  - **旋转预览条**: 显示旋转后的实际调色板渐变
  - **Flame 类型新增 `paletteOffset`**: 存储旋转偏移量（默认 0），`buildPaletteBuffer` 应用循环旋转
- **涉及文件**:
  - `types/flame.ts` — Flame 新增 `paletteOffset`
  - `components/PaletteBar.vue` — 完全重写
  - `stores/flame.ts` — 新增 `setPaletteOffset`，`setPalette` 深拷贝 + 重置 offset
  - `renderer/buffers.ts` — `buildPaletteBuffer` 应用 offset 循环旋转
  - `renderer/pipeline.ts` — 传入 `flame.paletteOffset`
  - `parser/flame-json.ts` — 序列化/反序列化 `paletteOffset`
  - `parser/flame-xml.ts` — 解析时默认 offset=0
  - `utils/random-flame.ts` — 默认 `paletteOffset: 0`
  - `i18n/locales/zh-CN.ts`, `en.ts` — 新增 `palette.rotate`

### 测试基础设施

- **新增** `scripts/test-interaction.mjs` — 基于 Puppeteer + Vite 的交互测试脚本
- **运行方式**: `pnpm run test-interaction`
- **9 个测试用例**:
  1. 初始渲染成功（GPU 可用 + lastRenderTime > 0）
  2. 平移：`updateRenderParam('center')` 触发渲染
  3. 旋转：`batchUpdateRenderParams({rotate, angle})` 触发渲染
  4. 撤销旋转：undo 后参数回退 + 渲染成功 + Map 完整性
  5. 重做：redo 后渲染成功 + Map 完整性
  6. 缩放：`batchUpdateRenderParams({center, scale})` 触发渲染
  7. 调色板偏移：`setPaletteOffset()` 触发渲染
  8. 撤销调色板：undo 后渲染成功 + Map 完整性
  9. 深度循环：5 次写入 + 4 次 undo + 4 次 redo，验证 Map 始终完整
- **package.json** 新增 `test-interaction` script

### 验证

- `pnpm run typecheck` ✅
- `pnpm run build` ✅（262KB / gzip 76KB）
- `pnpm run test-render` ✅（GPU readback: 26,295 / 1,500,000 non-black）
- `pnpm run test-interaction` ✅（9 passed, 0 failed）

---

## Bug 修复轮 5 — 调色板颜色选取 + 选择 UI

### Issue A: 调色板颜色选取逻辑与原版不一致（严重）

- **现象**: 调色板旋转后渲染看起来是单色，失去原有的渐变着色
- **根因**: 与原版 Apophysis 7X 存在两处差异:

#### 差异 1: 调色板索引映射公式（致命）

原版 Apophysis 7X 使用 `Round(c * 256) mod 256`（循环映射，c=0 和 c=1 映射到同一色条目，调色板是闭合环路）。ash 使用 `round(c * 255.0)` + `clamp(0, 255)`（线性映射，调色板是断开的线性斜坡，c=1 映射到 palette[255] 而非循环回 palette[0]）。

- **修复**: 两个 iterate shader（ITERATE_SHADER + ITERATE_COMPACT_SHADER）中 `var ci = i32(round(pcolor * 255.0)); ci = clamp(ci, 0, 255);` → `let ci = u32(round(pcolor * 256.0)) % 256u;`
- **涉及文件**: `renderer/shaders/iterate.wgsl.ts`

#### 差异 2: 调色板旋转方向（中等）

原版使用正向偏移 `palette[(i + offset) % 256]`，ash 使用反向偏移 `original[(i - offset) % 256]`，导致旋转滑块方向与原版相反。

- **修复**: `buildPaletteBuffer` 和 PaletteBar 的 `rotatedGradient` computed 中 `((i - offset) % len + len) % len` → `((i + offset) % len + len) % len`
- **涉及文件**: `renderer/buffers.ts`, `components/PaletteBar.vue`

### Issue B: 调色板选择 UI 不可用（严重）✅

- **现象**: 84 个 36×22px 缩略方块水平排列，缩略图太小难区分、无文字名称、无法快速定位
- **修复**: 重写 PaletteBar.vue 预设选择器为自定义下拉组件:
  - 触发器: 当前选中调色板的渐变预览条 + 名称 + ▼ 展开箭头
  - 下拉列表: 每项显示 80px 渐变条 + 调色板名称，最大 260px 高度滚动
  - `selectedIndex` 持久化，选择后不清空
  - 点击组件外部区域自动收起（全局 click-outside 监听）
  - 键盘导航: ↑↓ 移动悬停 + Enter 选择 + Esc 关闭
  - 保留旋转预览条、旋转滑块（-128 ~ +128）、UGR 文件加载按钮
- **涉及文件**: `components/PaletteBar.vue`（完全重写）

### 验证

- `pnpm run typecheck` ✅
- `pnpm run build` ✅（264KB / gzip 77KB）
- `pnpm run test-render` ✅（GPU readback: 26,295 / 1,500,000 non-black）
- `pnpm run test-interaction` ✅（9 passed, 0 failed）

---

## 工作日志拆分

### 背景

原 `WORKLOG.md` 随项目推进持续膨胀至 1112 行（~54KB），作为上下文注入时 token 消耗过高。

### 方案

按时间/主题拆分为 4 个文件，放入 `worklog/` 目录，每个文件头部保留精简版「项目概述」便于独立阅读，文件间通过导航链接串联。

### 文件结构

| 文件 | 覆盖范围 | 大小 |
|------|----------|------|
| `worklog/WORKLOG-01-init.md` | 项目初始化 + 核心实现 + Bug 1-13 | 14 KB |
| `worklog/WORKLOG-02-ux-perf.md` | UX 调查/修复 + 性能优化 + 进度条 | 18 KB |
| `worklog/WORKLOG-03-interaction.md` | Canvas 交互 + 构图参考线 + 变体库扩展 | 11 KB |
| `worklog/WORKLOG-04-latest.md` | Phase 4 + Bug 修复 4-5 + 后续工作（最新） | 12 KB |

- 原 `WORKLOG.md` 已删除
- 日常使用只需注入 `WORKLOG-04-latest.md`

---

## Bug 修复轮 6 — PaletteBar 键盘 + 滚轮交互

### Issue A: 键盘选择不工作（严重）

- **现象**: 下拉打开后，按 ↑↓ 箭头无视觉高亮变化，Enter 键只切换下拉开关不选中项
- **根因 1**: `@keydown.enter.prevent="toggleDropdown"` — Enter 只做 toggle，不选中 `hoveredIndex`
- **根因 2**: 下拉选项 `.active` 样式绑定 `selectedIndex` 而非 `hoveredIndex`，键盘移动时看不到高亮
- **根因 3**: 首次打开下拉时 `hoveredIndex` 为 -1，未从 `selectedIndex` 初始化

### Issue B: 滚轮选择色带缺失（中等）

- **现象**: dropdown trigger 上无滚轮事件，关闭下拉后无法滚轮切换调色板；下拉列表内滚轮只做原生滚动不切换选中项
- **原版行为**: Apophysis 7X 支持滚轮直接切换调色板

### 修复 (`components/PaletteBar.vue`)

#### Enter 键 → 新增 `onEnter()`
- 下拉打开 + `hoveredIndex >= 0` → `selectPreset(hoveredIndex)`（选中）
- 否则 → `toggleDropdown()`（切换）

#### Trigger 滚轮 → 新增 `onTriggerWheel()`
- `@wheel.prevent` 绑定到 dropdown trigger
- 滚轮循环切换 `selectedIndex` 并直接应用调色板（wrap around）

#### 下拉列表内滚轮 → 重写 `onListWheel()`
- 从原生滚动改为移动 `hoveredIndex` + `scrollIntoView`
- 支持循环（末尾→首项，首项→末尾）

#### 高亮样式分离
- `.hovered` — 蓝色背景，跟随鼠标悬停 / 键盘焦点
- `.selected` — 蓝色左边框，标识当前已选中项
- 打开下拉时自动 `hoveredIndex = selectedIndex` + 滚动到选中项

#### 键盘导航初始化
- `onKeyNav` 首次打开时从 `selectedIndex` 开始（而非从 -1）
- `toggleDropdown` 打开时同步 `hoveredIndex = selectedIndex` + `nextTick` 滚动

### 验证

- `pnpm run typecheck` ✅
- `pnpm run build` ✅（264KB / gzip 77KB）
- `pnpm run test-interaction` ✅（9 passed, 0 failed）

### 已知遗留

- ~~当前 `cmap.ugr` 仅 84 个调色板，原版 Apophysis 7X 完整调色板集约 700+ 个，需额外获取~~ ✅ 已解决

---

## 社区调色板集成

### 来源

`flam3-palettes.xml` — 来自 [scottdraves/flam3](https://github.com/scottdraves/flam3) 仓库，包含 **701 个调色板**，GPL-3.0 许可证。这是 Apophysis / Electric Sheep / flam3 社区的标准调色板集。

### 格式

- XML 格式：`<palette number="N" name="xxx" data="00RRGGBB..."/>`
- 每个调色板 256 色，每个色 = 8 字符 hex（00RRGGBB），共 2048 hex 字符

### 转换脚本

- **`scripts/convert-flam3-palettes.mjs`** — 从 GitHub 下载 XML → 解析 → 输出 `public/palettes/flam3.json`
- **`scripts/convert-ugr-palettes.mjs`** — 从本地 `cmap.ugr` 重新生成 `public/palettes/default.json`（修正 count: 400→256 不一致问题）
- `package.json` 新增 `convert-flam3` / `convert-ugr` 脚本

### 数据修正

- `default.json` 从 `count: 400` 修正为 `count: 256`（与着色器 256 索引一致）
- 转换脚本默认输出压缩 JSON（无格式化空白）

### 应用加载

- `stores/flame.ts` 的 `loadDefaultPalettes()` 改为并行加载两个文件：
  - `palettes/default.json`（84 个，内置 UGR）
  - `palettes/flam3.json`（701 个，社区 flam3）
  - 合并为单一 `palettes` 数组（共 785 个）
  - `flam3.json` 加载失败时降级为仅 84 个内置

### 文件大小

| 文件 | 压缩后 |
|------|--------|
| `default.json` | 262 KB |
| `flam3.json` | 2.2 MB |
| 合计 | 2.4 MB |

### 验证

- `pnpm run typecheck` ✅
- `pnpm run build` ✅（265KB / gzip 77KB）
- `pnpm run test-interaction` ✅（9 passed, 0 failed）

### 待优化

- 785 个调色板的下拉列表浏览体验需要改善（搜索/过滤/分组）

---

## XML 导出兼容性检查

### 问题

ash 导出的 `.flame` XML 文件在原版 Apophysis 7X 中打开时报错，提示缺少变体：handkerchief、wedge_julia、blob、crackle。

### 根因分析

ash 的 50 个变体中，有部分在原版 Apophysis 7X 中不存在或需要外部插件 DLL：

| 等级 | 变体 | 说明 |
|------|------|------|
| A: 原版内置 | linear, sinusoidal, spherical, swirl, ... | 直接可用 |
| B: 内部插件 | julian, juliascope, pdj, ngon, curl, ... | 编译进 exe |
| C: 需外部 DLL | handkerchief, crackle, cell, split, ... | DLL 在 Plugins/ 中，可能未加载 |
| D: 7X 不存在 | blob, wedge_julia, exponential, power, ... | ash 独有实现 |

### 修复

#### 新增兼容性常量 (`types/flame.ts`)

- `INCOMPATIBLE_VARIATIONS`: D 级变体名称集合（16 个）
- `ExportCompatibility` 接口：`{ incompatible: string[] }`

#### 导出前检查 (`parser/flame-xml.ts`)

- 新增 `checkExportCompatibility(flame)`: 扫描所有 xform 的 variations，返回不兼容列表
- `exportFlameXML()` 在 `<flame>` 标签前添加 XML 注释：`<!-- Warning: contains variations not supported by original Apophysis 7X: blob, wedge_julia -->`

#### 导出确认对话框 (`components/Toolbar.vue`)

- `onSaveFlame()` 调用 `checkExportCompatibility()`
- 如有不兼容变体，弹出 `confirm()` 对话框列出名称
- 用户确认 → 正常导出（带 XML 注释）
- 用户取消 → 不导出

#### 国际化 (`i18n/locales/`)

- `export.incompatibleMsg` / `export.incompatibleConfirm`

### 涉及文件

| 文件 | 改动 |
|------|------|
| `types/flame.ts` | 新增 `INCOMPATIBLE_VARIATIONS`、`ExportCompatibility` |
| `parser/flame-xml.ts` | 新增 `checkExportCompatibility()`、XML 注释 |
| `components/Toolbar.vue` | 导出前确认对话框 |
| `i18n/locales/zh-CN.ts` | 兼容性提示中文 |
| `i18n/locales/en.ts` | 兼容性提示英文 |

### 验证

- `pnpm run typecheck` ✅
- `pnpm run build` ✅（265KB / gzip 77KB）
- `pnpm run test-interaction` ✅（9 passed, 0 failed）
