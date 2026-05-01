import { XMLParser } from 'fast-xml-parser'
import type { Flame, XForm, Palette } from '../types/flame'

const XFORM_RESERVED_ATTRS = new Set([
  'weight', 'color', 'symmetry', 'coefs', 'post', 'var_type', 'opacity',
  'name', 'animate',
])

const VARIATION_NAMES_18 = [
  'linear', 'sinusoidal', 'spherical', 'swirl', 'horseshoe',
  'polar', 'handkerchief', 'heart', 'disc', 'spiral',
  'hyperbolic', 'diamond', 'ex', 'julia', 'bent',
  'waves', 'fisheye', 'popcorn',
]

export function parseFlameXML(xml: string): Flame[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    isArray: (name) => name === 'flame' || name === 'xform' || name === 'finalxform',
  })
  const doc = parser.parse(xml)
  const flames = doc?.Flames?.flame ?? doc?.flame
  if (!flames) return []
  return (Array.isArray(flames) ? flames : [flames]).map(parseSingleFlame)
}

function parseSingleFlame(f: Record<string, unknown>): Flame {
  const size = String(f.size ?? '800 600').split(/\s+/).map(Number)
  const center = String(f.center ?? '0 0').split(/\s+/).map(Number)
  const bg = String(f.background ?? '0 0 0').split(/\s+/).map(Number)

  const xformsRaw = f.xform
  const xforms: XForm[] = (Array.isArray(xformsRaw) ? xformsRaw : xformsRaw ? [xformsRaw] : [])
    .map(parseXForm)

  let finalXform: XForm | undefined
  const finalRaw = f.finalxform
  if (finalRaw) {
    const finalArr = Array.isArray(finalRaw) ? finalRaw : [finalRaw]
    if (finalArr.length > 0) {
      finalXform = parseXForm(finalArr[0])
    }
  }

  let palette: Palette = { count: 256, colors: [] }
  if (f.palette) {
    palette = parsePaletteHex(f.palette)
  }

  return {
    name: String(f.name ?? 'Untitled'),
    version: String(f.version ?? ''),
    width: size[0] ?? 800,
    height: size[1] ?? 600,
    center: [center[0] ?? 0, center[1] ?? 0],
    scale: Number(f.scale ?? 200),
    angle: Number(f.angle ?? 0),
    rotate: Number(f.rotate ?? 0),
    oversample: Number(f.oversample ?? 2),
    filterRadius: Number(f.filter ?? 0.5),
    quality: Number(f.quality ?? 50),
    background: [bg[0] ?? 0, bg[1] ?? 0, bg[2] ?? 0],
    brightness: Number(f.brightness ?? 4),
    gamma: Number(f.gamma ?? 2.2),
    gammaThreshold: Number(f.gamma_threshold ?? 0.05),
    vibrancy: Number(f.vibrancy ?? 1),
    contrast: Number(f.contrast ?? 1),
    whiteLevel: Number(f.white_level ?? 200),
    xforms,
    finalXform,
    palette,
    paletteOffset: 0,
  }
}

function parseXForm(x: Record<string, unknown>): XForm {
  const coefs = String(x.coefs ?? '1 0 0 1 0 0').split(/\s+/).map(Number) as [number, number, number, number, number, number]
  const postRaw = x.post ? String(x.post).split(/\s+/).map(Number) : undefined
  const post = postRaw && postRaw.length === 6 ? postRaw as [number, number, number, number, number, number] : undefined

  const variations = new Map<string, number>()
  const variationParams = new Map<string, number>()

  for (const [key, val] of Object.entries(x)) {
    if (XFORM_RESERVED_ATTRS.has(key)) continue
    const num = Number(val)
    if (isNaN(num)) continue

    if (VARIATION_NAMES_18.includes(key) || isExtendedVariation(key)) {
      if (num !== 0) variations.set(key, num)
    } else {
      const parts = key.split('_')
      if (parts.length >= 2) {
        const varName = parts[0]
        if (isKnownVariationPrefix(varName)) {
          variationParams.set(key, num)
        }
      }
    }
  }

  if (variations.size === 0) {
    variations.set('linear', 1.0)
  }

  return {
    weight: Number(x.weight ?? 1),
    color: Number(x.color ?? 0),
    symmetry: Number(x.symmetry ?? 0),
    coefs: coefs.length === 6 ? coefs : [1, 0, 0, 1, 0, 0],
    post,
    variations,
    variationParams,
  }
}

