import type { SolidKind, WhiteboardPoint } from './types'
import { WHITEBOARD_GRID } from './types'

export type SolidMesh = {
  points: WhiteboardPoint[]
  /** Cặp chỉ số đỉnh. hidden cặp đầu là cạnh khuất. */
  edges: number[]
  hidden: number
  /** Đỉnh góc, không gồm điểm lấy mẫu của elip. */
  corners: number[]
}

type V3 = [number, number, number]

class Mesh {
  points: WhiteboardPoint[] = []
  corners: number[] = []
  private hiddenEdges: number[] = []
  private shownEdges: number[] = []

  put(v: V3, s: number): number {
    this.points.push({ x: (v[0] + v[2] * 0.55) * s, y: (-v[1] - v[2] * 0.4) * s })
    return this.points.length - 1
  }

  corner(index: number) {
    this.corners.push(index)
  }

  edge(a: number, b: number, dash: boolean) {
    if (dash) this.hiddenEdges.push(a, b)
    else this.shownEdges.push(a, b)
  }

  ring(cx: number, cy: number, rx: number, ry: number, steps: number, hide: (i: number) => boolean): number {
    const start = this.points.length
    for (let i = 0; i < steps; i += 1) {
      const t = (i / steps) * Math.PI * 2
      this.points.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) })
    }
    for (let i = 0; i < steps; i += 1) this.edge(start + i, start + ((i + 1) % steps), hide(i))
    return start
  }

  /** Đường tròn nằm ngang trong không gian, rồi mới chiếu xiên. */
  ring3(y: number, r: number, steps: number, hide: (i: number) => boolean): number {
    const start = this.points.length
    for (let i = 0; i < steps; i += 1) {
      const t = (i / steps) * Math.PI * 2
      this.put([r * Math.cos(t), y, r * Math.sin(t)], 1)
    }
    for (let i = 0; i < steps; i += 1) this.edge(start + i, start + ((i + 1) % steps), hide(i))
    return start
  }

  done(): SolidMesh {
    return {
      points: this.points,
      edges: [...this.hiddenEdges, ...this.shownEdges],
      hidden: this.hiddenEdges.length / 2,
      corners: this.corners,
    }
  }
}

/** Mặt nhìn thấy khi chiếu xiên: máy ở phía trước, trên và bên phải. */
const VIEW = { x: 0.55, y: 0.4, z: -1 }

function polyhedron(verts: V3[], faces: number[][], s: number): SolidMesh {
  const m = new Mesh()
  const ids = verts.map((v) => {
    const id = m.put(v, s)
    m.corner(id)
    return id
  })
  const facing = faces.map((face) => {
    const a = verts[face[0]]
    const b = verts[face[1]]
    const c = verts[face[2]]
    const ux = b[0] - a[0]
    const uy = b[1] - a[1]
    const uz = b[2] - a[2]
    const vx = c[0] - a[0]
    const vy = c[1] - a[1]
    const vz = c[2] - a[2]
    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx
    return nx * VIEW.x + ny * VIEW.y + nz * VIEW.z > 1e-4
  })
  const seen = new Map<string, { a: number; b: number; front: boolean[] }>()
  faces.forEach((face, faceIndex) => {
    for (let k = 0; k < face.length; k += 1) {
      const a = face[k]
      const b = face[(k + 1) % face.length]
      const key = a < b ? `${a}-${b}` : `${b}-${a}`
      const row = seen.get(key) ?? { a, b, front: [] }
      row.front.push(facing[faceIndex])
      seen.set(key, row)
    }
  })
  for (const row of seen.values()) {
    m.edge(ids[row.a], ids[row.b], row.front.every((ok) => !ok))
  }
  return m.done()
}

function extruded(front: V3[], hz: number, s: number): SolidMesh {
  const n = front.length
  const verts: V3[] = [
    ...front,
    ...front.map((v) => [v[0], v[1], v[2] + hz] as V3),
  ]
  const faces: number[][] = [
    Array.from({ length: n }, (_, i) => n - 1 - i),
    Array.from({ length: n }, (_, i) => n + i),
  ]
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n
    faces.push([i, j, n + j, n + i])
  }
  return polyhedron(verts, faces, s)
}

