import { INK, clamp, ink, textAt, tuneAt, type Ctx } from './bench-style'
import {
  C,
  arrowTo,
  axes,
  bottomKnob,
  bottomT,
  bottomX,
  box,
  dot,
  keepTune,
  note,
  say,
  t0,
  title,
} from './figure-draw-kit'
import {
  CARBON_ARROWS,
  METAL_SERIES,
  RUST_EQUATION,
  SHELLS,
  ZINC_COPPER,
  centripetalAccel,
  chanceLeaves,
  clockReading,
  complexModulus,
  diceFace,
  elastic1d,
  enzymeActivity,
  equilibriumProduct,
  firstOrderSlope,
  fractionParts,
  hookeForce,
  inscribedAngle,
  integralArea,
  leverForces,
  linePairAngles,
  normalDensity,
  numberLineValue,
  percentCount,
  proportionPair,
  pythagorasParts,
  rlcAmplitude,
  selectionShares,
  sequenceTerms,
  shellTotal,
  tangentSlope,
  thalesSplits,
  vectorFromTune,
} from './figure-models'
import { registerFigure, type LessonParams } from './figure-registry'

type Draw = (ctx: Ctx, w: number, h: number, p: LessonParams, time: number) => void

function slide(id: string, draw: Draw, runs = false, release?: (p: LessonParams) => number[] | null) {
  registerFigure(id, {
    runs,
    draw: (ctx, w, h, p, time) => {
      draw(ctx, w, h, p, time)
      bottomKnob(ctx, w, h, t0(p.tune))
    },
    handles: (w, h, p) => [{ id: 'k', x: bottomX(w, t0(p.tune)), y: h - 16 }],
    move: (p, w, _h, handle, x) => (handle === 'k' ? keepTune(p.tune, 0, bottomT(w, x)) : null),
    release: release ? (p) => release(p) : undefined,
  })
}

function still(id: string, draw: Draw, runs = false) {
  registerFigure(id, { runs, draw, handles: () => [] })
}

