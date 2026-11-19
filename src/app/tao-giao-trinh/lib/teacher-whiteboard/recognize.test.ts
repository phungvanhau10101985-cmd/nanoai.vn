import assert from 'node:assert/strict'
import test from 'node:test'
import { joinThreeStrokeArrow, joinThreeStrokeTriangle, recognizeStroke } from './recognize'
import type { WhiteboardObject } from './types'

function circlePts(cx: number, cy: number, r: number, n = 48, wobble = 0): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  for (let i = 0; i <= n; i += 1) {
    const t = (i / n) * Math.PI * 2
    const jitter = wobble * Math.sin(i * 1.7)
    out.push({ x: cx + (r + jitter) * Math.cos(t), y: cy + (r + jitter) * Math.sin(t) })
  }
  return out
}

function linePts(x0: number, y0: number, x1: number, y1: number, n = 24): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  for (let i = 0; i <= n; i += 1) {
    const t = i / n
    out.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t + Math.sin(i) * 0.4 })
  }
  return out
}

function rectPts(x: number, y: number, w: number, h: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  const ring = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
    [x, y],
  ]
  for (let s = 0; s < 4; s += 1) {
    const a = ring[s]
    const b = ring[s + 1]
    for (let i = 0; i < 12; i += 1) {
      const t = i / 12
      out.push({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t })
    }
  }
  out.push({ x, y })
  return out
}

test('vòng tay méo nhận hình tròn', () => {
  const got = recognizeStroke(circlePts(40, 20, 80, 56, 4))
  assert.equal(got?.shape, 'circle')
  assert.ok(got && got.r && Math.abs((got.r ?? 0) - 80) < 12)
})

test('nét thẳng nhận đoạn thẳng', () => {
  const got = recognizeStroke(linePts(0, 0, 220, 8))
  assert.equal(got?.shape, 'line')
  assert.equal(got?.points.length, 2)
})

function ringPts(pts: { x: number; y: number }[], n = 14): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  for (let s = 0; s < pts.length; s += 1) {
    const a = pts[s]
    const b = pts[(s + 1) % pts.length]
    for (let i = 0; i < n; i += 1) {
      const t = i / n
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    }
  }
  out.push(pts[0])
  return out
}

function sideLens(pts: { x: number; y: number }[]): number[] {
  return pts.map((p, i) => Math.hypot(pts[(i + 1) % pts.length].x - p.x, pts[(i + 1) % pts.length].y - p.y))
}

test('hình vuông không bị nhận thành hình tròn', () => {
  const got = recognizeStroke(ringPts([{ x: 40, y: 40 }, { x: 160, y: 40 }, { x: 160, y: 160 }, { x: 40, y: 160 }]))
  assert.equal(got?.shape, 'polygon')
  assert.equal(got?.points.length, 4)
  const lens = sideLens(got?.points ?? [])
  assert.ok(Math.max(...lens) - Math.min(...lens) < 1)
})

test('hình thoi, bình hành, ngũ giác và lục giác', () => {
  const rhombus = recognizeStroke(ringPts([{ x: 40, y: 80 }, { x: 140, y: 40 }, { x: 240, y: 80 }, { x: 140, y: 120 }]))
  assert.equal(rhombus?.shape, 'polygon')
  assert.equal(rhombus?.points.length, 4)
  const rhombusSides = sideLens(rhombus?.points ?? [])
  assert.ok(Math.max(...rhombusSides) - Math.min(...rhombusSides) < 2)
  const para = recognizeStroke(ringPts([{ x: 40, y: 40 }, { x: 180, y: 50 }, { x: 210, y: 140 }, { x: 70, y: 130 }]))
  assert.equal(para?.shape, 'polygon')
  assert.equal(para?.points.length, 4)
  const pent = Array.from({ length: 5 }, (_, i) => {
    const t = -Math.PI / 2 + (i * 2 * Math.PI) / 5
    return { x: 120 + 70 * Math.cos(t), y: 120 + 70 * Math.sin(t) }
  })
  const hex = Array.from({ length: 6 }, (_, i) => {
    const t = (i * Math.PI) / 3
    return { x: 120 + 70 * Math.cos(t), y: 120 + 70 * Math.sin(t) }
  })
  assert.equal(recognizeStroke(ringPts(pent))?.points.length, 5)
  assert.equal(recognizeStroke(ringPts(hex))?.points.length, 6)
})

test('hình chữ nhật khép nhận rect', () => {
  const got = recognizeStroke(rectPts(10, 10, 160, 90))
  assert.equal(got?.shape, 'rect')
})

function lineObj(id: string, x0: number, y0: number, x1: number, y1: number): WhiteboardObject {
  return { kind: 'shape', id, shape: 'line', color: '#111827', size: 5, points: [{ x: x0, y: y0 }, { x: x1, y: y1 }] }
}

