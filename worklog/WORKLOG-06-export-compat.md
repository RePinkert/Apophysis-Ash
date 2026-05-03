# WORKLOG-06 — 导出兼容性深化：参数别名 + 变体分类 + 缺省参数

> 前序: [WORKLOG-05-xml-export.md](WORKLOG-05-xml-export.md)

## 项目概述

将古老的 Apophysis 7X16 分形火焰渲染器（Delphi VCL 桌面应用）现代化为基于 WebGPU 的浏览器应用。

**原项目**: Apophysis 7X16 — Delphi VCL 编译的 32/64 位桌面应用，CPU 多线程渲染
**新项目**: ash — TypeScript + Vue 3 + WebGPU Compute Pipeline，浏览器内运行

---

## 问题

在 WORKLOG-05 中修复了 XML 格式兼容性后，导出的 `.flame` 文件在原版 Apophysis 7X16 中加载仍有三类问题：

1. **参数名不匹配**: ash 内部用 `pdj1`-`pdj4`，原版 XML 用 `pdj_a`-`pdj_d`；`bwraps_innerTwist` vs `bwraps_inner_twist`
2. **变体分类不准**: `INCOMPATIBLE_VARIATIONS` 把 16 个变体笼统归为"不兼容"，但实际分两类——有的只需插件 DLL 即可（handkerchief、fisheye、crackle），有的完全不存在（bent、popcorn、exponential 等）
3. **参数缺失**: 参数化变体（如 `bwraps7`）如果用户未手动设置参数，导出时该变体参数会被完全省略，导致原版报错
4. **随机生成器未初始化参数**: `randomXForm()` 只为 `julian` 设置参数，其他参数化变体（`pdj`、`ngon`、`curl` 等）生成的 xform 缺少参数

---

## 自动化分类工具

### `scripts/classify-variations.mjs`

对 `Apophysis7X64.exe` 做二进制字符串搜索，对全部 50 个变体名做 ANSI + UTF-16LE 命中统计，与 `Plugins/` 目录交叉引用：

| 分类规则 | 含义 |
|----------|------|
| UTF16 >= 1 | **BUILTIN** — 字符串在 EXE 中以宽字符出现，编译时内置 |
| ANSI >= 3 | **BUILTIN\*** — 仅 ANSI 命中，可能内置 |
| 有 DLL 但 EXE 无命中 | **PLUGIN** — 需外部 DLL |
| ANSI = 0 且无 DLL | **UNSUPPORTED** — 原版 7X 不存在 |

### `scripts/find-params.mjs`

在 EXE 二进制中搜索变体名附近的 UTF-16LE 字符串，用于发现变体参数的正确名称。

---

## 修复详情

### 1. 参数别名系统 (`types/flame.ts`)

新增 `PARAM_EXPORT_ALIASES` / `PARAM_IMPORT_ALIASES` 双向映射，在 XML 边界上转换参数名：

| 内部名 (ash) | XML 名 (原版) |
|---------------|---------------|
| `pdj1` | `pdj_a` |
| `pdj2` | `pdj_b` |
| `pdj3` | `pdj_c` |
| `pdj4` | `pdj_d` |
| `bwraps_innerTwist` | `bwraps_inner_twist` |
| `bwraps_outerTwist` | `bwraps_outer_twist` |
| `bwraps7_innerTwist` | `bwraps7_inner_twist` |
| `bwraps7_outerTwist` | `bwraps7_outer_twist` |

**设计决策**: 不修改内部参数名（`pdj1`-`pdj4`），因为 `buffers.ts` 中 GPU shader 直接使用这些名称。只在 XML 导入/导出边界做映射。

### 2. 变体分类重构 (`types/flame.ts`)

旧 `INCOMPATIBLE_VARIATIONS`（16 个混在一起）→ 拆分为两个精确集合：

