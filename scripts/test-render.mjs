import puppeteer from 'puppeteer'
import { createServer } from 'vite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const outFile = resolve(root, 'test-output.png')

const PORT = 5199

async function main() {
  console.log('[test-render] Starting vite dev server...')
  const server = await createServer({
    root,
    server: { port: PORT, host: true },
    logLevel: 'silent',
  })
  await server.listen()

  let browser
  try {
    console.log('[test-render] Launching headless Chrome...')
    browser = await puppeteer.launch({
      headless: true,
      args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan'],
    })

    const page = await browser.newPage()

    const consoleMessages = []
    page.on('console', (msg) => {
      const text = `[${msg.type()}] ${msg.text()}`
      consoleMessages.push(text)
      const fn = msg.type() === 'error' ? console.error : msg.type() === 'warning' ? console.warn : console.log
      fn(`[browser] ${text}`)
    })
    page.on('pageerror', (err) => {
      console.error(`[browser pageerror] ${err.message}`)
      consoleMessages.push(`[pageerror] ${err.message}`)
    })

    console.log('[test-render] Navigating to page...')
    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle0', timeout: 30000 })

    console.log('[test-render] Waiting for GPU init + render (up to 15s)...')
    await page.waitForFunction(() => {
      const app = document.querySelector('.app')
      if (!app) return false
      const canvas = document.querySelector('canvas')
      if (!canvas) return false
      return canvas.width > 0 && canvas.height > 0
    }, { timeout: 15000 })

    await new Promise(r => setTimeout(r, 3000))

    const result = await page.evaluate(async () => {
      const src = document.querySelector('canvas')
      if (!src) return { nonBlack: -1, total: 0, w: 0, h: 0 }
      const tmp = document.createElement('canvas')
      tmp.width = src.width
      tmp.height = src.height
      const ctx = tmp.getContext('2d')
      if (!ctx) return { nonBlack: -2, total: 0, w: src.width, h: src.height }
      ctx.drawImage(src, 0, 0)
      const data = ctx.getImageData(0, 0, tmp.width, tmp.height).data
      let nonBlack = 0
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 5 || data[i + 1] > 5 || data[i + 2] > 5) nonBlack++
      }

      let gpuData = null
      try {
        const { useRendererStore, useFlameStore } = await import('/src/stores/renderer.ts').then(async () => {
          const { useRendererStore: r } = await import('/src/stores/renderer.ts')
          const { useFlameStore: f } = await import('/src/stores/flame.ts')
          return { useRendererStore: r, useFlameStore: f }
        }).catch(async () => {
          const mod = await import('/src/stores/flame.ts')
          return mod
        })
      } catch (e2) {
        gpuData = { error: 'store import failed: ' + e2.message }
      }

      if (!gpuData) {
        try {
          const resp = await fetch('/__ash_render_test')
        } catch {}

        const allStores = window.__pinia?._s
        if (!allStores) {
          gpuData = { error: 'no pinia stores found' }
        } else {
          const rendererStore = allStores.get('renderer')
          const flameStore = allStores.get('flame')
          if (!rendererStore?.engine || !flameStore?.flame) {
            gpuData = { error: `engine=${!!rendererStore?.engine} flame=${!!flameStore?.flame}` }
          } else {
            const imgData = await rendererStore.engine.renderToImageData(flameStore.flame)
            if (imgData) {
              let gpuNonBlack = 0
              for (let i = 0; i < imgData.data.length; i += 4) {
                if (imgData.data[i] > 5 || imgData.data[i + 1] > 5 || imgData.data[i + 2] > 5) gpuNonBlack++
              }
              gpuData = { nonBlack: gpuNonBlack, total: imgData.width * imgData.height, w: imgData.width, h: imgData.height }
            } else {
              gpuData = { error: 'renderToImageData returned null' }
            }
          }
        }
      }

      return { nonBlack, total: tmp.width * tmp.height, w: tmp.width, h: tmp.height, gpuData }
    })

    console.log(`[test-render] Canvas drawImage: ${result.nonBlack} / ${result.total} non-black (${result.w}x${result.h})`)
    if (result.gpuData) {
      if (result.gpuData.error) {
        console.error(`[test-render] GPU renderToImageData error: ${result.gpuData.error}`)
      } else {
        console.log(`[test-render] GPU readback: ${result.gpuData.nonBlack} / ${result.gpuData.total} non-black (${result.gpuData.w}x${result.gpuData.h})`)
      }
    }

    const canvas = await page.$('canvas')
    if (canvas) {
      await canvas.screenshot({ path: outFile, type: 'png' })
      console.log(`[test-render] Screenshot saved to ${outFile}`)
    }

    const hasErrors = consoleMessages.some(m => m.includes('[error]') || m.includes('failed'))
    if (hasErrors) {
      console.error('\n[test-render] ERRORS DETECTED:')
      consoleMessages.filter(m => m.includes('[error]') || m.includes('failed'))
        .forEach(m => console.error(`  ${m}`))
    }

    const gpuPass = result.gpuData && !result.gpuData.error && result.gpuData.nonBlack > 0
    console.log(`\n[test-render] Result: ${result.nonBlack > 0 || gpuPass ? 'PASS' : 'FAIL'}`)
    process.exitCode = result.nonBlack > 0 || gpuPass ? 0 : 1

  } finally {
    await browser?.close()
    await server.close()
  }
}

main().catch((err) => {
  console.error('[test-render] Fatal error:', err)
  process.exitCode = 2
})
