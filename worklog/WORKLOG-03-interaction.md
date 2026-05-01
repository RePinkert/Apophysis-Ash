# WORKLOG-03 — Canvas 交互优化与变体库扩展

> 前序: [WORKLOG-02-ux-perf.md](WORKLOG-02-ux-perf.md) | 后续: [WORKLOG-04-latest.md](WORKLOG-04-latest.md)

## 项目概述

将古老的 Apophysis 7X16 分形火焰渲染器（Delphi VCL 桌面应用）现代化为基于 WebGPU 的浏览器应用。

**原项目**: Apophysis 7X16 — Delphi VCL 编译的 32/64 位桌面应用，CPU 多线程渲染
**新项目**: ash — TypeScript + Vue 3 + WebGPU Compute Pipeline，浏览器内运行

---

## Canvas 交互优化 — CSS Transform 即时预览

### 背景

Issue 1 实现的鼠标交互（平移/旋转/缩放）在每次 `mousemove` 事件中直接修改 flame 参数并触发 GPU re-render。对于 4K q4000 级别的渲染（耗时 ~46 秒），拖拽体验极差——用户移动鼠标后需等待完整渲染才能看到效果。

解决方案：交互过程中使用 CSS `transform` 提供即时视觉反馈，仅在交互结束时（mouseup / 滚轮停止 200ms）提交参数变更并触发 GPU 渲染。

### feat: CSS Transform 预览 ✅

- **提交**: `058bc27` — `RenderCanvas.vue` 大幅重构（196+/83-）
- **交互状态机**: `beginInteraction()` → CSS 变换预览 → `commitDrag()`/`commitWheel()` → 更新 flame 参数 + GPU 渲染
- **左键拖拽平移**: CSS `translate(dx, dy)` 预览，`mouseup` 时将像素偏移转换为分形坐标偏移并更新 `flame.center`
- **旋转**: 操作键从右键改为**中键或 Shift+左键**（避免与右键菜单冲突）；CSS `rotate(deg)` 预览 + 顶部居中角度指示器 overlay（`rotate-indicator`）
- **滚轮缩放**: CSS `scale(factor)` 预览，`transform-origin` 设为鼠标位置实现 zoom-to-cursor；滚轮停止 200ms 后 `commitWheel()` 提交
- **结构**: canvas 外层包裹 `position: relative` 的 `.canvas-wrapper` 容器，用于定位 rotate indicator overlay

### fix: 命令式 DOM 操作替代 Vue 响应式绑定 ✅

- **提交**: `eed8ea7`
- **根因**: Vue `:style` 绑定 + `computed` 响应式更新存在微延迟，快速交互时不流畅
- **修复**:
  - 移除 `<canvas :style="isInteracting ? canvasStyle : undefined">` 的 reactive 绑定
  - 改为 `applyCSSTransform()` / `clearCSSTransform()` 命令式直接操作 `canvas.style.transform`
  - `isInteracting` 从 `ref<boolean>` 改为 `let boolean`（无响应式追踪开销）

### fix: rotate/angle 双字段同步 ✅

- **提交**: `99c175f`
- **根因**: CSS 预览写 `flame.rotate`（度），GPU 渲染器通过 `buildParamsBuffer` 读 `flame.angle`（弧度）。交互结束时只更新了 `rotate`，`angle` 未同步 → CSS 预览旋转正确但 GPU 渲染结果未旋转
- **修复**: `commitDrag()` 中同时更新 `rotate` 和 `angle = rotate * π/180`

### fix: 旋转方向修正 ✅

- **提交**: `6b1c764`
- **修复**: `angle = -rotate * π/180` → `angle = rotate * π/180`（负号多余，匹配 Grand Julian 模板约定 angle=0.785, rotate=-45）

---

## 构图参考线

### 背景

原版 Apophysis 7X 提供 3 种主预览参考线（中心线、三分法、黄金比例），通过语言文件 `chinese.xml` 第 476-480 行确认。本项目扩展至 7 种常用摄影/美术构图参考线，支持同时叠加 2 条，并提供颜色和不透明度调节。

### 实现

#### 7 种参考线