test('ba nét gần đỉnh chụm thành mũi tên', () => {
  const shaft = lineObj('shaft', 0, 0, 200, 0)
  const up = lineObj('up', 208, 6, 176, 28)
  const down = lineObj('down', 194, -8, 170, -30)
  const got = joinThreeStrokeArrow([shaft, up], down)
  assert.ok(got)
  assert.equal(got?.arrow.shape, 'arrow')
  assert.equal(got?.arrow.id, 'down')
  assert.deepEqual(got?.removeIds.slice().sort(), ['shaft', 'up'])
  const [tail, tip, wingA, wingB] = got?.arrow.points ?? []
  assert.equal(tail.x, 0)
  assert.equal(tail.y, 0)
  assert.ok(Math.hypot(tip.x - 200, tip.y) < 20)
  assert.ok(Math.hypot(wingA.x - 176, wingA.y - 28) < 1 || Math.hypot(wingA.x - 170, wingA.y + 30) < 1)
  assert.ok(Math.hypot(wingB.x - 176, wingB.y - 28) < 1 || Math.hypot(wingB.x - 170, wingB.y + 30) < 1)
  const missed = joinThreeStrokeArrow([shaft, lineObj('up', 320, 40, 300, 70)], lineObj('down', 330, -20, 300, -60))
  assert.equal(missed, null)
  const sameSide = joinThreeStrokeArrow([shaft, up], lineObj('up2', 206, 4, 174, 22))
  assert.equal(sameSide, null)
})

test('ba cạnh hở góc nhận tam giác', () => {
  const ab = lineObj('ab', 4, 6, 154, 14)
  const bc = lineObj('bc', 158, 18, 76, 114)
  const ca = lineObj('ca', 64, 116, 8, 8)
  const got = joinThreeStrokeTriangle([ab, bc], ca)
  assert.ok(got)
  assert.deepEqual(got?.removeIds.slice().sort(), ['ab', 'bc'])
  assert.equal(got?.corners.length, 3)
  const [p, q, r] = got?.corners ?? []
  const area = Math.abs((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x))
  assert.ok(area > 400)
  assert.equal(joinThreeStrokeArrow([ab, bc], ca), null)
  const open = joinThreeStrokeTriangle(
    [lineObj('a', 0, 0, 80, 0), lineObj('b', 200, 0, 280, 0)],
    lineObj('c', 400, 0, 480, 0),
  )
  assert.equal(open, null)
})

function inkSide(id: string, x0: number, y0: number, x1: number, y1: number, amp: number): WhiteboardObject {
  const points: { x: number; y: number }[] = []
  const dx = x1 - x0
  const dy = y1 - y0
  const chord = Math.hypot(dx, dy) || 1
  for (let i = 0; i <= 28; i += 1) {
    const t = i / 28
    const wobble = Math.sin(t * Math.PI * 5) * amp
    points.push({
      x: x0 + dx * t + (-dy / chord) * wobble,
      y: y0 + dy * t + (dx / chord) * wobble,
    })
  }
  return { kind: 'stroke', id, tool: 'pen', color: '#111827', size: 5, points }
}

test('ba nét gợn hở góc vẫn nhận tam giác', () => {
  const base = inkSide('base', 30, 180, 430, 188, 3)
  const left = inkSide('left', 38, 172, 188, 36, 16)
  const right = inkSide('right', 198, 42, 422, 176, 11)
  const got = joinThreeStrokeTriangle([base, left], right)
  assert.ok(got)
  assert.deepEqual(got?.removeIds.slice().sort(), ['base', 'left'])
  const scribble = inkSide('scribble', 30, 180, 80, 188, 70)
  assert.equal(joinThreeStrokeTriangle([scribble, left], right), null)
})

test('đỉnh hở rộng vẫn nhận tam giác', () => {
  const base = lineObj('base', 0, 400, 760, 408)
  const left = lineObj('left', 8, 392, 280, 40)
  const right = lineObj('right', 460, 36, 752, 396)
  const got = joinThreeStrokeTriangle([base, left], right)
  assert.ok(got)
  assert.deepEqual(got?.removeIds.slice().sort(), ['base', 'left'])
  const tooOpen = joinThreeStrokeTriangle(
    [base, lineObj('left2', 8, 392, 180, 40)],
    lineObj('right2', 560, 36, 752, 396),
  )
  assert.equal(tooOpen, null)
})

test('nét quá ngắn không nhận', () => {
  assert.equal(recognizeStroke([{ x: 0, y: 0 }, { x: 2, y: 1 }, { x: 4, y: 0 }]), null)
})

test('nét bậc thang / nguệch ngoạc không thành đa giác', () => {
  const stairs: { x: number; y: number }[] = []
  for (let i = 0; i < 10; i += 1) {
    stairs.push({ x: i * 24, y: (i % 2) * 36 })
    stairs.push({ x: i * 24 + 24, y: (i % 2) * 36 })
  }
  const got = recognizeStroke(stairs)
  assert.ok(!got || got.shape === 'line' || got.shape === 'arrow')
  assert.notEqual(got?.shape, 'polygon')
  const blob: { x: number; y: number }[] = []
  for (let i = 0; i <= 48; i += 1) {
    const t = (i / 48) * Math.PI * 2
    const r = 55 + 22 * Math.sin(3 * t)
    blob.push({ x: 90 + r * Math.cos(t), y: 80 + r * Math.sin(t) })
  }
  const blobGot = recognizeStroke(blob)
  assert.notEqual(blobGot?.shape, 'polygon')
  assert.notEqual(blobGot?.shape, 'triangle')
  assert.notEqual(blobGot?.shape, 'rect')
})
