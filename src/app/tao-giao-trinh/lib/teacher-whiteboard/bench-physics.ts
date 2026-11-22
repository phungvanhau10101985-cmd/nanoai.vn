import { INK, arrow, clamp, ink, knob, meterFace, textAt, tuneAt, wrap01, type Ctx } from './bench-style'

export type BenchHandle = { id: string; x: number; y: number }

export type StandingMode = {
  kind: 'string' | 'pipe'
  k: number
  length: number
  speed: number
  frequency: number
  lambda: number
  nodes: number
  antinodes: number
  harmonic: number
}

/** Dây hai đầu cố định: L = k λ/2, f = k v /(2L). */
export function standingString(length = 1.2, mode = 3, speed = 24): StandingMode {
  const k = clamp(Math.round(mode), 1, 6)
  const lambda = (2 * length) / k
  return {
    kind: 'string',
    k,
    length,
    speed,
    frequency: (k * speed) / (2 * length),
    lambda,
    nodes: k + 1,
    antinodes: k,
    harmonic: k,
  }
}

/** Ống kín một đầu: L = (2k−1) λ/4. Bậc sóng hài là số lẻ, không phải số bó. */
export function standingPipe(length = 0.5, mode = 1, speed = 340): StandingMode {
  const k = clamp(Math.round(mode), 1, 4)
  const harmonic = 2 * k - 1
  const lambda = (4 * length) / harmonic
  return {
    kind: 'pipe',
    k,
    length,
    speed,
    frequency: (harmonic * speed) / (4 * length),
    lambda,
    nodes: k,
    antinodes: k,
    harmonic,
  }
}

/** xNorm = 0 tại đầu trái. Dây: nút ở cả hai đầu. Ống: nút ở đầu kín, bụng ở đầu hở. */
export function standingDisplacement(kind: 'string' | 'pipe', mode: number, xNorm: number, phase = 0) {
  const state = kind === 'pipe' ? standingPipe(0.5, mode) : standingString(1.2, mode)
  const shape = kind === 'pipe'
    ? Math.sin((state.harmonic * Math.PI * xNorm) / 2)
    : Math.sin(state.k * Math.PI * xNorm)
  return shape * Math.cos(phase)
}

export function standingScene(w: number, h: number, variant: string, tune?: number[]) {
  const pipe = variant === 'pipe'
  const maxK = pipe ? 4 : 6
  const k = clamp(Math.round(tuneAt(tune, 0, pipe ? 1 : 3)), 1, maxK)
  const mode = pipe ? standingPipe(0.5, k) : standingString(1.2, k)
  const x0 = 78
  const x1 = w - 46
  const slider0 = 92
  const slider1 = w - 70
  return {
    pipe,
    maxK,
    mode,
    x0,
    x1,
    y: h * 0.46,
    amp: h * 0.15,
    slider0,
    slider1,
    handleX: slider0 + ((k - 1) / (maxK - 1)) * (slider1 - slider0),
    handleY: h - 42,
  }
}

