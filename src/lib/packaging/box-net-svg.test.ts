import assert from 'node:assert/strict'
import test from 'node:test'

import {
  generateTuckEndBlankSvg,
  getCrossFoldLayoutData,
} from '@/lib/packaging/box-net-svg'

test('generateTuckEndBlankSvg renders readable face labels with dimensions', () => {
  const svg = generateTuckEndBlankSvg(
    { lengthMm: 200, widthMm: 150, heightMm: 100 },
    undefined,
    'vi'
  )
  assert.match(svg, /^<svg/)
  assert.match(svg, /Mặt trên/)
  assert.match(svg, /Mặt trước/)
  assert.match(svg, /L×W/)
  assert.match(svg, /L×H/)
  assert.match(svg, /font-weight="700"/)
  assert.match(svg, /stroke="#64748b"/)
  assert.match(svg, /20,0 cm/)
  assert.match(svg, /15,0 cm/)
  assert.match(svg, /10,0 cm/)
  const fontSizes = [...svg.matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]))
  assert.ok(fontSizes.length >= 12)
  assert.ok(Math.max(...fontSizes) >= 16, `max font ${Math.max(...fontSizes)} should be readable`)
  assert.ok(Math.max(...fontSizes) <= 28, `max font ${Math.max(...fontSizes)} should stay compact`)
})

test('generateTuckEndBlankSvg renders large box with explicit width', () => {
  const svg = generateTuckEndBlankSvg(
    { lengthMm: 500, widthMm: 300, heightMm: 100 },
    { bleedMm: 3, glueTabMm: 25, paperThicknessMm: 0.4, compensationGapMm: 0.5 },
    'vi'
  )
  assert.match(svg, /width="100%"/)
  assert.match(svg, /Mặt trước/)
  assert.match(svg, /50,0 cm/)
  assert.match(svg, /30,0 cm/)
  assert.ok(svg.length > 2000)
})

test('cross-fold layout arranges top, front, bottom and back vertically with glue tabs', () => {
  const dimensions = { lengthMm: 500, widthMm: 300, heightMm: 100 }
  const layout = getCrossFoldLayoutData(dimensions, {
    bleedMm: 3,
    glueTabMm: 25,
    paperThicknessMm: 0.4,
    compensationGapMm: 0.5,
  })
  const bySlot = Object.fromEntries(layout.panels.map((panel) => [panel.slot, panel]))
  assert.equal(bySlot.top.x, bySlot.front.x)
  assert.equal(bySlot.front.x, bySlot.bottom.x)
  assert.equal(bySlot.bottom.x, bySlot.back.x)
  assert.equal(bySlot.top.y + bySlot.top.h, bySlot.front.y)
  assert.equal(bySlot.front.y + bySlot.front.h, bySlot.bottom.y)
  assert.equal(bySlot.bottom.y + bySlot.bottom.h, bySlot.back.y)
  assert.equal(bySlot.left.x + bySlot.left.w, bySlot.front.x)
  assert.equal(bySlot.front.x + bySlot.front.w, bySlot.right.x)
  assert.ok(layout.foldSegments.length >= 12)
  assert.ok(layout.cutSegments.length >= 20)

  const svg = generateTuckEndBlankSvg(dimensions, undefined, 'vi', 'cross_fold')
  assert.match(svg, /Mặt trên/)
  assert.match(svg, /Mặt dưới/)
  assert.match(svg, /Mặt sau/)
})
