/**
 * Tạo SVG net hộp carton (mặt phẳng triển khai).
 * Hỗ trợ: Tuck-top (hộp nắp gập), Sleeve (hộp ốp).
 */

import type { BoxFaceSlot } from '@/lib/packaging/box-face-slots'

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
    minX = Math.min(minX, tx - fs * text.length * 0.35)
  } else {
    const dimX = x + w + gap
    lines.push(line(x + w, y, dimX, y))
    lines.push(line(x + w, y + h, dimX, y + h))
    lines.push(line(dimX, y, dimX, y + h))
    tx = dimX + fs * 0.25
    ty = y + h / 2
    anchor = 'start'
    maxX = Math.max(maxX, tx + fs * text.length * 0.35)
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
export function getTuckEndLayoutData(d: BoxDimensions): TuckEndLayoutData {
  const { lengthMm: L, widthMm: W, heightMm: H } = d
  const pad = 2
  const glueTabMm = Math.max(15, Math.min(25, H * 0.3))
  const tuckTabMm = Math.max(10, Math.min(20, W * 0.3))
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
  cut(x0, bodyTop, x0, bodyTop - W)
  cut(x1, bodyTop, x1, bodyTop - W)
  cut(x0, bodyTop - W, x0 + chamfer, topTuckY)
  cut(x0 + chamfer, topTuckY, x1 - chamfer, topTuckY)
  cut(x1 - chamfer, topTuckY, x1, bodyTop - W)

  // Nắp dưới + lưỡi gài.
  cut(x2, bodyBottom, x2, bottomPanelBottom)
  cut(x3, bodyBottom, x3, bottomPanelBottom)
  cut(x2, bottomPanelBottom, x2 + chamfer, netBottom)
  cut(x2 + chamfer, netBottom, x3 - chamfer, netBottom)
  cut(x3 - chamfer, netBottom, x3, bottomPanelBottom)

  // Tai bụi: thu nhỏ dần về phía ngoài để không cấn/chồng khi đóng.
  const dustInset = Math.min(3, W * 0.08)
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
