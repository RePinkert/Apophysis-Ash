<template>
  <div class="canvas-wrapper">
    <canvas ref="canvasRef"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
      @wheel.prevent="onWheel"
      @contextmenu.prevent
      :style="isInteracting ? canvasStyle : undefined"
    ></canvas>
    <div v-if="showRotateIndicator" class="rotate-indicator">
      {{ rotateDisplay }}°
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useFlameStore } from '../stores/flame'
import { useRendererStore } from '../stores/renderer'

const flameStore = useFlameStore()
const rendererStore = useRendererStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)

let renderTimeout: ReturnType<typeof setTimeout> | null = null

const isInteracting = ref(false)
let interactionType: 'pan' | 'rotate' | 'zoom' | 'none' = 'none'
let startFlameCenter: [number, number] = [0, 0]
let startFlameScale = 0
let startFlameRotate = 0
let startMouseX = 0
let startMouseY = 0
let cssDx = 0
let cssDy = 0
let cssScaleAccum = 1
let cssRotateAccum = 0
let zoomOriginX = 0
let zoomOriginY = 0
let wheelTimer: ReturnType<typeof setTimeout> | null = null

const showRotateIndicator = ref(false)
const rotateDisplay = ref('0.0')

const canvasStyle = computed(() => {
  if (!isInteracting.value) return undefined
  const parts: string[] = []
  if (cssDx !== 0 || cssDy !== 0) parts.push(`translate(${cssDx}px, ${cssDy}px)`)
  if (cssScaleAccum !== 1) parts.push(`scale(${cssScaleAccum})`)
  if (cssRotateAccum !== 0) parts.push(`rotate(${cssRotateAccum}deg)`)
  if (parts.length === 0) return undefined
  const style: Record<string, string> = { transform: parts.join(' '), transition: 'none' }
  if (interactionType === 'zoom') {
    style.transformOrigin = `${zoomOriginX}px ${zoomOriginY}px`
  }
  return style
})

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
    await rendererStore.engine.render(flame, canvasRef.value, rendererStore.onProgress)
    rendererStore.lastRenderTime = performance.now() - t0
  } catch (e) {
    console.error('Render error:', e)
  }

  rendererStore.isRendering = false
}

function getDisplayScale(): number {
  const flame = flameStore.flame
  const canvas = canvasRef.value
  if (!canvas) return 1
  return Math.min(canvas.clientWidth / flame.width, canvas.clientHeight / flame.height)
}

function beginInteraction(e: MouseEvent, type: 'pan' | 'rotate' | 'zoom') {
  const flame = flameStore.flame
  isInteracting.value = true
  startMouseX = e.clientX
  startMouseY = e.clientY
  startFlameCenter = [...flame.center]
  startFlameScale = flame.scale
  startFlameRotate = flame.rotate
  cssDx = 0
  cssDy = 0
  cssScaleAccum = 1
  cssRotateAccum = 0
  interactionType = type

  if (type === 'zoom') {
    const rect = canvasRef.value!.getBoundingClientRect()
    zoomOriginX = e.clientX - rect.left
    zoomOriginY = e.clientY - rect.top
  }
}

function onMouseDown(e: MouseEvent) {
  const isRotate = e.button === 1 || (e.button === 0 && e.shiftKey)
  const isPan = e.button === 0 && !e.shiftKey && !e.ctrlKey && !e.metaKey

  if (!isPan && !isRotate) return

  e.preventDefault()
  beginInteraction(e, isRotate ? 'rotate' : 'pan')

  if (isRotate) {
    showRotateIndicator.value = true
    rotateDisplay.value = flameStore.flame.rotate.toFixed(1)
  }
}

function onMouseMove(e: MouseEvent) {
  if (!isInteracting.value) return

  const dx = e.clientX - startMouseX
  const dy = e.clientY - startMouseY

  if (interactionType === 'pan') {
    cssDx = dx
    cssDy = dy
  } else if (interactionType === 'rotate') {
    cssRotateAccum = dx * 0.3
    rotateDisplay.value = (startFlameRotate + cssRotateAccum).toFixed(1)
  }
}

