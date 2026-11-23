import { INK, clamp, ink, knob, textAt, tuneAt, wrap01, type Ctx } from './bench-style'

/**
 * Thí nghiệm quang điện lớp 12, ống chân không lí tưởng.
 * h = 6,625×10⁻³⁴ J·s, e = 1,6×10⁻¹⁹ C, c = 3×10⁸ m/s, m = 9,1×10⁻³¹ kg.
 * Công thoát quang điện của mặt sạch: Cs 2,14 eV, K 2,30 eV, Na 2,36 eV, Zn 4,33 eV.
 * Einstein: eUh = hf − A. Uh và vmax không phụ thuộc cường độ.
 * Dưới ngưỡng (hf ≤ A, tức λ ≥ λ₀) thì không có electron, I = 0 với mọi U và mọi cường độ.
 * Trên ngưỡng, mỗi photon bật tối đa một electron nên Ibh tỉ lệ thông lượng photon, không tỉ lệ λ.
 * Đường I–U: I = 0 khi U ≤ −Uh. Khi hãm, phần electron tới anôt là (1 + U/Uh)².
 * Hệ số 0,92 tại U = 0 là chỗ ống chưa gom hết electron; Uh và luật Ibh không đổi vì hệ số này.
 */

export const PE_H = 6.625e-34
export const PE_E = 1.6e-19
export const PE_C = 3e8
export const PE_M = 9.1e-31
export const PE_HC_EV_NM = (PE_H * PE_C / PE_E) * 1e9
export const PE_LAMBDA_MIN = 200
export const PE_LAMBDA_MAX = 720
export const PE_U_MIN = -4.6
export const PE_U_MAX = 4.6
export const PE_I_FULL = 8
export const GLASS_CUTOFF_NM = 340
export const SCOPE_Q_EQ = 0.05
export const SCOPE_TAU = 1.1

const COLLECT_GAP = 0.08
const COLLECT_VOLT = 0.28
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'

export type PhotoMetal = { id: 'cs' | 'k' | 'na' | 'zn'; name: string; symbol: string; workEv: number }

const METALS: Record<PhotoMetal['id'], PhotoMetal> = {
  cs: { id: 'cs', name: 'xesi', symbol: 'Cs', workEv: 2.14 },
  k: { id: 'k', name: 'kali', symbol: 'K', workEv: 2.3 },
  na: { id: 'na', name: 'natri', symbol: 'Na', workEv: 2.36 },
  zn: { id: 'zn', name: 'kẽm', symbol: 'Zn', workEv: 4.33 },
}

export type PhotoRegime = 'below' | 'dark' | 'stop' | 'retard' | 'rise' | 'sat'

export type PhotoState = {
  metal: PhotoMetal
  lambdaNm: number
  frequency: number
  intensity: number
  voltage: number
  photonEv: number
  workEv: number
  thresholdNm: number
  thresholdHz: number
  above: boolean
  kineticEv: number
  stopping: number
  speed: number
  saturation: number
  current: number
  regime: PhotoRegime
}

export type ScopeState = {
  lambdaNm: number
  frequency: number
  photonEv: number
  workEv: number
  thresholdNm: number
  glassOn: boolean
  blocked: boolean
  above: boolean
  canEmit: boolean
  q0: number
  q: number
  qEq: number
  leaf: number
  mode: 'below' | 'glass' | 'held' | 'leave'
}

export function photoMetal(variant: string): PhotoMetal {
  if (variant === 'k') return METALS.k
  if (variant === 'na') return METALS.na
  if (variant === 'zn' || variant === 'scope') return METALS.zn
  return METALS.cs
}

export function lightBand(lambdaNm: number) {
  if (lambdaNm < 380) return 'tử ngoại'
  if (lambdaNm < 450) return 'tím'
  if (lambdaNm < 495) return 'lam'
  if (lambdaNm < 570) return 'lục'
  if (lambdaNm < 590) return 'vàng'
  if (lambdaNm < 625) return 'cam'
  return 'đỏ'
}

export function beamColor(lambdaNm: number) {
  if (lambdaNm < 380) return 'rgb(109, 40, 217)'
  const nm = clamp(lambdaNm, 380, 700)
  let r = 0
  let g = 0
  let b = 0
  if (nm < 440) {
    r = ((440 - nm) / 60) * 255
    b = 255
  } else if (nm < 490) {
    g = ((nm - 440) / 50) * 255
    b = 255
  } else if (nm < 510) {
    g = 255
    b = ((510 - nm) / 20) * 255
  } else if (nm < 580) {
    r = ((nm - 510) / 70) * 255
    g = 255
  } else if (nm < 645) {
    r = 255
    g = ((645 - nm) / 65) * 255
  } else r = 255
  return `rgb(${Math.round(clamp(r, 0, 255))}, ${Math.round(clamp(g, 0, 255))}, ${Math.round(clamp(b, 0, 255))})`
}

