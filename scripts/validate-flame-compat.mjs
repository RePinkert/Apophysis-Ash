import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PLUGINS_DIR = join(ROOT, '..', 'Plugins')
const EXE_PATH = join(ROOT, '..', 'Apophysis7X64.exe')
const REF_FLAME = resolve(ROOT, '..', '..', 'NeoFractal', 'renders7X.flame')

const SEV = { FATAL: 'FAIL', HIGH: 'FAIL', MEDIUM: 'WARN', LOW: 'INFO', INFO: 'INFO' }
const C = { FAIL: '\x1b[31m', WARN: '\x1b[33m', INFO: '\x1b[36m', PASS: '\x1b[32m', RST: '\x1b[0m', B: '\x1b[1m' }

function p(sev, msg) {
  const tag = SEV[sev] || sev
  const color = C[tag] || ''
  console.log(`${color}[${tag}]${C.RST} ${msg}`)
}

function pass(msg) { console.log(`${C.PASS}[PASS]${C.RST} ${msg}`) }
function fail(msg) { console.log(`${C.FAIL}[FAIL]${C.RST} ${msg}`) }
function warn(msg) { console.log(`${C.WARN}[WARN]${C.RST} ${msg}`) }
function info(msg) { console.log(`${C.INFO}[INFO]${C.RST} ${msg}`) }

// ─── Apophysis 7X built-in variations (29, from source) ───
const APO7X_BUILTIN = new Set([
  'linear', 'flatten', 'sinusoidal', 'spherical', 'swirl', 'horseshoe',
  'polar', 'disc', 'spiral', 'hyperbolic', 'diamond', 'eyefish', 'bubble',
  'cylinder', 'noise', 'blur', 'gaussian_blur', 'zblur', 'blur3d',
  'pre_blur', 'pre_zscale', 'pre_ztranslate', 'pre_rotate_x', 'pre_rotate_y',
  'zscale', 'ztranslate', 'zcone', 'post_rotate_x', 'post_rotate_y',
])

// Classic flam3 variations that are compiled into Apophysis 7X via BaseVariation
const APO7X_CLASSIC = new Set([
  'julia', 'heart', 'ex', 'handkerchief', 'fisheye', 'waves',
  'bent', 'popcorn',
])

// Variations compiled into Apophysis 7X via Variation*.pas units (not in 29 built-in list,
// no plugin DLL, but confirmed by binary search and WORKLOG-06 testing)
const APO7X_COMPILED = new Set([
  'julian', 'juliascope', 'blob', 'pdj', 'curl', 'ngon',
  'bipolar', 'elliptic', 'power', 'rings',
  'wedge', 'bwraps', 'bwraps7', 'radial_blur',
])

// ─── Plugin DLL names ───
function loadPluginNames() {
  try {
    const files = readdirSync(PLUGINS_DIR)
    const names = new Set()
    for (const f of files) {
      const m = f.match(/^(.+)\.(x64|x86)\.dll$/i)
      if (m) names.add(m[1].toLowerCase())
    }
    return names
  } catch {
    return new Set()
  }
}

const PLUGIN_DLLS = loadPluginNames()

// ─── Parameterized variations and their required params ───
const VAR_REQUIRED_PARAMS = {
  julian: ['julian_power', 'julian_dist'],
  rings: ['rings_coeff'],
  fan: ['fan_dist'],
  blob: ['blob_low', 'blob_high', 'blob_waves'],
  pdj: ['pdj_a', 'pdj_b', 'pdj_c', 'pdj_d'],
  perspective: ['perspective_angle', 'perspective_dist'],
  ngon: ['ngon_power', 'ngon_sides', 'ngon_corners', 'ngon_circle'],
  curl: ['curl_c1', 'curl_c2'],
  bipolar: ['bipolar_shift'],
  cell: ['cell_size'],
  crackle: ['crackle_seed', 'crackle_scale', 'crackle_z', 'crackle_spreadx', 'crackle_spready'],
  juliascope: ['juliascope_power', 'juliascope_dist'],
  split: ['split_xsize', 'split_ysize'],
  wedge: ['wedge_angle', 'wedge_hole', 'wedge_count', 'wedge_swirl'],
  wedge_julia: ['wedge_julia_power', 'wedge_julia_angle', 'wedge_julia_count', 'wedge_julia_dist'],
  wedge_sph: ['wedge_sph_angle', 'wedge_sph_hole', 'wedge_sph_count', 'wedge_sph_swirl'],
  bwraps: ['bwraps_cellsize', 'bwraps_space', 'bwraps_gain', 'bwraps_inner_twist', 'bwraps_outer_twist'],
  bwraps7: ['bwraps7_cellsize', 'bwraps7_space', 'bwraps7_gain', 'bwraps7_inner_twist', 'bwraps7_outer_twist'],
  motion_blur: ['motion_blur_angle', 'motion_blur_length'],
  radial_blur: ['radial_blur_angle'],
}

