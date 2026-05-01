/**
 * Re-generates public/palettes/default.json from cmap.ugr with count: 256.
 * The existing default.json has count: 400 which is inconsistent with the
 * shader's 256-palette lookup.
 *
 * Usage: node scripts/convert-ugr-palettes.mjs [path-to-ugr]
 * Output: public/palettes/default.json
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const UGR_PATH = process.argv[2] || resolve(__dirname, '..', '..', 'cmap.ugr')
const OUT_PATH = resolve(__dirname, '..', 'public', 'palettes', 'default.json')

function parseUGR(text) {
  const palettes = []
  const regex = /(\S+)\s*\{([^}]*)\}/g
  let match

  while ((match = regex.exec(text)) !== null) {
    const name = match[1].trim()
    const body = match[2]
    const entries = new Map()

    const entryRegex = /index\s*=\s*(\d+)\s+color\s*=\s*(\d+)/g
    let em
    while ((em = entryRegex.exec(body)) !== null) {
      const idx = parseInt(em[1])
      const colorInt = parseInt(em[2])
      const r = colorInt & 0xFF
      const g = (colorInt >> 8) & 0xFF
      const b = (colorInt >> 16) & 0xFF
      entries.set(idx, [r, g, b])
    }

    if (entries.size < 2) continue

    const sorted = [...entries.entries()].sort((a, b) => a[0] - b[0])
    const colors = interpolatePalette(sorted, 256)
    palettes.push({ name, count: 256, colors })
  }

  return palettes
}

function interpolatePalette(anchors, count) {
  const colors = []
  const maxIdx = anchors[anchors.length - 1][0]

  for (let i = 0; i < count; i++) {
    const t = (i / (count - 1)) * maxIdx
    let lo = anchors[0]
    let hi = anchors[anchors.length - 1]

    for (let j = 0; j < anchors.length - 1; j++) {
      if (t >= anchors[j][0] && t <= anchors[j + 1][0]) {
        lo = anchors[j]
        hi = anchors[j + 1]
        break
      }
    }

    const span = hi[0] - lo[0]
    const frac = span > 0 ? (t - lo[0]) / span : 0
    colors.push([
      Math.round(lo[1][0] + frac * (hi[1][0] - lo[1][0])),
      Math.round(lo[1][1] + frac * (hi[1][1] - lo[1][1])),
      Math.round(lo[1][2] + frac * (hi[1][2] - lo[1][2])),
    ])
  }

  return colors
}

const text = readFileSync(UGR_PATH, 'utf-8')
const palettes = parseUGR(text)
console.log(`Parsed ${palettes.length} palettes from ${UGR_PATH}`)
writeFileSync(OUT_PATH, JSON.stringify(palettes), 'utf-8')
console.log(`Written to ${OUT_PATH}`)
