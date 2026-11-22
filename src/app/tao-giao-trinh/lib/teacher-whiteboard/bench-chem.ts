import { INK, arrow, clamp, ink, knob, textAt, tuneAt, wrap01, type Ctx } from './bench-style'
import type { BenchHandle } from './bench-physics'

export type DistillState = {
  flame: number
  boiling: boolean
  temperature: number
  drops: boolean
  distillate: 'nước'
  residue: 'muối'
}

/** Nhiệt kế đặt ở cổ hơi. Dưới nhiệt độ sôi không có giọt. Khi sôi, hơi là 100°C, muối ở lại bình. */
export function distillState(flame = 0): DistillState {
  const heat = clamp(flame, 0, 1)
  const boiling = heat >= 0.62
  const temperature = boiling ? 100 : 25 + (heat / 0.62) * 75
  return { flame: heat, boiling, temperature, drops: boiling, distillate: 'nước', residue: 'muối' }
}

export function distillScene(w: number, h: number, tune?: number[]) {
  const flame = clamp(tuneAt(tune, 0, 0.8), 0, 1)
  return {
    state: distillState(flame),
    flameX: 78,
    flameY: h - 48,
    slider0: 46,
    slider1: 128,
  }
}

export function drawDistill(ctx: Ctx, w: number, h: number, tune: number[] | undefined, time: number) {
  const scene = distillScene(w, h, tune)
  const state = scene.state
  const flaskX = 108
  const flaskY = h * 0.62
  ctx.save()
  ctx.lineWidth = 1.6
  ink(ctx, INK.amber)
  const flick = 0.75 + 0.25 * Math.sin(time * 14)
  ctx.beginPath()
  ctx.moveTo(flaskX - 16, flaskY + 58)
  ctx.quadraticCurveTo(flaskX, flaskY + 58 - 28 * state.flame * flick, flaskX + 16, flaskY + 58)
  ctx.stroke()
  ink(ctx, INK.sky)
  ctx.beginPath()
  ctx.arc(flaskX, flaskY, 34, 0.15 * Math.PI, 0.85 * Math.PI, true)
  ctx.lineTo(flaskX + 10, flaskY - 58)
  ctx.lineTo(flaskX - 10, flaskY - 58)
  ctx.closePath()
  ctx.stroke()
  ctx.fillStyle = 'rgba(125, 211, 252, 0.35)'
  ctx.beginPath()
  ctx.arc(flaskX, flaskY + 6, 22, 0, Math.PI * 2)
  ctx.fill()
  textAt(ctx, 'nước muối', flaskX, flaskY + 8, 11, INK.sky)
  ink(ctx, INK.red)
  ctx.fillRect(flaskX - 3, flaskY - 92, 6, 18 + (state.temperature / 100) * 28)
  ink(ctx, INK.text)
  ctx.strokeRect(flaskX - 5, flaskY - 98, 10, 54)
  textAt(ctx, `${Math.round(state.temperature)}°C`, flaskX - 36, flaskY - 78, 12, INK.red)
  textAt(ctx, 'bầu ở cổ hơi', flaskX + 46, flaskY - 86, 11, INK.muted)
  ink(ctx, INK.text)
  ctx.beginPath()
  ctx.moveTo(flaskX + 18, flaskY - 24)
  ctx.lineTo(250, flaskY - 24)
  ctx.lineTo(w - 92, h * 0.7)
  ctx.stroke()
  ink(ctx, INK.blue)
  ctx.lineWidth = 7
  ctx.globalAlpha = 0.28
  ctx.beginPath()
  ctx.moveTo(262, flaskY - 16)
  ctx.lineTo(w - 100, h * 0.7 - 8)
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.lineWidth = 1.4
  ctx.stroke()
  arrow(ctx, w - 118, h * 0.7 + 8, w - 118, h * 0.7 - 16, 6)
  textAt(ctx, 'nước lạnh vào', w - 78, h * 0.7 + 22, 11, INK.blue)
  arrow(ctx, 250, flaskY - 18, 250, flaskY - 46, 6)
  textAt(ctx, 'nước ra', 292, flaskY - 52, 11, INK.blue)
  ink(ctx, INK.sky)
  ctx.beginPath()
  ctx.moveTo(w - 92, h * 0.7)
  ctx.lineTo(w - 78, h - 54)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(w - 96, h - 36)
  ctx.lineTo(w - 48, h - 36)
  ctx.lineTo(w - 56, h - 70)
  ctx.lineTo(w - 88, h - 70)
  ctx.closePath()
  ctx.stroke()
  if (state.drops) {
    const drop = wrap01(time * 0.8)
    ink(ctx, INK.sky)
    ctx.beginPath()
    ctx.arc(w - 78, h * 0.7 + 10 + drop * 28, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(125, 211, 252, 0.55)'
    ctx.fillRect(w - 86, h - 58, 28, 18)
    textAt(ctx, 'nước cất', w - 70, h - 22, 11, INK.sky)
    textAt(ctx, 'muối còn lại', flaskX, flaskY + 28, 11, INK.amber)
  } else {
    textAt(ctx, 'chưa sôi, chưa có giọt', w - 90, h - 22, 11, INK.muted)
  }
  ink(ctx, INK.muted)
  ctx.beginPath()
  ctx.moveTo(scene.slider0, scene.flameY)
  ctx.lineTo(scene.slider1, scene.flameY)
  ctx.stroke()
  const handleX = scene.slider0 + state.flame * (scene.slider1 - scene.slider0)
  knob(ctx, handleX, scene.flameY)
  textAt(ctx, 'ngọn lửa', handleX, scene.flameY + 16, 11, INK.sky)
  textAt(ctx, state.boiling ? 'hơi nước 100°C, không phải nhiệt độ ngọn lửa' : 'chưa sôi, nhiệt kế dưới 100°C', w / 2, 22, 12, INK.text)
  ctx.restore()
}

export type GasMethod = 'water' | 'up' | 'down'

/** H2 nhẹ, ít tan: đẩy nước. NH3 nhẹ và tan rất mạnh: chỉ đẩy không khí lên. CO2 nặng hơn không khí: đẩy xuống. */
export function gasCollect(gas: 'H2' | 'NH3' | 'CO2'): { method: GasMethod; mass: number; soluble: boolean } {
  if (gas === 'NH3') return { method: 'up', mass: 17, soluble: true }
  if (gas === 'CO2') return { method: 'down', mass: 44, soluble: true }
  return { method: 'water', mass: 2, soluble: false }
}

export function drawGasLab(ctx: Ctx, w: number, h: number, variant: string, time: number) {
  const gas = variant === 'up' ? 'NH3' : variant === 'down' ? 'CO2' : 'H2'
  const plan = gasCollect(gas)
  ctx.save()
  ctx.lineWidth = 1.6
  const srcX = 92
  const srcY = h * 0.58
  if (gas === 'NH3') {
    ink(ctx, INK.text)
    ctx.strokeRect(srcX - 34, srcY - 10, 68, 22)
    ink(ctx, INK.amber)
    ctx.beginPath()
    ctx.moveTo(srcX - 12, srcY + 24)
    ctx.quadraticCurveTo(srcX, srcY + 8, srcX + 12, srcY + 24)
    ctx.stroke()
    textAt(ctx, 'Ca(OH)₂ + NH₄Cl', srcX, srcY, 10, INK.muted)
    textAt(ctx, 'đun', srcX, srcY + 36, 11, INK.amber)
  } else {
    ink(ctx, INK.sky)
    ctx.beginPath()
    ctx.arc(srcX, srcY, 28, 0.2 * Math.PI, 0.8 * Math.PI, true)
    ctx.lineTo(srcX + 8, srcY - 36)
    ctx.lineTo(srcX - 8, srcY - 36)
    ctx.closePath()
    ctx.stroke()
    textAt(ctx, gas === 'H2' ? 'Zn + HCl' : 'CaCO₃ + HCl', srcX, srcY + 4, 11, INK.text)
    const bubble = wrap01(time * 1.1)
    ink(ctx, INK.muted)
    ctx.beginPath()
    ctx.arc(srcX + 8, srcY + 8 - bubble * 18, 2.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ink(ctx, INK.text)
  if (plan.method === 'water') {
    const jarX = 348
    const waterY = h * 0.6
    const jarTop = h * 0.2
    const mouthY = waterY + 14
    ink(ctx, INK.sky)
    ctx.fillStyle = 'rgba(125, 211, 252, 0.4)'
    ctx.fillRect(230, waterY, 210, h * 0.22)
    ctx.strokeRect(230, waterY, 210, h * 0.22)
    ink(ctx, INK.text)
    ctx.strokeRect(jarX - 26, jarTop, 52, mouthY - jarTop)
    ctx.fillStyle = 'rgba(226, 232, 240, 0.95)'
    ctx.fillRect(jarX - 24, jarTop + 2, 48, 34)
    textAt(ctx, 'H₂', jarX, jarTop + 18, 13, INK.blue)
    ink(ctx, INK.text)
    ctx.beginPath()
    ctx.moveTo(srcX + 8, srcY - 36)
    ctx.lineTo(jarX, srcY - 36)
    ctx.lineTo(jarX, mouthY - 4)
    ctx.stroke()
    textAt(ctx, 'ống vào miệng bình úp', jarX, jarTop - 12, 11, INK.muted)
  } else if (plan.method === 'up') {
    const jarX = 330
    const jarTop = 58
    const jarH = 118
    drawAirJar(ctx, jarX, jarTop, true, gas, time)
    ink(ctx, INK.text)
    ctx.beginPath()
    ctx.moveTo(srcX + 20, srcY - 10)
    ctx.lineTo(jarX - 48, jarTop + jarH)
    ctx.lineTo(jarX, jarTop + jarH)
    ctx.lineTo(jarX, jarTop + 16)
    ctx.stroke()
    textAt(ctx, 'miệng úp, không úp vào nước', w * 0.62, h - 24, 12, INK.red)
  } else {
    const jarX = 330
    const jarTop = 52
    const jarH = 128
    drawAirJar(ctx, jarX, jarTop, false, gas, time)
    ink(ctx, INK.text)
    ctx.beginPath()
    ctx.moveTo(srcX + 8, srcY - 36)
    ctx.lineTo(jarX, jarTop + 10)
    ctx.lineTo(jarX, jarTop + 16 + jarH - 12)
    ctx.stroke()
    textAt(ctx, 'ống chạm đáy bình', w * 0.62, h - 24, 12, INK.text)
  }
  textAt(ctx, `${gas} · M = ${plan.mass}`, 70, 28, 13, INK.text)
  textAt(ctx, 'không khí M ≈ 29', 168, 28, 12, INK.muted)
  ctx.restore()
}

function drawAirJar(ctx: Ctx, x: number, top: number, inverted: boolean, gas: string, time: number) {
  const jarH = 120
  ink(ctx, INK.text)
  if (inverted) {
    ctx.strokeRect(x - 28, top, 56, jarH)
    ctx.beginPath()
    ctx.moveTo(x - 28, top + jarH)
    ctx.lineTo(x + 28, top + jarH)
    ctx.stroke()
    ctx.fillStyle = 'rgba(167, 243, 208, 0.65)'
    const filled = 30 + wrap01(time * 0.15) * 20
    ctx.fillRect(x - 26, top + 2, 52, filled)
    textAt(ctx, gas, x, top + 18, 13, INK.green)
  } else {
    ctx.strokeRect(x - 28, top + 16, 56, jarH)
    ctx.fillStyle = 'rgba(254, 215, 170, 0.7)'
    const filled = 36 + wrap01(time * 0.15) * 24
    ctx.fillRect(x - 26, top + 16 + jarH - filled, 52, filled - 4)
    textAt(ctx, gas, x, top + jarH - 8, 13, INK.image)
  }
}

export function drawFilter(ctx: Ctx, w: number, h: number, time: number) {
  const cx = w * 0.48
  const top = 54
  ctx.save()
  ctx.lineWidth = 1.6
  ink(ctx, '#94a3b8')
  ctx.beginPath()
  ctx.moveTo(cx + 40, top)
  ctx.lineTo(cx + 40, h - 24)
  ctx.moveTo(cx + 40, top + 36)
  ctx.lineTo(cx + 30, top + 40)
  ctx.stroke()
  ink(ctx, INK.text)
  ctx.beginPath()
  ctx.moveTo(cx - 34, top + 36)
  ctx.lineTo(cx, top + 92)
  ctx.lineTo(cx + 34, top + 36)
  ctx.stroke()
  ink(ctx, '#e2e8f0')
  ctx.beginPath()
  ctx.moveTo(cx - 24, top + 46)
  ctx.lineTo(cx, top + 82)
  ctx.lineTo(cx + 24, top + 46)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  textAt(ctx, 'giấy lọc', cx - 62, top + 78, 12, INK.muted)
  ink(ctx, INK.amber)
  ctx.beginPath()
  ctx.moveTo(cx - 70, top + 18)
  ctx.quadraticCurveTo(cx - 20, top + 8, cx - 8, top + 40)
  ctx.stroke()
  textAt(ctx, 'đũa tì miệng phễu', cx - 78, top + 8, 11, INK.amber)
  ink(ctx, '#a16207')
  ctx.beginPath()
  ctx.moveTo(cx - 108, top + 28)
  ctx.lineTo(cx - 78, top + 28)
  ctx.lineTo(cx - 86, top + 58)
  ctx.lineTo(cx - 116, top + 58)
  ctx.closePath()
  ctx.stroke()
  ctx.fillStyle = 'rgba(120, 53, 15, 0.28)'
  ctx.fill()
  textAt(ctx, 'nước đục', cx - 96, top + 72, 11, INK.image)
  const drop = wrap01(time * 0.9)
  ink(ctx, INK.sky)
  ctx.beginPath()
  ctx.arc(cx, top + 96 + drop * 36, 2.6, 0, Math.PI * 2)
  ctx.fill()
  ink(ctx, INK.text)
  ctx.beginPath()
  ctx.moveTo(cx - 36, h - 36)
  ctx.lineTo(cx + 36, h - 36)
  ctx.lineTo(cx + 28, h - 92)
  ctx.lineTo(cx - 28, h - 92)
  ctx.closePath()
  ctx.stroke()
  ctx.fillStyle = 'rgba(125, 211, 252, 0.45)'
  ctx.fillRect(cx - 24, h - 70, 48, 30)
  textAt(ctx, 'nước trong', cx, h - 18, 12, INK.sky)
  textAt(ctx, 'cặn trên giấy', cx, top + 58, 11, INK.image)
  ctx.restore()
}

/**
 * Pin Daniell. Zn cực âm, oxi hoá. Cu cực dương, khử.
 * Electron trong dây đi từ Zn sang Cu. Cation về phía Cu, anion về phía Zn.
 */
export function daniellCell(closed = true) {
  const voltage = 1.1
  return {
    closed,
    voltage,
    anode: 'Zn',
    cathode: 'Cu',
    current: closed ? voltage / 4 : 0,
    electrons: closed ? 'Zn → Cu' : 'mạch hở',
  }
}

export function galvanicScene(w: number, h: number, tune?: number[]) {
  const closed = tuneAt(tune, 0, 1) >= 0.5
  return { cell: daniellCell(closed), switchX: closed ? w * 0.56 : w * 0.44, switchY: 58 }
}

export function drawGalvanic(ctx: Ctx, w: number, h: number, tune: number[] | undefined, time: number) {
  const scene = galvanicScene(w, h, tune)
  const cell = scene.cell
  const y = h * 0.62
  const zn = w * 0.28
  const cu = w * 0.72
  ctx.save()
  ctx.lineWidth = 1.6
  const beaker = (x: number, color: string, name: string) => {
    ink(ctx, INK.text)
    ctx.beginPath()
    ctx.moveTo(x - 48, y - 20)
    ctx.lineTo(x - 40, h - 36)
    ctx.lineTo(x + 40, h - 36)
    ctx.lineTo(x + 48, y - 20)
    ctx.stroke()
    ctx.fillStyle = color
    ctx.fillRect(x - 36, y, 72, h - y - 42)
    textAt(ctx, name, x, y + 28, 12, INK.text)
  }
  beaker(zn, 'rgba(226, 232, 240, 0.8)', 'ZnSO₄')
  beaker(cu, 'rgba(125, 211, 252, 0.45)', 'CuSO₄')
  ink(ctx, '#71717a')
  ctx.fillRect(zn - 6, y - 46, 12, 70)
  textAt(ctx, 'Zn −', zn, y - 60, 13, INK.red)
  ink(ctx, INK.image)
  ctx.fillRect(cu - 6, y - 46, 12, 70)
  textAt(ctx, 'Cu +', cu, y - 60, 13, INK.blue)
  ink(ctx, INK.text)
  ctx.beginPath()
  ctx.moveTo(zn, y - 46)
  ctx.lineTo(zn, 58)
  ctx.lineTo(scene.switchX - 16, 58)
  ctx.moveTo(scene.switchX + 16, 58)
  ctx.lineTo(cu, 58)
  ctx.lineTo(cu, y - 46)
  ctx.stroke()
  if (cell.closed) {
    ink(ctx, INK.green)
    ctx.beginPath()
    ctx.moveTo(scene.switchX - 16, 58)
    ctx.lineTo(scene.switchX + 16, 58)
    ctx.stroke()
    const phase = wrap01(time * 0.45)
    const x = zn + phase * (cu - zn)
    ink(ctx, INK.amber)
    ctx.beginPath()
    ctx.arc(x, 48, 3.2, 0, Math.PI * 2)
    ctx.fill()
    textAt(ctx, 'e⁻', x, 34, 11, INK.amber)
  } else {
    ink(ctx, INK.red)
    ctx.beginPath()
    ctx.moveTo(scene.switchX - 16, 58)
    ctx.lineTo(scene.switchX + 10, 40)
    ctx.stroke()
  }
  knob(ctx, scene.switchX, scene.switchY + 18)
  textAt(ctx, cell.closed ? 'đóng' : 'mở', scene.switchX, scene.switchY + 34, 11, INK.sky)
  ink(ctx, INK.violet)
  ctx.beginPath()
  ctx.moveTo(zn + 36, y + 16)
  ctx.quadraticCurveTo(w / 2, y - 24, cu - 36, y + 16)
  ctx.stroke()
  textAt(ctx, 'cầu muối', w / 2, y - 8, 11, INK.violet)
  if (cell.closed) {
    textAt(ctx, 'cation → Cu', w * 0.58, y + 8, 11, INK.blue)
    textAt(ctx, 'anion → Zn', w * 0.42, y + 24, 11, INK.red)
  }
  textAt(ctx, 'Zn → Zn²⁺ + 2e⁻', zn, h - 16, 11, INK.red)
  textAt(ctx, 'Cu²⁺ + 2e⁻ → Cu', cu, h - 16, 11, INK.blue)
  textAt(ctx, cell.closed ? 'E° ≈ 1,10 V' : 'mạch hở, không có dòng', w / 2, 22, 12, INK.text)
  ctx.restore()
}

/** Zn + 2HCl. Tốc độ nhân đôi mỗi 10°C. Tám khối bằng nhau thì diện tích gấp đôi. */
export function reactionRate(pieces = 1, celsius = 25) {
  const n = clamp(Math.round(pieces), 1, 8)
  const temperature = clamp(celsius, 20, 60)
  const surface = Math.pow(n, 1 / 3)
  const thermal = Math.pow(2, (temperature - 25) / 10)
  return { pieces: n, temperature, surface, thermal, rate: surface * thermal }
}

export function rateScene(w: number, h: number, tune?: number[]) {
  const pieces = clamp(Math.round(tuneAt(tune, 0, 1)), 1, 8)
  const temperature = clamp(tuneAt(tune, 1, 25), 20, 60)
  return {
    state: reactionRate(pieces, temperature),
    pieceX: 86 + ((pieces - 1) / 7) * (w * 0.42),
    pieceY: h - 42,
    tempX: w * 0.78,
    tempY: 70 + ((temperature - 20) / 40) * (h * 0.45),
  }
}

export function drawRate(ctx: Ctx, w: number, h: number, tune: number[] | undefined, time: number) {
  const scene = rateScene(w, h, tune)
  const state = scene.state
  const beakerX = w * 0.4
  const top = h * 0.42
  ctx.save()
  ctx.lineWidth = 1.6
  ink(ctx, INK.text)
  ctx.beginPath()
  ctx.moveTo(beakerX - 70, top)
  ctx.lineTo(beakerX - 58, h - 58)
  ctx.lineTo(beakerX + 58, h - 58)
  ctx.lineTo(beakerX + 70, top)
  ctx.stroke()
  ctx.fillStyle = 'rgba(254, 226, 226, 0.55)'
  ctx.fillRect(beakerX - 54, top + 28, 108, h - top - 92)
  textAt(ctx, 'HCl', beakerX + 40, top + 44, 12, INK.red)
  const cols = Math.min(4, state.pieces)
  const rows = Math.ceil(state.pieces / cols)
  const size = 18 / Math.pow(state.pieces, 1 / 6)
  ink(ctx, '#71717a')
  for (let i = 0; i < state.pieces; i += 1) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = beakerX - ((cols - 1) * (size + 4)) / 2 + col * (size + 4)
    const y = h - 86 - row * (size + 3)
    ctx.strokeRect(x - size / 2, y - size / 2, size, size)
  }
  const bubbles = Math.max(1, Math.round(state.rate))
  ink(ctx, INK.muted)
  for (let i = 0; i < Math.min(bubbles, 8); i += 1) {
    const phase = wrap01(time * (0.4 + state.rate * 0.15) + i * 0.17)
    ctx.beginPath()
    ctx.arc(beakerX - 30 + (i % 4) * 16, top + 70 - phase * 40, 2 + (i % 3), 0, Math.PI * 2)
    ctx.fill()
  }
  textAt(ctx, 'H₂', beakerX - 48, top + 16, 12, INK.blue)
  ink(ctx, INK.muted)
  ctx.beginPath()
  ctx.moveTo(86, scene.pieceY)
  ctx.lineTo(w * 0.42 + 86, scene.pieceY)
  ctx.stroke()
  knob(ctx, scene.pieceX, scene.pieceY)
  textAt(ctx, `${state.pieces} mảnh`, scene.pieceX, scene.pieceY + 16, 11, INK.sky)
  knob(ctx, scene.tempX, scene.tempY)
  textAt(ctx, `${Math.round(state.temperature)}°C`, scene.tempX + 28, scene.tempY, 12, INK.red)
  textAt(
    ctx,
    `diện tích ×${state.surface.toFixed(2)} · nhiệt ×${state.thermal.toFixed(2)}`,
    w / 2,
    24,
    12,
    INK.text,
  )
  ctx.restore()
}

export function drawChemBench(ctx: Ctx, id: string, w: number, h: number, variant: string, tune: number[] | undefined, time: number) {
  if (id === 'distill') drawDistill(ctx, w, h, tune, time)
  else if (id === 'gaslab') drawGasLab(ctx, w, h, variant, time)
  else if (id === 'filter') drawFilter(ctx, w, h, time)
  else if (id === 'galvanic') drawGalvanic(ctx, w, h, tune, time)
  else if (id === 'rate') drawRate(ctx, w, h, tune, time)
}

export function chemHandles(figure: string, _variant: string, tune: number[] | undefined, w: number, h: number): BenchHandle[] {
  if (figure === 'distill') {
    const scene = distillScene(w, h, tune)
    const x = scene.slider0 + scene.state.flame * (scene.slider1 - scene.slider0)
    return [{ id: 'flame', x, y: scene.flameY }]
  }
  if (figure === 'galvanic') {
    const scene = galvanicScene(w, h, tune)
    return [{ id: 'switch', x: scene.switchX, y: scene.switchY + 18 }]
  }
  if (figure === 'rate') {
    const scene = rateScene(w, h, tune)
    return [
      { id: 'pieces', x: scene.pieceX, y: scene.pieceY },
      { id: 'temp', x: scene.tempX, y: scene.tempY },
    ]
  }
  return []
}

export function moveChemBench(
  figure: string,
  tune: number[] | undefined,
  w: number,
  h: number,
  handle: string,
  x: number,
  y: number,
): number[] | null {
  if (figure === 'distill' && handle === 'flame') {
    const scene = distillScene(w, h, tune)
    return [clamp((x - scene.slider0) / (scene.slider1 - scene.slider0), 0, 1)]
  }
  if (figure === 'galvanic' && handle === 'switch') {
    return [x >= w * 0.5 ? 1 : 0]
  }
  if (figure === 'rate' && handle === 'pieces') {
    const scene = rateScene(w, h, tune)
    const left = 86
    const right = w * 0.42 + 86
    const t = clamp((x - left) / (right - left), 0, 1)
    return [clamp(Math.round(1 + t * 7), 1, 8), scene.state.temperature]
  }
  if (figure === 'rate' && handle === 'temp') {
    const scene = rateScene(w, h, tune)
    const t = clamp((y - 70) / (h * 0.45), 0, 1)
    return [scene.state.pieces, 20 + t * 40]
  }
  return null
}