// ─── Apo 7X simulated regex parser (from ParameterIO.pas) ───
const RE_FLAME = /<flame(.*?)>(.*?)<\/flame>/gs
const RE_XFORM = /<((?:final)?xform)(.*?)\/>/gs
const RE_PALETTE = /<palette(.*?)>([a-fA-F0-9\s]+)<\/palette>/s
const RE_ATTRIB = /([0-9a-z_]+)="(.*?)"/g

// Reserved xform attributes (not variation weights)
const XFORM_RESERVED = new Set([
  'weight', 'color', 'symmetry', 'coefs', 'post', 'var_type', 'opacity',
  'name', 'animate', 'color_speed', 'chaos', 'plotmode', 'enabled', 'var_color',
])

// Known variation names (ash's full list)
const ALL_ASH_VARIATIONS = new Set([
  'linear', 'sinusoidal', 'spherical', 'swirl', 'horseshoe', 'polar',
  'handkerchief', 'heart', 'disc', 'spiral', 'hyperbolic', 'diamond',
  'ex', 'julia', 'bent', 'waves', 'fisheye', 'popcorn',
  'julian', 'bubble', 'pre_blur', 'noise', 'blur', 'exponential', 'power',
  'cosine', 'rings', 'fan', 'blob', 'pdj', 'perspective', 'ngon', 'curl',
  'bipolar', 'elliptic', 'cell', 'crackle', 'juliascope', 'split', 'wedge',
  'wedge_julia', 'wedge_sph', 'bwraps', 'bwraps7', 'motion_blur', 'zblur',
  'gaussian_blur', 'radial_blur', 'post_rotate_x', 'post_rotate_y',
])

function parseAttribs(attrStr) {
  const attrs = new Map()
  const order = []
  let m
  const re = new RegExp(RE_ATTRIB.source, 'g')
  while ((m = re.exec(attrStr)) !== null) {
    attrs.set(m[1], m[2])
    order.push(m[1])
  }
  return { attrs, order }
}

function stripFlamesWrapper(xml) {
  const m = xml.match(/<flames[^>]*>([\s\S]*)<\/flames>/i)
  if (!m) return xml
  return m[1]
}

function parseFlameBlocks(xml) {
  const inner = stripFlamesWrapper(xml)
  const blocks = []
  let m
  const re = new RegExp(RE_FLAME.source, RE_FLAME.flags)
  while ((m = re.exec(inner)) !== null) {
    blocks.push({ attrStr: m[1], content: m[2], index: m.index })
  }
  return blocks
}

function parseXForms(content) {
  const xforms = []
  let m
  const re = new RegExp(RE_XFORM.source, RE_XFORM.flags)
  while ((m = re.exec(content)) !== null) {
    xforms.push({ tag: m[1], attrStr: m[2], index: m.index })
  }
  return xforms
}

function parsePalette(content) {
  const m = content.match(RE_PALETTE)
  if (!m) return null
  return { attrStr: m[1], hexData: m[2] }
}

function isRecognizedVariation(name) {
  if (APO7X_BUILTIN.has(name)) return 'BUILTIN'
  if (APO7X_CLASSIC.has(name)) return 'CLASSIC'
  if (APO7X_COMPILED.has(name)) return 'COMPILED'
  if (PLUGIN_DLLS.has(name.toLowerCase())) return 'PLUGIN'
  return null
}

function isKnownVariationParam(name) {
  for (const [vname, params] of Object.entries(VAR_REQUIRED_PARAMS)) {
    if (params.includes(name)) return vname
  }
  return null
}

