# Apophysis Next (ash) - 工作日志

## 项目概述

将古老的 Apophysis 7X16 分形火焰渲染器（Delphi VCL 桌面应用）现代化为基于 WebGPU 的浏览器应用。

**原项目**: Apophysis 7X16 — Delphi VCL 编译的 32/64 位桌面应用，CPU 多线程渲染
**新项目**: ash — TypeScript + Vue 3 + WebGPU Compute Pipeline，浏览器内运行

---

## Phase 1: 项目初始化与核心实现

### Step 1: 项目脚手架
- Vite + Vue 3 + TypeScript 项目初始化
- 依赖: `pinia`, `fast-xml-parser`, `@webgpu/types`
- 目录结构: `src/{types,parser,renderer,components,stores,utils,i18n}`

### Step 2: 文件解析器
- `parser/flame-xml.ts` — 解析旧版 `.flame` XML 格式（xform 属性中的变体识别、palette hex 解析）
- `parser/palette-ugr.ts` — 解析 `.ugr` 调色板（BGR int → RGB，稀疏锚点线性插值到 256 色）
- `parser/flame-json.ts` — 新 JSON 格式读写，向后兼容旧格式字段
- 从 `Apophysis7X.temp` 转换 5 个模板 → `public/templates/default.json`
- 从 `cmap.ugr` 转换 84 个调色板 → `public/palettes/default.json`

### Step 3: WebGPU 渲染引擎
- `renderer/device.ts` — WebGPU 初始化、适配器请求、兼容性检测
- `renderer/buffers.ts` — GPU buffer 构建（XForm struct、palette、params）
- `renderer/shaders/variations.wgsl.ts` — 23 个变体函数的 WGSL 实现（18 内置 + 5 扩展）
- `renderer/shaders/iterate.wgsl.ts` — IFS 迭代 Compute Shader（PCG 随机数、变换选择、变体累加、直方图写入）
- `renderer/shaders/density.wgsl.ts` — 对数密度估计 Compute Shader
- `renderer/shaders/filter.wgsl.ts` — 高斯空间滤波 + Gamma 校正 Compute Shader
- `renderer/shaders/display.wgsl.ts` — 纹理到 Canvas 的顶点+片段着色器
- `renderer/pipeline.ts` — 4-pass 渲染管线编排（iterate → density → filter → display）
- `renderer/engine.ts` — 顶层引擎封装

### Step 4: 状态管理
- `stores/flame.ts` — Pinia store: 火焰参数 CRUD、文件加载、变体编辑、调色板管理
- `stores/renderer.ts` — Pinia store: GPU 状态、初始化、渲染状态

### Step 5: Vue UI 组件
- `RenderCanvas.vue` — WebGPU canvas 绑定、防抖渲染、resize 响应
- `Toolbar.vue` — 文件 I/O、模板选择、渲染控制、语言切换
- `TransformList.vue` — 变换列表（添加/删除/选中）
- `TransformEditor.vue` — 单个变换编辑（仿射系数、变体权重、Julian 参数）
- `ControlPanel.vue` — 渲染参数面板（密度/过采样/滤波/亮度/Gamma 等）
- `PaletteBar.vue` — 调色板渐变条 + 预设选择

---

## Bug 修复轮

### Fix 1: 预览不可见（致命）
- **根因**: WGSL 使用不存在的类型 `vec6f` / `vec23f`，着色器编译失败
- **修复**: 改为 `array<f32, 6>` / `array<f32, 23>`，所有 `.x/.y/.z` 访问改为 `[0]/[1]/[2]`

### Fix 2: Display pipeline 硬编码格式
- **根因**: `bgra8unorm` 硬编码，macOS 上不匹配
- **修复**: 按需创建 display pipeline，动态使用 `getPreferredCanvasFormat()`

### Fix 3: PNG 导出不可用
- **根因**: WebGPU canvas 不支持 `toDataURL()`
- **修复**: 新增 `renderToImageData()` 方法（GPU texture → staging buffer → readback → ImageData），通过 OffscreenCanvas 导出

### Fix 4: u32/f32 类型不匹配（静默 Bug）
- **根因**: `buildParamsBuffer` 用 `Float32Array` 写入 `u32` 字段，WGSL 读取时位模式错误
- **修复**: 改为 `ArrayBuffer` + `Uint32Array`/`Float32Array` 双视图，按字段类型分别写入

