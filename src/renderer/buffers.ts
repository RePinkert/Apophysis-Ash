import { MAX_XFORMS, MAX_VARIATIONS } from '../types/renderer'
import type { Flame, XForm } from '../types/flame'
import { ALL_VARIATION_NAMES } from '../types/flame'

// 6 coefs + weight + color + symmetry + 50 var_weights + julian_power + julian_dist + 56 extra params + 6 post
export const XFORM_STRUCT_SIZE = (6 + 1 + 1 + 1 + MAX_VARIATIONS + 2 + 56 + 6) * 4

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
    const paramBase = offset + 9 + MAX_VARIATIONS
    data[paramBase + 0] = xf.variationParams.get('julian_power') ?? 1
    data[paramBase + 1] = xf.variationParams.get('julian_dist') ?? 1
    // Batch 1 extra params
    data[paramBase + 2] = xf.variationParams.get('rings_coeff') ?? 0.5
    data[paramBase + 3] = xf.variationParams.get('fan_dist') ?? 0.5
    data[paramBase + 4] = xf.variationParams.get('blob_low') ?? 0.7
    data[paramBase + 5] = xf.variationParams.get('blob_high') ?? 1.0
    data[paramBase + 6] = xf.variationParams.get('blob_waves') ?? 5.0
    data[paramBase + 7] = xf.variationParams.get('pdj1') ?? 1.0
    data[paramBase + 8] = xf.variationParams.get('pdj2') ?? 1.0
    data[paramBase + 9] = xf.variationParams.get('pdj3') ?? 1.0
    data[paramBase + 10] = xf.variationParams.get('pdj4') ?? 1.0
    data[paramBase + 11] = xf.variationParams.get('perspective_angle') ?? 0.5
    data[paramBase + 12] = xf.variationParams.get('perspective_dist') ?? 1.0
    data[paramBase + 13] = xf.variationParams.get('ngon_power') ?? 2.0
    data[paramBase + 14] = xf.variationParams.get('ngon_sides') ?? 5.0
    data[paramBase + 15] = xf.variationParams.get('ngon_corners') ?? 0.0
    data[paramBase + 16] = xf.variationParams.get('ngon_circle') ?? 0.0
    // Batch 2 extra params
    data[paramBase + 17] = xf.variationParams.get('curl_c1') ?? 0.5
    data[paramBase + 18] = xf.variationParams.get('curl_c2') ?? 0.5
    data[paramBase + 19] = xf.variationParams.get('bipolar_shift') ?? 0.0
    data[paramBase + 20] = xf.variationParams.get('cell_size') ?? 0.5
    data[paramBase + 21] = xf.variationParams.get('crackle_seed') ?? 0.0
    data[paramBase + 22] = xf.variationParams.get('crackle_scale') ?? 1.0
    data[paramBase + 23] = xf.variationParams.get('crackle_z') ?? 0.0
    data[paramBase + 24] = xf.variationParams.get('crackle_spreadx') ?? 1.0
    data[paramBase + 25] = xf.variationParams.get('crackle_spready') ?? 1.0
    data[paramBase + 26] = xf.variationParams.get('juliascope_power') ?? 2.0
    data[paramBase + 27] = xf.variationParams.get('juliascope_dist') ?? 1.0
    data[paramBase + 28] = xf.variationParams.get('split_xsize') ?? 0.3
    data[paramBase + 29] = xf.variationParams.get('split_ysize') ?? 0.3
    data[paramBase + 30] = xf.variationParams.get('wedge_angle') ?? 0.0
    data[paramBase + 31] = xf.variationParams.get('wedge_hole') ?? 0.0
    data[paramBase + 32] = xf.variationParams.get('wedge_count') ?? 5.0
    data[paramBase + 33] = xf.variationParams.get('wedge_swirl') ?? 0.0
    data[paramBase + 34] = xf.variationParams.get('wedge_julia_power') ?? 2.0
    data[paramBase + 35] = xf.variationParams.get('wedge_julia_angle') ?? 0.0
    data[paramBase + 36] = xf.variationParams.get('wedge_julia_count') ?? 5.0
    data[paramBase + 37] = xf.variationParams.get('wedge_julia_dist') ?? 1.0
    // Batch 3 extra params
    data[paramBase + 38] = xf.variationParams.get('wedge_sph_angle') ?? 0.0
    data[paramBase + 39] = xf.variationParams.get('wedge_sph_hole') ?? 0.0
    data[paramBase + 40] = xf.variationParams.get('wedge_sph_count') ?? 5.0
    data[paramBase + 41] = xf.variationParams.get('wedge_sph_swirl') ?? 0.0
    data[paramBase + 42] = xf.variationParams.get('bwraps_cellsize') ?? 1.0
    data[paramBase + 43] = xf.variationParams.get('bwraps_space') ?? 0.5
    data[paramBase + 44] = xf.variationParams.get('bwraps_gain') ?? 1.0
    data[paramBase + 45] = xf.variationParams.get('bwraps_innerTwist') ?? 0.0
    data[paramBase + 46] = xf.variationParams.get('bwraps_outerTwist') ?? 0.0
    data[paramBase + 47] = xf.variationParams.get('bwraps7_cellsize') ?? 1.0
    data[paramBase + 48] = xf.variationParams.get('bwraps7_space') ?? 0.5
    data[paramBase + 49] = xf.variationParams.get('bwraps7_gain') ?? 1.0
    data[paramBase + 50] = xf.variationParams.get('bwraps7_innerTwist') ?? 0.0
    data[paramBase + 51] = xf.variationParams.get('bwraps7_outerTwist') ?? 0.0
    data[paramBase + 52] = xf.variationParams.get('motion_blur_angle') ?? 0.0
    data[paramBase + 53] = xf.variationParams.get('motion_blur_length') ?? 0.5
    data[paramBase + 54] = xf.variationParams.get('radial_blur_angle') ?? 0.1
    // post_rotate_x (48), post_rotate_y (49) use var_weights directly, no extra params
    // Post-affine coefficients
    const post = xf.post ?? [1, 0, 0, 1, 0, 0]
    data[paramBase + 55] = post[0]
    data[paramBase + 56] = post[1]
    data[paramBase + 57] = post[2]
    data[paramBase + 58] = post[3]
    data[paramBase + 59] = post[4]
    data[paramBase + 60] = post[5]
  }
  return data
}

