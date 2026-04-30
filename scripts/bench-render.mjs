import puppeteer from 'puppeteer'
import { createServer } from 'vite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const PORT = 5200

const args = process.argv.slice(2)
function getArg(name, defaultVal) {
  const idx = args.indexOf(`--${name}`)
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : defaultVal
}

const testWidth = parseInt(getArg('width', '800'))
const testHeight = parseInt(getArg('height', '600'))
const testQuality = parseInt(getArg('quality', '50'))
const testOversample = parseInt(getArg('oversample', '2'))
const testTimeout = parseInt(getArg('timeout', '60')) * 1000

async function main() {
  console.log(`[bench] ${testWidth}x${testHeight} quality=${testQuality} oversample=${testOversample}`)

  const server = await createServer({
    root,
    server: { port: PORT, host: true },
    logLevel: 'silent',
  })
  await server.listen()

  let browser
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan'],
    })

    const page = await browser.newPage()

    const consoleMessages = []
    page.on('console', (msg) => {
      const text = `[${msg.type()}] ${msg.text()}`
      consoleMessages.push(text)
      if (msg.type() === 'error') console.error(`[browser] ${text}`)
    })
    page.on('pageerror', (err) => {
      consoleMessages.push(`[pageerror] ${err.message}`)
    })

    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle0', timeout: 30000 })

    await page.waitForFunction(() => {
      const canvas = document.querySelector('canvas')
      return canvas && canvas.width > 0 && canvas.height > 0
    }, { timeout: 15000 })

    const gpuLimits = await page.evaluate(async () => {
      const adapter = await navigator.gpu.requestAdapter()
      if (!adapter) return null
      return {
        maxBufferSize: adapter.limits.maxBufferSize,
        maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
        maxComputeWorkgroupsPerDimension: adapter.limits.maxComputeWorkgroupsPerDimension,
        maxTextureDimension2D: adapter.limits.maxTextureDimension2D,
      }
    })
    if (gpuLimits) {
      console.log(`[bench] GPU limits: maxBufferMB=${(gpuLimits.maxBufferSize / 1048576).toFixed(0)} maxStorageMB=${(gpuLimits.maxStorageBufferBindingSize / 1048576).toFixed(0)} maxWG=${gpuLimits.maxComputeWorkgroupsPerDimension} maxTex2D=${gpuLimits.maxTextureDimension2D}`)
    }

    const t0 = Date.now()
    const benchResult = await page.evaluate(async (w, h, q, os, timeout) => {
      const allStores = window.__pinia?._s
      if (!allStores) return { error: 'no pinia stores' }

      const rendererStore = allStores.get('renderer')
      const flameStore = allStores.get('flame')
      if (!rendererStore?.engine) return { error: 'no engine' }

      const flame = { ...flameStore.flame, width: w, height: h, quality: q, oversample: os }

      const renderStart = Date.now()
      let renderError = null
      try {
        await rendererStore.engine.renderToImageData(flame)
      } catch (e) {
        renderError = e.message
      }
      const renderTime = Date.now() - renderStart

      if (renderError) return { error: renderError, renderTime }

      const canvas = document.querySelector('canvas')
      if (!canvas) return { error: 'no canvas' }

      canvas.width = w
      canvas.height = h
      await rendererStore.engine.render(flame, canvas)

      await new Promise(r => setTimeout(r, 500))

      const tmp = document.createElement('canvas')
      tmp.width = w
      tmp.height = h
      const ctx = tmp.getContext('2d')
      if (!ctx) return { error: 'no 2d context' }
      ctx.drawImage(canvas, 0, 0)
      const data = ctx.getImageData(0, 0, w, h).data
      let nonBlack = 0
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 5 || data[i + 1] > 5 || data[i + 2] > 5) nonBlack++
      }

      return { nonBlack, total: w * h, renderTime }
    }, testWidth, testHeight, testQuality, testOversample, testTimeout)

    const totalTime = Date.now() - t0

    const hasGpuErrors = consoleMessages.some(m =>
      (m.includes('[error]') && (m.includes('GPU') || m.includes('validation') || m.includes('buffer') || m.includes('Shader')))
    )

    if (benchResult.error) {
      console.log(`---\nstatus: crash\nerror: ${benchResult.error}\ntotal_ms: ${totalTime}`)
      process.exitCode = 1
    } else {
      const pass = benchResult.nonBlack > 0 && !hasGpuErrors
      console.log(`---`)
      console.log(`status: ${pass ? 'pass' : 'fail'}`)
      console.log(`resolution: ${testWidth}x${testHeight}`)
      console.log(`quality: ${testQuality}`)
      console.log(`oversample: ${testOversample}`)
      console.log(`non_black_pixels: ${benchResult.nonBlack}`)
      console.log(`total_pixels: ${benchResult.total}`)
      console.log(`render_ms: ${benchResult.renderTime}`)
      console.log(`total_ms: ${totalTime}`)
      console.log(`gpu_errors: ${hasGpuErrors}`)
      process.exitCode = pass ? 0 : 1
    }

  } finally {
    await browser?.close()
    await server.close()
  }
}

main().catch((err) => {
  console.error('[bench] Fatal:', err.message)
  process.exitCode = 2
})