function hex(r: number, y: number, z: number): V3[] {
  const out: V3[] = []
  for (let i = 0; i < 6; i += 1) {
    const t = -Math.PI / 2 + (i * Math.PI) / 3
    out.push([r * Math.cos(t), y + r * Math.sin(t), z])
  }
  return out
}

function pyramid(base: V3[], apex: V3, s: number): SolidMesh {
  const n = base.length
  const verts: V3[] = [...base, apex]
  const faces: number[][] = [Array.from({ length: n }, (_, i) => n - 1 - i)]
  for (let i = 0; i < n; i += 1) faces.push([i, (i + 1) % n, n])
  return polyhedron(verts, faces, s)
}

const STEPS = 16

function roundSolid(s: number, kind: 'cylinder' | 'cone' | 'cone-frustum' | 'sphere'): SolidMesh {
  const m = new Mesh()
  const back = (i: number) => i >= STEPS / 2
  if (kind === 'sphere') {
    const r = 0.5 * s
    m.ring(0, 0, r, r, STEPS, () => false)
    m.ring(0, 0, r, r * 0.34, STEPS, back)
    m.ring(0, 0, r * 0.34, r, STEPS, (i) => i >= STEPS / 4 && i < (STEPS * 3) / 4)
    return m.done()
  }
  if (kind === 'cylinder') {
    const rx = 0.48 * s
    const ry = 0.15 * s
    const bot = m.ring(0, 0.36 * s, rx, ry, STEPS, back)
    const top = m.ring(0, -0.36 * s, rx, ry, STEPS, () => false)
    m.edge(bot, top, false)
    m.edge(bot + STEPS / 2, top + STEPS / 2, false)
    m.corner(bot)
    m.corner(bot + STEPS / 2)
    m.corner(top)
    m.corner(top + STEPS / 2)
    return m.done()
  }
  if (kind === 'cone') {
    const base = m.ring(0, 0.4 * s, 0.48 * s, 0.15 * s, STEPS, back)
    const apex = m.put([0, 0.55, 0.15], s)
    m.edge(base, apex, false)
    m.edge(base + STEPS / 2, apex, false)
    m.corner(apex)
    m.corner(base)
    m.corner(base + STEPS / 2)
    return m.done()
  }
  const bot = m.ring(0, 0.4 * s, 0.5 * s, 0.15 * s, STEPS, back)
  const top = m.ring(0, -0.22 * s, 0.26 * s, 0.08 * s, STEPS, () => false)
  m.edge(bot, top, false)
  m.edge(bot + STEPS / 2, top + STEPS / 2, false)
  m.corner(bot)
  m.corner(bot + STEPS / 2)
  m.corner(top)
  m.corner(top + STEPS / 2)
  return m.done()
}

/** Lưới cạnh của một khối, kích thước khoảng `scale` pixel. */
export function solidMesh(kind: SolidKind, scale = 1): SolidMesh {
  const s = scale
  if (kind === 'cube') {
    return extruded([[-0.5, -0.5, 0], [0.5, -0.5, 0], [0.5, 0.5, 0], [-0.5, 0.5, 0]], 0.72, s)
  }
  if (kind === 'box') {
    return extruded([[-0.72, -0.4, 0], [0.72, -0.4, 0], [0.72, 0.4, 0], [-0.72, 0.4, 0]], 0.62, s)
  }
  if (kind === 'oblique-box') {
    return extruded([[-0.62, -0.4, 0], [0.62, -0.12, 0], [0.9, 0.4, 0], [-0.34, 0.4, 0]], 0.7, s)
  }
  if (kind === 'tri-prism') {
    return extruded([[-0.5, -0.4, 0], [0.5, -0.4, 0], [0, 0.48, 0]], 0.7, s)
  }
  if (kind === 'hex-prism') return extruded(hex(0.46, 0, 0), 0.62, s)
  if (kind === 'tetra') {
    return pyramid([[-0.5, -0.38, 0], [0.52, -0.34, 0.12], [0.02, -0.12, 0.72]], [0, 0.55, 0.28], s)
  }
  if (kind === 'square-pyramid') {
    return pyramid(
      [[-0.52, -0.42, 0.02], [0.52, -0.46, 0.12], [0.36, -0.12, 0.78], [-0.46, -0.08, 0.62]],
      [0, 0.58, 0.32],
      s,
    )
  }
  if (kind === 'hex-pyramid') return pyramid(hex(0.5, -0.28, 0.08), [0, 0.58, 0.4], s)
  if (kind === 'frustum') {
    const bottom: V3[] = [[-0.55, -0.42, 0], [0.55, -0.46, 0.08], [0.4, -0.16, 0.72], [-0.48, -0.12, 0.58]]
    const top: V3[] = [[-0.28, 0.28, 0.16], [0.28, 0.24, 0.22], [0.18, 0.42, 0.55], [-0.24, 0.46, 0.46]]
    const verts = [...bottom, ...top]
    const faces: number[][] = [
      [3, 2, 1, 0],
      [4, 5, 6, 7],
    ]
    for (let i = 0; i < 4; i += 1) faces.push([i, (i + 1) % 4, 4 + ((i + 1) % 4), 4 + i])
    return polyhedron(verts, faces, s)
  }
  if (kind === 'octa') {
    const verts: V3[] = [
      [0, 0.58, 0.2],
      [0, -0.58, 0.2],
      [0, 0, -0.05],
      [0.52, 0, 0.38],
      [0, 0.04, 0.78],
      [-0.52, 0, 0.32],
    ]
    return polyhedron(verts, [
      [0, 2, 3],
      [0, 3, 4],
      [0, 4, 5],
      [0, 5, 2],
      [1, 3, 2],
      [1, 4, 3],
      [1, 5, 4],
      [1, 2, 5],
    ], s)
  }
  return roundSolid(s, kind)
}