export function buildPaletteBuffer(palette: Flame['palette'], offset: number = 0): Float32Array {
  const data = new Float32Array(256 * 4)
  const len = palette.colors.length
  for (let i = 0; i < 256; i++) {
    const si = ((i - offset) % len + len) % len
    const c = palette.colors[si]
    data[i * 4 + 0] = c[0] / 255
    data[i * 4 + 1] = c[1] / 255
    data[i * 4 + 2] = c[2] / 255
    data[i * 4 + 3] = 1.0
  }
  return data
}

export function buildFinalXFormBuffer(xform: XForm | undefined): Float32Array {
  const data = new Float32Array(XFORM_STRUCT_SIZE / 4)
  if (!xform) return data
  const totalWeight = 1 // final xform doesn't participate in probability selection
  data[0] = xform.coefs[0]
  data[1] = xform.coefs[1]
  data[2] = xform.coefs[2]
  data[3] = xform.coefs[3]
  data[4] = xform.coefs[4]
  data[5] = xform.coefs[5]
  data[6] = totalWeight
  data[7] = xform.color
  data[8] = xform.symmetry
  for (let v = 0; v < MAX_VARIATIONS; v++) {
    const vname = ALL_VARIATION_NAMES[v]
    data[9 + v] = xform.variations.get(vname) ?? 0
  }
  const paramBase = 9 + MAX_VARIATIONS
  data[paramBase + 0] = xform.variationParams.get('julian_power') ?? 1
  data[paramBase + 1] = xform.variationParams.get('julian_dist') ?? 1
  data[paramBase + 2] = xform.variationParams.get('rings_coeff') ?? 0.5
  data[paramBase + 3] = xform.variationParams.get('fan_dist') ?? 0.5
  data[paramBase + 4] = xform.variationParams.get('blob_low') ?? 0.7
  data[paramBase + 5] = xform.variationParams.get('blob_high') ?? 1.0
  data[paramBase + 6] = xform.variationParams.get('blob_waves') ?? 5.0
  data[paramBase + 7] = xform.variationParams.get('pdj1') ?? 1.0
  data[paramBase + 8] = xform.variationParams.get('pdj2') ?? 1.0
  data[paramBase + 9] = xform.variationParams.get('pdj3') ?? 1.0
  data[paramBase + 10] = xform.variationParams.get('pdj4') ?? 1.0
  data[paramBase + 11] = xform.variationParams.get('perspective_angle') ?? 0.5
  data[paramBase + 12] = xform.variationParams.get('perspective_dist') ?? 1.0
  data[paramBase + 13] = xform.variationParams.get('ngon_power') ?? 2.0
  data[paramBase + 14] = xform.variationParams.get('ngon_sides') ?? 5.0
  data[paramBase + 15] = xform.variationParams.get('ngon_corners') ?? 0.0
  data[paramBase + 16] = xform.variationParams.get('ngon_circle') ?? 0.0
  data[paramBase + 17] = xform.variationParams.get('curl_c1') ?? 0.5
  data[paramBase + 18] = xform.variationParams.get('curl_c2') ?? 0.5
  data[paramBase + 19] = xform.variationParams.get('bipolar_shift') ?? 0.0
  data[paramBase + 20] = xform.variationParams.get('cell_size') ?? 0.5
  data[paramBase + 21] = xform.variationParams.get('crackle_seed') ?? 0.0
  data[paramBase + 22] = xform.variationParams.get('crackle_scale') ?? 1.0
  data[paramBase + 23] = xform.variationParams.get('crackle_z') ?? 0.0
  data[paramBase + 24] = xform.variationParams.get('crackle_spreadx') ?? 1.0
  data[paramBase + 25] = xform.variationParams.get('crackle_spready') ?? 1.0
  data[paramBase + 26] = xform.variationParams.get('juliascope_power') ?? 2.0
  data[paramBase + 27] = xform.variationParams.get('juliascope_dist') ?? 1.0
  data[paramBase + 28] = xform.variationParams.get('split_xsize') ?? 0.3
  data[paramBase + 29] = xform.variationParams.get('split_ysize') ?? 0.3
  data[paramBase + 30] = xform.variationParams.get('wedge_angle') ?? 0.0
  data[paramBase + 31] = xform.variationParams.get('wedge_hole') ?? 0.0
  data[paramBase + 32] = xform.variationParams.get('wedge_count') ?? 5.0
  data[paramBase + 33] = xform.variationParams.get('wedge_swirl') ?? 0.0
  data[paramBase + 34] = xform.variationParams.get('wedge_julia_power') ?? 2.0
  data[paramBase + 35] = xform.variationParams.get('wedge_julia_angle') ?? 0.0
  data[paramBase + 36] = xform.variationParams.get('wedge_julia_count') ?? 5.0
  data[paramBase + 37] = xform.variationParams.get('wedge_julia_dist') ?? 1.0
  data[paramBase + 38] = xform.variationParams.get('wedge_sph_angle') ?? 0.0
  data[paramBase + 39] = xform.variationParams.get('wedge_sph_hole') ?? 0.0
  data[paramBase + 40] = xform.variationParams.get('wedge_sph_count') ?? 5.0
  data[paramBase + 41] = xform.variationParams.get('wedge_sph_swirl') ?? 0.0
  data[paramBase + 42] = xform.variationParams.get('bwraps_cellsize') ?? 1.0
  data[paramBase + 43] = xform.variationParams.get('bwraps_space') ?? 0.5
  data[paramBase + 44] = xform.variationParams.get('bwraps_gain') ?? 1.0
  data[paramBase + 45] = xform.variationParams.get('bwraps_innerTwist') ?? 0.0
  data[paramBase + 46] = xform.variationParams.get('bwraps_outerTwist') ?? 0.0
  data[paramBase + 47] = xform.variationParams.get('bwraps7_cellsize') ?? 1.0
  data[paramBase + 48] = xform.variationParams.get('bwraps7_space') ?? 0.5
  data[paramBase + 49] = xform.variationParams.get('bwraps7_gain') ?? 1.0
  data[paramBase + 50] = xform.variationParams.get('bwraps7_innerTwist') ?? 0.0
  data[paramBase + 51] = xform.variationParams.get('bwraps7_outerTwist') ?? 0.0
  data[paramBase + 52] = xform.variationParams.get('motion_blur_angle') ?? 0.0
  data[paramBase + 53] = xform.variationParams.get('motion_blur_length') ?? 0.5
  data[paramBase + 54] = xform.variationParams.get('radial_blur_angle') ?? 0.1
  const post = xform.post ?? [1, 0, 0, 1, 0, 0]
  data[paramBase + 55] = post[0]
  data[paramBase + 56] = post[1]
  data[paramBase + 57] = post[2]
  data[paramBase + 58] = post[3]
  data[paramBase + 59] = post[4]
  data[paramBase + 60] = post[5]
  return data
}

export function buildParamsBuffer(flame: Flame, itersPerThread: number = 20, threadOffset: number = 0): ArrayBuffer {
  const oversample = flame.oversample
  const gutterWidth = 20
  const ht = oversample * flame.height + 2 * gutterWidth
  const wd = oversample * flame.width + 2 * gutterWidth
  const cosAngle = Math.cos(flame.angle)
  const sinAngle = Math.sin(flame.angle)
  const prefilterWhite = 1024
  const totalSamples = Math.round(flame.width * flame.height * flame.quality / (oversample * oversample))

  const buffer = new ArrayBuffer(29 * 4)
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
  u32[24] = itersPerThread
  u32[25] = threadOffset
  u32[26] = flame.finalXform ? 1 : 0

  return buffer
}
