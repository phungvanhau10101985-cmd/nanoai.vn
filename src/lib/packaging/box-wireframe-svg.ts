import type { WebLocale } from '@/lib/i18n/config'
import type { BoxDimensionsMm } from '@/lib/packaging/dimensions'

type IsoPoint = { x: number; y: number }

type FaceStyle = {
  fill: string
  stroke: string
  label: string
}

const VIEW_W = 360
const VIEW_H = 220
const PAD = 14

const AXIS_LABEL: Record<WebLocale, { l: string; w: string; h: string }> = {
  vi: { l: 'Dài (L)', w: 'Rộng (W)', h: 'Cao (H)' },
  en: { l: 'Length (L)', w: 'Width (W)', h: 'Height (H)' },
  zh: { l: '长 (L)', w: '宽 (W)', h: '高 (H)' },
  ja: { l: '長さ (L)', w: '幅 (W)', h: '高さ (H)' },
  ko: { l: '길이 (L)', w: '너비 (W)', h: '높이 (H)' },
}

const FACE_LABEL: Record<WebLocale, { front: string; top: string; side: string }> = {
  vi: { front: 'Trước/sau\nL×H', top: 'Đáy/nắp\nL×W', side: 'Bên\nW×H' },
  en: { front: 'Front/back\nL×H', top: 'Bottom/top\nL×W', side: 'Side\nW×H' },
  zh: { front: '正/背面\nL×H', top: '底/顶面\nL×W', side: '侧面\nW×H' },
  ja: { front: '正面/背面\nL×H', top: '底/天面\nL×W', side: '側面\nW×H' },
  ko: { front: '앞/뒷면\nL×H', top: '바닥/뚜껑\nL×W', side: '측면\nW×H' },
}

function iso(x: number, y: number, z: number, s: number): IsoPoint {
  return {
    x: (x - y) * 0.866 * s,
    y: (x + y) * 0.5 * s - z * s,
  }
}

function pts(points: IsoPoint[]): string {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}

function formatCm(mm: number, locale: WebLocale): string {
  const cm = (mm / 10).toFixed(1)
  if (locale === 'vi') return cm.replace('.', ',')
  return cm
}

