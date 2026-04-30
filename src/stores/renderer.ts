import { defineStore } from 'pinia'
import { ref } from 'vue'
import { FlameEngine } from '../renderer/engine'
import type { RenderProgress } from '../types/renderer'

export const useRendererStore = defineStore('renderer', () => {
  const engine = ref<FlameEngine | null>(null)
  const isInitialized = ref(false)
  const isRendering = ref(false)
  const gpuSupported = ref(false)
  const gpuInfo = ref('')
  const errorMessage = ref('')
  const lastRenderTime = ref(0)
  const renderProgress = ref<RenderProgress | null>(null)

  function onProgress(progress: RenderProgress) {
    renderProgress.value = progress
  }

  async function init() {
    const eng = new FlameEngine()
    const ok = await eng.init()
    engine.value = eng
    isInitialized.value = true
    gpuSupported.value = ok
    gpuInfo.value = eng.gpuInfo
    if (!ok) {
      errorMessage.value = 'WebGPU is not supported on this browser. Please use Chrome 113+, Edge 113+, or Safari 18+.'
    }
    return ok
  }

  function destroy() {
    engine.value?.destroy()
    engine.value = null
    isInitialized.value = false
    gpuSupported.value = false
  }

  return {
    engine,
    isInitialized,
    isRendering,
    gpuSupported,
    gpuInfo,
    errorMessage,
    lastRenderTime,
    renderProgress,
    onProgress,
    init,
    destroy,
  }
})