### Fix 5: 变换权重未归一化
- **根因**: 原始 weight 直接传入着色器做概率选择，但 weight 值非归一化概率
- **修复**: `buildXFormBuffer` 中 `weight / totalWeight` 归一化

---

## 新功能

### 随机火焰生成
- `utils/random-flame.ts` — 随机 2-5 个变换、随机仿射矩阵、1-3 个随机变体、从预设调色板随机选择
- Toolbar 绿色高亮 "随机生成" 按钮

### 中文本地化
- `i18n/locales/zh-CN.ts` / `en.ts` — 双语翻译表
- `i18n/index.ts` — 轻量级 reactive i18n（`t()`, `setLocale()`, `useI18n()`）
- 所有 6 个组件 UI 文字已替换为 `t('key')` 调用
- Toolbar 语言切换下拉框，默认简体中文

---

## Bug 分析轮

### Fix 6: 预览全黑 — outputTexture 尺寸与 filter 写入区域不匹配（致命）

- **现象**: Canvas 渲染后全黑，无分形图案
- **根因**: `pipeline.ts` 中 `outW/outH` 计算为 `histW - 2*gutter`，即 `oversample*flame.width`（如 oversample=2, width=800 → outW=1600）。`outputTexture` 创建为 1600×1200，但 filter shader 内部 `out_w/out_h` 用整数除法 `params.width/params.oversample - 2*params.gutter/params.oversample` 算出 800×600。dispatch workgroup 数量基于 outW=1600，但 shader 内 gid.x ≥ 800 的线程全部 return。结果 outputTexture 只有左上 800×600 有数据，display shader 采样整个 1600×1200 纹理，大面积空白
- **涉及文件**: `renderer/pipeline.ts`, `renderer/shaders/filter.wgsl.ts`
- **修复方向**: `outW/outH` 应等于 `flame.width/flame.height`（最终输出尺寸），outputTexture 应为输出尺寸而非 oversampled 尺寸

### Fix 7: iterate 着色器 nuscale 坐标映射公式错误（致命）

- **现象**: 即使 filter 问题修复，分形点可能映射到直方图边界之外
- **根因**: `iterate.wgsl.ts` 中 `nuscale` 公式混合了直方图尺寸和输出尺寸概念。原始 Apophysis 中 `scale` 表示"每输出像素的单位数"，`nuscale` 应为"直方图像素/单位"= `oversample/scale`。当前公式包含 `params.width / params.oversample`（u32 整数除法）和错误的 gutter 项
- **涉及文件**: `renderer/shaders/iterate.wgsl.ts`
- **修复方向**: 重写坐标映射为 `nuscale = f32(oversample) / scale`，像素坐标 `(ix, iy)` = `(xp * cos - yp * sin) * nuscale + wd/2`

### Fix 8: filter shader 中 gutter/oversample 整数除法精度丢失（严重）

- **现象**: filter 输出区域可能比预期偏小或偏大几个像素
- **根因**: `filter.wgsl.ts` 中 `out_w = params.width / params.oversample - 2u * params.gutter / params.oversample` 使用 u32 整数除法，当 `gutter` 不被 `oversample` 整除时截断。且此公式与 pipeline.ts 中 `outW = histW - 2*gutter` 的语义完全不同
- **涉及文件**: `renderer/shaders/filter.wgsl.ts`
- **修复方向**: filter shader 应接收输出尺寸作为单独参数，或在 pipeline 中传递预计算好的 outW/outH

### Fix 9: canvas webgpu 上下文每帧重复 configure（中等）

- **现象**: 每次渲染调用 `ctx.configure()`，可能导致前帧纹理被 invalidate
- **根因**: `pipeline.ts` 的 `render()` 方法在每次调用时都执行 `ctx.configure({device, format, alphaMode})`。WebGPU 规范中 configure 会创建新的纹理，可能导致前帧的 `getCurrentTexture()` 返回的纹理被废弃
- **涉及文件**: `renderer/pipeline.ts`
- **修复方向**: 只在 canvas 尺寸变化或首次绑定时 configure

---

## Bug 修复轮 2

### 共同根因: Params 中 `width/height` 存放直方图尺寸（histW/histH），shader 通过 u32 整数除法反推输出尺寸，精度丢失且语义混乱

