/**
 * Tạo SVG net hộp carton (mặt phẳng triển khai).
 * Hỗ trợ: Tuck-top (hộp nắp gập), Sleeve (hộp ốp).
 */

import {
  getBoxFaceSlotLabel,
  getSizeKeyForSlot,
  type BoxFaceSlot,
} from '@/lib/packaging/box-face-slots'
import type { WebLocale } from '@/lib/i18n/config'
import {
  normalizeTuckBoxProductionParams,
  type TuckBoxProductionParams,
} from '@/lib/packaging/tuck-box-production'
import {
  DEFAULT_BOX_DIELINE_STRUCTURE,
  type BoxDielineStructure,
} from '@/lib/packaging/dieline-structure'

export type BoxType = 'tuck-top' | 'sleeve'

export interface BoxDimensions {
  lengthMm: number  // L - chiều dài
  widthMm: number   // W - chiều rộng
  heightMm: number  // H - chiều cao
}

export interface NetBounds {
  widthMm: number
  heightMm: number
}

const TOL = 0.05 // 0.05mm - tránh lỗi làm tròn khi so sánh cạnh chung

type DimSide = 'top' | 'bottom' | 'left' | 'right'

interface DimBuildResult {
  lines: string[]
  labels: string[]
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Vẽ đường kích thước + nhãn bên ngoài từng ô (extension line + dimension line + text). */
function buildPanelDimension(
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  side: DimSide,
  gap: number,
  tickLen: number,
  fs: number,
  stroke: number
): DimBuildResult {
  const dimStroke = stroke * 0.6
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#64748b" stroke-width="${dimStroke}"/>`

  const lines: string[] = []
  let tx = x + w / 2
  let ty = y + h / 2
  let anchor = 'middle'
  let baseline = 'middle'
  let minX = x
  let minY = y
  let maxX = x + w
  let maxY = y + h

  if (side === 'bottom') {
    const dimY = y + h + gap
    lines.push(line(x, y + h, x, dimY))
    lines.push(line(x + w, y + h, x + w, dimY))
    lines.push(line(x, dimY, x + w, dimY))
    ty = dimY + fs * 0.35
    baseline = 'hanging'
    maxY = Math.max(maxY, ty + fs)
  } else if (side === 'top') {
    const dimY = y - gap
    lines.push(line(x, y, x, dimY))
    lines.push(line(x + w, y, x + w, dimY))
    lines.push(line(x, dimY, x + w, dimY))
    ty = dimY - fs * 0.15
    baseline = 'auto'
    minY = Math.min(minY, dimY - fs)
  } else if (side === 'left') {
    const dimX = x - gap
    lines.push(line(x, y, dimX, y))
    lines.push(line(x, y + h, dimX, y + h))
    lines.push(line(dimX, y, dimX, y + h))
    tx = dimX - fs * 0.25
    ty = y + h / 2
    anchor = 'end'
    minX = Math.min(minX, tx - fs * text.length * 0.45)
  } else {
    const dimX = x + w + gap
    lines.push(line(x + w, y, dimX, y))
    lines.push(line(x + w, y + h, dimX, y + h))
    lines.push(line(dimX, y, dimX, y + h))
    tx = dimX + fs * 0.25
    ty = y + h / 2
    anchor = 'start'
    maxX = Math.max(maxX, tx + fs * text.length * 0.45)
  }

  const labels = [
    `<text x="${tx}" y="${ty}" text-anchor="${anchor}" dominant-baseline="${baseline}" font-size="${fs}" fill="#333" font-family="sans-serif">${text}</text>`,
  ]

  return { lines, labels, minX, minY, maxX, maxY }
}

function mergeDimBounds(acc: DimBuildResult, next: DimBuildResult): DimBuildResult {
  return {
    lines: [...acc.lines, ...next.lines],
    labels: [...acc.labels, ...next.labels],
    minX: Math.min(acc.minX, next.minX),
    minY: Math.min(acc.minY, next.minY),
    maxX: Math.max(acc.maxX, next.maxX),
    maxY: Math.max(acc.maxY, next.maxY),
  }
}

function formatDimMm(a: number, b: number): string {
  return `${Math.round(a)}×${Math.round(b)} mm`
}

/**
 * Phân loại cạnh: cạnh chung (≥2 panel chồng lấp) = gấp, cạnh chu vi = cắt.
 * Xử lý cả cạnh chồng một phần (vd: Left W×H và Bottom L×W).
 */
function classifyEdges(
  panels: { x: number; y: number; w: number; h: number }[]
): { cutSegments: [number, number, number, number][]; foldSegments: [number, number, number, number][] } {
  const cutSegments: [number, number, number, number][] = []
  const foldSegments: [number, number, number, number][] = []

  const addEdge = (
    seg: [number, number, number, number],
    others: [number, number, number, number][]
  ) => {
    const [x1, y1, x2, y2] = seg
    const isVert = Math.abs(x2 - x1) <= TOL
    const isHorz = Math.abs(y2 - y1) <= TOL
    if (!isVert && !isHorz) return

    if (isVert) {
      const x = (x1 + x2) / 2
      const yA = Math.min(y1, y2)
      const yB = Math.max(y1, y2)
      const splits = new Set<number>([yA, yB])
      for (const o of others) {
        const [ox1, oy1, ox2, oy2] = o
        if (Math.abs(ox1 - ox2) <= TOL && Math.abs((ox1 + ox2) / 2 - x) <= TOL) {
          splits.add(Math.min(oy1, oy2))
          splits.add(Math.max(oy1, oy2))
        }
      }
      const pts = Array.from(splits).sort((a, b) => a - b)
      for (let i = 0; i < pts.length - 1; i++) {
        const ya = pts[i]
        const yb = pts[i + 1]
        if (yb - ya <= TOL) continue
        const mid = (ya + yb) / 2
        let overlapCount = 0
        for (const o of others) {
          const [ox1, oy1, ox2, oy2] = o
          if (Math.abs(ox1 - ox2) <= TOL && Math.abs((ox1 + ox2) / 2 - x) <= TOL) {
            const oyA = Math.min(oy1, oy2)
            const oyB = Math.max(oy1, oy2)
            if (mid >= oyA - TOL && mid <= oyB + TOL) overlapCount++
          }
        }
        const s: [number, number, number, number] = [x, ya, x, yb]
        if (overlapCount >= 1) foldSegments.push(s)
        else cutSegments.push(s)
      }
    } else {
      const y = (y1 + y2) / 2
      const xA = Math.min(x1, x2)
      const xB = Math.max(x1, x2)
      const splits = new Set<number>([xA, xB])
      for (const o of others) {
        const [ox1, oy1, ox2, oy2] = o
        if (Math.abs(oy1 - oy2) <= TOL && Math.abs((oy1 + oy2) / 2 - y) <= TOL) {
          splits.add(Math.min(ox1, ox2))
          splits.add(Math.max(ox1, ox2))
        }
      }
      const pts = Array.from(splits).sort((a, b) => a - b)
      for (let i = 0; i < pts.length - 1; i++) {
        const xa = pts[i]
        const xb = pts[i + 1]
        if (xb - xa <= TOL) continue
        const mid = (xa + xb) / 2
        let overlapCount = 0
        for (const o of others) {
          const [ox1, oy1, ox2, oy2] = o
          if (Math.abs(oy1 - oy2) <= TOL && Math.abs((oy1 + oy2) / 2 - y) <= TOL) {
            const oxA = Math.min(ox1, ox2)
            const oxB = Math.max(ox1, ox2)
            if (mid >= oxA - TOL && mid <= oxB + TOL) overlapCount++
          }
        }
        const s: [number, number, number, number] = [xa, y, xb, y]
        if (overlapCount >= 1) foldSegments.push(s)
        else cutSegments.push(s)
      }
    }
  }

  const allEdges: [number, number, number, number][] = []
  for (const p of panels) {
    allEdges.push([p.x, p.y, p.x + p.w, p.y])
    allEdges.push([p.x, p.y + p.h, p.x + p.w, p.y + p.h])
    allEdges.push([p.x, p.y, p.x, p.y + p.h])
    allEdges.push([p.x + p.w, p.y, p.x + p.w, p.y + p.h])
  }

  for (let i = 0; i < allEdges.length; i++) {
    const others = allEdges.filter((_, j) => j !== i)
    addEdge(allEdges[i], others)
  }

  // Deduplicate: chuẩn hóa thứ tự (x1,y1) (x2,y2) rồi so sánh
  const dedupe = (arr: [number, number, number, number][]) => {
    const seen = new Set<string>()
    return arr.filter((s) => {
      const [x1, y1, x2, y2] = s
      const ax = Math.min(x1, x2)
      const ay = Math.min(y1, y2)
      const bx = Math.max(x1, x2)
      const by = Math.max(y1, y2)
      const k = [ax, ay, bx, by].map((n) => n.toFixed(3)).join(',')
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }
  const foldDeduped = dedupe(foldSegments)
  const cutDeduped = dedupe(cutSegments)

  return { cutSegments: cutDeduped, foldSegments: foldDeduped }
}

/**
 * Tính kích thước tổng thể của net (mm).
 * Layout tuck-top Simple: Back, Left+Bottom+Right, Front, Top lid, flaps
 */
export function getTuckTopNetBounds(d: BoxDimensions): NetBounds {
  const { lengthMm: L, widthMm: W, heightMm: H } = d
  const flap = Math.min(L, W) * 0.35
  const pad = 2
  const gap = 0
  const netWidth = pad + L + gap + W + L + W + pad
  const netHeight = pad + H + gap + H + gap + W + flap + pad
  return { widthMm: netWidth, heightMm: netHeight }
}

export function getSleeveNetBounds(d: BoxDimensions): NetBounds {
  const { lengthMm: L, widthMm: W, heightMm: H } = d
  // Sleeve: 5 mặt (không nắp), layout đơn giản
  const netWidth = 2 * W + 2 * L
  const netHeight = H + L
  return { widthMm: netWidth, heightMm: netHeight }
}

/**
 * Tạo SVG path cho net tuck-top.
 * Scale: 1mm = 1 unit. ViewBox sẽ fit to content.
 */
export function generateTuckTopNetSvg(d: BoxDimensions): string {
  const { lengthMm: L, widthMm: W, heightMm: H } = d
  const flap = Math.min(L, W) * 0.4
  const stroke = 0.3
  const foldStroke = 0.2

  let x = 0
  let y = 0
  const paths: string[] = []
  const foldPaths: string[] = []

  const drawRect = (w: number, h: number, isFold = false) => {
    const p = `M ${x} ${y} h ${w} v ${h} h ${-w} Z`
    if (isFold) foldPaths.push(p)
    else paths.push(p)
  }

  // Row 1: Back (L x H)
  drawRect(L, H)
  x += L

  // Row 1: Left side (W x H)
  drawRect(W, H)
  x += W

  // Row 1: Bottom (L x W)
  drawRect(L, W)
  x += L

  // Row 1: Right side (W x H)
  drawRect(W, H)
  x += W

  // Row 2: Front (L x H) - below Back
  x = 0
  y = H
  drawRect(L, H)
  x += L

  // Row 2: (empty under Left) - Left đã vẽ, giờ vẽ Front nối với Bottom
  // Front nằm dưới Back, căn trái
  // Đơn giản hóa: Front (L x H) nằm dưới Back
  // Row 3: Top lid + flaps
  x = 0
  y = H + H // Dưới Back và Front
  drawRect(L, W, true) // Top lid - fold line
  x += L

  // Top flaps (4 góc)
  const tw = L
  const th = W
  // Flap trên (phía Back)
  drawRect(tw, flap, true)
  y -= flap
  drawRect(tw, flap, true)
  y += flap
  // Flap dưới (phía Front)
  y = H + H + W
  drawRect(tw, flap, true)
  y += flap
  drawRect(tw, flap, true)
  y -= flap
  // Flap trái, phải
  x = -flap
  y = H + H
  drawRect(flap, th, true)
  x += L + flap
  drawRect(flap, th, true)

  const bounds = getTuckTopNetBounds(d)
  const vbW = bounds.widthMm + 4
  const vbH = bounds.heightMm + 4

  const cutColor = '#000'
  const foldColor = '#666'
  const fillColor = '#fff'

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" width="${vbW}" height="${vbH}">
  <rect width="100%" height="100%" fill="${fillColor}"/>
  <g stroke="${cutColor}" stroke-width="${stroke}" fill="none">
    ${paths.map((p) => `<path d="${p}"/>`).join('\n    ')}
  </g>
  <g stroke="${foldColor}" stroke-width="${foldStroke}" stroke-dasharray="2 1" fill="none">
    ${foldPaths.map((p) => `<path d="${p}"/>`).join('\n    ')}
  </g>
</svg>`
}

/**
 * Layout đơn giản hơn cho tuck-top - dễ hiểu và đúng tỷ lệ.
 * Chuẩn RSC (Regular Slotted Container) style.
 */
export function generateTuckTopNetSvgSimple(d: BoxDimensions): string {
  const { lengthMm: L, widthMm: W, heightMm: H } = d
  const flap = Math.min(L, W) * 0.35
  const stroke = 0.4
  const foldStroke = 0.25

  const panels: { x: number; y: number; w: number; h: number; fold?: boolean }[] = []
  const pad = 2
  const gap = 0 // Các ô phải sát nhau để cạnh chung = nét gấp (không cắt)

  // Back L x H
  panels.push({ x: pad, y: pad, w: L, h: H })
  // Front L x H (sát dưới Back)
  panels.push({ x: pad, y: pad + H + gap, w: L, h: H })
  // Left W x H (sát phải Back)
  panels.push({ x: pad + L + gap, y: pad, w: W, h: H })
  // Bottom L x W
  panels.push({ x: pad + L + gap + W, y: pad, w: L, h: W })
  // Right W x H
  panels.push({ x: pad + L + gap + W + L, y: pad, w: W, h: H })
  // Top lid L x W (sát dưới Front)
  panels.push({ x: pad, y: pad + H + gap + H + gap, w: L, h: W, fold: true })
  // Flaps for top (sát Top lid)
  const fl = pad
  const ft = pad + H + gap + H + gap + W
  panels.push({ x: fl, y: ft, w: L, h: flap, fold: true })
  panels.push({ x: fl - flap, y: ft - W, w: flap, h: W, fold: true })
  panels.push({ x: fl + L, y: ft - W, w: flap, h: W, fold: true })
  panels.push({ x: fl, y: ft - W - flap, w: L, h: flap, fold: true })

  const fs = Math.max(2, Math.min(L, W, H) * 0.08)
  const dimGap = fs + 1.5
  const tickLen = 1.2

  const allPanels = panels.map(({ x, y, w, h }) => ({ x, y, w, h }))
  const { cutSegments, foldSegments } = classifyEdges(allPanels)
  const cutPaths = cutSegments.map(([x1, y1, x2, y2]) => `M ${x1} ${y1} L ${x2} ${y2}`)
  const foldPaths = foldSegments.map(([x1, y1, x2, y2]) => `M ${x1} ${y1} L ${x2} ${y2}`)

  const back = panels[0]!
  const front = panels[1]!
  const left = panels[2]!
  const bottom = panels[3]!
  const right = panels[4]!
  const topLid = panels[5]!
  const flapBottom = panels[6]!
  const flapLeft = panels[7]!
  const flapRight = panels[8]!
  const flapTop = panels[9]!

  let dimResult: DimBuildResult = {
    lines: [],
    labels: [],
    minX: Math.min(...panels.map((p) => p.x)),
    minY: Math.min(...panels.map((p) => p.y)),
    maxX: Math.max(...panels.map((p) => p.x + p.w)),
    maxY: Math.max(...panels.map((p) => p.y + p.h)),
  }

  const addPanelDim = (p: { x: number; y: number; w: number; h: number }, text: string, side: DimSide) => {
    dimResult = mergeDimBounds(dimResult, buildPanelDimension(p.x, p.y, p.w, p.h, text, side, dimGap, tickLen, fs, stroke))
  }

  addPanelDim(back, formatDimMm(L, H), 'bottom')
  addPanelDim(front, formatDimMm(L, H), 'bottom')
  addPanelDim(left, formatDimMm(W, H), 'left')
  addPanelDim(bottom, formatDimMm(L, W), 'top')
  addPanelDim(right, formatDimMm(W, H), 'right')
  addPanelDim(topLid, formatDimMm(L, W), 'bottom')
  addPanelDim(flapBottom, formatDimMm(L, flap), 'bottom')
  addPanelDim(flapLeft, formatDimMm(flap, W), 'left')
  addPanelDim(flapRight, formatDimMm(flap, W), 'right')
  addPanelDim(flapTop, formatDimMm(L, flap), 'top')

  const margin = pad
  const vbMinX = dimResult.minX - margin
  const vbMinY = dimResult.minY - margin
  const vbW = dimResult.maxX - vbMinX + margin
  const vbH = dimResult.maxY - vbMinY + margin
  const offsetX = -vbMinX
  const offsetY = -vbMinY

  const shiftLineCoords = (s: string) => {
    return s
      .replace(/x1="([^"]+)"/, (_, v) => `x1="${Number(v) + offsetX}"`)
      .replace(/y1="([^"]+)"/, (_, v) => `y1="${Number(v) + offsetY}"`)
      .replace(/x2="([^"]+)"/, (_, v) => `x2="${Number(v) + offsetX}"`)
      .replace(/y2="([^"]+)"/, (_, v) => `y2="${Number(v) + offsetY}"`)
  }

  const shiftTextCoords = (s: string) => {
    return s
      .replace(/x="([^"]+)"/, (_, v) => `x="${Number(v) + offsetX}"`)
      .replace(/y="([^"]+)"/, (_, v) => `y="${Number(v) + offsetY}"`)
  }

  const shiftedCutPaths = cutPaths.map((p) => {
    const nums = p.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
    if (nums.length < 4) return p
    return `M ${nums[0]! + offsetX} ${nums[1]! + offsetY} L ${nums[2]! + offsetX} ${nums[3]! + offsetY}`
  })
  const shiftedFoldPaths = foldPaths.map((p) => {
    const nums = p.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
    if (nums.length < 4) return p
    return `M ${nums[0]! + offsetX} ${nums[1]! + offsetY} L ${nums[2]! + offsetX} ${nums[3]! + offsetY}`
  })

  const extLines = dimResult.lines.map(shiftLineCoords)
  const dimLabels = dimResult.labels.map(shiftTextCoords)

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" width="${vbW}" height="${vbH}" preserveAspectRatio="xMidYMid meet" style="max-width:100%;height:auto">
  <rect width="100%" height="100%" fill="#fff"/>
  <g stroke="#dc2626" stroke-width="${stroke}" fill="none">
    ${shiftedCutPaths.map((p) => `<path d="${p}"/>`).join('\n    ')}
  </g>
  <g stroke="#16a34a" stroke-width="${Math.max(foldStroke, stroke)}" stroke-dasharray="4 2" fill="none">
    ${shiftedFoldPaths.map((p) => `<path d="${p}"/>`).join('\n    ')}
  </g>
  <g>${extLines.join('\n    ')}</g>
  <g>${dimLabels.join('\n    ')}</g>
</svg>`
}

/**
 * Tạo SVG net - dùng layout chuẩn RSC.
 */
export function generateBoxNetSvg(boxType: BoxType, d: BoxDimensions): string {
  if (boxType === 'tuck-top') return generateTuckTopNetSvgSimple(d)
  return generateSleeveNetSvg(d)
}

function generateSleeveNetSvg(d: BoxDimensions): string {
  const { lengthMm: L, widthMm: W, heightMm: H } = d
  const stroke = 0.4
  const pad = 2
  const gap = 0 // Các ô sát nhau để cạnh chung = nét gấp

  const panels: { x: number; y: number; w: number; h: number }[] = []
  // Sleeve: 5 mặt - Back, Left, Bottom, Right, Front (sát nhau)
  panels.push({ x: pad, y: pad, w: L, h: H })       // Back
  panels.push({ x: pad + L + gap, y: pad, w: W, h: H }) // Left
  panels.push({ x: pad + L + gap + W, y: pad, w: L, h: H }) // Bottom
  panels.push({ x: pad + L + gap + W + L, y: pad, w: W, h: H }) // Right
  panels.push({ x: pad + L + gap + W + L + W, y: pad, w: L, h: H }) // Front

  const fs = Math.max(2, Math.min(L, W, H) * 0.08)
  const dimGap = fs + 1.5
  const tickLen = 1.2

  const { cutSegments, foldSegments } = classifyEdges(panels)
  const cutPaths = cutSegments.map(([x1, y1, x2, y2]) => `M ${x1} ${y1} L ${x2} ${y2}`)
  const foldPaths = foldSegments.map(([x1, y1, x2, y2]) => `M ${x1} ${y1} L ${x2} ${y2}`)

  const back = panels[0]!
  const left = panels[1]!
  const mid = panels[2]!
  const right = panels[3]!
  const front = panels[4]!

  let dimResult: DimBuildResult = {
    lines: [],
    labels: [],
    minX: Math.min(...panels.map((p) => p.x)),
    minY: Math.min(...panels.map((p) => p.y)),
    maxX: Math.max(...panels.map((p) => p.x + p.w)),
    maxY: Math.max(...panels.map((p) => p.y + p.h)),
  }

  const addPanelDim = (p: { x: number; y: number; w: number; h: number }, text: string, side: DimSide) => {
    dimResult = mergeDimBounds(dimResult, buildPanelDimension(p.x, p.y, p.w, p.h, text, side, dimGap, tickLen, fs, stroke))
  }

  addPanelDim(back, formatDimMm(L, H), 'bottom')
  addPanelDim(left, formatDimMm(W, H), 'bottom')
  addPanelDim(mid, formatDimMm(L, H), 'bottom')
  addPanelDim(right, formatDimMm(W, H), 'bottom')
  addPanelDim(front, formatDimMm(L, H), 'bottom')

  const margin = pad
  const vbMinX = dimResult.minX - margin
  const vbMinY = dimResult.minY - margin
  const vbW = dimResult.maxX - vbMinX + margin
  const vbH = dimResult.maxY - vbMinY + margin
  const offsetX = -vbMinX
  const offsetY = -vbMinY

  const shiftLineCoords = (s: string) => {
    return s
      .replace(/x1="([^"]+)"/, (_, v) => `x1="${Number(v) + offsetX}"`)
      .replace(/y1="([^"]+)"/, (_, v) => `y1="${Number(v) + offsetY}"`)
      .replace(/x2="([^"]+)"/, (_, v) => `x2="${Number(v) + offsetX}"`)
      .replace(/y2="([^"]+)"/, (_, v) => `y2="${Number(v) + offsetY}"`)
  }

  const shiftTextCoords = (s: string) => {
    return s
      .replace(/x="([^"]+)"/, (_, v) => `x="${Number(v) + offsetX}"`)
      .replace(/y="([^"]+)"/, (_, v) => `y="${Number(v) + offsetY}"`)
  }

  const shiftedCutPaths = cutPaths.map((p) => {
    const nums = p.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
    if (nums.length < 4) return p
    return `M ${nums[0]! + offsetX} ${nums[1]! + offsetY} L ${nums[2]! + offsetX} ${nums[3]! + offsetY}`
  })
  const shiftedFoldPaths = foldPaths.map((p) => {
    const nums = p.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
    if (nums.length < 4) return p
    return `M ${nums[0]! + offsetX} ${nums[1]! + offsetY} L ${nums[2]! + offsetX} ${nums[3]! + offsetY}`
  })

  const extLines = dimResult.lines.map(shiftLineCoords)
  const dimLabels = dimResult.labels.map(shiftTextCoords)

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" width="${vbW}" height="${vbH}" preserveAspectRatio="xMidYMid meet" style="max-width:100%;height:auto">
  <rect width="100%" height="100%" fill="#fff"/>
  <g stroke="#dc2626" stroke-width="${stroke}" fill="none">
    ${shiftedCutPaths.map((p) => `<path d="${p}"/>`).join('\n    ')}
  </g>
  <g stroke="#16a34a" stroke-width="${stroke * 0.6}" stroke-dasharray="3 2" fill="none">
    ${shiftedFoldPaths.map((p) => `<path d="${p}"/>`).join('\n    ')}
  </g>
  <g>${extLines.join('\n    ')}</g>
  <g>${dimLabels.join('\n    ')}</g>
