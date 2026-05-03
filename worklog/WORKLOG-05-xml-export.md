# WORKLOG-05 — XML 导出兼容性修复

> 前序: [WORKLOG-04-final-transform.md](WORKLOG-04-final-transform.md) | 后续: [WORKLOG-06-export-compat.md](WORKLOG-06-export-compat.md)

## 项目概述

将古老的 Apophysis 7X16 分形火焰渲染器（Delphi VCL 桌面应用）现代化为基于 WebGPU 的浏览器应用。

**原项目**: Apophysis 7X16 — Delphi VCL 编译的 32/64 位桌面应用，CPU 多线程渲染
**新项目**: ash — TypeScript + Vue 3 + WebGPU Compute Pipeline，浏览器内运行

---

## XML 导出格式兼容性修复

### 问题

ash 导出的 `.flame` XML 文件在原版 Apophysis 7X 中打开时报错或不可用。即使已添加兼容性检查对话框（见 WORKLOG-04），导出的文件本身格式仍不兼容。

### 根因分析

通过对比 `X:\Temporary storage\NeoFractal\renders7X.flame`（原版 Apophysis 7X 生成）与 ash 导出的 XML，发现以下关键差异：

#### 原版 flame 格式参考

```xml
<flames name="renders7X">
<flame name="..." version="Apophysis 7x" size="3840 2160"
   center="..." scale="..." angle="..." rotate="..."
   oversample="6" filter="0.4" quality="4000"
   background="0 0 0" brightness="4" gamma="4" gamma_threshold="0.01"
   estimator_radius="9" estimator_minimum="0" estimator_curve="0.4"
   enable_de="0" plugins="" new_linear="1"
   curves="0 0 1 0 0 1 1 1 1 1 1 1 0 0 1 0 0 1 1 1 1 1 1 1 0 0 1 0 0 1 1 1 1 1 1 1 0 0 1 0 0 1 1 1 1 1 1 1" >
   <xform weight="..." color="..." linear="1" coefs="..." opacity="1" />
   <palette count="256" format="RGB">
      ...hex data in 64-char lines...
   </palette>
</flame>
</flames>
```

#### 差异表

| # | 属性 | 位置 | 原版 | ash（修复前） | 重要性 |
|---|------|------|------|---------------|--------|
| 1 | `version` | `<flame>` | `"Apophysis 7x"` | **缺失** | **致命** — 解析器用此识别格式 |
| 2 | `opacity` | `<xform>` | 总是 `"1"` | **缺失** | **致命** — 解析器可能要求此属性 |
| 3 | `new_linear` | `<flame>` | `"1"` | **缺失** | **高** — 影响 linear 变体处理 |
| 4 | `plugins` | `<flame>` | `""` | **缺失** | 中 — 列出所需插件 |
| 5 | `estimator_radius` | `<flame>` | `"9"` | **缺失** | 中 — 密度估计 |
| 6 | `estimator_minimum` | `<flame>` | `"0"` | **缺失** | 中 |
| 7 | `estimator_curve` | `<flame>` | `"0.4"` | **缺失** | 中 |
| 8 | `enable_de` | `<flame>` | `"0"` | **缺失** | 中 |
| 9 | `curves` | `<flame>` | `"0 0 1 0..."` | **缺失** | 中 — 色彩曲线（默认平直） |
| 10 | coefs 精度 | `<xform>` | 全精度 | `toFixed(6)` 截断 | 低 — 影响保真度 |

#### 默认 curves 值（平直曲线，4 通道）

```
0 0 1 0 0 1 1 1 1 1 1 1 0 0 1 0 0 1 1 1 1 1 1 1 0 0 1 0 0 1 1 1 1 1 1 1 0 0 1 0 0 1 1 1 1 1 1 1
```

### 修复 (`parser/flame-xml.ts`)

#### 1. `exportFlameXML()` — `<flame>` 标签补充属性

新增以下属性：
- `version="Apophysis 7x"`
- `new_linear="1"`
- `estimator_radius="9"`, `estimator_minimum="0"`, `estimator_curve="0.4"`, `enable_de="0"`
- `plugins=""`
- `curves="0 0 1 0 0 1 1 1 1 1 1 1 0 0 1 0 0 1 1 1 1 1 1 1 0 0 1 0 0 1 1 1 1 1 1 1 0 0 1 0 0 1 1 1 1 1 1 1"`

#### 2. `serializeXForm()` — 添加 `opacity="1"`

#### 3. `formatCoefs()` — 精度从 `toFixed(6)` 提升到 `toFixed(15)`

### 涉及文件

| 文件 | 改动 |
|------|------|
| `parser/flame-xml.ts` | `exportFlameXML()` 补充属性 + `serializeXForm()` 加 opacity + 精度提升 |
| `worklog/WORKLOG-04-final-transform.md` | 标题和导航链接更新 |