/** Số đo theo pixel. `s` là độ xiên, được âm hoặc 0. Các khóa khác là số dương. */
export type SolidMeasures = {
  a?: number
  b?: number
  c?: number
  h?: number
  s?: number
}

export const SOLID_MEASURE_KEYS: Record<SolidKind, (keyof SolidMeasures)[]> = {
  cube: ['a'],
  box: ['a', 'b', 'c'],
  'oblique-box': ['a', 'b', 'c', 's'],
  'tri-prism': ['a', 'b', 'c', 'h'],
  'hex-prism': ['a', 'h'],
  tetra: ['a'],
  'square-pyramid': ['a', 'h'],
  'hex-pyramid': ['a', 'h'],
  frustum: ['a', 'b', 'h'],
  cylinder: ['a', 'h'],
  cone: ['a', 'h'],
  'cone-frustum': ['a', 'b', 'h'],
  octa: ['a'],
  sphere: ['a'],
}

/** Ô độ xiên: số bất kỳ, kể cả 0 và âm. Trống thì null. */
export function parseSolidSlant(raw: string): number | null {
  const text = String(raw || '').trim().replace(',', '.')
  if (!text || text === '-' || text === '+' || text === '.' || text === '-.') return null
  const n = Number(text)
  if (!Number.isFinite(n)) return null
  return n
}

export function solidMeasureError(kind: SolidKind, measures: SolidMeasures): 'missing' | 'triangle' | null {
  for (const key of SOLID_MEASURE_KEYS[kind]) {
    const value = measures[key]
    if (key === 's') {
      if (value == null || !Number.isFinite(value)) return 'missing'
      continue
    }
    if (value == null || !(value > 0)) return 'missing'
  }
  if (kind === 'tri-prism') {
    const a = measures.a ?? 0
    const b = measures.b ?? 0
    const c = measures.c ?? 0
    if (a + b <= c || a + c <= b || b + c <= a) return 'triangle'
  }
  return null
}

function frontTriangle(ab: number, bc: number, ca: number): V3[] | null {
  const x = (ab * ab + ca * ca - bc * bc) / (2 * ab)
  const y2 = ca * ca - x * x
  if (!(y2 > 1e-4)) return null
  const y = Math.sqrt(y2)
  const cx = (ab + x) / 3
  const cy = y / 3
  return [
    [-cx, -cy, 0],
    [ab - cx, -cy, 0],
    [x - cx, y - cy, 0],
  ]
}

function hexBase(side: number, y: number): V3[] {
  const out: V3[] = []
  for (let i = 0; i < 6; i += 1) {
    const t = -Math.PI / 2 + (i * Math.PI) / 3
    out.push([side * Math.cos(t), y, side * Math.sin(t)])
  }
  return out
}