- **解决方案**: Params struct 新增 `out_width: u32`（index 22）和 `out_height: u32`（index 23），直接传递 `flame.width/flame.height`，消除所有整数除法推导
- **影响文件**: `renderer/buffers.ts`, `renderer/shaders/iterate.wgsl.ts`, `renderer/shaders/density.wgsl.ts`, `renderer/shaders/filter.wgsl.ts`, `renderer/pipeline.ts`

### Fix 6: 预览全黑 — outputTexture 尺寸与 filter 写入区域不匹配（致命）✅

- **修复**: `pipeline.ts` 中 `outW = flame.width`, `outH = flame.height`（原为 `histW - 2*gutter = oversample*flame.width`）
- **同步修复**: `renderToImageData()` 方法中同样的 outW/outH 计算

### Fix 7: iterate 着色器 nuscale 坐标映射公式错误（致命）✅

- **修复**: 参照原始 Apophysis 7X 源码（`RenderingInterface.pas` / `RenderingImplementation.pas`），`ppux = ppuy = pixels_per_unit`（无宽高比分支），`nuscale = oversample * scale`
- **原代码问题**: 1) `params.width / params.oversample` u32 整数除法（1640/2=820≠800）2) 错误的 `3*width < 4*height` 宽高比分支（pre-7X 遗留，7X 中 ppux=ppuy）3) gutter 交叉项无意义
- **重写为**: `nuscale = f32(params.oversample) * params.scale`，像素映射 `ix = round((xp*cos - yp*sin)*nuscale + histW/2)`

### Fix 8: filter shader 中 gutter/oversample 整数除法精度丢失（严重）✅

- **修复**: `filter.wgsl.ts` 中 `out_w = params.out_width`, `out_h = params.out_height`（原为 `params.width / params.oversample - 2u * params.gutter / params.oversample`）

### Fix 9: canvas webgpu 上下文每帧重复 configure（中等）✅

- **修复**: `pipeline.ts` 新增 `lastCanvasFormat/lastCanvasWidth/lastCanvasHeight` 成员变量，仅当 format 或 canvas 尺寸变化时调用 `ctx.configure()`

---

## 基础设施

### npm → pnpm 迁移

- **原因**: pnpm 严格依赖隔离，无幽灵依赖风险；磁盘空间效率更高
- **操作**: 删除 `package-lock.json` + `node_modules/`，`pnpm install` 生成 `pnpm-lock.yaml`
- **附带**: `package.json` 新增 `typecheck` 脚本（`vue-tsc --noEmit`）；`AGENTS.md` 命令从 `npm run` 改为 `pnpm run`
- **验证**: `pnpm run typecheck` + `pnpm run build` 均通过

---

## Bug 修复轮 3 — WGSL 编译错误 + 诊断基础设施

### 根因: 两个 WGSL 编译错误导致整个 pipeline 创建失败，canvas 和 PNG 导出均为空

通过 Puppeteer CLI 测试工具 + shader 编译检查定位。

### Fix 10: filter shader `gaussian_kernel` 缺少存储地址空间声明（致命）✅

- **现象**: Canvas 全黑，PNG 导出空图
- **根因**: `filter.wgsl.ts` 中 `var gaussian_kernel: array<f32>` 缺少 `<storage, read>`，WGSL 报错 `runtime-sized arrays can only be used in the <storage> address space`
- **修复**: 改为 `var<storage, read> gaussian_kernel: array<f32>`

### Fix 11: filter shader `2u * i32()` 类型不匹配（致命）✅

- **现象**: 同 Fix 10
- **根因**: `let filter_width = 2u * i32(...)` 中 u32 与 i32 不能直接相乘，WGSL 强类型不允许
- **修复**: 改为 `2 * i32(...)`（字面量 `2` 自动推断为 i32）

### Fix 12: iterate shader 修复时误删 `wd`/`ht` 变量（回归）✅

- **根因**: Fix 7 重写 nuscale 时删除了 `let wd = params.width; let ht = params.height`，但后续 bounds check 和 histogram 索引仍引用这两个变量
- **修复**: 全部替换为 `params.width`/`params.height`（5 处）

### Fix 13: canvas 尺寸设置时序问题 ✅

