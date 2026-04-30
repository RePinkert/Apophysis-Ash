# Apophysis Ash

[简体中文](./README.zh-CN.md) | **English**

Apophysis Ash (ash) is a modern rewrite of the classic fractal flame editor [Apophysis 7X](https://sourceforge.net/projects/apophysis7x/). Powered by WebGPU Compute Pipeline, it migrates the original CPU multi-threaded rendering entirely to the GPU, running in the browser.

## Features

- **WebGPU-accelerated rendering** — 4-pass GPU pipeline (IFS iteration → log-density estimation → Gaussian filter → gamma-corrected display)
- **23 variation functions** — 18 built-in + 5 extended (linear, sinusoidal, spherical, swirl, julia, julian, bubble, etc.)
- **File format compatibility** — Reads legacy `.flame` XML and new JSON format
- **Palette system** — Parses `.ugr` palette files, ships with 84 preset palettes
- **Random flame generation** — Randomized transforms, variations, and palettes
- **PNG export** — GPU readback → OffscreenCanvas export
- **Bilingual UI** — Chinese / English toggle

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Vue 3 Composition API |
| State | Pinia |
| GPU | WebGPU Compute Shader (WGSL) |
| Build | Vite + pnpm |
| Test | Puppeteer headless Chrome |

## Getting Started

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm run dev

# Production build
pnpm run build

# Type check
pnpm run typecheck

# Run render test (requires Chrome + WebGPU)
pnpm run test-render
```

> **Note**: Requires a WebGPU-capable browser (Chrome 113+, Edge 113+, or Firefox Nightly).

## Project Structure

```
src/
├── components/       # Vue UI components
├── i18n/             # Internationalization (zh-CN / en)
├── renderer/
│   ├── shaders/      # WGSL shaders
│   ├── buffers.ts    # GPU buffer construction
│   ├── device.ts     # WebGPU initialization
│   ├── engine.ts     # Render engine
│   └── pipeline.ts   # 4-pass pipeline
├── stores/           # Pinia stores
├── types/            # TypeScript type definitions
└── utils/            # Utility functions
```

## Acknowledgements

This project is a modern rewrite based on the rendering algorithms of [Apophysis 7X](https://sourceforge.net/projects/apophysis7x/) (originally by Mark Dobson and subsequent maintainers). The coordinate mapping and IFS iteration logic in the WGSL shaders are derived from the original Delphi source code.

## License

This project is licensed under the [GNU General Public License v2.0](./LICENSE), consistent with the original Apophysis 7X.