function roundMeasured(kind: 'cylinder' | 'cone' | 'cone-frustum', a: number, h: number, b = 0): SolidMesh {
  const m = new Mesh()
  const back = (i: number) => i < STEPS / 2
  if (kind === 'cylinder') {
    const r = a / 2
    const bot = m.ring3(0, r, STEPS, back)
    const top = m.ring3(h, r, STEPS, () => false)
    m.edge(bot, top, false)
    m.edge(bot + STEPS / 2, top + STEPS / 2, false)
    m.corner(bot)
    m.corner(bot + STEPS / 2)
    m.corner(top)
    m.corner(top + STEPS / 2)
    return m.done()
  }
  if (kind === 'cone') {
    const bot = m.ring3(0, a / 2, STEPS, back)
    const apex = m.put([0, h, 0], 1)
    m.edge(bot, apex, false)
    m.edge(bot + STEPS / 2, apex, false)
    m.corner(apex)
    m.corner(bot)
    m.corner(bot + STEPS / 2)
    return m.done()
  }
  const bot = m.ring3(0, a / 2, STEPS, back)
  const top = m.ring3(h, b / 2, STEPS, () => false)
  m.edge(bot, top, false)
  m.edge(bot + STEPS / 2, top + STEPS / 2, false)
  m.corner(bot)
  m.corner(bot + STEPS / 2)
  m.corner(top)
  m.corner(top + STEPS / 2)
  return m.done()
}

/** Dựng khối đúng số đo. Thiếu số hoặc tam giác đáy không dựng được thì null. */
export function solidFromMeasures(kind: SolidKind, measures: SolidMeasures): SolidMesh | null {
  if (solidMeasureError(kind, measures)) return null
  const a = measures.a ?? 0
  const b = measures.b ?? 0
  const c = measures.c ?? 0
  const h = measures.h ?? 0
  const s = measures.s ?? 0
  if (kind === 'cube') {
    return extruded([[-a / 2, -a / 2, 0], [a / 2, -a / 2, 0], [a / 2, a / 2, 0], [-a / 2, a / 2, 0]], a, 1)
  }
  if (kind === 'box') {
    return extruded([[-a / 2, -b / 2, 0], [a / 2, -b / 2, 0], [a / 2, b / 2, 0], [-a / 2, b / 2, 0]], c, 1)
  }
  if (kind === 'oblique-box') {
    return extruded(
      [[-a / 2, -b / 2, 0], [a / 2, -b / 2, 0], [a / 2 + s, b / 2, 0], [-a / 2 + s, b / 2, 0]],
      c,
      1,
    )
  }
  if (kind === 'tri-prism') {
    const face = frontTriangle(a, b, c)
    if (!face) return null
    return extruded(face, h, 1)
  }
  if (kind === 'hex-prism') return extruded(hex(a, 0, 0), h, 1)
  if (kind === 'tetra') {
    const height = (Math.sqrt(6) / 3) * a
    const cz = (a * Math.sqrt(3)) / 6
    return pyramid(
      [[0, 0, 0], [a, 0, 0], [a / 2, 0, (a * Math.sqrt(3)) / 2]],
      [a / 2, height, cz],
      1,
    )
  }
  if (kind === 'square-pyramid') {
    return pyramid(
      [[-a / 2, 0, -a / 2], [a / 2, 0, -a / 2], [a / 2, 0, a / 2], [-a / 2, 0, a / 2]],
      [0, h, 0],
      1,
    )
  }
  if (kind === 'hex-pyramid') return pyramid(hexBase(a, 0), [0, h, 0], 1)
  if (kind === 'frustum') {
    const verts: V3[] = [
      [-a / 2, 0, -a / 2], [a / 2, 0, -a / 2], [a / 2, 0, a / 2], [-a / 2, 0, a / 2],
      [-b / 2, h, -b / 2], [b / 2, h, -b / 2], [b / 2, h, b / 2], [-b / 2, h, b / 2],
    ]
    const faces: number[][] = [[3, 2, 1, 0], [4, 5, 6, 7]]
    for (let i = 0; i < 4; i += 1) faces.push([i, (i + 1) % 4, 4 + ((i + 1) % 4), 4 + i])
    return polyhedron(verts, faces, 1)
  }
  if (kind === 'cylinder') return roundMeasured('cylinder', a, h)
  if (kind === 'cone') return roundMeasured('cone', a, h)
  if (kind === 'cone-frustum') return roundMeasured('cone-frustum', a, h, b)
  if (kind === 'octa') {
    const edge = a / Math.SQRT2
    return polyhedron(
      [[edge, 0, 0], [-edge, 0, 0], [0, edge, 0], [0, -edge, 0], [0, 0, edge], [0, 0, -edge]],
      [
        [2, 0, 4], [2, 4, 1], [2, 1, 5], [2, 5, 0],
        [3, 4, 0], [3, 1, 4], [3, 5, 1], [3, 0, 5],
      ],
      1,
    )
  }
  return roundSolid(a, 'sphere')
}

