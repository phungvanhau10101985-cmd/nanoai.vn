/**
 * Tạo SVG net túi đựng (mặt phẳng triển khai).
 * Layout: Back | Left gusset | Bottom | Right gusset | Front
 */

export interface BagDimensions {
  widthMm: number   // W - chiều rộng mặt trước/sau
  heightMm: number  // H - chiều cao
  gussetMm: number  // G - độ sâu gusset (hông túi)
}

export interface NetBounds {
  widthMm: number
  heightMm: number
}

const TOL = 0.05

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
  return { cutSegments: dedupe(cutSegments), foldSegments: dedupe(foldSegments) }
}

export function getBagNetBounds(d: BagDimensions): NetBounds {
  const { widthMm: W, heightMm: H, gussetMm: G } = d
  const pad = 2
  const fs = Math.max(2, Math.min(W, H, G) * 0.08)
  const dimOff = fs + 1
  const netWidth = pad + W + G + W + G + W + pad
  const netHeight = pad + H + pad + dimOff * 2
  return { widthMm: netWidth, heightMm: netHeight }
}

export function generateBagNetSvg(d: BagDimensions): string {
  const { widthMm: W, heightMm: H, gussetMm: G } = d
  const stroke = 0.4
  const pad = 2
  const gap = 0

  const panels: { x: number; y: number; w: number; h: number }[] = []
  panels.push({ x: pad, y: pad, w: W, h: H })                           // Back
  panels.push({ x: pad + W + gap, y: pad, w: G, h: H })                  // Left gusset
  panels.push({ x: pad + W + gap + G, y: pad + H - G, w: W, h: G })      // Bottom
  panels.push({ x: pad + W + gap + G + W, y: pad, w: G, h: H })          // Right gusset
  panels.push({ x: pad + W + gap + G + W + G, y: pad, w: W, h: H })      // Front

  const fs = Math.max(2, Math.min(W, H, G) * 0.08)
  const dimOff = fs + 1
  const maxX = Math.max(...panels.map((p) => p.x + p.w)) + pad
  const maxY = Math.max(...panels.map((p) => p.y + p.h)) + pad + dimOff * 2

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
  addDim(pad + W / 2, pad + H + dimOff, `W ${W} × H ${H}`, [[pad, pad + H, pad, pad + H - tickLen], [pad + W, pad + H, pad + W, pad + H - tickLen]])
  addDim(pad + W + gap + G / 2, pad + H + dimOff, `G ${G} × H ${H}`, [[pad + W + gap, pad + H, pad + W + gap, pad + H - tickLen], [pad + W + gap + G, pad + H, pad + W + gap + G, pad + H - tickLen]])
  addDim(pad + W + gap + G + W / 2, pad + H + dimOff, `W ${W} × G ${G}`, [[pad + W + gap + G, pad + H, pad + W + gap + G, pad + H - tickLen], [pad + W + gap + G + W, pad + H, pad + W + gap + G + W, pad + H - tickLen]])
  addDim(pad + W + gap + G + W + G / 2, pad + H + dimOff, `G ${G} × H ${H}`, [[pad + W + gap + G + W, pad + H, pad + W + gap + G + W, pad + H - tickLen], [pad + W + gap + G + W + G, pad + H, pad + W + gap + G + W + G, pad + H - tickLen]])
  addDim(pad + W + gap + G + W + G + W / 2, pad + H + dimOff, `W ${W} × H ${H}`, [[pad + W + gap + G + W + G, pad + H, pad + W + gap + G + W + G, pad + H - tickLen], [pad + W + gap + G + W + G + W, pad + H, pad + W + gap + G + W + G + W, pad + H - tickLen]])

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${maxX} ${maxY}" width="${maxX}" height="${maxY}" preserveAspectRatio="xMidYMid meet" style="max-width:100%;height:auto">
  <rect width="100%" height="100%" fill="#fff"/>
  <g stroke="#dc2626" stroke-width="${stroke}" fill="none">
    ${cutPaths.map((p) => `<path d="${p}"/>`).join('\n    ')}
  </g>
  <g stroke="#16a34a" stroke-width="${stroke * 0.6}" stroke-dasharray="4 2" fill="none">
    ${foldPaths.map((p) => `<path d="${p}"/>`).join('\n    ')}
  </g>
  <g>${extLines.join('\n    ')}</g>
  <g>${dimLabels.join('\n    ')}</g>
</svg>`
}