```typescript
// 需插件 DLL，原版 7X 安装对应 DLL 后可用
export const PLUGIN_VARIATION_NAMES = new Set([
  'handkerchief', 'fisheye', 'crackle',
])

// 原版 7X 完全不支持，无论是否装 DLL
export const UNSUPPORTED_VARIATIONS = new Set([
  'bent', 'popcorn', 'exponential', 'cosine', 'blob',
  'wedge_julia', 'wedge_sph', 'motion_blur',
])
```

**分类依据**: 二进制搜索（UTF-16LE 命中数）+ `Plugins/` 目录 DLL 交叉验证。

**注意**: 后续实测（Vortex 544）发现二进制搜索对短词/常见词有误报——`fan`（8 UTF16 命中）、`perspective`（4 命中）、`waves`（25 命中）实际在原版中不可用，需要移入 `UNSUPPORTED`（尚未执行）。

`ExportCompatibility` 接口从 `{ incompatible: string[] }` 改为 `{ pluginRequired: string[], unsupported: string[] }`。

### 3. 缺省参数自动补充 (`parser/flame-xml.ts`)

新增 `VARIATION_REQUIRED_PARAMS`：定义每个参数化变体的所有参数及默认值。

`serializeXForm()` 导出时，如果 xform 使用了某参数化变体但缺少某个参数，自动补充默认值：

```typescript
for (const [varName, w] of xf.variations) {
  if (w === 0) continue
  const defaults = VARIATION_REQUIRED_PARAMS[varName]
  if (!defaults) continue
  for (const [paramName, defaultVal] of Object.entries(defaults)) {
    if (!xf.variationParams.has(paramName)) {
      attrs.push(`${PARAM_EXPORT_ALIASES[paramName] ?? paramName}="${defaultVal}"`)
    }
  }
}
```

### 4. 动态 `plugins` 属性 (`parser/flame-xml.ts`)

原 `plugins=""` 硬编码 → 扫描所有 xform 中使用的变体，动态生成插件列表：

```typescript
const pluginNames = new Set<string>()
for (const xf of [...flame.xforms, flame.finalXform].filter(Boolean) as XForm[]) {
  for (const [name, w] of xf.variations) {
    if (w !== 0 && PLUGIN_VARIATION_NAMES.has(name)) pluginNames.add(name)
  }
}
attrs.push(`plugins="${[...pluginNames].join(' ')}"`)
```

### 5. 随机生成器参数初始化 (`utils/random-flame.ts`)

`randomXForm()` 原来只初始化 `julian` 的参数。现在遍历 `VARIATION_REQUIRED_PARAMS`，为所有使用的参数化变体自动填充参数：

- 整数型参数（`power`、`count`、`sides`）: `randInt(2, 20)`
- 非零默认值参数: `rand(default * 0.5, default * 1.5)`
- 零默认值参数: `rand(-1.5, 1.5)`

### 6. 双类别兼容性对话框 (`components/Toolbar.vue`)

导出确认对话框从单一"不兼容"列表改为两个分区：

```
以下变体需要原版 Apophysis 7X 加载对应插件：
handkerchief, fisheye

以下变体在原版 Apophysis 7X 中不可用：
blob, wedge_julia

仍要导出吗？
```

### 7. 国际化 (`i18n/locales/`)

新增 `export.pluginMsg` 键：
- zh-CN: `"以下变体需要原版 Apophysis 7X 加载对应插件："`
- en: `"The following variations require plugins in original Apophysis 7X:"`

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `types/flame.ts` | 新增 `PARAM_EXPORT_ALIASES`/`PARAM_IMPORT_ALIASES`、`VARIATION_REQUIRED_PARAMS`、`PLUGIN_VARIATION_NAMES`、`UNSUPPORTED_VARIATIONS`；`ExportCompatibility` 接口重构 |
| `parser/flame-xml.ts` | 导入参数别名、导出参数别名、缺省参数补充、动态 plugins 属性、`checkExportCompatibility` 双类别返回 |
| `components/Toolbar.vue` | 双类别导出确认对话框 |
| `utils/random-flame.ts` | `randomXForm()` 自动初始化所有参数化变体参数 |
| `i18n/locales/zh-CN.ts` | 新增 `export.pluginMsg` |
| `i18n/locales/en.ts` | 新增 `export.pluginMsg` |
| `scripts/classify-variations.mjs` | **新文件** — EXE 二进制搜索变体分类脚本 |
| `scripts/find-params.mjs` | **新文件** — EXE 二进制参数名发现脚本 |

