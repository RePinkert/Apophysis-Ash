import type { Palette } from '../types/flame'

export function parseUGR(text: string): Palette[] {
  const palettes: Palette[] = []
  const regex = /(\S+)\s*\{([^}]*)\}/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    const name = match[1].trim()
    const body = match[2]
    const entries = new Map<number, [number, number, number]>()

    const entryRegex = /index\s*=\s*(\d+)\s+color\s*=\s*(\d+)/g
    let em: RegExpExecArray | null
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
    const colors: [number, number, number][] = interpolatePalette(sorted, 256)
    palettes.push({ name, count: 256, colors })
  }

  return palettes
}

function interpolatePalette(
  anchors: [number, [number, number, number]][],
  count: number,
): [number, number, number][] {
  const colors: [number, number, number][] = []
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
