# Apophysis Next (ash)

## Commands

- `pnpm run dev` — Start dev server
- `pnpm run build` — Production build
- `pnpm run typecheck` — Run TypeScript type checking (use `vue-tsc --noEmit`)

## Architecture

- WebGPU compute pipeline renders fractal flames
- 4 GPU passes: iterate → density → filter → display
- 23 variation functions implemented in WGSL
- Supports legacy .flame XML and new JSON format
- Vue 3 + Pinia for state management