- **根因**: `doRender()` 通过 Vue reactive ref 设置 canvas 尺寸后立即调用 `render()`，但 Vue DOM 更新是异步的，canvas 仍是旧尺寸 → `getCurrentTexture()` 获取的纹理被 Vue 随后的 DOM 更新销毁
- **修复**: 改为直接设置 `canvasRef.value.width/height`（同步 DOM 操作），并在 `requestAnimationFrame` 中执行渲染

### 诊断基础设施

- **Shader 编译检查**: `pipeline.ts` 新增 `checkShader()` 方法，每个 `createShaderModule` 后异步检查编译信息，错误时 throw
- **GPU Error Scope**: `render()` 方法在 `queue.submit()` 后通过 `pushErrorScope`/`popErrorScope` 检测 GPU 验证错误
- **Puppeteer CLI 测试**: `scripts/test-render.mjs` — 启动 vite + headless Chrome，拦截 console 输出，通过 GPU readback 验证渲染结果
- **运行方式**: `pnpm run test-render`，自动 PASS/FAIL 判定
- **Pipeline 构造**: `FlamePipeline` 改为 `static async create()` 工厂方法，`FlameEngine.init()` 适配

---

## 技术栈

| 组件 | 技术 |
|------|------|
| 前端框架 | Vue 3 Composition API |
| 状态管理 | Pinia |
| GPU 渲染 | WebGPU Compute Pipeline (4-pass) |
| 着色器 | WGSL |
| 构建 | Vite + pnpm |
| 测试 | Puppeteer headless Chrome (`pnpm run test-render`) |
| 解析 | fast-xml-parser |
| 包体积 | 174KB (gzipped: 61KB) |

---

## 文件清单

```
ash/
├── AGENTS.md
├── WORKLOG.md
├── index.html
├── package.json
├── vite.config.ts
├── .npmrc
├── scripts/
│   └── test-render.mjs                # Puppeteer CLI 测试
├── public/
│   ├── templates/default.json          # 5 个火焰模板
│   └── palettes/default.json           # 84 个调色板
└── src/
    ├── main.ts
    ├── App.vue
    ├── wgsl.d.ts
    ├── types/
    │   ├── flame.ts                     # Flame/XForm/Palette 类型定义
    │   └── renderer.ts                  # GPU 类型定义
    ├── parser/
    │   ├── flame-xml.ts                 # .flame XML 解析
    │   ├── flame-json.ts                # JSON 格式读写
    │   └── palette-ugr.ts               # .ugr 调色板解析
    ├── renderer/
    │   ├── device.ts                    # WebGPU 初始化
    │   ├── buffers.ts                   # GPU buffer 构建
    │   ├── engine.ts                    # 渲染引擎
    │   ├── pipeline.ts                  # 4-pass 管线 + 诊断
    │   └── shaders/
    │       ├── variations.wgsl.ts       # 23 个变体函数
    │       ├── iterate.wgsl.ts          # IFS 迭代
    │       ├── density.wgsl.ts          # 对数密度估计
    │       ├── filter.wgsl.ts           # 高斯滤波 + Gamma
    │       └── display.wgsl.ts          # 纹理显示
    ├── stores/
    │   ├── flame.ts                     # 火焰参数 store
    │   └── renderer.ts                  # 渲染器 store
    ├── components/
    │   ├── RenderCanvas.vue
    │   ├── Toolbar.vue
    │   ├── TransformList.vue
    │   ├── TransformEditor.vue
    │   ├── ControlPanel.vue
    │   └── PaletteBar.vue
    ├── i18n/
    │   ├── index.ts
    │   └── locales/
    │       ├── zh-CN.ts
    │       └── en.ts
    └── utils/
        ├── color.ts
        ├── debounce.ts
        └── random-flame.ts
```

---

## UX 改善调查轮 — 鼠标交互 + 随机生成 + 滚轮步进

### Issue 1: Canvas 缺少鼠标交互（缩放/旋转/平移）

