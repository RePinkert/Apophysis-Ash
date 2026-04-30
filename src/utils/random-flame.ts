import type { Flame, XForm, Palette } from '../types/flame'
import { createDefaultPalette } from '../types/flame'
import { ALL_VARIATION_NAMES } from '../types/flame'

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1))
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomAffine(): [number, number, number, number, number, number] {
  const angle = rand(0, Math.PI * 2)
  const scale = rand(0.3, 1.2)
  const tx = rand(-2, 2)
  const ty = rand(-2, 2)
  const c = Math.cos(angle) * scale
  const s = Math.sin(angle) * scale
  return [c, s, -s, c, tx, ty]
}

function randomXForm(index: number, total: number): XForm {
  const variations = new Map<string, number>()
  const variationParams = new Map<string, number>()

  const numVars = randInt(1, 3)
  const usedVars = new Set<string>()

  for (let i = 0; i < numVars; i++) {
    let name = pickRandom(ALL_VARIATION_NAMES)
    let attempts = 0
    while (usedVars.has(name) && attempts < 20) {
      name = pickRandom(ALL_VARIATION_NAMES)
      attempts++
    }
    usedVars.add(name)
    variations.set(name, rand(0.2, 1.5))
  }

  if (variations.has('julian')) {
    variationParams.set('julian_power', randInt(2, 20))
    variationParams.set('julian_dist', rand(-1.5, 1.5))
  }

  return {
    weight: rand(0.1, 5),
    color: index / Math.max(total - 1, 1),
    symmetry: Math.random() < 0.3 ? rand(0.5, 1) : 0,
    coefs: randomAffine(),
    variations,
    variationParams,
  }
}

export function generateRandomFlame(palettes: Palette[], width: number = 1280, height: number = 720): Flame {
  const numXforms = randInt(2, 5)
  const xforms: XForm[] = []

  for (let i = 0; i < numXforms; i++) {
    xforms.push(randomXForm(i, numXforms))
  }

  let palette = createDefaultPalette()
  if (palettes.length > 0) {
    palette = { ...pickRandom(palettes) }
  }

  const names = [
    'Ember', 'Nebula', 'Phoenix', 'Aurora', 'Vortex',
    'Crystal', 'Dragon', 'Bloom', 'Storm', 'Echo',
    'Fractal Dream', 'Star Dust', 'Cosmic Web', 'Fire Dance',
  ]

  return {
    name: pickRandom(names) + ' ' + randInt(1, 999),
    version: 'apophysis-next-1.0',
    width: width,
    height: height,
    center: [rand(-0.5, 0.5), rand(-0.5, 0.5)],
    scale: rand(100, 500),
    angle: 0,
    rotate: 0,
    oversample: 2,
    filterRadius: 0.5,
    quality: 30,
    background: [0, 0, 0],
    brightness: rand(2, 8),
    gamma: rand(1.5, 3.5),
    gammaThreshold: 0.05,
    vibrancy: rand(0.5, 1.5),
    contrast: 1,
    whiteLevel: 200,
    xforms,
    palette,
  }
}
