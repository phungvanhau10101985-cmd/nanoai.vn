import { INK, clamp, ink, knob, textAt, tuneAt, wrap01, type Ctx } from './bench-style'
import type { BenchHandle } from './bench-physics'

/** c = C_ngoài / C_trong. Thành tế bào giữ thể tích khi trương. Co nguyên sinh khi ưu trương, thể tích xấp xỉ 1/c. */
export function protoplast(ratio = 1) {
  const concentration = clamp(ratio, 0.25, 2.6)
  if (concentration <= 1) return { concentration, volume: 1, plasmolyzed: false }
  return { concentration, volume: Math.max(0.42, 1 / concentration), plasmolyzed: true }
}

export function osmosisScene(w: number, h: number, tune?: number[]) {
  const concentration = clamp(tuneAt(tune, 0, 1.7), 0.25, 2.6)
  const slider0 = 78
  const slider1 = w - 78
  return {
    state: protoplast(concentration),
    slider0,
    slider1,
    handleX: slider0 + ((concentration - 0.25) / 2.35) * (slider1 - slider0),
    handleY: h - 28,
    wall: { x: w * 0.24, y: 46, w: w * 0.52, h: h * 0.58 },
  }
}

export function drawOsmosis(ctx: Ctx, w: number, h: number, tune: number[] | undefined) {
  const scene = osmosisScene(w, h, tune)
  const wall = scene.wall
  const state = scene.state
  const inset = (1 - Math.sqrt(state.volume)) * Math.min(wall.w, wall.h) * 0.46
  ctx.save()
  ctx.lineWidth = 1.6
  ctx.fillStyle = state.plasmolyzed ? 'rgba(125, 211, 252, 0.35)' : 'rgba(220, 252, 231, 0.45)'
  ctx.fillRect(18, 36, w - 36, h - 78)
  ink(ctx, '#166534')
  ctx.lineWidth = 3
  ctx.strokeRect(wall.x, wall.y, wall.w, wall.h)
  ctx.lineWidth = 1.5
  ink(ctx, INK.green)
  const ix = wall.x + inset
  const iy = wall.y + inset
  const iw = wall.w - inset * 2
  const ih = wall.h - inset * 2
  ctx.fillStyle = 'rgba(187, 247, 208, 0.85)'
  ctx.fillRect(ix, iy, iw, ih)
  ctx.strokeRect(ix, iy, iw, ih)
  ctx.fillStyle = 'rgba(125, 211, 252, 0.55)'
  ctx.fillRect(ix + iw * 0.22, iy + ih * 0.2, iw * 0.56, ih * 0.6)
  ink(ctx, INK.violet)
  ctx.beginPath()
  ctx.arc(ix + iw * 0.78, iy + ih * 0.28, 7, 0, Math.PI * 2)
  ctx.fill()
  ink(ctx, '#15803d')
  for (let i = 0; i < 5; i += 1) {
    const px = ix + 10 + (i % 3) * (iw * 0.18)
    const py = iy + ih * 0.72 - Math.floor(i / 3) * 12
    ctx.beginPath()
    ctx.ellipse(px, py, 5, 3, 0.4, 0, Math.PI * 2)
    ctx.fill()
  }
  textAt(ctx, 'thành', wall.x + 28, wall.y - 12, 12, '#166534')
  textAt(ctx, 'màng', ix + 24, iy + 12, 11, INK.green)
  textAt(
    ctx,
    state.plasmolyzed ? 'co nguyên sinh' : 'trương, màng áp thành',
    w / 2,
    22,
    13,
    INK.text,
  )
  textAt(ctx, `C_ngoài / C_trong = ${state.concentration.toFixed(1)}`, w / 2, h - 48, 12, INK.sky)
  ink(ctx, INK.muted)
  ctx.beginPath()
  ctx.moveTo(scene.slider0, scene.handleY)
  ctx.lineTo(scene.slider1, scene.handleY)
  ctx.stroke()
  knob(ctx, scene.handleX, scene.handleY)
  ctx.restore()
}

export function starchIodine(covered: boolean) {
  return covered ? { name: 'vàng nâu', color: '#b45309' } : { name: 'xanh đen', color: '#1e3a8a' }
}

/** Tốc độ bọt bão hoà theo ánh sáng: rate(2L) < 2·rate(L) khi L lớn. Tối thì bằng 0. */
export function elodeaBubbles(light: number) {
  const level = clamp(light, 0, 1)
  return (4 * level) / (level + 0.35)
}

