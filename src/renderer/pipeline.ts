import type { Flame } from '../types/flame'
import { MAX_XFORMS, WORKGROUP_SIZE } from '../types/renderer'
import type { RenderProgressCallback } from '../types/renderer'
import { buildXFormBuffer, buildPaletteBuffer, buildParamsBuffer, buildFinalXFormBuffer, XFORM_STRUCT_SIZE } from './buffers'
import { VARIATIONS_WGSL } from './shaders/variations.wgsl'
import { ITERATE_SHADER, ITERATE_COMPACT_SHADER } from './shaders/iterate.wgsl'
import { DENSITY_SHADER } from './shaders/density.wgsl'
import { FILTER_SHADER, FILTER_COMPACT_SHADER } from './shaders/filter.wgsl'
import { DISPLAY_SHADER_VERT, DISPLAY_SHADER_FRAG } from './shaders/display.wgsl'

const PARAMS_SIZE = 29 * 4
const XFORMS_BUFFER_SIZE = MAX_XFORMS * XFORM_STRUCT_SIZE
const PALETTE_BUFFER_SIZE = 256 * 4 * 4
const MAX_FILTER_WIDTH = 20
const ITERS_PER_THREAD = 100

export class FlamePipeline {
  private device: GPUDevice
  private iteratePipeline!: GPUComputePipeline
  private densityPipeline!: GPUComputePipeline
  private filterPipeline!: GPUComputePipeline
  private iterateCompactPipeline!: GPUComputePipeline
  private filterCompactPipeline!: GPUComputePipeline
  private displayPipelineCache: Map<string, GPURenderPipeline> = new Map()

  private maxWorkgroups: number
  private maxBufferSize: number
  private paramsBuffer!: GPUBuffer
  private xformsBuffer!: GPUBuffer
  private paletteBuffer!: GPUBuffer
  private finalXformBuffer!: GPUBuffer
  private histogramBuffer!: GPUBuffer
  private densityBuffer!: GPUBuffer | null
  private gaussianBuffer!: GPUBuffer
  private outputTexture!: GPUTexture
  private sampler!: GPUSampler

  private canvasWidth = 0
  private canvasHeight = 0
  private histWidth = 0
  private histHeight = 0
  private lastCanvasFormat: string | null = null
  private lastCanvasWidth = 0
  private lastCanvasHeight = 0

  private constructor(device: GPUDevice) {
    this.device = device
    this.maxWorkgroups = device.limits.maxComputeWorkgroupsPerDimension
    this.maxBufferSize = device.limits.maxBufferSize
  }

  static async create(device: GPUDevice): Promise<FlamePipeline> {
    const p = new FlamePipeline(device)
    await p.createPipelines()
    p.createBuffers()
    return p
  }

  private async checkShader(module: GPUShaderModule, name: string) {
    const info = await module.getCompilationInfo()
    for (const msg of info.messages) {
      const prefix = msg.type === 'error' ? '❌' : msg.type === 'warning' ? '⚠️' : 'ℹ️'
      console[ msg.type === 'error' ? 'error' : msg.type === 'warning' ? 'warn' : 'log'](
        `[Shader ${name}] ${prefix} line ${msg.lineNum}:${msg.linePos} ${msg.message}`
      )
    }
    if (info.messages.some(m => m.type === 'error')) {
      throw new Error(`Shader ${name} compilation failed — see console for details`)
    }
  }

