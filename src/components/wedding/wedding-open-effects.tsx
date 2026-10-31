'use client'

import { useEffect, useRef } from 'react'
import type { WeddingOpenBurstEffect, WeddingOpenFallEffect } from '@/lib/wedding/wedding-section-config'

type BitKind = 'petal' | 'heart' | 'star' | 'spark' | 'confetti' | 'lantern' | 'butterfly' | 'rocket'

type Bit = {
  kind: BitKind
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  size: number
  life: number
  max: number
  color: string
  color2: string
  sway: number
  phase: number
  gravity: number
  drag: number
}

type Bloom = {
  x: number
  y: number
  delay: number
  size: number
  rot: number
  petals: number
  color: string
  inner: string
  center: string
}

type EffectLook = {
  petal: readonly string[]
  petalSoft: readonly string[]
  heart: readonly string[]
  metal: readonly string[]
  paper: readonly string[]
  wing: readonly string[]
  wingSoft: readonly string[]
  lantern: readonly string[]
  lanternGlow: string
  bloom: readonly string[]
  bloomInner: readonly string[]
  bloomCenter: readonly string[]
  /** RGB không kèm alpha, cho vệt sáng lúc bung. */
  flash: readonly [string, string]
  /** Mép hạt mờ bao nhiêu. 0 = sắc, cao = sương. */
  haze: number
  /** Nhân số hạt. Chủ đề tối giản thưa hơn. */
  density: number
  /** Nhân lắc. Cao = trôi, thấp = rơi thẳng. */
  float: number
  /** Nhân trọng lực. */
  weight: number
  /** Nhân tốc độ lúc bung. Thấp = không bắn như game. */
  rush: number
  /** Cách vẽ hạt. quiet/mist/studio là ánh sáng, không phải icon. */
  grain: 'foil' | 'quiet' | 'lacquer' | 'mist' | 'garden' | 'print' | 'studio'
}

