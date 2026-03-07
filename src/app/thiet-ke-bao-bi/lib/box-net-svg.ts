/**
 * Tạo SVG net hộp carton (mặt phẳng triển khai).
 * Hỗ trợ: Tuck-top (hộp nắp gập), Sleeve (hộp ốp).
 */

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

  const drawCutLine = (x1: number, y1: number, x2: number, y2: number) => {
    paths.push(`M ${x1} ${y1} L ${x2} ${y2}`)
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

  // Layout từ trái sang phải, từ trên xuống:
  // [Back LxH] [Left WxH][Bottom LxW][Right WxH] [Front LxH]
  // [Top lid LxW] với 4 flaps

  let cx = 0
  let cy = 0

  // Back
  panels.push({ x: cx, y: cy, w: L, h: H })
  cx += L

  // Left, Bottom, Right (cùng hàng)
  panels.push({ x: cx, y: cy, w: W, h: H })
  cx += W
  panels.push({ x: cx, y: cy, w: L, h: W })
  cx += W
  panels.push({ x: cx, y: cy, w: W, h: H })
  cx += W

  // Front (hàng 2, căn trái)
  cx = 0
  cy = H
  panels.push({ x: cx, y: cy, w: L, h: H })
  cx += L
  // Khoảng trống W, rồi Bottom đã có
  cx = L + W
  panels.push({ x: cx, y: cy, w: L, h: W }) // Bottom thực ra đã vẽ ở hàng 1
  // Sửa: Front nằm dưới Back
  // Back ở (0,0), Front ở (0, H) - cùng cột
  // Left, Bottom, Right ở giữa

  // Đơn giản: layout 2 cột
  // Cột 1: Back (0,0), Front (0,H)
  // Cột 2: Left (L,0), Bottom (L,W), Right (L,W+H)
  // Cột 3: Top lid (L+W, ?)

  panels.length = 0
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

  const dimOff = Math.max(2, Math.min(L, W, H) * 0.08) + 1
  const maxX = Math.max(...panels.map((p) => p.x + p.w)) + pad
  const maxY = Math.max(...panels.map((p) => p.y + p.h)) + pad + dimOff * 2

  // Chỉ cắt chu vi ngoài (nét đen), gấp theo cạnh chung (nét đứt)
  const allPanels = panels.map(({ x, y, w, h }) => ({ x, y, w, h }))
  const { cutSegments, foldSegments } = classifyEdges(allPanels)
  const cutPaths = cutSegments.map(([x1, y1, x2, y2]) => `M ${x1} ${y1} L ${x2} ${y2}`)
  const foldPaths = foldSegments.map(([x1, y1, x2, y2]) => `M ${x1} ${y1} L ${x2} ${y2}`)

  // Đường dóng (trong ô) + số kích thước (ngoài ô)
  const fs = Math.max(2, Math.min(L, W, H) * 0.08)
  const tickLen = 1.2
  const dimLabels: string[] = []
  const extLines: string[] = []
  const addDim = (px: number, py: number, text: string, ext: [number, number, number, number][]) => {
    ext.forEach(([x1, y1, x2, y2]) => extLines.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#64748b" stroke-width="${stroke * 0.6}"/>`))
    dimLabels.push(`<text x="${px}" y="${py}" text-anchor="middle" dominant-baseline="hanging" font-size="${fs}" fill="#333" font-family="sans-serif">${text}</text>`)
  }
  addDim(pad + L / 2, pad + H + dimOff, `L ${L} × H ${H}`, [[pad, pad + H, pad, pad + H - tickLen], [pad + L, pad + H, pad + L, pad + H - tickLen]])
  addDim(pad + L / 2, pad + H + gap + H + dimOff, `L ${L} × H ${H}`, [[pad, pad + H + gap + H, pad, pad + H + gap + H - tickLen], [pad + L, pad + H + gap + H, pad + L, pad + H + gap + H - tickLen]])
  addDim(pad + L + gap + W / 2, pad + H + dimOff, `W ${W} × H ${H}`, [[pad + L + gap, pad + H, pad + L + gap, pad + H - tickLen], [pad + L + gap + W, pad + H, pad + L + gap + W, pad + H - tickLen]])
  addDim(pad + L + gap + W + L / 2, pad + W + dimOff, `L ${L} × W ${W}`, [[pad + L + gap + W, pad + W, pad + L + gap + W, pad + W - tickLen], [pad + L + gap + W + L, pad + W, pad + L + gap + W + L, pad + W - tickLen]])
  addDim(pad + L + gap + W + L + W / 2, pad + H + dimOff, `W ${W} × H ${H}`, [[pad + L + gap + W + L, pad + H, pad + L + gap + W + L, pad + H - tickLen], [pad + L + gap + W + L + W, pad + H, pad + L + gap + W + L + W, pad + H - tickLen]])
  addDim(pad + L / 2, pad + H + gap + H + gap + W + dimOff, `L ${L} × W ${W}`, [[pad, pad + H + gap + H + gap + W, pad, pad + H + gap + H + gap + W - tickLen], [pad + L, pad + H + gap + H + gap + W, pad + L, pad + H + gap + H + gap + W - tickLen]])

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${maxX} ${maxY}" width="${maxX}" height="${maxY}" preserveAspectRatio="xMidYMid meet" style="max-width:100%;height:auto">
  <rect width="100%" height="100%" fill="#fff"/>
  <g stroke="#dc2626" stroke-width="${stroke}" fill="none">
    ${cutPaths.map((p) => `<path d="${p}"/>`).join('\n    ')}
  </g>
  <g stroke="#16a34a" stroke-width="${Math.max(foldStroke, stroke)}" stroke-dasharray="4 2" fill="none">
    ${foldPaths.map((p) => `<path d="${p}"/>`).join('\n    ')}
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
  const dimOff = fs + 1
  const maxX = Math.max(...panels.map((p) => p.x + p.w)) + pad
  const maxY = Math.max(...panels.map((p) => p.y + p.h)) + pad + dimOff * 2

  // Chỉ cắt chu vi ngoài (nét đen), gấp theo cạnh chung (nét đứt)
  const { cutSegments, foldSegments } = classifyEdges(panels)
  const cutPaths = cutSegments.map(([x1, y1, x2, y2]) => `M ${x1} ${y1} L ${x2} ${y2}`)
  const foldPaths = foldSegments.map(([x1, y1, x2, y2]) => `M ${x1} ${y1} L ${x2} ${y2}`)

  const tickLen = 1.2
  const dimLabels: string[] = []
  const extLines: string[] = []
  const addDim = (px: number, py: number, text: string, ext: [number, number, number, number][]) => {
    ext.forEach(([x1, y1, x2, y2]) => extLines.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#64748b" stroke-width="${stroke * 0.6}"/>`))
    dimLabels.push(`<text x="${px}" y="${py}" text-anchor="middle" dominant-baseline="hanging" font-size="${fs}" fill="#333" font-family="sans-serif">${text}</text>`)
  }
  addDim(pad + L / 2, pad + H + dimOff, `L ${L} × H ${H}`, [[pad, pad + H, pad, pad + H - tickLen], [pad + L, pad + H, pad + L, pad + H - tickLen]])
  addDim(pad + L + gap + W / 2, pad + H + dimOff, `W ${W} × H ${H}`, [[pad + L + gap, pad + H, pad + L + gap, pad + H - tickLen], [pad + L + gap + W, pad + H, pad + L + gap + W, pad + H - tickLen]])
  addDim(pad + L + gap + W + L / 2, pad + H + dimOff, `L ${L} × H ${H}`, [[pad + L + gap + W, pad + H, pad + L + gap + W, pad + H - tickLen], [pad + L + gap + W + L, pad + H, pad + L + gap + W + L, pad + H - tickLen]])
  addDim(pad + L + gap + W + L + W / 2, pad + H + dimOff, `W ${W} × H ${H}`, [[pad + L + gap + W + L, pad + H, pad + L + gap + W + L, pad + H - tickLen], [pad + L + gap + W + L + W, pad + H, pad + L + gap + W + L + W, pad + H - tickLen]])
  addDim(pad + L + gap + W + L + W + L / 2, pad + H + dimOff, `L ${L} × H ${H}`, [[pad + L + gap + W + L + W, pad + H, pad + L + gap + W + L + W, pad + H - tickLen], [pad + L + gap + W + L + W + L, pad + H, pad + L + gap + W + L + W + L, pad + H - tickLen]])

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${maxX} ${maxY}" width="${maxX}" height="${maxY}" preserveAspectRatio="xMidYMid meet" style="max-width:100%;height:auto">
  <rect width="100%" height="100%" fill="#fff"/>
  <g stroke="#dc2626" stroke-width="${stroke}" fill="none">
    ${cutPaths.map((p) => `<path d="${p}"/>`).join('\n    ')}
  </g>
  <g stroke="#16a34a" stroke-width="${stroke * 0.6}" stroke-dasharray="3 2" fill="none">
    ${foldPaths.map((p) => `<path d="${p}"/>`).join('\n    ')}
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
