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

const ROSE = ['#fff7f4', '#f8d0da', '#e9899d', '#d46a82', '#f3c1ad']
const GOLD = ['#fff8df', '#f6d48a', '#e8c56b', '#fffef6']
const HEARTS = ['#ffe4ec', '#fb7185', '#f43f5e', '#fda4af', '#be123c']
const PAPER = ['#fff6ea', '#f8d0da', '#f6d48a', '#d9e4d5', '#dbe7f5']

function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]!
}

function easeOutBack(t: number) {
  const c1 = 1.4
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

function fade(bit: Bit) {
  const age = bit.max - bit.life
  const inn = Math.min(1, age / 0.28)
  return Math.max(0, Math.min(1, bit.life / bit.max)) * inn
}

function makeBit(partial: Bit): Bit {
  return partial
}

function petalBit(x: number, y: number, vx: number, vy: number, size: number): Bit {
  return makeBit({
    kind: 'petal',
    x,
    y,
    vx,
    vy,
    rot: rand(0, Math.PI * 2),
    vr: rand(-2.4, 2.4),
    size,
    life: rand(5.5, 8.5),
    max: 8.5,
    color: pick(ROSE),
    color2: pick(['#fffaf6', '#f4b8c6', '#e8a0b0']),
    sway: rand(12, 36),
    phase: rand(0, Math.PI * 2),
    gravity: rand(8, 22),
    drag: rand(0.15, 0.45),
  })
}

function drawPetal(ctx: CanvasRenderingContext2D, bit: Bit, time: number) {
  const flutter = 0.35 + 0.65 * Math.abs(Math.sin(time * 3.2 + bit.phase))
  const h = bit.size
  const w = bit.size * 0.42 * flutter
  ctx.save()
  ctx.translate(bit.x, bit.y)
  ctx.rotate(bit.rot)
  ctx.globalAlpha = fade(bit)
  ctx.beginPath()
  ctx.moveTo(0, -h)
  ctx.bezierCurveTo(w, -h * 0.15, w * 0.85, h * 0.55, 0, h)
  ctx.bezierCurveTo(-w * 0.85, h * 0.55, -w, -h * 0.15, 0, -h)
  const g = ctx.createLinearGradient(0, -h, 0, h)
  g.addColorStop(0, bit.color)
  g.addColorStop(1, bit.color2)
  ctx.fillStyle = g
  ctx.fill()
  ctx.restore()
}

function drawHeart(ctx: CanvasRenderingContext2D, bit: Bit) {
  const s = bit.size
  ctx.save()
  ctx.translate(bit.x, bit.y)
  ctx.rotate(bit.rot)
  ctx.globalAlpha = fade(bit)
  ctx.beginPath()
  ctx.moveTo(0, s * 0.35)
  ctx.bezierCurveTo(-s * 1.05, -s * 0.45, -s * 0.35, -s * 1.05, 0, -s * 0.38)
  ctx.bezierCurveTo(s * 0.35, -s * 1.05, s * 1.05, -s * 0.45, 0, s * 0.35)
  ctx.fillStyle = bit.color
  ctx.fill()
  ctx.restore()
}

function drawStar(ctx: CanvasRenderingContext2D, bit: Bit, time: number) {
  const twinkle = 0.55 + 0.45 * Math.abs(Math.sin(time * 5 + bit.phase))
  const spikes = 4
  ctx.save()
  ctx.translate(bit.x, bit.y)
  ctx.rotate(bit.rot)
  ctx.globalAlpha = fade(bit) * twinkle
  ctx.beginPath()
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? bit.size : bit.size * 0.38
    const angle = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fillStyle = bit.color
  ctx.fill()
  ctx.restore()
}

function drawSpark(ctx: CanvasRenderingContext2D, bit: Bit) {
  const a = fade(bit)
  ctx.save()
  ctx.globalAlpha = a * 0.45
  ctx.strokeStyle = bit.color
  ctx.lineWidth = Math.max(1, bit.size * 0.7)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(bit.x, bit.y)
  ctx.lineTo(bit.x - bit.vx * 0.045, bit.y - bit.vy * 0.045)
  ctx.stroke()
  ctx.globalAlpha = a
  ctx.fillStyle = bit.color2
  ctx.beginPath()
  ctx.arc(bit.x, bit.y, Math.max(1.1, bit.size * 0.55), 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawConfetti(ctx: CanvasRenderingContext2D, bit: Bit, time: number) {
  const flip = Math.cos(time * 6 + bit.phase)
  ctx.save()
  ctx.translate(bit.x, bit.y)
  ctx.rotate(bit.rot)
  ctx.scale(flip, 1)
  ctx.globalAlpha = fade(bit)
  ctx.fillStyle = bit.color
  ctx.fillRect(-bit.size * 0.35, -bit.size * 0.7, bit.size * 0.7, bit.size * 1.4)
  ctx.restore()
}

function drawLantern(ctx: CanvasRenderingContext2D, bit: Bit) {
  const w = bit.size * 0.72
  const h = bit.size
  ctx.save()
  ctx.translate(bit.x, bit.y)
  ctx.rotate(bit.rot * 0.15)
  ctx.globalAlpha = fade(bit)
  ctx.fillStyle = '#7c2d22'
  ctx.fillRect(-w * 0.28, -h * 0.62, w * 0.56, h * 0.12)
  ctx.beginPath()
  ctx.moveTo(-w * 0.5, -h * 0.28)
  ctx.quadraticCurveTo(-w * 0.62, h * 0.15, -w * 0.28, h * 0.48)
  ctx.lineTo(w * 0.28, h * 0.48)
  ctx.quadraticCurveTo(w * 0.62, h * 0.15, w * 0.5, -h * 0.28)
  ctx.closePath()
  ctx.fillStyle = bit.color
  ctx.fill()
  ctx.globalAlpha = fade(bit) * 0.85
  ctx.fillStyle = bit.color2
  ctx.beginPath()
  ctx.ellipse(0, h * 0.02, w * 0.22, h * 0.28, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawButterfly(ctx: CanvasRenderingContext2D, bit: Bit, time: number) {
  const flap = 0.22 + 0.78 * Math.abs(Math.sin(time * 11 + bit.phase))
  ctx.save()
  ctx.translate(bit.x, bit.y)
  ctx.rotate(bit.rot)
  ctx.globalAlpha = fade(bit)
  ctx.fillStyle = bit.color
  ctx.beginPath()
  ctx.ellipse(-bit.size * 0.5, -bit.size * 0.12, bit.size * 0.52 * flap, bit.size * 0.36, -0.45, 0, Math.PI * 2)
  ctx.ellipse(-bit.size * 0.36, bit.size * 0.28, bit.size * 0.34 * flap, bit.size * 0.26, 0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = bit.color2
  ctx.beginPath()
  ctx.ellipse(bit.size * 0.5, -bit.size * 0.12, bit.size * 0.52 * flap, bit.size * 0.36, 0.45, 0, Math.PI * 2)
  ctx.ellipse(bit.size * 0.36, bit.size * 0.28, bit.size * 0.34 * flap, bit.size * 0.26, -0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#5c3a2e'
  ctx.fillRect(-bit.size * 0.05, -bit.size * 0.5, bit.size * 0.1, bit.size)
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
  const rings = [
    { count: bloom.petals, radius: 0.46, width: 0.24, length: 0.5 },
    { count: Math.max(5, bloom.petals - 2), radius: 0.28, width: 0.18, length: 0.34 },
  ]
  rings.forEach((ring, ringIndex) => {
    for (let i = 0; i < ring.count; i++) {
      ctx.save()
      ctx.rotate((i / ring.count) * Math.PI * 2 + ringIndex * 0.35)
      ctx.beginPath()
      ctx.ellipse(0, -size * ring.radius, size * ring.width, size * ring.length, 0, 0, Math.PI * 2)
      const g = ctx.createLinearGradient(0, -size, 0, 0)
      g.addColorStop(0, bloom.color)
      g.addColorStop(1, bloom.inner)
      ctx.fillStyle = g
      ctx.fill()
      ctx.restore()
    }
  })
  ctx.beginPath()
  ctx.arc(0, 0, size * 0.14, 0, Math.PI * 2)
  ctx.fillStyle = bloom.center
  ctx.shadowColor = bloom.center
  ctx.shadowBlur = 16
  ctx.fill()
  ctx.restore()
}

function fireworkSparks(x: number, y: number): Bit[] {
  const count = 26 + Math.floor(Math.random() * 16)
  const color = pick(['#fff6d0', '#f6d48a', '#fb7185', '#fff', '#f9a8d4', '#fde68a'])
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

    const push = (bit: Bit) => {
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
        for (const [x, y, delay, size, petals] of flowers) {
          blooms.push({
            x,
            y,
            delay,
            size,
            rot: rand(-0.2, 0.2),
            petals,
            color: pick(['#fff4f6', '#f7c5d2', '#f3d5c4']),
            inner: pick(['#e9899d', '#d46a82', '#f0b8a4']),
            center: pick(GOLD),
          })
        }
        for (let i = 0; i < 42; i++) {
          const angle = rand(0, Math.PI * 2)
          const speed = rand(40, 220)
          const bit = petalBit(cx, cy, Math.cos(angle) * speed, Math.sin(angle) * speed - 30, rand(7, 16))
          bit.life = rand(2.2, 3.4)
          bit.max = 3.4
          bit.gravity = rand(40, 90)
          push(bit)
        }
        for (let i = 0; i < 18; i++) {
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
              color: pick(GOLD),
              color2: '#fffef8',
              sway: 0,
              phase: rand(0, 6),
              gravity: 20,
              drag: 0.4,
            }),
          )
        }
      } else if (burst === 'petals') {
        for (let i = 0; i < 70; i++) {
          const angle = rand(0, Math.PI * 2)
          const speed = rand(80, 320)
          const bit = petalBit(cx, cy, Math.cos(angle) * speed, Math.sin(angle) * speed - 40, rand(8, 18))
          bit.life = rand(2.2, 3.4)
          bit.max = 3.4
          bit.gravity = rand(50, 110)
          push(bit)
        }
      } else if (burst === 'hearts') {
        for (let i = 0; i < 36; i++) {
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
              color: pick(HEARTS),
              color2: '#fff',
              sway: rand(10, 24),
              phase: rand(0, 6),
              gravity: 80,
              drag: 0.35,
            }),
          )
        }
      } else if (burst === 'stars') {
        for (let i = 0; i < 48; i++) {
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
              color: pick([...GOLD, '#fff']),
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
        for (let i = 0; i < 80; i++) {
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
              color: pick(GOLD),
              color2: '#fffef8',
              sway: 0,
              phase: rand(0, 6),
              gravity: 40,
              drag: 0.2,
            }),
          )
        }
      } else if (burst === 'butterflies') {
        for (let i = 0; i < 12; i++) {
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
              color: pick(['#f8d0da', '#f6d48a', '#fff4ea', '#e7d4f5']),
              color2: pick(['#fff', '#fde68a', '#fbcfe8']),
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
      const { w, h } = view
      const x = rand(-20, w + 20)
      const y = rand(-60, -12)
      if (fall === 'petals') push(petalBit(x, y, rand(-18, 18), rand(28, 70), rand(8, 18)))
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
            color: pick(HEARTS),
            color2: '#fff',
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
            color: pick([...GOLD, '#ffffff']),
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
            color: pick(GOLD),
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
            color: pick(PAPER),
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
            color: pick(['#e25b4a', '#d4a24c', '#c2413a']),
            color2: '#fff1c9',
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
          color: pick(GOLD),
          color2: '#fff',
          sway: 0,
          phase: 0,
          gravity: 30,
          drag: 0.05,
        }),
      )
    }

    const rate =
      fall === 'petals' ? 16
      : fall === 'hearts' ? 8
      : fall === 'stars' ? 11
      : fall === 'gold' ? 22
      : fall === 'snow' ? 26
      : fall === 'confetti' ? 12
      : fall === 'lanterns' ? 1.3
      : 0

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
        for (const spark of fireworkSparks(shot.x, shot.y)) push(spark)
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
        if (bit.kind === 'rocket' && bit.life <= 0) born.push(...fireworkSparks(bit.x, bit.y))
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
          g.addColorStop(0, `rgba(255, 248, 242, ${0.5 * flash})`)
          g.addColorStop(0.5, `rgba(248, 196, 208, ${0.18 * flash})`)
          g.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.fillStyle = g
          ctx.fillRect(0, 0, view.w, view.h)
        }
      }
      for (const bloom of blooms) {
        const local = t - bloom.delay
        if (local < 0 || local > 2.8) continue
        const grow = Math.min(1, local / 0.85)
        const scale = Math.min(1.12, easeOutBack(grow))
        const alpha = local < 1.65 ? 1 : Math.max(0, 1 - (local - 1.65) / 1.15)
        drawFlower(ctx, bloom, scale, alpha)
      }
      for (const bit of bits) {
        if (bit.kind === 'rocket') {
          ctx.save()
          ctx.globalAlpha = fade(bit)
          ctx.fillStyle = bit.color
          ctx.beginPath()
          ctx.arc(bit.x, bit.y, 2.2, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        } else if (bit.kind === 'petal') drawPetal(ctx, bit, t)
        else if (bit.kind === 'heart') drawHeart(ctx, bit)
        else if (bit.kind === 'star') drawStar(ctx, bit, t)
        else if (bit.kind === 'spark') drawSpark(ctx, bit)
        else if (bit.kind === 'confetti') drawConfetti(ctx, bit, t)
        else if (bit.kind === 'lantern') drawLantern(ctx, bit)
        else if (bit.kind === 'butterfly') drawButterfly(ctx, bit, t)
      }
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
  }, [play, props.burst, props.fall, props.fallSeconds, props.span])

  if (!play) return null
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[45]" />
}
