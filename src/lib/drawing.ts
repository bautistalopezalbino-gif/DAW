export interface Stroke {
  points: number[] // x0, y0, x1, y1… en unidades del lienzo (ancho lógico 800)
  color: string // 'ink' = color del texto (se adapta a modo claro/oscuro)
  width: number
  opacity?: number
}

export const CANVAS_WIDTH = 800

// Trazo suavizado con curvas cuadráticas entre puntos medios
export function strokePath(points: number[]): string {
  if (points.length < 2) return ''
  const n = points.length / 2
  const x = (i: number) => points[i * 2]
  const y = (i: number) => points[i * 2 + 1]
  if (n === 1) return `M${x(0)} ${y(0)} l0.01 0`
  let d = `M${x(0)} ${y(0)}`
  for (let i = 1; i < n - 1; i++) {
    const mx = ((x(i) + x(i + 1)) / 2).toFixed(1)
    const my = ((y(i) + y(i + 1)) / 2).toFixed(1)
    d += ` Q${x(i)} ${y(i)} ${mx} ${my}`
  }
  d += ` L${x(n - 1)} ${y(n - 1)}`
  return d
}

export function strokeColor(color: string): string {
  return color === 'ink' ? 'currentColor' : color
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  const len = dx * dx + dy * dy
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

export function hitsStroke(s: Stroke, px: number, py: number, radius: number): boolean {
  const p = s.points
  if (p.length === 2) return Math.hypot(px - p[0], py - p[1]) <= radius + s.width / 2
  for (let i = 0; i < p.length - 2; i += 2) {
    if (distToSegment(px, py, p[i], p[i + 1], p[i + 2], p[i + 3]) <= radius + s.width / 2) return true
  }
  return false
}

/** SVG autónomo (para Markdown/HTML exportado). */
export function drawingSvg(strokes: Stroke[], height: number): string {
  const paths = strokes
    .map(
      (s) =>
        `<path d="${strokePath(s.points)}" stroke="${s.color === 'ink' ? '#111' : s.color}" stroke-width="${s.width}" ` +
        `stroke-opacity="${s.opacity ?? 1}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_WIDTH} ${height}" width="100%">${paths}</svg>`
}
