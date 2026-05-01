/**
 * Downloads flam3-palettes.xml from GitHub and converts to JSON format
 * compatible with ash's palette system (256 colors per palette, RRGGBB).
 *
 * Usage: node scripts/convert-flam3-palettes.mjs
 * Output: public/palettes/flam3.json
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { XMLParser } from 'fast-xml-parser'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = resolve(__dirname, '..', 'public', 'palettes', 'flam3.json')

const XML_URL = 'https://raw.githubusercontent.com/scottdraves/flam3/master/flam3-palettes.xml'

async function fetchXML() {
  console.log(`Downloading ${XML_URL} ...`)
  const resp = await fetch(XML_URL)
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`)
  return await resp.text()
}

function parseFlam3XML(xml) {
  const parser = new XMLParser({ ignoreAttributes: false })
  const doc = parser.parse(xml)
  const raw = doc.palettes?.palette
  if (!raw) throw new Error('No <palette> elements found in XML')
  const entries = Array.isArray(raw) ? raw : [raw]
  const palettes = []

  for (const entry of entries) {
    const name = entry['@_name']
    const data = entry['@_data']
    if (!name || !data) continue

    const hex = data.replace(/[\s\r\n]/g, '').trim()
    if (hex.length !== 2048) {
      console.warn(`  Skipping "${name}": expected 2048 hex chars, got ${hex.length}`)
      continue
    }

    const colors = []
    for (let i = 0; i < 256; i++) {
      const chunk = hex.substring(i * 8, i * 8 + 8)
      const r = parseInt(chunk.substring(2, 4), 16)
      const g = parseInt(chunk.substring(4, 6), 16)
      const b = parseInt(chunk.substring(6, 8), 16)
      colors.push([r, g, b])
    }

    palettes.push({ name, count: 256, colors })
  }

  return palettes
}

async function main() {
  const xml = await fetchXML()
  const palettes = parseFlam3XML(xml)
  console.log(`Parsed ${palettes.length} palettes`)
  writeFileSync(OUT_PATH, JSON.stringify(palettes), 'utf-8')
  console.log(`Written to ${OUT_PATH}`)
}

main().catch(err => { console.error(err); process.exit(1) })
