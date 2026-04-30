import { initWebGPU, isWebGPUSupported } from './device'
import { FlamePipeline } from './pipeline'
import type { Flame } from '../types/flame'
import type { RenderProgressCallback } from '../types/renderer'

export class FlameEngine {
  private device: GPUDevice | null = null
  private pipeline: FlamePipeline | null = null
  private _gpuInfo = ''
  private _supported = false

  get supported() { return this._supported }
  get gpuInfo() { return this._gpuInfo }

  async init(): Promise<boolean> {
    if (!isWebGPUSupported()) {
      this._supported = false
      return false
    }

    const result = await initWebGPU()
    if (!result) {
      this._supported = false
      return false
    }

    this.device = result.device
    this._gpuInfo = result.info
    this._supported = true

    try {
      this.pipeline = await FlamePipeline.create(this.device)
    } catch (e) {
      console.error('[FlameEngine] Pipeline creation failed:', e)
      this._supported = false
      return false
    }

    this.device.lost.then((info) => {
      console.error('WebGPU device lost:', info.message)
      this._supported = false
    })

    return true
  }

  async render(flame: Flame, canvas: HTMLCanvasElement, onProgress?: RenderProgressCallback) {
    if (!this.pipeline || !this._supported) return
    await this.pipeline.render(flame, canvas, onProgress)
  }

  async renderToImageData(flame: Flame, onProgress?: RenderProgressCallback): Promise<ImageData | null> {
    if (!this.pipeline || !this._supported) return null
    return this.pipeline.renderToImageData(flame, onProgress)
  }

  destroy() {
    this.pipeline?.destroy()
    this.device?.destroy()
    this.device = null
    this.pipeline = null
    this._supported = false
  }
}