</svg>`
}

export function getNetBounds(boxType: BoxType, d: BoxDimensions): NetBounds {
  if (boxType === 'tuck-top') return getTuckTopNetBounds(d)
  return getSleeveNetBounds(d)
}

/** Layout sleeve: Back L×H, Left W×H, Bottom L×W, Right W×H, Front L×H. face1=L×W, face2=L×H, face3=W×H */
export interface SleevePanel {
  x: number
  y: number
  w: number
  h: number
  faceIndex: 1 | 2 | 3
}

export interface SleeveLayoutData {
  panels: SleevePanel[]
  cutSegments: [number, number, number, number][]
  foldSegments: [number, number, number, number][]
  bounds: { widthMm: number; heightMm: number }
}

export interface TuckEndArtworkPanel {
  x: number
  y: number
  w: number
  h: number
  slot: BoxFaceSlot
}

export interface TuckEndLayoutData {
  panels: TuckEndArtworkPanel[]
  cutSegments: [number, number, number, number][]
  foldSegments: [number, number, number, number][]
  bounds: { widthMm: number; heightMm: number }
  /** Kích thước tai dán cạnh thân hộp. */
  glueTabMm: number
  /** Chiều sâu phần lưỡi gài của nắp. */
  tuckTabMm: number
}

export function getSleeveLayoutData(d: BoxDimensions): SleeveLayoutData {
  const { lengthMm: L, widthMm: W, heightMm: H } = d
  const pad = 2
  const gap = 0

  const panels: SleevePanel[] = []
  panels.push({ x: pad, y: pad, w: L, h: H, faceIndex: 2 }) // Back L×H
  panels.push({ x: pad + L + gap, y: pad, w: W, h: H, faceIndex: 3 }) // Left W×H
  panels.push({ x: pad + L + gap + W, y: pad, w: L, h: W, faceIndex: 1 }) // Bottom L×W
  panels.push({ x: pad + L + gap + W + L, y: pad, w: W, h: H, faceIndex: 3 }) // Right W×H
  panels.push({ x: pad + L + gap + W + L + W, y: pad, w: L, h: H, faceIndex: 2 }) // Front L×H

  const flatPanels = panels.map(({ x, y, w, h }) => ({ x, y, w, h }))
  const { cutSegments, foldSegments } = classifyEdges(flatPanels)

  const netWidth = 2 * L + 2 * W + L + pad * 2 // Back+Left+Bottom+Right+Front
  const netHeight = Math.max(H, W) + pad * 2
  const bounds = { widthMm: netWidth, heightMm: netHeight }

  return { panels, cutSegments, foldSegments, bounds }
}

/**
 * Net hộp giấy nắp gài thẳng (straight-tuck end).
 *
 * Thân hộp gồm 4 mặt L-H / W-H / L-H / W-H, có tai dán cạnh.
 * Nắp L-W nguyên vẹn ở hai đầu, kèm lưỡi gài và tai bụi hai bên.
 * Đây là cấu trúc có thể bế, cấn, dán và dựng thành hộp kín; khác với
 * layout "sleeve" cũ chỉ là dải mặt in và không thể đóng thành hộp.
 */
export function getTuckEndLayoutData(
  d: BoxDimensions,
  production?: Partial<TuckBoxProductionParams>
): TuckEndLayoutData {
  const { lengthMm: L, widthMm: W, heightMm: H } = d
  const productionParams = production
    ? normalizeTuckBoxProductionParams(production, H)
    : { ...normalizeTuckBoxProductionParams(undefined, H), compensationGapMm: 0 }
  const pad = 2
  const glueTabMm = productionParams.glueTabMm
  const tuckTabMm = Math.max(10, Math.min(20, W * 0.3))
  const compensationGapMm = productionParams.compensationGapMm
  const dustDepth = Math.max(8, Math.min(W * 0.48, L * 0.45))

  const x0 = pad
  const x1 = x0 + L
  const x2 = x1 + W
  const x3 = x2 + L
  const x4 = x3 + W
  const bodyTop = pad + tuckTabMm + W
  const bodyBottom = bodyTop + H
  const bottomPanelBottom = bodyBottom + W
  const netBottom = bottomPanelBottom + tuckTabMm

  // Các vùng nhận artwork — mỗi mặt hộp dùng ảnh riêng (không đối xứng 3 ảnh).
  const panels: TuckEndArtworkPanel[] = [
    { x: x0, y: bodyTop, w: L, h: H, slot: 'front' },
    { x: x1, y: bodyTop, w: W, h: H, slot: 'right' },
    { x: x2, y: bodyTop, w: L, h: H, slot: 'back' },
    { x: x3, y: bodyTop, w: W, h: H, slot: 'left' },
    { x: x0, y: bodyTop - W, w: L, h: W, slot: 'top' },
    { x: x2, y: bodyBottom, w: L, h: W, slot: 'bottom' },
  ]

  const cutSegments: [number, number, number, number][] = []
  const foldSegments: [number, number, number, number][] = []
  const cut = (xA: number, yA: number, xB: number, yB: number) =>
    cutSegments.push([xA, yA, xB, yB])
  const fold = (xA: number, yA: number, xB: number, yB: number) =>
    foldSegments.push([xA, yA, xB, yB])

  // Cấn dọc thân và tai dán.
  fold(x1, bodyTop, x1, bodyBottom)
  fold(x2, bodyTop, x2, bodyBottom)
  fold(x3, bodyTop, x3, bodyBottom)
  fold(x4, bodyTop, x4, bodyBottom)

  // Cấn nắp trên, nắp dưới và hai lưỡi gài.
  fold(x0, bodyTop, x1, bodyTop)
  fold(x0, bodyTop - W, x1, bodyTop - W)
  fold(x2, bodyBottom, x3, bodyBottom)
  fold(x2, bottomPanelBottom, x3, bottomPanelBottom)

  // Tai bụi trên/dưới gắn với hai mặt hông.
  fold(x1, bodyTop, x2, bodyTop)
  fold(x3, bodyTop, x4, bodyTop)
  fold(x1, bodyBottom, x2, bodyBottom)
  fold(x3, bodyBottom, x4, bodyBottom)

  // Biên trái thân; các đoạn mép thân không gắn nắp là đường cắt.
  cut(x0, bodyTop, x0, bodyBottom)
  cut(x2, bodyTop, x3, bodyTop)
  cut(x0, bodyBottom, x1, bodyBottom)

  // Nắp trên + lưỡi gài, vát hai góc để dễ gài.
  const topTuckY = bodyTop - W - tuckTabMm
  const chamfer = Math.min(4, L * 0.08, tuckTabMm * 0.35)
  const tuckInset = Math.min(L / 2 - 0.5, chamfer + compensationGapMm)
  cut(x0, bodyTop, x0, bodyTop - W)
  cut(x1, bodyTop, x1, bodyTop - W)
  cut(x0, bodyTop - W, x0 + tuckInset, topTuckY)
  cut(x0 + tuckInset, topTuckY, x1 - tuckInset, topTuckY)
  cut(x1 - tuckInset, topTuckY, x1, bodyTop - W)

  // Nắp dưới + lưỡi gài.
  cut(x2, bodyBottom, x2, bottomPanelBottom)
  cut(x3, bodyBottom, x3, bottomPanelBottom)
  cut(x2, bottomPanelBottom, x2 + tuckInset, netBottom)
  cut(x2 + tuckInset, netBottom, x3 - tuckInset, netBottom)
  cut(x3 - tuckInset, netBottom, x3, bottomPanelBottom)

  // Tai bụi: thu nhỏ dần về phía ngoài để không cấn/chồng khi đóng.
  const dustInset = Math.min(W / 2 - 0.5, Math.min(3, W * 0.08) + compensationGapMm)
  const topDustY = bodyTop - dustDepth
  const bottomDustY = bodyBottom + dustDepth
  for (const [left, right] of [[x1, x2], [x3, x4]] as const) {
    cut(left, bodyTop, left + dustInset, topDustY)
    cut(left + dustInset, topDustY, right - dustInset, topDustY)
    cut(right - dustInset, topDustY, right, bodyTop)
    cut(left, bodyBottom, left + dustInset, bottomDustY)
    cut(left + dustInset, bottomDustY, right - dustInset, bottomDustY)
    cut(right - dustInset, bottomDustY, right, bodyBottom)
  }

  // Tai dán cạnh thân, vát đầu để không cấn vào nắp.
  const glueInset = Math.min(4, H * 0.08)
  cut(x4, bodyTop, x4 + glueTabMm, bodyTop + glueInset)
  cut(x4 + glueTabMm, bodyTop + glueInset, x4 + glueTabMm, bodyBottom - glueInset)
  cut(x4 + glueTabMm, bodyBottom - glueInset, x4, bodyBottom)

  return {
    panels,
    cutSegments,
    foldSegments,
    bounds: {
      widthMm: x4 + glueTabMm + pad,
      heightMm: netBottom + pad,
    },
    glueTabMm,
    tuckTabMm,
  }
}

/**
 * Net chữ thập dành cho gấp/dán thủ công.
 *
 * Trục dọc: trên → trước → dưới → sau. Hai mặt hông gắn hai bên mặt trước.
 * Các tai dán quanh nắp, đáy và mặt sau tạo đủ mép liên kết để dựng hộp kín.
 */
export function getCrossFoldLayoutData(
  d: BoxDimensions,
  production?: Partial<TuckBoxProductionParams>
): TuckEndLayoutData {
  const { lengthMm: L, widthMm: W, heightMm: H } = d
  const productionParams = production
    ? normalizeTuckBoxProductionParams(production, H)
    : { ...normalizeTuckBoxProductionParams(undefined, H), compensationGapMm: 0 }
  const pad = 2
  const glueTabMm = Math.min(productionParams.glueTabMm, Math.max(8, Math.min(W, H) * 0.8))
  const x = pad + glueTabMm + W
  const topY = pad + glueTabMm
  const frontY = topY + W
  const bottomY = frontY + H
  const backY = bottomY + W

  const panels: TuckEndArtworkPanel[] = [
    { x, y: topY, w: L, h: W, slot: 'top' },
    { x, y: frontY, w: L, h: H, slot: 'front' },
    { x: x + L, y: frontY, w: W, h: H, slot: 'right' },
    { x, y: bottomY, w: L, h: W, slot: 'bottom' },
    { x, y: backY, w: L, h: H, slot: 'back' },
    { x: x - W, y: frontY, w: W, h: H, slot: 'left' },
  ]

  const cutSegments: [number, number, number, number][] = []
  const foldSegments: [number, number, number, number][] = []
  const cut = (x1: number, y1: number, x2: number, y2: number) =>
    cutSegments.push([x1, y1, x2, y2])
  const fold = (x1: number, y1: number, x2: number, y2: number) =>
    foldSegments.push([x1, y1, x2, y2])

  // Cấn giữa các mặt chính.
  fold(x, frontY, x + L, frontY)
  fold(x, bottomY, x + L, bottomY)
  fold(x, backY, x + L, backY)
  fold(x, frontY, x, frontY + H)
  fold(x + L, frontY, x + L, frontY + H)

  const addTab = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    outwardX: number,
    outwardY: number
  ) => {
    const edgeLength = Math.hypot(x2 - x1, y2 - y1)
    const tx = (x2 - x1) / edgeLength
    const ty = (y2 - y1) / edgeLength
    const inset = Math.min(4, edgeLength * 0.12, glueTabMm * 0.3)
    const ax = x1 + tx * inset + outwardX * glueTabMm
    const ay = y1 + ty * inset + outwardY * glueTabMm
    const bx = x2 - tx * inset + outwardX * glueTabMm
    const by = y2 - ty * inset + outwardY * glueTabMm
    fold(x1, y1, x2, y2)
    cut(x1, y1, ax, ay)
    cut(ax, ay, bx, by)
    cut(bx, by, x2, y2)
  }

  // Nắp trên dán vào ba cạnh còn lại.
  addTab(x, topY, x + L, topY, 0, -1)
  addTab(x, topY, x, frontY, -1, 0)
  addTab(x + L, topY, x + L, frontY, 1, 0)
  // Đáy đã nối trước/sau; hai tai bên dán vào mặt hông.
  addTab(x, bottomY, x, backY, -1, 0)
  addTab(x + L, bottomY, x + L, backY, 1, 0)
  // Mặt sau dán với hai mặt hông.
  addTab(x, backY, x, backY + H, -1, 0)
  addTab(x + L, backY, x + L, backY + H, 1, 0)

  // Các cạnh ngoài không có tai dán.
  cut(x - W, frontY, x - W, frontY + H)
  cut(x - W, frontY, x, frontY)
  cut(x - W, frontY + H, x, frontY + H)
  cut(x + L + W, frontY, x + L + W, frontY + H)
  cut(x + L, frontY, x + L + W, frontY)
  cut(x + L, frontY + H, x + L + W, frontY + H)
  cut(x, backY + H, x + L, backY + H)

  const maxX = Math.max(x + L + W, x + L + glueTabMm)
  return {
    panels,
    cutSegments,
    foldSegments,
    bounds: {
      widthMm: maxX + pad,
      heightMm: backY + H + pad,
    },
    glueTabMm,
    tuckTabMm: 0,
  }
}

export function getBoxDielineLayoutData(
  structure: BoxDielineStructure | undefined,
  d: BoxDimensions,
  production?: Partial<TuckBoxProductionParams>
): TuckEndLayoutData {
  return (structure ?? DEFAULT_BOX_DIELINE_STRUCTURE) === 'cross_fold'
    ? getCrossFoldLayoutData(d, production)
    : getTuckEndLayoutData(d, production)
}

function formatCmFromMm(mm: number, locale: WebLocale): string {
  const cm = (mm / 10).toFixed(1)
  return locale === 'vi' ? cm.replace('.', ',') : cm
}

function formatPanelDimLabel(mm: number, locale: WebLocale): string {
  return `${formatCmFromMm(mm, locale)} cm`
}

const TUCK_END_PANEL_DIM_SIDES: Record<BoxFaceSlot, { width: DimSide; height: DimSide }> = {
  front: { width: 'bottom', height: 'left' },
  right: { width: 'bottom', height: 'left' },
  back: { width: 'bottom', height: 'right' },
  left: { width: 'bottom', height: 'right' },
  top: { width: 'top', height: 'left' },
  bottom: { width: 'bottom', height: 'right' },
}

function buildTuckEndPanelDimensions(
  panel: TuckEndArtworkPanel,
  locale: WebLocale
): DimBuildResult {
  const sides = TUCK_END_PANEL_DIM_SIDES[panel.slot]
  const fs = Math.max(13, Math.min(18, Math.min(panel.w, panel.h) * 0.095))
  const dimGap = fs * 0.82
  const tickLen = 1.8
  const stroke = 1.1
  let result: DimBuildResult = {
    lines: [],
    labels: [],
    minX: panel.x,
    minY: panel.y,
    maxX: panel.x + panel.w,
    maxY: panel.y + panel.h,
  }
  result = mergeDimBounds(
    result,
    buildPanelDimension(
      panel.x,
      panel.y,
      panel.w,
      panel.h,
      formatPanelDimLabel(panel.w, locale),
      sides.width,
      dimGap,
      tickLen,
      fs,
      stroke
    )
  )
  result = mergeDimBounds(
    result,
    buildPanelDimension(
      panel.x,
      panel.y,
      panel.w,
      panel.h,
      formatPanelDimLabel(panel.h, locale),
      sides.height,
      dimGap,
      tickLen,
      fs,
      stroke
    )
  )
  return result
}

function shiftSvgLineMarkup(markup: string, offsetX: number, offsetY: number): string {
  return markup
    .replace(/x1="([^"]+)"/g, (_, v) => `x1="${(Number(v) + offsetX).toFixed(2)}"`)
    .replace(/y1="([^"]+)"/g, (_, v) => `y1="${(Number(v) + offsetY).toFixed(2)}"`)
    .replace(/x2="([^"]+)"/g, (_, v) => `x2="${(Number(v) + offsetX).toFixed(2)}"`)
    .replace(/y2="([^"]+)"/g, (_, v) => `y2="${(Number(v) + offsetY).toFixed(2)}"`)
}

function shiftSvgTextMarkup(markup: string, offsetX: number, offsetY: number): string {
  return markup
    .replace(/\bx="([^"]+)"/g, (_, v) => `x="${(Number(v) + offsetX).toFixed(2)}"`)
    .replace(/\by="([^"]+)"/g, (_, v) => `y="${(Number(v) + offsetY).toFixed(2)}"`)
}

function getTuckEndPanelLabelBounds(
  panel: TuckEndArtworkPanel,
  locale: WebLocale,
  offsetX: number,
  offsetY: number
): { minX: number; minY: number; maxX: number; maxY: number } {
  const cx = panel.x + panel.w / 2 + offsetX
  const cy = panel.y + panel.h / 2 + offsetY
  const name = getBoxFaceSlotLabel(panel.slot, locale)
  const sizeKey = getSizeKeyForSlot(panel.slot).replace(/x/g, '×')
  const fontSize = Math.max(16, Math.min(28, panel.w * 0.09, panel.h * 0.16))
  const subSize = fontSize * 0.74
  const lineGap = fontSize * 1
  const padX = fontSize * 0.45
  const padY = fontSize * 0.3
  const boxW = Math.min(panel.w * 0.9, Math.max(name.length + sizeKey.length + 3, 8) * fontSize * 0.44 + padX * 2)
  const boxH = fontSize + subSize + lineGap * 0.24 + padY * 2
  return {
    minX: cx - boxW / 2,
    minY: cy - boxH / 2,
    maxX: cx + boxW / 2,
    maxY: cy + boxH / 2,
  }
}

function buildTuckEndPanelLabelSvg(
  panel: TuckEndArtworkPanel,
  locale: WebLocale,
  offsetX = 0,
  offsetY = 0
): string {
  const cx = panel.x + panel.w / 2 + offsetX
  const cy = panel.y + panel.h / 2 + offsetY
  const name = getBoxFaceSlotLabel(panel.slot, locale)
  const sizeKey = getSizeKeyForSlot(panel.slot).replace(/x/g, '×')
  const fontSize = Math.max(16, Math.min(28, panel.w * 0.09, panel.h * 0.16))
  const subSize = fontSize * 0.74
  const lineGap = fontSize * 1
  const padX = fontSize * 0.45
  const padY = fontSize * 0.3
  const boxW = Math.min(panel.w * 0.9, Math.max(name.length + sizeKey.length + 3, 8) * fontSize * 0.44 + padX * 2)
  const boxH = fontSize + subSize + lineGap * 0.24 + padY * 2

  return `<g>
