import type { Flame } from '../types/flame'

export function flameToJSON(flame: Flame): string {
  return JSON.stringify(serializeFlame(flame), null, 2)
}

export function flameFromJSON(json: string): Flame {
  return deserializeFlame(JSON.parse(json))
}

export function flameFromJSONSafe(json: string): Flame | null {
  try {
    return flameFromJSON(json)
  } catch {
    return null
  }
}

interface SerializedFlame {
  version: string
  flame: {
    name: string
    width: number
    height: number
    center: number[]
    scale: number
    angle: number
    rotate: number
    oversample: number
    filterRadius: number
    quality: number
    background: number[]
    brightness: number
    gamma: number
    gammaThreshold: number
    vibrancy: number
    contrast: number
    whiteLevel: number
    xforms: SerializedXForm[]
    finalXform?: SerializedXForm
    palette: number[][]
  }
}

interface SerializedXForm {
  weight: number
  color: number
  symmetry: number
  coefs: number[]
  post?: number[]
  variations: Record<string, number>
  variationParams: Record<string, number>
}

function serializeFlame(flame: Flame): SerializedFlame {
  return {
    version: 'apophysis-next-1.0',
    flame: {
      name: flame.name,
      width: flame.width,
      height: flame.height,
      center: [...flame.center],
      scale: flame.scale,
      angle: flame.angle,
      rotate: flame.rotate,
      oversample: flame.oversample,
      filterRadius: flame.filterRadius,
      quality: flame.quality,
      background: [...flame.background],
      brightness: flame.brightness,
      gamma: flame.gamma,
      gammaThreshold: flame.gammaThreshold,
      vibrancy: flame.vibrancy,
      contrast: flame.contrast,
      whiteLevel: flame.whiteLevel,
      xforms: flame.xforms.map(serializeXForm),
      finalXform: flame.finalXform ? serializeXForm(flame.finalXform) : undefined,
      palette: flame.palette.colors.map(c => [c[0], c[1], c[2]]),
    },
  }
}

function serializeXForm(xf: Flame['xforms'][0]): SerializedXForm {
  return {
    weight: xf.weight,
    color: xf.color,
    symmetry: xf.symmetry,
    coefs: [...xf.coefs],
    post: xf.post ? [...xf.post] : undefined,
    variations: Object.fromEntries(xf.variations),
    variationParams: Object.fromEntries(xf.variationParams),
  }
}

function deserializeFlame(sf: SerializedFlame | Record<string, unknown>): Flame {
  const f = ('flame' in sf && sf.flame ? sf.flame : sf) as SerializedFlame['flame']
  return {
    name: f.name ?? 'Untitled',
    version: ('version' in sf ? (sf as SerializedFlame).version : null) ?? 'apophysis-next-1.0',
    width: f.width ?? 800,
    height: f.height ?? 600,
    center: [f.center?.[0] ?? 0, f.center?.[1] ?? 0],
    scale: f.scale ?? 200,
    angle: f.angle ?? 0,
    rotate: f.rotate ?? 0,
    oversample: f.oversample ?? 2,
    filterRadius: f.filterRadius ?? 0.5,
    quality: f.quality ?? 50,
    background: [f.background?.[0] ?? 0, f.background?.[1] ?? 0, f.background?.[2] ?? 0],
    brightness: f.brightness ?? 4,
    gamma: f.gamma ?? 2.2,
    gammaThreshold: f.gammaThreshold ?? 0.05,
    vibrancy: f.vibrancy ?? 1,
    contrast: f.contrast ?? 1,
    whiteLevel: f.whiteLevel ?? 200,
    xforms: (f.xforms ?? []).map(deserializeXForm),
    finalXform: f.finalXform ? deserializeXForm(f.finalXform) : undefined,
    palette: {
      count: f.palette?.length ?? 256,
      colors: (f.palette ?? []).map((c: number[]) => [
        c[0] ?? 0, c[1] ?? 0, c[2] ?? 0,
      ] as [number, number, number]),
    },
  }
}

function deserializeXForm(sx: SerializedXForm): Flame['xforms'][0] {
  return {
    weight: sx.weight ?? 1,
    color: sx.color ?? 0,
    symmetry: sx.symmetry ?? 0,
    coefs: sx.coefs?.length === 6
      ? sx.coefs as [number, number, number, number, number, number]
      : [1, 0, 0, 1, 0, 0],
    post: sx.post?.length === 6
      ? sx.post as [number, number, number, number, number, number]
      : undefined,
    variations: new Map(Object.entries(sx.variations ?? {})),
    variationParams: new Map(Object.entries(sx.variationParams ?? {})),
  }
}