// ─── Validation engine ───
function validateFlameXML(xml, label = 'unknown') {
  const results = { pass: 0, fail: 0, warn: 0, info: 0 }
  const log = []

  function check(sev, msg) {
    const tag = SEV[sev]
    results[tag.toLowerCase()] = (results[tag.toLowerCase()] || 0) + 1
    log.push({ sev, tag, msg })
  }

  console.log(`\n${C.B}── Validating: ${label} ──${C.RST}\n`)

  // 1. Root structure
  if (!xml.includes('<flames')) {
    check('FATAL', 'No <flames> root element found')
  } else {
    pass('Root <flames> element found')
    results.pass++
  }

  if (!xml.includes('</flames>')) {
    check('FATAL', 'No closing </flames> tag')
  } else {
    pass('Closing </flames> tag found')
    results.pass++
  }

  // 2. Parse flame blocks using Apo7X regex
  const flameBlocks = parseFlameBlocks(xml)

  // Check for false positive match on <flames>
  if (flameBlocks.length === 0) {
    check('FATAL', 'No <flame> blocks matched by Apo7X regex')
    return results
  }

  // Check if <flames> root was falsely matched
  const firstBlock = flameBlocks[0]
  if (firstBlock.attrStr.trim() === '' || firstBlock.attrStr.trim() === 's') {
    // This is likely a false match on <flames> or <flames name="...">
    if (firstBlock.attrStr.includes('name=') || firstBlock.attrStr.trim() === 's') {
      warn('Apo7X regex may falsely match <flames> root as first <flame> block (attrStr: "' + firstBlock.attrStr.trim().substring(0, 50) + '")')
      results.warn++
    }
  }

  info(`Found ${flameBlocks.length} <flame> block(s) via Apo7X regex`)
  results.info++

  for (let fi = 0; fi < flameBlocks.length; fi++) {
    const block = flameBlocks[fi]
    const { attrs, order } = parseAttribs(block.attrStr)
    const xforms = parseXForms(block.content)
    const palette = parsePalette(block.content)

    console.log(`\n  ${C.B}Flame #${fi + 1}: "${attrs.get('name') || '(unnamed)'}"${C.RST}`)

    // 3. Required flame attributes
    const requiredFlameAttrs = {
      version: 'Apophysis 7x',
      size: null,
      center: null,
      scale: null,
      oversample: null,
      filter: null,
      quality: null,
      background: null,
      brightness: null,
      gamma: null,
      gamma_threshold: null,
    }

    for (const [name, expected] of Object.entries(requiredFlameAttrs)) {
      if (!attrs.has(name)) {
        check('HIGH', `Flame #${fi + 1}: missing required attribute "${name}"`)
      } else if (expected !== null && attrs.get(name) !== expected) {
        check('HIGH', `Flame #${fi + 1}: attribute "${name}"="${attrs.get(name)}", expected "${expected}"`)
      } else {
        results.pass++
      }
    }

    // 4. version casing
    if (attrs.has('version')) {
      const v = attrs.get('version')
      if (v === 'Apophysis 7x') {
        pass(`  version="${v}" (correct)`)
        results.pass++
      } else {
        check('HIGH', `version="${v}" — should be "Apophysis 7x"`)
      }
    }

    // 5. rotate / vibrancy order
    const rotateIdx = order.indexOf('rotate')
    const vibrancyIdx = order.indexOf('vibrancy')
    if (rotateIdx >= 0) {
      if (attrs.get('rotate') !== '0') {
        check('HIGH', `Flame #${fi + 1}: rotate="${attrs.get('rotate')}" — should be "0" to avoid vibrancy corruption bug in Apo7X`)
      } else {
        results.pass++
      }
      if (vibrancyIdx >= 0 && vibrancyIdx < rotateIdx) {
        check('FATAL', `Flame #${fi + 1}: vibrancy (pos ${vibrancyIdx}) comes BEFORE rotate (pos ${rotateIdx}) — Apo7X will overwrite vibrancy!`)
      } else if (vibrancyIdx >= 0) {
        pass(`  vibrancy after rotate (order OK)`)
        results.pass++
      } else {
        check('HIGH', `Flame #${fi + 1}: has rotate but no vibrancy attribute — vibrancy will be corrupted to 0`)
      }
    }

    // 6. new_linear
    if (attrs.has('new_linear')) {
      if (attrs.get('new_linear') === '1') {
        results.pass++
      } else {
        check('MEDIUM', `new_linear="${attrs.get('new_linear')}", expected "1"`)
      }
    } else {
      check('MEDIUM', 'Missing new_linear attribute')
    }

    // 7. curves
    if (attrs.has('curves')) {
      const curvesVals = attrs.get('curves').trim().split(/\s+/)
      if (curvesVals.length !== 48) {
        check('MEDIUM', `curves has ${curvesVals.length} values, expected 48`)
      } else {
        results.pass++
      }
    } else {
      check('MEDIUM', 'Missing curves attribute')
    }

    // 8. estimator_* and enable_de
    for (const ea of ['estimator_radius', 'estimator_minimum', 'estimator_curve', 'enable_de']) {
      if (!attrs.has(ea)) {
        check('MEDIUM', `Missing ${ea} attribute`)
      }
    }

    // 9. plugins attribute
    const pluginsAttr = attrs.get('plugins') || ''
    const declaredPlugins = pluginsAttr ? pluginsAttr.trim().split(/\s+/) : []

    // 10. Validate xforms
    info(`  Found ${xforms.length} xform(s)`)
    results.info++

    const allVariations = new Set()
    const allParams = new Set()

    for (const xf of xforms) {
      const { attrs: xfAttrs, order: xfOrder } = parseAttribs(xf.attrStr)
      const isFinal = xf.tag === 'finalxform'

      // opacity check
      if (!xfAttrs.has('opacity')) {
        check('FATAL', `${xf.tag}: missing opacity attribute — Apo7X may crash or misparse`)
      } else {
        results.pass++
      }

      // coefs check
      if (!xfAttrs.has('coefs')) {
        check('HIGH', `${xf.tag}: missing coefs attribute`)
      } else {
        const coefsParts = xfAttrs.get('coefs').split(/\s+/)
        if (coefsParts.length !== 6) {
          check('HIGH', `${xf.tag}: coefs has ${coefsParts.length} values, expected 6`)
        } else if (coefsParts.some(v => isNaN(parseFloat(v)))) {
          check('HIGH', `${xf.tag}: coefs contains non-numeric values`)
        } else {
          results.pass++
        }
      }

      // Analyze attributes: variation weights vs params vs unknown
      const xfVariations = new Map()
      const xfParams = new Map()
      const unknownAttrs = []

      for (const [key, val] of xfAttrs) {
        if (XFORM_RESERVED.has(key)) continue
        const num = parseFloat(val)
        if (isNaN(num)) continue

        if (ALL_ASH_VARIATIONS.has(key)) {
          xfVariations.set(key, num)
          allVariations.add(key)
        } else if (isKnownVariationParam(key) || key.includes('_')) {
          xfParams.set(key, num)
          allParams.add(key)
        } else {
          // Could be a variation or param we don't know about
          unknownAttrs.push(key)
        }
      }

      // Check each variation for compatibility
      for (const [vname, weight] of xfVariations) {
        if (weight === 0) continue
        const recognized = isRecognizedVariation(vname)
        if (!recognized) {
          check('HIGH', `${xf.tag}: variation "${vname}" NOT recognized by Apophysis 7X (no built-in support and no matching plugin DLL)`)
        } else if (recognized === 'PLUGIN') {
          // Check if it's listed in plugins attribute
          if (!declaredPlugins.includes(vname)) {
            check('MEDIUM', `${xf.tag}: variation "${vname}" requires plugin but not listed in plugins attribute`)
          }
        }
      }

      // Check required params for parameterized variations
      for (const [vname, weight] of xfVariations) {
        if (weight === 0) continue
        const required = VAR_REQUIRED_PARAMS[vname]
        if (!required) continue
        for (const paramName of required) {
          if (!xfParams.has(paramName) && !xfAttrs.has(paramName)) {
            check('HIGH', `${xf.tag}: variation "${vname}" missing required param "${paramName}"`)
          }
        }
      }

      if (unknownAttrs.length > 0) {
        info(`  ${xf.tag}: unrecognized attributes: ${unknownAttrs.join(', ')}`)
        results.info++
      }
    }

    // 11. Validate plugins attribute completeness
    for (const v of allVariations) {
      const recognized = isRecognizedVariation(v)
      if (recognized === 'PLUGIN' && !declaredPlugins.includes(v)) {
        check('MEDIUM', `plugins attribute missing "${v}" (plugin DLL exists)`)
      }
    }

    // 12. Validate palette
    if (!palette) {
      check('FATAL', 'No <palette> element found in flame')
    } else {
      const palAttrs = parseAttribs(palette.attrStr)
      const count = parseInt(palAttrs.attrs.get('count') || '0')
      const format = palAttrs.attrs.attrs?.get?.('format') || palAttrs.attrs.get('format')

      if (format !== 'RGB') {
        check('HIGH', `palette format="${format}", expected "RGB"`)
      } else {
        results.pass++
      }

      if (count !== 256) {
        check('MEDIUM', `palette count="${count}", expected 256`)
      }

      const hexClean = palette.hexData.replace(/[^a-fA-F0-9]/g, '')
      const expectedLen = count * 6
      if (hexClean.length < expectedLen) {
        check('HIGH', `palette hex data: ${hexClean.length} chars, expected ${expectedLen} (${count} colors × 6)`)
      } else {
        results.pass++
      }

      // Check for valid hex
      if (!/^[a-fA-F0-9]+$/.test(hexClean)) {
        check('HIGH', 'palette hex data contains non-hex characters')
      }
    }

    // 13. background range check
    if (attrs.has('background')) {
      const bgParts = attrs.get('background').split(/\s+/).map(Number)
      if (bgParts.length !== 3 || bgParts.some(isNaN)) {
        check('HIGH', `background="${attrs.get('background')}" — expected 3 space-separated numbers`)
      } else {
        const maxVal = Math.max(...bgParts)
        if (maxVal > 1 && maxVal <= 255) {
          check('MEDIUM', `background values are 0-255 range (${bgParts.join(' ')}), original Apo7X saves as 0-1 floats — may still parse correctly`)
        } else if (maxVal > 255) {
          check('HIGH', `background values out of range: ${bgParts.join(' ')}`)
        } else {
          results.pass++
        }
      }
    }
  }

  // Print all logged messages
  for (const item of log) {
    const fn = item.tag === 'FAIL' ? fail : item.tag === 'WARN' ? warn : info
    fn(item.msg)
  }

  return results
}

