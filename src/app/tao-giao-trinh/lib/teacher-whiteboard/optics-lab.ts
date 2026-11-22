type Ctx = CanvasRenderingContext2D

const INK = {
  text: '#1e293b',
  muted: '#64748b',
  blue: '#2563eb',
  green: '#059669',
  amber: '#d97706',
  violet: '#7c3aed',
  sky: '#0284c7',
  glass: '#dbeafe',
  image: '#c2410c',
} as const

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n))
}

function tuneAt(tune: number[] | undefined, index: number, fallback: number) {
  const value = tune?.[index]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function ink(ctx: Ctx, color: string) {
  ctx.strokeStyle = color
  ctx.fillStyle = color
}

function textAt(ctx: Ctx, value: string, x: number, y: number, size = 13, color = '#1e293b') {
  ctx.save()
  ctx.fillStyle = color
  ctx.font = `${size}px ui-sans-serif, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(value, x, y)
  ctx.restore()
}

function arrow(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, head = 8) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  const ang = Math.atan2(y2 - y1, x2 - x1)
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - head * Math.cos(ang - 0.45), y2 - head * Math.sin(ang - 0.45))
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - head * Math.cos(ang + 0.45), y2 - head * Math.sin(ang + 0.45))
  ctx.stroke()
}

function knob(ctx: Ctx, x: number, y: number) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, 7, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = INK.sky
  ctx.lineWidth = 1.5
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function wrap01(value: number) {
  if (!Number.isFinite(value)) return 0
  const frac = value % 1
  return frac < 0 ? frac + 1 : frac
}

function unit(x: number, y: number) {
  const len = Math.hypot(x, y) || 1
  return [x / len, y / len] as const
}

function rad(deg: number) {
  return (deg * Math.PI) / 180
}

function deg(value: number) {
  return (value * 180) / Math.PI
}

/** Góc giới hạn khi n₁ > n₂. Trả về độ. */
export function criticalAngle(n1: number, n2: number) {
  const ratio = n2 / n1
  if (ratio >= 1) return 90
  return deg(Math.asin(ratio))
}

export function tirCast(n1: number, n2: number, iDeg: number) {
  const i = clamp(iDeg, 8, 78)
  const ic = criticalAngle(n1, n2)
  const sinR = (n1 / n2) * Math.sin(rad(i))
  if (sinR >= 1) return { i, ic, mode: 'reflect' as const, r: 0 }
  const r = deg(Math.asin(sinR))
  if (Math.abs(i - ic) < 0.8) return { i, ic, mode: 'critical' as const, r: 90 }
  return { i, ic, mode: 'refract' as const, r }
}

/** Dịch ngang của bản mặt song song, cùng đơn vị với bề dày. */
export function slabShift(iDeg: number, n: number, thickness: number) {
  const i = rad(clamp(iDeg, 0, 80))
  const r = Math.asin(Math.min(1, Math.sin(i) / n))
  return thickness * Math.sin(i - r) / Math.cos(r)
}

/** Lệch của lăng kính: δ = i + e − A. tir khi mặt thứ hai phản xạ toàn phần. */
export function prismBend(iDeg: number, n: number, apexDeg = 60) {
  const i = rad(iDeg)
  const apex = rad(apexDeg)
  const sinR1 = Math.sin(i) / n
  if (sinR1 > 1 || sinR1 < 0) return null
  const r1 = Math.asin(sinR1)
  const r2 = apex - r1
  if (r2 <= 0.01) return null
  const sinE = n * Math.sin(r2)
  if (sinE > 1) return { iDeg, n, tir: true as const, delta: 0, eDeg: 0 }
  const e = Math.asin(sinE)
  return { iDeg, n, tir: false as const, delta: deg(i + e - apex), eDeg: deg(e) }
}

export function fiberGuided(phiDeg: number, nCore: number, nClad: number) {
  const ic = criticalAngle(nCore, nClad)
  return 90 - phiDeg > ic + 0.05
}

export function slitSin(lambda: number, width: number) {
  return Math.min(0.92, lambda / Math.max(0.08, width))
}

export function gratingSin(order: number, lambda: number, spacing: number) {
  if (spacing <= 0) return null
  const s = (Math.abs(order) * lambda) / spacing
  if (s > 1) return null
  return s
}

export function loupeImage(ratio: number) {
  const d = clamp(ratio, 0.42, 0.9)
  const dPrime = 1 / (1 - 1 / d)
  const k = -dPrime / d
  return { d, dPrime, k, virtual: true }
}

export function microscopePower(dOverF: number) {
  const d = clamp(dOverF, 1.2, 1.75)
  const dPrime = 1 / (1 - 1 / d)
  const kObj = -dPrime / d
  const de = 0.72
  const dpe = 1 / (1 - 1 / de)
  const kEye = -dpe / de
  return { d, dPrime, kObj, de, dpe, kEye, k: kObj * kEye }
}

export function telescopeAngles(angleDeg: number, gain = 4) {
  const inn = clamp(angleDeg, 2, 7)
  return { inn, out: inn * gain, gain }
}

export const HYDROGEN_LINES = [
  { name: 'Hδ', nm: 410, color: '#7c3aed' },
  { name: 'Hγ', nm: 434, color: '#4f46e5' },
  { name: 'Hβ', nm: 486, color: '#2563eb' },
  { name: 'Hα', nm: 656, color: '#dc2626' },
] as const

export function hydrogenLinePos(nm: number) {
  return clamp((nm - 400) / 300, 0, 1)
}

const TIR_N1 = 1.5
const TIR_N2 = 1
const FIBER_CORE = 1.5
const FIBER_CLAD = 1.4

export function tirScene(w: number, h: number, tune?: number[]) {
  const hy = h * 0.5
  const hx = w * 0.56
  const i = clamp(tuneAt(tune, 0, 32), 12, 72)
  const cast = tirCast(TIR_N1, TIR_N2, i)
  const len = Math.min(92, h * 0.34)
  const ir = rad(cast.i)
  return {
    hx,
    hy,
    len,
    x1: hx - Math.sin(ir) * len,
    y1: hy + Math.cos(ir) * len,
    ...cast,
  }
}

export function tirAngleFromPoint(hx: number, hy: number, x: number, y: number) {
  return clamp(deg(Math.atan2(Math.abs(hx - x), Math.max(8, y - hy))), 12, 72)
}

function fiberPhi(tune?: number[]) {
  return clamp(tuneAt(tune, 0, 12), 6, 36)
}

export function fiberScene(w: number, h: number, tune?: number[]) {
  const phi = fiberPhi(tune)
  const ic = criticalAngle(FIBER_CORE, FIBER_CLAD)
  const guided = fiberGuided(phi, FIBER_CORE, FIBER_CLAD)
  const x0 = 48
  const x1 = w - 28
  const cy = h * 0.58
  const half = 24
  const handle = { x: x0 + Math.cos(rad(phi)) * 52, y: cy - Math.sin(rad(phi)) * 52 }
  return { phi, ic, guided, x0, x1, cy, half, top: cy - half, bot: cy + half, handle, limit: 90 - ic }
}

function drawBoundary(ctx: Ctx, w: number, h: number, tune?: number[], time = 0) {
  const s = tirScene(w, h, tune)
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(0, 0, w, s.hy)
  ctx.fillStyle = '#e0f2fe'
  ctx.fillRect(0, s.hy, w, h - s.hy)
  ink(ctx, INK.sky)
  ctx.beginPath()
  ctx.moveTo(12, s.hy)
  ctx.lineTo(w - 12, s.hy)
  ctx.stroke()
  textAt(ctx, 'không khí  n = 1', w * 0.18, s.hy - 28, 12, INK.sky)
  textAt(ctx, 'thuỷ tinh  n = 1,5', w * 0.2, s.hy + 22, 12, INK.blue)
  ctx.save()
  ctx.setLineDash([4, 3])
  ink(ctx, INK.muted)
  ctx.beginPath()
  ctx.moveTo(s.hx, s.hy - 36)
  ctx.lineTo(s.hx, s.hy + 46)
  ctx.stroke()
  const ic = rad(s.ic)
  ctx.beginPath()
  ctx.moveTo(s.hx, s.hy)
  ctx.lineTo(s.hx - Math.sin(ic) * 54, s.hy + Math.cos(ic) * 54)
  ctx.stroke()
  ctx.restore()
  ink(ctx, INK.amber)
  arrow(ctx, s.x1, s.y1, s.hx, s.hy)
  knob(ctx, s.x1, s.y1)
  textAt(ctx, `i ${s.i.toFixed(0)}°`, Math.max(36, s.x1 - 28), s.y1 - 18, 12, INK.amber)
  if (s.mode === 'reflect') {
    ink(ctx, INK.violet)
    arrow(ctx, s.hx, s.hy, s.hx + Math.sin(rad(s.i)) * s.len, s.hy + Math.cos(rad(s.i)) * s.len)
    textAt(ctx, 'phản xạ toàn phần', w * 0.62, h - 28, 13, INK.violet)
  } else if (s.mode === 'critical') {
    ink(ctx, INK.green)
    arrow(ctx, s.hx, s.hy, w - 18, s.hy)
    textAt(ctx, 'tia đi là là mặt phân cách', w * 0.62, h - 28, 13, INK.green)
  } else {
    const rr = rad(s.r)
    ink(ctx, INK.blue)
    arrow(ctx, s.hx, s.hy, s.hx + Math.sin(rr) * s.len, s.hy - Math.cos(rr) * s.len)
    textAt(ctx, `r ${s.r.toFixed(0)}°`, s.hx + 34, s.hy - 18, 12, INK.blue)
    textAt(ctx, 'khúc xạ ra không khí', w * 0.62, h - 28, 13, INK.blue)
  }
  textAt(ctx, 'Phản xạ toàn phần', 78, 16, 12, INK.text)
  textAt(ctx, `i giới hạn ${s.ic.toFixed(0)}°`, w * 0.62, h - 12, 11, INK.text)
  const pulse = wrap01(time * 0.35)
  const endX = s.mode === 'reflect' ? s.hx + Math.sin(rad(s.i)) * s.len : s.mode === 'critical' ? w - 18 : s.hx + Math.sin(rad(s.r)) * s.len
  const endY = s.mode === 'reflect' ? s.hy + Math.cos(rad(s.i)) * s.len : s.mode === 'critical' ? s.hy : s.hy - Math.cos(rad(s.r)) * s.len
  const fromX = pulse < 0.5 ? s.x1 : s.hx
  const fromY = pulse < 0.5 ? s.y1 : s.hy
  const toX = pulse < 0.5 ? s.hx : endX
  const toY = pulse < 0.5 ? s.hy : endY
  const t = pulse < 0.5 ? pulse / 0.5 : (pulse - 0.5) / 0.5
  ink(ctx, INK.amber)
  ctx.beginPath()
  ctx.arc(fromX + (toX - fromX) * t, fromY + (toY - fromY) * t, 3.4, 0, Math.PI * 2)
  ctx.fill()
}

function fiberPath(scene: ReturnType<typeof fiberScene>) {
  const phi = rad(scene.phi)
  let x = scene.x0
  let y = scene.cy
  let vx = Math.cos(phi)
  let vy = -Math.sin(phi)
  const pts: Array<[number, number]> = [[x, y]]
  let leaked = false
  for (let step = 0; step < 8 && x < scene.x1 - 1; step += 1) {
    const wall = vy < 0 ? scene.top : scene.bot
    if (Math.abs(vy) < 1e-4) {
      pts.push([scene.x1, y])
      break
    }
    const t = (wall - y) / vy
    if (t <= 0) break
    const nx = x + vx * t
    if (nx >= scene.x1) {
      const tEnd = (scene.x1 - x) / Math.max(0.05, vx)
      pts.push([scene.x1, y + vy * tEnd])
      break
    }
    x = nx
    y = wall
    pts.push([x, y])
    if (!scene.guided) {
      const iWall = rad(90 - scene.phi)
      const r = Math.asin(Math.min(1, (FIBER_CORE / FIBER_CLAD) * Math.sin(iWall)))
      const out = wall === scene.top ? -1 : 1
      pts.push([x + Math.sin(r) * 110, y + out * Math.cos(r) * 110])
      leaked = true
      break
    }
    vy = -vy
  }
  return { pts, leaked }
}

function drawFiber(ctx: Ctx, w: number, h: number, tune?: number[]) {
  const s = fiberScene(w, h, tune)
  const path = fiberPath(s)
  ctx.fillStyle = '#e0f2fe'
  ctx.strokeStyle = INK.sky
  ctx.fillRect(s.x0 - 8, s.top - 16, s.x1 - s.x0 + 16, s.half * 2 + 32)
  ctx.strokeRect(s.x0 - 8, s.top - 16, s.x1 - s.x0 + 16, s.half * 2 + 32)
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(s.x0, s.top, s.x1 - s.x0, s.half * 2)
  ctx.strokeRect(s.x0, s.top, s.x1 - s.x0, s.half * 2)
  textAt(ctx, 'vỏ n = 1,40', s.x1 - 62, s.top - 26, 11, INK.sky)
  textAt(ctx, 'lõi n = 1,50', s.x1 - 48, s.bot + 14, 11, INK.blue)
  ink(ctx, path.leaked ? INK.image : INK.amber)
  ctx.beginPath()
  const first = path.pts[0]
  if (first) ctx.moveTo(first[0], first[1])
  for (const pt of path.pts) ctx.lineTo(pt[0], pt[1])
  ctx.stroke()
  const last = path.pts[path.pts.length - 1]
  const prev = path.pts[path.pts.length - 2]
  if (last && prev) arrow(ctx, prev[0], prev[1], last[0], last[1])
  knob(ctx, s.handle.x, s.handle.y)
  if (path.leaked && last) textAt(ctx, 'lọt', last[0] + 16, last[1] - 12, 11, INK.image)
  textAt(ctx, 'Cáp quang', 64, 16, 12, INK.text)
  textAt(ctx, `góc với trục ${s.phi.toFixed(0)}°`, w * 0.3, h - 28, 12, INK.text)
  textAt(ctx, path.leaked ? 'tia lọt ra vỏ' : `phản xạ toàn phần, giới hạn ${s.limit.toFixed(0)}°`, w * 0.62, h - 14, 12, path.leaked ? INK.image : INK.violet)
}

export function drawTir(ctx: Ctx, w: number, h: number, variant: string, tune?: number[], time = 0) {
  if (variant === 'fiber') drawFiber(ctx, w, h, tune)
  else drawBoundary(ctx, w, h, tune, time)
}

export function slabScene(w: number, h: number, tune?: number[]) {
  const face1 = w * 0.4
  const face2 = w * 0.66
  const thickness = face2 - face1
  const i = clamp(tuneAt(tune, 0, 42), 16, 66)
  const n = 1.5
  const r = deg(Math.asin(Math.sin(rad(i)) / n))
  const shift = slabShift(i, n, thickness)
  const yHit = h * 0.36
  const ir = rad(i)
  const rr = rad(r)
  const len = 74
  const yExit = yHit + thickness * Math.tan(rr)
  const yStraight = yHit + thickness * Math.tan(ir)
  return {
    face1,
    face2,
    thickness,
    i,
    r,
    n,
    shift,
    yHit,
    yExit,
    yStraight,
    x0: face1 - Math.cos(ir) * len,
    y0: yHit - Math.sin(ir) * len,
    x3: Math.min(w - 16, face2 + Math.cos(ir) * 78),
    y3: yExit + Math.sin(ir) * 78,
  }
}

export function drawSlab(ctx: Ctx, w: number, h: number, tune?: number[], time = 0) {
  const s = slabScene(w, h, tune)
  ctx.fillStyle = '#e0f2fe'
  ctx.strokeStyle = INK.sky
  ctx.fillRect(s.face1, 28, s.thickness, h - 56)
  ctx.strokeRect(s.face1, 28, s.thickness, h - 56)
  textAt(ctx, 'không khí', 58, h * 0.72, 11, INK.muted)
  textAt(ctx, 'thuỷ tinh', (s.face1 + s.face2) / 2, 42, 11, INK.blue)
  textAt(ctx, 'không khí', (s.face2 + w) / 2, 42, 11, INK.muted)
  ctx.save()
  ctx.setLineDash([5, 3])
  ink(ctx, INK.muted)
  ctx.beginPath()
  ctx.moveTo(s.x0, s.y0)
  ctx.lineTo(s.face2 + 70, s.yStraight + Math.tan(rad(s.i)) * 70)
  ctx.stroke()
  ctx.restore()
  ink(ctx, INK.amber)
  arrow(ctx, s.x0, s.y0, s.face1, s.yHit)
  knob(ctx, s.x0, s.y0)
  ink(ctx, INK.blue)
  ctx.beginPath()
  ctx.moveTo(s.face1, s.yHit)
  ctx.lineTo(s.face2, s.yExit)
  ctx.stroke()
  ink(ctx, INK.green)
  arrow(ctx, s.face2, s.yExit, s.x3, s.y3)
  const midX = s.face2 + 18
  const midStraight = s.yStraight + Math.tan(rad(s.i)) * 18
  const midExit = s.yExit + Math.sin(rad(s.i)) * 18
  ink(ctx, INK.image)
  ctx.beginPath()
  ctx.moveTo(midX, midStraight)
  ctx.lineTo(midX, midExit)
  ctx.stroke()
  textAt(ctx, `i ${s.i.toFixed(0)}°`, s.x0 - 22, s.y0 < 52 ? s.y0 + 18 : s.y0 - 16, 12, INK.amber)
  textAt(ctx, `r ${s.r.toFixed(0)}°`, s.face1 + 22, Math.min(s.yHit, s.yExit) - 14, 12, INK.blue)
  textAt(ctx, 'Bản mặt song song', 92, 16, 12, INK.text)
  textAt(ctx, `tia ló song song tia tới, dịch ${s.shift.toFixed(0)}`, w * 0.58, h - 12, 12, INK.image)
  const pulse = wrap01(time * 0.33)
  const stops = [[s.x0, s.y0], [s.face1, s.yHit], [s.face2, s.yExit], [s.x3, s.y3]]
  const travel = pulse * (stops.length - 1)
  const index = Math.min(stops.length - 2, Math.floor(travel))
  const a = stops[index]
  const b = stops[index + 1]
  if (a && b) {
    const t = travel - index
    ink(ctx, INK.amber)
    ctx.beginPath()
    ctx.arc(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 3.4, 0, Math.PI * 2)
    ctx.fill()
  }
}

const PRISM_COLORS = [
  { name: 'đỏ', n: 1.5, color: '#dc2626' },
  { name: 'cam', n: 1.53, color: '#ea580c' },
  { name: 'vàng', n: 1.55, color: '#ca8a04' },
  { name: 'lục', n: 1.58, color: '#16a34a' },
  { name: 'lam', n: 1.61, color: '#2563eb' },
  { name: 'tím', n: 1.64, color: '#7c3aed' },
] as const

export function prismFrame(w: number, h: number) {
  const half = Math.min(58, w * 0.15, (h * 0.4) / Math.sqrt(3))
  const height = half * Math.sqrt(3)
  const cx = w * 0.42
  const bot = Math.min(h - 40, h * 0.76)
  const apex = { x: cx, y: bot - height }
  const left = { x: cx - half, y: bot }
  const right = { x: cx + half, y: bot }
  const entry = { x: (apex.x + left.x) / 2, y: (apex.y + left.y) / 2 }
  return {
    half,
    apex,
    left,
    right,
    entry,
    nx: -Math.sqrt(3) / 2,
    ny: -0.5,
    rx: Math.sqrt(3) / 2,
    ry: -0.5,
  }
}

function rayOnSegment(x: number, y: number, dx: number, dy: number, ax: number, ay: number, bx: number, by: number) {
  const sx = bx - ax
  const sy = by - ay
  const den = dx * sy - dy * sx
  if (Math.abs(den) < 1e-8) return null
  const t = ((ax - x) * sy - (ay - y) * sx) / den
  const u = ((ax - x) * dy - (ay - y) * dx) / den
  if (t <= 0.5 || u < -0.04 || u > 1.04) return null
  return { x: x + dx * t, y: y + dy * t }
}

function refractDir(dx: number, dy: number, nx: number, ny: number, n1: number, n2: number) {
  let [ix, iy] = unit(dx, dy)
  let [nnx, nny] = unit(nx, ny)
  let cosI = -(ix * nnx + iy * nny)
  if (cosI < 0) {
    nnx = -nnx
    nny = -nny
    cosI = -cosI
  }
  const eta = n1 / n2
  const k = 1 - eta * eta * (1 - cosI * cosI)
  if (k < 0) return null
  const cosT = Math.sqrt(k)
  return unit(eta * ix + (eta * cosI - cosT) * nnx, eta * iy + (eta * cosI - cosT) * nny)
}

export function tracePrism(iDeg: number, n: number, w = 400, h = 250) {
  const frame = prismFrame(w, h)
  const i = clamp(iDeg, 40, 68)
  const into = unit(-frame.nx, -frame.ny)
  const c = Math.cos(rad(i))
  const s = Math.sin(rad(i))
  const dx = into[0] * c + into[1] * s
  const dy = -into[0] * s + into[1] * c
  const inside = refractDir(dx, dy, frame.nx, frame.ny, 1, n)
  if (!inside) return null
  const hit = rayOnSegment(frame.entry.x, frame.entry.y, inside[0], inside[1], frame.apex.x, frame.apex.y, frame.right.x, frame.right.y)
  if (!hit) return null
  const out = refractDir(inside[0], inside[1], frame.rx, frame.ry, n, 1)
  if (!out) return { tir: true as const, i, hit, dx, dy, inside }
  const dot = dx * out[0] + dy * out[1]
  const delta = deg(Math.acos(clamp(dot, -1, 1)))
  return { tir: false as const, i, hit, dx, dy, inside, out, delta }
}

export function prismRayDelta(iDeg: number, n: number) {
  const cast = tracePrism(iDeg, n)
  if (!cast || cast.tir) return null
  return cast.delta
}

function toEdge(x: number, y: number, dx: number, dy: number, w: number, h: number) {
  let t = 800
  if (dx > 1e-4) t = Math.min(t, (w - 10 - x) / dx)
  if (dx < -1e-4) t = Math.min(t, (10 - x) / dx)
  if (dy > 1e-4) t = Math.min(t, (h - 32 - y) / dy)
  if (dy < -1e-4) t = Math.min(t, (26 - y) / dy)
  return [x + dx * Math.max(12, t), y + dy * Math.max(12, t)] as const
}

export function prismHandle(w: number, h: number, tune?: number[]) {
  const frame = prismFrame(w, h)
  const cast = tracePrism(tuneAt(tune, 0, 50), PRISM_COLORS[0].n, w, h)
  const dir = cast ? [cast.dx, cast.dy] as const : unit(-frame.nx, -frame.ny)
  return { x: frame.entry.x - dir[0] * 68, y: frame.entry.y - dir[1] * 68 }
}

export function prismAngleFromPoint(w: number, h: number, x: number, y: number) {
  const frame = prismFrame(w, h)
  const dir = unit(frame.entry.x - x, frame.entry.y - y)
  const into = unit(-frame.nx, -frame.ny)
  const signed = Math.atan2(into[0] * dir[1] - into[1] * dir[0], into[0] * dir[0] + into[1] * dir[1])
  return clamp(deg(-signed), 40, 68)
}

export function drawPrismSpectrum(ctx: Ctx, w: number, h: number, tune?: number[], time = 0) {
  const frame = prismFrame(w, h)
  const iDeg = clamp(tuneAt(tune, 0, 50), 40, 68)
  ctx.beginPath()
  ctx.moveTo(frame.apex.x, frame.apex.y)
  ctx.lineTo(frame.right.x, frame.right.y)
  ctx.lineTo(frame.left.x, frame.left.y)
  ctx.closePath()
  ctx.fillStyle = '#e0f2fe'
  ctx.strokeStyle = INK.sky
  ctx.fill()
  ctx.stroke()
  textAt(ctx, 'A = 60°', frame.apex.x, frame.apex.y - 12, 11, INK.muted)
  const rays = PRISM_COLORS.map((color) => ({ ...color, cast: tracePrism(iDeg, color.n, w, h) }))
  const sample = rays[0]?.cast
  if (sample) {
    const tail = prismHandle(w, h, [iDeg])
    ink(ctx, '#94a3b8')
    arrow(ctx, tail.x, tail.y, frame.entry.x, frame.entry.y)
    knob(ctx, tail.x, tail.y)
    textAt(ctx, 'trắng', tail.x, tail.y - 14, 11, INK.muted)
  }
  for (const ray of rays) {
    const cast = ray.cast
    if (!cast) continue
    ctx.strokeStyle = ray.color
    ctx.beginPath()
    ctx.moveTo(frame.entry.x, frame.entry.y)
    ctx.lineTo(cast.hit.x, cast.hit.y)
    ctx.stroke()
    if (cast.tir || !('out' in cast) || !cast.out) {
      textAt(ctx, 'toàn phần', cast.hit.x + 20, cast.hit.y, 10, ray.color)
      continue
    }
    const [ex, ey] = toEdge(cast.hit.x, cast.hit.y, cast.out[0], cast.out[1], w, h)
    ctx.beginPath()
    ctx.moveTo(cast.hit.x, cast.hit.y)
    ctx.lineTo(ex, ey)
    ctx.stroke()
  }
  const red = rays[0]
  const violet = rays[rays.length - 1]
  if (red?.cast && !red.cast.tir && 'out' in red.cast && red.cast.out) {
    const [ex, ey] = toEdge(red.cast.hit.x, red.cast.hit.y, red.cast.out[0], red.cast.out[1], w, h)
    textAt(ctx, 'đỏ', ex - 16, ey - 10, 11, red.color)
  }
  if (violet?.cast && !violet.cast.tir && 'out' in violet.cast && violet.cast.out) {
    const [ex, ey] = toEdge(violet.cast.hit.x, violet.cast.hit.y, violet.cast.out[0], violet.cast.out[1], w, h)
    textAt(ctx, 'tím', ex - 16, ey + 12, 11, violet.color)
  }
  const redDelta = red?.cast && !red.cast.tir && 'delta' in red.cast ? red.cast.delta : null
  const violetDelta = violet?.cast && !violet.cast.tir && 'delta' in violet.cast ? violet.cast.delta : null
  textAt(ctx, 'Lăng kính tán sắc', 84, 16, 12, INK.text)
  const note = redDelta != null && violetDelta != null
    ? `i ${iDeg.toFixed(0)}°   lệch đỏ ${redDelta.toFixed(0)}°   tím ${violetDelta.toFixed(0)}°`
    : `i ${iDeg.toFixed(0)}°`
  textAt(ctx, note, w * 0.48, h - 12, 11, INK.text)
  if (sample && !sample.tir) {
    const pulse = wrap01(time * 0.3)
    const tail = prismHandle(w, h, [iDeg])
    const ax = pulse < 0.45 ? tail.x : frame.entry.x
    const ay = pulse < 0.45 ? tail.y : frame.entry.y
    const bx = pulse < 0.45 ? frame.entry.x : sample.hit.x
    const by = pulse < 0.45 ? frame.entry.y : sample.hit.y
    const t = pulse < 0.45 ? pulse / 0.45 : (pulse - 0.45) / 0.55
    ink(ctx, INK.amber)
    ctx.beginPath()
    ctx.arc(ax + (bx - ax) * t, ay + (by - ay) * t, 3.2, 0, Math.PI * 2)
    ctx.fill()
  }
}

type EyeKind = 'normal' | 'myopia' | 'hyper' | 'loupe' | 'micro' | 'tele'

function eyeKindOf(variant: string): EyeKind {
  if (variant === 'myopia' || variant === 'hyper' || variant === 'loupe' || variant === 'micro' || variant === 'tele') return variant
  return 'normal'
}

function eyeObjectX(box: { cx: number; rx: number }, near: number) {
  const farX = 40
  const nearX = box.cx - box.rx - 28
  return farX + (1 - near) * Math.max(24, nearX - farX)
}

function eyeBox(w: number, h: number, kind: EyeKind) {
  const cy = h * 0.5
  const cx = w * 0.66
  const rx = kind === 'myopia' ? Math.min(116, w * 0.22) : kind === 'hyper' ? Math.min(72, w * 0.15) : Math.min(92, w * 0.18)
  const ry = Math.min(58, h * 0.24)
  const lensX = cx - rx * 0.42
  const retinaX = cx + rx - 10
  const glassX = cx - rx - 52
  return { cx, cy, rx, ry, lensX, retinaX, glassX }
}

function drawEyeball(ctx: Ctx, box: ReturnType<typeof eyeBox>, bulge: number) {
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(box.cx, box.cy, box.rx, box.ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#f8fafc'
  ctx.strokeStyle = INK.sky
  ctx.lineWidth = 2
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.strokeStyle = INK.violet
  ctx.lineWidth = 3
  ctx.ellipse(box.cx + 4, box.cy, box.rx - 10, box.ry - 8, 0, -1.05, 1.05, false)
  ctx.stroke()
  ctx.beginPath()
  ctx.strokeStyle = INK.sky
  ctx.lineWidth = 2
  ctx.arc(box.cx - box.rx + 10, box.cy, box.ry * 0.72, Math.PI * 0.62, Math.PI * 1.38, true)
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(box.lensX, box.cy, 8 + bulge, 18 + bulge * 0.4, 0, 0, Math.PI * 2)
  ctx.fillStyle = INK.glass
  ctx.fill()
  ctx.stroke()
  ctx.restore()
  textAt(ctx, 'võng mạc', box.retinaX - 6, box.cy - box.ry - 12, 11, INK.violet)
  textAt(ctx, 'thể thủy tinh', box.lensX, box.cy + box.ry + 14, 10, INK.sky)
}

function lineY(x1: number, y1: number, x2: number, y2: number, x: number) {
  const den = x2 - x1 || 1
  return y1 + ((x - x1) * (y2 - y1)) / den
}

function drawCorrector(ctx: Ctx, x: number, y: number, converging: boolean) {
  ctx.save()
  ctx.strokeStyle = INK.sky
  ctx.fillStyle = INK.glass
  ctx.beginPath()
  if (converging) {
    ctx.moveTo(x, y - 28)
    ctx.quadraticCurveTo(x + 12, y, x, y + 28)
    ctx.quadraticCurveTo(x - 12, y, x, y - 28)
  } else {
    ctx.moveTo(x - 9, y - 28)
    ctx.lineTo(x + 9, y - 28)
    ctx.quadraticCurveTo(x + 2, y, x + 9, y + 28)
    ctx.lineTo(x - 9, y + 28)
    ctx.quadraticCurveTo(x - 2, y, x - 9, y - 28)
  }
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function drawSight(ctx: Ctx, w: number, h: number, kind: 'normal' | 'myopia' | 'hyper', tune?: number[]) {
  const box = eyeBox(w, h, kind)
  const worn = kind === 'normal' ? false : tuneAt(tune, 0, 1) >= 0.5
  const near = kind === 'normal' ? clamp(tuneAt(tune, 0, 0.72), 0.32, 1) : 0.78
  const bulge = kind === 'normal' ? (1 - near) * 10 : 5
  const ox = kind === 'normal' ? eyeObjectX(box, near) : 46
  const objH = 34
  const oy = box.cy - objH
  const focusX = kind === 'normal' || worn ? box.retinaX : kind === 'myopia' ? box.retinaX - 44 : box.retinaX + 42
  const meetY = lineY(ox, oy, box.lensX, box.cy, focusX)
  const at = (x: number, x1: number, y1: number) => lineY(x1, y1, focusX, meetY, x)
  ink(ctx, INK.muted)
  ctx.beginPath()
  ctx.moveTo(24, box.cy)
  ctx.lineTo(w - 16, box.cy)
  ctx.stroke()
  if (worn) drawCorrector(ctx, box.glassX, box.cy, kind === 'hyper')
  drawEyeball(ctx, box, bulge)
  const bend = worn ? (kind === 'myopia' ? -10 : 8) : 0
  const lensY = worn ? oy + bend : oy
  ink(ctx, INK.amber)
  ctx.beginPath()
  ctx.moveTo(ox, oy)
  ctx.lineTo(worn ? box.glassX : box.lensX, oy)
  if (worn) ctx.lineTo(box.lensX, lensY)
  ctx.lineTo(Math.min(focusX, box.retinaX), at(Math.min(focusX, box.retinaX), box.lensX, lensY))
  if (focusX < box.retinaX) ctx.lineTo(box.retinaX, at(box.retinaX, box.lensX, lensY))
  ctx.stroke()
  ink(ctx, INK.blue)
  ctx.beginPath()
  ctx.moveTo(ox, oy)
  ctx.lineTo(box.lensX, box.cy)
  ctx.lineTo(Math.min(focusX, box.retinaX), at(Math.min(focusX, box.retinaX), box.lensX, box.cy))
  if (focusX < box.retinaX) ctx.lineTo(box.retinaX, at(box.retinaX, box.lensX, box.cy))
  ctx.stroke()
  if (focusX < box.retinaX) {
    const yA = at(box.retinaX, box.lensX, lensY)
    const yB = at(box.retinaX, box.lensX, box.cy)
    ink(ctx, INK.image)
    ctx.beginPath()
    ctx.moveTo(box.retinaX, Math.min(yA, yB))
    ctx.lineTo(box.retinaX, Math.max(yA, yB))
    ctx.stroke()
    textAt(ctx, 'ảnh mờ', Math.min(w - 36, box.retinaX + 4), box.cy + box.ry + 28, 11, INK.image)
  }
  if (focusX > box.retinaX) {
    ctx.save()
    ctx.setLineDash([4, 3])
    ink(ctx, INK.violet)
    ctx.beginPath()
    ctx.moveTo(box.retinaX, at(box.retinaX, box.lensX, lensY))
    ctx.lineTo(focusX, meetY)
    ctx.moveTo(box.retinaX, at(box.retinaX, box.lensX, box.cy))
    ctx.lineTo(focusX, meetY)
    ctx.stroke()
    ctx.restore()
    textAt(ctx, 'ảnh sau mắt', Math.min(w - 52, focusX + 6), box.cy + box.ry + 28, 11, INK.violet)
  }
  ink(ctx, INK.blue)
  arrow(ctx, ox, box.cy, ox, oy)
  textAt(ctx, 'vật', ox, oy - 14, 11, INK.blue)
  if (kind === 'normal') knob(ctx, ox, oy)
  else {
    knob(ctx, worn ? box.glassX : box.glassX - 46, box.cy)
    if (!worn) textAt(ctx, 'kính', box.glassX - 46, box.cy + 20, 10, INK.sky)
  }
  const title = kind === 'normal' ? 'Mắt thường' : kind === 'myopia' ? 'Mắt cận' : 'Mắt viễn'
  textAt(ctx, title, 64, 16, 12, INK.text)
  const note = kind === 'normal'
    ? (near > 0.65 ? 'nhìn xa, thể thủy tinh dẹt' : 'nhìn gần, thể thủy tinh phồng')
    : worn
      ? (kind === 'myopia' ? 'kính phân kỳ, ảnh trên võng mạc' : 'kính hội tụ, ảnh trên võng mạc')
      : (kind === 'myopia' ? 'chưa đeo kính, ảnh trước võng mạc' : 'chưa đeo kính, ảnh sau võng mạc')
  textAt(ctx, note, w * 0.48, h - 14, 12, worn || kind === 'normal' ? INK.green : INK.image)
}

function loupePose(w: number, h: number, tune?: number[]) {
  const cx = w * 0.52
  const cy = h * 0.55
  const focal = 96
  const d = clamp(tuneAt(tune, 0, 0.58), 0.5, 0.8)
  const image = loupeImage(d)
  const maxFrac = Math.max(0.06, Math.min(0.16, (cy - 40) / (Math.max(1.2, image.k) * h)))
  const objFrac = clamp(tuneAt(tune, 1, 0.1), 0.06, maxFrac)
  const objH = objFrac * h
  return {
    ...image,
    cx,
    cy,
    f: focal,
    objFrac,
    maxFrac,
    ox: cx - image.d * focal,
    oy: cy - objH,
    ix: cx + image.dPrime * focal,
    iy: cy - image.k * objH,
  }
}

function drawLoupe(ctx: Ctx, w: number, h: number, tune?: number[]) {
  const s = loupePose(w, h, tune)
  const far = w - 18
  ink(ctx, INK.muted)
  arrow(ctx, 16, s.cy, far, s.cy)
  drawCorrector(ctx, s.cx, s.cy, true)
  ink(ctx, INK.amber)
  ctx.beginPath()
  ctx.arc(s.cx - s.f, s.cy, 2.4, 0, Math.PI * 2)
  ctx.arc(s.cx + s.f, s.cy, 2.4, 0, Math.PI * 2)
  ctx.fill()
  textAt(ctx, 'F', s.cx - s.f, s.cy - 14, 11, INK.amber)
  textAt(ctx, "F'", s.cx + s.f, s.cy + 14, 11, INK.amber)
  ink(ctx, INK.blue)
  arrow(ctx, s.ox, s.cy, s.ox, s.oy)
  knob(ctx, s.ox, s.oy)
  textAt(ctx, 'vật', s.ox - 18, s.oy - 12, 11, INK.blue)
  ink(ctx, INK.amber)
  ctx.beginPath()
  ctx.moveTo(s.ox, s.oy)
  ctx.lineTo(s.cx, s.oy)
  ctx.lineTo(far, lineY(s.cx, s.oy, s.cx + s.f, s.cy, far))
  ctx.stroke()
  ink(ctx, INK.blue)
  ctx.beginPath()
  ctx.moveTo(s.ox, s.oy)
  ctx.lineTo(far, lineY(s.ox, s.oy, s.cx, s.cy, far))
  ctx.stroke()
  ctx.save()
  ctx.setLineDash([5, 3])
  ink(ctx, INK.violet)
  ctx.beginPath()
  ctx.moveTo(s.cx, s.oy)
  ctx.lineTo(s.ix, s.iy)
  ctx.moveTo(s.cx, s.cy)
  ctx.lineTo(s.ix, s.iy)
  ctx.stroke()
  arrow(ctx, s.ix, s.cy, s.ix, s.iy)
  ctx.restore()
  textAt(ctx, 'ảnh ảo', s.ix, Math.max(28, s.iy - 14), 11, INK.violet)
  textAt(ctx, 'Kính lúp', 58, 16, 12, INK.text)
  textAt(ctx, `vật trong tiêu cự   k ${s.k.toFixed(1)}`, w * 0.42, h - 14, 12, INK.violet)
}

function microscopeFrame(w: number, h: number, tune?: number[]) {
  const power = microscopePower(tuneAt(tune, 0, 1.45))
  const cy = h * 0.5
  const fObj = 34
  const objX = w * 0.38
  const scale = Math.min(12, (h * 0.26) / Math.max(1, Math.abs(power.k)))
  const ix = objX + power.dPrime * fObj
  const fEye = 52
  return {
    power,
    cy,
    fObj,
    objX,
    ox: objX - power.d * fObj,
    oy: cy - scale,
    ix,
    iy: cy + Math.abs(power.kObj) * scale,
    eyeX: ix + power.de * fEye,
    virtX: ix + power.de * fEye + power.dpe * fEye,
    virtY: cy + Math.abs(power.k) * scale,
  }
}

function drawMicroscope(ctx: Ctx, w: number, h: number, tune?: number[]) {
  const s = microscopeFrame(w, h, tune)
  const virtX = s.virtX < s.ox - 30 ? s.virtX : Math.max(28, s.ox - 64)
  const virtY = Math.min(h - 42, Math.max(s.cy + 48, s.virtY))
  const far = w - 16
  ink(ctx, INK.muted)
  ctx.beginPath()
  ctx.moveTo(16, s.cy)
  ctx.lineTo(far, s.cy)
  ctx.stroke()
  drawCorrector(ctx, s.objX, s.cy, true)
  drawCorrector(ctx, s.eyeX, s.cy, true)
  textAt(ctx, 'vật kính', s.objX, s.cy - 36, 11, INK.sky)
  textAt(ctx, 'thị kính', s.eyeX, s.cy - 36, 11, INK.sky)
  ink(ctx, INK.amber)
  ctx.beginPath()
  ctx.moveTo(s.ox, s.oy)
  ctx.lineTo(s.objX, s.oy)
  ctx.lineTo(s.ix, s.iy)
  ctx.moveTo(s.ox, s.oy)
  ctx.lineTo(s.objX, s.cy)
  ctx.lineTo(s.ix, s.iy)
  ctx.stroke()
  ink(ctx, INK.green)
  ctx.beginPath()
  ctx.moveTo(s.ix, s.iy)
  ctx.lineTo(s.eyeX, s.iy)
  ctx.lineTo(far, lineY(virtX, virtY, s.eyeX, s.iy, far))
  ctx.moveTo(s.ix, s.iy)
  ctx.lineTo(s.eyeX, s.cy)
  ctx.lineTo(far, lineY(virtX, virtY, s.eyeX, s.cy, far))
  ctx.stroke()
  ink(ctx, INK.blue)
  arrow(ctx, s.ox, s.cy, s.ox, s.oy)
  knob(ctx, s.ox, s.oy)
  ink(ctx, INK.image)
  arrow(ctx, s.ix, s.cy, s.ix, s.iy)
  textAt(ctx, 'ảnh trung gian', s.ix - 34, Math.min(h - 32, s.iy + 16), 10, INK.image)
  ctx.save()
  ctx.setLineDash([4, 3])
  ink(ctx, INK.violet)
  ctx.beginPath()
  ctx.moveTo(s.eyeX, s.iy)
  ctx.lineTo(virtX, virtY)
  ctx.moveTo(s.eyeX, s.cy)
  ctx.lineTo(virtX, virtY)
  ctx.stroke()
  arrow(ctx, virtX, s.cy, virtX, virtY)
  ctx.restore()
  textAt(ctx, 'ảnh ảo', virtX, Math.max(28, s.cy - 16), 11, INK.violet)
  textAt(ctx, 'Kính hiển vi', 70, 16, 12, INK.text)
  textAt(ctx, `ảnh cuối ngược chiều   |k| ${Math.abs(s.power.k).toFixed(1)}`, w * 0.5, h - 14, 12, INK.violet)
}

function telescopeFrame(w: number, h: number, tune?: number[]) {
  const gain = 4
  const angles = telescopeAngles(tuneAt(tune, 0, 4), gain)
  const cy = h * 0.56
  const f1 = 78
  const objX = w * 0.42
  const focusX = objX + f1
  const eyeX = focusX + f1 / gain
  const slopeIn = Math.tan(rad(angles.inn))
  const lift = 22
  return {
    angles,
    gain,
    cy,
    objX,
    focusX,
    focusY: cy + f1 * slopeIn,
    eyeX,
    slopeIn,
    slopeOut: -slopeIn * gain,
    lift,
    handle: { x: 28, y: cy - lift - (objX - 28) * slopeIn },
  }
}

function drawTelescope(ctx: Ctx, w: number, h: number, tune?: number[]) {
  const s = telescopeFrame(w, h, tune)
  const yIn = (x: number, yLens: number) => yLens - (s.objX - x) * s.slopeIn
  ink(ctx, INK.muted)
  ctx.beginPath()
  ctx.moveTo(16, s.cy)
  ctx.lineTo(w - 12, s.cy)
  ctx.stroke()
  drawCorrector(ctx, s.objX, s.cy, true)
  drawCorrector(ctx, s.eyeX, s.cy, true)
  textAt(ctx, 'vật kính', s.objX, s.cy + 42, 11, INK.sky)
  textAt(ctx, 'thị kính', s.eyeX, s.cy + 42, 11, INK.sky)
  ink(ctx, INK.amber)
  ctx.beginPath()
  ctx.arc(s.focusX, s.cy, 2.4, 0, Math.PI * 2)
  ctx.fill()
  textAt(ctx, 'F', s.focusX - 14, s.cy - 16, 11, INK.amber)
  ink(ctx, INK.blue)
  ctx.beginPath()
  ctx.moveTo(28, yIn(28, s.cy))
  ctx.lineTo(s.objX, s.cy)
  ctx.lineTo(s.focusX, s.focusY)
  ctx.moveTo(s.handle.x, s.handle.y)
  ctx.lineTo(s.objX, s.cy - s.lift)
  ctx.lineTo(s.focusX, s.focusY)
  ctx.stroke()
  knob(ctx, s.handle.x, s.handle.y)
  const yLens2 = s.cy + 16
  const yAtEye = lineY(s.focusX, s.focusY, s.eyeX, yLens2, s.eyeX)
  ink(ctx, INK.green)
  ctx.beginPath()
  ctx.moveTo(s.focusX, s.focusY)
  ctx.lineTo(s.eyeX, s.cy)
  ctx.lineTo(w - 16, s.cy + (w - 16 - s.eyeX) * s.slopeOut)
  ctx.moveTo(s.focusX, s.focusY)
  ctx.lineTo(s.eyeX, yAtEye)
  ctx.lineTo(w - 16, yAtEye + (w - 16 - s.eyeX) * s.slopeOut)
  ctx.stroke()
  textAt(ctx, 'Kính thiên văn', 78, 16, 12, INK.text)
  textAt(ctx, `tia tới ${s.angles.inn.toFixed(0)}°   tia ló ${s.angles.out.toFixed(0)}°   G = ${s.gain}`, w * 0.5, h - 14, 12, INK.green)
}

export function drawEyeLab(ctx: Ctx, w: number, h: number, variant: string, tune?: number[]) {
  const kind = eyeKindOf(variant)
  if (kind === 'loupe') drawLoupe(ctx, w, h, tune)
  else if (kind === 'micro') drawMicroscope(ctx, w, h, tune)
  else if (kind === 'tele') drawTelescope(ctx, w, h, tune)
  else drawSight(ctx, w, h, kind, tune)
}

function wavePaint(lambda: number) {
  const t = clamp((lambda - 0.42) / 0.26, 0, 1)
  if (t < 0.25) return '#4f46e5'
  if (t < 0.45) return '#0284c7'
  if (t < 0.62) return '#16a34a'
  if (t < 0.8) return '#ca8a04'
  return '#dc2626'
}

export function diffractScene(w: number, h: number, grating: boolean, tune?: number[]) {
  const lambda = clamp(tuneAt(tune, 1, 0.55), 0.42, 0.68)
  const slitX = w * 0.34
  const screenX = w * 0.7
  const cy = h * 0.52
  const span = h * 0.34
  if (grating) {
    const spacing = clamp(tuneAt(tune, 0, 0.62), 0.3, 1)
    const d = 1.15 + spacing * 1.7
    const orders: Array<{ m: number; y: number }> = [{ m: 0, y: cy }]
    for (const m of [1, 2]) {
      const s = gratingSin(m, lambda, d)
      if (s == null) continue
      orders.push({ m, y: cy - s * span })
      orders.push({ m: -m, y: cy + s * span })
    }
    return { grating: true as const, lambda, spacing, d, slitX, screenX, cy, orders, half: 0, width: spacing }
  }
  const width = clamp(tuneAt(tune, 0, 0.45), 0.18, 1)
  const a = 0.28 + width * 1.1
  const half = slitSin(lambda, a) * span
  return { grating: false as const, lambda, width, a, slitX, screenX, cy, half, orders: [] as Array<{ m: number; y: number }>, spacing: width, d: a }
}

function colorKnobY(h: number, lambda: number) {
  return h * 0.52 - 28 - ((lambda - 0.55) * 90) / 0.26
}

function slitKnobY(h: number, width: number) {
  return h * 0.52 - (4 + width * 14)
}

function gratingKnobY(spacing: number) {
  return 28 + spacing * 40
}

export function drawDiffract(ctx: Ctx, w: number, h: number, variant: string, tune?: number[]) {
  const grating = variant === 'grating'
  const s = diffractScene(w, h, grating, tune)
  const color = wavePaint(s.lambda)
  const colorY = colorKnobY(h, s.lambda)
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(s.screenX, 36, 18, h - 64)
  ink(ctx, INK.muted)
  ctx.fillRect(s.slitX - 8, 36, 10, h - 64)
  ctx.fillStyle = '#f8fafc'
  if (s.grating) {
    for (let y = 48; y < h - 48; y += 14) ctx.fillRect(s.slitX - 6, y, 6, 4)
  } else {
    const gap = 8 + s.width * 28
    ctx.fillRect(s.slitX - 6, s.cy - gap / 2, 6, gap)
  }
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(48, s.cy, 10, 0, Math.PI * 2)
  ctx.fill()
  knob(ctx, 28, colorY)
  textAt(ctx, 'λ', 28, colorY - 14, 12, color)
  textAt(ctx, `${(s.lambda * 1000).toFixed(0)} nm`, 78, s.cy - 16, 11, color)
  ink(ctx, color)
  ctx.beginPath()
  ctx.moveTo(58, s.cy)
  ctx.lineTo(s.slitX - 8, s.cy)
  ctx.stroke()
  if (s.grating) {
    knob(ctx, s.slitX, gratingKnobY(s.spacing))
    for (const order of s.orders) {
      ctx.fillStyle = order.m === 0 ? '#f8fafc' : color
      ctx.fillRect(s.screenX, order.y - (order.m === 0 ? 5 : 3), 18, order.m === 0 ? 10 : 6)
      ink(ctx, color)
      ctx.beginPath()
      ctx.moveTo(s.slitX, s.cy)
      ctx.lineTo(s.screenX, order.y)
      ctx.stroke()
    }
    textAt(ctx, 'Cách tử', 52, 16, 12, INK.text)
    textAt(ctx, 'vạch thưa thì vân khít', w * 0.55, h - 14, 12, INK.muted)
  } else {
    knob(ctx, s.slitX + 16, slitKnobY(h, s.width))
    const bandTop = Math.max(40, s.cy - s.half)
    const bandBot = Math.min(h - 36, s.cy + s.half)
    ctx.fillStyle = color
    ctx.globalAlpha = 0.9
    ctx.fillRect(s.screenX, bandTop, 18, Math.max(6, bandBot - bandTop))
    ctx.globalAlpha = 0.35
    const lobe = (y: number, size: number) => {
      const top = Math.max(40, y)
      const bot = Math.min(h - 36, y + size)
      if (bot > top) ctx.fillRect(s.screenX, top, 18, bot - top)
    }
    lobe(s.cy - s.half * 1.7, s.half * 0.45)
    lobe(s.cy + s.half * 1.25, s.half * 0.45)
    ctx.globalAlpha = 1
    ink(ctx, color)
    ctx.beginPath()
    ctx.moveTo(s.slitX, s.cy)
    ctx.lineTo(s.screenX, s.cy - s.half)
    ctx.moveTo(s.slitX, s.cy)
    ctx.lineTo(s.screenX, s.cy + s.half)
    ctx.stroke()
    textAt(ctx, 'Khe hẹp', 52, 16, 12, INK.text)
    textAt(ctx, 'khe hẹp thì vân giữa rộng', w * 0.55, h - 14, 12, INK.muted)
  }
}

export function drawSpectrum(ctx: Ctx, w: number, h: number, variant: string) {
  const x = 36
  const barW = w - 72
  const y = h * 0.46
  const barH = 26
  const emission = variant === 'emission'
  const absorption = variant === 'absorption'
  textAt(ctx, emission ? 'Quang phổ vạch phát xạ' : absorption ? 'Quang phổ vạch hấp thụ' : 'Quang phổ liên tục', w * 0.4, 18, 13, INK.text)
  if (!emission) {
    const gradient = ctx.createLinearGradient(x, y, x + barW, y)
    if (gradient) {
      gradient.addColorStop(0, '#4c1d95')
      gradient.addColorStop(0.18, '#2563eb')
      gradient.addColorStop(0.35, '#06b6d4')
      gradient.addColorStop(0.5, '#16a34a')
      gradient.addColorStop(0.68, '#eab308')
      gradient.addColorStop(0.82, '#ea580c')
      gradient.addColorStop(1, '#dc2626')
      ctx.fillStyle = gradient
    } else ctx.fillStyle = '#64748b'
    ctx.fillRect(x, y, barW, barH)
  } else {
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(x, y, barW, barH)
  }
  ctx.strokeStyle = '#cbd5e1'
  ctx.strokeRect(x, y, barW, barH)
  if (emission || absorption) {
    HYDROGEN_LINES.forEach((line, index) => {
      const px = x + hydrogenLinePos(line.nm) * barW
      ctx.fillStyle = absorption ? '#0f172a' : line.color
      ctx.fillRect(px - 1.5, y + 1, 3, barH - 2)
      textAt(ctx, line.name, px, y + barH + (index % 2 === 0 ? 14 : 28), 11, line.color)
    })
  }
  ink(ctx, INK.muted)
  for (const nm of [400, 500, 600, 700]) {
    const px = x + ((nm - 400) / 300) * barW
    ctx.beginPath()
    ctx.moveTo(px, y + barH)
    ctx.lineTo(px, y + barH + 6)
    ctx.stroke()
    textAt(ctx, String(nm), px, y + barH + (emission || absorption ? 34 : 16), 10, INK.muted)
  }
  const note = emission
    ? 'khí hiđro phát các vạch riêng'
    : absorption
      ? 'vạch tối trùng vạch phát xạ của cùng nguyên tố'
      : 'vật rắn nóng phát dải liên tục'
  textAt(ctx, note, w * 0.5, h - 16, 12, INK.text)
}

export function opticsHandles(figure: string, variant: string, tune: number[] | undefined, w: number, h: number) {
  if (figure === 'tir' && variant === 'fiber') {
    const scene = fiberScene(w, h, tune)
    return [{ id: 'ray', x: scene.handle.x, y: scene.handle.y }]
  }
  if (figure === 'tir') {
    const scene = tirScene(w, h, tune)
    return [{ id: 'ray', x: scene.x1, y: scene.y1 }]
  }
  if (figure === 'slab') {
    const scene = slabScene(w, h, tune)
    return [{ id: 'ray', x: scene.x0, y: scene.y0 }]
  }
  if (figure === 'eye' && variant === 'loupe') {
    const pose = loupePose(w, h, tune)
    return [{ id: 'object', x: pose.ox, y: pose.oy }]
  }
  if (figure === 'eye' && variant === 'micro') {
    const power = microscopePower(tuneAt(tune, 0, 1.45))
    const scale = Math.min(12, (h * 0.26) / Math.max(1, Math.abs(power.k)))
    return [{ id: 'object', x: w * 0.38 - power.d * 34, y: h * 0.5 - scale }]
  }
  if (figure === 'eye' && variant === 'tele') {
    const scene = telescopeFrame(w, h, tune)
    return [{ id: 'ray', x: scene.handle.x, y: scene.handle.y }]
  }
  if (figure === 'eye' && (variant === 'myopia' || variant === 'hyper')) {
    const box = eyeBox(w, h, variant)
    const worn = tuneAt(tune, 0, 1) >= 0.5
    return [{ id: 'glass', x: worn ? box.glassX : box.glassX - 46, y: box.cy }]
  }
  if (figure === 'eye') {
    const box = eyeBox(w, h, 'normal')
    const near = clamp(tuneAt(tune, 0, 0.72), 0.32, 1)
    return [{ id: 'object', x: eyeObjectX(box, near), y: box.cy - 34 }]
  }
  if (figure === 'diffract') {
    const scene = diffractScene(w, h, variant === 'grating', tune)
    return [
      { id: 'color', x: 28, y: colorKnobY(h, scene.lambda) },
      { id: 'slit', x: scene.grating ? scene.slitX : scene.slitX + 16, y: scene.grating ? gratingKnobY(scene.spacing) : slitKnobY(h, scene.width) },
    ]
  }
  return []
}

export function moveOpticsTune(figure: string, variant: string, tune: number[] | undefined, w: number, h: number, handle: string, x: number, y: number) {
  if (figure === 'tir' && variant === 'fiber' && handle === 'ray') {
    const scene = fiberScene(w, h, tune)
    const phi = deg(Math.atan2(scene.cy - y, Math.max(8, x - scene.x0)))
    return [clamp(phi, 6, 36)]
  }
  if (figure === 'tir' && handle === 'ray') {
    const scene = tirScene(w, h, tune)
    return [tirAngleFromPoint(scene.hx, scene.hy, x, y)]
  }
  if (figure === 'slab' && handle === 'ray') {
    const face1 = w * 0.4
    const yHit = h * 0.36
    const i = deg(Math.atan2(yHit - y, Math.max(8, face1 - x)))
    return [clamp(i, 16, 66)]
  }
  if (figure === 'eye' && variant === 'loupe' && handle === 'object') {
    const pose = loupePose(w, h, tune)
    const d = clamp((pose.cx - x) / pose.f, 0.5, 0.8)
    const image = loupeImage(d)
    const maxFrac = Math.max(0.06, Math.min(0.16, (pose.cy - 40) / (Math.max(1.2, image.k) * h)))
    return [d, clamp((pose.cy - y) / h, 0.06, maxFrac)]
  }
  if (figure === 'eye' && variant === 'micro' && handle === 'object') {
    return [clamp((w * 0.38 - x) / 34, 1.2, 1.75)]
  }
  if (figure === 'eye' && variant === 'tele' && handle === 'ray') {
    const scene = telescopeFrame(w, h, tune)
    const ang = deg(Math.atan2(scene.cy - scene.lift - y, Math.max(12, scene.objX - scene.handle.x)))
    return [clamp(ang, 2, 7)]
  }
  if (figure === 'eye' && (variant === 'myopia' || variant === 'hyper') && handle === 'glass') {
    const box = eyeBox(w, h, variant === 'hyper' ? 'hyper' : 'myopia')
    return [x > box.glassX - 20 ? 1 : 0]
  }
  if (figure === 'eye' && handle === 'object') {
    const box = eyeBox(w, h, 'normal')
    const farX = 40
    const span = Math.max(20, box.cx - box.rx - 28 - farX)
    return [clamp(1 - (x - farX) / span, 0.32, 1)]
  }
  if (figure === 'diffract' && handle === 'color') {
    const next = [tuneAt(tune, 0, variant === 'grating' ? 0.62 : 0.45), tuneAt(tune, 1, 0.55)]
    next[1] = clamp(0.55 + ((h * 0.52 - 28) - y) * (0.26 / 90), 0.42, 0.68)
    return next
  }
  if (figure === 'diffract' && handle === 'slit') {
    const next = [tuneAt(tune, 0, variant === 'grating' ? 0.62 : 0.45), tuneAt(tune, 1, 0.55)]
    if (variant === 'grating') next[0] = clamp((y - 28) / 40, 0.3, 1)
    else next[0] = clamp((h * 0.52 - y - 4) / 14, 0.18, 1)
    return next
  }
  return null
}
