# WORKLOG-01 — 项目初始化与核心实现

> 后续: [WORKLOG-02-ux-perf.md](WORKLOG-02-ux-perf.md)

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
