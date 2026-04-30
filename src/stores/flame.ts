import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import type { Flame, XForm, Palette } from '../types/flame'
import { createDefaultFlame, createDefaultXForm } from '../types/flame'
import { parseFlameXML } from '../parser/flame-xml'
import { generateRandomFlame } from '../utils/random-flame'
import { flameToJSON, flameFromJSON } from '../parser/flame-json'
import { parseUGR } from '../parser/palette-ugr'

export const useFlameStore = defineStore('flame', () => {
  const flame = shallowRef<Flame>(createDefaultFlame())
  const selectedXformIndex = ref(0)
  const isDirty = ref(false)
  const palettes = ref<Palette[]>([])
  const flameHistory = ref<Flame[]>([])

  function setFlame(f: Flame) {
    flame.value = f
    selectedXformIndex.value = 0
    isDirty.value = false
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
    f.xforms.splice(index, 1)
    flame.value = { ...f }
    if (selectedXformIndex.value >= flame.value.xforms.length) {
      selectedXformIndex.value = flame.value.xforms.length - 1
    }
    isDirty.value = true
  }

  function updateXform(index: number, updates: Partial<XForm>) {
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
    const f = flame.value
    const xf = f.xforms[xformIndex]
    xf.variationParams.set(paramName, value)
    flame.value = { ...f }
    isDirty.value = true
  }

  function updateRenderParam<K extends keyof Flame>(key: K, value: Flame[K]) {
    const f = flame.value
    ;(f as unknown as Record<string, unknown>)[key as string] = value
    flame.value = { ...f }
    isDirty.value = true
  }

  function setPalette(palette: Palette) {
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
    flameHistory,
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
