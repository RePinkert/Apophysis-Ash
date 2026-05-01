<template>
  <div class="toolbar">
    <div class="toolbar-group">
      <button @click="flameStore.undo()" :disabled="!flameStore.canUndo" :title="t('toolbar.undo')">&#x21A9;</button>
      <button @click="flameStore.redo()" :disabled="!flameStore.canRedo" :title="t('toolbar.redo')">&#x21AA;</button>
      <label class="file-btn">
        {{ t('toolbar.openFile') }}
        <input type="file" accept=".flame,.xml,.json" @change="onFileOpen" hidden />
      </label>
      <button @click="onSaveJSON">{{ t('toolbar.saveJSON') }}</button>
      <button @click="onSaveFlame">{{ t('toolbar.saveFlame') }}</button>
      <button @click="onExportPNG">{{ t('toolbar.exportPNG') }}</button>
      <button class="btn-accent" @click="flameStore.generateRandom()">{{ t('toolbar.random') }}</button>
    </div>
    <div class="toolbar-group">
      <select v-wheel-step v-model="selectedTemplate" @change="onTemplateChange">
        <option value="">{{ t('toolbar.loadTemplate') }}</option>
        <option v-for="(tpl, i) in templates" :key="i" :value="i">{{ tpl.name }}</option>
      </select>
    </div>
    <div class="toolbar-group">
      <button @click="$emit('render')" :disabled="!gpuSupported">
        {{ isRendering ? t('toolbar.rendering') : t('toolbar.render') }}
      </button>
      <div v-if="isRendering && rendererStore.renderProgress" class="progress-container">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: rendererStore.renderProgress.percentage + '%' }"></div>
        </div>
        <span class="progress-text">{{ stageLabel }} {{ rendererStore.renderProgress.percentage }}%</span>
      </div>
      <span v-if="!isRendering && lastRenderTime > 0" class="render-time">
        {{ lastRenderTime.toFixed(0) }}ms
      </span>
    </div>
    <div class="toolbar-group">
      <select v-wheel-step v-model="lang" @change="onLangChange" class="lang-select">
        <option v-for="l in availableLocales" :key="l.value" :value="l.value">{{ l.label }}</option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useFlameStore } from '../stores/flame'
import { useRendererStore } from '../stores/renderer'
import { useI18n } from '../i18n'
import type { Flame } from '../types/flame'
import { checkExportCompatibility } from '../parser/flame-xml'

defineProps<{
  gpuSupported: boolean
  isRendering: boolean
  lastRenderTime: number
}>()

defineEmits<{ render: [] }>()

const flameStore = useFlameStore()
const rendererStore = useRendererStore()
const { t, setLocale, getAvailableLocales } = useI18n()
const availableLocales = getAvailableLocales()

const lang = ref('zh-CN')
const templates = ref<Flame[]>([])
const selectedTemplate = ref('')

const stageLabel = computed(() => {
  const stage = rendererStore.renderProgress?.stage
  if (stage === 'iterating') return t('progress.iterating')
  if (stage === 'density') return t('progress.density')
  if (stage === 'filtering') return t('progress.filtering')
  if (stage === 'displaying') return t('progress.displaying')
  return ''
})

onMounted(async () => {
  templates.value = await flameStore.loadDefaultTemplates()
  await flameStore.loadDefaultPalettes()
})

function onLangChange() {
  setLocale(lang.value)
}

function onFileOpen(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) flameStore.loadFromFile(file)
  input.value = ''
}

function onSaveJSON() {
  const json = flameStore.exportToJSON()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${flameStore.flame.name || 'flame'}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function onSaveFlame() {
  const compat = checkExportCompatibility(flameStore.flame)
  if (compat.incompatible.length > 0) {
    const msg = t('export.incompatibleMsg') + '\n\n' + compat.incompatible.join(', ') + '\n\n' + t('export.incompatibleConfirm')
    if (!confirm(msg)) return
  }
  const xml = flameStore.exportToXML()
  const blob = new Blob([xml], { type: 'application/xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${flameStore.flame.name || 'flame'}.flame`
  a.click()
  URL.revokeObjectURL(url)
}

async function onExportPNG() {
  if (!rendererStore.engine) return
  const imageData = await rendererStore.engine.renderToImageData(flameStore.flame, rendererStore.onProgress)
  if (!imageData) return
  const c = document.createElement('canvas')
  c.width = imageData.width
  c.height = imageData.height
  const ctx = c.getContext('2d')!
  ctx.putImageData(imageData, 0, 0)
  c.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${flameStore.flame.name || 'flame'}.png`
    a.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}

function onTemplateChange() {
  const idx = parseInt(selectedTemplate.value)
  if (!isNaN(idx) && templates.value[idx]) {
    flameStore.setFlame(templates.value[idx])
    selectedTemplate.value = ''
  }
}
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  background: #1a1a2e;
  border-bottom: 1px solid #333;
  flex-wrap: wrap;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

button, .file-btn, select {
  background: #16213e;
  color: #e0e0e0;
  border: 1px solid #444;
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

button:hover:not(:disabled), .file-btn:hover, select:hover {
  background: #0f3460;
}

.btn-accent {
  background: #1a4a2e;
  border-color: #2a7a4e;
}

.btn-accent:hover {
  background: #2a6a3e !important;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.render-time {
  color: #8f8;
  font-size: 12px;
  font-family: monospace;
}

.progress-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-bar {
  width: 120px;
  height: 10px;
  background: #0a0a1a;
  border: 1px solid #444;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #1a6a3e, #2a9a5e);
  transition: width 0.15s ease-out;
}

.progress-text {
  color: #aaa;
  font-size: 11px;
  font-family: monospace;
  white-space: nowrap;
}

.lang-select {
  width: auto;
  min-width: 90px;
}
</style>