// ─── Test XML generator (mimics ash exportFlameXML) ───
function generateTestXML(testCase) {
  const lines = []

  const tc = {
    name: 'test',
    version: 'Apophysis 7x',
    size: '640 480',
    center: '0 0',
    scale: 200,
    angle: 0,
    rotate: 0,
    oversample: 2,
    filter: 0.5,
    quality: 50,
      background: '0 0 0',
      brightness: 4,
      gamma: 4,
      gammaThreshold: 0.01,
      vibrancy: 1,
    contrast: 1,
    whiteLevel: 200,
    curves: '0 0 1 0 0 1 1 1 1 1 1 1 0 0 1 0 0 1 1 1 1 1 1 1 0 0 1 0 0 1 1 1 1 1 1 1 0 0 1 0 0 1 1 1 1 1 1 1',
    plugins: '',
    xforms: [],
    finalXform: null,
    palette: null,
    ...testCase,
  }

  // Build xform strings
  const xformStrs = tc.xforms.map(xf => {
    const attrs = []
    attrs.push(`weight="${xf.weight ?? 0.5}"`)
    attrs.push(`color="${xf.color ?? 0}"`)
    if (xf.symmetry !== undefined) attrs.push(`symmetry="${xf.symmetry}"`)
    attrs.push(`coefs="${xf.coefs ?? '1 0 0 1 0 0'}"`)
    if (xf.post) attrs.push(`post="${xf.post}"`)
    attrs.push('opacity="1"')
    if (xf.variations) {
      for (const [name, w] of Object.entries(xf.variations)) {
        if (w !== 0) attrs.push(`${name}="${w}"`)
      }
    }
    if (xf.params) {
      for (const [name, val] of Object.entries(xf.params)) {
        attrs.push(`${name}="${val}"`)
      }
    }
    return `   <xform ${attrs.join(' ')}/>`
  })

  let finalStr = ''
  if (tc.finalXform) {
    const xf = tc.finalXform
    const attrs = []
    attrs.push(`color="${xf.color ?? 0}"`)
    attrs.push(`coefs="${xf.coefs ?? '1 0 0 1 0 0'}"`)
    attrs.push('opacity="1"')
    if (xf.variations) {
      for (const [name, w] of Object.entries(xf.variations)) {
        if (w !== 0) attrs.push(`${name}="${w}"`)
      }
    }
    finalStr = `   <finalxform ${attrs.join(' ')}/>`
  }

  // Generate palette
  let paletteStr = ''
  if (tc.palette) {
    paletteStr = tc.palette
  } else {
    const hex = '000000'.repeat(256)
    paletteStr = `   <palette count="256" format="RGB">\n`
    for (let i = 0; i < hex.length; i += 64) {
      paletteStr += `      ${hex.substring(i, i + 64)}\n`
    }
    paletteStr += `   </palette>`
  }

  // Build flame attrs
  const flameAttrs = []
  flameAttrs.push(`name="${tc.name}"`)
  flameAttrs.push(`version="${tc.version}"`)
  flameAttrs.push(`size="${tc.size}"`)
  flameAttrs.push(`center="${tc.center}"`)
  flameAttrs.push(`scale="${tc.scale}"`)
  flameAttrs.push(`angle="${tc.angle}"`)
  flameAttrs.push(`rotate="${tc.rotate}"`)
  flameAttrs.push(`oversample="${tc.oversample}"`)
  flameAttrs.push(`filter="${tc.filter}"`)
  flameAttrs.push(`quality="${tc.quality}"`)
  flameAttrs.push(`background="${tc.background}"`)
  flameAttrs.push(`brightness="${tc.brightness}"`)
  flameAttrs.push(`gamma="${tc.gamma}"`)
  flameAttrs.push(`gamma_threshold="${tc.gammaThreshold}"`)
  flameAttrs.push('estimator_radius="9"')
  flameAttrs.push('estimator_minimum="0"')
  flameAttrs.push('estimator_curve="0.4"')
  flameAttrs.push('enable_de="0"')
  flameAttrs.push(`plugins="${tc.plugins}"`)
  flameAttrs.push('new_linear="1"')
  flameAttrs.push(`vibrancy="${tc.vibrancy}"`)
  flameAttrs.push(`contrast="${tc.contrast}"`)
  flameAttrs.push(`white_level="${tc.whiteLevel}"`)
  flameAttrs.push(`curves="${tc.curves}"`)

  lines.push('<flames>')
  lines.push(`<flame ${flameAttrs.join(' ')}>`)
  lines.push(...xformStrs)
  if (finalStr) lines.push(finalStr)
  lines.push(paletteStr)
  lines.push('</flame>')
  lines.push('</flames>')

  return lines.join('\n')
}