export function elodeaScene(w: number, h: number, tune?: number[]) {
  const light = clamp(tuneAt(tune, 0, 0.65), 0, 1)
  return {
    light,
    rate: elodeaBubbles(light),
    handleX: w - 42,
    handleY: 78 + (1 - light) * (h * 0.5),
  }
}

export function drawPhoto(ctx: Ctx, w: number, h: number, variant: string, tune: number[] | undefined, time: number) {
  if (variant === 'elodea') drawElodea(ctx, w, h, tune, time)
  else drawStarch(ctx, w, h)
}

function drawStarch(ctx: Ctx, w: number, h: number) {
  const covered = starchIodine(true)
  const lit = starchIodine(false)
  const cx = w * 0.46
  const cy = h * 0.5
  ctx.save()
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.ellipse(cx, cy, 120, 62, -0.2, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = covered.color
  ctx.fillRect(cx - 140, cy - 90, 140, 180)
  ctx.fillStyle = lit.color
  ctx.fillRect(cx, cy - 90, 150, 180)
  ctx.restore()
  ink(ctx, INK.text)
  ctx.beginPath()
  ctx.ellipse(cx, cy, 120, 62, -0.2, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx + 8, cy - 58)
  ctx.quadraticCurveTo(cx + 24, cy, cx - 6, cy + 58)
  ctx.stroke()
  textAt(ctx, covered.name, cx - 62, cy, 13, '#fffbeb')
  textAt(ctx, lit.name, cx + 62, cy, 13, '#e0f2fe')
  ink(ctx, '#94a3b8')
  ctx.fillStyle = '#e2e8f0'
  ctx.fillRect(w - 78, 48, 36, 22)
  ctx.strokeRect(w - 78, 48, 36, 22)
  textAt(ctx, 'giấy bạc đã che nửa lá', w - 70, 84, 11, INK.muted)
  textAt(ctx, 'sau khi nhỏ iot', w / 2, h - 18, 12, INK.text)
}

function drawElodea(ctx: Ctx, w: number, h: number, tune: number[] | undefined, time: number) {
  const scene = elodeaScene(w, h, tune)
  const beakerX = w * 0.4
  const top = 70
  ctx.save()
  ctx.lineWidth = 1.6
  ink(ctx, scene.light > 0.05 ? INK.amber : INK.muted)
  ctx.beginPath()
  ctx.arc(78, 78, 16, 0, Math.PI * 2)
  ctx.stroke()
  for (let i = 0; i < 6; i += 1) {
    const ang = (i / 6) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(78 + Math.cos(ang) * 20, 78 + Math.sin(ang) * 20)
    ctx.lineTo(78 + Math.cos(ang) * (20 + 10 * scene.light), 78 + Math.sin(ang) * (20 + 10 * scene.light))
    ctx.stroke()
  }
  textAt(ctx, scene.light === 0 ? 'tối' : 'sáng', 78, 108, 12, INK.amber)
  ink(ctx, INK.text)
  ctx.beginPath()
  ctx.moveTo(beakerX - 70, top + 20)
  ctx.lineTo(beakerX - 58, h - 40)
  ctx.lineTo(beakerX + 78, h - 40)
  ctx.lineTo(beakerX + 90, top + 20)
  ctx.stroke()
  ctx.fillStyle = 'rgba(125, 211, 252, 0.35)'
  ctx.fillRect(beakerX - 52, top + 48, 130, h - top - 94)
  ink(ctx, INK.green)
  ctx.beginPath()
  ctx.moveTo(beakerX, h - 48)
  ctx.lineTo(beakerX, top + 70)
  ctx.stroke()
  for (let i = 0; i < 5; i += 1) {
    const y = h - 70 - i * 22
    ctx.beginPath()
    ctx.ellipse(beakerX, y, 16, 6, i % 2 === 0 ? 0.5 : -0.5, 0, Math.PI * 2)
    ctx.stroke()
  }
  ink(ctx, INK.text)
  ctx.strokeRect(beakerX - 16, top + 8, 32, 58)
  textAt(ctx, 'O₂', beakerX, top + 24, 12, INK.blue)
  const count = scene.rate
  const bubbles = Math.round(count)
  ink(ctx, INK.sky)
  for (let i = 0; i < bubbles; i += 1) {
    const phase = wrap01(time * 0.7 + i / Math.max(bubbles, 1))
    ctx.beginPath()
    ctx.arc(beakerX + 10, h - 60 - phase * (h * 0.35), 2.4, 0, Math.PI * 2)
    ctx.fill()
  }
  textAt(ctx, `${count.toFixed(1)} bọt`, beakerX + 70, top + 8, 12, INK.blue)
  knob(ctx, scene.handleX, scene.handleY)
  textAt(ctx, 'ánh sáng', scene.handleX, scene.handleY + 16, 11, INK.sky)
  ctx.restore()
}

export function drawSlide(ctx: Ctx, w: number, h: number, variant: string) {
  const cx = w * 0.42
  const cy = h * 0.52
  const r = Math.min(w, h) * 0.36
  ctx.save()
  ctx.lineWidth = 8
  ink(ctx, '#0f172a')
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.arc(cx, cy, r - 6, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = '#fffbeb'
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  if (variant === 'stoma') drawStomaField(ctx, cx, cy)
  else if (variant === 'mitosis') drawMitosisField(ctx, cx, cy)
  else drawOnionField(ctx, cx, cy)
  ctx.restore()
  const caption = variant === 'stoma' ? 'khí khổng, lục lạp chỉ ở tế bào hạt đậu' : variant === 'mitosis' ? 'chóp rễ hành đang nguyên phân' : 'biểu bì hành, không có lục lạp'
  textAt(ctx, caption, w * 0.72, h - 18, 11, INK.text)
}

function drawOnionField(ctx: Ctx, cx: number, cy: number) {
  ink(ctx, INK.text)
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 2; col += 1) {
      const x = cx - 78 + col * 78
      const y = cy - 62 + row * 42
      ctx.strokeRect(x, y, 74, 38)
      ctx.beginPath()
      ctx.fillStyle = '#cbd5e1'
      ctx.arc(x + 24, y + 18, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  }
  textAt(ctx, 'nhân', cx - 40, cy - 78, 11, INK.violet)
}

function drawStomaField(ctx: Ctx, cx: number, cy: number) {
  ink(ctx, '#a8a29e')
  ctx.strokeRect(cx - 90, cy - 70, 70, 60)
  ctx.strokeRect(cx + 20, cy - 70, 70, 60)
  ctx.strokeRect(cx - 90, cy + 16, 70, 54)
  ctx.strokeRect(cx + 20, cy + 16, 70, 54)
  const guard = (sign: number) => {
    ctx.beginPath()
    ctx.moveTo(cx, cy - 24)
    ctx.bezierCurveTo(cx + sign * 30, cy - 20, cx + sign * 30, cy + 20, cx, cy + 24)
    ctx.bezierCurveTo(cx + sign * 8, cy + 12, cx + sign * 8, cy - 12, cx, cy - 24)
    ctx.fillStyle = '#d9f99d'
    ctx.fill()
    ink(ctx, '#166534')
    ctx.stroke()
    ink(ctx, '#15803d')
    for (const [dx, dy] of [[12, -8], [16, 2], [11, 10]] as const) {
      ctx.beginPath()
      ctx.arc(cx + sign * dx, cy + dy, 2.1, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  guard(1)
  guard(-1)
  textAt(ctx, 'lỗ', cx, cy, 11, INK.sky)
}

function drawMitosisField(ctx: Ctx, cx: number, cy: number) {
  const phases = ['trung gian', 'kì đầu', 'kì giữa', 'kì sau', 'kì cuối'] as const
  ink(ctx, INK.text)
  for (let i = 0; i < phases.length; i += 1) {
    const y = cy - 78 + i * 32
    ctx.strokeRect(cx - 86, y, 148, 30)
    drawPhase(ctx, cx - 48, y + 15, i)
    textAt(ctx, phases[i], cx + 22, y + 15, 10, INK.muted)
  }
}

function drawPhase(ctx: Ctx, x: number, y: number, phase: number) {
  ink(ctx, INK.violet)
  if (phase === 0) {
    ctx.beginPath()
    ctx.arc(x, y, 7, 0, Math.PI * 2)
    ctx.stroke()
  } else if (phase === 1) {
    for (const [dx, dy] of [[-6, -4], [2, -2], [6, 4]] as const) {
      ctx.beginPath()
      ctx.moveTo(x + dx - 3, y + dy)
      ctx.lineTo(x + dx + 3, y + dy + 3)
      ctx.stroke()
    }
  } else if (phase === 2) {
    ink(ctx, INK.muted)
    ctx.beginPath()
    ctx.moveTo(x, y - 10)
    ctx.lineTo(x, y + 10)
    ctx.moveTo(x - 16, y)
    ctx.lineTo(x + 16, y)
    ctx.stroke()
    ink(ctx, INK.violet)
    for (let i = -1; i <= 1; i += 1) {
      ctx.fillRect(x - 3 + i * 8, y - 2, 5, 4)
    }
  } else if (phase === 3) {
    ink(ctx, INK.muted)
    ctx.beginPath()
    ctx.moveTo(x, y - 10)
    ctx.lineTo(x, y + 10)
    ctx.stroke()
    ink(ctx, INK.violet)
    ctx.fillRect(x - 16, y - 3, 10, 4)
    ctx.fillRect(x + 6, y - 3, 10, 4)
  } else {
    ctx.beginPath()
    ctx.arc(x - 12, y, 5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x + 12, y, 5, 0, Math.PI * 2)
    ctx.stroke()
    ink(ctx, INK.green)
    ctx.beginPath()
    ctx.moveTo(x - 4, y - 9)
    ctx.lineTo(x - 4, y + 9)
    ctx.stroke()
  }
}

export function agglutinates(group: string, serum: 'A' | 'B') {
  if (group === 'O') return false
  if (group === 'AB') return true
  return group === serum
}

export function drawBlood(ctx: Ctx, w: number, h: number, variant: string) {
  const group = variant === 'B' || variant === 'AB' || variant === 'O' ? variant : 'A'
  const wells: Array<'A' | 'B'> = ['A', 'B']
  ctx.save()
  ctx.lineWidth = 1.6
  wells.forEach((serum, index) => {
    const x = w * (0.32 + index * 0.36)
    const y = h * 0.46
    const clumps = agglutinates(group, serum)
    ink(ctx, INK.text)
    ctx.beginPath()
    ctx.arc(x, y, 42, 0, Math.PI * 2)
    ctx.stroke()
    if (clumps) {
      for (const [dx, dy] of [[-12, -8], [10, -10], [0, 6], [14, 8], [-10, 12]] as const) {
        ctx.beginPath()
        ctx.fillStyle = '#7f1d1d'
        ctx.arc(x + dx, y + dy, 7, 0, Math.PI * 2)
        ctx.fill()
      }
      textAt(ctx, 'vón', x, y + 60, 12, INK.red)
    } else {
      ctx.beginPath()
      ctx.fillStyle = 'rgba(220, 38, 38, 0.4)'
      ctx.arc(x, y, 30, 0, Math.PI * 2)
      ctx.fill()
      textAt(ctx, 'không vón', x, y + 60, 12, INK.muted)
    }
    textAt(ctx, `huyết thanh ${serum}`, x, y - 56, 12, INK.text)
  })
  textAt(ctx, `máu nhóm ${group}`, w / 2, h - 16, 13, INK.text)
  ctx.restore()
}

export const REFLEX_PATH = ['receptor', 'sensory', 'spinal', 'motor', 'muscle'] as const

export function reflexNeedsBrain() {
  return false
}

export function drawReflex(ctx: Ctx, w: number, h: number, time: number) {
  const cord = { x: w * 0.58, y: h * 0.56 }
  const path = [
    { x: 78, y: h * 0.48 },
    { x: 150, y: h * 0.34 },
    { x: cord.x - 70, y: cord.y - 78 },
    { x: cord.x - 10, y: cord.y - 36 },
    { x: cord.x, y: cord.y },
    { x: cord.x - 16, y: cord.y + 48 },
    { x: 120, y: h * 0.74 },
  ]
  const phase = wrap01(time * 0.28)
  const flexed = phase > 0.78
  ctx.save()
  ctx.lineWidth = 1.6
  ink(ctx, INK.text)
  ctx.beginPath()
  ctx.ellipse(cord.x, cord.y, 48, 70, 0, 0, Math.PI * 2)
  ctx.stroke()
  ink(ctx, '#cbd5e1')
  ctx.beginPath()
  ctx.ellipse(cord.x, cord.y, 22, 40, 0, 0, Math.PI * 2)
  ctx.fill()
  textAt(ctx, 'tuỷ', cord.x, cord.y - 8, 12, INK.text)
  textAt(ctx, 'rễ lưng', cord.x + 62, cord.y - 58, 11, INK.blue)
  textAt(ctx, 'rễ bụng', cord.x + 58, cord.y + 58, 11, INK.red)
  ink(ctx, INK.blue)
  ctx.beginPath()
  ctx.arc(path[2].x, path[2].y, 8, 0, Math.PI * 2)
  ctx.stroke()
  ink(ctx, INK.text)
  ctx.beginPath()
  path.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
  ctx.stroke()
  textAt(ctx, '1 da', path[0].x, path[0].y - 22, 11, INK.muted)
  textAt(ctx, '2 cảm giác', path[1].x - 8, path[1].y - 18, 11, INK.blue)
  textAt(ctx, '3 hạch', path[2].x, path[2].y - 20, 11, INK.blue)
  textAt(ctx, '4 trung gian', cord.x, cord.y + 16, 11, INK.text)
  textAt(ctx, '5 cơ', path[6].x - 20, path[6].y + 18, 11, INK.red)
  ink(ctx, INK.muted)
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(cord.x + 20, cord.y - 60)
  ctx.lineTo(w - 168, 56)
  ctx.stroke()
  ctx.setLineDash([])
  ink(ctx, INK.text)
  ctx.beginPath()
  ctx.arc(w - 150, 50, 16, 0, Math.PI * 2)
  ctx.stroke()
  textAt(ctx, 'não, tới sau', w - 150, 76, 11, INK.muted)
  ink(ctx, '#fdba74')
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(40, h * 0.7)
  ctx.lineTo(70, flexed ? h * 0.58 : h * 0.5)
  ctx.lineTo(108, flexed ? h * 0.42 : h * 0.46)
  ctx.stroke()
  ctx.lineWidth = 1.6
  ink(ctx, INK.red)
  ctx.beginPath()
  ctx.moveTo(112, h * 0.4)
  ctx.lineTo(104, flexed ? h * 0.4 : h * 0.44)
  ctx.stroke()
  const spot = pointOn(path, phase)
  ink(ctx, INK.amber)
  ctx.beginPath()
  ctx.arc(spot.x, spot.y, 4, 0, Math.PI * 2)
  ctx.fill()
  textAt(ctx, 'rụt tay không đi qua não', w * 0.32, h - 16, 12, INK.text)
  ctx.restore()
}

function pointOn(points: { x: number; y: number }[], t: number) {
  let length = 0
  const parts: number[] = []
  for (let i = 1; i < points.length; i += 1) {
    const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    parts.push(d)
    length += d
  }
  let remain = clamp(t, 0, 1) * length
  for (let i = 0; i < parts.length; i += 1) {
    if (remain <= parts[i] || i === parts.length - 1) {
      const u = parts[i] === 0 ? 0 : remain / parts[i]
      return { x: points[i].x + (points[i + 1].x - points[i].x) * u, y: points[i].y + (points[i + 1].y - points[i].y) * u }
    }
    remain -= parts[i]
  }
  return points[0]
}

export function drawBioBench(ctx: Ctx, id: string, w: number, h: number, variant: string, tune: number[] | undefined, time: number) {
  if (id === 'osmosis') drawOsmosis(ctx, w, h, tune)
  else if (id === 'photo') drawPhoto(ctx, w, h, variant, tune, time)
  else if (id === 'slide') drawSlide(ctx, w, h, variant)
  else if (id === 'blood') drawBlood(ctx, w, h, variant)
  else if (id === 'reflex') drawReflex(ctx, w, h, time)
}

export function bioHandles(figure: string, variant: string, tune: number[] | undefined, w: number, h: number): BenchHandle[] {
  if (figure === 'osmosis') {
    const scene = osmosisScene(w, h, tune)
    return [{ id: 'salt', x: scene.handleX, y: scene.handleY }]
  }
  if (figure === 'photo' && variant === 'elodea') {
    const scene = elodeaScene(w, h, tune)
    return [{ id: 'light', x: scene.handleX, y: scene.handleY }]
  }
  return []
}

export function moveBioBench(
  figure: string,
  variant: string,
  tune: number[] | undefined,
  w: number,
  h: number,
  handle: string,
  x: number,
  y: number,
): number[] | null {
  if (figure === 'osmosis' && handle === 'salt') {
    const scene = osmosisScene(w, h, tune)
    const t = clamp((x - scene.slider0) / (scene.slider1 - scene.slider0), 0, 1)
    return [0.25 + t * 2.35]
  }
  if (figure === 'photo' && variant === 'elodea' && handle === 'light') {
    const top = 78
    const span = h * 0.5
    const t = clamp((y - top) / span, 0, 1)
    return [1 - t]
  }
  return null
}