export function sci(value: number, digits = 2) {
  if (!Number.isFinite(value) || value === 0) return '0'
  const exp = Math.floor(Math.log10(Math.abs(value)))
  const mant = value / 10 ** exp
  if (exp === 0) return mant.toFixed(digits)
  const sign = exp < 0 ? '⁻' : ''
  const body = String(Math.abs(exp)).replace(/\d/g, (digit) => SUP[Number(digit)] ?? digit)
  return `${mant.toFixed(digits)}×10${sign}${body}`
}

/** Dòng quang điện (μA). I = 0 tại và dưới −Uh. Liên tục tại U = 0. */
export function cellCurrent(voltage: number, stopping: number, saturation: number) {
  if (!(saturation > 0) || !(stopping > 0)) return 0
  if (voltage <= -stopping) return 0
  const meet = 1 - COLLECT_GAP
  if (voltage >= 0) return saturation * (1 - COLLECT_GAP * Math.exp(-voltage / COLLECT_VOLT))
  return saturation * meet * (1 + voltage / stopping) ** 2
}

export function photoelectricState(variant: string, lambdaNm: number, intensity: number, voltage: number): PhotoState {
  const metal = photoMetal(variant)
  const lambda = clamp(lambdaNm, PE_LAMBDA_MIN, PE_LAMBDA_MAX)
  const power = clamp(intensity, 0, 1)
  const voltageV = clamp(voltage, PE_U_MIN, PE_U_MAX)
  const frequency = PE_C / (lambda * 1e-9)
  const photonEv = PE_HC_EV_NM / lambda
  const thresholdNm = PE_HC_EV_NM / metal.workEv
  const thresholdHz = (metal.workEv * PE_E) / PE_H
  const above = photonEv > metal.workEv
  const kineticEv = above ? photonEv - metal.workEv : 0
  const stopping = kineticEv
  const speed = kineticEv > 0 ? Math.sqrt((2 * kineticEv * PE_E) / PE_M) : 0
  const saturation = above && power > 0 ? PE_I_FULL * power : 0
  const current = cellCurrent(voltageV, stopping, saturation)
  let regime: PhotoRegime = 'sat'
  if (!above) regime = 'below'
  else if (power <= 0) regime = 'dark'
  else if (voltageV <= -stopping) regime = 'stop'
  else if (voltageV < 0) regime = 'retard'
  else if (current < saturation * 0.97) regime = 'rise'
  return {
    metal,
    lambdaNm: lambda,
    frequency,
    intensity: power,
    voltage: voltageV,
    photonEv,
    workEv: metal.workEv,
    thresholdNm,
    thresholdHz,
    above,
    kineticEv,
    stopping,
    speed,
    saturation,
    current,
    regime,
  }
}

export function cellStatus(state: PhotoState) {
  if (state.regime === 'below') return 'λ ≥ λ₀, không có electron quang điện dù tăng cường độ'
  if (state.regime === 'dark') return 'chưa chiếu, I = 0, Uh vẫn chỉ phụ thuộc f và A'
  if (state.regime === 'stop') return 'U ≤ −Uh, mọi electron quay lại catôt, I = 0'
  if (state.regime === 'retard') return 'điện trường hãm, chỉ electron đủ động năng tới anôt'
  if (state.regime === 'rise') return 'anôt dương, dòng đang tiến tới bão hòa'
  return 'dòng bão hòa, mọi electron quang điện tới anôt'
}

export function cellCaption(state: PhotoState) {
  const line1 = `${state.metal.name} ${state.metal.symbol} · A = ${state.workEv.toFixed(2)} eV · λ₀ = ${state.thresholdNm.toFixed(0)} nm · f₀ = ${sci(state.thresholdHz, 2)} Hz`
  const line2 = `λ = ${state.lambdaNm.toFixed(0)} nm · ${lightBand(state.lambdaNm)} · f = ${sci(state.frequency, 2)} Hz · hf = ${state.photonEv.toFixed(2)} eV`
  const line3 = state.above
    ? `Kmax = ${state.kineticEv.toFixed(2)} eV · Uh = ${state.stopping.toFixed(2)} V · vmax = ${sci(state.speed, 2)} m/s · eUh = hf − A`
    : 'hf ≤ A · electron không rời kim loại · không đo được Uh'
  const line4 = `${cellStatus(state)} · I = ${state.current.toFixed(2)} μA · Ibh = ${state.saturation.toFixed(2)} μA`
  return [line1, line2, line3, line4]
}

