<template>
  <div class="palette-section">
    <h3>{{ t('palette.title') }}</h3>

    <div class="palette-preview" :style="rotatedGradient"></div>

    <div class="palette-dropdown" ref="dropdownRef">
      <div class="dropdown-trigger" @click="toggleDropdown" tabindex="0"
        @keydown.up.prevent="onKeyNav(-1)" @keydown.down.prevent="onKeyNav(1)" @keydown.enter.prevent="onEnter"
        @keydown.escape="closeDropdown"
        @wheel.prevent="onTriggerWheel">
        <div class="trigger-swatch" :style="triggerStyle"></div>
        <span class="trigger-name">{{ selectedName }}</span>
        <span class="trigger-arrow">{{ isOpen ? '\u25B2' : '\u25BC' }}</span>
      </div>
      <div v-if="isOpen" class="dropdown-list" @wheel.prevent="onListWheel">
        <div
          v-for="(p, i) in flameStore.palettes"
          :key="i"
          class="dropdown-option"
          :class="{ hovered: hoveredIndex === i, selected: selectedIndex === i }"
          @click="selectPreset(i)"
          @mouseenter="hoveredIndex = i"
          @mouseleave="hoveredIndex = -1"
        >
          <div class="option-swatch" :style="swatchStyle(p)"></div>
          <span class="option-name">{{ p.name || `Palette ${i + 1}` }}</span>
        </div>
      </div>
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
import { computed, ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useFlameStore } from '../stores/flame'
import { useI18n } from '../i18n'

const flameStore = useFlameStore()
const { t } = useI18n()
const selectedIndex = ref(-1)
const isOpen = ref(false)
const hoveredIndex = ref(-1)
const dropdownRef = ref<HTMLElement | null>(null)

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

const selectedName = computed(() => {
  if (selectedIndex.value < 0) return t('palette.preset')
  const p = flameStore.palettes[selectedIndex.value]
  return p?.name || `Palette ${selectedIndex.value + 1}`
})

const triggerStyle = computed(() => {
  if (selectedIndex.value < 0) {
    return { background: '#333' }
  }
  const p = flameStore.palettes[selectedIndex.value]
  return p ? swatchStyle(p) : { background: '#333' }
})

const rotatedGradient = computed(() => {
  const colors = flameStore.flame.palette.colors
  const offset = flameStore.flame.paletteOffset
  const len = colors.length
  const rotated: [number, number, number][] = []
  for (let i = 0; i < len; i++) {
    const si = ((i + offset) % len + len) % len
    rotated.push(colors[si])
  }
  const stops = samplePaletteStops(rotated, 16)
  return { background: `linear-gradient(to right, ${stops})` }
})

function toggleDropdown() {
  isOpen.value = !isOpen.value
  if (isOpen.value && selectedIndex.value >= 0) {
    hoveredIndex.value = selectedIndex.value
    nextTick(() => {
      const list = dropdownRef.value?.querySelector('.dropdown-list')
      const opt = list?.children[selectedIndex.value] as HTMLElement | undefined
      opt?.scrollIntoView({ block: 'nearest' })
    })
  }
}

function closeDropdown() {
  isOpen.value = false
}

function onEnter() {
  if (isOpen.value && hoveredIndex.value >= 0) {
    selectPreset(hoveredIndex.value)
  } else {
    toggleDropdown()
  }
}

function selectPreset(index: number) {
  selectedIndex.value = index
  const palette = flameStore.palettes[index]
  if (palette) {
    flameStore.setPalette(palette)
  }
  isOpen.value = false
}

function onKeyNav(delta: number) {
  if (!isOpen.value) {
    isOpen.value = true
    if (selectedIndex.value >= 0) {
      hoveredIndex.value = selectedIndex.value
    } else {
      hoveredIndex.value = delta > 0 ? 0 : flameStore.palettes.length - 1
    }
    return
  }
  let next = hoveredIndex.value < 0 ? (delta > 0 ? 0 : flameStore.palettes.length - 1) : hoveredIndex.value + delta
  next = Math.max(0, Math.min(next, flameStore.palettes.length - 1))
  hoveredIndex.value = next
  const list = dropdownRef.value?.querySelector('.dropdown-list')
  const opt = list?.children[next] as HTMLElement | undefined
  opt?.scrollIntoView({ block: 'nearest' })
}

function onListWheel(e: WheelEvent) {
  const len = flameStore.palettes.length
  if (len === 0) return
  const dir = e.deltaY > 0 ? 1 : -1
  let next = hoveredIndex.value < 0 ? (dir > 0 ? 0 : len - 1) : hoveredIndex.value + dir
  if (next < 0) next = len - 1
  if (next >= len) next = 0
  hoveredIndex.value = next
  const list = dropdownRef.value?.querySelector('.dropdown-list')
  const opt = list?.children[next] as HTMLElement | undefined
  opt?.scrollIntoView({ block: 'nearest' })
}

function onTriggerWheel(e: WheelEvent) {
  const len = flameStore.palettes.length
  if (len === 0) return
  const dir = e.deltaY > 0 ? 1 : -1
  let next = selectedIndex.value + dir
  if (next < 0) next = len - 1
  if (next >= len) next = 0
  selectPreset(next)
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

function onClickOutside(e: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', onClickOutside, true))
onUnmounted(() => document.removeEventListener('click', onClickOutside, true))
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

.palette-dropdown {
  position: relative;
  margin-bottom: 8px;
}

.dropdown-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: #1a1a2e;
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
}

.dropdown-trigger:hover {
  border-color: #666;
}

.dropdown-trigger:focus {
  outline: 2px solid #5599ff;
  outline-offset: -2px;
}

.trigger-swatch {
  flex-shrink: 0;
  width: 80px;
  height: 18px;
  border-radius: 2px;
}

.trigger-name {
  flex: 1;
  color: #ddd;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trigger-arrow {
  color: #888;
  font-size: 10px;
  flex-shrink: 0;
}

.dropdown-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 260px;
  overflow-y: auto;
  background: #1a1a2e;
  border: 1px solid #555;
  border-top: none;
  border-radius: 0 0 4px 4px;
  z-index: 100;
  scrollbar-width: thin;
  scrollbar-color: #555 #1a1a2e;
}

.dropdown-list::-webkit-scrollbar {
  width: 6px;
}

.dropdown-list::-webkit-scrollbar-track {
  background: #1a1a2e;
}

.dropdown-list::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 3px;
}

.dropdown-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  cursor: pointer;
  transition: background 0.1s;
}

.dropdown-option:hover {
  background: #0f3460;
}

.dropdown-option.hovered {
  background: #0f3460;
}

.dropdown-option.selected {
  background: #162447;
  border-left: 3px solid #5599ff;
  padding-left: 5px;
}

.option-swatch {
  flex-shrink: 0;
  width: 80px;
  height: 16px;
  border-radius: 2px;
}

.option-name {
  color: #ccc;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
