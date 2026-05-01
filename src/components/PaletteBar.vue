<template>
  <div class="palette-section">
    <h3>{{ t('palette.title') }}</h3>

    <div class="palette-preview" :style="rotatedGradient"></div>

    <div class="palette-presets-row" ref="presetsRowRef">
      <div
        v-for="(p, i) in flameStore.palettes"
        :key="i"
        class="preset-swatch"
        :class="{ active: selectedIndex === i }"
        :style="swatchStyle(p)"
        :title="p.name || `Palette ${i + 1}`"
        @click="selectPreset(i)"
      ></div>
    </div>

    <div class="palette-controls">
      <label class="rotate-label">{{ t('palette.rotate') }}</label>
      <input
        type="range"
        min="-128"
        max="128"
        step="1"
        :value="flameStore.flame.paletteOffset"
        @input="onRotateChange"
        v-wheel-step
      />
      <span class="rotate-value">{{ flameStore.flame.paletteOffset }}</span>
    </div>

    <div class="palette-file">
      <label class="file-btn">
        {{ t('palette.loadUGR') }}
        <input type="file" accept=".ugr" @change="onUGRFile" hidden />
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useFlameStore } from '../stores/flame'
import { useI18n } from '../i18n'

const flameStore = useFlameStore()
const { t } = useI18n()
const selectedIndex = ref(-1)

function swatchStyle(palette: { colors: [number, number, number][] }) {
  const stops = samplePaletteStops(palette.colors, 8)
  return { background: `linear-gradient(to right, ${stops})` }
}

function samplePaletteStops(colors: [number, number, number][], count: number): string {
  const step = Math.max(1, Math.floor(colors.length / count))
  const parts: string[] = []
  for (let i = 0; i < colors.length; i += step) {
    const c = colors[i]
    const pct = (i / (colors.length - 1)) * 100
    parts.push(`rgb(${c[0]},${c[1]},${c[2]}) ${pct.toFixed(1)}%`)
  }
  return parts.join(', ')
}

const rotatedGradient = computed(() => {
  const colors = flameStore.flame.palette.colors
  const offset = flameStore.flame.paletteOffset
  const len = colors.length
  const rotated: [number, number, number][] = []
  for (let i = 0; i < len; i++) {
    const si = ((i - offset) % len + len) % len
    rotated.push(colors[si])
  }
  const stops = samplePaletteStops(rotated, 16)
  return { background: `linear-gradient(to right, ${stops})` }
})

function selectPreset(index: number) {
  selectedIndex.value = index
  const palette = flameStore.palettes[index]
  if (palette) {
    flameStore.setPalette(palette)
  }
}

function onRotateChange(e: Event) {
  const val = parseInt((e.target as HTMLInputElement).value)
  if (!isNaN(val)) {
    flameStore.setPaletteOffset(val)
  }
}

async function onUGRFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) {
    await flameStore.loadPalettesFromUGR(file)
    selectedIndex.value = -1
  }
  ;(e.target as HTMLInputElement).value = ''
}
</script>

<style scoped>
.palette-section {
  padding: 8px;
}

h3 {
  margin: 0 0 6px 0;
  color: #ccc;
  font-size: 13px;
}

.palette-preview {
  width: 100%;
  height: 28px;
  border-radius: 4px;
  border: 1px solid #555;
  margin-bottom: 8px;
}

.palette-presets-row {
  display: flex;
  gap: 3px;
  overflow-x: auto;
  padding-bottom: 4px;
  margin-bottom: 8px;
  scrollbar-width: thin;
  scrollbar-color: #555 #1a1a2e;
}

.palette-presets-row::-webkit-scrollbar {
  height: 4px;
}

.palette-presets-row::-webkit-scrollbar-track {
  background: #1a1a2e;
  border-radius: 2px;
}

.palette-presets-row::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 2px;
}

.preset-swatch {
  flex-shrink: 0;
  width: 36px;
  height: 22px;
  border-radius: 3px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.1s;
}

.preset-swatch:hover {
  transform: scaleY(1.15);
  border-color: #888;
}

.preset-swatch.active {
  border-color: #fff;
}

.palette-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.rotate-label {
  color: #aaa;
  font-size: 11px;
  white-space: nowrap;
}

.palette-controls input[type="range"] {
  flex: 1;
}

.rotate-value {
  color: #aaa;
  font-size: 11px;
  min-width: 28px;
  text-align: right;
  font-family: monospace;
}

.palette-file {
  margin-top: 4px;
}

.file-btn {
  display: inline-block;
  background: #16213e;
  color: #e0e0e0;
  border: 1px solid #444;
  padding: 3px 10px;
  border-radius: 3px;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
}

.file-btn:hover {
  background: #0f3460;
}
</style>
