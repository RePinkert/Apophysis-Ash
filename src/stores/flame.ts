import { defineStore } from 'pinia'
import { ref, shallowRef, computed } from 'vue'
import type { Flame, XForm, Palette } from '../types/flame'
import { createDefaultFlame, createDefaultXForm } from '../types/flame'
import { parseFlameXML } from '../parser/flame-xml'
import { generateRandomFlame } from '../utils/random-flame'
import { flameToJSON, flameFromJSON } from '../parser/flame-json'
import { parseUGR } from '../parser/palette-ugr'

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

const MAX_HISTORY = 50

export const useFlameStore = defineStore('flame', () => {
  const flame = shallowRef<Flame>(createDefaultFlame())
  const selectedXformIndex = ref(0)
  const isDirty = ref(false)
  const palettes = ref<Palette[]>([])
  const editorMode = ref<'browser' | 'detailed'>('browser')

  const history = ref<Flame[]>([])
  const historyIndex = ref(-1)

  const canUndo = computed(() => historyIndex.value > 0)
  const canRedo = computed(() => historyIndex.value < history.value.length - 1)

  function pushHistory() {
    const snapshot = deepClone(flame.value)
    const nextIdx = historyIndex.value + 1
    if (nextIdx < history.value.length) {
      history.value.splice(nextIdx)
    }
    history.value.push(snapshot)
    if (history.value.length > MAX_HISTORY) {
      history.value.shift()
    }
    historyIndex.value = history.value.length - 1
  }

  function undo() {
    if (!canUndo.value) return
    historyIndex.value--
    flame.value = deepClone(history.value[historyIndex.value])
  }

  function redo() {
    if (!canRedo.value) return
    historyIndex.value++
    flame.value = deepClone(history.value[historyIndex.value])
  }

  function clearHistory() {
    history.value = []
    historyIndex.value = -1
  }

  function setFlame(f: Flame) {
    flame.value = f
    selectedXformIndex.value = 0
    isDirty.value = false
    clearHistory()
  }

  function loadFromXML(xml: string) {
    const flames = parseFlameXML(xml)
    if (flames.length > 0) {
      setFlame(flames[0])
    }
  }

  function loadFromJSON(json: string) {
    const f = flameFromJSON(json)
    setFlame(f)
  }

  function loadFromFile(file: File) {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const text = reader.result as string
        if (file.name.endsWith('.json')) {
          loadFromJSON(text)
        } else {
          loadFromXML(text)
        }
        resolve()
      }
      reader.onerror = reject
      reader.readAsText(file)
    })
  }

  function exportToJSON(): string {
    return flameToJSON(flame.value)
  }

  function addXform() {
    pushHistory()
    const f = flame.value
    const newXf = createDefaultXForm(f.xforms.length)
    f.xforms.push(newXf)
    flame.value = { ...f }
    selectedXformIndex.value = flame.value.xforms.length - 1
    isDirty.value = true
  }

  function removeXform(index: number) {
    const f = flame.value
    if (f.xforms.length <= 1) return
    pushHistory()
    f.xforms.splice(index, 1)
    flame.value = { ...f }
    if (selectedXformIndex.value >= flame.value.xforms.length) {
      selectedXformIndex.value = flame.value.xforms.length - 1
    }
    isDirty.value = true
  }

  function updateXform(index: number, updates: Partial<XForm>) {
    pushHistory()
    const f = flame.value
    const xf = f.xforms[index]
    if (updates.variations) {
      xf.variations = updates.variations
    }
    if (updates.variationParams) {
      xf.variationParams = updates.variationParams
    }
    if (updates.coefs) xf.coefs = updates.coefs
    if (updates.weight !== undefined) xf.weight = updates.weight
    if (updates.color !== undefined) xf.color = updates.color
    if (updates.symmetry !== undefined) xf.symmetry = updates.symmetry
    flame.value = { ...f }
    isDirty.value = true
  }

  function updateVariation(xformIndex: number, varName: string, weight: number) {
    pushHistory()
    const f = flame.value
    const xf = f.xforms[xformIndex]
    if (weight === 0) {
      xf.variations.delete(varName)
    } else {
      xf.variations.set(varName, weight)
    }
    flame.value = { ...f }
    isDirty.value = true
  }

  function updateVariationParam(xformIndex: number, paramName: string, value: number) {
    pushHistory()
    const f = flame.value
    const xf = f.xforms[xformIndex]
    xf.variationParams.set(paramName, value)
    flame.value = { ...f }
    isDirty.value = true
  }

  function updateRenderParam<K extends keyof Flame>(key: K, value: Flame[K]) {
    pushHistory()
    const f = flame.value
    ;(f as unknown as Record<string, unknown>)[key as string] = value
    flame.value = { ...f }
    isDirty.value = true
  }

  function setPalette(palette: Palette) {
    pushHistory()
    const f = flame.value
    f.palette = palette
    flame.value = { ...f }
    isDirty.value = true
  }

  async function loadPalettesFromUGR(file: File) {
    const text = await file.text()
    palettes.value = parseUGR(text)
  }

  async function loadPalettesFromJSON(file: File) {
    const text = await file.text()
    const data = JSON.parse(text)
    palettes.value = Array.isArray(data) ? data : []
  }

  async function loadDefaultPalettes() {
    try {
      const resp = await fetch('/palettes/default.json')
      const data = await resp.json()
      palettes.value = Array.isArray(data) ? data : []
    } catch {
      palettes.value = []
    }
  }

  async function loadDefaultTemplates(): Promise<Flame[]> {
    try {
      const resp = await fetch('/templates/default.json')
      const data = await resp.json()
      return (Array.isArray(data) ? data : []).map((d: Record<string, unknown>) => flameFromJSON(JSON.stringify(d)))
    } catch {
      return []
    }
  }

  return {
    flame,
    selectedXformIndex,
    isDirty,
    palettes,
    editorMode,
    canUndo,
    canRedo,
    undo,
    redo,
    setFlame,
    loadFromXML,
    loadFromJSON,
    loadFromFile,
    exportToJSON,
    addXform,
    removeXform,
    updateXform,
    updateVariation,
    updateVariationParam,
    updateRenderParam,
    setPalette,
    loadPalettesFromUGR,
    loadPalettesFromJSON,
    loadDefaultPalettes,
    loadDefaultTemplates,
    generateRandom() {
      const f = flame.value
      setFlame(generateRandomFlame(palettes.value, f.width, f.height))
    },
  }
})
