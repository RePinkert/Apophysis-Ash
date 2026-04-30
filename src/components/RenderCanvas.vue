<template>
  <canvas ref="canvasRef"
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @mouseleave="onMouseUp"
    @wheel.prevent="onWheel"
    @contextmenu.prevent
  ></canvas>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useFlameStore } from '../stores/flame'
import { useRendererStore } from '../stores/renderer'

const flameStore = useFlameStore()
const rendererStore = useRendererStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)

let renderTimeout: ReturnType<typeof setTimeout> | null = null

let isDragging = false
let dragButton = 0
let lastX = 0
let lastY = 0

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

function canvasToFlameOffset(dx: number, dy: number): [number, number] {
  const flame = flameStore.flame
  const canvas = canvasRef.value
  if (!canvas) return [0, 0]

  const displayScale = Math.min(
    canvas.clientWidth / flame.width,
    canvas.clientHeight / flame.height
  )

  const rad = -flame.rotate * Math.PI / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const px = dx / (displayScale * flame.scale)
  const py = dy / (displayScale * flame.scale)

  return [
    -(cos * px - sin * py),
    -(sin * px + cos * py),
  ]
}

function onMouseDown(e: MouseEvent) {
  if (e.button === 0 || e.button === 2) {
    isDragging = true
    dragButton = e.button
    lastX = e.clientX
    lastY = e.clientY
  }
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging) return

  const dx = e.clientX - lastX
  const dy = e.clientY - lastY
  lastX = e.clientX
  lastY = e.clientY

  const flame = flameStore.flame

  if (dragButton === 0 && !e.ctrlKey && !e.metaKey) {
    const [ox, oy] = canvasToFlameOffset(dx, dy)
    flameStore.updateRenderParam('center', [
      flame.center[0] + ox,
      flame.center[1] + oy,
    ])
  } else {
    const canvas = canvasRef.value
    if (!canvas) return
    const sensitivity = 0.3
    flameStore.updateRenderParam('rotate', flame.rotate + dx * sensitivity)
  }
}

function onMouseUp() {
  isDragging = false
}

function onWheel(e: WheelEvent) {
  const flame = flameStore.flame
  const canvas = canvasRef.value
  if (!canvas) return

  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
  const newScale = flame.scale * zoomFactor

  const rect = canvas.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top

  const displayScale = Math.min(
    canvas.clientWidth / flame.width,
    canvas.clientHeight / flame.height
  )
  const renderedW = flame.width * displayScale
  const renderedH = flame.height * displayScale
  const offsetX = (canvas.clientWidth - renderedW) / 2
  const offsetY = (canvas.clientHeight - renderedH) / 2

  const px = (mx - offsetX) / displayScale - flame.width / 2
  const py = (my - offsetY) / displayScale - flame.height / 2

  const rad = -flame.rotate * Math.PI / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const fx = (cos * px - sin * py) / flame.scale
  const fy = (sin * px + cos * py) / flame.scale

  const newFx = fx * (flame.scale / newScale)
  const newFy = fy * (flame.scale / newScale)

  const rad2 = flame.rotate * Math.PI / 180
  const cos2 = Math.cos(rad2)
  const sin2 = Math.sin(rad2)
  const dpx = (fx - newFx) * newScale
  const dpy = (fy - newFy) * newScale

  flameStore.updateRenderParam('center', [
    flame.center[0] + (cos2 * dpx - sin2 * dpy) / newScale,
    flame.center[1] + (sin2 * dpx + cos2 * dpy) / newScale,
  ])
  flameStore.updateRenderParam('scale', newScale)
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
  cursor: grab;
}

canvas:active {
  cursor: grabbing;
}
</style>