// ─── Generate ash-like XML from source modules ───
function generateAshExport() {
  // This generates XML matching current ash code output
  return generateTestXML({
    name: 'Ash Export Test',
    version: 'Apophysis 7x',
    xforms: [
      {
        weight: 0.5, color: 0,
        coefs: '0.591765 -0.442393 0.442393 0.591765 -0.322088 -0.214793',
        variations: { linear: 1 },
        params: {},
      },
      {
        weight: 0.5, color: 1,
        coefs: '0.203333 -0.849293 0.849293 0.203333 0.846771 -0.382376',
        variations: { sinusoidal: 0.7, spherical: 0.3 },
        params: {},
      },
    ],
  })
}

// ─── Test cases ───
const TEST_CASES = [
  {
    label: 'minimal (linear only)',
    config: {
      name: 'minimal',
      xforms: [
        { weight: 0.5, color: 0, coefs: '1 0 0 1 0 0', variations: { linear: 1 } },
        { weight: 0.5, color: 1, coefs: '0.5 0 0 0.5 0 0', variations: { linear: 1 } },
      ],
    },
  },
  {
    label: 'builtin variations (sinusoidal, spherical, julia, swirl)',
    config: {
      name: 'builtin-test',
      xforms: [
        { weight: 0.5, color: 0, coefs: '1 0 0 1 0 0', variations: { sinusoidal: 0.6, swirl: 0.4 } },
        { weight: 0.5, color: 1, coefs: '0.5 0 0 0.5 0 0', variations: { spherical: 0.8, julia: 0.2 } },
      ],
    },
  },
  {
    label: 'plugin variations (handkerchief, crackle, cell, split)',
    config: {
      name: 'plugin-test',
      plugins: 'handkerchief crackle cell split',
      xforms: [
        {
          weight: 0.5, color: 0, coefs: '1 0 0 1 0 0',
          variations: { handkerchief: 0.5, crackle: 0.5 },
          params: { crackle_seed: 0, crackle_scale: 1, crackle_z: 0, crackle_spreadx: 1, crackle_spready: 1 },
        },
        {
          weight: 0.5, color: 1, coefs: '0.5 0 0 0.5 0 0',
          variations: { cell: 0.6, split: 0.4 },
          params: { cell_size: 0.5, split_xsize: 0.3, split_ysize: 0.3 },
        },
      ],
    },
  },
  {
    label: 'parameterized (julian + pdj + blob) — with correct param aliases',
    config: {
      name: 'parameterized-test',
      xforms: [
        {
          weight: 0.33, color: 0, coefs: '1 0 0 1 0 0',
          variations: { julian: 1 },
          params: { julian_power: 3, julian_dist: 1 },
        },
        {
          weight: 0.33, color: 0.5, coefs: '0.5 0 0 0.5 0 0',
          variations: { pdj: 1 },
          params: { pdj_a: 1, pdj_b: 1, pdj_c: 1, pdj_d: 1 },
        },
        {
          weight: 0.34, color: 1, coefs: '0.3 0 0 0.3 0 0',
          variations: { blob: 1 },
          params: { blob_low: 0.7, blob_high: 1, blob_waves: 5 },
        },
      ],
    },
  },
  {
    label: 'final xform',
    config: {
      name: 'final-xform-test',
      xforms: [
        { weight: 0.5, color: 0, coefs: '1 0 0 1 0 0', variations: { linear: 1 } },
        { weight: 0.5, color: 1, coefs: '0.5 0 0 0.5 0 0', variations: { spherical: 1 } },
      ],
      finalXform: { color: 0, coefs: '1 0 0 1 0 0', variations: { linear: 1 } },
    },
  },
  {
    label: 'unsupported variations (bent, popcorn, exponential)',
    config: {
      name: 'unsupported-test',
      xforms: [
        { weight: 0.5, color: 0, coefs: '1 0 0 1 0 0', variations: { bent: 0.5, popcorn: 0.5 } },
        { weight: 0.5, color: 1, coefs: '0.5 0 0 0.5 0 0', variations: { exponential: 1 } },
      ],
    },
  },
  {
    label: 'current ash export format (mimics flame-xml.ts output)',
    config: null,
    generator: generateAshExport,
  },
]