export function drawStanding(ctx: Ctx, w: number, h: number, variant: string, tune: number[] | undefined, time: number) {
  const scene = standingScene(w, h, variant, tune)
  const mode = scene.mode
  const phase = time * 2.4
  ctx.save()
  ctx.lineWidth = 1.6
  ink(ctx, INK.text)
  if (scene.pipe) {
    ctx.beginPath()
    ctx.moveTo(scene.x0 + 12, scene.y - 20)
    ctx.lineTo(scene.x0 - 8, scene.y - 20)
    ctx.lineTo(scene.x0 - 8, scene.y + 20)
    ctx.lineTo(scene.x0 + 12, scene.y + 20)
    ctx.stroke()
    textAt(ctx, 'kín', scene.x0, scene.y + scene.amp + 18, 11, INK.muted)
    textAt(ctx, 'hở', scene.x1, scene.y - 22, 11, INK.muted)
  } else {
    ctx.beginPath()
    ctx.moveTo(scene.x0, scene.y - scene.amp - 8)
    ctx.lineTo(scene.x0, scene.y + scene.amp + 8)
    ctx.moveTo(scene.x1, scene.y - scene.amp - 8)
    ctx.lineTo(scene.x1, scene.y + scene.amp + 8)
    ctx.stroke()
  }
  ink(ctx, INK.muted)
  ctx.setLineDash([3, 4])
  ctx.beginPath()
  ctx.moveTo(scene.x0, scene.y)
  ctx.lineTo(scene.x1, scene.y)
  ctx.stroke()
  ctx.setLineDash([])
  ink(ctx, INK.blue)
  ctx.lineWidth = 2
  ctx.beginPath()
  const steps = 80
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const y = scene.y - standingDisplacement(scene.pipe ? 'pipe' : 'string', mode.k, t, phase) * scene.amp
    const x = scene.x0 + t * (scene.x1 - scene.x0)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  const nodeCount = scene.pipe ? mode.k : mode.k + 1
  for (let i = 0; i < nodeCount; i += 1) {
    const t = scene.pipe ? (2 * i) / mode.harmonic : i / mode.k
    if (t > 1) continue
    ink(ctx, INK.amber)
    ctx.beginPath()
    ctx.arc(scene.x0 + t * (scene.x1 - scene.x0), scene.y, 3.2, 0, Math.PI * 2)
    ctx.fill()
  }
  const span = scene.x1 - scene.x0
  const mark = scene.pipe ? 1 / mode.harmonic : 1 / mode.k
  const xMark = scene.x0 + mark * span
  ink(ctx, INK.green)
  ctx.beginPath()
  ctx.moveTo(scene.x0, scene.y - scene.amp - 16)
  ctx.lineTo(xMark, scene.y - scene.amp - 16)
  ctx.stroke()
  textAt(ctx, scene.pipe ? 'λ/4' : 'λ/2', (scene.x0 + xMark) / 2, scene.y - scene.amp - 28, 12, INK.green)
  textAt(
    ctx,
    scene.pipe ? 'độ lệch dọc vẽ ngang' : 'sóng ngang',
    (scene.x0 + scene.x1) / 2,
    34,
    11,
    INK.muted,
  )
  textAt(
    ctx,
    scene.pipe
      ? `bậc ${mode.harmonic} · f = ${Math.round(mode.frequency)} Hz · λ = ${(mode.lambda * 100).toFixed(1)} cm`
      : `${mode.k} bó · f = ${mode.frequency.toFixed(0)} Hz · λ = ${(mode.lambda * 100).toFixed(0)} cm`,
    w / 2,
    h - 16,
    12,
    INK.text,
  )
  ink(ctx, INK.muted)
  ctx.beginPath()
  ctx.moveTo(scene.slider0, scene.handleY)
  ctx.lineTo(scene.slider1, scene.handleY)
  ctx.stroke()
  knob(ctx, scene.handleX, scene.handleY)
  textAt(ctx, scene.pipe ? 'bậc lẻ' : 'số bó', scene.handleX, scene.handleY + 16, 11, INK.sky)
  ctx.restore()
}

/** Mạch một nguồn, đèn và biến trở nối tiếp. Ampe kế nối tiếp, vôn kế song song với đèn. Đồng hồ lí tưởng. */
export function meterCircuit(rheostat = 12) {
  const emf = 6
  const lamp = 12
  const r = clamp(rheostat, 0, 18)
  const current = emf / (r + lamp)
  const voltage = current * lamp
  return { emf, lamp, rheostat: r, current, voltage, power: voltage * current }
}

export function meterScene(w: number, h: number, tune?: number[]) {
  const r = clamp(tuneAt(tune, 0, 6), 0, 18)
  const circuit = meterCircuit(r)
  const slider0 = 118
  const slider1 = 214
  return {
    circuit,
    slider0,
    slider1,
    handleX: slider0 + (r / 18) * (slider1 - slider0),
    handleY: 78,
    yTop: 92,
    yBot: h - 78,
    xBat: 58,
    xJoin: w - 108,
  }
}

