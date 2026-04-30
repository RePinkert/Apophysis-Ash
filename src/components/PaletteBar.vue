<template>
  <div class="palette-section">
    <h3>{{ t('palette.title') }}</h3>

    <div class="palette-bar" :style="paletteGradient" @click="onBarClick"></div>

    <div class="palette-presets">
      <select v-wheel-step v-model="selectedPreset" @change="onPresetChange">
        <option value="">{{ t('palette.preset') }}</option>
        <option v-for="(p, i) in flameStore.palettes" :key="i" :value="i">
          {{ p.name || `Palette ${i + 1}` }}
        </option>
      </select>

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
const selectedPreset = ref('')

const paletteGradient = computed(() => {
  const colors = flameStore.flame.palette.colors
  const stops: string[] = []
  const step = Math.max(1, Math.floor(colors.length / 16))
  for (let i = 0; i < colors.length; i += step) {
    const c = colors[i]
    const pct = (i / (colors.length - 1)) * 100
    stops.push(`rgb(${c[0]},${c[1]},${c[2]}) ${pct.toFixed(1)}%`)
  }
  return { background: `linear-gradient(to right, ${stops.join(', ')})` }
})

function onBarClick(_e: MouseEvent) {}

function onPresetChange() {
  const idx = parseInt(selectedPreset.value)
  if (!isNaN(idx) && flameStore.palettes[idx]) {
    flameStore.setPalette(flameStore.palettes[idx])
    selectedPreset.value = ''
  }
}

async function onUGRFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) {
    await flameStore.loadPalettesFromUGR(file)
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

.palette-bar {
  width: 100%;
  height: 24px;
  border-radius: 4px;
  border: 1px solid #444;
  cursor: crosshair;
}

.palette-presets {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  align-items: center;
}

select, .file-btn {
  background: #16213e;
  color: #e0e0e0;
  border: 1px solid #444;
  padding: 4px 8px;
  border-radius: 3px;
  font-size: 11px;
  cursor: pointer;
}

.file-btn {
  white-space: nowrap;
}

select:hover, .file-btn:hover {
  background: #0f3460;
}
</style>
