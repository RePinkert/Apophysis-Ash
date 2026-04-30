export function bgrIntToRGB(value: number): [number, number, number] {
  const r = value & 0xFF
  const g = (value >> 8) & 0xFF
  const b = (value >> 16) & 0xFF
  return [r, g, b]
}

export function rgbToBGRInt(r: number, g: number, b: number): number {
  return r | (g << 8) | (b << 16)
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