const LOOKS: Record<string, EffectLook> = {
  luxury: {
    petal: ['#fff6f2', '#f3c9c4', '#e7b08a', '#f6d7a8'],
    petalSoft: ['#fffaf6', '#f8e7d4'],
    heart: ['#f6d3c4', '#e8b4a2', '#f3e2c4'],
    metal: ['#fff8e8', '#f3d48a', '#e8c56b', '#fffef8'],
    paper: ['#fff6ea', '#f3d7c4', '#f6e7c1', '#efe6da'],
    wing: ['#f8e4d4', '#f3d5c4', '#f6e7b8'],
    wingSoft: ['#fffef8', '#fdecc8'],
    lantern: ['#c4513c', '#d4a24c'],
    lanternGlow: '#fff1c9',
    bloom: ['#fff4ee', '#f6d3c8', '#f3e0c4'],
    bloomInner: ['#e7a898', '#d4a574'],
    bloomCenter: ['#f6d48a', '#fff8e4'],
    flash: ['255, 246, 236', '232, 196, 160'],
    haze: 1.15,
    density: 0.8,
    float: 1.15,
    weight: 0.72,
    rush: 0.62,
    grain: 'foil',
  },
  minimal: {
    petal: ['#fafaf9', '#e7e5e4', '#f5f5f4', '#e7eee8'],
    petalSoft: ['#ffffff', '#f5f5f4'],
    heart: ['#e7e5e4', '#d6d3d1', '#e7eee8'],
    metal: ['#fafaf9', '#e7e5e4', '#ffffff'],
    paper: ['#fafaf9', '#f5f5f4', '#e7e5e4', '#eef4ef'],
    wing: ['#f5f5f4', '#e7eee8', '#ffffff'],
    wingSoft: ['#ffffff', '#f5f5f4'],
    lantern: ['#a8a29e', '#78716c'],
    lanternGlow: '#fafaf9',
    bloom: ['#fafaf9', '#f5f5f4', '#e7eee8'],
    bloomInner: ['#d6d3d1', '#c4cdc4'],
    bloomCenter: ['#e7e5e4', '#ffffff'],
    flash: ['250, 250, 249', '214, 211, 209'],
    haze: 0.85,
    density: 0.28,
    float: 0.35,
    weight: 0.4,
    rush: 0.4,
    grain: 'quiet',
  },
  traditional_vietnamese: {
    petal: ['#fff4e8', '#f0c9a0', '#e8a0a0', '#f6d48a'],
    petalSoft: ['#fff8ee', '#f3d7b0'],
    heart: ['#f0b4b4', '#e07070', '#f6d48a'],
    metal: ['#fff4d0', '#f6d48a', '#e8c56b', '#fff8e8'],
    paper: ['#fff6ea', '#f6d48a', '#f0c4b4', '#f8e0c8'],
    wing: ['#f8d7c4', '#f6d48a', '#f0c4b8'],
    wingSoft: ['#fff6e4', '#fde68a'],
    lantern: ['#c2413a', '#d4a24c', '#9f2d2d'],
    lanternGlow: '#ffe7a8',
    bloom: ['#fff4ea', '#f6d7c0', '#f0c4b0'],
    bloomInner: ['#c4513c', '#d4a24c'],
    bloomCenter: ['#f6d48a', '#fff4d0'],
    flash: ['255, 244, 230', '196, 72, 62'],
    haze: 0.45,
    density: 0.92,
    float: 0.7,
    weight: 1.05,
    rush: 0.7,
    grain: 'lacquer',
  },
  ethereal: {
    petal: ['#fffdfb', '#f4e4ea', '#efe6f4', '#f7f1ea'],
    petalSoft: ['#ffffff', '#f8eef2'],
    heart: ['#f6e4ea', '#ead8ee', '#f3e6ea'],
    metal: ['#ffffff', '#f3e6d4', '#e8dfd6'],
    paper: ['#fffdfb', '#f4e8ee', '#efe8f4', '#f7f1ea'],
    wing: ['#f6e8ee', '#efe4f4', '#ffffff'],
    wingSoft: ['#ffffff', '#f8eef6'],
    lantern: ['#e7c4b8', '#d4b8c8'],
    lanternGlow: '#fff8f4',
    bloom: ['#fffdfb', '#f6e4ea', '#f3e8f4'],
    bloomInner: ['#e4c8d0', '#d8c4d4'],
    bloomCenter: ['#f6e6d4', '#ffffff'],
    flash: ['255, 252, 250', '232, 210, 220'],
    haze: 2.2,
    density: 0.62,
    float: 1.65,
    weight: 0.32,
    rush: 0.4,
    grain: 'mist',
  },
  floral: {
    petal: ['#fff5f7', '#f7c5d0', '#f0b7c4', '#e7d4c8'],
    petalSoft: ['#ffffff', '#f8d5de'],
    heart: ['#f8c9d4', '#f0a8b8', '#f7d6e0'],
    metal: ['#ffffff', '#f6d48a', '#f8e0ea'],
    paper: ['#fff6f8', '#f7d0da', '#e7f0e4', '#f6e7c8'],
    wing: ['#f8d0da', '#fde7ef', '#e7f3ea'],
    wingSoft: ['#ffffff', '#fbcfe8'],
    lantern: ['#d46a7a', '#e7b4a0'],
    lanternGlow: '#fff5f7',
    bloom: ['#fff1f4', '#f7c5d2', '#f3e4ea'],
    bloomInner: ['#e9899d', '#d4a0a8'],
    bloomCenter: ['#f6d48a', '#ffffff'],
    flash: ['255, 244, 246', '232, 168, 184'],
    haze: 1.25,
    density: 1,
    float: 1.28,
    weight: 0.55,
    rush: 0.55,
    grain: 'garden',
  },
  vintage: {
    petal: ['#f8ead8', '#e8c4a8', '#d8b09a', '#f0d8c4'],
    petalSoft: ['#fff6ea', '#ead4c0'],
    heart: ['#e8c4b4', '#d4a898', '#f0d8c0'],
    metal: ['#f6e2c0', '#e8c48a', '#f8edd8'],
    paper: ['#f7ead7', '#e8d0b4', '#e0c4b0', '#f3e0c8'],
    wing: ['#f0d8c4', '#e8d0b0', '#f6e6d4'],
    wingSoft: ['#fff6ea', '#f0dcc4'],
    lantern: ['#c4784a', '#a86840'],
    lanternGlow: '#ffe8c8',
    bloom: ['#f8ead8', '#f0d4c0', '#e8d0b8'],
    bloomInner: ['#c48868', '#d4a080'],
    bloomCenter: ['#e8c48a', '#fff4e0'],
    flash: ['248, 236, 216', '200, 140, 100'],
    haze: 0.9,
    density: 0.72,
    float: 0.85,
    weight: 0.8,
    rush: 0.6,
    grain: 'print',
  },
  modern: {
    petal: ['#f8fafc', '#e8eef4', '#f6e7c8', '#ffffff'],
    petalSoft: ['#ffffff', '#e8edf2'],
    heart: ['#f1f5f9', '#f6e7c8', '#e2e8f0'],
    metal: ['#ffffff', '#f6d48a', '#fde68a', '#e8eef4'],
    paper: ['#f8fafc', '#e2e8f0', '#f6e7c8', '#ffffff'],
    wing: ['#f8fafc', '#f6e7c8', '#e8eef4'],
    wingSoft: ['#ffffff', '#fde68a'],
    lantern: ['#d4a24c', '#94a3b8'],
    lanternGlow: '#fff6d8',
    bloom: ['#f8fafc', '#f6e7c8', '#e8eef4'],
    bloomInner: ['#d4a24c', '#cbd5e1'],
    bloomCenter: ['#f6d48a', '#ffffff'],
    flash: ['248, 250, 252', '214, 168, 80'],
    haze: 0.2,
    density: 0.48,
    float: 0.22,
    weight: 0.9,
    rush: 0.74,
    grain: 'studio',
  },
  'tre-viet': {
    petal: ['#f4f7f1', '#c5d7c0', '#8eae90', '#e7f0e4'],
    petalSoft: ['#ffffff', '#dce8d8'],
    heart: ['#c5d7c0', '#a8c4a4', '#e7f0e4'],
    metal: ['#f4f7f1', '#d5e4c8', '#ffffff'],
    paper: ['#f4f7f1', '#dce8d8', '#e7f0e4', '#f7faf4'],
    wing: ['#dce8d8', '#e7f0e4', '#ffffff'],
    wingSoft: ['#ffffff', '#e4efe2'],
    lantern: ['#2f6b45', '#8eae90'],
    lanternGlow: '#f4f7f1',
    bloom: ['#f4f7f1', '#c5d7c0', '#e7f0e4'],
    bloomInner: ['#3d7a52', '#8eae90'],
    bloomCenter: ['#e8f0dc', '#ffffff'],
    flash: ['244, 247, 241', '142, 174, 144'],
    haze: 1.05,
    density: 0.62,
    float: 1.02,
    weight: 0.58,
    rush: 0.46,
    grain: 'garden',
  },
  'hoa-dao': {
    petal: ['#fff6f4', '#f8c9d0', '#e7a0ae', '#f3d0c8'],
    petalSoft: ['#ffffff', '#fde7ea'],
    heart: ['#f8c9d0', '#e7a0ae', '#fff0ea'],
    metal: ['#fff6f4', '#f0d4c0', '#ffffff'],
    paper: ['#fff6f4', '#f8e0e2', '#f3d0c8', '#fffaf6'],
    wing: ['#f8e0e2', '#fff0ea', '#ffffff'],
    wingSoft: ['#ffffff', '#fde7ea'],
    lantern: ['#a34762', '#e7a0ae'],
    lanternGlow: '#fff6f4',
    bloom: ['#fff6f4', '#f8c9d0', '#f3d0c8'],
    bloomInner: ['#a34762', '#e7a0ae'],
    bloomCenter: ['#f6e2c0', '#ffffff'],
    flash: ['255, 246, 244', '232, 160, 174'],
    haze: 1.1,
    density: 0.8,
    float: 1.15,
    weight: 0.5,
    rush: 0.5,
    grain: 'garden',
  },
  bien: {
    petal: ['#f7f1e6', '#e4d4bc', '#d5ebe6', '#fffaf4'],
    petalSoft: ['#ffffff', '#e7f3f1'],
    heart: ['#e4d4bc', '#d5ebe6', '#f7f1e6'],
    metal: ['#fffaf4', '#e6d3b3', '#ffffff'],
    paper: ['#f7f1e6', '#e7f3f1', '#e4d4bc', '#fffaf4'],
    wing: ['#e7f3f1', '#f7f1e6', '#ffffff'],
    wingSoft: ['#ffffff', '#e4d4bc'],
    lantern: ['#0f766e', '#c4a882'],
    lanternGlow: '#f7f1e6',
    bloom: ['#f7f1e6', '#d5ebe6', '#e4d4bc'],
    bloomInner: ['#0f766e', '#7d9a96'],
    bloomCenter: ['#fffaf4', '#ffffff'],
    flash: ['247, 241, 230', '125, 154, 150'],
    haze: 1.2,
    density: 0.45,
    float: 1.3,
    weight: 0.4,
    rush: 0.4,
    grain: 'mist',
  },
  'dem-vang': {
    petal: ['#f6e7c8', '#e6d3b3', '#c6a15b', '#fffaf0'],
    petalSoft: ['#fffaf0', '#f3e6c8'],
    heart: ['#e6d3b3', '#c6a15b', '#f6e7c8'],
    metal: ['#fffaf0', '#e6d3b3', '#f6d48a', '#ffffff'],
    paper: ['#0c1830', '#1a2d52', '#e6d3b3', '#f6e7c8'],
    wing: ['#e6d3b3', '#f6e7c8', '#1a2d52'],
    wingSoft: ['#fffaf0', '#e6d3b3'],
    lantern: ['#c6a15b', '#e6d3b3'],
    lanternGlow: '#f6e7c8',
    bloom: ['#f6e7c8', '#e6d3b3', '#1a2d52'],
    bloomInner: ['#c6a15b', '#8a5a12'],
    bloomCenter: ['#f6d48a', '#fffaf0'],
    flash: ['243, 230, 200', '198, 161, 91'],
    haze: 0.35,
    density: 0.55,
    float: 0.4,
    weight: 0.85,
    rush: 0.62,
    grain: 'studio',
  },
  'lua-ao-dai': {
    petal: ['#fbf7f1', '#f0e4d4', '#e7d7c3', '#fffaf6'],
    petalSoft: ['#ffffff', '#f0e4d4'],
    heart: ['#f0e4d4', '#e7d7c3', '#fbf7f1'],
    metal: ['#fffaf6', '#e6d3b3', '#ffffff'],
    paper: ['#fbf7f1', '#f0e4d4', '#e7d7c3', '#fffaf6'],
    wing: ['#f0e4d4', '#fbf7f1', '#ffffff'],
    wingSoft: ['#ffffff', '#f0e4d4'],
    lantern: ['#8a5727', '#c4a882'],
    lanternGlow: '#fbf7f1',
    bloom: ['#fbf7f1', '#f0e4d4', '#e7d7c3'],
    bloomInner: ['#c4a882', '#8a5727'],
    bloomCenter: ['#fffaf6', '#ffffff'],
    flash: ['251, 247, 241', '196, 168, 130'],
    haze: 1.35,
    density: 0.4,
    float: 1.2,
    weight: 0.42,
    rush: 0.38,
    grain: 'mist',
  },
  'do-dam': {
    petal: ['#f8e8ea', '#c45a68', '#8f3040', '#f0d0c8'],
    petalSoft: ['#fff6f4', '#e8b0b4'],
    heart: ['#e8b4bc', '#c45a68', '#f0d0c8'],
    metal: ['#f6e2c0', '#e8c48a', '#fff8ee'],
    paper: ['#f8e8ea', '#e8c0c4', '#f0d8cc', '#f6e6d4'],
    wing: ['#f0d0d4', '#e8c0b8', '#f6e6d4'],
    wingSoft: ['#fff6f4', '#f0d8cc'],
    lantern: ['#8f3040', '#c4784a'],
    lanternGlow: '#ffe8c8',
    bloom: ['#f8e8ea', '#e8b8c0', '#f0d4c8'],
    bloomInner: ['#8f3040', '#c45a68'],
    bloomCenter: ['#e8c48a', '#fff4e0'],
    flash: ['248, 232, 234', '143, 48, 64'],
    haze: 0.9,
    density: 0.78,
    float: 0.9,
    weight: 0.7,
    rush: 0.55,
    grain: 'garden',
  },
  'hoa-moc-xanh': {
    petal: ['#f4f7f2', '#d7e4d4', '#b7cbb0', '#f6efe4'],
    petalSoft: ['#ffffff', '#e4efe2'],
    heart: ['#d7e4d4', '#c4d4bc', '#f0e6d4'],
    metal: ['#f6efe4', '#e4d4b0', '#ffffff'],
    paper: ['#f4f7f2', '#dce8d8', '#efe6d8', '#e7f0e4'],
    wing: ['#dce8d8', '#f0e6d4', '#ffffff'],
    wingSoft: ['#ffffff', '#e7f0e4'],
    lantern: ['#6d8a62', '#c4a574'],
    lanternGlow: '#f6efe4',
    bloom: ['#f4f7f2', '#d7e4d4', '#efe6d4'],
    bloomInner: ['#7d9a72', '#c4a574'],
    bloomCenter: ['#f0e0c0', '#ffffff'],
    flash: ['244, 247, 242', '160, 184, 150'],
    haze: 1.05,
    density: 0.7,
    float: 1.05,
    weight: 0.6,
    rush: 0.5,
    grain: 'garden',
  },
  'to-duyen-xanh': {
    petal: ['#f7faf8', '#d5e4dc', '#e7f0ea', '#f4f1ea'],
    petalSoft: ['#ffffff', '#e7f0ea'],
    heart: ['#d5e4dc', '#e4eee8', '#f4f1ea'],
    metal: ['#ffffff', '#e7eee8', '#f4f1ea'],
    paper: ['#f7faf8', '#e4eee8', '#f4f1ea', '#dce8e2'],
    wing: ['#e7f0ea', '#f4f1ea', '#ffffff'],
    wingSoft: ['#ffffff', '#eef6f2'],
    lantern: ['#8aa898', '#c4d0c8'],
    lanternGlow: '#f7faf8',
    bloom: ['#f7faf8', '#e4eee8', '#f4f1ea'],
    bloomInner: ['#b7cdc2', '#d5e0d8'],
    bloomCenter: ['#f4f1ea', '#ffffff'],
    flash: ['247, 250, 248', '200, 220, 210'],
    haze: 1.8,
    density: 0.42,
    float: 1.4,
    weight: 0.36,
    rush: 0.4,
    grain: 'mist',
  },
}