| ID | 名称 | 绘制内容 |
|----|------|----------|
| `center` | 中心线 | 水平 + 垂直中心十字线 |
| `thirds` | 三分法 | 2 横 + 2 竖，位于 1/3 和 2/3 处（九宫格） |
| `phi-grid` | 黄金比例网格 | 2 横 + 2 竖，位于 φ≈0.618 和 1-φ≈0.382 处 |
| `golden-spiral` | 黄金螺旋 | 斐波那契螺旋线：递归分割黄金矩形，绘制最多 10 段四分之一圆弧 |
| `golden-triangle` | 黄金三角形 | 主对角线 + 中心垂线 + 从边缘点向对角线作投影线 |
| `diagonals` | 对角线 | 主/副对角线 + 边缘中点连线，形成 8 条放射线 |
| `harmonious-armature` | 和谐骨架 | 主对角线 + 从角到对边中点的交叉线 + φ 网格辅助线（半透明） |

#### 架构

- **覆盖层方式**: 在 WebGPU `<canvas>` 上层叠加透明 Canvas 2D 覆盖层（`pointer-events: none`），切换参考线不触发 GPU 重渲染
- **状态管理**: `stores/guides.ts` — `activeGuides: (GuideId|null)[]`（最多 2 层）、`guideColor`、`guideOpacity`，仅内存
- **绘制算法**: `utils/guides.ts` — 每种参考线一个纯函数 `(ctx, w, h, color, opacity) => void`
- **覆盖层组件**: `components/GuidesOverlay.vue` — 监听 store 变化 + 父容器 ResizeObserver 自动重绘，通过 `ctx.clip()` 裁剪到 canvas 渲染区域，缩放至 flame 坐标系绘制

#### UI

- ControlPanel 新增「参考线」分区：
  - 两个 `<select>` 选择器（层 1、层 2，层 2 仅在层 1 已选时可用）
  - `<input type="color">` 颜色选择器
  - `<input type="range">` 不透明度滑块（0.05~1.0）

#### RenderCanvas 改动

- 引入 `GuidesOverlay` 组件，嵌入 `.canvas-wrapper`
- 新增 `canvasLayout` reactive 对象追踪 canvas 渲染区域的 `offsetX/Y` 和 `renderedW/H`
- ResizeObserver 监听 canvas 尺寸变化，同步布局信息给覆盖层

### 涉及文件

| 文件 | 改动 |
|------|------|
| 新增 `src/utils/guides.ts` | 7 种参考线绘制算法 |
| 新增 `src/stores/guides.ts` | Pinia store（activeGuides / guideColor / guideOpacity） |
| 新增 `src/components/GuidesOverlay.vue` | Canvas 2D 覆盖层组件 |
| `src/components/RenderCanvas.vue` | 嵌入 GuidesOverlay + ResizeObserver 布局同步 |
| `src/components/ControlPanel.vue` | 参考线 UI 分区 |
| `src/i18n/locales/zh-CN.ts` | 参考线中文翻译 |
| `src/i18n/locales/en.ts` | 参考线英文翻译 |

### 验证

- `pnpm run typecheck` ✅
- `pnpm run build` ✅（198KB / gzip 66KB）

---

## 变体库扩展 — 第一批（9 个数学变体）

### 目标

扩展变体库从 23 → 32，实现原版 Apophysis 7X 中缺失的数学变体。

### 新增变体

| 索引 | 名称 | 算法 | 额外参数 |
|------|------|------|----------|
| 23 | `exponential` | `exp(x-1)*cos(πy), exp(x-1)*sin(πy)` | 无 |
| 24 | `power` | `pow(r,sin(a))*cos(a), pow(r,sin(a))*sin(a)` | 无 |
| 25 | `cosine` | `cos(πx)*cosh(y), -sin(πx)*sinh(y)` | 无 |
| 26 | `rings` | 环形模变换 | `rings_coeff` |
| 27 | `fan` | 分区扇形变换 | `fan_dist` |
| 28 | `blob` | 波浪圆形变换 | `blob_low`, `blob_high`, `blob_waves` |
| 29 | `pdj` | 四参数曲线族 | `pdj1`-`pdj4` |
| 30 | `perspective` | 透视投影 | `perspective_angle`, `perspective_dist` |
| 31 | `ngon` | N 边形变换 | `ngon_power`, `ngon_sides`, `ngon_corners`, `ngon_circle` |

### 涉及文件

| 文件 | 改动 |
|------|------|
| `types/renderer.ts` | `MAX_VARIATIONS`: 23 → 32 |
| `types/flame.ts` | `EXTENDED_VARIATION_NAMES` 新增 9 个名称 |
| `renderer/shaders/variations.wgsl.ts` | 新增 9 个 WGSL 函数 |
| `renderer/shaders/iterate.wgsl.ts` | XForm struct 扩展（var_weights 32 + 15 参数字段），新增 9 个 dispatch block |
| `renderer/buffers.ts` | `XFORM_STRUCT_SIZE` 更新，`buildXFormBuffer` 写入新参数 |
| `renderer/pipeline.ts` | `XFORMS_BUFFER_SIZE` 改用 `XFORM_STRUCT_SIZE`（消除硬编码） |
| `components/TransformEditor.vue` | 新增 6 个变体参数编辑区 |
| `parser/flame-xml.ts` | `isExtendedVariation()` 新增 9 个名称 |