export function electroscopeState(lambdaNm: number, glass: number, charge: number, time: number): ScopeState {
  const lambda = clamp(lambdaNm, PE_LAMBDA_MIN, PE_LAMBDA_MAX)
  const metal = METALS.zn
  const photonEv = PE_HC_EV_NM / lambda
  const thresholdNm = PE_HC_EV_NM / metal.workEv
  const above = photonEv > metal.workEv
  const glassOn = glass >= 0.5
  const blocked = glassOn && lambda < GLASS_CUTOFF_NM
  const canEmit = above && !blocked
  const q0 = clamp(charge, -1, 1)
  const t = Number.isFinite(time) ? Math.max(0, time) : 0
  const held = !canEmit || q0 > SCOPE_Q_EQ
  const q = held ? q0 : SCOPE_Q_EQ + (q0 - SCOPE_Q_EQ) * Math.exp(-t / SCOPE_TAU)
  let mode: ScopeState['mode'] = 'leave'
  if (!above) mode = 'below'
  else if (blocked) mode = 'glass'
  else if (q0 > SCOPE_Q_EQ) mode = 'held'
  return {
    lambdaNm: lambda,
    frequency: PE_C / (lambda * 1e-9),
    photonEv,
    workEv: metal.workEv,
    thresholdNm,
    glassOn,
    blocked,
    above,
    canEmit,
    q0,
    q,
    qEq: SCOPE_Q_EQ,
    leaf: Math.abs(q),
    mode,
  }
}

export function scopeStatus(state: ScopeState) {
  if (state.mode === 'below') return 'λ ≥ λ₀ của kẽm, ánh sáng này không bật electron'
  if (state.mode === 'glass') return 'kính hấp thụ λ < 340 nm, tử ngoại không tới tấm kẽm'
  if (state.mode === 'held') return 'tấm đang dương, electron bị hút lại, lá không khép'
  return 'tử ngoại làm electron rời tấm kẽm'
}

export function scopeCaption(state: ScopeState) {
  const charge = state.q < -0.08 ? 'âm' : state.q > 0.08 ? 'dương nhẹ' : 'gần trung hoà'
  return [
    `kẽm Zn · A = ${state.workEv.toFixed(2)} eV · λ₀ = ${state.thresholdNm.toFixed(0)} nm · kính chặn λ < ${GLASS_CUTOFF_NM} nm`,
    `λ = ${state.lambdaNm.toFixed(0)} nm · ${lightBand(state.lambdaNm)} · hf = ${state.photonEv.toFixed(2)} eV`,
    `${scopeStatus(state)} · lá điện nghiệm ${charge}`,
  ]
}

function sliderSpan(w: number) {
  const slider0 = Math.min(72, Math.max(28, w * 0.09))
  const slider1 = Math.max(slider0 + 24, Math.min(w * 0.42, w * 0.48 - 12))
  return { slider0, slider1, span: slider1 - slider0 }
}

export function cellLayout(w: number, h: number, variant: string, tune?: number[]) {
  const lambda = clamp(tuneAt(tune, 0, 450), PE_LAMBDA_MIN, PE_LAMBDA_MAX)
  const intensity = clamp(tuneAt(tune, 1, 0.75), 0, 1)
  const voltage = clamp(tuneAt(tune, 2, 1), PE_U_MIN, PE_U_MAX)
  const state = photoelectricState(variant, lambda, intensity, voltage)
  const { slider0, slider1, span } = sliderSpan(w)
  const tube = { x: w * 0.125, y: h * 0.09, w: Math.min(176, w * 0.24), h: Math.min(84, h * 0.15) }
  const k = { x: tube.x + tube.w * 0.24, y: tube.y + tube.h * 0.52 }
  const a = { x: tube.x + tube.w * 0.76, y: tube.y + tube.h * 0.52 }
  const lamp = { x: Math.max(18, w * 0.055), y: k.y }
  const meterY = h * 0.3
  const upperY = h * 0.36
  const busY = h * 0.42
  const yLambda = h * 0.52
  const yPower = h * 0.585
  const yVolt = h * 0.65
  return {
    state,
    slider0,
    slider1,
    tube,
    k,
    a,
    lamp,
    meterY,
    upperY,
    busY,
    yLambda,
    yPower,
    yVolt,
    lambdaX: slider0 + ((lambda - PE_LAMBDA_MIN) / (PE_LAMBDA_MAX - PE_LAMBDA_MIN)) * span,
    powerX: slider0 + intensity * span,
    voltX: slider0 + ((voltage - PE_U_MIN) / (PE_U_MAX - PE_U_MIN)) * span,
    iu: { x: w * 0.52, y: h * 0.07, w: w * 0.44, h: h * 0.3 },
    ein: { x: w * 0.52, y: h * 0.4, w: w * 0.44, h: h * 0.28 },
  }
}