<rect x="${(cx - boxW / 2).toFixed(2)}" y="${(cy - boxH / 2).toFixed(2)}" width="${boxW.toFixed(2)}" height="${boxH.toFixed(2)}" rx="${(fontSize * 0.15).toFixed(2)}" fill="#ffffff" fill-opacity="0.92" stroke="#cbd5e1" stroke-width="0.4"/>
<text x="${cx.toFixed(2)}" y="${(cy - lineGap * 0.16).toFixed(2)}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize.toFixed(2)}" font-weight="700" font-family="system-ui,sans-serif" fill="#0f172a" stroke="#ffffff" stroke-width="${(fontSize * 0.13).toFixed(2)}" paint-order="stroke fill">${name}</text>
<text x="${cx.toFixed(2)}" y="${(cy + lineGap * 0.48).toFixed(2)}" text-anchor="middle" dominant-baseline="middle" font-size="${subSize.toFixed(2)}" font-weight="600" font-family="system-ui,sans-serif" fill="#334155" stroke="#ffffff" stroke-width="${(subSize * 0.11).toFixed(2)}" paint-order="stroke fill">${sizeKey}</text>
</g>`
}

/** Blank production preview built from the exact cut/fold geometry used by PDF export. */
export function generateTuckEndBlankSvg(
  d: BoxDimensions,
  production?: Partial<TuckBoxProductionParams>,
  locale: WebLocale = 'vi',
  structure: BoxDielineStructure = DEFAULT_BOX_DIELINE_STRUCTURE
): string {
  const layout = getBoxDielineLayoutData(structure, d, production)

  let bounds: DimBuildResult = {
    lines: [],
    labels: [],
    minX: 0,
    minY: 0,
    maxX: layout.bounds.widthMm,
    maxY: layout.bounds.heightMm,
  }

  const panelLabels: string[] = []
  const dimLines: string[] = []
  const dimLabels: string[] = []

  for (const panel of layout.panels) {
    const dims = buildTuckEndPanelDimensions(panel, locale)
    dimLines.push(...dims.lines)
    dimLabels.push(...dims.labels)
    bounds = mergeDimBounds(bounds, dims)
    bounds.minX = Math.min(bounds.minX, panel.x)
    bounds.minY = Math.min(bounds.minY, panel.y)
    bounds.maxX = Math.max(bounds.maxX, panel.x + panel.w)
    bounds.maxY = Math.max(bounds.maxY, panel.y + panel.h)
    const labelBounds = getTuckEndPanelLabelBounds(panel, locale, 0, 0)
    bounds.minX = Math.min(bounds.minX, labelBounds.minX)
    bounds.minY = Math.min(bounds.minY, labelBounds.minY)
    bounds.maxX = Math.max(bounds.maxX, labelBounds.maxX)
    bounds.maxY = Math.max(bounds.maxY, labelBounds.maxY)
  }

  const maxDimFont = layout.panels.reduce((max, panel) => {
    const fs = Math.max(13, Math.min(18, Math.min(panel.w, panel.h) * 0.095))
    return Math.max(max, fs)
  }, 13)
  const margin = Math.max(18, maxDimFont * 1.4)

  const vbMinX = bounds.minX - margin
  const vbMinY = bounds.minY - margin
  const vbW = bounds.maxX - bounds.minX + margin * 2
  const vbH = bounds.maxY - bounds.minY + margin * 2
  const offsetX = -vbMinX
  const offsetY = -vbMinY

  for (const panel of layout.panels) {
    panelLabels.push(buildTuckEndPanelLabelSvg(panel, locale, offsetX, offsetY))
  }

  const cut = layout.cutSegments
    .map(
      ([x1, y1, x2, y2]) =>
        `<line x1="${(x1 + offsetX).toFixed(2)}" y1="${(y1 + offsetY).toFixed(2)}" x2="${(x2 + offsetX).toFixed(2)}" y2="${(y2 + offsetY).toFixed(2)}"/>`
    )
    .join('')
  const fold = layout.foldSegments
    .map(
      ([x1, y1, x2, y2]) =>
        `<line x1="${(x1 + offsetX).toFixed(2)}" y1="${(y1 + offsetY).toFixed(2)}" x2="${(x2 + offsetX).toFixed(2)}" y2="${(y2 + offsetY).toFixed(2)}"/>`
    )
    .join('')
  const labels = panelLabels.join('')
  const shiftedDimLines = dimLines.map((line) => shiftSvgLineMarkup(line, offsetX, offsetY)).join('')
  const shiftedDimLabels = dimLabels.map((label) => shiftSvgTextMarkup(label, offsetX, offsetY)).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW.toFixed(2)} ${vbH.toFixed(2)}" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-hidden="true" style="display:block;width:100%;height:auto;min-height:160px"><rect width="100%" height="100%" fill="#fff"/><g stroke="#64748b" stroke-width="0.55" fill="none">${shiftedDimLines}</g><g font-family="system-ui,sans-serif" font-weight="600" fill="#1e293b">${shiftedDimLabels}</g><g stroke="#dc2626" stroke-width="0.65" fill="none">${cut}</g><g stroke="#16a34a" stroke-width="0.55" stroke-dasharray="3 2" fill="none">${fold}</g><g>${labels}</g></svg>`
}