export function drawMeters(ctx: Ctx, w: number, h: number, tune: number[] | undefined, time: number) {
  const scene = meterScene(w, h, tune)
  const { yTop, yBot, xBat, xJoin } = scene
  const c = scene.circuit
  ctx.save()
  ctx.lineWidth = 1.7
  ink(ctx, INK.text)
  ctx.beginPath()
  ctx.moveTo(xBat + 16, yTop)
  ctx.lineTo(xJoin, yTop)
  ctx.lineTo(xJoin, yBot)
  ctx.lineTo(xBat + 16, yBot)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(xBat, yTop + 18)
  ctx.lineTo(xBat, yBot - 18)
  ctx.stroke()
  ctx.lineWidth = 3.2
  ctx.beginPath()
  ctx.moveTo(xBat - 9, yTop + 34)
  ctx.lineTo(xBat - 9, yTop + 58)
  ctx.moveTo(xBat + 9, yBot - 58)
  ctx.lineTo(xBat + 9, yBot - 34)
  ctx.stroke()
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(xBat + 9, yTop + 40)
  ctx.lineTo(xBat + 9, yTop + 52)
  ctx.moveTo(xBat - 9, yBot - 52)
  ctx.lineTo(xBat - 9, yBot - 40)
  ctx.stroke()
  textAt(ctx, '+', xBat + 22, yTop + 46, 13, INK.red)
  textAt(ctx, '−', xBat + 22, yBot - 46, 13, INK.blue)
  textAt(ctx, '6 V', xBat, yBot + 18, 11, INK.muted)
  const zig = (x0: number, x1: number, y: number) => {
    ctx.beginPath()
    ctx.moveTo(x0, y)
    const n = 7
    for (let i = 0; i < n; i += 1) {
      const x = x0 + ((i + 0.5) / n) * (x1 - x0)
      ctx.lineTo(x, y + (i % 2 === 0 ? -8 : 8))
    }
    ctx.lineTo(x1, y)
    ctx.stroke()
  }
  ink(ctx, INK.amber)
  zig(scene.slider0 - 8, scene.slider1 + 8, yTop)
  ink(ctx, INK.sky)
  ctx.beginPath()
  ctx.moveTo(scene.handleX, yTop - 16)
  ctx.lineTo(scene.handleX, yTop + 16)
  ctx.stroke()
  knob(ctx, scene.handleX, yTop)
  textAt(ctx, `${c.rheostat.toFixed(0)} Ω`, scene.handleX, yTop - 28, 12, INK.sky)
  const lampX = xJoin
  const lampY = (yTop + yBot) / 2
  ctx.beginPath()
  ctx.strokeStyle = INK.image
  ctx.lineWidth = 1.8
  ctx.arc(lampX, lampY, 16, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(lampX - 9, lampY - 9)
  ctx.lineTo(lampX + 9, lampY + 9)
  ctx.moveTo(lampX + 9, lampY - 9)
  ctx.lineTo(lampX - 9, lampY + 9)
  ctx.stroke()
  const glow = clamp(c.power / 1.5, 0.08, 0.55)
  ctx.beginPath()
  ctx.fillStyle = `rgba(251, 191, 36, ${glow.toFixed(3)})`
  ctx.arc(lampX, lampY, 22, 0, Math.PI * 2)
  ctx.fill()
  textAt(ctx, 'đèn', lampX + 34, lampY, 12, INK.image)
  const vx = xJoin - 62
  ink(ctx, INK.green)
  ctx.lineWidth = 1.5
  const vy = (yTop + yBot) / 2
  ctx.beginPath()
  ctx.moveTo(vx, yTop)
  ctx.lineTo(vx, vy - 26)
  ctx.moveTo(vx, yBot)
  ctx.lineTo(vx, vy + 26)
  ctx.stroke()
  meterFace(ctx, vx, vy, c.voltage, 6, 'V', INK.green)
  textAt(ctx, `${c.voltage.toFixed(1)} V`, vx, yBot + 22, 12, INK.green)
  meterFace(ctx, 292, yTop, c.current, 0.6, 'A', INK.blue)
  textAt(ctx, `${c.current.toFixed(2)} A`, 292, yTop + 40, 12, INK.blue)
  const phase = wrap01(time * 0.55)
  const path = seriesPath(xBat + 16, yTop, xJoin, yBot, 292)
  const spot = pointAlong(path, phase)
  ink(ctx, INK.red)
  ctx.beginPath()
  ctx.arc(spot.x, spot.y, 3.4, 0, Math.PI * 2)
  ctx.fill()
  textAt(ctx, 'dòng chỉ chạy trong mạch nối tiếp', w / 2, h - 16, 12, INK.text)
  ctx.restore()
}

function seriesPath(x0: number, yTop: number, xJoin: number, yBot: number, ammeterX: number) {
  return [
    { x: x0, y: yTop },
    { x: ammeterX - 28, y: yTop },
    { x: ammeterX + 28, y: yTop },
    { x: xJoin, y: yTop },
    { x: xJoin, y: yBot },
    { x: x0, y: yBot },
    { x: x0, y: yTop },
  ]
}

function pointAlong(points: { x: number; y: number }[], t: number) {
  let length = 0
  const parts: number[] = []
  for (let i = 1; i < points.length; i += 1) {
    const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    parts.push(d)
    length += d
  }
  let remain = t * length
  for (let i = 0; i < parts.length; i += 1) {
    if (remain <= parts[i] || i === parts.length - 1) {
      const u = parts[i] === 0 ? 0 : remain / parts[i]
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * u,
        y: points[i].y + (points[i + 1].y - points[i].y) * u,
      }
    }
    remain -= parts[i]
  }
  return points[0]
}