export function scopeLayout(w: number, h: number, tune?: number[]) {
  const lambda = clamp(tuneAt(tune, 0, 250), PE_LAMBDA_MIN, PE_LAMBDA_MAX)
  const glass = tuneAt(tune, 1, 0) >= 0.5 ? 1 : 0
  const charge = clamp(tuneAt(tune, 2, -1), -1, 1)
  const { slider0, slider1, span } = sliderSpan(w)
  const beamY = h * 0.3
  const outY = beamY - h * 0.13
  const inY = beamY
  return {
    lambda,
    glass,
    charge,
    beamY,
    lampX: Math.max(22, w * 0.07),
    glassX: w * 0.22,
    plateX: w * 0.4,
    outY,
    inY,
    glassY: glass ? inY : outY,
    midGlass: (outY + inY) / 2,
    slider0,
    slider1,
    yLambda: h * 0.74,
    yCharge: h * 0.84,
    lambdaX: slider0 + ((lambda - PE_LAMBDA_MIN) / (PE_LAMBDA_MAX - PE_LAMBDA_MIN)) * span,
    chargeX: slider0 + ((charge + 1) / 2) * span,
    bar: { x: w * 0.56, y: h * 0.22, w: w * 0.36, h: 18 },
  }
}

function dial(ctx: Ctx, x: number, y: number, frac: number, color: string) {
  ctx.beginPath()
  ctx.arc(x, y, 18, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = INK.text
  ctx.lineWidth = 1.5
  ctx.fill()
  ctx.stroke()
  const start = -Math.PI * 0.8
  const end = -Math.PI * 0.2
  ink(ctx, INK.muted)
  ctx.beginPath()
  ctx.arc(x, y, 11, start, end)
  ctx.stroke()
  const ang = start + clamp(frac, 0, 1) * (end - start)
  ink(ctx, color)
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + Math.cos(ang) * 10, y + Math.sin(ang) * 10)
  ctx.stroke()
}

function track(ctx: Ctx, x0: number, x1: number, y: number, x: number, name: string, value: string) {
  ink(ctx, INK.muted)
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x0, y)
  ctx.lineTo(x1, y)
  ctx.stroke()
  textAt(ctx, name, x0 - 16, y, 12, INK.sky)
  knob(ctx, x, y)
  textAt(ctx, value, x, y - 14, 11, INK.sky)
}

function carriers(ctx: Ctx, x0: number, x1: number, y: number, state: PhotoState, time: number) {
  if (!state.above || state.intensity <= 0) return
  const back = state.voltage <= -state.stopping
  const count = back ? 4 : Math.max(2, Math.round(2 + 4 * state.intensity))
  const pace = 0.28 + 0.4 * clamp(state.kineticEv / 3, 0, 1)
  const t0 = Number.isFinite(time) ? time : 0
  ink(ctx, INK.blue)
  for (let i = 0; i < count; i += 1) {
    const p = wrap01(t0 * pace + i / count)
    const along = back ? Math.sin(Math.PI * p) : p
    const x = x0 + along * (x1 - x0) * (back ? 0.42 : 1)
    const lift = back ? -Math.sin(Math.PI * p) * 14 : Math.sin(p * Math.PI) * (state.voltage < 0 ? 8 : 3)
    ctx.beginPath()
    ctx.arc(x, y + lift, 2.3, 0, Math.PI * 2)
    ctx.fill()
  }
}

function plotFrame(ctx: Ctx, box: { x: number; y: number; w: number; h: number }, title: string) {
  textAt(ctx, title, box.x + box.w / 2, box.y - 10, 12, INK.text)
  ink(ctx, INK.muted)
  ctx.lineWidth = 1.2
  ctx.strokeRect(box.x, box.y, box.w, box.h)
}

