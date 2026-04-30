<template>
  <canvas ref="overlayRef" class="guides-overlay"></canvas>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useGuidesStore } from '../stores/guides'
import { useFlameStore } from '../stores/flame'
import { GUIDE_DRAW_FNS } from '../utils/guides'
import type { GuideId } from '../utils/guides'

const props = defineProps<{
  offsetX: number
  offsetY: number
  renderedWidth: number
  renderedHeight: number
}>()

const guidesStore = useGuidesStore()
const flameStore = useFlameStore()
const overlayRef = ref<HTMLCanvasElement | null>(null)

let resizeObserver: ResizeObserver | null = null

function redraw() {
  const canvas = overlayRef.value
  if (!canvas) return

  const parent = canvas.parentElement
  if (!parent) return

  const cw = parent.clientWidth
  const ch = parent.clientHeight
  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw
    canvas.height = ch
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, cw, ch)

  if (!guidesStore.hasAnyGuide) return

  const { offsetX, offsetY, renderedWidth, renderedHeight } = props
  if (renderedWidth <= 0 || renderedHeight <= 0) return

  const flame = flameStore.flame
  const scaleX = renderedWidth / flame.width
  const scaleY = renderedHeight / flame.height

  ctx.save()

  ctx.beginPath()
  ctx.rect(offsetX, offsetY, renderedWidth, renderedHeight)
  ctx.clip()

  ctx.translate(offsetX, offsetY)
  ctx.scale(scaleX, scaleY)

  const guides = guidesStore.activeGuides as (GuideId | null)[]
  for (const guideId of guides) {
    if (!guideId) continue
    const drawFn = GUIDE_DRAW_FNS[guideId]
    if (drawFn) {
      ctx.save()
      drawFn(ctx, flame.width, flame.height, guidesStore.guideColor, guidesStore.guideOpacity)
      ctx.restore()
    }
  }

  ctx.restore()
}

watch(
  () => [
    guidesStore.activeGuides,
    guidesStore.guideColor,
    guidesStore.guideOpacity,
    guidesStore.hasAnyGuide,
    props.offsetX,
    props.offsetY,
    props.renderedWidth,
    props.renderedHeight,
    flameStore.flame.width,
    flameStore.flame.height,
  ],
  () => requestAnimationFrame(redraw),
  { deep: true },
)

onMounted(() => {
  const parent = overlayRef.value?.parentElement
  if (parent) {
    resizeObserver = new ResizeObserver(() => requestAnimationFrame(redraw))
    resizeObserver.observe(parent)
  }
  requestAnimationFrame(redraw)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})
</script>

<style scoped>
.guides-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
}
</style>
