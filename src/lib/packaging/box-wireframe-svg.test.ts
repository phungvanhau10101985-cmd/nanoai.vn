import assert from 'node:assert/strict'
import test from 'node:test'

import { buildBoxWireframeSvg } from '@/lib/packaging/box-wireframe-svg'
import { buildBoxFaceConfirmStudioPayload, packagingBoxConfirmStudioExtras } from '@/lib/packaging/face-aspect'

test('buildBoxWireframeSvg returns svg with dimensions and face labels', () => {
  const svg = buildBoxWireframeSvg({ length: 500, width: 300, height: 200 }, 'vi')
  assert.match(svg, /^<svg/)
  assert.match(svg, /L×H/)
  assert.match(svg, /L×W/)
  assert.match(svg, /W×H/)
  assert.match(svg, /50,0 cm/)
  assert.match(svg, /30,0 cm/)
  assert.match(svg, /20,0 cm/)
})

test('packagingBoxConfirmStudioExtras only on box_face_confirm with dimensions', () => {
  const dims = { length: 500, width: 300, height: 200 }
  const extras = packagingBoxConfirmStudioExtras('en', {
    presetId: 'packaging_kit',
    currentStepKey: 'box_face_confirm',
    processSteps: [],
    packaging: { dimensionsMm: dims, facesConfirmed: false },
  })
  assert.deepEqual(extras, { processSteps: [] })

  const hidden = packagingBoxConfirmStudioExtras('en', {
    presetId: 'packaging_kit',
    currentStepKey: 'box_face_confirm',
    packaging: { dimensionsMm: dims, facesConfirmed: true },
  })
  assert.equal(hidden, null)
})

test('buildBoxWireframeSvg spans viewBox (not tiny)', () => {
  const svg = buildBoxWireframeSvg({ length: 500, width: 300, height: 400 }, 'vi')
  const allPoints = [...svg.matchAll(/points="([^"]+)"/g)].map((m) => m[1]!)
  assert.ok(allPoints.length >= 3)
  const nums = allPoints.flatMap((block) => block.split(/[\s,]+/).map(Number)).filter((n) => Number.isFinite(n))
  const xs = nums.filter((_, i) => i % 2 === 0)
  const ys = nums.filter((_, i) => i % 2 === 1)
  assert.ok(Math.max(...xs) - Math.min(...xs) > 140, `x span ${Math.max(...xs) - Math.min(...xs)}`)
  assert.ok(Math.max(...ys) - Math.min(...ys) > 80, `y span ${Math.max(...ys) - Math.min(...ys)}`)
})

test('buildBoxFaceConfirmStudioPayload includes wireframe', () => {
  const payload = buildBoxFaceConfirmStudioPayload('vi', { length: 200, width: 150, height: 100 })
  assert.ok(payload.boxWireframeSvg?.includes('Trước/sau'))
})
