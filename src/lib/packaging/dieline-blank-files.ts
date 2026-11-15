import type { TuckEndLayoutData } from '@/lib/packaging/box-net-svg'

type Seg = [number, number, number, number]

function line(seg: Seg, dx: number, dy: number): string {
  const [x1, y1, x2, y2] = seg
  return `<line x1="${(x1 + dx).toFixed(3)}" y1="${(y1 + dy).toFixed(3)}" x2="${(x2 + dx).toFixed(3)}" y2="${(y2 + dy).toFixed(3)}"/>`
}

/** Dieline trắng: chỉ nét cắt và nét gấp, đơn vị mm. */
export function buildBlankDielineSvg(layout: TuckEndLayoutData): string {
  const width = layout.bounds.widthMm
  const height = layout.bounds.heightMm
  const cuts = layout.cutSegments.map((seg) => line(seg, 0, 0)).join('')
  const folds = layout.foldSegments.map((seg) => line(seg, 0, 0)).join('')
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}">
<g id="CutContour" fill="none" stroke="#ff00ff" stroke-width="0.2">${cuts}</g>
<g id="Crease" fill="none" stroke="#00a651" stroke-width="0.2" stroke-dasharray="2 1">${folds}</g>
</svg>`
}

function dxfLine(layer: string, seg: Seg, height: number): string {
  const [x1, y1, x2, y2] = seg
  const yUp = (y: number) => height - y
  return `0\nLINE\n8\n${layer}\n10\n${x1.toFixed(3)}\n20\n${yUp(y1).toFixed(3)}\n30\n0\n11\n${x2.toFixed(3)}\n21\n${yUp(y2).toFixed(3)}\n31\n0\n`
}

/** DXF milimet, trục Y hướng lên, layer CUT và CREASE. */
export function buildBlankDielineDxf(layout: TuckEndLayoutData): string {
  const height = layout.bounds.heightMm
  const entities = [
    ...layout.cutSegments.map((seg) => dxfLine('CUT', seg, height)),
    ...layout.foldSegments.map((seg) => dxfLine('CREASE', seg, height)),
  ].join('')
  return `0
SECTION
2
HEADER
9
$INSUNITS
70
4
0
ENDSEC
0
SECTION
2
TABLES
0
TABLE
2
LAYER
0
LAYER
2
CUT
70
0
62
1
6
CONTINUOUS
0
LAYER
2
CREASE
70
0
62
3
6
DASHED
0
ENDTAB
0
ENDSEC
0
SECTION
2
ENTITIES
${entities}0
ENDSEC
0
EOF
`
}