function isExtendedVariation(name: string): boolean {
  return ['julian', 'juliascope', 'bubble', 'pre_blur', 'noise', 'blur',
    'gaussian_blur', 'zblur', 'ztranslate', 'post_rotate_x', 'post_rotate_y',
    'crackle', 'cell', 'circles', 'ripple', 'split', 'stripes',
    'wedge', 'wedge_julia', 'wedge_sph', 'bwraps', 'bwraps7',
    'exponential', 'power', 'cosine', 'rings', 'fan',
    'blob', 'pdj', 'perspective', 'ngon',
    'curl', 'bipolar', 'elliptic',
    'motion_blur', 'radial_blur',
  ].includes(name)
}

function isKnownVariationPrefix(name: string): boolean {
  return isExtendedVariation(name) || VARIATION_NAMES_18.includes(name)
}

function parsePaletteHex(p: unknown): Palette {
  const hex = typeof p === 'string' ? p : ''
  const raw = hex.replace(/\s+/g, '')
  const colors: [number, number, number][] = []
  for (let i = 0; i + 5 < raw.length && colors.length < 256; i += 6) {
    const chunk = raw.substring(i, i + 6)
    if (chunk.length < 6) break
    const r = parseInt(chunk.substring(0, 2), 16)
    const g = parseInt(chunk.substring(2, 4), 16)
    const b = parseInt(chunk.substring(4, 6), 16)
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      colors.push([r, g, b])
    }
  }
  if (colors.length === 0) {
    for (let i = 0; i < 256; i++) colors.push([i, i, i])
  }
  return { count: colors.length, colors }
}

function formatCoefs(coefs: [number, number, number, number, number, number]): string {
  return coefs.map(n => String(+n.toFixed(6))).join(' ')
}

function serializeXForm(xf: XForm, indent: string): string {
  const attrs: string[] = []
  attrs.push(`weight="${xf.weight}"`)
  attrs.push(`color="${xf.color}"`)
  attrs.push(`symmetry="${xf.symmetry}"`)
  attrs.push(`coefs="${formatCoefs(xf.coefs)}"`)
  if (xf.post) attrs.push(`post="${formatCoefs(xf.post)}"`)

  for (const [name, w] of xf.variations) {
    if (w !== 0) attrs.push(`${name}="${w}"`)
  }
  for (const [name, val] of xf.variationParams) {
    attrs.push(`${name}="${val}"`)
  }

  return `${indent}<xform ${attrs.join(' ')}/>`
}

export function exportFlameXML(flame: Flame): string {
  const attrs: string[] = []
  attrs.push(`name="${flame.name}"`)
  attrs.push(`size="${flame.width} ${flame.height}"`)
  attrs.push(`center="${flame.center[0]} ${flame.center[1]}"`)
  attrs.push(`scale="${flame.scale}"`)
  attrs.push(`angle="${flame.angle}"`)
  attrs.push(`rotate="${flame.rotate}"`)
  attrs.push(`oversample="${flame.oversample}"`)
  attrs.push(`filter="${flame.filterRadius}"`)
  attrs.push(`quality="${flame.quality}"`)
  attrs.push(`brightness="${flame.brightness}"`)
  attrs.push(`gamma="${flame.gamma}"`)
  attrs.push(`gamma_threshold="${flame.gammaThreshold}"`)
  attrs.push(`vibrancy="${flame.vibrancy}"`)
  attrs.push(`contrast="${flame.contrast}"`)
  attrs.push(`white_level="${flame.whiteLevel}"`)
  attrs.push(`background="${flame.background[0]} ${flame.background[1]} ${flame.background[2]}"`)

  const lines: string[] = []
  lines.push('<flames>')
  lines.push(`<flame ${attrs.join(' ')}>`)

  for (const xf of flame.xforms) {
    lines.push(serializeXForm(xf, '  '))
  }

  if (flame.finalXform) {
    lines.push(serializeXForm(flame.finalXform, '  ').replace('<xform', '<finalxform').replace('/>', '/>'))
  }

  // Serialize palette as hex
  const hexColors = flame.palette.colors.map(([r, g, b]) =>
    r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0')
  ).join('')
  lines.push(`  <palette count="${flame.palette.count}" format="RGB">`)
  // Split into 64-char lines for readability
  for (let i = 0; i < hexColors.length; i += 64) {
    lines.push(`    ${hexColors.substring(i, i + 64)}`)
  }
  lines.push('  </palette>')

  lines.push('</flame>')
  lines.push('</flames>')

  return lines.join('\n')
}
