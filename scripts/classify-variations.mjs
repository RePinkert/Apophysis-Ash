import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const EXE_PATH = join(ROOT, '..', 'Apophysis7X64.exe')
const PLUGINS_DIR = join(ROOT, '..', 'Plugins')

const VARIATION_NAMES = [
  'linear', 'sinusoidal', 'spherical', 'swirl', 'horseshoe',
  'polar', 'handkerchief', 'heart', 'disc', 'spiral',
  'hyperbolic', 'diamond', 'ex', 'julia', 'bent',
  'waves', 'fisheye', 'popcorn',
  'julian', 'bubble', 'pre_blur', 'noise', 'blur',
  'exponential', 'power', 'cosine', 'rings', 'fan',
  'blob', 'pdj', 'perspective', 'ngon',
  'curl', 'bipolar', 'elliptic', 'cell', 'crackle',
  'juliascope', 'split', 'wedge', 'wedge_julia',
  'wedge_sph', 'bwraps', 'bwraps7', 'motion_blur',
  'zblur', 'gaussian_blur', 'radial_blur',
  'post_rotate_x', 'post_rotate_y',
]

const VARIATION_PARAMS = {
  julian: ['julian_power', 'julian_dist'],
  rings: ['rings_coeff', 'rings_val'],
  fan: ['fan_dist', 'fan_dx'],
  blob: ['blob_low', 'blob_high', 'blob_waves'],
  pdj: ['pdj_a', 'pdj_b', 'pdj_c', 'pdj_d', 'pdj1', 'pdj2', 'pdj3', 'pdj4'],
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
  bwraps: ['bwraps_cellsize', 'bwraps_space', 'bwraps_gain', 'bwraps_innerTwist', 'bwraps_outerTwist'],
  bwraps7: ['bwraps7_cellsize', 'bwraps7_space', 'bwraps7_gain', 'bwraps7_innerTwist', 'bwraps7_outerTwist'],
  motion_blur: ['motion_blur_angle', 'motion_blur_length'],
  radial_blur: ['radial_blur_angle'],
}

function searchBytes(buffer, pattern) {
  let count = 0
  for (let i = 0; i <= buffer.length - pattern.length; i++) {
    let match = true
    for (let j = 0; j < pattern.length; j++) {
      if (buffer[i + j] !== pattern[j]) { match = false; break }
    }
    if (match) count++
  }
  return count
}

function toAnsi(str) {
  return Buffer.from(str, 'ascii')
}

function toUtf16LE(str) {
  const buf = Buffer.alloc(str.length * 2)
  for (let i = 0; i < str.length; i++) {
    buf.writeUInt16LE(str.charCodeAt(i), i * 2)
  }
  return buf
}

console.log('Reading EXE:', EXE_PATH)
const exe = readFileSync(EXE_PATH)
console.log(`EXE size: ${(exe.length / 1024 / 1024).toFixed(1)} MB\n`)

const pluginFiles = readdirSync(PLUGINS_DIR)
const pluginNames = new Set()
for (const f of pluginFiles) {
  const name = f.replace(/\.(x64|x86)\.dll$/i, '')
  pluginNames.add(name.toLowerCase())
}

// === Step 1: Variation classification ===
console.log('=== VARIATION CLASSIFICATION ===\n')

const results = []
const col = (s, w) => String(s).padEnd(w)

console.log(col('Variation', 20) + col('ANSI', 7) + col('UTF16', 7) + col('Plugin', 8) + 'Classification')
console.log('-'.repeat(70))

for (const name of VARIATION_NAMES) {
  const ansiHits = searchBytes(exe, toAnsi(name))
  const utf16Hits = searchBytes(exe, toUtf16LE(name))
  const hasPlugin = pluginNames.has(name.toLowerCase())

  let classification = '?'
  if (utf16Hits >= 1) {
    classification = 'BUILTIN'
  } else if (ansiHits >= 3) {
    classification = 'BUILTIN*'
  } else if (hasPlugin) {
    classification = 'PLUGIN'
  } else if (ansiHits === 0) {
    classification = 'UNSUPPORTED'
  } else {
    classification = 'UNKNOWN(ansi:' + ansiHits + ')'
  }

  results.push({ name, ansiHits, utf16Hits, hasPlugin, classification })
  console.log(
    col(name, 20) +
    col(ansiHits, 7) +
    col(utf16Hits, 7) +
    col(hasPlugin ? 'Yes' : 'No', 8) +
    classification
  )
}

console.log('\n--- Summary ---')
const builtin = results.filter(r => r.classification.startsWith('BUILTIN'))
const plugin = results.filter(r => r.classification === 'PLUGIN')
const unsupported = results.filter(r => r.classification === 'UNSUPPORTED')
const unknown = results.filter(r => r.classification.startsWith('UNKNOWN'))

console.log(`BUILTIN:     ${builtin.map(r => r.name).join(', ')}`)
console.log(`PLUGIN:      ${plugin.map(r => r.name).join(', ')}`)
console.log(`UNSUPPORTED: ${unsupported.map(r => r.name).join(', ')}`)
if (unknown.length) console.log(`UNKNOWN:     ${unknown.map(r => `${r.name}(${r.classification})`).join(', ')}`)

// === Step 2: Parameter name search ===
console.log('\n\n=== PARAMETER NAME SEARCH ===')

for (const [varName, params] of Object.entries(VARIATION_PARAMS)) {
  console.log(`\n${varName}:`)
  for (const param of params) {
    const ansiHits = searchBytes(exe, toAnsi(param))
    const utf16Hits = searchBytes(exe, toUtf16LE(param))
    const found = utf16Hits > 0 || ansiHits >= 2
    const marker = found ? '  FOUND' : '  NOT FOUND'
    console.log(`  ${col(param, 30)} ANSI:${col(ansiHits, 4)} UTF16:${col(utf16Hits, 4)}${marker}`)
  }
}

// === Step 3: TypeScript output ===
console.log('\n\n=== TYPESCRIPT OUTPUT ===\n')

console.log('export const PLUGIN_VARIATION_NAMES = new Set([')
for (const r of plugin) console.log(`  '${r.name}',`)
console.log('])')
console.log('')
console.log('export const UNSUPPORTED_VARIATIONS = new Set([')
for (const r of unsupported) console.log(`  '${r.name}',`)
console.log('])')
