import assert from 'node:assert/strict'
import test from 'node:test'
import { recognizeStroke } from './recognize'

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

test('hình chữ nhật khép nhận rect', () => {
  const got = recognizeStroke(rectPts(10, 10, 160, 90))
  assert.equal(got?.shape, 'rect')
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
