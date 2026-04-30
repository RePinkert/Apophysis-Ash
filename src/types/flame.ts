export interface Flame {
  name: string
  version: string
  width: number
  height: number
  center: [number, number]
  scale: number
  angle: number
  rotate: number
  oversample: number
  filterRadius: number
  quality: number
  background: [number, number, number]
  brightness: number
  gamma: number
  gammaThreshold: number
  vibrancy: number
  contrast: number
  whiteLevel: number
  xforms: XForm[]
  finalXform?: XForm
  palette: Palette
}

export interface XForm {
  weight: number
  color: number
  symmetry: number
  coefs: [number, number, number, number, number, number]
  post?: [number, number, number, number, number, number]
  variations: Map<string, number>
  variationParams: Map<string, number>
}

export interface Palette {
  name?: string
  count: number
  colors: [number, number, number][]
}

export interface RenderParams {
  sampleDensity: number
  filterRadius: number
  oversample: number
  brightness: number
  gamma: number
  gammaThreshold: number
  vibrancy: number
  contrast: number
  whiteLevel: number
  background: [number, number, number]
}

export const BUILTIN_VARIATION_NAMES = [
  'linear', 'sinusoidal', 'spherical', 'swirl', 'horseshoe',
  'polar', 'handkerchief', 'heart', 'disc', 'spiral',
  'hyperbolic', 'diamond', 'ex', 'julia', 'bent',
  'waves', 'fisheye', 'popcorn',
] as const

export const EXTENDED_VARIATION_NAMES = [
  'julian', 'bubble', 'pre_blur', 'noise', 'blur',
] as const

export type BuiltinVariationName = typeof BUILTIN_VARIATION_NAMES[number]
export type ExtendedVariationName = typeof EXTENDED_VARIATION_NAMES[number]
export type VariationName = BuiltinVariationName | ExtendedVariationName

export const ALL_VARIATION_NAMES: string[] = [
  ...BUILTIN_VARIATION_NAMES,
  ...EXTENDED_VARIATION_NAMES,
]

export function createDefaultFlame(): Flame {
  return {
    name: 'New Flame',
    version: 'apophysis-next-1.0',
    width: 800,
    height: 600,
    center: [0, 0],
    scale: 200,
    angle: 0,
    rotate: 0,
    oversample: 2,
    filterRadius: 0.5,
    quality: 50,
    background: [0, 0, 0],
    brightness: 4,
    gamma: 2.2,
    gammaThreshold: 0.05,
    vibrancy: 1,
    contrast: 1,
    whiteLevel: 200,
    xforms: [createDefaultXForm(0), createDefaultXForm(1)],
    palette: createDefaultPalette(),
  }
}

export function createDefaultXForm(index: number): XForm {
  const variations = new Map<string, number>()
  variations.set('linear', 1.0)
  return {
    weight: 1,
    color: index === 0 ? 0 : 1,
    symmetry: 0,
    coefs: [
      Math.cos(2 * Math.PI * index / 6),
      Math.sin(2 * Math.PI * index / 6),
      -Math.sin(2 * Math.PI * index / 6),
      Math.cos(2 * Math.PI * index / 6),
      0, 0,
    ],
    variations,
    variationParams: new Map(),
  }
}

export function createDefaultPalette(): Palette {
  const colors: [number, number, number][] = []
  for (let i = 0; i < 256; i++) {
    const t = i / 255
    colors.push([
      Math.round(50 + 180 * t),
      Math.round(30 + 120 * (1 - t) * Math.sin(t * Math.PI)),
      Math.round(180 - 140 * t),
    ])
  }
  return { count: 256, colors }
}