const PATTERN_TWIN: Record<string, string> = {
  'hoa-dao-van': 'hoa-dao',
  'bien-van': 'bien',
  'dem-vang-van': 'dem-vang',
  'lua-van': 'lua-ao-dai',
}

function lookFor(themeId: string | undefined, lookId?: string): EffectLook {
  const named = lookId === 'phong-bi-thu' ? 'do-dam' : lookId
  const key = named ? PATTERN_TWIN[named] ?? named : named
  if (key && LOOKS[key]) return LOOKS[key]!
  const theme = themeId ? PATTERN_TWIN[themeId] ?? themeId : 'luxury'
  return LOOKS[theme] ?? LOOKS.luxury!
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]!
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3
}

function fade(bit: Bit) {
  const age = bit.max - bit.life
  const inn = Math.min(1, age / 0.28)
  return Math.max(0, Math.min(1, bit.life / bit.max)) * inn
}

function makeBit(partial: Bit): Bit {
  return partial
}

function petalBit(x: number, y: number, vx: number, vy: number, size: number, look: EffectLook): Bit {
  return makeBit({
    kind: 'petal',
    x,
    y,
    vx,
    vy,
    rot: rand(0, Math.PI * 2),
    vr: rand(-1.6, 1.6),
    size,
    life: rand(5.5, 8.5),
    max: 8.5,
    color: pick(look.petal),
    color2: pick(look.petalSoft),
    sway: rand(12, 36),
    phase: rand(0, Math.PI * 2),
    gravity: rand(8, 22),
    drag: rand(0.15, 0.45),
  })
}

