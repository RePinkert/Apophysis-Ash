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
  paletteOffset: number
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
  'exponential', 'power', 'cosine', 'rings', 'fan',
  'blob', 'pdj', 'perspective', 'ngon',
  'curl', 'bipolar', 'elliptic', 'cell', 'crackle',
  'juliascope', 'split', 'wedge', 'wedge_julia',
  'wedge_sph', 'bwraps', 'bwraps7', 'motion_blur',
  'zblur', 'gaussian_blur', 'radial_blur',
  'post_rotate_x', 'post_rotate_y',
] as const

export type BuiltinVariationName = typeof BUILTIN_VARIATION_NAMES[number]
export type ExtendedVariationName = typeof EXTENDED_VARIATION_NAMES[number]
export type VariationName = BuiltinVariationName | ExtendedVariationName

export const ALL_VARIATION_NAMES: string[] = [
  ...BUILTIN_VARIATION_NAMES,
  ...EXTENDED_VARIATION_NAMES,
]

export const PARAM_EXPORT_ALIASES: Record<string, string> = {
  pdj1: 'pdj_a',
  pdj2: 'pdj_b',
  pdj3: 'pdj_c',
  pdj4: 'pdj_d',
  bwraps_innerTwist: 'bwraps_inner_twist',
  bwraps_outerTwist: 'bwraps_outer_twist',
  bwraps7_innerTwist: 'bwraps7_inner_twist',
  bwraps7_outerTwist: 'bwraps7_outer_twist',
}

export const PARAM_IMPORT_ALIASES: Record<string, string> = {
  pdj_a: 'pdj1',
  pdj_b: 'pdj2',
  pdj_c: 'pdj3',
  pdj_d: 'pdj4',
  bwraps_inner_twist: 'bwraps_innerTwist',
  bwraps_outer_twist: 'bwraps_outerTwist',
  bwraps7_inner_twist: 'bwraps7_innerTwist',
  bwraps7_outer_twist: 'bwraps7_outerTwist',
}

export const VARIATION_REQUIRED_PARAMS: Record<string, Record<string, number>> = {
  julian:       { julian_power: 2, julian_dist: 1 },
  rings:        { rings_coeff: 0.5 },
  fan:          { fan_dist: 0.5 },
  blob:         { blob_low: 0.7, blob_high: 1.0, blob_waves: 5.0 },
  pdj:          { pdj1: 1.0, pdj2: 1.0, pdj3: 1.0, pdj4: 1.0 },
  perspective:  { perspective_angle: 0.5, perspective_dist: 1.0 },
  ngon:         { ngon_power: 2.0, ngon_sides: 5.0, ngon_corners: 0.0, ngon_circle: 0.0 },
  curl:         { curl_c1: 0.5, curl_c2: 0.5 },
  bipolar:      { bipolar_shift: 0.0 },
  cell:         { cell_size: 0.5 },
  crackle:      { crackle_seed: 0.0, crackle_scale: 1.0, crackle_z: 0.0, crackle_spreadx: 1.0, crackle_spready: 1.0 },
  juliascope:   { juliascope_power: 2.0, juliascope_dist: 1.0 },
  split:        { split_xsize: 0.3, split_ysize: 0.3 },
  wedge:        { wedge_angle: 0.0, wedge_hole: 0.0, wedge_count: 5.0, wedge_swirl: 0.0 },
  wedge_julia:  { wedge_julia_power: 2.0, wedge_julia_angle: 0.0, wedge_julia_count: 5.0, wedge_julia_dist: 1.0 },
  wedge_sph:    { wedge_sph_angle: 0.0, wedge_sph_hole: 0.0, wedge_sph_count: 5.0, wedge_sph_swirl: 0.0 },
  bwraps:       { bwraps_cellsize: 1.0, bwraps_space: 0.5, bwraps_gain: 1.0, bwraps_innerTwist: 0.0, bwraps_outerTwist: 0.0 },
  bwraps7:      { bwraps7_cellsize: 1.0, bwraps7_space: 0.5, bwraps7_gain: 1.0, bwraps7_innerTwist: 0.0, bwraps7_outerTwist: 0.0 },
  motion_blur:  { motion_blur_angle: 0.0, motion_blur_length: 0.5 },
  radial_blur:  { radial_blur_angle: 0.1 },
}

export const PLUGIN_VARIATION_NAMES = new Set([
  'handkerchief', 'fisheye', 'crackle',
  'cell', 'split', 'stripes', 'ripple',
])

export const UNSUPPORTED_VARIATIONS = new Set([
  'bent', 'popcorn', 'exponential', 'cosine', 'blob',
  'wedge_julia', 'wedge_sph', 'motion_blur',
  'fan', 'perspective', 'waves',
])

export interface ExportCompatibility {
  pluginRequired: string[]
  unsupported: string[]
}

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
    paletteOffset: 0,
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