### Bug 修复

- **WGSL `fmod` 不存在**: `variation_fan` 中 `fmod(a, b)` 改为 `a % b`
- **WGSL `let` 不可变**: `variation_fan` 和 `variation_ngon` 中 `let angle/theta` 改为 `var`
- **`XFORMS_BUFFER_SIZE` 硬编码**: 从 `MAX_XFORMS * 34 * 4` 改为 `MAX_XFORMS * XFORM_STRUCT_SIZE`
- **`XFORM_STRUCT_SIZE` 计数错误**: 14 → 15 个额外参数（rings_coeff 到 ngon_circle 共 15 个）

### 验证

- `pnpm run typecheck` ✅
- `pnpm run build` ✅（209KB / gzip 68KB，+11KB）
- `pnpm run test-render` ✅（GPU readback: 1,147,236 / 1,500,000 non-black）

---

## 变体库扩展 — 第二批（9 个变体）

### 新增变体

| 索引 | 名称 | 算法 | 额外参数 |
|------|------|------|----------|
| 32 | `curl` | 复数域 curl 变换 | `curl_c1`, `curl_c2` |
| 33 | `bipolar` | 双极坐标变换 | `bipolar_shift` |
| 34 | `elliptic` | 椭圆坐标变换 | 无 |
| 35 | `cell` | 细胞/棋盘格变换 | `cell_size` |
| 36 | `crackle` | 裂纹 Voronoi 变换 | `crackle_scale`, `crackle_z`, `crackle_spreadx`, `crackle_spready` |
| 37 | `juliascope` | Julia 对称版本 | `juliascope_power`, `juliascope_dist` |
| 38 | `split` | 轴分裂变换 | `split_xsize`, `split_ysize` |
| 39 | `wedge` | 楔形变换 | `wedge_angle`, `wedge_hole`, `wedge_count`, `wedge_swirl` |
| 40 | `wedge_julia` | Julia 楔形 | `wedge_julia_power`, `wedge_julia_angle`, `wedge_julia_count`, `wedge_julia_dist` |

### 涉及文件

同第一批模式，额外新增 21 个参数字段到 XForm struct 和 buffer。

### 验证

- `pnpm run typecheck` ✅
- `pnpm run build` ✅（224KB / gzip 71KB，+15KB）
- `pnpm run test-render` ✅（GPU readback: 1,147,236 / 1,500,000 non-black）

---

## 变体库扩展 — 第三批（9 个变体，含 post-transform）

### 新增变体

| 索引 | 名称 | 算法 | 额外参数 |
|------|------|------|----------|
| 41 | `wedge_sph` | 球面楔形 | `wedge_sph_angle`, `wedge_sph_hole`, `wedge_sph_count`, `wedge_sph_swirl` |
| 42 | `bwraps` | 边界包裹 | `bwraps_cellsize`, `bwraps_space`, `bwraps_gain`, `bwraps_innerTwist`, `bwraps_outerTwist` |
| 43 | `bwraps7` | bwraps 变体 | 同 bwraps |
| 44 | `motion_blur` | 运动模糊 | `motion_blur_angle`, `motion_blur_length` |
| 45 | `zblur` | Z 轴模糊 | 无（使用随机数） |
| 46 | `gaussian_blur` | 高斯模糊（Box-Muller） | 无（使用随机数） |
| 47 | `radial_blur` | 径向模糊 | `radial_blur_angle` |
| 48 | `post_rotate_x` | X 轴 3D 旋转 | 无（权重即角度） |
| 49 | `post_rotate_y` | Y 轴 3D 旋转 | 无（权重即角度） |

### post-transform 特殊处理

`post_rotate_x`/`post_rotate_y` 不走标准累加路径，在所有变体累加完成后作为 3D 旋转后投影应用。在 iterate shader 中 `px = accum.x; py = accum.y;` 之后插入条件逻辑。

### 最终变体总数

**50 个变体**（18 内置 + 32 扩展），完整覆盖原版 Apophysis 7X 核心变体集。

### 验证

- `pnpm run typecheck` ✅
- `pnpm run build` ✅（236KB / gzip 72KB，+12KB）
- `pnpm run test-render` ✅（GPU readback: 953,509 / 1,500,000 non-black）
