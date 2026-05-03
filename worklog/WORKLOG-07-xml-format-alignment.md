# WORKLOG-07 — XML 格式对齐 Apo7X 源码 + 插件路径排查

> 前序: [WORKLOG-06-export-compat.md](WORKLOG-06-export-compat.md)

## 问题

导出的 `.flame` 文件在原版 Apophysis 7X 中加载时存在两类问题：

1. **XML 格式偏差**：属性顺序、finalxform 格式、缺失属性等与原版不一致
2. **插件变体报错**：`cell` 等插件变体即使 DLL 存在也报 "需要插件"

---

## 调研

### 方法

对照 [Apophysis 7X 源码](https://github.com/xyrus02/apophysis-7x)（`ParameterIO.pas`、`XForm.pas`、`XFormMan.pas`）和 [flam3](https://github.com/scottdraves/flam3)（`flam3.c`、`parser.c`）的 XML 序列化代码，逐项比对 ash 导出实现。

### 关键发现

#### XML 格式差异

| 项 | ash（修复前） | Apo7X 原版 |
|----|--------------|-----------|
| finalxform | 复用 `serializeXForm()`，含 `weight`、`opacity` | 无 `weight`、无 `opacity`、无 `chaos`、无 `name` |
| xform 属性顺序 | `weight → color → symmetry → coefs → variations` | `weight → color → symmetry → variations → coefs → post → opacity` |
| `<flame>` 缺少 `time` | 无 | `time="0"` |
| `version` 大小写 | `Apophysis 7x` | `Apophysis 7X` |
| palette 换行 | 64 字符/行 | 48 字符/行（8 色 × 6 hex） |

#### `plugins` 属性机制

- Apo7X **写入** `plugins="..."` 但**读取时完全忽略**
- 插件 DLL 在启动时从 `ApoPluginSrc.dat` 指定路径全量加载，不支持按需加载
- "需要插件" 弹窗由 `MissingPlugin.pas` 触发：在解析 xform 时遇到未注册的变体名即报错，与 `plugins` 属性无关

#### `linear` 变体名

- Apo7X 注册名为 `linear`（不是 `linear3D`）
- `linear3D` 仅作为兼容别名在解析时支持
- ash 使用 `linear` 是正确的 ✅

#### `var_type` 属性

- Apo7X 源码中**不存在** `var_type`，这是旧版概念
- ash 已将其列入 `XFORM_RESERVED_ATTRS` 用于跳过，无实际影响 ✅

---

## 修复详情

### 1. 拆分 `serializeXForm` → `serializeXForm` + `serializeFinalXForm` (`parser/flame-xml.ts`)

- `serializeXForm`：regular xform，含 `weight`、`opacity`
- `serializeFinalXForm`：不含 `weight`、`opacity`、`chaos`、`name`
- 共享变体序列化逻辑提取为 `serializeVariations()`

### 2. 属性顺序对齐

```
# regular xform (Apo7X: XForm.pas ToXMLString)
weight → color → symmetry → [variations] → coefs → post → opacity

# final xform (Apo7X: XForm.pas FinalToXMLString)
color → symmetry → [variations] → coefs → post
```

### 3. `<flame>` 元素补全

- 新增 `time="0"`
- `version="Apophysis 7x"` → `version="Apophysis 7X"`

### 4. palette 换行调整

- 64 字符/行 → 48 字符/行（8 色/行，与 Apo7X `ColorToXmlCompact` 一致）

### 5. 插件路径排查

- 根因：`ApoPluginSrc.dat` 内容为 `C:\Users\Pinkert\Desktop\Apophysis.7X16\Plugins\`，该路径不存在
- 修复：更新为当前路径 `X:\Temporary storage\Apophysis.7X16\Plugins\`
- 修复后 Apo7X64.exe 正常加载 `cell` 等插件变体，"需要插件" 弹窗消失

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `parser/flame-xml.ts` | 拆分 serializeXForm/serializeFinalXForm、属性顺序、time、version、palette 换行 |
| `ApoPluginSrc.dat` | 插件路径修正（项目外部，不纳入 git） |

---

## 验证

- `pnpm run typecheck` ✅
- `pnpm run build` ✅（268KB / gzip 78KB）
- Apophysis7X64.exe 加载导出的 flame 文件，`cell` 变体不再报错 ✅

---

## 已知遗留问题

1. **`ApoPluginSrc.dat` 路径是用户级配置**：不同用户的 Apo7X 安装位置不同，插件路径需各自配置。ash 无法控制此文件，应在 README 中说明。
2. **部分变体分类仍可能不准**：继承自 WORKLOG-06 的二进制搜索误报问题（`fan`、`perspective`、`waves`）。
3. **`curves` 属性硬编码**：当前输出默认值，Apo7X XML 兼容加载器不读取此属性，无实际影响但不够精确。
