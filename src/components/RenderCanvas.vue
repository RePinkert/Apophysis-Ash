<template>
  <canvas ref="canvasRef"></canvas>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useFlameStore } from '../stores/flame'
import { useRendererStore } from '../stores/renderer'

const flameStore = useFlameStore()
const rendererStore = useRendererStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)

let renderTimeout: ReturnType<typeof setTimeout> | null = null

function scheduleRender() {
  if (renderTimeout) clearTimeout(renderTimeout)
  renderTimeout = setTimeout(() => {
    requestAnimationFrame(() => doRender())
  }, 300)
}

async function doRender() {
  if (!rendererStore.engine || !rendererStore.gpuSupported || !canvasRef.value) return

  const flame = flameStore.flame

  canvasRef.value.width = flame.width
  canvasRef.value.height = flame.height

  rendererStore.isRendering = true
  const t0 = performance.now()

  try {
    await rendererStore.engine.render(flame, canvasRef.value)
    rendererStore.lastRenderTime = performance.now() - t0
  } catch (e) {
    console.error('Render error:', e)
  }

  rendererStore.isRendering = false
}

watch(() => flameStore.flame, scheduleRender, { deep: true })

onMounted(() => {
  scheduleRender()
})

onUnmounted(() => {
  if (renderTimeout) clearTimeout(renderTimeout)
})

defineExpose({ doRender })
</script>

<style scoped>
canvas {
  display: block;
  max-width: 100%;
  max-height: 100%;
  background: #000;
  image-rendering: auto;
}
</style>