function drawIU(ctx: Ctx, box: { x: number; y: number; w: number; h: number }, state: PhotoState) {
  plotFrame(ctx, box, 'Đặc trưng I–U')
  const padL = 34
  const padB = 20
  const padT = 8
  const padR = 8
  const x0 = box.x + padL
  const y0 = box.y + padT
  const pw = Math.max(8, box.w - padL - padR)
  const ph = Math.max(8, box.h - padT - padB)
  const iMax = 10
  const mapU = (u: number) => x0 + ((u - PE_U_MIN) / (PE_U_MAX - PE_U_MIN)) * pw
  const mapI = (i: number) => y0 + ph - (clamp(i, 0, iMax) / iMax) * ph
  ink(ctx, INK.muted)
  ctx.lineWidth = 1
  for (const u of [-4, -2, 0, 2, 4]) {
    const x = mapU(u)
    ctx.beginPath()
    ctx.moveTo(x, y0 + ph)
    ctx.lineTo(x, y0 + ph + 4)
    ctx.stroke()
    textAt(ctx, String(u), x, y0 + ph + 12, 10, INK.muted)
  }
  for (const i of [0, 4, 8]) {
    const y = mapI(i)
    textAt(ctx, String(i), x0 - 12, y, 10, INK.muted)
  }
  textAt(ctx, 'U (V)', x0 + pw - 8, y0 + ph - 8, 10, INK.muted)
  textAt(ctx, 'μA', x0 + 8, y0 + 8, 10, INK.muted)
  const drawCurve = (saturation: number, color: string, width: number) => {
    ink(ctx, color)
    ctx.lineWidth = width
    ctx.beginPath()
    const steps = 64
    for (let i = 0; i <= steps; i += 1) {
      const u = PE_U_MIN + (i / steps) * (PE_U_MAX - PE_U_MIN)
      const x = mapU(u)
      const y = mapI(cellCurrent(u, state.stopping, saturation))
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.save()
  ctx.beginPath()
  ctx.rect(x0, y0, pw, ph)
  ctx.clip()
  if (state.above) {
    const other = state.intensity > 0.55 ? 0.3 : 0.85
    drawCurve(PE_I_FULL * other, '#94a3b8', 1.2)
  }
  drawCurve(state.saturation, INK.blue, 1.8)
  if (state.above && state.stopping > 0.05) {
    ink(ctx, INK.red)
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(mapU(-state.stopping), y0)
    ctx.lineTo(mapU(-state.stopping), y0 + ph)
    ctx.stroke()
    ctx.setLineDash([])
  }
  ink(ctx, INK.amber)
  ctx.beginPath()
  ctx.arc(mapU(state.voltage), mapI(state.current), 3.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  if (state.above && state.stopping > 0.05) textAt(ctx, '−Uh', mapU(-state.stopping), y0 - 2, 10, INK.red)
  if (state.above) textAt(ctx, 'nét mờ: cường độ khác, cùng Uh', x0 + pw * 0.55, y0 + 10, 10, INK.muted)
}

function drawEinstein(ctx: Ctx, box: { x: number; y: number; w: number; h: number }, state: PhotoState) {
  plotFrame(ctx, box, 'Uh theo f · độ dốc h/e')
  const padL = 32
  const padB = 18
  const padT = 8
  const padR = 8
  const x0 = box.x + padL
  const y0 = box.y + padT
  const pw = Math.max(8, box.w - padL - padR)
  const ph = Math.max(8, box.h - padT - padB)
  const fMin = 4e14
  const fMax = 1.55e15
  const uMin = -4.6
  const uMax = 4.6
  const mapF = (f: number) => x0 + ((f - fMin) / (fMax - fMin)) * pw
  const mapU = (u: number) => y0 + ph - ((u - uMin) / (uMax - uMin)) * ph
  const uhOf = (f: number) => (PE_H * f) / PE_E - state.workEv
  ink(ctx, INK.muted)
  ctx.lineWidth = 1
  const zeroY = mapU(0)
  ctx.beginPath()
  ctx.moveTo(x0, zeroY)
  ctx.lineTo(x0 + pw, zeroY)
  ctx.stroke()
  for (const tick of [4, 8, 12]) {
    const x = mapF(tick * 1e14)
    textAt(ctx, String(tick), x, y0 + ph + 10, 10, INK.muted)
  }
  textAt(ctx, '×10¹⁴ Hz', x0 + pw - 28, y0 + ph + 10, 10, INK.muted)
  ctx.save()
  ctx.beginPath()
  ctx.rect(x0, y0, pw, ph)
  ctx.clip()
  const steps = 48
  ink(ctx, INK.violet)
  ctx.lineWidth = 1.6
  ctx.beginPath()
  let pen = false
  for (let i = 0; i <= steps; i += 1) {
    const f = fMin + (i / steps) * (fMax - fMin)
    const u = uhOf(f)
    if (u < 0) {
      pen = false
      continue
    }
    const x = mapF(f)
    const y = mapU(u)
    if (!pen) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
    pen = true
  }
  ctx.stroke()
  ctx.setLineDash([3, 3])
  ctx.beginPath()
  pen = false
  for (let i = 0; i <= steps; i += 1) {
    const f = fMin + (i / steps) * (fMax - fMin)
    const u = uhOf(f)
    if (u > 0) {
      pen = false
      continue
    }
    const x = mapF(f)
    const y = mapU(clamp(u, uMin, uMax))
    if (!pen) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
    pen = true
  }
  ctx.stroke()
  ctx.setLineDash([])
  const f0 = state.thresholdHz
  ink(ctx, INK.red)
  ctx.beginPath()
  ctx.arc(mapF(f0), zeroY, 3, 0, Math.PI * 2)
  ctx.fill()
  if (state.above) {
    ink(ctx, INK.amber)
    ctx.beginPath()
    ctx.arc(mapF(state.frequency), mapU(state.stopping), 3.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
  textAt(ctx, 'f₀', mapF(f0), zeroY - 12, 10, INK.red)
}

function drawCell(ctx: Ctx, w: number, h: number, variant: string, tune: number[] | undefined, time: number) {
  const scene = cellLayout(w, h, variant, tune)
  const state = scene.state
  ctx.save()
  ctx.lineWidth = 1.6
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  textAt(ctx, `Tế bào quang điện · catôt ${state.metal.name}`, w * 0.24, h * 0.035, 13, INK.text)
  textAt(ctx, 'chân không · một photon, một electron · không có độ trễ', w * 0.24, h * 0.062, 11, INK.muted)
  const color = beamColor(state.lambdaNm)
  const on = state.intensity > 0
  ink(ctx, INK.text)
  ctx.beginPath()
  ctx.arc(scene.lamp.x, scene.lamp.y, 13, 0, Math.PI * 2)
  ctx.stroke()
  if (on) {
    ctx.save()
    ctx.globalAlpha = 0.35 + 0.55 * state.intensity
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(scene.lamp.x, scene.lamp.y, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(scene.lamp.x + 16, scene.lamp.y)
    ctx.lineTo(scene.tube.x, scene.k.y)
    ctx.stroke()
    ctx.restore()
  }
  textAt(ctx, on ? lightBand(state.lambdaNm) : 'tắt', scene.lamp.x, scene.lamp.y + 24, 11, INK.muted)
  ink(ctx, INK.text)
  ctx.strokeRect(scene.tube.x, scene.tube.y, scene.tube.w, scene.tube.h)
  ctx.beginPath()
  ctx.arc(scene.k.x, scene.k.y, 16, Math.PI / 2, -Math.PI / 2, true)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(scene.a.x, scene.a.y - 16)
  ctx.lineTo(scene.a.x, scene.a.y + 16)
  ctx.stroke()
  textAt(ctx, 'K', scene.k.x, scene.tube.y + scene.tube.h - 10, 12, INK.blue)
  textAt(ctx, 'A', scene.a.x, scene.tube.y + scene.tube.h - 10, 12, INK.red)
  const anodePlus = state.voltage > 0
  textAt(ctx, anodePlus ? '+' : '−', scene.a.x, scene.tube.y + 14, 13, anodePlus ? INK.red : INK.blue)
  textAt(ctx, anodePlus ? '−' : '+', scene.k.x, scene.tube.y + 14, 13, anodePlus ? INK.blue : INK.red)
  carriers(ctx, scene.k.x + 18, scene.a.x - 8, scene.k.y, state, time)
  ink(ctx, INK.text)
  ctx.beginPath()
  ctx.moveTo(scene.k.x, scene.tube.y + scene.tube.h)
  ctx.lineTo(scene.k.x, scene.busY)
  ctx.lineTo(scene.a.x, scene.busY)
  ctx.lineTo(scene.a.x, scene.tube.y + scene.tube.h)
  ctx.moveTo(scene.k.x, scene.upperY)
  ctx.lineTo(scene.a.x, scene.upperY)
  ctx.stroke()
  dial(ctx, scene.k.x, scene.meterY, state.current / 10, INK.blue)
  textAt(ctx, `${state.current.toFixed(2)} μA`, scene.k.x - 46, scene.meterY, 10, INK.blue)
  const voltFrac = (state.voltage - PE_U_MIN) / (PE_U_MAX - PE_U_MIN)
  dial(ctx, (scene.k.x + scene.a.x) / 2, scene.upperY, voltFrac, INK.green)
  textAt(ctx, 'V', (scene.k.x + scene.a.x) / 2, scene.upperY - 24, 10, INK.green)
  const signed = `${state.voltage >= 0 ? '+' : ''}${state.voltage.toFixed(2)} V`
  textAt(ctx, `U_AK ${signed}`, (scene.k.x + scene.a.x) / 2, scene.busY + 14, 11, INK.text)
  track(ctx, scene.slider0, scene.slider1, scene.yLambda, scene.lambdaX, 'λ', `${state.lambdaNm.toFixed(0)} nm`)
  track(ctx, scene.slider0, scene.slider1, scene.yPower, scene.powerX, 'cđ', `${Math.round(state.intensity * 100)}%`)
  track(ctx, scene.slider0, scene.slider1, scene.yVolt, scene.voltX, 'U', signed)
  drawIU(ctx, scene.iu, state)
  drawEinstein(ctx, scene.ein, state)
  const lines = cellCaption(state)
  lines.forEach((line, index) => {
    textAt(ctx, line, w / 2, h * (0.74 + index * 0.06), 12, index === 3 ? INK.text : INK.muted)
  })
  ctx.restore()
}

function spectrumBar(
  ctx: Ctx,
  bar: { x: number; y: number; w: number; h: number },
  lambda: number,
  threshold: number,
) {
  const n = 48
  for (let i = 0; i < n; i += 1) {
    const t = i / n
    const nm = PE_LAMBDA_MIN + t * (PE_LAMBDA_MAX - PE_LAMBDA_MIN)
    ctx.fillStyle = beamColor(nm)
    ctx.fillRect(bar.x + t * bar.w, bar.y, bar.w / n + 1, bar.h)
  }
  ink(ctx, INK.text)
  ctx.strokeRect(bar.x, bar.y, bar.w, bar.h)
  const at = (nm: number) => bar.x + ((nm - PE_LAMBDA_MIN) / (PE_LAMBDA_MAX - PE_LAMBDA_MIN)) * bar.w
  const mark = (nm: number, label: string, y: number, color: string) => {
    const x = at(nm)
    ink(ctx, color)
    ctx.beginPath()
    ctx.moveTo(x, bar.y - 3)
    ctx.lineTo(x, bar.y + bar.h + 3)
    ctx.stroke()
    textAt(ctx, label, x, y, 11, color)
  }
  mark(threshold, 'λ₀', bar.y - 12, INK.red)
  mark(GLASS_CUTOFF_NM, 'kính', bar.y + bar.h + 14, INK.sky)
  mark(lambda, 'λ', bar.y + bar.h + 28, INK.text)
  textAt(ctx, '200 nm', bar.x, bar.y + bar.h + 44, 10, INK.muted)
  textAt(ctx, '720 nm', bar.x + bar.w, bar.y + bar.h + 44, 10, INK.muted)
}

function drawScope(ctx: Ctx, w: number, h: number, tune: number[] | undefined, time: number) {
  const scene = scopeLayout(w, h, tune)
  const state = electroscopeState(scene.lambda, scene.glass, scene.charge, time)
  ctx.save()
  ctx.lineWidth = 1.6
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  textAt(ctx, 'Tấm kẽm và điện nghiệm', w * 0.24, h * 0.05, 13, INK.text)
  textAt(ctx, 'Hertz: chỉ tử ngoại làm kẽm mất điện âm', w * 0.24, h * 0.085, 11, INK.muted)
  const color = beamColor(state.lambdaNm)
  const reach = state.blocked ? scene.glassX : scene.plateX - 36
  ink(ctx, INK.text)
  ctx.beginPath()
  ctx.arc(scene.lampX, scene.beamY, 13, 0, Math.PI * 2)
  ctx.stroke()
  ctx.save()
  ctx.globalAlpha = 0.8
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(scene.lampX, scene.beamY, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(scene.lampX + 16, scene.beamY)
  ctx.lineTo(reach, scene.beamY)
  ctx.stroke()
  if (state.glassOn && !state.blocked) {
    ctx.globalAlpha = 0.45
    ctx.beginPath()
    ctx.moveTo(scene.glassX + 10, scene.beamY)
    ctx.lineTo(scene.plateX - 36, scene.beamY)
    ctx.stroke()
  }
  ctx.restore()
  ink(ctx, INK.sky)
  ctx.fillStyle = 'rgba(186, 230, 253, 0.55)'
  ctx.strokeStyle = INK.sky
  ctx.fillRect(scene.glassX - 7, scene.glassY - 24, 14, 48)
  ctx.strokeRect(scene.glassX - 7, scene.glassY - 24, 14, 48)
  knob(ctx, scene.glassX, scene.glassY)
  textAt(ctx, state.glassOn ? 'kính chắn' : 'kính để ngoài', scene.glassX, state.glassOn ? scene.glassY - 38 : scene.glassY + 38, 11, INK.sky)
  const plateW = 78
  const plateH = 16
  ink(ctx, '#71717a')
  ctx.fillStyle = '#d4d4d8'
  ctx.fillRect(scene.plateX - plateW / 2, scene.beamY - plateH / 2, plateW, plateH)
  ctx.strokeRect(scene.plateX - plateW / 2, scene.beamY - plateH / 2, plateW, plateH)
  textAt(ctx, 'Zn', scene.plateX, scene.beamY, 12, INK.text)
  const pivot = h * 0.52
  ink(ctx, INK.text)
  ctx.beginPath()
  ctx.moveTo(scene.plateX, scene.beamY + plateH / 2)
  ctx.lineTo(scene.plateX, pivot)
  ctx.stroke()
  const angle = 0.12 + state.leaf * 0.85
  const leaf = Math.min(64, h * 0.12)
  ink(ctx, INK.amber)
  ctx.beginPath()
  ctx.moveTo(scene.plateX, pivot)
  ctx.lineTo(scene.plateX + Math.sin(angle) * leaf, pivot + Math.cos(angle) * leaf)
  ctx.moveTo(scene.plateX, pivot)
  ctx.lineTo(scene.plateX - Math.sin(angle) * leaf, pivot + Math.cos(angle) * leaf)
  ctx.stroke()
  ink(ctx, INK.text)
  ctx.beginPath()
  ctx.moveTo(scene.plateX - 34, pivot - 8)
  ctx.lineTo(scene.plateX - 46, h * 0.68)
  ctx.lineTo(scene.plateX + 46, h * 0.68)
  ctx.lineTo(scene.plateX + 34, pivot - 8)
  ctx.stroke()
  textAt(ctx, 'điện nghiệm', scene.plateX, h * 0.71, 11, INK.muted)
  const t0 = Number.isFinite(time) ? time : 0
  if (state.canEmit) {
    const back = state.mode === 'held'
    ink(ctx, INK.blue)
    for (let i = 0; i < 4; i += 1) {
      const p = wrap01(t0 * 0.45 + i / 4)
      const rise = back ? Math.sin(Math.PI * p) : p
      const x = scene.plateX - 20 + i * 12
      const y = scene.beamY - plateH / 2 - rise * 28
      ctx.beginPath()
      ctx.arc(x, y, 2.2, 0, Math.PI * 2)
      ctx.fill()
    }
    textAt(ctx, back ? 'e⁻ bị kéo lại' : 'e⁻ rời kẽm', scene.plateX, scene.beamY - 36, 11, INK.blue)
  }
  spectrumBar(ctx, scene.bar, state.lambdaNm, state.thresholdNm)
  textAt(ctx, 'vạch đỏ là ngưỡng kẽm, vạch xanh là kính', scene.bar.x + scene.bar.w / 2, scene.bar.y + 78, 11, INK.muted)
  track(ctx, scene.slider0, scene.slider1, scene.yLambda, scene.lambdaX, 'λ', `${state.lambdaNm.toFixed(0)} nm`)
  track(ctx, scene.slider0, scene.slider1, scene.yCharge, scene.chargeX, 'q₀', state.q0 < -0.05 ? 'âm' : state.q0 > 0.05 ? 'dương' : '0')
  const lines = scopeCaption(state)
  lines.forEach((line, index) => {
    textAt(ctx, line, w / 2, h * (0.9 + index * 0.035), 12, index === 2 ? INK.text : INK.muted)
  })
  ctx.restore()
}

export function drawPhotoelectric(ctx: Ctx, w: number, h: number, variant: string, tune: number[] | undefined, time: number) {
  if (variant === 'scope') drawScope(ctx, w, h, tune, time)
  else drawCell(ctx, w, h, variant, tune, time)
}

export function photoelectricHandles(variant: string, tune: number[] | undefined, w: number, h: number) {
  if (variant === 'scope') {
    const scene = scopeLayout(w, h, tune)
    return [
      { id: 'lambda', x: scene.lambdaX, y: scene.yLambda },
      { id: 'glass', x: scene.glassX, y: scene.glassY },
      { id: 'charge', x: scene.chargeX, y: scene.yCharge },
    ]
  }
  const scene = cellLayout(w, h, variant, tune)
  return [
    { id: 'lambda', x: scene.lambdaX, y: scene.yLambda },
    { id: 'intensity', x: scene.powerX, y: scene.yPower },
    { id: 'voltage', x: scene.voltX, y: scene.yVolt },
  ]
}

export function movePhotoelectric(
  variant: string,
  tune: number[] | undefined,
  w: number,
  h: number,
  handle: string,
  x: number,
  y: number,
): number[] | null {
  const along = (x0: number, x1: number) => clamp((x - x0) / (x1 - x0), 0, 1)
  if (variant === 'scope') {
    const scene = scopeLayout(w, h, tune)
    if (handle === 'lambda') {
      const t = along(scene.slider0, scene.slider1)
      return [PE_LAMBDA_MIN + t * (PE_LAMBDA_MAX - PE_LAMBDA_MIN), scene.glass, scene.charge]
    }
    if (handle === 'glass') return [scene.lambda, y >= scene.midGlass ? 1 : 0, scene.charge]
    if (handle === 'charge') {
      const t = along(scene.slider0, scene.slider1)
      return [scene.lambda, scene.glass, -1 + t * 2]
    }
    return null
  }
  const scene = cellLayout(w, h, variant, tune)
  const next = [scene.state.lambdaNm, scene.state.intensity, scene.state.voltage]
  if (handle === 'lambda') {
    const t = along(scene.slider0, scene.slider1)
    next[0] = PE_LAMBDA_MIN + t * (PE_LAMBDA_MAX - PE_LAMBDA_MIN)
    return next
  }
  if (handle === 'intensity') {
    next[1] = along(scene.slider0, scene.slider1)
    return next
  }
  if (handle === 'voltage') {
    const t = along(scene.slider0, scene.slider1)
    next[2] = PE_U_MIN + t * (PE_U_MAX - PE_U_MIN)
    return next
  }
  return null
}
