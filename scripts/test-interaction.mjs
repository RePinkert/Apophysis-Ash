import puppeteer from 'puppeteer'
import { createServer } from 'vite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const PORT = 5199

const TESTS = []

function test(name, fn) {
  TESTS.push({ name, fn })
}

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERT FAIL: ${message}`)
}

async function getFlameState(page) {
  return page.evaluate(() => {
    const stores = window.__pinia?._s
    if (!stores) return null
    const fs = stores.get('flame')
    const rs = stores.get('renderer')
    if (!fs?.flame) return null
    return {
      center: [...fs.flame.center],
      scale: fs.flame.scale,
      rotate: fs.flame.rotate,
      angle: fs.flame.angle,
      width: fs.flame.width,
      height: fs.flame.height,
      paletteOffset: fs.flame.paletteOffset,
      xformsCount: fs.flame.xforms.length,
      xformVariations: fs.flame.xforms.map(xf => {
        const entries = []
        xf.variations.forEach((v, k) => entries.push([k, v]))
        return entries
      }),
      canUndo: fs.canUndo,
      canRedo: fs.canRedo,
      lastRenderTime: rs?.lastRenderTime ?? 0,
      gpuSupported: rs?.gpuSupported ?? false,
    }
  })
}

async function storeCall(page, expression) {
  return page.evaluate((expr) => {
    const stores = window.__pinia?._s
    if (!stores) throw new Error('No pinia stores')
    const fs = stores.get('flame')
    const fn = new Function('flameStore', `return (${expr})`)
    return fn(fs)
  }, expression)
}

async function waitNewRender(page, preRenderTime, timeoutMs = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const lrt = await page.evaluate(() => {
      const stores = window.__pinia?._s
      return stores?.get('renderer')?.lastRenderTime ?? 0
    })
    if (lrt !== preRenderTime && lrt > 0) {
      await new Promise(r => setTimeout(r, 100))
      return lrt
    }
    await new Promise(r => setTimeout(r, 300))
  }
  return -1
}

// ── Test definitions ──

test('initial render', async (page) => {
  const state = await getFlameState(page)
  assert(state !== null, 'store accessible')
  assert(state.gpuSupported, 'WebGPU supported')
  assert(state.lastRenderTime > 0, `lastRenderTime = ${state.lastRenderTime}`)
  console.log(`    GPU ok, render: ${state.lastRenderTime.toFixed(0)}ms`)
})

test('pan: updateRenderParam center', async (page) => {
  const pre = await getFlameState(page)
  await storeCall(page, `flameStore.updateRenderParam('center', [1.5, -0.8])`)
  await new Promise(r => setTimeout(r, 400))
  const newLrt = await waitNewRender(page, pre.lastRenderTime)
  const post = await getFlameState(page)

  assert(newLrt > 0, `render did not trigger: pre=${pre.lastRenderTime}, post=${post.lastRenderTime}`)
  assert(post.center[0] === 1.5, `center[0] = ${post.center[0]}`)
  assert(post.center[1] === -0.8, `center[1] = ${post.center[1]}`)
  assert(post.xformVariations.length > 0, 'variations intact')
  console.log(`    center=[${post.center}], render: ${post.lastRenderTime.toFixed(0)}ms`)
})

test('rotate: batchUpdateRenderParams', async (page) => {
  const pre = await getFlameState(page)
  await storeCall(page, `flameStore.batchUpdateRenderParams({ rotate: 45, angle: Math.PI / 4 })`)
  await new Promise(r => setTimeout(r, 400))
  const newLrt = await waitNewRender(page, pre.lastRenderTime)
  const post = await getFlameState(page)

  assert(newLrt > 0, `render did not trigger`)
  assert(post.rotate === 45, `rotate = ${post.rotate}`)
  assert(Math.abs(post.angle - Math.PI / 4) < 0.001, `angle = ${post.angle}`)
  assert(post.xformVariations.length > 0, 'variations intact')
  console.log(`    rotate=${post.rotate}, angle=${post.angle.toFixed(4)}, render: ${post.lastRenderTime.toFixed(0)}ms`)
})

test('undo rotate', async (page) => {
  const pre = await getFlameState(page)
  assert(pre.canUndo, `canUndo = false`)
  assert(pre.rotate === 45, `pre-undo rotate = ${pre.rotate}`)

  await storeCall(page, `flameStore.undo()`)
  await new Promise(r => setTimeout(r, 400))
  const newLrt = await waitNewRender(page, pre.lastRenderTime)
  const post = await getFlameState(page)

  assert(newLrt > 0, `render did not trigger after undo`)
  assert(post.rotate === 0, `rotate = ${post.rotate}, expected 0`)
  assert(post.xformVariations.every(v => v.length > 0), 'all xforms have variations after undo')
  console.log(`    rotate=${post.rotate}, variations intact, render: ${post.lastRenderTime.toFixed(0)}ms`)
})

test('redo after undo', async (page) => {
  const pre = await getFlameState(page)
  console.log(`    pre: canRedo=${pre.canRedo}, canUndo=${pre.canUndo}, rotate=${pre.rotate}`)
  assert(pre.canRedo, `canRedo = false after undo`)

  await storeCall(page, `flameStore.redo()`)
  await new Promise(r => setTimeout(r, 400))
  const newLrt = await waitNewRender(page, pre.lastRenderTime)
  const post = await getFlameState(page)

  assert(newLrt > 0, `render did not trigger after redo`)
  assert(post.xformVariations.every(v => v.length > 0), 'variations intact after redo')
  console.log(`    variations intact, render: ${post.lastRenderTime.toFixed(0)}ms`)
})

test('zoom: batchUpdateRenderParams', async (page) => {
  const pre = await getFlameState(page)
  const newScale = pre.scale * 2

  await storeCall(page, `flameStore.batchUpdateRenderParams({ center: [0, 0], scale: ${newScale} })`)
  await new Promise(r => setTimeout(r, 400))
  const newLrt = await waitNewRender(page, pre.lastRenderTime)
  const post = await getFlameState(page)

  assert(newLrt > 0, `render did not trigger`)
  assert(post.scale === newScale, `scale = ${post.scale}, expected ${newScale}`)
  console.log(`    scale=${post.scale}, render: ${post.lastRenderTime.toFixed(0)}ms`)
})

test('paletteOffset', async (page) => {
  const pre = await getFlameState(page)
  await storeCall(page, `flameStore.setPaletteOffset(64)`)
  await new Promise(r => setTimeout(r, 400))
  const newLrt = await waitNewRender(page, pre.lastRenderTime)
  const post = await getFlameState(page)

  assert(newLrt > 0, `render did not trigger`)
  assert(post.paletteOffset === 64, `paletteOffset = ${post.paletteOffset}`)
  console.log(`    offset=${post.paletteOffset}, render: ${post.lastRenderTime.toFixed(0)}ms`)
})

test('undo palette', async (page) => {
  const pre = await getFlameState(page)
  await storeCall(page, `flameStore.undo()`)
  await new Promise(r => setTimeout(r, 400))
  const newLrt = await waitNewRender(page, pre.lastRenderTime)
  const post = await getFlameState(page)

  assert(newLrt > 0, `render did not trigger`)
  assert(post.xformVariations.every(v => v.length > 0), 'variations intact after palette undo')
  console.log(`    offset=${post.paletteOffset}, render: ${post.lastRenderTime.toFixed(0)}ms`)
})

test('deep undo/redo cycle', async (page) => {
  for (let i = 0; i < 5; i++) {
    await storeCall(page, `flameStore.updateRenderParam('center', [${i * 0.5}, ${i * 0.3}])`)
    await new Promise(r => setTimeout(r, 400))
  }
  const afterWrites = await getFlameState(page)
  assert(afterWrites.lastRenderTime > 0, 'rendered after writes')

  for (let i = 0; i < 4; i++) {
    const pre = await getFlameState(page)
    assert(pre.canUndo, `canUndo at undo step ${i}`)
    await storeCall(page, `flameStore.undo()`)
    await new Promise(r => setTimeout(r, 400))
  }
  const afterUndos = await getFlameState(page)
  assert(afterUndos.xformVariations.every(v => v.length > 0), 'variations intact after undos')

  for (let i = 0; i < 4; i++) {
    const pre = await getFlameState(page)
    assert(pre.canRedo, `canRedo at redo step ${i}`)
    await storeCall(page, `flameStore.redo()`)
    await new Promise(r => setTimeout(r, 400))
  }
  const afterRedos = await getFlameState(page)
  assert(afterRedos.xformVariations.every(v => v.length > 0), 'variations intact after redos')
  console.log(`    5 writes + 4 undos + 4 redos, variations intact`)
})

// ── Main runner ──

async function main() {
  console.log('[test-interaction] Starting vite dev server...')
  const server = await createServer({
    root,
    server: { port: PORT, host: true },
    logLevel: 'silent',
  })
  await server.listen()

  let browser
  let passed = 0
  let failed = 0

  try {
    console.log('[test-interaction] Launching headless Chrome...')
    browser = await puppeteer.launch({
      headless: true,
      args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--force_high_performance_gpu'],
    })

    const page = await browser.newPage()

    const consoleErrors = []
    page.on('console', (msg) => {
      const text = `[${msg.type()}] ${msg.text()}`
      if (msg.type() === 'error') {
        consoleErrors.push(text)
        console.error(`    [browser] ${text}`)
      }
    })
    page.on('pageerror', (err) => {
      consoleErrors.push(`[pageerror] ${err.message}`)
      console.error(`    [browser] ${err.message}`)
    })

    console.log('[test-interaction] Navigating...')
    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle0', timeout: 30000 })

    console.log('[test-interaction] Waiting for GPU init + render...')
    await page.waitForFunction(() => {
      const canvas = document.querySelector('canvas')
      if (!canvas) return false
      return canvas.width > 0 && canvas.height > 0
    }, { timeout: 15000 })

    await new Promise(r => setTimeout(r, 3000))

    console.log('[test-interaction] Running tests...\n')

    for (const t of TESTS) {
      process.stdout.write(`  TEST: ${t.name} ... `)
      const preErrors = consoleErrors.length
      try {
        await t.fn(page)
        const newErrors = consoleErrors.slice(preErrors).filter(e =>
          e.includes('Render error') || e.includes('.get is not') || e.includes('DataCloneError')
        )
        if (newErrors.length > 0) {
          throw new Error(`Browser errors: ${newErrors.join('; ')}`)
        }
        passed++
        console.log(`PASS`)
      } catch (err) {
        failed++
        console.log(`FAIL`)
        console.error(`    ${err.message}`)
      }
    }

    console.log(`\n[test-interaction] Results: ${passed} passed, ${failed} failed, ${TESTS.length} total`)

    process.exitCode = failed > 0 ? 1 : 0

  } finally {
    await browser?.close()
    await server.close()
  }
}

main().catch((err) => {
  console.error('[test-interaction] Fatal error:', err)
  process.exitCode = 2
})
