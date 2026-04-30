export interface GuideDrawFn {
  (ctx: CanvasRenderingContext2D, w: number, h: number, color: string, opacity: number): void
}

export const GUIDE_IDS = [
  'center',
  'thirds',
  'phi-grid',
  'golden-spiral',
  'golden-triangle',
  'diagonals',
  'harmonious-armature',
] as const

export type GuideId = (typeof GUIDE_IDS)[number]

const PHI = (1 + Math.sqrt(5)) / 2

function setStyle(ctx: CanvasRenderingContext2D, color: string, opacity: number) {
  ctx.strokeStyle = color
  ctx.globalAlpha = opacity
  ctx.lineWidth = 1
}

function drawLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

export const drawCenter: GuideDrawFn = (ctx, w, h, color, opacity) => {
  setStyle(ctx, color, opacity)
  drawLine(ctx, w / 2, 0, w / 2, h)
  drawLine(ctx, 0, h / 2, w, h / 2)
}

export const drawThirds: GuideDrawFn = (ctx, w, h, color, opacity) => {
  setStyle(ctx, color, opacity)
  drawLine(ctx, w / 3, 0, w / 3, h)
  drawLine(ctx, (2 * w) / 3, 0, (2 * w) / 3, h)
  drawLine(ctx, 0, h / 3, w, h / 3)
  drawLine(ctx, 0, (2 * h) / 3, w, (2 * h) / 3)
}

export const drawPhiGrid: GuideDrawFn = (ctx, w, h, color, opacity) => {
  setStyle(ctx, color, opacity)
  const px = w / PHI
  const py = h / PHI
  drawLine(ctx, px, 0, px, h)
  drawLine(ctx, w - px, 0, w - px, h)
  drawLine(ctx, 0, py, w, py)
  drawLine(ctx, 0, h - py, w, h - py)
}

export const drawGoldenSpiral: GuideDrawFn = (ctx, w, h, color, opacity) => {
  setStyle(ctx, color, opacity)
  ctx.lineWidth = 1.5

  const arcs: { cx: number; cy: number; r: number; start: number; end: number }[] = []

  let x = 0, y = 0, bw = w, bh = h
  let flipH = false, flipV = false

  for (let i = 0; i < 10; i++) {
    if (bw < 1 || bh < 1) break

    const shortSide = Math.min(bw, bh)
    const radius = shortSide

    let cx: number, cy: number, startAngle: number, endAngle: number

    if (bw >= bh) {
      if (!flipH) {
        cx = x + shortSide
        cy = y + shortSide
        startAngle = Math.PI
        endAngle = Math.PI * 1.5
        x += shortSide
        bw -= shortSide
      } else {
        cx = x + bw - shortSide
        cy = y + shortSide
        startAngle = Math.PI * 1.5
        endAngle = Math.PI * 2
        bw -= shortSide
      }
      flipH = !flipH
    } else {
      if (!flipV) {
        cx = x + shortSide
        cy = y + shortSide
        startAngle = Math.PI * 0.5
        endAngle = Math.PI
        y += shortSide
        bh -= shortSide
      } else {
        cx = x
        cy = y + bh - shortSide
        startAngle = 0
        endAngle = Math.PI * 0.5
        bh -= shortSide
      }
      flipV = !flipV
    }

    arcs.push({ cx, cy, r: radius, start: startAngle, end: endAngle })
  }

  for (const arc of arcs) {
    ctx.beginPath()
    ctx.arc(arc.cx, arc.cy, arc.r, arc.start, arc.end)
    ctx.stroke()
  }
}

export const drawGoldenTriangle: GuideDrawFn = (ctx, w, h, color, opacity) => {
  setStyle(ctx, color, opacity)

  drawLine(ctx, 0, 0, w, h)
  drawLine(ctx, w, 0, 0, h)

  const midX = w / 2
  const midY = h / 2

  const perpLen = Math.min(w, h) * 0.5
  const diagLen = Math.sqrt(w * w + h * h)
  const nx = h / diagLen
  const ny = w / diagLen

  ctx.globalAlpha = opacity * 0.6

  drawLine(ctx, midX - perpLen * nx, midY + perpLen * ny, midX + perpLen * nx, midY - perpLen * ny)

  const corner1x = w * 0.25
  const corner1y = 0
  const proj1 = corner1x * w / diagLen + corner1y * h / diagLen
  const foot1x = proj1 * w / diagLen
  const foot1y = proj1 * h / diagLen
  drawLine(ctx, corner1x, corner1y, foot1x, foot1y)

  const corner2x = w * 0.75
  const corner2y = 0
  const proj2 = corner2x * w / diagLen + corner2y * h / diagLen
  const foot2x = proj2 * w / diagLen
  const foot2y = proj2 * h / diagLen
  drawLine(ctx, corner2x, corner2y, foot2x, foot2y)
}

export const drawDiagonals: GuideDrawFn = (ctx, w, h, color, opacity) => {
  setStyle(ctx, color, opacity)

  drawLine(ctx, 0, 0, w, h)
  drawLine(ctx, w, 0, 0, h)
  drawLine(ctx, 0, 0, w / 2, h)
  drawLine(ctx, w, 0, w / 2, h)
  drawLine(ctx, 0, h / 2, w, 0)
  drawLine(ctx, 0, h / 2, w, h)
  drawLine(ctx, 0, h, w / 2, 0)
  drawLine(ctx, w, h, w / 2, 0)
  drawLine(ctx, w / 2, h, w, 0)
  drawLine(ctx, w / 2, h, 0, 0)
}

export const drawHarmoniousArmature: GuideDrawFn = (ctx, w, h, color, opacity) => {
  setStyle(ctx, color, opacity)

  drawLine(ctx, 0, 0, w, h)
  drawLine(ctx, w, 0, 0, h)

  drawLine(ctx, 0, 0, w, h / 2)
  drawLine(ctx, 0, h / 2, w, 0)

  drawLine(ctx, 0, 0, w / 2, h)
  drawLine(ctx, w / 2, h, 0, 0)

  drawLine(ctx, w, h, 0, h / 2)
  drawLine(ctx, 0, h / 2, w, h)

  drawLine(ctx, w, h, w / 2, 0)
  drawLine(ctx, w / 2, 0, w, h)

  const rx = w / PHI
  const ry = h / PHI
  ctx.globalAlpha = opacity * 0.5
  drawLine(ctx, 0, ry, w, ry)
  drawLine(ctx, 0, h - ry, w, h - ry)
  drawLine(ctx, rx, 0, rx, h)
  drawLine(ctx, w - rx, 0, w - rx, h)
}

export const GUIDE_DRAW_FNS: Record<GuideId, GuideDrawFn> = {
  'center': drawCenter,
  'thirds': drawThirds,
  'phi-grid': drawPhiGrid,
  'golden-spiral': drawGoldenSpiral,
  'golden-triangle': drawGoldenTriangle,
  'diagonals': drawDiagonals,
  'harmonious-armature': drawHarmoniousArmature,
}