## 验证

- `pnpm run typecheck` ✅
- `pnpm run build` ✅（268KB / gzip 78KB）

---

## 实测记录

### 测试 1: Fractal Dream 332
- **错误**: `crackle`、`ex` 缺失
- **修复**: `crackle` 加入 `PLUGIN_VARIATION_NAMES`，`ex` 二进制搜索确认 BUILTIN（UTF16: 2）
- **结果**: crackle 通过 plugins 属性加载 DLL 解决

### 测试 2: Bloom 464
- **错误**: `pdj1`/`pdj2`/`pdj3`/`pdj4` 参数名不匹配
- **修复**: 添加 `pdj1`→`pdj_a` 等别名映射
- **结果**: 解决

### 测试 3: Dragon 738
- **错误**: `exponential`、`perspective`、`fisheye` 缺失
- **修复**: `fisheye` 加入 `PLUGIN_VARIATION_NAMES`；`exponential` 确认 UNSUPPORTED；`perspective` 误分类为 BUILTIN
- **结果**: 部分解决（perspective 待修正）

### 测试 4: Nebula 264
- **错误**: `exponential`、`motion_blur` 不可用
- **确认**: 二者均已在 `UNSUPPORTED_VARIATIONS` 中
- **结果**: 符合预期（导出时弹警告）

### 测试 5: Vortex 544
- **错误**: `fan`、`waves`、`perspective`、`popcorn`、`wedge_julia`、`cosine`、`motion_blur` 不可用
- **发现**: `fan`（二进制 UTF16: 8）、`perspective`（4）、`waves`（25）均为**二进制搜索误报**——这些常见英文词出现在 UI/帮助文本中，而非变体注册名
- **影响**: `fan`、`perspective`、`waves` 当前被分类为 BUILTIN，实际应为 UNSUPPORTED

---

## 已知遗留问题

### 1. 二进制搜索误报（高优先级）

以下变体被分类为 BUILTIN 但实测不可用，需移入 `UNSUPPORTED_VARIATIONS`：

| 变体 | 二进制 UTF16 命中 | 误报原因 | 实测来源 |
|------|------------------|----------|----------|
| `fan` | 8 | "fan" 是常见英文词 | Vortex 544 |
| `perspective` | 4 | "perspective" 出现在相机 UI | 3 个 flame |
| `waves` | 25 | "waves" 在 UI/帮助文本中高频 | Vortex 544 |

### 2. 未测试变体（中优先级）

以下变体未在任何测试 flame 中出现，二进制搜索结果可能不可靠：

`power`(UTF16:20)、`rings`(7)、`cell`(19)、`split`(7)、`wedge`(17)、`bwraps`(2)

短词/常见词（`power`、`rings`、`split`）尤其可能有误报。

### 3. 参数名映射不完整（低优先级）

`scripts/find-params.mjs` 发现部分参数名在 EXE 中找不到，可能原版使用不同命名。已通过 `VARIATION_REQUIRED_PARAMS` 的默认值机制兜底——即使参数名不完全匹配，导出文件仍包含合理默认值。

---

> **后续**: WORKLOG-06 中发现的 XML 格式偏差和插件路径问题在 [WORKLOG-07-xml-format-alignment.md](WORKLOG-07-xml-format-alignment.md) 中修复。
