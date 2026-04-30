import { MAX_XFORMS, MAX_VARIATIONS } from '../types/renderer'
import type { Flame, XForm } from '../types/flame'
import { ALL_VARIATION_NAMES } from '../types/flame'

export const XFORM_STRUCT_SIZE = (6 + 1 + 1 + 1 + MAX_VARIATIONS + 2) * 4

export function buildXFormBuffer(xforms: XForm[]): Float32Array {
  const totalWeight = xforms.reduce((s, xf) => s + xf.weight, 0)
  const data = new Float32Array(MAX_XFORMS * (XFORM_STRUCT_SIZE / 4))
  for (let i = 0; i < Math.min(xforms.length, MAX_XFORMS); i++) {
    const xf = xforms[i]
    const offset = i * (XFORM_STRUCT_SIZE / 4)
    data[offset + 0] = xf.coefs[0]
    data[offset + 1] = xf.coefs[1]
    data[offset + 2] = xf.coefs[2]
    data[offset + 3] = xf.coefs[3]
    data[offset + 4] = xf.coefs[4]
    data[offset + 5] = xf.coefs[5]
    data[offset + 6] = totalWeight > 0 ? xf.weight / totalWeight : 0
    data[offset + 7] = xf.color
    data[offset + 8] = xf.symmetry
    for (let v = 0; v < MAX_VARIATIONS; v++) {
      const vname = ALL_VARIATION_NAMES[v]
      data[offset + 9 + v] = xf.variations.get(vname) ?? 0
    }
    data[offset + 9 + MAX_VARIATIONS + 0] = xf.variationParams.get('julian_power') ?? 1
    data[offset + 9 + MAX_VARIATIONS + 1] = xf.variationParams.get('julian_dist') ?? 1
  }
  return data
}

export function buildPaletteBuffer(palette: Flame['palette']): Float32Array {
  const data = new Float32Array(256 * 4)
  for (let i = 0; i < 256; i++) {
    const c = palette.colors[i % palette.colors.length]
    data[i * 4 + 0] = c[0] / 255
    data[i * 4 + 1] = c[1] / 255
    data[i * 4 + 2] = c[2] / 255
    data[i * 4 + 3] = 1.0
  }
  return data
}

export function buildParamsBuffer(flame: Flame): ArrayBuffer {
  const oversample = flame.oversample
  const gutterWidth = 20
  const ht = oversample * flame.height + 2 * gutterWidth
  const wd = oversample * flame.width + 2 * gutterWidth
  const cosAngle = Math.cos(flame.angle)
  const sinAngle = Math.sin(flame.angle)
  const prefilterWhite = 1024
  const totalSamples = Math.round(flame.width * flame.height * flame.quality / (oversample * oversample))

  const buffer = new ArrayBuffer(24 * 4)
  const u32 = new Uint32Array(buffer)
  const f32 = new Float32Array(buffer)

  u32[0] = Math.min(flame.xforms.length, MAX_XFORMS)
  u32[1] = totalSamples
  u32[2] = wd
  u32[3] = ht
  u32[4] = oversample

  f32[5] = flame.scale
  f32[6] = flame.center[0]
  f32[7] = flame.center[1]
  f32[8] = cosAngle
  f32[9] = sinAngle

  u32[10] = gutterWidth

  f32[11] = flame.brightness
  f32[12] = flame.contrast
  f32[13] = flame.gamma
  f32[14] = flame.gammaThreshold
  f32[15] = flame.vibrancy
  f32[16] = flame.whiteLevel
  f32[17] = flame.filterRadius
  f32[18] = prefilterWhite
  f32[19] = flame.background[0] / 255
  f32[20] = flame.background[1] / 255
  f32[21] = flame.background[2] / 255

  u32[22] = flame.width
  u32[23] = flame.height

  return buffer
}