/**
 * Cùng nguồn, cùng kênh hẹp. α dương, nặng, lệch ít.
 * β âm, nhẹ, lệch mạnh theo chiều ngược. γ không điện, đi thẳng.
 * B hướng vào trang là âm trên trục z nếu trục z hướng ra. Điện dương đi theo +x thì lệch lên trên trang.
 */
export function rayCurvature(kind: 'alpha' | 'beta' | 'gamma', bSign = 1, bMag = 1) {
  const magnitude = clamp(bMag, 0.55, 1.7)
  if (kind === 'gamma' || magnitude === 0) return { radius: Number.POSITIVE_INFINITY, screenSign: 0 }
  const radius0 = kind === 'alpha' ? 260 : 62
  const q = kind === 'alpha' ? 1 : -1
  const sign = bSign >= 0 ? 1 : -1
  return { radius: radius0 / magnitude, screenSign: q * sign }
}

export function radiationScene(w: number, h: number, tune?: number[]) {
  const sign = tuneAt(tune, 0, 1) >= 0 ? 1 : -1
  const mag = clamp(tuneAt(tune, 1, 1), 0.55, 1.7)
  return {
    sign,
    mag,
    mouth: { x: 108, y: h * 0.48 },
    fieldX: 128,
    dirX: 46,
    dirY: sign > 0 ? 22 : h - 36,
    mag0: 150,
    mag1: w - 80,
    magX: 150 + ((mag - 0.55) / 1.15) * (w - 230),
    magY: h - 18,
  }
}

function chargedArc(mouthX: number, mouthY: number, radius: number, screenSign: number, w: number, h: number) {
  const points: { x: number; y: number }[] = [{ x: mouthX, y: mouthY }]
  const up = screenSign >= 0
  const centerY = up ? mouthY - radius : mouthY + radius
  for (let i = 1; i <= 72; i += 1) {
    const theta = (i / 72) * Math.PI
    const x = mouthX + radius * Math.sin(theta)
    const y = up ? mouthY - radius * (1 - Math.cos(theta)) : mouthY + radius * (1 - Math.cos(theta))
    const prev = points[points.length - 1]
    if (y < 40 || y > h - 46 || x > w - 28) break
    if (Math.hypot(x - mouthX, y - mouthY) > 8 && x < prev.x) break
    points.push({ x, y })
  }
  if (points.length === 1) points.push({ x: mouthX + 24, y: centerY > mouthY ? mouthY + 12 : mouthY - 12 })
  return points
}