/** Đặt khối đã có số đo sao cho tâm lưới trùng điểm bấm. */
export function placeMeasuredSolid(kind: SolidKind, at: WhiteboardPoint, measures: SolidMeasures): SolidMesh | null {
  const mesh = solidFromMeasures(kind, measures)
  if (!mesh) return null
  let x = 0
  let y = 0
  for (const p of mesh.points) {
    x += p.x
    y += p.y
  }
  const n = mesh.points.length || 1
  return {
    points: mesh.points.map((p) => ({ x: at.x + (p.x - x / n), y: at.y + (p.y - y / n) })),
    edges: mesh.edges,
    hidden: mesh.hidden,
    corners: mesh.corners,
  }
}

/** Đặt khối sao cho tâm lưới trùng điểm bấm. `cells` là cỡ mặt trước theo ô. */
export function placeSolid(kind: SolidKind, at: WhiteboardPoint, cells = 4): SolidMesh {
  const mesh = solidMesh(kind, Math.max(1, cells) * WHITEBOARD_GRID)
  let x = 0
  let y = 0
  for (const p of mesh.points) {
    x += p.x
    y += p.y
  }
  const n = mesh.points.length || 1
  return {
    points: mesh.points.map((p) => ({ x: at.x + (p.x - x / n), y: at.y + (p.y - y / n) })),
    edges: mesh.edges,
    hidden: mesh.hidden,
    corners: mesh.corners,
  }
}

/** Đỉnh góc đã lưu, hoặc suy từ cạnh nếu khối đặt trước khi có danh sách này. */
export function solidCornerIndices(points: WhiteboardPoint[], edges: number[], corners?: number[]): number[] {
  if (corners && corners.length > 0) {
    return corners.filter((index) => index >= 0 && index < points.length)
  }
  const degree = new Map<number, number>()
  const longest = new Map<number, number>()
  const lengths: number[] = []
  for (let i = 0; i + 1 < edges.length; i += 2) {
    const a = edges[i]
    const b = edges[i + 1]
    const pa = points[a]
    const pb = points[b]
    if (!pa || !pb) continue
    const len = Math.hypot(pa.x - pb.x, pa.y - pb.y)
    lengths.push(len)
    degree.set(a, (degree.get(a) ?? 0) + 1)
    degree.set(b, (degree.get(b) ?? 0) + 1)
    longest.set(a, Math.max(longest.get(a) ?? 0, len))
    longest.set(b, Math.max(longest.get(b) ?? 0, len))
  }
  const sorted = lengths.slice().sort((a, b) => a - b)
  const mid = sorted[Math.floor(sorted.length / 2)] ?? 0
  const out: number[] = []
  for (const [index, count] of degree) {
    if (count >= 3 || (count === 2 && (longest.get(index) ?? 0) > mid * 2.2)) out.push(index)
  }
  return out
}

export function solidIcon(kind: SolidKind): { viewBox: string; hidden: string; shown: string } {
  const mesh = solidMesh(kind, 100)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of mesh.points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  const pad = 8
  const path = (from: number, to: number) => {
    let d = ''
    for (let i = from; i < to; i += 2) {
      const a = mesh.points[mesh.edges[i]]
      const b = mesh.points[mesh.edges[i + 1]]
      if (!a || !b) continue
      d += `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`
    }
    return d
  }
  return {
    viewBox: `${(minX - pad).toFixed(1)} ${(minY - pad).toFixed(1)} ${(maxX - minX + pad * 2).toFixed(1)} ${(maxY - minY + pad * 2).toFixed(1)}`,
    hidden: path(0, mesh.hidden * 2),
    shown: path(mesh.hidden * 2, mesh.edges.length),
  }
}