function tracePetal(ctx: CanvasRenderingContext2D, h: number, w: number, shape: 'almond' | 'lotus' | 'rose') {
  ctx.beginPath()
  if (shape === 'lotus') {
    ctx.moveTo(0, -h)
    ctx.bezierCurveTo(w * 1.7, -h * 0.15, w * 1.25, h * 0.48, 0, h * 0.9)
    ctx.bezierCurveTo(-w * 1.25, h * 0.48, -w * 1.7, -h * 0.15, 0, -h)
  } else if (shape === 'rose') {
    ctx.moveTo(0, -h * 0.9)
    ctx.bezierCurveTo(w * 1.5, -h * 0.5, w * 1.2, h * 0.12, w * 0.32, h * 0.7)
    ctx.quadraticCurveTo(0, h * 1.02, -w * 0.38, h * 0.62)
    ctx.bezierCurveTo(-w * 1.25, h * 0.02, -w * 1.1, -h * 0.48, 0, -h * 0.9)
  } else {
    ctx.moveTo(0, -h)
    ctx.bezierCurveTo(w * 1.2, -h * 0.42, w * 0.92, h * 0.38, w * 0.18, h * 0.82)
    ctx.quadraticCurveTo(0, h, -w * 0.22, h * 0.62)
    ctx.bezierCurveTo(-w * 0.85, h * 0.22, -w * 0.55, -h * 0.28, 0, -h)
  }
  ctx.closePath()
}