function bbox(points: IsoPoint[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { minX, minY, maxX, maxY }
}

function facePolygon(
  corners: IsoPoint[],
  style: FaceStyle,
  labelAnchor: IsoPoint
): string {
  const lines = style.label.split('\n')
  const tspans = lines
    .map((line, i) => `<tspan x="${labelAnchor.x.toFixed(1)}" dy="${i === 0 ? 0 : 12}">${line}</tspan>`)
    .join('')
  return `<polygon points="${pts(corners)}" fill="${style.fill}" fill-opacity="0.22" stroke="${style.stroke}" stroke-width="1.7"/>
<text x="${labelAnchor.x.toFixed(1)}" y="${(labelAnchor.y - 4).toFixed(1)}" text-anchor="middle" font-size="11.5" font-weight="600" fill="${style.stroke}">${tspans}</text>`
}

function dimLine(from: IsoPoint, to: IsoPoint, label: string, offsetX = 0, offsetY = 0): string {
  const mx = (from.x + to.x) / 2 + offsetX
  const my = (from.y + to.y) / 2 + offsetY
  return `<line x1="${from.x.toFixed(1)}" y1="${from.y.toFixed(1)}" x2="${to.x.toFixed(1)}" y2="${to.y.toFixed(1)}" stroke="#64748b" stroke-width="1.1" stroke-dasharray="3 2"/>
<text x="${mx.toFixed(1)}" y="${my.toFixed(1)}" text-anchor="middle" font-size="10.5" fill="#475569">${label}</text>`
}

/** Isometric wireframe sketch for box L×W×H — no AI, deterministic SVG. */
export function buildBoxWireframeSvg(dimensionsMm: BoxDimensionsMm, locale: WebLocale): string {
  const L = dimensionsMm.length
  const W = dimensionsMm.width
  const H = dimensionsMm.height

  const unitCorners = [
    iso(0, 0, 0, 1),
    iso(L, 0, 0, 1),
    iso(L, W, 0, 1),
    iso(0, W, 0, 1),
    iso(0, 0, H, 1),
    iso(L, 0, H, 1),
    iso(L, W, H, 1),
    iso(0, W, H, 1),
  ]
  const unitBox = bbox(unitCorners)
  const unitW = unitBox.maxX - unitBox.minX
  const unitH = unitBox.maxY - unitBox.minY
  const s = Math.min((VIEW_W - PAD * 2) / unitW, (VIEW_H - PAD * 2) / unitH) * 0.98

  const p = (x: number, y: number, z: number) => iso(x, y, z, s)

  const f00 = p(0, 0, 0)
  const f10 = p(L, 0, 0)
  const f11 = p(L, W, 0)
  const f01 = p(0, W, 0)
  const f03 = p(0, 0, H)
  const f13 = p(L, 0, H)
  const f23 = p(L, W, H)
  const f04 = p(0, W, H)

  const faces = FACE_LABEL[locale]
  const axis = AXIS_LABEL[locale]
  const lCm = formatCm(L, locale)
  const wCm = formatCm(W, locale)
  const hCm = formatCm(H, locale)

  const dimLOffset = { x: 0, y: 18 }
  const dimWOffset = { x: 14, y: 10 }
  const dimHOffset = { x: -28, y: -2 }

  const layoutPoints = [
    f00,
    f10,
    f11,
    f01,
    f03,
    f13,
    f23,
    f04,
    { x: (f00.x + f10.x) / 2 + dimLOffset.x, y: (f00.y + f10.y) / 2 + dimLOffset.y },
    { x: (f10.x + f11.x) / 2 + dimWOffset.x, y: (f10.y + f11.y) / 2 + dimWOffset.y },
    { x: (f00.x + f03.x) / 2 + dimHOffset.x, y: (f00.y + f03.y) / 2 + dimHOffset.y },
    { x: (f00.x + f13.x) / 2, y: (f00.y + f13.y) / 2 },
    { x: (f03.x + f23.x) / 2, y: (f03.y + f23.y) / 2 - 6 },
    { x: (f10.x + f23.x) / 2 + 12, y: (f10.y + f23.y) / 2 - 2 },
  ]
  const box = bbox(layoutPoints)
  const tx = VIEW_W / 2 - (box.minX + box.maxX) / 2
  const ty = VIEW_H / 2 - (box.minY + box.maxY) / 2 - 6

  const shift = (pt: IsoPoint): IsoPoint => ({ x: pt.x + tx, y: pt.y + ty })
  const sf00 = shift(f00)
  const sf10 = shift(f10)
  const sf11 = shift(f11)
  const sf01 = shift(f01)
  const sf03 = shift(f03)
  const sf13 = shift(f13)
  const sf23 = shift(f23)
  const sf04 = shift(f04)

  const front = facePolygon(
    [sf00, sf10, sf13, sf03],
    { fill: '#8b5cf6', stroke: '#7c3aed', label: faces.front },
    shift({ x: (f00.x + f13.x) / 2, y: (f00.y + f13.y) / 2 })
  )
  const top = facePolygon(
    [sf03, sf13, sf23, sf04],
    { fill: '#34d399', stroke: '#059669', label: faces.top },
    shift({ x: (f03.x + f23.x) / 2, y: (f03.y + f23.y) / 2 - 6 })
  )
  const side = facePolygon(
    [sf10, sf11, sf23, sf13],
    { fill: '#60a5fa', stroke: '#2563eb', label: faces.side },
    shift({ x: (f10.x + f23.x) / 2 + 12, y: (f10.y + f23.y) / 2 - 2 })
  )

  const edges = `<polyline points="${pts([shift(f01), shift(f11), shift(f23), shift(f04), shift(f01)])}" fill="none" stroke="#94a3b8" stroke-width="1.1" stroke-dasharray="4 3"/>`

  const dimL = dimLine(
    sf00,
    sf10,
    `${axis.l}: ${lCm} cm`,
    dimLOffset.x,
    dimLOffset.y
  )
  const dimW = dimLine(
    sf10,
    sf11,
    `${axis.w}: ${wCm} cm`,
    dimWOffset.x,
    dimWOffset.y
  )
  const dimH = dimLine(
    sf00,
    sf03,
    `${axis.h}: ${hCm} cm`,
    dimHOffset.x,
    dimHOffset.y
  )

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-hidden="true" style="display:block;width:100%;height:auto;min-height:160px">
${side}
${top}
${front}
${edges}
${dimL}
${dimW}
${dimH}
</svg>`
}