- **现象**: 原版 Apophysis 7X 的主画布支持鼠标滚轮缩放、左键拖拽平移、右键拖拽旋转，用户可直观地浏览分形空间。当前 ash 的 canvas 完全无鼠标事件绑定
- **定位**: [RenderCanvas.vue](file:///x:/Temporary%20storage/Apophysis.7X16/ash/src/components/RenderCanvas.vue) — `<canvas>` 只有 `ref` 绑定，无任何 `@mousedown`/`@mousemove`/`@mouseup`/`@wheel` 事件
- **涉及数据**: `flame.center`（平移）、`flame.scale`（缩放）、`flame.rotate`（旋转）在 [flame.ts](file:///x:/Temporary%20storage/Apophysis.7X16/ash/src/types/flame.ts) 类型中已定义，且在 [ControlPanel.vue](file:///x:/Temporary%20storage/Apophysis.7X16/ash/src/components/ControlPanel.vue) 中有 `input[type="number"]` 手动编辑，但缺少从 canvas 鼠标事件到这些参数的映射
- **交互设计参考**（原版 Apophysis 7X 行为）:
  - **滚轮**: 缩放（以鼠标位置为中心），调整 `flame.scale`
  - **左键拖拽**: 平移，调整 `flame.center[0]` 和 `flame.center[1]`
  - **右键拖拽 / Ctrl+左键拖拽**: 旋转，调整 `flame.rotate`
- **实现方向**: 在 `RenderCanvas.vue` 中添加鼠标事件处理，将屏幕像素位移转换为分形坐标偏移（需要考虑 `scale` 和 `rotate` 的逆变换），调用 `flameStore.updateRenderParam()` 更新参数
- **优先级**: 高 — 这是分形编辑器的核心交互，原版的基本操作能力

### Issue 2: 随机生成按钮覆盖画布尺寸

- **现象**: 用户在 ControlPanel 中设置了自定义画布尺寸（如 1920×1080），点击"随机生成"后画布被重置为 1280×720
- **定位**: [random-flame.ts](file:///x:/Temporary%20storage/Apophysis.7X16/ash/src/utils/random-flame.ts) 第 93 行 — `generateRandomFlame()` 返回的 Flame 对象硬编码 `width: 1280, height: 720`
- **调用链**: Toolbar "随机生成"按钮 → `flameStore.generateRandom()` → `generateRandomFlame(palettes)` → `setFlame(f)` — 整个 flame 对象被替换，包括 width/height
- **修复方向**: `generateRandomFlame()` 应接收当前画布尺寸参数（或从 store 中读取当前 flame 的 width/height），保留用户的画布尺寸设置而仅随机化分形参数（xforms、palette、center、scale、brightness、gamma 等）
- **涉及文件**: `utils/random-flame.ts`, `stores/flame.ts`（`generateRandom` 方法）

### Issue 3: 滑块/数值 input/select 不支持鼠标滚轮步进

- **现象**: 用户在 ControlPanel、TransformEditor、PaletteBar 中调节参数时，鼠标悬停在控件上滚动滚轮无任何效果。原版桌面应用和常见工具（如 Photoshop、Blender）均支持滚轮微调数值
- **定位**: 所有 `<input type="range">`、`<input type="number">`、`<select>` 均无 `@wheel` 事件处理
- **涉及文件**:
  - [ControlPanel.vue](file:///x:/Temporary%20storage/Apophysis.7X16/ash/src/components/ControlPanel.vue) — 6 个 range input + 5 个 number input
  - [TransformEditor.vue](file:///x:/Temporary%20storage/Apophysis.7X16/ash/src/components/TransformEditor.vue) — 2 个 range input + 8 个 number input（6 仿射系数 + weight + 2 julian 参数）
  - [PaletteBar.vue](file:///x:/Temporary%20storage/Apophysis.7X16/ash/src/components/PaletteBar.vue) — 1 个 select
  - [Toolbar.vue](file:///x:/Temporary%20storage/Apophysis.7X16/ash/src/components/Toolbar.vue) — 2 个 select
- **浏览器原生行为**: `<input type="number">` 在获得焦点时支持滚轮步进，但需要先点击聚焦；`<input type="range">` 和 `<select>` 完全不支持
- **实现方向**:
  - **方案 A（推荐）**: 创建一个通用的 `useWheelStep` composable 或 `v-wheel-step` 自定义指令，监听 `@wheel.prevent`，根据 `step`/`min`/`max` 属性和 `deltaY` 方向调整值，适用于所有 range/number input
  - **方案 B**: 在每个组件内分别添加 `@wheel` 处理器（重复代码多）
  - **select 特殊处理**: 滚轮上下切换选项（`selectedIndex += deltaY > 0 ? 1 : -1`）
- **优先级**: 中 — 改善操作流畅度，属于 UX 打磨

---

## 开源准备

### 仓库初始化

- **目标仓库**: [RePinkert/Apophysis-Ash](https://github.com/RePinkert/Apophysis-Ash) — 仅上传 `ash/` 子目录
- **许可证**: GPL v2 — 项目是原版 Apophysis 7X（GPL v2）的衍生作品（WGSL 着色器从 Delphi 源码翻译/改写），必须延续相同许可证
- **仓库命名**: `Apophysis-Ash` — 兼顾原项目名和内部代号，便于搜索发现

### 清理工作

- **删除 Vite 脚手架残留**: `src/components/HelloWorld.vue`、`src/assets/hero.png`、`src/assets/vite.svg` — 均未被 App.vue 或其他业务组件引用
- **.gitignore 补充**: 添加 `test-output.png`（Puppeteer 测试生成产物）

### 新增文件

- **LICENSE**: GNU General Public License v2.0 全文（从 gnu.org 获取）
- **README.md**: 英文版 — 项目介绍、功能列表、技术栈、快速开始、项目结构、致谢、许可证
- **README.zh-CN.md**: 中文版 — 同等内容，两个 README 顶部互相链接切换语言

### 修改

- **package.json**: `version` 从 `0.0.0` 改为 `0.1.0`

### 已知遗留

- ~~`public/favicon.svg` 缺失~~ ✅ 已修复（见下方）

### Favicon

- **新增**: `public/favicon.png` — 由 RePinkert 使用 Apophysis 渲染的分形图像，采用 CC BY-NC-ND 4.0 协议授权
- **修改**: `index.html` favicon 引用从 `favicon.svg` 改为 `favicon.png`
- **修改**: 两个 README 添加 favicon 版权声明（CC BY-NC-ND 4.0，署名 RePinkert）

---

## UX 修复轮 — Issue 2 + Issue 1 + Issue 3

### 优先级重新评估

- **Issue 2** 从「中优先级 UX 改善」升级为「高优先级 Bug」— 功能性缺陷，用户显式设置的画布尺寸被静默覆盖
- **Issue 1** 维持高优先级 — 分形编辑器的核心交互能力
- **Issue 3** 维持中优先级 — UX 打磨

### Issue 2: 随机生成覆盖画布尺寸 ✅

- **根因**: `generateRandomFlame()` 硬编码 `width: 1280, height: 720`，`generateRandom()` 通过 `setFlame()` 整体替换
- **修复**: `generateRandomFlame()` 增加 `width`/`height` 参数（带默认值），store 中 `generateRandom()` 传入 `flame.value.width`/`flame.value.height`
- **涉及文件**: `utils/random-flame.ts`, `stores/flame.ts`

### Issue 1: Canvas 鼠标交互（缩放/平移/旋转）✅

- **渲染策略**: 采用防抖自动渲染（复用现有 300ms deep watch），暂不实现低分辨率实时预览
- **交互设计**（对齐原版 Apophysis 7X）:
  - **左键拖拽**: 平移，调整 `flame.center`
  - **右键拖拽 / Ctrl+左键**: 旋转，调整 `flame.rotate`
  - **滚轮**: 以鼠标位置为中心缩放，调整 `flame.scale` + `flame.center`
- **实现细节**:
  - `canvasToFlameOffset()`: 像素偏移 → 分形坐标偏移（考虑 displayScale、canvas 居中偏移、rotate 逆矩阵）
  - `onWheel()`: 缩放时重新计算 center 以保持鼠标下的分形点不动（zoom-to-cursor）
  - CSS: `cursor: grab` / `cursor: grabbing` 视觉反馈
  - `@contextmenu.prevent` 屏蔽右键菜单
- **涉及文件**: `components/RenderCanvas.vue`

### Issue 3: 滚轮步进 ✅

- **方案**: 创建 `v-wheel-step` 全局自定义指令，在 `main.ts` 中注册
- **功能**:
  - `<input type="range">`: 滚轮按 `step` 调整值，受 `min`/`max` 约束
  - `<input type="number">`: 同上
  - `<select>`: 滚轮切换选项（`selectedIndex ± 1`）
  - **修饰键**: Shift = 1/10 步进，Ctrl/Cmd = 10x 步进
- **涉及文件**:
  - 新增 `directives/vWheelStep.ts`
  - 修改 `main.ts`（全局注册）
  - 修改 `ControlPanel.vue`（6 range + 5 number）
  - 修改 `TransformEditor.vue`（2 range + 8 number）
  - 修改 `PaletteBar.vue`（1 select）
  - 修改 `Toolbar.vue`（2 select）

---

## 渲染性能优化轮（autoresearch 风格）

### 方法论

采用类似 [Karpathy autoresearch](https://github.com/karpathy/autoresearch) 的自动化实验循环：
- 创建 `scripts/bench-render.mjs` 基准测试脚本（类似 `uv run train.py`）
- 定义唯一指标：max_viable_params（能成功渲染的最大分辨率×质量×oversample 组合）
- 每次实验只改一处 → 跑 bench → keep/discard → 记录到 `bench-results.tsv`

### 基线测量

| 参数 | 状态 | render_ms |
|------|------|-----------|
| 800x600 q50 os2 | PASS | 1126 |
| 1920x1080 q20 os2 | PASS | 1914 |
| 1920x1080 q40 os2 | **FAIL** (dispatch=81,000 > maxWG=65,535) | — |

### GPU 选择修复

- **问题**: headless Chrome 默认使用 Intel Xe 集成显卡，RTX 3060 未被选中
- **修复**: Puppeteer 启动参数添加 `--force_high_performance_gpu`；`device.ts` 添加 `forceFallbackAdapter: false` 和 adapter 日志
- **效果**: 800x600 渲染时间从 ~1000ms 降至 ~43ms

### E1: 多批次 iterate（解决 dispatch 超限 + TDR 超时）✅

- **根因 1**: `dispatchWorkgroups(ceil(totalSamples/256))` 超出 `maxComputeWorkgroupsPerDimension=65535`
- **根因 2**: 单次 dispatch 执行时间超出 Windows TDR 超时（~2s），触发 `DXGI_ERROR_DEVICE_HUNG`
- **修复**:
  - iterate pass 拆分为多批次，每批 dispatch ≤ maxWorkgroups
  - 每批使用不同的 `thread_offset` 保证随机种子唯一
  - 每批单独 `queue.submit()` + `await onSubmittedWorkDone()` 避免 TDR
  - Params struct 新增 `thread_offset: u32` 字段，buffer 扩展至 28×4 字节（满足 WGSL 8 字节对齐）

### Alpha 通道修复 ✅

- **根因**: `filter.wgsl.ts` 最终输出 `textureStore(output_tex, vec4f(fr, fg, fb, 1.0))` 硬编码 alpha=1.0
- **修复**: 改为 `vec4f(fr, fg, fb, alpha)`

### 最终验证

| 参数 | 状态 | render_ms |
|------|------|-----------|
| 3840x2160 quality=4000 oversample=2 | **PASS** | 98,617 |

**目标达成**: 4K 分辨率 + 原版渲染质量 4000 + oversample 2，不动任何用户设置即可成功渲染

---

## 渲染性能优化轮 2（autoresearch 风格迭代实验）

### 方法论

采用 [Karpathy autoresearch](https://github.com/karpathy/autoresearch) 风格的自动化实验循环：
- 基准测试配置: `3840×2160 quality=4000 oversample=3`（os6 因直方图缓冲区超出 maxBufferSize 2048MB 不可用）
- 每次实验只改一处 → 跑 `bench-render.mjs` → keep/discard → 记录到 `bench-results.tsv`
- 3840×2160 os6 直方图 = `(6×3840+40)×(6×2160+40)×16` ≈ 4.48GB，超出 GPU maxBuffer 2048MB

### 基线

| 配置 | 状态 | render_ms |
|------|------|-----------|
| 3840×2160 q4000 os3 | PASS | 46,265 |

### E2: 提高 iters_per_thread (20→100) ✅

- **改动**: `pipeline.ts` 新增 `ITERS_PER_THREAD = 100` 常量；`runIterateBatches` 中 `totalThreads = totalSamples / (itersPerThread / 20)`，保持总迭代次数不变但减少线程数 5x，从而减少 dispatch 批次数（220→44）
- **结果**: 45,765ms (-1.1%)
- **原理**: 每线程 100 次迭代 + 20 次 fuse = 120 次，fuse 开销 17%（原 40 次，fuse 开销 50%）。减少批次数降低 CPU→GPU 同步开销

### E3+E4: 移除逐批 GPU 同步 — DISCARD

- **改动**: `runIterateBatches` 中移除每批 `await onSubmittedWorkDone()`，仅在循环结束后同步一次
- **结果**: 46,183ms（+0.9% vs E2 单独）
- **根因**: `writeBuffer` 到同一 params buffer 仍会将 GPU 执行序列化，移除 sync 无实际收益

### E5: 预构建 params buffer ✅

- **改动**: `runIterateBatches` 中预构建 `baseParams` ArrayBuffer，每批仅修改 3 个 u32 字段（num_samples、iters_per_thread、thread_offset）后整体 writeBuffer
- **结果**: 45,657ms (-0.2% vs E2)
- **决策**: 保留——代码简化，性能持平或微优

### E6: Workgroup size 调优 — DISCARD

- **wg=128**: 45,917ms (+0.6%) — 更差
- **wg=64**: 46,245ms (+1.3%) — 更差
- **结论**: RTX 3060 上 wg=256 最优

### E9: Fuse 周期缩减 — DISCARD

- **fuse=5**: 46,000ms (+0.8%) — 反而更慢
- **fuse=10**: 45,824ms (+0.4%) — 也更慢
- **根因**: 较短的 fuse 使线程在 IFS 轨迹未收敛时即写入直方图，命中离群像素，导致更多 cache miss。fuse=20 实际上改善了直方图写入的缓存局部性

### 性能瓶颈分析

迭代 pass 占总渲染时间 >99%。瓶颈为 GPU 端固有特征：
1. **atomicAdd 争用**: 所有线程随机写入大型直方图 buffer，无空间局部性，无法利用 workgroup 共享内存
2. **超越函数开销**: sin/cos/atan2/sqrt/pow 在变体计算中大量使用
3. **理论利用率**: ~7% of peak FLOPS（混合工作负载，atomics + 分支发散 + 超越函数）

### 最终验证

| 配置 | 状态 | render_ms |
|------|------|-----------|
| 3840×2160 q4000 os3 | **PASS** | 45,657 |

**总提升**: 46,265ms → 45,657ms = **-1.3%**

---

## 进度条实现

### 目标

渲染 4K q4000 级别的图像需 ~46 秒，用户无法得知进度。需要进度反馈。

### 实现方案: Toolbar 内嵌进度条

利用多批次 iterate 的天然进度节点（每批 `onSubmittedWorkDone()` 完成后回调）。

#### 1. 类型层 (`types/renderer.ts`)

- 扩展 `RenderProgress` 接口: 新增 `stage`（iterating/density/filtering/displaying/done）、`batchCompleted`、`totalBatches`、`percentage`
- 新增 `RenderProgressCallback` 类型

#### 2. Pipeline 层 (`renderer/pipeline.ts`)

- `runIterateBatches()` 新增 `onProgress?` 参数，每批完成后触发 `stage: 'iterating', percentage: round(batch/total × 90)`
- `render()` 新增 `onProgress?` 参数：iterate 后触发 `density`（92%）、`displaying`（98%）、`done`（100%）
- `renderToImageData()` 同样支持 `onProgress`

#### 3. Engine 层 (`renderer/engine.ts`)

- `render()` / `renderToImageData()` 透传 `onProgress`

#### 4. Store 层 (`stores/renderer.ts`)

- 新增 `renderProgress: ref<RenderProgress | null>(null)`
- 新增 `onProgress(progress)` 方法更新 reactive ref

#### 5. UI 层 (`components/Toolbar.vue`)

- 渲染按钮旁新增内嵌进度条: `<div class="progress-bar">` + `<div class="progress-fill">` + 阶段文字 + 百分比
- `computed stageLabel` 根据 `rendererStore.renderProgress.stage` 显示 i18n 标签
- 进度条样式: 120px 宽，绿色渐变填充，0.15s ease-out 过渡动画

#### 6. 国际化 (`i18n/locales/`)

- `zh-CN.ts`: 迭代中 / 密度估计 / 滤波中 / 显示中
- `en.ts`: Iterating / Estimating density / Filtering / Displaying

### 验证

- `pnpm run typecheck` ✅
- `pnpm run build` ✅（179KB gzipped 63KB）
- `bench-render.mjs` 4K q4000 os3 ✅ (45,756ms)