export function drawRadiation(ctx: Ctx, w: number, h: number, tune: number[] | undefined, time: number) {
  const scene = radiationScene(w, h, tune)
  const mouth = scene.mouth
  ctx.save()
  ctx.lineWidth = 1.6
  ink(ctx, '#94a3b8')
  ctx.fillStyle = '#e2e8f0'
  ctx.fillRect(28, mouth.y - 46, 80, 92)
  ctx.strokeRect(28, mouth.y - 46, 80, 92)
  ctx.clearRect(78, mouth.y - 7, 32, 14)
  ink(ctx, INK.text)
  ctx.strokeRect(78, mouth.y - 7, 32, 14)
  textAt(ctx, 'nguồn', 62, mouth.y - 58, 12, INK.muted)
  ink(ctx, scene.sign > 0 ? INK.blue : INK.red)
  for (let i = 0; i < 4; i += 1) {
    const x = scene.fieldX + 36 + i * 54
    textAt(ctx, scene.sign > 0 ? '×' : '•', x, 58, 16, scene.sign > 0 ? INK.blue : INK.red)
  }
  textAt(ctx, scene.sign > 0 ? 'B vào trang' : 'B ra trang', scene.dirX + 58, scene.dirY, 12, INK.sky)
  knob(ctx, scene.dirX, scene.dirY)
  ink(ctx, INK.muted)
  ctx.beginPath()
  ctx.moveTo(scene.mag0, scene.magY)
  ctx.lineTo(scene.mag1, scene.magY)
  ctx.stroke()
  textAt(ctx, `B = ${scene.mag.toFixed(1)}`, scene.magX, scene.magY - 14, 11, INK.sky)
  knob(ctx, scene.magX, scene.magY)
  const rays: Array<{ kind: 'alpha' | 'beta' | 'gamma'; color: string; label: string }> = [
    { kind: 'alpha', color: INK.red, label: 'α' },
    { kind: 'beta', color: INK.blue, label: 'β' },
    { kind: 'gamma', color: INK.green, label: 'γ' },
  ]
  const phase = wrap01(time * 0.35)
  for (const ray of rays) {
    const curve = rayCurvature(ray.kind, scene.sign, scene.mag)
    ink(ctx, ray.color)
    ctx.lineWidth = ray.kind === 'gamma' ? 1.5 : 2
    ctx.beginPath()
    if (!Number.isFinite(curve.radius)) {
      ctx.moveTo(mouth.x, mouth.y)
      ctx.lineTo(w - 64, mouth.y)
      ctx.stroke()
      const px = mouth.x + phase * (w - 70 - mouth.x)
      ctx.beginPath()
      ctx.arc(px, mouth.y, 3.2, 0, Math.PI * 2)
      ctx.fill()
      textAt(ctx, 'γ', w - 78, mouth.y - 14, 13, ray.color)
    } else {
      const pts = chargedArc(mouth.x, mouth.y, curve.radius, curve.screenSign, w, h)
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
      ctx.stroke()
      const spot = pts[Math.min(pts.length - 1, Math.floor(phase * (pts.length - 1)))]
      ctx.beginPath()
      ctx.arc(spot.x, spot.y, 3.2, 0, Math.PI * 2)
      ctx.fill()
      const end = pts[pts.length - 1]
      textAt(ctx, ray.label, end.x + 10, end.y, 14, ray.color)
    }
  }
  textAt(ctx, 'α lệch ít, β lệch mạnh và ngược chiều', w * 0.58, 40, 12, INK.text)
  ctx.restore()
}

/** Biến áp lí tưởng: U1/U2 = N1/N2 = I2/I1 và U1 I1 = U2 I2 khi có tải. */
export function transformerCircuit(turns2 = 120, turns1 = 240, voltage1 = 12, load = 48) {
  const n2 = clamp(turns2, 60, 480)
  const voltage2 = voltage1 * (n2 / turns1)
  const current2 = voltage2 / load
  const current1 = current2 * (n2 / turns1)
  return {
    turns1,
    turns2: n2,
    voltage1,
    voltage2,
    current1,
    current2,
    load,
    power1: voltage1 * current1,
    power2: voltage2 * current2,
  }
}

export function transformerScene(w: number, h: number, tune?: number[]) {
  const n2 = clamp(tuneAt(tune, 0, 120), 60, 480)
  const circuit = transformerCircuit(n2)
  const slider0 = 160
  const slider1 = Math.min(w * 0.58, w - 150)
  return {
    circuit,
    core: { x: 150, y: 78, w: 150, h: 118, t: 16 },
    slider0,
    slider1,
    handleX: slider0 + ((n2 - 60) / 420) * (slider1 - slider0),
    handleY: h - 20,
  }
}