function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color = INK.text) {
  ink(ctx, color)
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

slide('number-line', (ctx, w, h, p) => {
  const variant = p.variant || 'ten'
  const value = numberLineValue(variant, t0(p.tune, 0.4))
  const [lo, hi] = variant === 'hundred' ? [0, 100] : variant === 'integer' ? [-5, 5] : variant === 'fraction' || variant === 'decimal' ? [0, 1] : [0, 10]
  const x0 = 40
  const x1 = w - 40
  const y = h * 0.48
  line(ctx, x0, y, x1, y)
  const ticks = variant === 'hundred' ? 10 : 10
  for (let i = 0; i <= ticks; i += 1) {
    const x = x0 + ((x1 - x0) * i) / ticks
    line(ctx, x, y - 6, x, y + 6, INK.muted)
    const label = lo + ((hi - lo) * i) / ticks
    const text = variant === 'fraction' ? `${i}/10` : variant === 'decimal' ? (label).toFixed(1) : String(Math.round(label))
    textAt(ctx, text, x, y + 22, 11, INK.muted)
  }
  const x = x0 + ((value - lo) / (hi - lo)) * (x1 - x0)
  dot(ctx, x, y, INK.blue, 6)
  const shown = variant === 'decimal' ? value.toFixed(2) : variant === 'fraction' ? `${Math.round(value * 10)}/10` : String(Math.round(value))
  textAt(ctx, shown, x, y - 22, 14, INK.blue)
})

slide('base-ten', (ctx, w, h, p) => {
  const count = clamp(Math.round(t0(p.tune, 0.35) * 20), 0, 20)
  const bundles = Math.floor(count / 10)
  const singles = count % 10
  title(ctx, w, C(`${count} que`, `${count} sticks`, `${count} 根`, `${count} 本`, `${count}개`))
  for (let i = 0; i < bundles; i += 1) {
    box(ctx, 40 + i * 54, 70, 36, 90, INK.amber, '#fef3c7')
    textAt(ctx, '10', 58 + i * 54, 115, 14, INK.amber)
  }
  for (let i = 0; i < singles; i += 1) line(ctx, w * 0.55 + i * 12, 70, w * 0.55 + i * 12, 160, INK.blue)
})

slide('bar-model', (ctx, w, h, p) => {
  const known = 0.25 + t0(p.tune, 0.4) * 0.5
  const x = 40
  const y = h * 0.42
  const width = w - 80
  box(ctx, x, y, width * known, 36, INK.blue, '#dbeafe')
  box(ctx, x + width * known, y, width * (1 - known), 36, INK.amber, '#ffedd5')
  textAt(ctx, say(C('đã biết', 'known', '已知', 'わかっている', '알고 있는 양')), x + width * known / 2, y + 18, 12, INK.blue)
  textAt(ctx, '?', x + width * known + width * (1 - known) / 2, y + 18, 16, INK.amber)
})

slide('percent-bar', (ctx, w, h, p) => {
  const count = percentCount(t0(p.tune, 0.35))
  const x = 30
  const y = h * 0.4
  const cell = (w - 60) / 100
  for (let i = 0; i < 100; i += 1) {
    ctx.fillStyle = i < count ? '#2563eb' : '#e2e8f0'
    ctx.fillRect(x + i * cell, y, Math.max(1, cell - 0.4), 28)
  }
  textAt(ctx, `${count}%`, w / 2, y - 24, 18, INK.blue)
})

slide('proportion', (ctx, w, h, p) => {
  const inverse = p.variant === 'inverse'
  const x = 0.5 + t0(p.tune, 0.35) * 5.5
  const pair = proportionPair(inverse ? 'inverse' : 'direct', x)
  title(ctx, w, inverse ? C('y = 12/x', 'y = 12/x', 'y = 12/x', 'y = 12/x', 'y = 12/x') : C('y = 2x', 'y = 2x', 'y = 2x', 'y = 2x', 'y = 2x'))
  textAt(ctx, `x = ${pair.x.toFixed(2)}`, w * 0.3, h * 0.45, 16, INK.blue)
  textAt(ctx, `y = ${pair.y.toFixed(2)}`, w * 0.7, h * 0.45, 16, INK.green)
  textAt(ctx, inverse ? `x·y = ${pair.product.toFixed(2)}` : `y/x = ${pair.ratio.toFixed(2)}`, w / 2, h * 0.62, 14, INK.amber)
})

slide('sequence-line', (ctx, w, h, p) => {
  const geom = p.variant === 'geom'
  const step = geom ? 2 : -2 + t0(p.tune, 0.7) * 6
  const terms = sequenceTerms(geom ? 'geom' : 'arith', step)
  const y = h * 0.48
  line(ctx, 30, y, w - 30, y)
  terms.forEach((term, index) => {
    const x = 50 + index * ((w - 100) / 4)
    dot(ctx, x, y, INK.blue, 5)
    textAt(ctx, String(Math.round(term)), x, y - 24, 14, INK.text)
  })
})

slide('tangent-graph', (ctx, w, h, p) => {
  const x0 = -1.6 + t0(p.tune, 0.62) * 3.2
  const slope = tangentSlope(x0)
  const ox = 50
  const oy = h * 0.72
  const unit = 46
  axes(ctx, ox, oy, w - 20, 36)
  ink(ctx, INK.blue)
  ctx.beginPath()
  for (let i = 0; i <= 40; i += 1) {
    const x = -1.8 + (3.6 * i) / 40
    const px = ox + x * unit
    const py = oy - x * x * unit * 0.45
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()
  const y0 = x0 * x0
  const px = ox + x0 * unit
  const py = oy - y0 * unit * 0.45
  ink(ctx, INK.amber)
  ctx.beginPath()
  ctx.moveTo(px - 50, py + slope * 22)
  ctx.lineTo(px + 50, py - slope * 22)
  ctx.stroke()
  dot(ctx, px, py, INK.red, 4)
  textAt(ctx, `x₀ = ${x0.toFixed(2)} · y' = ${slope.toFixed(2)}`, w / 2, 28, 13, INK.text)
})

slide('cross-section', (ctx, w, h, p) => {
  const cut = 0.25 + t0(p.tune, 0.4) * 0.5
  const x = 70
  const top = 50
  const bottom = h - 70
  const face = 90
  line(ctx, x, bottom, x + 150, bottom)
  line(ctx, x, bottom, x, top)
  line(ctx, x + 150, bottom, x + 150, top)
  line(ctx, x, top, x + 150, top)
  line(ctx, x + 150, top, x + 210, top + 36, INK.muted)
  line(ctx, x + 150, bottom, x + 210, bottom + 36, INK.muted)
  line(ctx, x + 210, top + 36, x + 210, bottom + 36, INK.muted)
  const y = top + (bottom - top) * cut
  ink(ctx, INK.amber)
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + 150, y)
  ctx.lineTo(x + 210, y + 36)
  ctx.stroke()
  textAt(ctx, say(C('thiết diện', 'section', '截面', '切り口', '단면')), x + 70, y - 16, 12, INK.amber)
})

slide('polar-curve', (ctx, w, h, p) => {
  const a = 28 + t0(p.tune, 0.4) * 36
  const cx = w * 0.5
  const cy = h * 0.46
  ink(ctx, INK.muted)
  line(ctx, cx - 90, cy, cx + 90, cy, INK.muted)
  line(ctx, cx, cy - 80, cx, cy + 80, INK.muted)
  ink(ctx, INK.blue)
  ctx.beginPath()
  const cardioid = p.variant === 'cardioid'
  for (let i = 0; i <= 80; i += 1) {
    const theta = (i / 80) * Math.PI * 2
    const r = cardioid ? a * (1 + Math.cos(theta)) * 0.55 : a
    const x = cx + r * Math.cos(theta)
    const y = cy - r * Math.sin(theta)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  textAt(ctx, cardioid ? 'r = a(1+cos θ)' : 'r = a', w / 2, 24, 13, INK.text)
})

slide('measure-lab', (ctx, w, h, p) => {
  const t = t0(p.tune, 0.4)
  if (p.variant === 'scale') {
    line(ctx, w * 0.35, 40, w * 0.35, h - 50)
    box(ctx, w * 0.35 - 28, 70 + t * 80, 56, 36, INK.blue, '#dbeafe')
    textAt(ctx, `${(t * 5).toFixed(1)} N`, w * 0.62, 120, 16, INK.blue)
    return
  }
  if (p.variant === 'balance') {
    line(ctx, w * 0.5, 70, w * 0.5, h - 60)
    line(ctx, w * 0.22, 90, w * 0.78, 90)
    box(ctx, w * 0.18, 90, 40, 18, INK.amber, '#fef3c7')
    box(ctx, w * 0.68, 90 - t * 20, 40, 18, INK.blue, '#dbeafe')
    textAt(ctx, `${Math.round(t * 200)} g`, w * 0.5, 60, 14, INK.text)
    return
  }
  box(ctx, w * 0.42, 40, 28, h - 90, INK.sky, '#f8fafc')
  ctx.fillStyle = '#ef4444'
  ctx.fillRect(w * 0.45, 50 + (1 - t) * (h - 150), 22, t * (h - 160) + 8)
  textAt(ctx, `${Math.round(10 + t * 80)} °C`, w * 0.68, h * 0.45, 16, INK.red)
})

slide('shadow', (ctx, w, h, p) => {
  const near = t0(p.tune, 0.35)
  const lampX = 50 + near * 40
  dot(ctx, lampX, 70, INK.amber, 10)
  box(ctx, w * 0.48, h * 0.42, 18, 70, INK.text, '#cbd5e1')
  const shadow = 36 + (1.2 - near) * 70
  ctx.fillStyle = '#94a3b8'
  ctx.fillRect(w * 0.72, h * 0.38, shadow, 90)
  line(ctx, lampX, 70, w * 0.48, h * 0.42, INK.amber)
  line(ctx, lampX, 70, w * 0.48, h * 0.42 + 70, INK.amber)
})

slide('phase-temp', (ctx, w, h, p) => {
  const x0 = 40
  const y0 = h - 58
  axes(ctx, x0, y0, w - 24, 36)
  const pts = [[0, 0.15], [0.25, 0.35], [0.45, 0.35], [0.7, 0.75], [0.85, 0.75], [1, 0.9]]
  ink(ctx, INK.blue)
  ctx.beginPath()
  pts.forEach(([x, y], index) => {
    const px = x0 + x * (w - 80)
    const py = y0 - y * (h - 110)
    if (index === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  })
  ctx.stroke()
  const t = t0(p.tune, 0.3)
  let acc = 0
  let px = x0
  let py = y0
  for (let i = 1; i < pts.length; i += 1) {
    const seg = pts[i][0] - pts[i - 1][0]
    if (acc + seg >= t) {
      const local = (t - acc) / seg
      px = x0 + (pts[i - 1][0] + local * seg) * (w - 80)
      py = y0 - (pts[i - 1][1] + local * (pts[i][1] - pts[i - 1][1])) * (h - 110)
      break
    }
    acc += seg
  }
  dot(ctx, px, py, INK.red, 5)
  textAt(ctx, say(C('rắn · nóng chảy · lỏng · hóa hơi', 'solid · melt · liquid · boil', '固 · 熔化 · 液 · 沸腾', '固体・融解・液体・沸騰', '고체 · 융해 · 액체 · 기화')), w / 2, 24, 12, INK.muted)
})

slide('hooke', (ctx, w, h, p) => {
  const stretch = t0(p.tune, 0.35)
  const force = hookeForce(4, stretch)
  line(ctx, 70, 40, 70, 70)
  ink(ctx, INK.sky)
  ctx.beginPath()
  let y = 70
  ctx.moveTo(70, y)
  for (let i = 0; i < 8; i += 1) {
    y += 8 + stretch * 6
    ctx.lineTo(i % 2 ? 58 : 82, y)
  }
  ctx.stroke()
  box(ctx, 54, y, 32, 22, INK.blue, '#dbeafe')
  axes(ctx, w * 0.48, h - 58, w - 20, 40)
  line(ctx, w * 0.48, h - 58, w - 30, 70, INK.green)
  textAt(ctx, `F = ${force.toFixed(2)}`, w * 0.3, h * 0.3, 14, INK.blue)
})

slide('capacitor', (ctx, w, h, p) => {
  const volts = t0(p.tune, 0.5) * 12
  line(ctx, w * 0.38, 60, w * 0.38, h - 70, INK.blue)
  line(ctx, w * 0.58, 60, w * 0.58, h - 70, INK.red)
  for (let i = 0; i < 4; i += 1) arrowTo(ctx, w * 0.4, 80 + i * 28, w * 0.56, 80 + i * 28, INK.amber)
  textAt(ctx, '+', w * 0.34, 48, 16, INK.blue)
  textAt(ctx, '−', w * 0.62, 48, 16, INK.red)
  textAt(ctx, `U = ${volts.toFixed(1)} V · Q = CU`, w / 2, 28, 13, INK.text)
})

slide('ac-circuit', (ctx, w, h, p) => {
  if (p.variant === 'rlc') {
    box(ctx, 40, 80, 70, 40, INK.amber, '#fff7ed')
    box(ctx, 140, 80, 70, 40, INK.blue, '#eff6ff')
    box(ctx, 240, 80, 70, 40, INK.green, '#ecfdf5')
    textAt(ctx, 'R', 75, 100, 16, INK.amber)
    textAt(ctx, 'L', 175, 100, 16, INK.blue)
    textAt(ctx, 'C', 275, 100, 16, INK.green)
    line(ctx, 110, 100, 140, 100)
    line(ctx, 210, 100, 240, 100)
    textAt(ctx, say(C('nối tiếp', 'series', '串联', '直列', '직렬')), w / 2, 150, 13, INK.muted)
    return
  }
  const freq = 0.4 + t0(p.tune, 0.45) * 1.6
  const amp = rlcAmplitude(freq, 1, 1)
  axes(ctx, 40, h * 0.62, w - 24, 36)
  if ((p.variant || 'graph') === 'graph') {
    ink(ctx, INK.blue)
    ctx.beginPath()
    for (let i = 0; i <= 48; i += 1) {
      const x = 40 + (i / 48) * (w - 80)
      const y = h * 0.62 - Math.sin((i / 48) * Math.PI * 4) * 36
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    ink(ctx, INK.red)
    ctx.beginPath()
    for (let i = 0; i <= 48; i += 1) {
      const x = 40 + (i / 48) * (w - 80)
      const y = h * 0.62 - Math.sin((i / 48) * Math.PI * 4) * 24
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    textAt(ctx, 'u', 70, 40, 14, INK.blue)
    textAt(ctx, 'i', 96, 40, 14, INK.red)
    return
  }
  ink(ctx, INK.violet)
  ctx.beginPath()
  let peakX = 40
  let peakY = h
  for (let i = 0; i <= 40; i += 1) {
    const f = 0.35 + (i / 40) * 1.8
    const y = rlcAmplitude(f, 1, 1)
    const px = 40 + (i / 40) * (w - 80)
    const py = h * 0.75 - y * 80
    if (py < peakY) {
      peakX = px
      peakY = py
    }
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()
  dot(ctx, peakX, peakY, INK.red, 4)
  textAt(ctx, `I = ${amp.toFixed(2)} tại f/f₀ = ${freq.toFixed(2)}`, w / 2, 28, 13, INK.text)
})

slide('diode', (ctx, w, h, p) => {
  const volts = -2 + t0(p.tune, 0.7) * 5
  const current = volts > 0.7 ? (volts - 0.7) * 2 : 0
  axes(ctx, 48, h - 56, w - 20, 36)
  ink(ctx, INK.blue)
  ctx.beginPath()
  ctx.moveTo(48, h - 56)
  ctx.lineTo(48 + ((0.7 + 2) / 5) * (w - 90), h - 56)
  ctx.lineTo(w - 30, 50)
  ctx.stroke()
  textAt(ctx, `U = ${volts.toFixed(2)} V · I = ${current.toFixed(2)}`, w / 2, 24, 13, INK.text)
  line(ctx, w * 0.2, 70, w * 0.32, 70)
  line(ctx, w * 0.32, 58, w * 0.32, 82)
  ink(ctx, INK.blue)
  ctx.beginPath()
  ctx.moveTo(w * 0.32, 70)
  ctx.lineTo(w * 0.42, 58)
  ctx.lineTo(w * 0.42, 82)
  ctx.closePath()
  ctx.stroke()
})

slide('lechatelier', (ctx, w, h, p) => {
  const heat = t0(p.tune, 0.3)
  const product = equilibriumProduct(heat, true)
  title(ctx, w, C('phản ứng tỏa nhiệt', 'exothermic reaction', '放热反应', '発熱反応', '발열 반응'))
  box(ctx, 40, 70, 120, 50, INK.blue, '#dbeafe')
  box(ctx, w - 170, 70, 120, 50, INK.green, '#dcfce7')
  textAt(ctx, say(C('chất phản ứng', 'reactants', '反应物', '反応物', '반응물')), 100, 95, 12, INK.blue)
  textAt(ctx, say(C('sản phẩm', 'products', '生成物', '生成物', '생성물')), w - 110, 95, 12, INK.green)
  const reach = 40 + product * (w - 80)
  arrowTo(ctx, 170, 95, Math.max(190, reach), 95, INK.amber)
  textAt(ctx, `${Math.round(product * 100)}%`, w / 2, 140, 16, INK.amber)
})

slide('kinetics-plot', (ctx, w, h, p) => {
  const k = 0.2 + t0(p.tune, 0.4) * 1.2
  const slope = firstOrderSlope(k)
  axes(ctx, 48, h - 52, w - 20, 36)
  line(ctx, 48, 70, w - 40, 70 + -slope * 80, INK.blue)
  textAt(ctx, `hệ số góc = ${slope.toFixed(2)} = −k`, w / 2, 28, 13, INK.text)
  textAt(ctx, 'ln C', 36, 48, 12, INK.muted)
  textAt(ctx, 't', w - 24, h - 36, 12, INK.muted)
})

slide('enzyme', (ctx, w, h, p) => {
  const t = t0(p.tune, 0.55)
  const y = enzymeActivity(t)
  axes(ctx, 40, h - 52, w - 20, 36)
  ink(ctx, INK.violet)
  ctx.beginPath()
  for (let i = 0; i <= 40; i += 1) {
    const x = i / 40
    const px = 40 + x * (w - 70)
    const py = h - 52 - enzymeActivity(x) * 120
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()
  dot(ctx, 40 + t * (w - 70), h - 52 - y * 120, INK.red, 5)
  const axis = p.variant === 'ph' ? 'pH' : 'T'
  textAt(ctx, `${axis} · ${y.toFixed(2)}`, w / 2, 24, 13, INK.text)
})

slide('crossover', (ctx, w, h, p) => {
  const cut = 0.3 + t0(p.tune, 0.4) * 0.4
  const y1 = 70
  const y2 = 110
  line(ctx, 40, y1, w * 0.46, y1, INK.blue)
  line(ctx, 40, y2, w * 0.46, y2, INK.red)
  const x = 40 + cut * (w * 0.46 - 40)
  line(ctx, x, y1, x, y2, INK.amber)
  line(ctx, w * 0.54, y1, w - 30, y1, INK.blue)
  line(ctx, w * 0.54, y1, w * 0.54 + cut * 80, y1, INK.blue)
  line(ctx, w * 0.54 + cut * 80, y1, w - 30, y1, INK.red)
  textAt(ctx, say(C('tổ hợp mới', 'new combination', '新组合', '新しい組合せ', '새 조합')), w * 0.75, y2 + 28, 12, INK.amber)
})

slide('selection', (ctx, w, h, p) => {
  const shares = selectionShares(t0(p.tune, 0.2) * 3)
  const colors = [INK.blue, INK.green, INK.amber]
  shares.forEach((share, index) => {
    const x = 70 + index * 110
    ctx.fillStyle = colors[index]
    ctx.fillRect(x, h - 70 - share * 140, 48, share * 140)
    textAt(ctx, `${Math.round(share * 100)}%`, x + 24, h - 82 - share * 140, 12, colors[index])
  })
  textAt(ctx, say(C('tổng = 1', 'sum = 1', '总和 = 1', '合計 = 1', '합 = 1')), w / 2, 28, 13, INK.text)
})

slide('simple-machine', (ctx, w, h, p) => {
  if (p.variant === 'pulley') {
    ink(ctx, INK.sky)
    ctx.beginPath()
    ctx.arc(w * 0.5, 90, 28, 0, Math.PI * 2)
    ctx.stroke()
    line(ctx, w * 0.5 - 28, 90, 50, h - 70)
    line(ctx, w * 0.5 + 28, 90, w - 50, 40)
    box(ctx, w * 0.5 - 20, 130, 40, 30, INK.amber, '#ffedd5')
    textAt(ctx, say(C('lực kéo một nửa', 'effort is halved', '拉力减半', '引く力は半分', '당기는 힘은 절반')), w / 2, h - 48, 12, INK.muted)
    return
  }
  const d1 = 0.4 + t0(p.tune, 0.45) * 2.1
  const lever = leverForces(d1)
  line(ctx, 40, h * 0.5, w - 40, h * 0.5)
  dot(ctx, w * 0.48, h * 0.5, INK.text, 5)
  textAt(ctx, `F₁ = ${lever.f1.toFixed(1)} N`, 80, h * 0.38, 13, INK.blue)
  textAt(ctx, `F₂ = ${lever.f2.toFixed(0)} N`, w - 90, h * 0.38, 13, INK.green)
  textAt(ctx, `F₁d₁ = F₂d₂`, w / 2, 36, 14, INK.amber)
})

slide('algebra-tile', (ctx, w, h, p) => {
  const t = 0.3 + t0(p.tune, 0.4) * 0.4
  const size = 150
  const x = 50
  const y = 48
  const a = size * t
  const b = size - a
  if (p.variant === 'diff') {
    box(ctx, x, y, size, size, INK.blue, '#dbeafe')
    box(ctx, x + a, y + a, b, b, '#ffffff', '#ffffff')
    textAt(ctx, 'a²', x + a / 2, y + size / 2, 14, INK.blue)
    textAt(ctx, 'a² − b²', w * 0.72, h * 0.4, 16, INK.amber)
    return
  }
  box(ctx, x, y, a, a, INK.blue, '#dbeafe')
  box(ctx, x + a, y, b, a, INK.green, '#dcfce7')
  box(ctx, x, y + a, a, b, INK.green, '#dcfce7')
  box(ctx, x + a, y + a, b, b, INK.amber, '#ffedd5')
  textAt(ctx, 'a²', x + a / 2, y + a / 2, 13, INK.blue)
  textAt(ctx, 'ab', x + a + b / 2, y + a / 2, 12, INK.green)
  textAt(ctx, 'b²', x + a + b / 2, y + a + b / 2, 13, INK.amber)
})

slide('thales', (ctx, w, h, p) => {
  const split = thalesSplits(0.25 + t0(p.tune, 0.4) * 0.5)
  const apex = { x: 70, y: 50 }
  const left = { x: 40, y: h - 60 }
  const right = { x: w - 40, y: h - 60 }
  line(ctx, apex.x, apex.y, left.x, left.y)
  line(ctx, apex.x, apex.y, right.x, right.y)
  const cut = (from: { x: number; y: number }, ratio: number) => ({
    x: apex.x + (from.x - apex.x) * ratio,
    y: apex.y + (from.y - apex.y) * ratio,
  })
  const a = cut(left, split.left * 0.55)
  const b = cut(right, split.right * 0.55)
  const c = cut(left, split.left)
  const d = cut(right, split.right)
  line(ctx, a.x, a.y, b.x, b.y, INK.blue)
  line(ctx, c.x, c.y, d.x, d.y, INK.green)
  textAt(ctx, `${split.left.toFixed(2)} = ${split.right.toFixed(2)}`, w / 2, 28, 13, INK.amber)
})

slide('similar', (ctx, w, h, p) => {
  const k = 0.5 + t0(p.tune, 0.4) * 1.5
  const drawTri = (x: number, y: number, scale: number, color: string) => {
    ink(ctx, color)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 70 * scale, y)
    ctx.lineTo(x + 18 * scale, y - 50 * scale)
    ctx.closePath()
    ctx.stroke()
  }
  drawTri(40, h - 70, 1, INK.blue)
  drawTri(w * 0.5, h - 70, k, INK.green)
  textAt(ctx, `k = ${k.toFixed(2)}`, w / 2, 28, 14, INK.amber)
})

slide('pythagoras-fig', (ctx, w, h, p) => {
  const parts = pythagorasParts(0.6 + t0(p.tune, 0.4), 0.8)
  const a = 40 + parts.a * 28
  const b = 36 + parts.b * 24
  const x = 150
  const y = h - 70
  line(ctx, x, y, x + a, y, INK.blue)
  line(ctx, x + a, y, x + a, y - b, INK.green)
  line(ctx, x, y, x + a, y - b, INK.amber)
  box(ctx, x, y, a, a, INK.blue)
  box(ctx, x + a, y - b, b, b, INK.green)
  textAt(ctx, `a²+b² = ${parts.c2.toFixed(2)} = c²`, w / 2, 28, 14, INK.text)
})

slide('circle-angles', (ctx, w, h, p) => {
  const central = 40 + t0(p.tune, 0.45) * 100
  const inscribed = inscribedAngle(central)
  const cx = w * 0.42
  const cy = h * 0.52
  const r = 70
  ink(ctx, INK.sky)
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
  const a1 = -0.4
  const a2 = a1 + (central * Math.PI) / 180
  const p1 = { x: cx + Math.cos(a1) * r, y: cy + Math.sin(a1) * r }
  const p2 = { x: cx + Math.cos(a2) * r, y: cy + Math.sin(a2) * r }
  if (p.variant === 'tangent') {
    line(ctx, cx, cy, p1.x, p1.y, INK.blue)
    const tx = -Math.sin(a1)
    const ty = Math.cos(a1)
    line(ctx, p1.x - tx * 50, p1.y - ty * 50, p1.x + tx * 60, p1.y + ty * 60, INK.amber)
    textAt(ctx, '90°', p1.x + 16, p1.y - 16, 12, INK.amber)
    return
  }
  if (p.variant === 'chord') {
    line(ctx, p1.x, p1.y, p2.x, p2.y, INK.blue)
    textAt(ctx, say(C('dây', 'chord', '弦', '弦', '현')), (p1.x + p2.x) / 2, (p1.y + p2.y) / 2 - 12, 12, INK.blue)
    return
  }
  line(ctx, cx, cy, p1.x, p1.y, INK.blue)
  line(ctx, cx, cy, p2.x, p2.y, INK.blue)
  const rim = { x: cx + Math.cos(a1 + 2.2) * r, y: cy + Math.sin(a1 + 2.2) * r }
  if (p.variant === 'inscribed') {
    line(ctx, rim.x, rim.y, p1.x, p1.y, INK.green)
    line(ctx, rim.x, rim.y, p2.x, p2.y, INK.green)
  }
  textAt(ctx, `${central.toFixed(0)}° / ${inscribed.toFixed(0)}°`, w - 70, 36, 13, INK.amber)
})

slide('half-plane', (ctx, w, h, p) => {
  const a = -1 + t0(p.tune, 0.7) * 2
  const b = 0.6
  const ox = w * 0.45
  const oy = h * 0.55
  ctx.fillStyle = 'rgba(37,99,235,0.12)'
  ctx.beginPath()
  ctx.moveTo(30, 40)
  ctx.lineTo(w - 20, 40)
  ctx.lineTo(w - 20, h - 40)
  ctx.lineTo(30, h - 40)
  ctx.fill()
  line(ctx, 40, oy - a * 40, w - 30, oy + a * 30, INK.text)
  dot(ctx, ox + 30, oy - 24, b >= 0 ? INK.blue : INK.red, 4)
  textAt(ctx, `ax + by + c ${b >= 0 ? '≥' : '<'} 0`, w / 2, 24, 13, INK.text)
})

slide('stats-chart', (ctx, w, h, p) => {
  if (p.variant === 'box') {
    const y = h * 0.5
    line(ctx, 40, y, w - 40, y)
    line(ctx, 70, y - 20, 70, y + 20)
    box(ctx, 120, y - 24, 160, 48, INK.blue, '#dbeafe')
    line(ctx, 190, y - 24, 190, y + 24, INK.red)
    line(ctx, w - 70, y - 20, w - 70, y + 20)
    textAt(ctx, say(C('cực tiểu · tứ phân vị · trung vị · cực đại', 'min · quartiles · median · max', '最小 · 四分位 · 中位 · 最大', '最小・四分位・中央・最大', '최솟값 · 사분위 · 중앙값 · 최댓값')), w / 2, 36, 11, INK.muted)
    return
  }
  if (p.variant === 'binomial') {
    const probs = [1, 5, 10, 10, 5, 1]
    probs.forEach((value, index) => {
      ctx.fillStyle = INK.blue
      ctx.fillRect(50 + index * 58, h - 60 - value * 8, 36, value * 8)
    })
    textAt(ctx, 'C(5,k) / 32', w / 2, 28, 13, INK.text)
    return
  }
  if (p.variant === 'normal') {
    const mean = -1 + t0(p.tune, 0.55) * 2
    const sd = 0.45
    axes(ctx, 36, h - 50, w - 16, 36)
    ink(ctx, INK.violet)
    ctx.beginPath()
    let peak = 0
    let peakX = 0
    for (let i = 0; i <= 48; i += 1) {
      const x = -2.4 + (i / 48) * 4.8
      const density = normalDensity(x, mean, sd)
      const px = 36 + ((x + 2.4) / 4.8) * (w - 60)
      const py = h - 50 - density * 90
      if (density > peak) {
        peak = density
        peakX = x
      }
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()
    textAt(ctx, `đỉnh tại ${peakX.toFixed(2)}`, w / 2, 24, 13, INK.text)
    return
  }
  ;[3, 7, 5, 9, 4].forEach((value, index) => {
    ctx.fillStyle = index % 2 ? '#0284c7' : '#2563eb'
    ctx.fillRect(40 + index * 70, h - 50 - value * 14, 46, value * 14)
  })
})

slide('communicating', (ctx, w, h, p) => {
  const tilt = t0(p.tune, 0.5)
  const left = 40 + tilt * 50
  const right = 90 - tilt * 50
  ink(ctx, INK.sky)
  ctx.strokeRect(70, 40, 50, 120)
  ctx.strokeRect(220, 40, 50, 120)
  line(ctx, 95, 160, 245, 160, INK.sky)
  ctx.fillStyle = '#7dd3fc'
  ctx.fillRect(74, 160 - left, 42, left)
  ctx.fillRect(224, 160 - right, 42, right)
  textAt(ctx, say(C('thả núm để hai mực bằng nhau', 'release to level the water', '松开后两边水位相同', '離すと水位がそろう', '놓으면 수면이 같아짐')), w / 2, 28, 12, INK.muted)
}, false, () => [0.5])

function paintClock(ctx: Ctx, w: number, h: number, p: LessonParams) {
  const reading = clockReading(p.variant || 'hour', p.tune)
  const cx = w * 0.5
  const cy = h * 0.48
  ink(ctx, INK.text)
  ctx.beginPath()
  ctx.arc(cx, cy, 78, 0, Math.PI * 2)
  ctx.stroke()
  for (let i = 0; i < 12; i += 1) {
    const ang = -Math.PI / 2 + (i / 12) * Math.PI * 2
    line(ctx, cx + Math.cos(ang) * 68, cy + Math.sin(ang) * 68, cx + Math.cos(ang) * 76, cy + Math.sin(ang) * 76, INK.muted)
  }
  const hour = reading.hour === 0 ? 12 : reading.hour
  const hourAng = -Math.PI / 2 + ((reading.hour % 12) + reading.minutes / 60) * (Math.PI / 6)
  const minAng = -Math.PI / 2 + reading.minutes * (Math.PI / 30)
  line(ctx, cx, cy, cx + Math.cos(hourAng) * 40, cy + Math.sin(hourAng) * 40, INK.blue)
  line(ctx, cx, cy, cx + Math.cos(minAng) * 62, cy + Math.sin(minAng) * 62, INK.amber)
  textAt(ctx, `${hour}:${String(reading.minutes).padStart(2, '0')}`, w / 2, h - 36, 16, INK.text)
}

registerFigure('clock', {
  draw: paintClock,
  handles: (w, h, p) => {
    const reading = clockReading(p.variant || 'hour', p.tune)
    const cx = w * 0.5
    const cy = h * 0.48
    const hourAng = -Math.PI / 2 + ((reading.hour % 12) + reading.minutes / 60) * (Math.PI / 6)
    const minAng = -Math.PI / 2 + reading.minutes * (Math.PI / 30)
    return [
      { id: 'hour', x: cx + Math.cos(hourAng) * 40, y: cy + Math.sin(hourAng) * 40 },
      { id: 'minute', x: cx + Math.cos(minAng) * 62, y: cy + Math.sin(minAng) * 62 },
    ]
  },
  move: (p, w, h, handle, x, y) => {
    const ang = Math.atan2(y - h * 0.48, x - w * 0.5)
    const turns = (ang + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2)
    if (handle === 'minute') return [tuneAt(p.tune, 0, 0.25), turns / (Math.PI * 2)]
    return [turns / (Math.PI * 2), tuneAt(p.tune, 1, 0)]
  },
  release: (p) => clockReadingSnap(p),
})

function clockReadingSnap(p: LessonParams) {
  const [hour, minute] = [tuneAt(p.tune, 0, 0.25), tuneAt(p.tune, 1, 0)]
  const variant = p.variant || 'hour'
  const snappedMinute = variant === 'hour' ? 0 : variant === 'half' ? 0.5 : Math.round(minute * 12) / 12
  return [clamp(hour, 0, 0.999), snappedMinute]
}

slide('fraction-disc', (ctx, w, h, p) => {
  const parts = fractionParts([tuneAt(p.tune, 0, 0.3), tuneAt(p.tune, 1, 0.4)])
  textAt(ctx, `${parts.num}/${parts.den}`, w / 2, 28, 18, INK.blue)
  if (p.variant === 'circle') {
    const cx = w * 0.5
    const cy = h * 0.52
    for (let i = 0; i < parts.den; i += 1) {
      const a0 = -Math.PI / 2 + (i / parts.den) * Math.PI * 2
      const a1 = -Math.PI / 2 + ((i + 1) / parts.den) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, 58, a0, a1)
      ctx.closePath()
      ctx.fillStyle = i < parts.num ? '#93c5fd' : '#f8fafc'
      ctx.fill()
      ctx.strokeStyle = INK.text
      ctx.stroke()
    }
    return
  }
  const width = (w - 80) / parts.den
  for (let i = 0; i < parts.den; i += 1) {
    box(ctx, 40 + i * width, h * 0.42, width - 2, 36, INK.text, i < parts.num ? '#93c5fd' : '#f8fafc')
  }
})

registerFigure('fraction-disc', {
  draw: (ctx, w, h, p) => {
    const parts = fractionParts(p.tune)
    textAt(ctx, `${parts.num}/${parts.den}`, w / 2, 28, 18, INK.blue)
    if (p.variant === 'circle') {
      const cx = w * 0.5
      const cy = h * 0.5
      for (let i = 0; i < parts.den; i += 1) {
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, 58, -Math.PI / 2 + (i / parts.den) * Math.PI * 2, -Math.PI / 2 + ((i + 1) / parts.den) * Math.PI * 2)
        ctx.closePath()
        ctx.fillStyle = i < parts.num ? '#93c5fd' : '#f8fafc'
        ctx.fill()
        ctx.stroke()
      }
      return
    }
    const width = (w - 80) / parts.den
    for (let i = 0; i < parts.den; i += 1) box(ctx, 40 + i * width, h * 0.4, width - 2, 36, INK.text, i < parts.num ? '#93c5fd' : '#f8fafc')
  },
  handles: (w, h) => [{ id: 'den', x: w * 0.3, y: h - 18 }, { id: 'num', x: w * 0.7, y: h - 18 }],
  move: (p, w, _h, handle, x) => {
    const t = bottomT(w, x)
    return handle === 'num' ? [tuneAt(p.tune, 0, 0.3), t] : [t, tuneAt(p.tune, 1, 0.4)]
  },
})

still('count-set', (ctx, w, h, p) => {
  if (p.variant === 'compare') {
    for (let i = 0; i < 7; i += 1) dot(ctx, 40 + (i % 4) * 28, 70 + Math.floor(i / 4) * 28, INK.blue, 8)
    for (let i = 0; i < 3; i += 1) dot(ctx, w * 0.62 + i * 28, 84, INK.amber, 8)
    textAt(ctx, say(C('nhiều', 'more', '多', '多い', '많음')), 80, 150, 14, INK.blue)
    textAt(ctx, say(C('ít', 'fewer', '少', '少ない', '적음')), w * 0.7, 150, 14, INK.amber)
    return
  }
  if (p.variant === 'position') {
    box(ctx, w * 0.35, 60, 120, 100, INK.text, '#f8fafc')
    dot(ctx, w * 0.48, 110, INK.blue, 8)
    dot(ctx, 50, 110, INK.amber, 8)
    textAt(ctx, say(C('trong', 'inside', '里面', '中', '안')), w * 0.48, 180, 13, INK.blue)
    textAt(ctx, say(C('ngoài', 'outside', '外面', '外', '밖')), 50, 180, 13, INK.amber)
    return
  }
  for (let i = 0; i < 10; i += 1) {
    dot(ctx, 36 + (i % 5) * 36, 70 + Math.floor(i / 5) * 40, INK.blue, 8)
    textAt(ctx, String(i + 1), 36 + (i % 5) * 36, 86 + Math.floor(i / 5) * 40, 11, INK.text)
  }
})

still('measure-units', (ctx, w, h) => {
  const rows = [
    ['1 km', '1000 m'],
    ['1 kg', '1000 g'],
    ['1 lít', '1000 ml'],
  ]
  rows.forEach((row, index) => {
    const y = 60 + index * 48
    textAt(ctx, row[0], 80, y, 16, INK.blue)
    arrowTo(ctx, 140, y, 230, y)
    textAt(ctx, row[1], 320, y, 16, INK.green)
  })
})

still('line-pair', (ctx, w, h, p) => {
  const angles = linePairAngles(t0(p.tune, 0.4))
  if (p.variant !== 'transversal') {
    line(ctx, 40, h - 50, w - 40, h - 50)
    line(ctx, w * 0.5, 40, w * 0.5, h - 40)
    box(ctx, w * 0.5, h - 70, 18, 18, INK.red)
    textAt(ctx, '90°', w * 0.62, h - 80, 13, INK.red)
    return
  }
  line(ctx, 30, 70, w - 30, 70, INK.blue)
  line(ctx, 30, 150, w - 30, 150, INK.blue)
  const tilt = angles.one
  const rad = (tilt * Math.PI) / 180
  line(ctx, w * 0.35, 30, w * 0.35 + Math.cos(rad) * 40, 190)
  textAt(ctx, `${angles.one.toFixed(0)}° + ${angles.other.toFixed(0)}° = 180°`, w / 2, h - 36, 13, INK.amber)
})

registerFigure('line-pair', {
  draw: (ctx, w, h, p) => {
    const angles = linePairAngles(t0(p.tune, 0.4))
    if (p.variant !== 'transversal') {
      line(ctx, 40, h - 60, w - 40, h - 60)
      line(ctx, w * 0.5, 36, w * 0.5, h - 50)
      box(ctx, w * 0.5, h - 78, 16, 16, INK.red)
      return
    }
    line(ctx, 24, 64, w - 24, 64, INK.blue)
    line(ctx, 24, 140, w - 24, 140, INK.blue)
    line(ctx, 80, 30, 180, 190, INK.text)
    textAt(ctx, `${angles.one.toFixed(0)}°`, 120, 90, 12, INK.green)
    textAt(ctx, `${angles.other.toFixed(0)}°`, 150, 120, 12, INK.amber)
    bottomKnob(ctx, w, h, t0(p.tune, 0.4))
  },
  handles: (w, h, p) => [{ id: 'k', x: bottomX(w, t0(p.tune, 0.4)), y: h - 16 }],
  move: (p, w, _h, handle, x) => (handle === 'k' ? [bottomT(w, x)] : null),
})

still('bar-chart', (ctx, w, h, p) => {
  const heights = [0, 1, 2, 3].map((index) => 20 + tuneAt(p.tune, index, 0.3 + index * 0.12) * 90)
  heights.forEach((height, index) => {
    ctx.fillStyle = '#2563eb'
    ctx.fillRect(50 + index * 80, h - 50 - height, 46, height)
    textAt(ctx, String(Math.round(height / 10)), 73 + index * 80, h - 62 - height, 11, INK.text)
  })
  line(ctx, 36, h - 50, w - 20, h - 50)
})

registerFigure('bar-chart', {
  draw: (ctx, w, h, p) => {
    const heights = [0, 1, 2, 3].map((index) => 24 + tuneAt(p.tune, index, 0.35 + index * 0.1) * 100)
    heights.forEach((height, index) => {
      ctx.fillStyle = '#2563eb'
      ctx.fillRect(48 + index * 86, h - 36 - height, 48, height)
    })
    line(ctx, 30, h - 36, w - 16, h - 36)
  },
  handles: (w, h, p) => [0, 1, 2, 3].map((index) => ({
    id: `c${index}`,
    x: 72 + index * 86,
    y: h - 36 - (24 + tuneAt(p.tune, index, 0.35) * 100),
  })),
  move: (p, _w, h, handle, _x, y) => {
    const index = Number(handle.slice(1))
    if (!Number.isInteger(index)) return null
    const height = clamp(h - 36 - y, 24, 124)
    return keepTune(p.tune, index, (height - 24) / 100)
  },
})

still('mirror-symmetry', (ctx, w, h, p) => {
  const lift = tuneAt(p.tune, 0, 0.4) * 40
  line(ctx, w * 0.5, 30, w * 0.5, h - 30, INK.muted)
  ink(ctx, INK.blue)
  ctx.beginPath()
  ctx.moveTo(w * 0.5 - 20, h * 0.7)
  ctx.lineTo(w * 0.5 - 70, h * 0.7 - lift)
  ctx.lineTo(w * 0.5 - 40, h * 0.35)
  ctx.stroke()
  ink(ctx, INK.green)
  ctx.beginPath()
  ctx.moveTo(w * 0.5 + 20, h * 0.7)
  ctx.lineTo(w * 0.5 + 70, h * 0.7 - lift)
  ctx.lineTo(w * 0.5 + 40, h * 0.35)
  ctx.stroke()
})

registerFigure('mirror-symmetry', {
  draw: (ctx, w, h, p) => {
    const lift = t0(p.tune, 0.4) * 50
    line(ctx, w * 0.5, 24, w * 0.5, h - 24, INK.muted)
    ink(ctx, INK.blue)
    ctx.beginPath()
    ctx.moveTo(w * 0.42, h * 0.72)
    ctx.lineTo(w * 0.22, h * 0.72 - lift)
    ctx.lineTo(w * 0.34, h * 0.32)
    ctx.stroke()
    ink(ctx, INK.green)
    ctx.beginPath()
    ctx.moveTo(w * 0.58, h * 0.72)
    ctx.lineTo(w * 0.78, h * 0.72 - lift)
    ctx.lineTo(w * 0.66, h * 0.32)
    ctx.stroke()
  },
  handles: (w, h, p) => [{ id: 'k', x: w * 0.22, y: h * 0.72 - t0(p.tune, 0.4) * 50 }],
  move: (p, _w, h, handle, _x, y) => (handle === 'k' ? [clamp((h * 0.72 - y) / 50, 0, 1)] : null),
})

still('venn', (ctx, w, h, p) => {
  ink(ctx, INK.blue)
  ctx.beginPath()
  ctx.arc(p.variant === 'one' ? w * 0.5 : w * 0.4, h * 0.5, 70, 0, Math.PI * 2)
  ctx.stroke()
  if (p.variant !== 'one') {
    ink(ctx, INK.green)
    ctx.beginPath()
    ctx.arc(w * 0.62, h * 0.5, 70, 0, Math.PI * 2)
    ctx.stroke()
    textAt(ctx, 'A ∩ B', w * 0.51, h * 0.5, 13, INK.amber)
  }
  textAt(ctx, 'A', p.variant === 'one' ? w * 0.5 : w * 0.32, h * 0.5, 14, INK.blue)
})

still('congruence', (ctx, w, h, p) => {
  const mark = p.variant === 'asa' ? 'góc' : p.variant === 'sss' ? 'cạnh' : 'c-g-c'
  const tri = (x: number) => {
    line(ctx, x, h - 50, x + 90, h - 50)
    line(ctx, x + 90, h - 50, x + 30, 60)
    line(ctx, x + 30, 60, x, h - 50)
  }
  tri(40)
  tri(w * 0.52)
  textAt(ctx, mark, w / 2, 28, 14, INK.amber)
})

still('chance', (ctx, w, h, p, time) => {
  if (p.variant === 'tree') {
    const leaves = chanceLeaves()
    line(ctx, 40, h * 0.5, 120, h * 0.5)
    leaves.forEach((leaf, index) => {
      const y = 50 + index * 55
      line(ctx, 120, h * 0.5, 220, y, INK.blue)
      textAt(ctx, leaf.toFixed(2), 280, y, 14, INK.green)
    })
    textAt(ctx, `Σ = ${leaves.reduce((sum, leaf) => sum + leaf, 0).toFixed(2)}`, w * 0.7, h - 36, 13, INK.amber)
    return
  }
  const face = p.variant === 'coin' ? (p.run && Math.floor(Math.abs(time)) % 2 === 1 ? 'ngửa' : 'sấp') : String(diceFace(time, p.run === true))
  box(ctx, w * 0.4, 60, 80, 80, INK.text, '#fff')
  textAt(ctx, face, w * 0.4 + 40, 100, 22, INK.blue)
}, true)

still('vector-add', (ctx, w, h, p) => {
  const v = vectorFromTune(p.tune)
  const ox = 80
  const oy = h * 0.7
  const scale = 80
  arrowTo(ctx, ox, oy, ox + v.ax * scale, oy - v.ay * scale, INK.blue)
  arrowTo(ctx, ox + v.ax * scale, oy - v.ay * scale, ox + v.x * scale, oy - v.y * scale, INK.green)
  arrowTo(ctx, ox, oy, ox + v.x * scale, oy - v.y * scale, INK.amber)
  textAt(ctx, `(${v.x.toFixed(2)}; ${v.y.toFixed(2)})`, w * 0.7, 36, 13, INK.amber)
})

registerFigure('vector-add', {
  draw: (ctx, w, h, p) => {
    const v = vectorFromTune(p.tune)
    const ox = 70
    const oy = h * 0.72
    const scale = 70
    arrowTo(ctx, ox, oy, ox + v.ax * scale, oy - v.ay * scale, INK.blue)
    arrowTo(ctx, ox, oy, ox + v.bx * scale, oy - v.by * scale, INK.green)
    arrowTo(ctx, ox, oy, ox + v.x * scale, oy - v.y * scale, INK.amber)
  },
  handles: (w, h, p) => {
    const v = vectorFromTune(p.tune)
    const ox = 70
    const oy = h * 0.72
    return [
      { id: 'a', x: ox + v.ax * 70, y: oy - v.ay * 70 },
      { id: 'b', x: ox + v.bx * 70, y: oy - v.by * 70 },
    ]
  },
  move: (p, _w, h, handle, x, y) => {
    const ox = 70
    const oy = h * 0.72
    const nx = clamp((x - ox) / 70, -0.2, 1.8)
    const ny = clamp((oy - y) / 70, -0.2, 1.6)
    if (handle === 'a') return [(nx + 0.2) / 2, ny, tuneAt(p.tune, 2, 0.25), tuneAt(p.tune, 3, 0.62)]
    return [tuneAt(p.tune, 0, 0.62), tuneAt(p.tune, 1, 0.28), (nx + 0.3) / 2, ny]
  },
})

still('space-line-plane', (ctx, w, h, p) => {
  ink(ctx, INK.sky)
  ctx.beginPath()
  ctx.moveTo(60, h * 0.62)
  ctx.lineTo(w - 40, h * 0.5)
  ctx.lineTo(w - 80, h * 0.78)
  ctx.lineTo(40, h * 0.86)
  ctx.closePath()
  ctx.stroke()
  if (p.variant === 'perp') line(ctx, w * 0.5, 40, w * 0.5, h * 0.7, INK.red)
  else if (p.variant === 'cross') line(ctx, 80, 50, w * 0.62, h * 0.8, INK.amber)
  else line(ctx, 50, 70, w - 50, 90, INK.blue)
})

still('asymptote', (ctx, w, h, p) => {
  const ox = w * 0.5
  const oy = h * 0.55
  line(ctx, 30, oy, w - 20, oy, INK.muted)
  line(ctx, ox, 30, ox, h - 30, INK.muted)
  ink(ctx, INK.blue)
  ctx.beginPath()
  if (p.variant === 'linear') {
    line(ctx, ox + 8, 36, ox + 8, h - 36, INK.amber)
    line(ctx, 30, oy - 28, w - 20, oy - 28, INK.amber)
  }
  for (let i = -40; i <= 40; i += 1) {
    if (i === 0) continue
    const x = i / 12
    const y = p.variant === 'linear' ? (x + 0.4) / (x - 0.15) : 1 / x
    if (!Number.isFinite(y) || Math.abs(y) > 3) continue
    const px = ox + x * 36
    const py = oy - y * 28
    if (i === -40 || i === 1) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()
  textAt(ctx, p.variant === 'linear' ? 'x = 1 · y = 1' : 'x = 0 · y = 0', w / 2, 22, 12, INK.amber)
})

still('variation-table', (ctx, w) => {
  const root = 1 / Math.sqrt(3)
  textAt(ctx, "y = x³ − x", w / 2, 28, 14, INK.text)
  textAt(ctx, `y' = 0 tại x = ±${root.toFixed(2)}`, w / 2, 52, 12, INK.muted)
  const marks = ['−', `−${root.toFixed(2)}`, '+', root.toFixed(2), '−']
  marks.forEach((mark, index) => textAt(ctx, mark, 50 + index * 80, 110, 16, mark === '+' ? INK.green : INK.red))
})

still('integral-area', (ctx, w, h) => {
  const area = integralArea()
  const ox = 50
  const oy = h - 40
  axes(ctx, ox, oy, w - 16, 30)
  ctx.fillStyle = 'rgba(37,99,235,0.25)'
  ctx.beginPath()
  ctx.moveTo(ox, oy)
  for (let i = 0; i <= 24; i += 1) {
    const x = i / 24
    ctx.lineTo(ox + x * 160, oy - (x - x * x) * 220)
  }
  ctx.lineTo(ox + 160, oy)
  ctx.fill()
  textAt(ctx, `S = ${area.toFixed(3)} ≈ 1/6`, w * 0.72, 40, 14, INK.blue)
})

still('projection', (ctx, w, h) => {
  box(ctx, 40, 40, 70, 50, INK.text)
  box(ctx, 140, 40, 70, 50, INK.text)
  line(ctx, 155, 70, 195, 50, INK.muted)
  box(ctx, 250, 70, 80, 36, INK.text)
  textAt(ctx, say(C('đứng', 'front', '主视', '正面', '정면')), 75, 110, 12, INK.muted)
  textAt(ctx, say(C('cạnh', 'side', '侧视', '側面', '옆')), 175, 110, 12, INK.muted)
  textAt(ctx, say(C('bằng', 'top', '俯视', '平面', '위')), 290, 120, 12, INK.muted)
})

still('complex-plane', (ctx, w, h, p) => {
  const a = -1.5 + tuneAt(p.tune, 0, 0.7) * 3
  const b = -1.5 + tuneAt(p.tune, 1, 0.65) * 3
  const mod = complexModulus(a, b)
  const ox = w * 0.5
  const oy = h * 0.55
  line(ctx, 30, oy, w - 20, oy, INK.muted)
  line(ctx, ox, 30, ox, h - 30, INK.muted)
  arrowTo(ctx, ox, oy, ox + a * 40, oy - b * 40, INK.blue)
  textAt(ctx, `|z| = ${mod.toFixed(2)}`, w / 2, 24, 14, INK.text)
})

registerFigure('complex-plane', {
  draw: (ctx, w, h, p) => {
    const a = -1.5 + tuneAt(p.tune, 0, 0.7) * 3
    const b = -1.5 + tuneAt(p.tune, 1, 0.65) * 3
    const ox = w * 0.5
    const oy = h * 0.55
    line(ctx, 24, oy, w - 16, oy, INK.muted)
    line(ctx, ox, 24, ox, h - 24, INK.muted)
    arrowTo(ctx, ox, oy, ox + a * 36, oy - b * 36, INK.blue)
    textAt(ctx, `|z| = ${complexModulus(a, b).toFixed(2)}`, ox + a * 36, oy - b * 36 - 14, 12, INK.blue)
  },
  handles: (w, h, p) => {
    const a = -1.5 + tuneAt(p.tune, 0, 0.7) * 3
    const b = -1.5 + tuneAt(p.tune, 1, 0.65) * 3
    return [{ id: 'z', x: w * 0.5 + a * 36, y: h * 0.55 - b * 36 }]
  },
  move: (p, w, h, handle, x, y) => {
    if (handle !== 'z') return null
    const a = clamp((x - w * 0.5) / 36, -1.5, 1.5)
    const b = clamp((h * 0.55 - y) / 36, -1.5, 1.5)
    return [(a + 1.5) / 3, (b + 1.5) / 3]
  },
})

still('slope-field', (ctx, w, h) => {
  for (let i = 0; i < 8; i += 1) {
    for (let j = 0; j < 6; j += 1) {
      const x = 40 + i * 46
      const y = 40 + j * 36
      const slope = (h * 0.5 - y) / 80
      line(ctx, x - 8, y + slope * 8, x + 8, y - slope * 8, INK.blue)
    }
  }
  textAt(ctx, "y' = y", w / 2, h - 16, 13, INK.text)
})

still('states', (ctx, w, h, p, time) => {
  const kind = p.variant || 'solid'
  box(ctx, 40, 40, w - 80, h - 80, INK.sky, '#f8fafc')
  for (let i = 0; i < 12; i += 1) {
    const col = i % 4
    const row = Math.floor(i / 4)
    let x = 70 + col * 36
    let y = 70 + row * 36
    if (kind === 'liquid') x += (col - 1.5) * 8
    if (kind === 'gas') {
      const phase = time * 0.7 + i
      x = 70 + ((col * 50 + Math.sin(phase) * 30 + w) % (w - 140))
      y = 60 + ((row * 40 + Math.cos(phase * 1.3) * 24 + h) % (h - 120))
    }
    dot(ctx, x, y, INK.blue, 5)
  }
}, true)

still('energy-flow', (ctx, w, h) => {
  const words = [
    C('cơ', 'mechanical', '机械', '力学', '역학'),
    C('nhiệt', 'heat', '热', '熱', '열'),
    C('điện', 'electric', '电', '電気', '전기'),
    C('quang', 'light', '光', '光', '빛'),
  ]
  words.forEach((word, index) => {
    const x = 40 + index * 100
    box(ctx, x, 80, 80, 36, INK.blue, '#eff6ff')
    textAt(ctx, say(word), x + 40, 98, 12, INK.blue)
    if (index < 3) arrowTo(ctx, x + 82, 98, x + 98, 98)
  })
})

still('electromagnet', (ctx, w, h, p) => {
  const on = tuneAt(p.tune, 2, 0) >= 0.5
  line(ctx, 80, 40, 80, 150)
  for (let i = 0; i < 5; i += 1) {
    ink(ctx, INK.amber)
    ctx.beginPath()
    ctx.arc(80, 60 + i * 16, 14, -1.2, 1.2)
    ctx.stroke()
  }
  if (on) {
    for (let i = 0; i < 4; i += 1) dot(ctx, 130, 90 + i * 12, INK.muted, 4)
  }
  textAt(ctx, on ? say(C('mạch đóng, đinh hút', 'closed, nails stick', '接通，吸钉', '閉じると釘が付く', '닫히면 못이 붙음')) : say(C('mạch mở', 'open circuit', '断开', '開いている', '열림')), w * 0.65, 50, 13, on ? INK.green : INK.muted)
})

registerFigure('electromagnet', {
  runs: false,
  draw: (ctx, w, h, p) => {
    const on = tuneAt(p.tune, 2, 0) >= 0.5
    for (let i = 0; i < 6; i += 1) {
      ink(ctx, INK.amber)
      ctx.beginPath()
      ctx.ellipse(w * 0.4, 50 + i * 22, 28, 10, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    if (on) for (let i = 0; i < 5; i += 1) dot(ctx, w * 0.62, 80 + i * 14, '#64748b', 5)
    textAt(ctx, on ? 'ON' : 'OFF', w * 0.8, 40, 14, on ? INK.green : INK.red)
  },
  handles: (w) => [{ id: 'switch', x: w * 0.8, y: 70 }],
  move: (p, _w, _h, handle, _x, y) => (handle === 'switch' ? [0, 0, y < 90 ? 1 : 0] : null),
})

still('home-wire', (ctx, w, h) => {
  line(ctx, 30, 50, w - 30, 50, INK.red)
  line(ctx, 30, 120, w - 30, 120, INK.blue)
  box(ctx, 70, 70, 36, 30, INK.amber, '#fef3c7')
  textAt(ctx, say(C('cầu chì', 'fuse', '保险丝', 'ヒューズ', '퓨즈')), 88, 150, 11, INK.amber)
  box(ctx, 180, 70, 40, 30, INK.text)
  textAt(ctx, say(C('công tắc', 'switch', '开关', 'スイッチ', '스위치')), 200, 150, 11, INK.text)
  ink(ctx, INK.amber)
  ctx.beginPath()
  ctx.arc(320, 95, 16, 0, Math.PI * 2)
  ctx.stroke()
  textAt(ctx, 'P = UI', w * 0.5, 190, 16, INK.blue)
})

still('circular-motion', (ctx, w, h, p) => {
  const radius = 0.4 + tuneAt(p.tune, 0, 0.45) * 1.2
  const speed = 0.5 + tuneAt(p.tune, 1, 0.4) * 2
  const accel = centripetalAccel(speed, radius)
  const cx = w * 0.42
  const cy = h * 0.55
  const r = radius * 40
  ink(ctx, INK.sky)
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
  arrowTo(ctx, cx + r, cy, cx + r, cy - 36, INK.green)
  arrowTo(ctx, cx + r, cy, cx + r - 28, cy, INK.red)
  textAt(ctx, `a = v²/r = ${accel.toFixed(2)}`, w * 0.72, 40, 13, INK.red)
})

registerFigure('circular-motion', {
  draw: (ctx, w, h, p) => {
    const radius = 0.45 + tuneAt(p.tune, 0, 0.4) * 1.1
    const speed = 0.6 + tuneAt(p.tune, 1, 0.45) * 2
    const cx = w * 0.4
    const cy = h * 0.55
    const r = radius * 36
    ink(ctx, INK.sky)
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
    arrowTo(ctx, cx + r, cy, cx + r, cy - 30, INK.green)
    arrowTo(ctx, cx + r, cy, cx + r - 26, cy, INK.red)
    textAt(ctx, `a = ${centripetalAccel(speed, radius).toFixed(2)}`, w * 0.75, 36, 14, INK.text)
  },
  handles: (w, h, p) => {
    const radius = 0.45 + tuneAt(p.tune, 0, 0.4) * 1.1
    return [
      { id: 'r', x: w * 0.4 + radius * 36, y: h * 0.55 },
      { id: 'v', x: w * 0.78, y: 70 + tuneAt(p.tune, 1, 0.45) * 40 },
    ]
  },
  move: (p, w, h, handle, x, y) => {
    if (handle === 'r') return [clamp((x - w * 0.4) / 36, 0.3, 1.8), tuneAt(p.tune, 1, 0.45)]
    return [tuneAt(p.tune, 0, 0.4), clamp((y - 70) / 80, 0, 1)]
  },
})

still('collision', (ctx, w, h, p, time) => {
  const hit = elastic1d(1 + tuneAt(p.tune, 0, 0.4), 2, 1, -0.5)
  const shift = p.run ? Math.min(40, Math.abs(time) * 12) : 0
  box(ctx, 60 + shift, h * 0.45, 40, 28, INK.blue, '#dbeafe')
  box(ctx, w - 140 - shift * 0.3, h * 0.45, 40, 28, INK.green, '#dcfce7')
  textAt(ctx, `p = ${hit.before.toFixed(2)} → ${hit.after.toFixed(2)}`, w / 2, 36, 14, INK.amber)
}, true)

still('torque', (ctx, w, h, p) => {
  const d = 40 + tuneAt(p.tune, 0, 0.5) * 80
  line(ctx, 40, h * 0.55, w - 40, h * 0.55)
  dot(ctx, w * 0.5, h * 0.55, INK.text, 5)
  arrowTo(ctx, w * 0.5 - d, h * 0.55, w * 0.5 - d, h * 0.55 - 40, INK.blue)
  arrowTo(ctx, w * 0.5 + 70, h * 0.55, w * 0.5 + 70, h * 0.55 + 36, INK.red)
  const moment = 8 * (d / 40) - 6 * 1.4
  textAt(ctx, `M = ${moment.toFixed(1)}`, w / 2, 36, 14, INK.text)
})

still('sound-wave', (ctx, w, h, p) => {
  const lambda = 40 + tuneAt(p.tune, 0, 0.4) * 50
  const amp = 4 + tuneAt(p.tune, 1, 0.4) * 10
  for (let x = 30; x < w - 20; x += 8) {
    const squeeze = Math.cos((x / lambda) * Math.PI * 2)
    line(ctx, x, h * 0.35, x, h * 0.35 + 40 + squeeze * amp, INK.blue)
  }
  textAt(ctx, `λ = ${lambda.toFixed(0)}`, w / 2, h - 28, 13, INK.muted)
})

still('solenoid', (ctx, w, h, p) => {
  const reverse = tuneAt(p.tune, 2, 1) < 0
  for (let i = 0; i < 7; i += 1) {
    ink(ctx, INK.amber)
    ctx.beginPath()
    ctx.ellipse(70 + i * 36, h * 0.5, 16, 28, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  arrowTo(ctx, w * 0.2, h * 0.5, reverse ? w * 0.15 : w * 0.85, h * 0.5, INK.blue)
  textAt(ctx, reverse ? 'S → N' : 'N → S', w / 2, 36, 14, INK.blue)
})

registerFigure('solenoid', {
  draw: (ctx, w, h, p) => {
    const reverse = tuneAt(p.tune, 2, 1) < 0
    for (let i = 0; i < 7; i += 1) {
      ink(ctx, INK.amber)
      ctx.beginPath()
      ctx.ellipse(60 + i * 40, h * 0.55, 16, 26, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    arrowTo(ctx, reverse ? w - 40 : 40, h * 0.55, reverse ? 40 : w - 40, h * 0.55, INK.blue)
  },
  handles: (w, h) => [{ id: 'switch', x: w - 28, y: h * 0.25 }],
  move: (p, _w, h, handle, _x, y) => (handle === 'switch' ? [0, 0, y < h * 0.4 ? 1 : -1] : null),
})

still('induction', (ctx, w, h, p, time) => {
  const y = 40 + (p.run ? (Math.abs(time) * 30) % (h - 80) : 50)
  box(ctx, w * 0.35, y, 28, 48, INK.red, '#fecaca')
  ink(ctx, INK.blue)
  ctx.beginPath()
  ctx.arc(w * 0.55, h * 0.5, 46, 0, Math.PI * 2)
  ctx.stroke()
  const flick = p.run ? Math.sin(time * 6) : 0
  textAt(ctx, flick > 0 ? say(C('kim lệch', 'needle moves', '指针偏转', '針が振れる', '바늘이 움직임')) : say(C('Lenz', 'Lenz', '楞次', 'レンツ', '렌츠')), w * 0.78, h * 0.5, 13, INK.amber)
}, true)

still('nuclear', (ctx, w, h, p) => {
  if (p.variant === 'fission') {
    dot(ctx, 80, h * 0.5, INK.amber, 16)
    arrowTo(ctx, 110, h * 0.5, 180, h * 0.5)
    dot(ctx, 230, h * 0.38, INK.blue, 12)
    dot(ctx, 250, h * 0.62, INK.green, 10)
    dot(ctx, 300, h * 0.5, INK.muted, 4)
    return
  }
  if (p.variant === 'defect') {
    textAt(ctx, 'Δm', w * 0.3, h * 0.45, 22, INK.amber)
    textAt(ctx, 'E = Δm c²', w * 0.68, h * 0.45, 18, INK.blue)
    return
  }
  textAt(ctx, '²¹⁴Pb → ²¹⁴Bi + e⁻', w / 2, h * 0.4, 16, INK.text)
  textAt(ctx, say(C('số khối và số proton cân', 'mass and proton numbers balance', '质量数与质子数守恒', '質量数と陽子数が合う', '질량수와 양성자수가 맞음')), w / 2, h * 0.62, 12, INK.muted)
})

still('thermo-path', (ctx, w, h) => {
  axes(ctx, 40, h - 40, w - 20, 30)
  line(ctx, 70, h - 80, w - 50, h - 80, INK.blue)
  line(ctx, 90, h - 50, 90, 50, INK.green)
  line(ctx, 80, h - 60, w - 40, 60, INK.red)
  textAt(ctx, say(C('đẳng áp', 'isobar', '等压', '定圧', '등압')), w * 0.7, h - 96, 12, INK.blue)
  textAt(ctx, say(C('đẳng tích', 'isochore', '等容', '定積', '등적')), 120, 64, 12, INK.green)
  textAt(ctx, say(C('đoạn nhiệt', 'adiabat', '绝热', '断熱', '단열')), w * 0.62, 80, 12, INK.red)
})

still('separate', (ctx, w, h, p, time) => {
  if (p.variant === 'paper') {
    box(ctx, w * 0.45, 40, 28, h - 90, INK.text, '#fff')
    const rise = p.run ? (Math.abs(time) * 16) % (h - 120) : 20
    dot(ctx, w * 0.45 + 8, h - 70 - rise, INK.blue, 4)
    dot(ctx, w * 0.45 + 18, h - 70 - rise * 0.6, INK.red, 4)
    return
  }
  if (p.variant === 'extract') {
    ink(ctx, INK.sky)
    ctx.beginPath()
    ctx.moveTo(w * 0.45, 40)
    ctx.lineTo(w * 0.38, 120)
    ctx.lineTo(w * 0.62, 120)
    ctx.closePath()
    ctx.stroke()
    ctx.fillStyle = '#fde68a'
    ctx.fillRect(w * 0.4, 80, w * 0.2, 36)
    ctx.fillStyle = '#93c5fd'
    ctx.fillRect(w * 0.42, 116, w * 0.16, 28)
    return
  }
  box(ctx, w * 0.35, 50, 100, 80, INK.sky, '#e0f2fe')
  const level = p.run ? Math.max(10, 70 - (Math.abs(time) % 8) * 8) : 60
  ctx.fillStyle = '#7dd3fc'
  ctx.fillRect(w * 0.35 + 4, 50 + (80 - level), 92, level)
}, true)

still('compound-class', (ctx, w, h) => {
  const items = [['CaO', 'oxit'], ['HCl', 'axit'], ['NaOH', 'bazơ'], ['NaCl', 'muối']]
  items.forEach((item, index) => {
    const x = 30 + (index % 4) * 110
    box(ctx, x, 70, 90, 64, INK.green, '#ecfdf5')
    textAt(ctx, item[0], x + 45, 92, 14, INK.text)
    textAt(ctx, item[1], x + 45, 116, 12, INK.muted)
  })
})

still('ion-test', (ctx, w, h) => {
  const tubes = [
    [INK.muted, 'AgCl'],
    ['#0284c7', 'Cu²⁺'],
    ['#b45309', 'Fe(OH)₃'],
  ] as const
  tubes.forEach((tube, index) => {
    const x = 70 + index * 120
    box(ctx, x, 50, 36, 110, INK.text, '#f8fafc')
    ctx.fillStyle = tube[0]
    ctx.fillRect(x + 4, 100, 28, 56)
    textAt(ctx, tube[1], x + 18, 180, 12, INK.text)
  })
})

still('rust', (ctx, w, h) => {
  line(ctx, 80, 40, 80, 150, INK.muted)
  box(ctx, 60, 70, 40, 70, '#9a3412', '#fdba74')
  textAt(ctx, RUST_EQUATION, w * 0.62, h * 0.45, 14, INK.text)
  textAt(ctx, say(C('có nước', 'with water', '有水', '水がある', '물이 있음')), w * 0.62, h * 0.62, 12, INK.muted)
})

still('shells', (ctx, w, h, p) => {
  const element = p.variant === 'Cl' ? 'Cl' : 'Na'
  const shells = SHELLS[element]
  const cx = w * 0.4
  const cy = h * 0.55
  dot(ctx, cx, cy, INK.red, 8)
  shells.forEach((count, index) => {
    const r = 28 + index * 28
    ink(ctx, INK.muted)
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
    for (let i = 0; i < count; i += 1) {
      const ang = (i / count) * Math.PI * 2
      dot(ctx, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, INK.blue, 3)
    }
  })
  textAt(ctx, `${element} · ${shellTotal(element)} e⁻`, w * 0.78, 40, 14, INK.text)
})

still('redox', (ctx, w, h) => {
  textAt(ctx, 'Zn + CuSO₄ → ZnSO₄ + Cu', w / 2, 50, 15, INK.text)
  textAt(ctx, `Zn ${ZINC_COPPER.zn0} → ${ZINC_COPPER.zn1}`, w * 0.3, 110, 16, INK.blue)
  textAt(ctx, `Cu ${ZINC_COPPER.cu0} → ${ZINC_COPPER.cu1}`, w * 0.7, 110, 16, INK.amber)
  arrowTo(ctx, w * 0.4, 140, w * 0.6, 140, INK.red)
  textAt(ctx, 'e⁻', w * 0.5, 156, 12, INK.red)
})

still('titration-curve', (ctx, w, h) => {
  axes(ctx, 40, h - 40, w - 16, 30)
  ink(ctx, INK.violet)
  ctx.beginPath()
  ctx.moveTo(50, h - 70)
  ctx.lineTo(w * 0.48, h - 80)
  ctx.lineTo(w * 0.55, 70)
  ctx.lineTo(w - 30, 55)
  ctx.stroke()
  dot(ctx, w * 0.52, h * 0.5, INK.green, 4)
  textAt(ctx, 'pH 7', w * 0.66, h * 0.5, 13, INK.green)
})

still('electrolysis-solution', (ctx, w, h, p, time) => {
  const salt = p.variant === 'NaCl'
  box(ctx, 50, 70, w - 100, 110, INK.sky, '#e0f2fe')
  line(ctx, w * 0.35, 40, w * 0.35, 150, INK.muted)
  line(ctx, w * 0.65, 40, w * 0.65, 150, INK.red)
  const bob = p.run ? 6 + Math.sin(time * 5) * 4 : 0
  textAt(ctx, salt ? 'H₂' : 'Cu', w * 0.35, 30 - bob, 13, INK.blue)
  textAt(ctx, salt ? 'Cl₂' : 'Cl₂', w * 0.65, 30, 13, INK.green)
  textAt(ctx, salt ? 'catot' : 'catot', w * 0.35, 180, 12, INK.muted)
  textAt(ctx, 'anot', w * 0.65, 180, 12, INK.muted)
}, true)

still('isomer', (ctx, w, h, p) => {
  if (p.variant === 'function') {
    textAt(ctx, 'C₂H₅OH', w * 0.28, h * 0.45, 16, INK.blue)
    textAt(ctx, 'CH₃OCH₃', w * 0.72, h * 0.45, 16, INK.green)
    textAt(ctx, 'C₂H₆O', w / 2, 36, 14, INK.amber)
    return
  }
  textAt(ctx, 'CH₃CH₂CH₂CH₃', w * 0.3, h * 0.45, 13, INK.blue)
  textAt(ctx, 'CH₃CH(CH₃)CH₃', w * 0.72, h * 0.45, 13, INK.green)
  textAt(ctx, 'C₄H₁₀', w / 2, 36, 14, INK.amber)
})

still('hydrocarbon', (ctx, w, h, p) => {
  const map: Record<string, string> = {
    alkane: 'CH₃−CH₃',
    alkene: 'CH₂=CH₂',
    alkyne: 'CH≡CH',
    arene: 'C₆H₆',
  }
  if (p.variant === 'arene') {
    ink(ctx, INK.text)
    ctx.beginPath()
    for (let i = 0; i < 6; i += 1) {
      const ang = -Math.PI / 2 + (i / 6) * Math.PI * 2
      const x = w * 0.5 + Math.cos(ang) * 40
      const y = h * 0.55 + Math.sin(ang) * 40
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.stroke()
  }
  textAt(ctx, map[p.variant] || map.alkane, w / 2, p.variant === 'arene' ? 40 : h * 0.48, 20, INK.blue)
})

still('org-reaction', (ctx, w, h, p) => {
  const rows: Record<string, string> = {
    sub: 'CH₄ + Cl₂ → CH₃Cl + HCl',
    add: 'CH₂=CH₂ + Br₂ → CH₂Br−CH₂Br',
    elim: 'C₂H₅OH → C₂H₄ + H₂O',
    poly: 'n CH₂=CH₂ → (−CH₂−CH₂−)ₙ',
  }
  textAt(ctx, rows[p.variant] || rows.sub, w / 2, h * 0.48, 15, INK.text)
})

still('biomolecule', (ctx, w, h, p) => {
  const rows: Record<string, string> = {
    ester: 'R−COO−R′',
    fat: 'glixerol + 3 axit béo',
    sugar: 'C₆H₁₂O₆ vòng',
    amino: 'H₂N−CH−COOH',
  }
  textAt(ctx, rows[p.variant] || rows.ester, w / 2, h * 0.48, 18, INK.violet)
})

still('electro-series', (ctx, w, h) => {
  METAL_SERIES.forEach((metal, index) => {
    textAt(ctx, metal, 80, 28 + index * 22, 14, metal === 'H' ? INK.amber : INK.blue)
  })
  arrowTo(ctx, 160, 36, 160, h - 30, INK.red)
  textAt(ctx, say(C('dễ nhường electron', 'loses electrons more readily', '更易失电子', '電子を失いやすい', '전자를 잃기 쉬움')), 280, 40, 12, INK.red)
})

still('industry', (ctx, w, h, p) => {
  if (p.variant === 'contact') {
    textAt(ctx, '2SO₂ + O₂ ⇌ 2SO₃', w / 2, h * 0.4, 16, INK.text)
    textAt(ctx, 'V₂O₅', w / 2, h * 0.58, 14, INK.amber)
    return
  }
  textAt(ctx, 'N₂ + 3H₂ ⇌ 2NH₃', w / 2, h * 0.4, 16, INK.text)
  textAt(ctx, say(C('xúc tác Fe', 'Fe catalyst', '铁催化剂', '鉄触媒', '철 촉매')), w / 2, h * 0.58, 14, INK.amber)
})

still('kingdoms', (ctx, w, h) => {
  const names = [
    C('động vật', 'animals', '动物', '動物', '동물'),
    C('thực vật', 'plants', '植物', '植物', '식물'),
    C('nấm', 'fungi', '真菌', '菌類', '균류'),
    C('nguyên sinh', 'protists', '原生生物', '原生生物', '원생생물'),
    C('vi khuẩn', 'bacteria', '细菌', '細菌', '세균'),
  ]
  names.forEach((name, index) => {
    const x = 16 + index * 92
    box(ctx, x, 70, 84, 70, INK.violet, '#f5f3ff')
    textAt(ctx, say(name), x + 42, 105, 11, INK.violet)
  })
})

still('flowering-plant', (ctx, w, h) => {
  line(ctx, w * 0.5, 70, w * 0.5, h - 40, INK.green)
  line(ctx, w * 0.5, h - 40, w * 0.32, h - 20, INK.amber)
  line(ctx, w * 0.5, h - 40, w * 0.68, h - 20, INK.amber)
  ink(ctx, INK.green)
  ctx.beginPath()
  ctx.ellipse(w * 0.34, 140, 28, 14, -0.5, 0, Math.PI * 2)
  ctx.stroke()
  dot(ctx, w * 0.5, 48, '#f472b6', 10)
  textAt(ctx, say(C('hoa', 'flower', '花', '花', '꽃')), w * 0.68, 48, 12, '#be185d')
  textAt(ctx, say(C('lá', 'leaf', '叶', '葉', '잎')), w * 0.22, 140, 12, INK.green)
  textAt(ctx, say(C('rễ', 'root', '根', '根', '뿌리')), w * 0.28, h - 16, 12, INK.amber)
})

still('body-system', (ctx, w, h, p) => {
  const captions: Record<string, FigureCaption> = {
    digest: C('miệng → dạ dày → ruột', 'mouth → stomach → intestine', '口 → 胃 → 肠', '口 → 胃 → 腸', '입 → 위 → 창자'),
    circulation: C('tim → cơ thể → tim', 'heart → body → heart', '心 → 身体 → 心', '心臓 → 体 → 心臓', '심장 → 몸 → 심장'),
    heart: C('nhĩ phải, thất phải, nhĩ trái, thất trái', 'right atrium, right ventricle, left atrium, left ventricle', '右房、右室、左房、左室', '右房・右室・左房・左室', '우심방, 우심실, 좌심방, 좌심실'),
    alveoli: C('khí vào phế nang, máu lấy oxi', 'air enters alveoli, blood takes oxygen', '空气进肺泡，血液取氧', '空気が肺胞へ、血液が酸素を受け取る', '공기가 허파꽈리로, 피가 산소를 받음'),
    nephron: C('cầu thận → ống thận', 'glomerulus → tubule', '肾小球 → 肾小管', '糸球体 → 細尿管', '사구체 → 세뇨관'),
    synapse: C('chất truyền qua khe xinap', 'transmitter crosses the gap', '递质穿过突触', '伝達物質が隙間を渡る', '전달물질이 틈을 건넘'),
    hormone: C('tuyến đổ hoocmon vào máu', 'glands release hormones into blood', '腺体向血液释放激素', '腺がホルモンを血液へ', '샘이 호르몬을 피로'),
    immune: C('bạch cầu nhận kháng nguyên', 'white cells meet an antigen', '白细胞识别抗原', '白血球が抗原に出会う', '백혈구가 항원을 만남'),
  }
  textAt(ctx, say(captions[p.variant] || captions.digest), w / 2, h * 0.45, 14, INK.violet)
  arrowTo(ctx, 40, h * 0.62, w - 40, h * 0.62, INK.violet)
})

still('photo-resp', (ctx, w, h, p) => {
  const rows: Record<string, string> = {
    photo: '6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂',
    resp: 'C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O',
    'light-dark': 'pha sáng → ATP, NADPH → pha tối',
    aerobic: 'đường phân → Krebs → chuỗi truyền electron',
  }
  textAt(ctx, rows[p.variant] || rows.photo, w / 2, h * 0.42, 14, INK.green)
  textAt(ctx, p.variant === 'resp' || p.variant === 'aerobic' ? say(C('ty thể', 'mitochondrion', '线粒体', 'ミトコンドリア', '미토콘드리아')) : say(C('lục lạp', 'chloroplast', '叶绿体', '葉緑体', '엽록체')), w / 2, h * 0.62, 13, INK.muted)
})

still('pollination', (ctx, w, h) => {
  ink(ctx, '#be185d')
  ctx.beginPath()
  ctx.arc(w * 0.5, h * 0.55, 70, 0.2, Math.PI - 0.2)
  ctx.stroke()
  line(ctx, w * 0.5, h * 0.35, w * 0.5, h * 0.7, INK.green)
  dot(ctx, w * 0.38, h * 0.42, INK.amber, 5)
  arrowTo(ctx, w * 0.38, h * 0.42, w * 0.5, h * 0.36, INK.amber)
  textAt(ctx, say(C('nhị', 'stamen', '雄蕊', 'おしべ', '수술')), w * 0.28, h * 0.42, 12, INK.amber)
  textAt(ctx, say(C('nhụy', 'pistil', '雌蕊', 'めしべ', '암술')), w * 0.66, h * 0.36, 12, INK.green)
})

still('sex-chromosome', (ctx, w, h) => {
  textAt(ctx, 'XX', w * 0.3, h * 0.4, 28, INK.blue)
  textAt(ctx, 'XY', w * 0.7, h * 0.4, 28, INK.green)
  textAt(ctx, '1 : 1', w / 2, h * 0.65, 18, INK.amber)
})

still('carbon-cycle', (ctx, w, h) => {
  textAt(ctx, say(C('khí quyển', 'air', '大气', '大気', '대기')), w * 0.5, 40, 13, INK.sky)
  textAt(ctx, say(C('cây', 'plant', '植物', '植物', '식물')), w * 0.25, h * 0.55, 13, INK.green)
  textAt(ctx, say(C('đất', 'soil', '土壤', '土', '토양')), w * 0.75, h * 0.7, 13, INK.amber)
  CARBON_ARROWS.forEach((flow, index) => {
    const y = 80 + index * 28
    textAt(ctx, `${flow.from} → ${flow.to}`, w * 0.55, y, 11, INK.text)
  })
})

still('microbe', (ctx, w, h, p) => {
  if (p.variant === 'bacteria') {
    ink(ctx, INK.green)
    ctx.beginPath()
    ctx.ellipse(w * 0.5, h * 0.5, 70, 36, 0, 0, Math.PI * 2)
    ctx.stroke()
    textAt(ctx, say(C('thành · chất tế bào · vùng nhân', 'wall · cytoplasm · nucleoid', '壁 · 细胞质 · 拟核', '壁・細胞質・核領域', '벽 · 세포질 · 핵 영역')), w / 2, h - 28, 12, INK.muted)
    return
  }
  ink(ctx, INK.violet)
  ctx.beginPath()
  ctx.moveTo(w * 0.5, 50)
  ctx.lineTo(w * 0.72, h * 0.7)
  ctx.lineTo(w * 0.28, h * 0.7)
  ctx.closePath()
  ctx.stroke()
  dot(ctx, w * 0.5, h * 0.55, INK.amber, 8)
  textAt(ctx, say(C('vỏ và lõi, không có nhân', 'coat and core, no nucleus', '外壳和核心，无细胞核', '殻と芯、核はない', '껍질과 속, 핵 없음')), w / 2, h - 24, 12, INK.muted)
})

still('organelles', (ctx, w, h, p) => {
  const plant = p.variant === 'plant'
  ink(ctx, INK.violet)
  if (plant) ctx.strokeRect(40, 36, w - 80, h - 72)
  else {
    ctx.beginPath()
    ctx.ellipse(w * 0.5, h * 0.5, w * 0.36, h * 0.32, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  dot(ctx, w * 0.48, h * 0.48, INK.violet, 16)
  textAt(ctx, say(C('nhân', 'nucleus', '核', '核', '핵')), w * 0.48, h * 0.48, 11, '#fff')
  textAt(ctx, plant ? say(C('lục lạp · không bào · thành', 'chloroplast · vacuole · wall', '叶绿体 · 液泡 · 壁', '葉緑体・液胞・壁', '엽록체 · 액포 · 벽')) : say(C('ti thể · lưới · ribosome · Golgi', 'mitochondrion · ER · ribosome · Golgi', '线粒体 · 内质网 · 核糖体 · 高尔基体', 'ミトコンドリア・小胞体・リボソーム・ゴルジ', '미토콘드리아 · 소포체 · 리보솜 · 골지')), w / 2, h - 18, 11, INK.muted)
})

still('transpiration', (ctx, w, h, p) => {
  const open = tuneAt(p.tune, 2, 1) >= 0.5
  ink(ctx, INK.green)
  ctx.beginPath()
  ctx.ellipse(w * 0.45, h * 0.55, 80, 36, -0.4, 0, Math.PI * 2)
  ctx.stroke()
  if (open) arrowTo(ctx, w * 0.62, h * 0.48, w * 0.82, h * 0.28, INK.sky)
  textAt(ctx, open ? say(C('khí khổng mở', 'stoma open', '气孔开', '気孔が開く', '기공 열림')) : say(C('khí khổng đóng', 'stoma closed', '气孔关', '気孔が閉じる', '기공 닫힘')), w / 2, 36, 14, INK.sky)
})

registerFigure('transpiration', {
  draw: (ctx, w, h, p) => {
    const open = tuneAt(p.tune, 2, 1) >= 0.5
    ink(ctx, INK.green)
    ctx.beginPath()
    ctx.ellipse(w * 0.42, h * 0.58, 90, 40, -0.3, 0, Math.PI * 2)
    ctx.stroke()
    if (open) arrowTo(ctx, w * 0.6, h * 0.5, w * 0.84, h * 0.28, INK.sky)
    textAt(ctx, open ? 'mở' : 'đóng', w * 0.8, 48, 14, open ? INK.sky : INK.muted)
  },
  handles: (w) => [{ id: 'stoma', x: w - 36, y: 70 }],
  move: (_p, _w, _h, handle, _x, y) => (handle === 'stoma' ? [0, 0, y < 80 ? 1 : 0] : null),
})

still('mutation', (ctx, w, h, p) => {
  if (p.variant === 'chromosome') {
    line(ctx, 40, h * 0.4, 180, h * 0.4, INK.blue)
    line(ctx, 40, h * 0.65, 120, h * 0.65, INK.red)
    textAt(ctx, say(C('mất một đoạn', 'a segment is lost', '缺失一段', '一部が失われる', '한 구간이 빠짐')), w * 0.7, h * 0.5, 13, INK.red)
    return
  }
  textAt(ctx, 'A T G C', w * 0.3, h * 0.4, 16, INK.blue)
  textAt(ctx, 'A T T C', w * 0.7, h * 0.4, 16, INK.red)
})

still('succession', (ctx, w, h) => {
  const labels = [
    C('đất trống', 'bare ground', '裸地', '裸地', '빈 땅'),
    C('cỏ', 'herbs', '草本', '草', '풀'),
    C('cây gỗ', 'trees', '乔木', '高木', '나무'),
  ]
  labels.forEach((label, index) => {
    const x = 40 + index * 140
    box(ctx, x, 80, 100, 60, INK.green, '#ecfdf5')
    textAt(ctx, say(label), x + 50, 110, 13, INK.green)
    if (index < 2) arrowTo(ctx, x + 104, 110, x + 132, 110)
  })
})

still('pcr-gel', (ctx, w, h, p) => {
  if (p.variant === 'gel') {
    box(ctx, 80, 40, 220, 150, INK.text, '#e2e8f0')
    ;[40, 70, 100, 130].forEach((y, index) => {
      ctx.fillStyle = INK.blue
      ctx.fillRect(100 + index * 40, 50 + y * 0.4, 16, 8)
    })
    return
  }
  ;['95 °C', '55 °C', '72 °C'].forEach((step, index) => {
    box(ctx, 40 + index * 130, 80, 100, 50, INK.violet, '#f5f3ff')
    textAt(ctx, step, 90 + index * 130, 105, 14, INK.violet)
  })
})

still('ferment', (ctx, w, h, p, time) => {
  box(ctx, 40, 60, 90, 110, INK.sky, '#e0f2fe')
  line(ctx, 130, 90, 230, 90, INK.muted)
  box(ctx, 230, 100, 70, 80, INK.text, '#f8fafc')
  if (p.run) {
    const x = 140 + (Math.abs(time) * 20) % 80
    dot(ctx, x, 84, INK.muted, 3)
    ctx.fillStyle = '#cbd5e1'
    ctx.fillRect(234, 140, 62, 36)
  }
  textAt(ctx, say(C('nước vôi', 'limewater', '石灰水', '石灰水', '석회수')), 265, 200, 12, INK.muted)
}, true)

still('central-dogma', (ctx, w, h) => {
  const steps = [
    C('sao chép', 'replication', '复制', '複製', '복제'),
    C('phiên mã', 'transcription', '转录', '転写', '전사'),
    C('dịch mã', 'translation', '翻译', '翻訳', '번역'),
  ]
  steps.forEach((step, index) => {
    const x = 24 + index * 150
    box(ctx, x, 70, 120, 48, INK.violet, '#f5f3ff')
    textAt(ctx, say(step), x + 60, 94, 13, INK.violet)
    if (index < 2) arrowTo(ctx, x + 124, 94, x + 146, 94)
  })
  textAt(ctx, 'ADN → ARN → protein', w / 2, 150, 13, INK.muted)
})
