# WORKLOG-02 — UX 改善与渲染性能优化

> 前序: [WORKLOG-01-init.md](WORKLOG-01-init.md) | 后续: [WORKLOG-03-interaction.md](WORKLOG-03-interaction.md)

## 项目概述

将古老的 Apophysis 7X16 分形火焰渲染器（Delphi VCL 桌面应用）现代化为基于 WebGPU 的浏览器应用。

**原项目**: Apophysis 7X16 — Delphi VCL 编译的 32/64 位桌面应用，CPU 多线程渲染
**新项目**: ash — TypeScript + Vue 3 + WebGPU Compute Pipeline，浏览器内运行

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

---

## 渲染性能优化轮 3 — 高质量参数黑帧修复（autoresearch 风格）

### 问题

高质量参数（如 3840×2160 q1000 os5）导致黑帧（前端 ~4ms 出图），无错误提示。

### 根因

直方图缓冲区超出 GPU `maxBufferSize` (2048MB)：
- 4K os3: histogram = 1.12 GiB ✓, density = 1.12 GiB ✓
- 4K os5: histogram = 3.31 GiB ✗, density = 3.31 GiB ✗

`createBuffer()` 静默失败 → 所有 compute pass 无效 → 黑帧。

### 方法论

autoresearch 风格实验循环：
- 每次 bench 前跑 `pnpm run bench-render --width W --height H --quality Q --oversample OS`
- 唯一指标：`status` (pass/fail) + `render_ms`
- 结果记录到 `bench-results.tsv`

### E10: 紧凑直方图 + 合并 Density/Filter

- histogram 格式从 4×`atomic<u32>` (16 bytes/px) 改为 2×`atomic<u32>` (8 bytes/px)
- 打包: `buf[0] = (R<<16|G)`, `buf[1] = (B<<16|count)`
- 使用 `atomicCompareExchangeWeak` + 饱和加法（16 位 max 65535）
- 消除 density buffer：filter shader 直接读 compact histogram，就地计算密度
- 4K os5 histogram = 1.55 GiB ✓ (fits 2048MB)

**问题**: CAS 开销 ~2.6×，导致原本正常的配置（q4000 os3）TDR 崩溃

### E10-fix: 双管线自动切换 ✅

**策略**: 渲染时动态检测 buffer 尺寸，选择最优管线：

- **原始管线** (histogram 16B/px + density buffer): 当两个 buffer 均 ≤ `maxBufferSize` 时使用
  - `atomicAdd` 全精度，性能最优
  - 4K os1-os4 走此路径
- **紧凑管线** (histogram 8B/px, 无 density buffer): 当原始管线 buffer 超限时使用
  - `atomicCompareExchangeWeak` + 16 位饱和，merged density-filter
  - 每批最大 8M 线程（防 TDR）
  - 4K os5+ 走此路径

**决策点**: `useCompactPath(histW, histH)` — 比较 `histW × histH × 16` vs `maxBufferSize`

### 涉及文件

| 文件 | 改动 |
|------|------|
| `renderer/shaders/iterate.wgsl.ts` | 新增 `ITERATE_COMPACT_SHADER`（CAS 打包写入） |
| `renderer/shaders/filter.wgsl.ts` | 新增 `FILTER_COMPACT_SHADER`（合并密度估计+滤波） |
| `renderer/shaders/density.wgsl.ts` | 恢复原始密度着色器（被 E10 误删） |
| `renderer/pipeline.ts` | 双管线架构：5 个 compute pipeline + 动态选择 |
| `package.json` | 新增 `bench-render` script |

### 结果

| 配置 | 状态 | render_ms | 路径 |
|------|------|-----------|------|
| 3840×2160 q4000 os3 (基线) | **PASS** | 45,378 | 原始 atomicAdd |
| 3840×2160 q1000 os5 (修复目标) | **PASS** | 13,549 | 紧凑 CAS |

**修复**: 黑帧 95ms → 正常渲染 13.5s
**无回归**: q4000 os3 性能持平（45,378ms vs 45,747ms baseline）

### 防御性措施

- `ensureHistogramBuffer()` 检查 histogram size ≤ `maxBufferSize`，超限时抛出明确错误
- 紧凑管线每批线程数限制 8M，防止 TDR 超时