export function drawTransformer(ctx: Ctx, w: number, h: number, tune: number[] | undefined, time: number) {
  const scene = transformerScene(w, h, tune)
  const core = scene.core
  const c = scene.circuit
  const sign = Math.sin(time * 4) >= 0 ? 1 : -1
  ctx.save()
  ctx.lineWidth = 1.6
  ink(ctx, '#64748b')
  ctx.strokeRect(core.x, core.y, core.w, core.h)
  ctx.strokeRect(core.x + core.t, core.y + core.t, core.w - core.t * 2, core.h - core.t * 2)
  textAt(ctx, 'lõi sắt', core.x + core.w / 2, core.y + core.h / 2, 11, INK.muted)
  const coil = (x: number, color: string) => {
    ink(ctx, color)
    ctx.beginPath()
    for (let i = 0; i < 5; i += 1) {
      const y = core.y + 18 + i * 18
      ctx.moveTo(x, y)
      ctx.bezierCurveTo(x - 16, y + 4, x - 16, y + 14, x, y + 16)
    }
    ctx.stroke()
  }
  coil(core.x + 2, INK.blue)
  coil(core.x + core.w - 2, INK.green)
  textAt(ctx, `N₁ = ${c.turns1}`, core.x - 8, core.y - 14, 12, INK.blue)
  textAt(ctx, `N₂ = ${Math.round(c.turns2)}`, core.x + core.w + 18, core.y - 14, 12, INK.green)
  textAt(ctx, 'vòng vẽ là kí hiệu, không đếm số vòng', w / 2, 28, 11, INK.muted)
  ink(ctx, INK.text)
  ctx.beginPath()
  ctx.moveTo(36, core.y + 20)
  ctx.lineTo(core.x, core.y + 20)
  ctx.moveTo(36, core.y + core.h - 20)
  ctx.lineTo(core.x, core.y + core.h - 20)
  ctx.stroke()
  ink(ctx, INK.amber)
  ctx.beginPath()
  ctx.arc(36, core.y + core.h / 2, 18, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(28, core.y + core.h / 2)
  ctx.quadraticCurveTo(36, core.y + core.h / 2 - 10, 44, core.y + core.h / 2)
  ctx.stroke()
  textAt(ctx, `${c.voltage1.toFixed(0)} V`, 36, core.y + core.h + 22, 12, INK.amber)
  const lampX = w - 48
  ink(ctx, INK.text)
  ctx.beginPath()
  ctx.moveTo(core.x + core.w, core.y + 20)
  ctx.lineTo(lampX, core.y + 20)
  ctx.lineTo(lampX, core.y + core.h - 20)
  ctx.lineTo(core.x + core.w, core.y + core.h - 20)
  ctx.stroke()
  ink(ctx, INK.image)
  ctx.beginPath()
  ctx.arc(lampX, core.y + core.h / 2, 14, 0, Math.PI * 2)
  ctx.moveTo(lampX - 8, core.y + core.h / 2 - 8)
  ctx.lineTo(lampX + 8, core.y + core.h / 2 + 8)
  ctx.moveTo(lampX + 8, core.y + core.h / 2 - 8)
  ctx.lineTo(lampX - 8, core.y + core.h / 2 + 8)
  ctx.stroke()
  textAt(ctx, `${c.load.toFixed(0)} Ω`, lampX, core.y + 8, 12, INK.image)
  const primaryDown = sign > 0
  ink(ctx, INK.blue)
  arrow(ctx, core.x - 24, primaryDown ? core.y + 36 : core.y + core.h - 36, core.x - 24, primaryDown ? core.y + 70 : core.y + core.h - 70, 7)
  ink(ctx, INK.green)
  arrow(
    ctx,
    core.x + core.w + 24,
    primaryDown ? core.y + core.h - 36 : core.y + 36,
    core.x + core.w + 24,
    primaryDown ? core.y + core.h - 70 : core.y + 70,
    7,
  )
  textAt(ctx, 'dòng thứ cấp ngược chiều dòng sơ cấp', w / 2, 46, 11, INK.text)
  textAt(ctx, `U₂ ${c.voltage2.toFixed(1)} V · I₂ ${c.current2.toFixed(2)} A · I₁ ${c.current1.toFixed(2)} A · P ${c.power1.toFixed(2)} W`, w * 0.5, h - 40, 12, INK.text)
  ink(ctx, INK.muted)
  ctx.beginPath()
  ctx.moveTo(scene.slider0, scene.handleY)
  ctx.lineTo(scene.slider1, scene.handleY)
  ctx.stroke()
  knob(ctx, scene.handleX, scene.handleY)
  textAt(ctx, 'N₂', scene.slider0 - 16, scene.handleY, 11, INK.sky)
  ctx.restore()
}

/**
 * Lực căng = trọng lượng − lực đẩy. Khối chữ nhật nên phần ngập bằng phần chiều cao.
 * g = 10 theo SGK. Gỗ nổi thì dây chùng và phần ngập dừng ở ρ/ρ_nước.
 */
export function buoyancyState(densityRatio = 2, immerse = 1) {
  const density = clamp(densityRatio, 0.2, 8)
  const requested = clamp(immerse, 0, 1)
  const fraction = density < 1 ? Math.min(requested, density) : requested
  const volume = 1e-4
  const water = 1000
  const g = 10
  const weight = density * water * volume * g
  const buoyant = fraction * water * volume * g
  const tension = Math.max(0, weight - buoyant)
  const slack = density < 1 && requested > density + 0.001
  return { density, requested, fraction, weight, buoyant, tension, slack, g }
}

export function buoyancyScene(w: number, h: number, variant: string, tune?: number[]) {
  const density = variant === 'wood' ? 0.6 : 2
  const requested = clamp(tuneAt(tune, 0, density < 1 ? 1 : 1), 0, 1)
  const state = buoyancyState(density, requested)
  const waterY = h * 0.58
  const blockH = 72
  const blockW = 58
  const yAir = waterY - blockH
  const yFull = waterY
  const yAsked = yAir + requested * (yFull - yAir)
  const yBlock = yAir + state.fraction * (yFull - yAir)
  return {
    state,
    waterY,
    blockH,
    blockW,
    cx: w * 0.58,
    beaker: { x: w * 0.58 - 78, y: waterY - 18, w: 156, h: h - waterY - 18 },
    handleX: w * 0.58,
    handleY: yAsked - 58,
    yBlock,
  }
}

export function drawBuoyancy(ctx: Ctx, w: number, h: number, variant: string, tune: number[] | undefined) {
  const scene = buoyancyScene(w, h, variant, tune)
  const s = scene.state
  const top = scene.yBlock
  const left = scene.cx - scene.blockW / 2
  ctx.save()
  ctx.lineWidth = 1.6
  ink(ctx, INK.sky)
  ctx.fillStyle = 'rgba(125, 211, 252, 0.45)'
  ctx.fillRect(scene.beaker.x + 3, scene.waterY, scene.beaker.w - 6, scene.beaker.h - 8)
  ink(ctx, INK.text)
  ctx.strokeRect(scene.beaker.x, scene.beaker.y, scene.beaker.w, scene.beaker.h)
  ctx.beginPath()
  ctx.moveTo(scene.beaker.x, scene.waterY)
  ctx.lineTo(scene.beaker.x + scene.beaker.w, scene.waterY)
  ctx.stroke()
  textAt(ctx, 'nước', scene.beaker.x + scene.beaker.w - 24, scene.waterY + 16, 11, INK.sky)
  ctx.save()
  ctx.beginPath()
  ctx.rect(scene.beaker.x, scene.waterY, scene.beaker.w, scene.beaker.h)
  ctx.clip()
  ctx.fillStyle = variant === 'wood' ? '#d6b48a' : '#94a3b8'
  ctx.fillRect(left, top, scene.blockW, scene.blockH)
  ctx.restore()
  ctx.fillStyle = variant === 'wood' ? '#e7d3b5' : '#cbd5e1'
  ctx.fillRect(left, top, scene.blockW, Math.max(0, Math.min(scene.blockH, scene.waterY - top)))
  ink(ctx, INK.text)
  ctx.strokeRect(left, top, scene.blockW, scene.blockH)
  textAt(ctx, variant === 'wood' ? 'gỗ' : 'kim loại', scene.cx, top + scene.blockH / 2, 12, INK.text)
  const scaleY = scene.handleY
  ink(ctx, INK.text)
  ctx.strokeRect(scene.handleX - 28, scaleY - 18, 56, 36)
  textAt(ctx, `${s.tension.toFixed(2)} N`, scene.handleX, scaleY, 12, INK.blue)
  knob(ctx, scene.handleX, scaleY)
  ink(ctx, s.slack ? INK.muted : INK.text)
  ctx.setLineDash(s.slack ? [3, 4] : [])
  ctx.beginPath()
  if (s.slack) {
    ctx.moveTo(scene.handleX, scaleY + 18)
    ctx.quadraticCurveTo(scene.handleX + 16, (scaleY + top) / 2, scene.cx, top)
  } else {
    ctx.moveTo(scene.handleX, scaleY + 18)
    ctx.lineTo(scene.cx, top)
  }
  ctx.stroke()
  ctx.setLineDash([])
  if (s.fraction > 0.02) {
    ink(ctx, INK.sky)
    arrow(ctx, scene.cx + 46, top + scene.blockH * 0.7, scene.cx + 46, top + scene.blockH * 0.35, 7)
    textAt(ctx, 'Fₐ', scene.cx + 64, top + scene.blockH * 0.5, 12, INK.sky)
  }
  ink(ctx, INK.red)
  arrow(ctx, scene.cx - 40, top + 8, scene.cx - 40, top + 36, 7)
  textAt(ctx, 'P', scene.cx - 54, top + 22, 12, INK.red)
  textAt(
    ctx,
    s.slack ? 'dây chùng, vật nổi' : `T = P − Fₐ = ${s.tension.toFixed(2)} N`,
    w / 2,
    h - 16,
    12,
    INK.text,
  )
  textAt(ctx, `P = ${s.weight.toFixed(2)} N · Fₐ = ${s.buoyant.toFixed(2)} N`, w * 0.28, 28, 12, INK.muted)
  ctx.restore()
}

export function drawPhysBench(ctx: Ctx, id: string, w: number, h: number, variant: string, tune: number[] | undefined, time: number) {
  if (id === 'standing') drawStanding(ctx, w, h, variant, tune, time)
  else if (id === 'meters') drawMeters(ctx, w, h, tune, time)
  else if (id === 'radiation') drawRadiation(ctx, w, h, tune, time)
  else if (id === 'transformer') drawTransformer(ctx, w, h, tune, time)
  else if (id === 'buoyancy') drawBuoyancy(ctx, w, h, variant, tune)
}

export function physHandles(figure: string, variant: string, tune: number[] | undefined, w: number, h: number): BenchHandle[] {
  if (figure === 'standing') {
    const scene = standingScene(w, h, variant, tune)
    return [{ id: 'mode', x: scene.handleX, y: scene.handleY }]
  }
  if (figure === 'meters') {
    const scene = meterScene(w, h, tune)
    return [{ id: 'rheostat', x: scene.handleX, y: scene.handleY }]
  }
  if (figure === 'radiation') {
    const scene = radiationScene(w, h, tune)
    return [
      { id: 'direction', x: scene.dirX, y: scene.dirY },
      { id: 'strength', x: scene.magX, y: scene.magY },
    ]
  }
  if (figure === 'transformer') {
    const scene = transformerScene(w, h, tune)
    return [{ id: 'turns', x: scene.handleX, y: scene.handleY }]
  }
  if (figure === 'buoyancy') {
    const scene = buoyancyScene(w, h, variant, tune)
    return [{ id: 'depth', x: scene.handleX, y: scene.handleY }]
  }
  return []
}

export function movePhysBench(
  figure: string,
  variant: string,
  tune: number[] | undefined,
  w: number,
  h: number,
  handle: string,
  x: number,
  y: number,
): number[] | null {
  if (figure === 'standing' && handle === 'mode') {
    const scene = standingScene(w, h, variant, tune)
    const t = clamp((x - scene.slider0) / (scene.slider1 - scene.slider0), 0, 1)
    return [clamp(Math.round(1 + t * (scene.maxK - 1)), 1, scene.maxK)]
  }
  if (figure === 'meters' && handle === 'rheostat') {
    const scene = meterScene(w, h, tune)
    return [clamp(((x - scene.slider0) / (scene.slider1 - scene.slider0)) * 18, 0, 18)]
  }
  if (figure === 'radiation' && handle === 'direction') {
    const scene = radiationScene(w, h, tune)
    return [y < h / 2 ? 1 : -1, scene.mag]
  }
  if (figure === 'radiation' && handle === 'strength') {
    const scene = radiationScene(w, h, tune)
    const t = clamp((x - scene.mag0) / (scene.mag1 - scene.mag0), 0, 1)
    return [scene.sign, 0.55 + t * 1.15]
  }
  if (figure === 'transformer' && handle === 'turns') {
    const scene = transformerScene(w, h, tune)
    const t = clamp((x - scene.slider0) / (scene.slider1 - scene.slider0), 0, 1)
    return [60 + t * 420]
  }
  if (figure === 'buoyancy' && handle === 'depth') {
    const air = buoyancyScene(w, h, variant, [0]).handleY
    const deep = buoyancyScene(w, h, variant, [1]).handleY
    return [clamp((y - air) / (deep - air), 0, 1)]
  }
  return null
}
