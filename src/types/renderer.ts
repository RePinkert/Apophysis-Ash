export interface GPUXFormData {
  coefs: Float32Array           // 6 floats: a,b,c,d,e,f
  weight: number
  color: number
  symmetry: number
  variationWeights: Float32Array // 23 floats (18 builtin + 5 extended)
  julianPower: number
  julianDist: number
  preBlur: number
}

export interface GPURenderParams {
  numXforms: number
  numSamples: number
  width: number
  height: number
  oversample: number
  scale: number
  centerX: number
  centerY: number
  cosAngle: number
  sinAngle: number
  gutter: number
  brightness: number
  contrast: number
  gamma: number
  gammaThreshold: number
  vibrancy: number
  whiteLevel: number
  filterRadius: number
  prefilterWhite: number
  backgroundR: number
  backgroundG: number
  backgroundB: number
}

export interface RenderProgress {
  stage: 'iterating' | 'density' | 'filtering' | 'displaying' | 'done'
  batchCompleted: number
  totalBatches: number
  percentage: number
}

export type RenderProgressCallback = (progress: RenderProgress) => void

export const MAX_XFORMS = 12
export const MAX_VARIATIONS = 50
export const WORKGROUP_SIZE = 256