// ─── Reference file validation ───
function validateReference() {
  try {
    const refXml = readFileSync(REF_FLAME, 'utf-8')
    console.log(`\n${C.B}${'═'.repeat(60)}${C.RST}`)
    console.log(`${C.B}── Reference File Validation ──${C.RST}`)
    console.log(`${C.B}${'═'.repeat(60)}${C.RST}`)
    info(`Reference file: ${REF_FLAME}`)
    return validateFlameXML(refXml, 'renders7X.flame (original Apo7X output)')
  } catch (e) {
    warn(`Could not read reference file: ${e.message}`)
    return null
  }
}

// ─── Main ───
function main() {
  const args = process.argv.slice(2)
  const mode = args[0] || 'all'

  console.log(`${C.B}`)
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║  Apophysis 7X Flame Compatibility Validator            ║')
  console.log('║  Validates XML output against Apo7X parser rules       ║')
  console.log('╚══════════════════════════════════════════════════════════╝')
  console.log(`${C.RST}`)

  console.log(`Plugins directory: ${PLUGINS_DIR} (${PLUGIN_DLLS.size} DLLs found)`)
  console.log(`Reference file: ${REF_FLAME}`)
  console.log(`Mode: ${mode}`)
  console.log()

  // Plugin DLL listing
  const relevantPlugins = [...PLUGIN_DLLS].filter(n =>
    ALL_ASH_VARIATIONS.has(n) || VAR_REQUIRED_PARAMS[n]
  )
  if (relevantPlugins.length > 0) {
    info(`Relevant plugin DLLs: ${relevantPlugins.join(', ')}`)
  }

  let totalResults = { pass: 0, fail: 0, warn: 0, info: 0 }

  if (mode === 'all' || mode === '--baseline' || mode === '--reference') {
    const refResults = validateReference()
    if (refResults) {
      totalResults.pass += refResults.pass
      totalResults.fail += refResults.fail
      totalResults.warn += refResults.warn
      totalResults.info += refResults.info
    }
  }

  if (mode === 'all' || mode === '--tests') {
    for (const tc of TEST_CASES) {
      const xml = tc.generator ? tc.generator() : generateTestXML(tc.config)
      const results = validateFlameXML(xml, tc.label)
      totalResults.pass += results.pass
      totalResults.fail += results.fail
      totalResults.warn += results.warn
      totalResults.info += results.info
    }
  }

  if (mode && mode !== 'all' && mode !== '--baseline' && mode !== '--reference' && mode !== '--tests' && mode !== '--variations-only') {
    // Treat as file path
    try {
      const xml = readFileSync(mode, 'utf-8')
      const results = validateFlameXML(xml, mode)
      totalResults.pass += results.pass
      totalResults.fail += results.fail
      totalResults.warn += results.warn
      totalResults.info += results.info
    } catch (e) {
      fail(`Could not read file: ${e.message}`)
      process.exitCode = 1
      return
    }
  }

  if (mode === '--variations-only') {
    console.log(`\n${C.B}${'═'.repeat(60)}${C.RST}`)
    console.log(`${C.B}── Variation Compatibility Analysis ──${C.RST}`)
    console.log(`${C.B}${'═'.repeat(60)}${C.RST}\n`)

    const col = (s, w) => String(s).padEnd(w)
    console.log(col('Variation', 18) + col('Builtin', 8) + col('Classic', 8) + col('Plugin', 8) + col('Status', 15) + 'Notes')
    console.log('-'.repeat(80))

    for (const v of [...ALL_ASH_VARIATIONS].sort()) {
      const isBuiltin = APO7X_BUILTIN.has(v)
      const isClassic = APO7X_CLASSIC.has(v)
      const hasPlugin = PLUGIN_DLLS.has(v.toLowerCase())
      let status = 'UNSUPPORTED'
      let notes = ''

      if (isBuiltin) {
        status = 'BUILTIN'
      } else if (isClassic && hasPlugin) {
        status = 'CLASSIC+PLUGIN'
        notes = 'built-in alias may differ'
      } else if (isClassic) {
        status = 'CLASSIC'
        notes = 'likely compiled in'
      } else if (hasPlugin) {
        status = 'PLUGIN'
      }

      const color = status === 'UNSUPPORTED' ? C.FAIL : status === 'PLUGIN' ? C.WARN : C.PASS
      console.log(
        col(v, 18) +
        col(isBuiltin ? '✓' : '✗', 8) +
        col(isClassic ? '✓' : '✗', 8) +
        col(hasPlugin ? '✓' : '✗', 8) +
        color + col(status, 15) + C.RST +
        notes
      )
    }
  }

  // Summary
  console.log(`\n${C.B}${'═'.repeat(60)}${C.RST}`)
  console.log(`${C.B}── Summary ──${C.RST}`)
  console.log(`${C.B}${'═'.repeat(60)}${C.RST}`)
  console.log(`  ${C.PASS}PASS: ${totalResults.pass}${C.RST}`)
  console.log(`  ${C.FAIL}FAIL: ${totalResults.fail}${C.RST}`)
  console.log(`  ${C.WARN}WARN: ${totalResults.warn}${C.RST}`)
  console.log(`  ${C.INFO}INFO: ${totalResults.info}${C.RST}`)

  if (totalResults.fail > 0) {
    console.log(`\n${C.FAIL}${C.B}Result: FAIL — compatibility issues found, fix required${C.RST}`)
    process.exitCode = 1
  } else if (totalResults.warn > 0) {
    console.log(`\n${C.WARN}Result: WARN — no critical issues but some warnings${C.RST}`)
  } else {
    console.log(`\n${C.PASS}${C.B}Result: PASS — all compatibility checks passed${C.RST}`)
  }
}

main()
