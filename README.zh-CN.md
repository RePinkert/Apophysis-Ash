# Apophysis Ash

**简体中文** | [English](./README.md)

Apophysis Ash (ash) 是经典分形火焰编辑器 [Apophysis 7X](https://sourceforge.net/projects/apophysis7x/) 的现代化重写。基于 WebGPU Compute Pipeline，将原本的 CPU 多线程渲染完全迁移到 GPU，在浏览器中运行。

## 功能

- **WebGPU 加速渲染** — 4-pass GPU 管线（IFS 迭代 → 对数密度估计 → 高斯滤波 → Gamma 校正显示）
- **23 种变体函数** — 18 种内置变体 + 5 种扩展变体（linear, sinusoidal, spherical, swirl, julia, julian, bubble 等）
- **文件格式兼容** — 支持旧版 `.flame` XML 格式和新 JSON 格式读写

> **兼容性说明**: 导出的 `.flame` 文件遵循 Apophysis 7X XML 格式，但不保证在所有原版软件配置下完全兼容。原版 Apophysis 7X 从 `ApoPluginSrc.dat`（位于可执行文件旁）指定的路径加载插件 DLL，默认为 `<exe目录>\Plugins\`。如果插件 DLL 缺失或路径配置不正确，依赖插件的变体（如 `cell`、`crackle`、`handkerchief`）将无法加载。此外，ash 中实现的部分变体在原版 Apophysis 7X 中不存在，导出时会弹出警告。
- **调色板系统** — 解析 `.ugr` 调色板文件，内置 84 个预设调色板
- **随机火焰生成** — 随机变换组合、变体和调色板
- **PNG 导出** — GPU readback → OffscreenCanvas 导出
- **双语界面** — 中文 / English 切换

## 技术栈

| 组件 | 技术 |
|------|------|
| 前端框架 | Vue 3 Composition API |
| 状态管理 | Pinia |
| GPU 渲染 | WebGPU Compute Shader (WGSL) |
| 构建 | Vite + pnpm |
| 测试 | Puppeteer headless Chrome |

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm run dev

# 生产构建
pnpm run build

# 类型检查
pnpm run typecheck

# 运行渲染测试（需要 Chrome + WebGPU 支持）
pnpm run test-render
```

> **注意**: 需要支持 WebGPU 的浏览器（Chrome 113+、Edge 113+ 或 Firefox Nightly）。

## 项目结构

```
src/
├── components/       # Vue UI 组件
├── i18n/             # 国际化（中/英）
├── renderer/
│   ├── shaders/      # WGSL 着色器
│   ├── buffers.ts    # GPU buffer 构建
│   ├── device.ts     # WebGPU 初始化
│   ├── engine.ts     # 渲染引擎
│   └── pipeline.ts   # 4-pass 管线
├── stores/           # Pinia 状态管理
├── types/            # TypeScript 类型定义
└── utils/            # 工具函数
```

## 致谢

本项目基于 [Apophysis 7X](https://sourceforge.net/projects/apophysis7x/)（原作者 Mark Dobson 及后续维护者）的渲染算法进行现代化重写。WGSL 着色器中的坐标映射和 IFS 迭代逻辑参照了原版 Delphi 源码。

## 许可证

本项目基于 [GNU General Public License v2.0](./LICENSE) 开源，与原版 Apophysis 7X 保持一致。

网站图标由 RePinkert 创作，采用 [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/) 协议授权。
