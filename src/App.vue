<template>
  <div class="app">
    <Toolbar
      :gpu-supported="rendererStore.gpuSupported"
      :is-rendering="rendererStore.isRendering"
      :last-render-time="rendererStore.lastRenderTime"
      @render="doRender"
    />

    <div v-if="!rendererStore.isInitialized" class="loading">
      {{ t('app.initializing') }}
    </div>

    <div v-else-if="!rendererStore.gpuSupported" class="error">
      <h2>{{ t('app.notAvailable') }}</h2>
      <p>{{ t('app.notAvailableMsg') }}</p>
    </div>

    <div v-else class="main-layout">
      <aside class="sidebar-left">
        <TransformList />
        <TransformEditor />
      </aside>

      <main class="canvas-area">
        <RenderCanvas ref="canvasRef" />
      </main>

      <aside class="sidebar-right">
        <ControlPanel />
        <PaletteBar />
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRendererStore } from './stores/renderer'
import { useFlameStore } from './stores/flame'
import { useI18n } from './i18n'
import Toolbar from './components/Toolbar.vue'
import TransformList from './components/TransformList.vue'
import TransformEditor from './components/TransformEditor.vue'
import ControlPanel from './components/ControlPanel.vue'
import PaletteBar from './components/PaletteBar.vue'
import RenderCanvas from './components/RenderCanvas.vue'

const rendererStore = useRendererStore()
const flameStore = useFlameStore()
const { t } = useI18n()
const canvasRef = ref<InstanceType<typeof RenderCanvas> | null>(null)

function doRender() {
  canvasRef.value?.doRender()
}

onMounted(async () => {
  await rendererStore.init()
  await flameStore.loadDefaultPalettes()

  const templates = await flameStore.loadDefaultTemplates()
  if (templates.length > 0) {
    flameStore.setFlame(templates[0])
  }
})

onUnmounted(() => {
  rendererStore.destroy()
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  overflow: hidden;
}

body {
  background: #0d0d1a;
  color: #e0e0e0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.loading, .error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #aaa;
}

.error h2 {
  color: #f66;
  margin-bottom: 8px;
}

.main-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sidebar-left {
  width: 280px;
  min-width: 280px;
  background: #111122;
  border-right: 1px solid #333;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-left .xform-editor {
  flex: 1;
  overflow-y: auto;
}

.canvas-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #000;
  padding: 8px;
}

.canvas-area canvas {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.sidebar-right {
  width: 280px;
  min-width: 280px;
  background: #111122;
  border-left: 1px solid #333;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-right .control-panel {
  flex: 1;
  overflow-y: auto;
}

::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #444;
}
</style>
