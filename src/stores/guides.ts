import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { GuideId } from '../utils/guides'

export const useGuidesStore = defineStore('guides', () => {
  const activeGuides = ref<(GuideId | null)[]>([null, null])
  const guideColor = ref('#ffffff')
  const guideOpacity = ref(0.4)

  const hasAnyGuide = computed(() => activeGuides.value.some(g => g !== null))

  function setGuide(slot: 0 | 1, type: GuideId | null) {
    if (slot === 1 && activeGuides.value[0] === null) return
    activeGuides.value[slot] = type
  }

  function setGuideColor(color: string) {
    guideColor.value = color
  }

  function setGuideOpacity(opacity: number) {
    guideOpacity.value = Math.max(0.05, Math.min(1, opacity))
  }

  return {
    activeGuides,
    guideColor,
    guideOpacity,
    hasAnyGuide,
    setGuide,
    setGuideColor,
    setGuideOpacity,
  }
})