  private async createPipelines() {
    const varCode = VARIATIONS_WGSL

    const iterateCode = ITERATE_SHADER.replace('// __VARIATIONS_PLACEHOLDER__', varCode)
    const iterateModule = this.device.createShaderModule({ code: iterateCode })
    await this.checkShader(iterateModule, 'iterate')
    this.iteratePipeline = this.device.createComputePipeline({
      layout: 'auto',
      compute: { module: iterateModule, entryPoint: 'main' },
    })

    const densityModule = this.device.createShaderModule({ code: DENSITY_SHADER })
    await this.checkShader(densityModule, 'density')
    this.densityPipeline = this.device.createComputePipeline({
      layout: 'auto',
      compute: { module: densityModule, entryPoint: 'main' },
    })

    const filterModule = this.device.createShaderModule({ code: FILTER_SHADER })
    await this.checkShader(filterModule, 'filter')
    this.filterPipeline = this.device.createComputePipeline({
      layout: 'auto',
      compute: { module: filterModule, entryPoint: 'main' },
    })

    const iterateCompactCode = ITERATE_COMPACT_SHADER.replace('// __VARIATIONS_PLACEHOLDER__', varCode)
    const iterateCompactModule = this.device.createShaderModule({ code: iterateCompactCode })
    await this.checkShader(iterateCompactModule, 'iterate-compact')
    this.iterateCompactPipeline = this.device.createComputePipeline({
      layout: 'auto',
      compute: { module: iterateCompactModule, entryPoint: 'main' },
    })

    const filterCompactModule = this.device.createShaderModule({ code: FILTER_COMPACT_SHADER })
    await this.checkShader(filterCompactModule, 'filter-compact')
    this.filterCompactPipeline = this.device.createComputePipeline({
      layout: 'auto',
      compute: { module: filterCompactModule, entryPoint: 'main' },
    })

    this.sampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
    })
  }

  private getDisplayPipeline(format: GPUTextureFormat): GPURenderPipeline {
    const key = String(format)
    const cached = this.displayPipelineCache.get(key)
    if (cached) return cached

    const pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: this.device.createShaderModule({ code: DISPLAY_SHADER_VERT }),
        entryPoint: 'main',
      },
      fragment: {
        module: this.device.createShaderModule({ code: DISPLAY_SHADER_FRAG }),
        entryPoint: 'main',
        targets: [{ format }],
      },
      primitive: { topology: 'triangle-list' },
    })
    this.displayPipelineCache.set(key, pipeline)
    return pipeline
  }

  private createBuffers() {
    this.paramsBuffer = this.device.createBuffer({
      size: PARAMS_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    this.xformsBuffer = this.device.createBuffer({
      size: XFORMS_BUFFER_SIZE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })

    this.paletteBuffer = this.device.createBuffer({
      size: PALETTE_BUFFER_SIZE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })

    this.gaussianBuffer = this.device.createBuffer({
      size: MAX_FILTER_WIDTH * MAX_FILTER_WIDTH * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })

    this.finalXformBuffer = this.device.createBuffer({
      size: XFORM_STRUCT_SIZE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
  }

  private useCompactPath(histW: number, histH: number): boolean {
    const histBytesOrig = histW * histH * 4 * 4
    const densityBytes = histW * histH * 4 * 4
    return (histBytesOrig > this.maxBufferSize || densityBytes > this.maxBufferSize)
  }

  private ensureHistogramBuffer(w: number, h: number, compact: boolean) {
    const channelsPerPx = compact ? 2 : 4
    const histSize = w * h * channelsPerPx * 4
    if (w === this.histWidth && h === this.histHeight && this.histogramBuffer) return

    this.histWidth = w
    this.histHeight = h

    this.histogramBuffer?.destroy()
    this.densityBuffer?.destroy()
    this.densityBuffer = null

    if (histSize > this.maxBufferSize) {
      throw new Error(
        `Histogram buffer ${histSize} bytes exceeds GPU maxBufferSize ${this.maxBufferSize} bytes. ` +
        `Reduce resolution or oversample.`
      )
    }

    this.histogramBuffer = this.device.createBuffer({
      size: histSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })

    if (!compact) {
      const densitySize = w * h * 4 * 4
      this.densityBuffer = this.device.createBuffer({
        size: densitySize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      })
    }
  }

  private ensureOutputTexture(outW: number, outH: number) {
    if (outW === this.canvasWidth && outH === this.canvasHeight && this.outputTexture) return
    this.canvasWidth = outW
    this.canvasHeight = outH

    if (this.outputTexture) this.outputTexture.destroy()

    this.outputTexture = this.device.createTexture({
      size: { width: outW, height: outH },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
    })
  }

  private buildGaussianKernel(oversample: number, filterRadius: number): Float32Array {
    let filterWidth = Math.round(2 * 2.5 * oversample * filterRadius)
    if (filterWidth <= 0) filterWidth = 0
    const parity = (filterWidth + oversample) % 2
    if (parity === 1 && filterWidth > 0) filterWidth++
    if (filterWidth > MAX_FILTER_WIDTH) filterWidth = MAX_FILTER_WIDTH

    const kernel = new Float32Array(MAX_FILTER_WIDTH * MAX_FILTER_WIDTH)
    if (filterWidth === 0) return kernel

    let total = 0
    for (let y = 0; y < filterWidth; y++) {
      for (let x = 0; x < filterWidth; x++) {
        const ii = ((2 * x + 1) / filterWidth - 1) * 2.5
        const jj = ((2 * y + 1) / filterWidth - 1) * 2.5
        const val = Math.exp(-2 * (ii * ii + jj * jj))
        kernel[y * MAX_FILTER_WIDTH + x] = val
        total += val
      }
    }

    for (let i = 0; i < kernel.length; i++) {
      kernel[i] = kernel[i] / total
    }

    return kernel
  }

  private createIterateBindGroup(compact: boolean): GPUBindGroup {
    const pipeline = compact ? this.iterateCompactPipeline : this.iteratePipeline
    return this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuffer } },
        { binding: 1, resource: { buffer: this.xformsBuffer } },
        { binding: 2, resource: { buffer: this.paletteBuffer } },
        { binding: 3, resource: { buffer: this.histogramBuffer } },
        { binding: 4, resource: { buffer: this.finalXformBuffer } },
      ],
    })
  }

  private async runIterateBatches(flame: Flame, totalSamples: number, compact: boolean, onProgress?: RenderProgressCallback) {
    const maxThreads = this.maxWorkgroups * WORKGROUP_SIZE
    const itersPerThread = ITERS_PER_THREAD
    const totalThreads = Math.max(1, Math.round(totalSamples / (itersPerThread / 20)))
    const maxThreadsPerBatch = compact ? Math.min(maxThreads, 8_000_000) : maxThreads
    const threadsPerBatch = Math.min(totalThreads, maxThreadsPerBatch)
    const totalBatches = Math.ceil(totalThreads / threadsPerBatch)

    const clearEncoder = this.device.createCommandEncoder()
    clearEncoder.clearBuffer(this.histogramBuffer)
    this.device.queue.submit([clearEncoder.finish()])

    const bindGroup = this.createIterateBindGroup(compact)
    const pipeline = compact ? this.iterateCompactPipeline : this.iteratePipeline

    const baseParams = buildParamsBuffer(flame, itersPerThread, 0)
    const u32 = new Uint32Array(baseParams)

    for (let batch = 0; batch < totalBatches; batch++) {
      const remaining = totalThreads - batch * threadsPerBatch
      const batchThreads = Math.min(remaining, threadsPerBatch)
      const threadOffset = batch * threadsPerBatch

      u32[1] = batchThreads
      u32[24] = itersPerThread
      u32[25] = threadOffset
      this.device.queue.writeBuffer(this.paramsBuffer, 0, baseParams)

      const encoder = this.device.createCommandEncoder()
      const pass = encoder.beginComputePass()
      pass.setPipeline(pipeline)
      pass.setBindGroup(0, bindGroup)
      pass.dispatchWorkgroups(Math.ceil(batchThreads / WORKGROUP_SIZE))
      pass.end()
      this.device.queue.submit([encoder.finish()])

      await this.device.queue.onSubmittedWorkDone()

      if (onProgress) {
        onProgress({
          stage: 'iterating',
          batchCompleted: batch + 1,
          totalBatches,
          percentage: Math.round((batch + 1) / totalBatches * 90),
        })
      }
    }
  }

  private runPostIterateOriginal(histW: number, histH: number, outW: number, outH: number) {
    const encoder = this.device.createCommandEncoder()

    const pass2 = encoder.beginComputePass()
    pass2.setPipeline(this.densityPipeline)
    const bindGroupDensity = this.device.createBindGroup({
      layout: this.densityPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuffer } },
        { binding: 1, resource: { buffer: this.histogramBuffer } },
        { binding: 2, resource: { buffer: this.densityBuffer! } },
      ],
    })
    pass2.setBindGroup(0, bindGroupDensity)
    pass2.dispatchWorkgroups(Math.ceil(histW / 16), Math.ceil(histH / 16))
    pass2.end()

    const pass3 = encoder.beginComputePass()
    pass3.setPipeline(this.filterPipeline)
    const bindGroupFilter = this.device.createBindGroup({
      layout: this.filterPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuffer } },
        { binding: 1, resource: { buffer: this.densityBuffer! } },
        { binding: 2, resource: { buffer: this.gaussianBuffer } },
        { binding: 3, resource: this.outputTexture.createView() },
      ],
    })
    pass3.setBindGroup(0, bindGroupFilter)
    pass3.dispatchWorkgroups(Math.ceil(outW / 16), Math.ceil(outH / 16))
    pass3.end()

    this.device.queue.submit([encoder.finish()])
  }

  private runPostIterateCompact(outW: number, outH: number) {
    const encoder = this.device.createCommandEncoder()

    const pass = encoder.beginComputePass()
    pass.setPipeline(this.filterCompactPipeline)
    const bindGroup = this.device.createBindGroup({
      layout: this.filterCompactPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuffer } },
        { binding: 1, resource: { buffer: this.histogramBuffer } },
        { binding: 2, resource: { buffer: this.gaussianBuffer } },
        { binding: 3, resource: this.outputTexture.createView() },
      ],
    })
    pass.setBindGroup(0, bindGroup)
    pass.dispatchWorkgroups(Math.ceil(outW / 16), Math.ceil(outH / 16))
    pass.end()

    this.device.queue.submit([encoder.finish()])
  }

  async render(flame: Flame, canvas: HTMLCanvasElement, onProgress?: RenderProgressCallback) {
    const oversample = flame.oversample
    const gutter = 20
    const histW = oversample * flame.width + 2 * gutter
    const histH = oversample * flame.height + 2 * gutter
    const outW = flame.width
    const outH = flame.height
    const compact = this.useCompactPath(histW, histH)

    this.ensureHistogramBuffer(histW, histH, compact)
    this.ensureOutputTexture(outW, outH)

    const totalSamples = Math.round(flame.width * flame.height * flame.quality / (oversample * oversample))

    const xformsData = buildXFormBuffer(flame.xforms)
    const paletteData = buildPaletteBuffer(flame.palette, flame.paletteOffset)
    const gaussianData = this.buildGaussianKernel(oversample, flame.filterRadius)

    this.device.queue.writeBuffer(this.xformsBuffer, 0, xformsData)
    this.device.queue.writeBuffer(this.paletteBuffer, 0, paletteData)
    this.device.queue.writeBuffer(this.gaussianBuffer, 0, gaussianData)
    this.device.queue.writeBuffer(this.finalXformBuffer, 0, buildFinalXFormBuffer(flame.finalXform))

    const ctx = canvas.getContext('webgpu') as GPUCanvasContext | null
    if (!ctx) return

    const canvasFormat = navigator.gpu.getPreferredCanvasFormat()
    if (canvasFormat !== this.lastCanvasFormat
      || canvas.width !== this.lastCanvasWidth
      || canvas.height !== this.lastCanvasHeight) {
      ctx.configure({
        device: this.device,
        format: canvasFormat,
        alphaMode: 'premultiplied',
      })
      this.lastCanvasFormat = canvasFormat
      this.lastCanvasWidth = canvas.width
      this.lastCanvasHeight = canvas.height
    }

    await this.runIterateBatches(flame, totalSamples, compact, onProgress)

    const paramsData = buildParamsBuffer(flame, 20, 0)
    this.device.queue.writeBuffer(this.paramsBuffer, 0, paramsData)

    if (compact) {
      onProgress?.({ stage: 'filtering', batchCompleted: 0, totalBatches: 1, percentage: 93 })
      this.runPostIterateCompact(outW, outH)
    } else {
      onProgress?.({ stage: 'density', batchCompleted: 0, totalBatches: 1, percentage: 92 })
      this.runPostIterateOriginal(histW, histH, outW, outH)
    }

    onProgress?.({ stage: 'displaying', batchCompleted: 0, totalBatches: 1, percentage: 98 })

    const displayPipeline = this.getDisplayPipeline(canvasFormat)
    const displayBindGroup = this.device.createBindGroup({
      layout: displayPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: this.outputTexture.createView() },
      ],
    })

    const displayEncoder = this.device.createCommandEncoder()
    const currentTexture = ctx.getCurrentTexture()
    const pass4 = displayEncoder.beginRenderPass({
      colorAttachments: [{
        view: currentTexture.createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    })
    pass4.setPipeline(displayPipeline)
    pass4.setBindGroup(0, displayBindGroup)
    pass4.draw(6)
    pass4.end()
    this.device.queue.submit([displayEncoder.finish()])

    this.device.pushErrorScope('validation')
    const error = await this.device.popErrorScope()
    if (error) {
      console.error('[FlamePipeline] GPU validation error:', error.message)
    }

    onProgress?.({ stage: 'done', batchCompleted: 1, totalBatches: 1, percentage: 100 })
  }

  async renderToImageData(flame: Flame, onProgress?: RenderProgressCallback): Promise<ImageData | null> {
    const oversample = flame.oversample
    const gutter = 20
    const histW = oversample * flame.width + 2 * gutter
    const histH = oversample * flame.height + 2 * gutter
    const outW = flame.width
    const outH = flame.height
    const compact = this.useCompactPath(histW, histH)

    this.ensureHistogramBuffer(histW, histH, compact)
    this.ensureOutputTexture(outW, outH)

    const totalSamples = Math.round(flame.width * flame.height * flame.quality / (oversample * oversample))

    const xformsData = buildXFormBuffer(flame.xforms)
    const paletteData = buildPaletteBuffer(flame.palette, flame.paletteOffset)
    const gaussianData = this.buildGaussianKernel(oversample, flame.filterRadius)

    this.device.queue.writeBuffer(this.xformsBuffer, 0, xformsData)
    this.device.queue.writeBuffer(this.paletteBuffer, 0, paletteData)
    this.device.queue.writeBuffer(this.gaussianBuffer, 0, gaussianData)
    this.device.queue.writeBuffer(this.finalXformBuffer, 0, buildFinalXFormBuffer(flame.finalXform))

    await this.runIterateBatches(flame, totalSamples, compact, onProgress)

    const paramsData = buildParamsBuffer(flame, 20, 0)
    this.device.queue.writeBuffer(this.paramsBuffer, 0, paramsData)

    if (compact) {
      onProgress?.({ stage: 'filtering', batchCompleted: 0, totalBatches: 1, percentage: 93 })
      this.runPostIterateCompact(outW, outH)
    } else {
      onProgress?.({ stage: 'density', batchCompleted: 0, totalBatches: 1, percentage: 92 })
      this.runPostIterateOriginal(histW, histH, outW, outH)
    }

    onProgress?.({ stage: 'displaying', batchCompleted: 0, totalBatches: 1, percentage: 98 })

    const bytesPerRow = outW * 4
    const paddedBytesPerRow = Math.ceil(bytesPerRow / 256) * 256
    const readbackEncoder = this.device.createCommandEncoder()
    const readbackBuffer = this.device.createBuffer({
      size: paddedBytesPerRow * outH,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    })

    readbackEncoder.copyTextureToBuffer(
      { texture: this.outputTexture },
      { buffer: readbackBuffer, bytesPerRow: paddedBytesPerRow },
      { width: outW, height: outH },
    )

    this.device.queue.submit([readbackEncoder.finish()])

    await readbackBuffer.mapAsync(GPUMapMode.READ)
    const rawData = new Uint8Array(readbackBuffer.getMappedRange().slice(0))
    readbackBuffer.unmap()
    readbackBuffer.destroy()

    const imageData = new ImageData(outW, outH)
    for (let y = 0; y < outH; y++) {
      for (let x = 0; x < outW; x++) {
        const srcIdx = y * paddedBytesPerRow + x * 4
        const dstIdx = (y * outW + x) * 4
        imageData.data[dstIdx + 0] = rawData[srcIdx + 0]
        imageData.data[dstIdx + 1] = rawData[srcIdx + 1]
        imageData.data[dstIdx + 2] = rawData[srcIdx + 2]
        imageData.data[dstIdx + 3] = rawData[srcIdx + 3]
      }
    }

    onProgress?.({ stage: 'done', batchCompleted: 1, totalBatches: 1, percentage: 100 })

    return imageData
  }

  destroy() {
    this.paramsBuffer?.destroy()
    this.xformsBuffer?.destroy()
    this.paletteBuffer?.destroy()
    this.finalXformBuffer?.destroy()
    this.histogramBuffer?.destroy()
    this.densityBuffer?.destroy()
    this.gaussianBuffer?.destroy()
    this.outputTexture?.destroy()
  }
}