function onMouseUp() {
  if (!isInteracting.value) return
  if (interactionType === 'pan' || interactionType === 'rotate') {
    commitDrag()
  }
}

function commitDrag() {
  if (interactionType === 'pan' && (cssDx !== 0 || cssDy !== 0)) {
    const ds = getDisplayScale()
    const rad = -startFlameRotate * Math.PI / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const px = cssDx / (ds * startFlameScale)
    const py = cssDy / (ds * startFlameScale)
    flameStore.updateRenderParam('center', [
      startFlameCenter[0] - (cos * px - sin * py),
      startFlameCenter[1] - (sin * px + cos * py),
    ])
  } else if (interactionType === 'rotate' && cssRotateAccum !== 0) {
    flameStore.updateRenderParam('rotate', startFlameRotate + cssRotateAccum)
  }

  resetInteraction()
}

function onWheel(e: WheelEvent) {
  const canvas = canvasRef.value
  if (!canvas) return

  if (!isInteracting.value || interactionType !== 'zoom') {
    beginInteraction(e as unknown as MouseEvent, 'zoom')
  }

  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
  cssScaleAccum *= zoomFactor

  if (wheelTimer) clearTimeout(wheelTimer)
  wheelTimer = setTimeout(() => {
    commitWheel()
    wheelTimer = null
  }, 200)
}

function commitWheel() {
  const flame = flameStore.flame
  const canvas = canvasRef.value
  if (!canvas || cssScaleAccum === 1) {
    resetInteraction()
    return
  }

  const ds = getDisplayScale()
  const newScale = startFlameScale * cssScaleAccum

  const rect = canvas.getBoundingClientRect()
  const mx = startMouseX - rect.left
  const my = startMouseY - rect.top

  const renderedW = flame.width * ds
  const renderedH = flame.height * ds
  const offsetX = (canvas.clientWidth - renderedW) / 2
  const offsetY = (canvas.clientHeight - renderedH) / 2

  const px = (mx - offsetX) / ds - flame.width / 2
  const py = (my - offsetY) / ds - flame.height / 2

  const rad = -startFlameRotate * Math.PI / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const fx = (cos * px - sin * py) / startFlameScale
  const fy = (sin * px + cos * py) / startFlameScale

  const newFx = fx * (startFlameScale / newScale)
  const newFy = fy * (startFlameScale / newScale)

  const rad2 = startFlameRotate * Math.PI / 180
  const cos2 = Math.cos(rad2)
  const sin2 = Math.sin(rad2)
  const dpx = (fx - newFx) * newScale
  const dpy = (fy - newFy) * newScale

  flameStore.updateRenderParam('center', [
    startFlameCenter[0] + (cos2 * dpx - sin2 * dpy) / newScale,
    startFlameCenter[1] + (sin2 * dpx + cos2 * dpy) / newScale,
  ])
  flameStore.updateRenderParam('scale', newScale)

  resetInteraction()
}

function resetInteraction() {
  isInteracting.value = false
  interactionType = 'none'
  cssDx = 0
  cssDy = 0
  cssScaleAccum = 1
  cssRotateAccum = 0
  showRotateIndicator.value = false
}

watch(() => flameStore.flame, scheduleRender, { deep: true })

onMounted(() => {
  scheduleRender()
})

onUnmounted(() => {
  if (renderTimeout) clearTimeout(renderTimeout)
  if (wheelTimer) clearTimeout(wheelTimer)
})

defineExpose({ doRender })
</script>

<style scoped>
.canvas-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

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

.rotate-indicator {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.75);
  color: #ccc;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 13px;
  font-family: monospace;
  pointer-events: none;
  z-index: 10;
  white-space: nowrap;
}
</style>