function drawPetal(ctx: CanvasRenderingContext2D, bit: Bit, time: number, look: EffectLook) {
  const flutter = 0.72 + 0.28 * Math.abs(Math.sin(time * 1.6 + bit.phase))
  const h = bit.size
  const w = bit.size * 0.48 * flutter
  const alpha = fade(bit)
  const shape = look.grain === 'lacquer' ? 'lotus' : look.grain === 'garden' ? 'rose' : 'almond'
  ctx.save()
  ctx.translate(bit.x, bit.y)
  ctx.rotate(bit.rot)
  ctx.globalAlpha = alpha * 0.22
  const glow = ctx.createRadialGradient(0, 0, h * 0.1, 0, 0, h * 1.15)
  glow.addColorStop(0, bit.color2)
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.ellipse(0, h * 0.05, w * 1.4, h * 0.85, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = alpha * 0.94
  tracePetal(ctx, h, w, shape)
  const g = ctx.createLinearGradient(-w * 0.2, -h, w * 0.35, h)
  g.addColorStop(0, bit.color2)
  g.addColorStop(0.45, bit.color)
  g.addColorStop(1, bit.color2)
  ctx.fillStyle = g
  ctx.fill()
  ctx.globalAlpha = alpha * 0.45
  const sheen = ctx.createLinearGradient(-w * 0.3, -h * 0.6, w * 0.2, h * 0.2)
  sheen.addColorStop(0, 'rgba(255,252,246,0.85)')
  sheen.addColorStop(0.45, 'rgba(255,252,246,0)')
  ctx.fillStyle = sheen
  tracePetal(ctx, h * 0.72, w * 0.55, shape)
  ctx.fill()
  ctx.globalAlpha = alpha * 0.28
  ctx.strokeStyle = bit.color2
  ctx.lineWidth = Math.max(0.35, bit.size * 0.035)
  ctx.beginPath()
  ctx.moveTo(0, -h * 0.62)
  ctx.quadraticCurveTo(w * 0.06, 0, -w * 0.03, h * 0.5)
  ctx.stroke()
  ctx.restore()
}

function drawHeart(ctx: CanvasRenderingContext2D, bit: Bit) {
  const s = bit.size
  const alpha = fade(bit)
  ctx.save()
  ctx.translate(bit.x, bit.y)
  ctx.rotate(bit.rot)
  const glow = ctx.createRadialGradient(0, -s * 0.05, s * 0.05, 0, 0, s * 1.35)
  glow.addColorStop(0, bit.color2)
  glow.addColorStop(0.45, bit.color)
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.globalAlpha = alpha * 0.55
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(0, 0, s * 1.35, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = alpha * 0.92
  ctx.beginPath()
  ctx.moveTo(0, s * 0.42)
  ctx.bezierCurveTo(-s * 1.15, -s * 0.28, -s * 0.42, -s * 1.05, 0, -s * 0.32)
  ctx.bezierCurveTo(s * 0.42, -s * 1.05, s * 1.15, -s * 0.28, 0, s * 0.42)
  const g = ctx.createRadialGradient(-s * 0.22, -s * 0.38, s * 0.04, 0, -s * 0.05, s * 1.05)
  g.addColorStop(0, '#fffef8')
  g.addColorStop(0.28, bit.color2)
  g.addColorStop(0.72, bit.color)
  g.addColorStop(1, bit.color)
  ctx.fillStyle = g
  ctx.fill()
  ctx.restore()
}

function drawStar(ctx: CanvasRenderingContext2D, bit: Bit, time: number) {
  const twinkle = 0.28 + 0.72 * Math.abs(Math.sin(time * 3.4 + bit.phase))
  const alpha = fade(bit) * twinkle
  const len = bit.size * 2.4
  ctx.save()
  ctx.translate(bit.x, bit.y)
  ctx.rotate(bit.rot)
  ctx.globalAlpha = alpha
  ctx.lineCap = 'round'
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 4)
    const ray = ctx.createLinearGradient(0, 0, len, 0)
    ray.addColorStop(0, bit.color2)
    ray.addColorStop(0.35, bit.color)
    ray.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.strokeStyle = ray
    ctx.lineWidth = i % 2 === 0 ? Math.max(0.8, bit.size * 0.16) : Math.max(0.4, bit.size * 0.07)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(i % 2 === 0 ? len : len * 0.55, 0)
    ctx.stroke()
  }
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, bit.size * 0.7)
  glow.addColorStop(0, '#fffef8')
  glow.addColorStop(0.45, bit.color)
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(0, 0, bit.size * 0.7, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawSpark(ctx: CanvasRenderingContext2D, bit: Bit) {
  const a = fade(bit)
  const fast = Math.abs(bit.vx) + Math.abs(bit.vy) > 80
  const radius = Math.max(1.4, bit.size * (fast ? 1.1 : 1.8))
  ctx.save()
  if (fast) {
    ctx.globalAlpha = a * 0.4
    ctx.strokeStyle = bit.color
    ctx.lineWidth = Math.max(0.8, bit.size * 0.45)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(bit.x, bit.y)
    ctx.lineTo(bit.x - bit.vx * 0.04, bit.y - bit.vy * 0.04)
    ctx.stroke()
  }
  const glow = ctx.createRadialGradient(bit.x, bit.y, 0, bit.x, bit.y, radius)
  glow.addColorStop(0, bit.color2)
  glow.addColorStop(0.35, bit.color)
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.globalAlpha = a
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(bit.x, bit.y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawConfetti(ctx: CanvasRenderingContext2D, bit: Bit, time: number) {
  const flip = Math.cos(time * 2.4 + bit.phase)
  const alpha = fade(bit)
  ctx.save()
  ctx.translate(bit.x, bit.y)
  ctx.rotate(bit.rot)
  ctx.scale(Math.max(0.12, Math.abs(flip)) * Math.sign(flip || 1), 1)
  ctx.globalAlpha = alpha * 0.92
  const w = bit.size * 0.16
  const h = bit.size * 2.15
  const foil = ctx.createLinearGradient(-w, -h, w, h)
  foil.addColorStop(0, bit.color2)
  foil.addColorStop(0.38, bit.color)
  foil.addColorStop(0.5, '#fffef8')
  foil.addColorStop(0.64, bit.color)
  foil.addColorStop(1, bit.color2)
  ctx.fillStyle = foil
  ctx.beginPath()
  ctx.moveTo(-w * 0.2, -h)
  ctx.quadraticCurveTo(w * 2.2, -h * 0.15, w * 0.15, h)
  ctx.quadraticCurveTo(-w * 1.1, h * 0.2, -w * 0.2, -h)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawLantern(ctx: CanvasRenderingContext2D, bit: Bit) {
  const w = bit.size * 0.72
  const h = bit.size
  const alpha = fade(bit)
  ctx.save()
  ctx.translate(bit.x, bit.y)
  ctx.rotate(bit.rot * 0.12)
  const halo = ctx.createRadialGradient(0, 0, h * 0.05, 0, h * 0.05, h * 1.15)
  halo.addColorStop(0, bit.color2)
  halo.addColorStop(0.45, bit.color)
  halo.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.globalAlpha = alpha * 0.55
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.ellipse(0, h * 0.02, w * 0.95, h * 0.85, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = alpha * 0.55
  ctx.strokeStyle = 'rgba(90, 40, 24, 0.45)'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(0, -h * 0.95)
  ctx.lineTo(0, -h * 0.58)
  ctx.stroke()
  ctx.globalAlpha = alpha * 0.85
  ctx.fillStyle = bit.color
  ctx.beginPath()
  ctx.roundRect(-w * 0.28, -h * 0.62, w * 0.56, h * 0.08, 3)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-w * 0.46, -h * 0.32)
  ctx.bezierCurveTo(-w * 0.62, -h * 0.05, -w * 0.58, h * 0.22, -w * 0.22, h * 0.46)
  ctx.quadraticCurveTo(0, h * 0.58, w * 0.22, h * 0.46)
  ctx.bezierCurveTo(w * 0.58, h * 0.22, w * 0.62, -h * 0.05, w * 0.46, -h * 0.32)
  ctx.closePath()
  const silk = ctx.createLinearGradient(-w, 0, w, 0)
  silk.addColorStop(0, bit.color)
  silk.addColorStop(0.5, bit.color2)
  silk.addColorStop(1, bit.color)
  ctx.fillStyle = silk
  ctx.fill()
  const flame = ctx.createRadialGradient(0, h * 0.02, 1, 0, h * 0.04, h * 0.34)
  flame.addColorStop(0, '#fffef6')
  flame.addColorStop(0.4, bit.color2)
  flame.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.globalAlpha = alpha * 0.9
  ctx.fillStyle = flame
  ctx.beginPath()
  ctx.ellipse(0, h * 0.02, w * 0.28, h * 0.32, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawButterfly(ctx: CanvasRenderingContext2D, bit: Bit, time: number) {
  const flap = 0.58 + 0.42 * Math.abs(Math.sin(time * 2.4 + bit.phase))
  const alpha = fade(bit)
  const wing = (sign: number) => {
    ctx.save()
    ctx.scale(sign * flap, 1)
    const g = ctx.createRadialGradient(-bit.size * 0.35, -bit.size * 0.08, 1, -bit.size * 0.2, 0, bit.size * 0.85)
    g.addColorStop(0, bit.color2)
    g.addColorStop(0.5, bit.color)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.bezierCurveTo(-bit.size * 0.2, -bit.size * 0.9, -bit.size * 1.15, -bit.size * 0.35, -bit.size * 0.7, bit.size * 0.02)
    ctx.bezierCurveTo(-bit.size * 1.05, bit.size * 0.42, -bit.size * 0.4, bit.size * 0.72, 0, bit.size * 0.08)
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = alpha * 0.35
    ctx.strokeStyle = bit.color2
    ctx.lineWidth = Math.max(0.4, bit.size * 0.04)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(-bit.size * 0.45, -bit.size * 0.2, -bit.size * 0.7, bit.size * 0.02)
    ctx.stroke()
    ctx.restore()
  }
  ctx.save()
  ctx.translate(bit.x, bit.y)
  ctx.rotate(bit.rot * 0.35)
  ctx.globalAlpha = alpha * 0.72
  wing(-1)
  wing(1)
  ctx.globalAlpha = alpha * 0.35
  ctx.strokeStyle = bit.color2
  ctx.lineWidth = Math.max(0.4, bit.size * 0.04)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(0, -bit.size * 0.28)
  ctx.quadraticCurveTo(bit.size * 0.04, 0, 0, bit.size * 0.32)
  ctx.stroke()
  ctx.restore()
}

function drawBokeh(ctx: CanvasRenderingContext2D, bit: Bit, spread: number, alphaScale: number) {
  const a = fade(bit) * alphaScale
  const r = Math.max(5, bit.size * spread)
  const g = ctx.createRadialGradient(bit.x - r * 0.15, bit.y - r * 0.18, 0, bit.x, bit.y, r)
  g.addColorStop(0, bit.color2)
  g.addColorStop(0.28, bit.color)
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.save()
  ctx.globalAlpha = a
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(bit.x, bit.y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawStreak(ctx: CanvasRenderingContext2D, bit: Bit) {
  const a = fade(bit)
  const len = Math.max(10, bit.size * 3.4)
  const ang = Math.atan2(bit.vy, bit.vx || 0.001)
  ctx.save()
  ctx.translate(bit.x, bit.y)
  ctx.rotate(ang)
  ctx.globalAlpha = a * 0.9
  ctx.lineCap = 'round'
  const g = ctx.createLinearGradient(-len, 0, len, 0)
  g.addColorStop(0, 'rgba(255,255,255,0)')
  g.addColorStop(0.5, bit.color2)
  g.addColorStop(0.72, bit.color)
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.strokeStyle = g
  ctx.lineWidth = Math.max(0.7, bit.size * 0.16)
  ctx.beginPath()
  ctx.moveTo(-len, 0)
  ctx.lineTo(len * 0.85, 0)
  ctx.stroke()
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, bit.size * 0.7)
  core.addColorStop(0, '#fffef8')
  core.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = core
  ctx.beginPath()
  ctx.arc(0, 0, bit.size * 0.55, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawBlossom(ctx: CanvasRenderingContext2D, bit: Bit) {
  const alpha = fade(bit)
  const size = bit.size
  ctx.save()
  ctx.translate(bit.x, bit.y)
  ctx.rotate(bit.rot)
  ctx.globalAlpha = alpha * 0.9
  for (let i = 0; i < 5; i++) {
    ctx.save()
    ctx.rotate((i / 5) * Math.PI * 2)
    tracePetal(ctx, size * 0.82, size * 0.36, 'rose')
    const g = ctx.createLinearGradient(0, -size, 0, size * 0.2)
    g.addColorStop(0, bit.color2)
    g.addColorStop(1, bit.color)
    ctx.fillStyle = g
    ctx.fill()
    ctx.restore()
  }
  const center = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.2)
  center.addColorStop(0, '#fffef8')
  center.addColorStop(1, bit.color2)
  ctx.fillStyle = center
  ctx.beginPath()
  ctx.arc(0, 0, size * 0.16, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawFlower(
  ctx: CanvasRenderingContext2D,
  bloom: Bloom,
  scale: number,
  alpha: number,
) {
  if (alpha <= 0 || scale <= 0) return
  const size = bloom.size * scale
  ctx.save()
  ctx.translate(bloom.x, bloom.y)
  ctx.rotate(bloom.rot)
  ctx.globalAlpha = alpha
  const halo = ctx.createRadialGradient(0, 0, size * 0.05, 0, 0, size * 0.85)
  halo.addColorStop(0, bloom.center)
  halo.addColorStop(0.4, bloom.inner)
  halo.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.globalAlpha = alpha * 0.45
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(0, 0, size * 0.85, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = alpha
  const rings = [
    { count: bloom.petals, reach: 0.92, width: 0.34 },
    { count: Math.max(5, bloom.petals - 3), reach: 0.62, width: 0.26 },
  ]
  rings.forEach((ring, ringIndex) => {
    for (let i = 0; i < ring.count; i++) {
      ctx.save()
      ctx.rotate((i / ring.count) * Math.PI * 2 + ringIndex * 0.4)
      const h = size * ring.reach
      const w = size * ring.width
      tracePetal(ctx, h * 0.55, w * 0.42, 'almond')
      const g = ctx.createLinearGradient(0, -h, 0, h * 0.2)
      g.addColorStop(0, bloom.color)
      g.addColorStop(1, bloom.inner)
      ctx.fillStyle = g
      ctx.fill()
      ctx.restore()
    }
  })
  const center = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.18)
  center.addColorStop(0, '#fffef8')
  center.addColorStop(0.55, bloom.center)
  center.addColorStop(1, bloom.inner)
  ctx.fillStyle = center
  ctx.beginPath()
  ctx.arc(0, 0, size * 0.16, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function fireworkSparks(x: number, y: number, look: EffectLook): Bit[] {
  const count = Math.max(8, Math.round((26 + Math.floor(Math.random() * 16)) * look.density))
  const color = pick(look.metal)
  const bits: Bit[] = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + rand(-0.08, 0.08)
    const speed = rand(70, 210)
    bits.push(
      makeBit({
        kind: 'spark',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: 0,
        vr: 0,
        size: rand(1.6, 3.2),
        life: rand(0.85, 1.45),
        max: 1.45,
        color,
        color2: '#fffef8',
        sway: 0,
        phase: rand(0, 6),
        gravity: rand(90, 160),
        drag: rand(0.55, 0.9),
      }),
    )
  }
  return bits
}

function paintBit(ctx: CanvasRenderingContext2D, bit: Bit, time: number, look: EffectLook) {
  if (bit.kind === 'rocket') {
    const glow = ctx.createRadialGradient(bit.x, bit.y, 0, bit.x, bit.y, 9)
    glow.addColorStop(0, bit.color2)
    glow.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.save()
    ctx.globalAlpha = fade(bit)
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(bit.x, bit.y, 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }
  if (look.grain === 'quiet') {
    drawBokeh(ctx, bit, 1.15, 0.42)
    return
  }
  if (look.grain === 'mist') {
    drawBokeh(ctx, bit, bit.kind === 'lantern' ? 2.8 : 2.15, 0.48)
    return
  }
  if (look.grain === 'studio' && bit.kind !== 'spark' && bit.kind !== 'star') {
    drawStreak(ctx, bit)
    return
  }
  if (look.grain === 'garden' && (bit.kind === 'heart' || bit.kind === 'confetti')) {
    drawBlossom(ctx, bit)
    return
  }
  if ((look.grain === 'foil' || look.grain === 'print') && bit.kind === 'heart') {
    drawBokeh(ctx, bit, look.grain === 'print' ? 1.55 : 1.85, 0.62)
    return
  }
  if (look.grain === 'print' && (bit.kind === 'confetti' || bit.kind === 'butterfly')) {
    drawBokeh(ctx, bit, 1.45, 0.5)
    return
  }
  if (bit.kind === 'petal') drawPetal(ctx, bit, time, look)
  else if (bit.kind === 'heart') drawHeart(ctx, bit)
  else if (bit.kind === 'star') drawStar(ctx, bit, time)
  else if (bit.kind === 'spark') drawSpark(ctx, bit)
  else if (bit.kind === 'confetti') drawConfetti(ctx, bit, time)
  else if (bit.kind === 'lantern') drawLantern(ctx, bit)
  else if (bit.kind === 'butterfly') drawButterfly(ctx, bit, time)
}

function fitCanvas(canvas: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = window.innerWidth
  const h = window.innerHeight
  canvas.width = Math.max(1, Math.floor(w * dpr))
  canvas.height = Math.max(1, Math.floor(h * dpr))
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { ctx, w, h }
}

/** Bung một lần khi mở thiệp. Hiệu ứng rơi chạy theo số giây đã chọn, hoặc suốt lúc thiệp đang mở. */
export function WeddingOpenEffects(props: {
  play: boolean
  burst: WeddingOpenBurstEffect
  fall: WeddingOpenFallEffect
  /** 0 = suốt lúc xem. */
  fallSeconds?: number
  span?: 'full' | 'preview'
  /** Màu hạt theo chủ đề thiệp. */
  themeId?: string
  /** Bộ nền có bảng màu riêng thì dùng bảng đó. */
  lookId?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const play = props.play && (props.burst !== 'none' || props.fall !== 'none')

  useEffect(() => {
    if (!play) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = ref.current
    if (!canvas) return
    const fitted = fitCanvas(canvas)
    if (!fitted) return
    let view = fitted
    const bits: Bit[] = []
    const blooms: Bloom[] = []
    const burst = props.burst
    const fall = props.fall
    const look = lookFor(props.themeId, props.lookId)
    const preview = props.span === 'preview'
    const requestedSeconds = props.fallSeconds ?? 0
    const fallKeepsGoing = fall !== 'none' && !preview && requestedSeconds <= 0
    const fallFor =
      fall === 'none' ? 0
      : preview ? Math.min(requestedSeconds > 0 ? requestedSeconds : 6, 8)
      : fallKeepsGoing ? Number.POSITIVE_INFINITY
      : requestedSeconds
    const endAt = fall === 'none' ? 4.4 : fallKeepsGoing ? Number.POSITIVE_INFINITY : fallFor + 7
    let seeded = false
    let spawnDebt = 0
    let last = performance.now()
    let raf = 0
    let nextFirework = 0.45
    const plannedBursts: Array<{ at: number; x: number; y: number }> = []

    const count = (base: number) => Math.max(1, Math.round(base * look.density))

    const push = (bit: Bit) => {
      if (bit.kind === 'petal' || bit.kind === 'heart' || bit.kind === 'butterfly' || bit.kind === 'confetti' || bit.kind === 'lantern') {
        bit.gravity *= look.weight
        bit.sway *= look.float
        bit.vx *= look.rush
        bit.vy *= look.rush
      } else if (bit.kind === 'star' || bit.kind === 'spark') {
        bit.vx *= look.rush
        bit.vy *= look.rush
        bit.gravity *= look.weight
      }
      if (bits.length < 170) bits.push(bit)
    }

    const seedBurst = () => {
      const { w, h } = view
      const cx = w / 2
      const cy = h * 0.42
      if (burst === 'bloom') {
        const flowers: Array<[number, number, number, number, number]> = [
          [cx, cy, 0, Math.min(w, h) * 0.16, 10],
          [cx - w * 0.16, cy - h * 0.04, 0.12, Math.min(w, h) * 0.09, 8],
          [cx + w * 0.15, cy + h * 0.02, 0.18, Math.min(w, h) * 0.08, 8],
          [cx - w * 0.05, cy + h * 0.12, 0.22, Math.min(w, h) * 0.07, 7],
          [cx + w * 0.08, cy - h * 0.12, 0.16, Math.min(w, h) * 0.075, 8],
          [cx - w * 0.22, cy + h * 0.08, 0.28, Math.min(w, h) * 0.055, 6],
          [cx + w * 0.22, cy - h * 0.02, 0.26, Math.min(w, h) * 0.06, 7],
        ]
        for (const [x, y, delay, size, petals] of flowers.slice(0, count(flowers.length))) {
          blooms.push({
            x,
            y,
            delay,
            size,
            rot: rand(-0.2, 0.2),
            petals,
            color: pick(look.bloom),
            inner: pick(look.bloomInner),
            center: pick(look.bloomCenter),
          })
        }
        for (let i = 0; i < count(42); i++) {
          const angle = rand(0, Math.PI * 2)
          const speed = rand(40, 220)
          const bit = petalBit(cx, cy, Math.cos(angle) * speed, Math.sin(angle) * speed - 30, rand(7, 16), look)
          bit.life = rand(2.2, 3.4)
          bit.max = 3.4
          bit.gravity = rand(40, 90)
          push(bit)
        }
        for (let i = 0; i < count(18); i++) {
          const angle = rand(0, Math.PI * 2)
          const speed = rand(30, 160)
          push(
            makeBit({
              kind: 'spark',
              x: cx,
              y: cy,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              rot: 0,
              vr: 0,
              size: rand(1.4, 2.6),
              life: rand(0.8, 1.5),
              max: 1.5,
              color: pick(look.metal),
              color2: '#fffef8',
              sway: 0,
              phase: rand(0, 6),
              gravity: 20,
              drag: 0.4,
            }),
          )
        }
      } else if (burst === 'petals') {
        for (let i = 0; i < count(70); i++) {
          const angle = rand(0, Math.PI * 2)
          const speed = rand(80, 320)
          const bit = petalBit(cx, cy, Math.cos(angle) * speed, Math.sin(angle) * speed - 40, rand(8, 18), look)
          bit.life = rand(2.2, 3.4)
          bit.max = 3.4
          bit.gravity = rand(50, 110)
          push(bit)
        }
      } else if (burst === 'hearts') {
        for (let i = 0; i < count(36); i++) {
          const angle = rand(-Math.PI * 0.85, -Math.PI * 0.15)
          const speed = rand(80, 280)
          push(
            makeBit({
              kind: 'heart',
              x: cx + rand(-20, 20),
              y: cy,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              rot: rand(-0.4, 0.4),
              vr: rand(-1.2, 1.2),
              size: rand(8, 18),
              life: rand(2.2, 3.4),
              max: 3.4,
              color: pick(look.heart),
              color2: '#fffef8',
              sway: rand(10, 24),
              phase: rand(0, 6),
              gravity: 80,
              drag: 0.35,
            }),
          )
        }
      } else if (burst === 'stars') {
        for (let i = 0; i < count(48); i++) {
          const angle = rand(0, Math.PI * 2)
          const speed = rand(40, 260)
          push(
            makeBit({
              kind: 'star',
              x: cx,
              y: cy,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              rot: rand(0, 1),
              vr: rand(-1, 1),
              size: rand(5, 14),
              life: rand(1.6, 2.8),
              max: 2.8,
              color: pick(look.metal),
              color2: '#fff',
              sway: 0,
              phase: rand(0, 6),
              gravity: 30,
              drag: 0.25,
            }),
          )
        }
      } else if (burst === 'fireworks') {
        plannedBursts.push(
          { at: 0.05, x: cx, y: cy * 0.72 },
          { at: 0.32, x: cx - w * 0.22, y: cy * 0.9 },
          { at: 0.62, x: cx + w * 0.2, y: cy * 0.8 },
        )
      } else if (burst === 'gold') {
        for (let i = 0; i < count(80); i++) {
          const angle = rand(0, Math.PI * 2)
          const speed = rand(40, 280)
          push(
            makeBit({
              kind: 'spark',
              x: cx,
              y: cy,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              rot: 0,
              vr: 0,
              size: rand(1.5, 3.4),
              life: rand(1.1, 2.2),
              max: 2.2,
              color: pick(look.metal),
              color2: '#fffef8',
              sway: 0,
              phase: rand(0, 6),
              gravity: 40,
              drag: 0.2,
            }),
          )
        }
      } else if (burst === 'butterflies') {
        for (let i = 0; i < count(12); i++) {
          const angle = rand(-Math.PI, 0)
          const speed = rand(50, 160)
          push(
            makeBit({
              kind: 'butterfly',
              x: cx,
              y: cy,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed * 0.65,
              rot: rand(-0.4, 0.4),
              vr: rand(-0.4, 0.4),
              size: rand(12, 22),
              life: rand(2.6, 3.6),
              max: 3.6,
              color: pick(look.wing),
              color2: pick(look.wingSoft),
              sway: rand(18, 40),
              phase: rand(0, 6),
              gravity: -8,
              drag: 0.45,
            }),
          )
        }
      }
    }

    const spawnFall = () => {
      const { w } = view
      const x = rand(-20, w + 20)
      const y = rand(-60, -12)
      if (fall === 'petals') push(petalBit(x, y, rand(-18, 18), rand(28, 70), rand(8, 18), look))
      else if (fall === 'hearts') {
        push(
          makeBit({
            kind: 'heart',
            x,
            y,
            vx: rand(-16, 16),
            vy: rand(36, 80),
            rot: rand(-0.5, 0.5),
            vr: rand(-0.8, 0.8),
            size: rand(9, 18),
            life: rand(6, 9),
            max: 9,
            color: pick(look.heart),
            color2: '#fffef8',
            sway: rand(16, 34),
            phase: rand(0, 6),
            gravity: 6,
            drag: 0.05,
          }),
        )
      } else if (fall === 'stars') {
        push(
          makeBit({
            kind: 'star',
            x,
            y,
            vx: rand(-12, 12),
            vy: rand(24, 60),
            rot: rand(0, 1),
            vr: rand(-0.6, 0.6),
            size: rand(5, 13),
            life: rand(6, 9),
            max: 9,
            color: pick(look.metal),
            color2: '#fff',
            sway: rand(8, 20),
            phase: rand(0, 6),
            gravity: 2,
            drag: 0.02,
          }),
        )
      } else if (fall === 'gold') {
        push(
          makeBit({
            kind: 'spark',
            x,
            y,
            vx: rand(-10, 10),
            vy: rand(30, 80),
            rot: 0,
            vr: 0,
            size: rand(1.4, 3),
            life: rand(4.5, 7),
            max: 7,
            color: pick(look.metal),
            color2: '#fffef8',
            sway: rand(8, 18),
            phase: rand(0, 6),
            gravity: 4,
            drag: 0.02,
          }),
        )
      } else if (fall === 'snow') {
        push(
          makeBit({
            kind: 'spark',
            x,
            y,
            vx: rand(-8, 8),
            vy: rand(16, 42),
            rot: 0,
            vr: 0,
            size: rand(1.3, 3.2),
            life: rand(7, 11),
            max: 11,
            color: pick(['#ffffff', '#f4f7ff', '#e8eefc']),
            color2: '#ffffff',
            sway: rand(10, 28),
            phase: rand(0, 6),
            gravity: 1,
            drag: 0,
          }),
        )
      } else if (fall === 'confetti') {
        push(
          makeBit({
            kind: 'confetti',
            x,
            y,
            vx: rand(-20, 20),
            vy: rand(50, 110),
            rot: rand(0, Math.PI),
            vr: rand(-3, 3),
            size: rand(6, 11),
            life: rand(5, 8),
            max: 8,
            color: pick(look.paper),
            color2: '#fff',
            sway: rand(12, 28),
            phase: rand(0, 6),
            gravity: 12,
            drag: 0.04,
          }),
        )
      } else if (fall === 'lanterns') {
        push(
          makeBit({
            kind: 'lantern',
            x: rand(w * 0.08, w * 0.92),
            y,
            vx: rand(-8, 8),
            vy: rand(22, 42),
            rot: rand(-0.15, 0.15),
            vr: rand(-0.15, 0.15),
            size: rand(22, 36),
            life: rand(9, 13),
            max: 13,
            color: pick(look.lantern),
            color2: look.lanternGlow,
            sway: rand(14, 26),
            phase: rand(0, 6),
            gravity: 0,
            drag: 0.02,
          }),
        )
      }
    }

    const launchRocket = () => {
      const { w, h } = view
      push(
        makeBit({
          kind: 'rocket',
          x: rand(w * 0.18, w * 0.82),
          y: h + 8,
          vx: rand(-24, 24),
          vy: -rand(h * 0.55, h * 0.9),
          rot: 0,
          vr: 0,
          size: 2,
          life: rand(0.55, 0.85),
          max: 0.85,
          color: pick(look.metal),
          color2: '#fffef8',
          sway: 0,
          phase: 0,
          gravity: 30,
          drag: 0.05,
        }),
      )
    }

    const rate =
      (fall === 'petals' ? 16
      : fall === 'hearts' ? 8
      : fall === 'stars' ? 11
      : fall === 'gold' ? 22
      : fall === 'snow' ? 26
      : fall === 'confetti' ? 12
      : fall === 'lanterns' ? 1.3
      : 0) * look.density

    const onResize = () => {
      const next = fitCanvas(canvas)
      if (next) view = next
    }
    window.addEventListener('resize', onResize)

    const tick = (now: number) => {
      const dt = Math.min(0.034, (now - last) / 1000)
      last = now
      const t = (now - start) / 1000
      if (!seeded) {
        seeded = true
        seedBurst()
      }
      if (t < fallFor && rate > 0) {
        spawnDebt += dt * rate
        while (spawnDebt >= 1) {
          spawnDebt -= 1
          spawnFall()
        }
      }
      if (fall === 'fireworks' && t < fallFor && t >= nextFirework) {
        launchRocket()
        nextFirework = t + rand(1.5, 2.4)
      }
      while (plannedBursts.length > 0 && t >= plannedBursts[0]!.at) {
        const shot = plannedBursts.shift()!
        for (const spark of fireworkSparks(shot.x, shot.y, look)) push(spark)
      }
      const born: Bit[] = []
      for (const bit of bits) {
        bit.life -= dt
        bit.x += (bit.vx + Math.sin(t * 1.6 + bit.phase) * bit.sway) * dt
        bit.y += bit.vy * dt
        bit.vy += bit.gravity * dt
        bit.vx *= 1 - bit.drag * dt
        bit.rot += bit.vr * dt
        if (bit.y > view.h + 90) bit.life = 0
        if (bit.kind === 'rocket' && bit.life <= 0) born.push(...fireworkSparks(bit.x, bit.y, look))
      }
      for (let i = bits.length - 1; i >= 0; i--) {
        if (bits[i]!.life <= 0) bits.splice(i, 1)
      }
      for (const bit of born) push(bit)

      const ctx = view.ctx
      ctx.clearRect(0, 0, view.w, view.h)
      if (burst === 'bloom' || burst === 'petals' || burst === 'gold') {
        const flash = t < 0.12 ? t / 0.12 : t < 1.05 ? 1 - (t - 0.12) / 0.93 : 0
        if (flash > 0) {
          const g = ctx.createRadialGradient(view.w / 2, view.h * 0.42, 0, view.w / 2, view.h * 0.42, Math.max(view.w, view.h) * 0.42)
          g.addColorStop(0, `rgba(${look.flash[0]}, ${0.42 * flash})`)
          g.addColorStop(0.5, `rgba(${look.flash[1]}, ${0.16 * flash})`)
          g.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.fillStyle = g
          ctx.fillRect(0, 0, view.w, view.h)
        }
      }
      for (const bloom of blooms) {
        const local = t - bloom.delay
        if (local < 0 || local > 2.8) continue
        const grow = Math.min(1, local / 0.85)
        const scale = easeOutCubic(grow)
        const alpha = local < 1.65 ? 1 : Math.max(0, 1 - (local - 1.65) / 1.15)
        drawFlower(ctx, bloom, scale, alpha)
      }
      for (const bit of bits) paintBit(ctx, bit, t, look)
      if (!fallKeepsGoing) {
        const fadeOut = endAt - 1.3
        canvas.style.opacity = t > fadeOut ? String(Math.max(0, 1 - (t - fadeOut) / 1.3)) : '1'
      }
      if (t < endAt) raf = window.requestAnimationFrame(tick)
      else ctx.clearRect(0, 0, view.w, view.h)
    }

    const onVisibility = () => {
      window.cancelAnimationFrame(raf)
      if (document.hidden) return
      last = performance.now()
      raf = window.requestAnimationFrame(tick)
    }
    const start = performance.now()
    raf = window.requestAnimationFrame(tick)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [play, props.burst, props.fall, props.fallSeconds, props.span, props.themeId, props.lookId])

  if (!play) return null
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[45]" />
}
