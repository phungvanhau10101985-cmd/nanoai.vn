import assert from 'node:assert/strict'
import test from 'node:test'

import { getTuckEndLayoutData } from '@/app/thiet-ke-bao-bi/lib/box-net-svg'
import { generateBarcodeBuffer, validateBarcodeContent } from '@/lib/barcode/generate-barcode'
import { generateBarcodeLabelBuffer } from '@/lib/barcode/generate-barcode-label'
import { emptyStudioSession } from '@/lib/hub-chat/hub-studio-types'
import { parseBoxDimensions } from '@/lib/packaging/dimensions'
import { invalidatePackagingFromStep } from '@/lib/packaging/session-dependencies'

test('parses decimal cm and explicit mm box sizes', () => {
  assert.deepEqual(parseBoxDimensions('6,5 × 4 × 3.2 cm'), {
    ok: true,
    dimensionsMm: { length: 65, width: 40, height: 32 },
  })
  assert.deepEqual(parseBoxDimensions('200 x 150 x 100 mm'), {
    ok: true,
    dimensionsMm: { length: 200, width: 150, height: 100 },
  })
  assert.deepEqual(parseBoxDimensions('20 x 15'), { ok: false, error: 'format' })
  assert.deepEqual(parseBoxDimensions('100 x 10 x 10 cm'), {
    ok: true,
    dimensionsMm: { length: 1000, width: 100, height: 100 },
  })
  assert.deepEqual(parseBoxDimensions('50 x 30 x 0.5 cm'), {
    ok: true,
    dimensionsMm: { length: 500, width: 300, height: 5 },
  })
})

test('tuck-end layout has required artwork panels and no exact cut/crease overlap', () => {
  const layout = getTuckEndLayoutData({ lengthMm: 200, widthMm: 150, heightMm: 100 })
  assert.deepEqual(
    layout.panels.map((panel) => panel.slot),
    ['front', 'right', 'back', 'left', 'top', 'bottom']
  )
  assert.ok(layout.glueTabMm >= 15)
  const key = (line: number[]) => line.map((n) => n.toFixed(3)).join(',')
  const cuts = new Set(layout.cutSegments.map(key))
  assert.equal(layout.foldSegments.filter((line) => cuts.has(key(line))).length, 0)
})

test('regenerating a packaging face invalidates only it and downstream assets', () => {
  const base = emptyStudioSession()
  const session = {
    ...base,
    presetId: 'packaging_kit',
    currentStepKey: 'barcode_label',
    processSteps: [
      { key: 'logo', label: 'Logo', status: 'done' as const },
      { key: 'face_lxw', label: 'LxW', status: 'done' as const },
      { key: 'face_lxh', label: 'LxH', status: 'done' as const },
      { key: 'face_wxh', label: 'WxH', status: 'done' as const },
      { key: 'box_dieline_pdf', label: 'PDF', status: 'done' as const },
      { key: 'box_mockup_3d', label: '3D', status: 'done' as const },
    ],
    referenceImages: [
      { screenKey: 'logo', screenLabel: 'Logo', url: 'logo', approvedAt: 1 },
      { screenKey: 'face_lxw', screenLabel: 'LxW', url: 'lxw', approvedAt: 2 },
      { screenKey: 'face_lxh', screenLabel: 'LxH', url: 'lxh', approvedAt: 3 },
      { screenKey: 'face_wxh', screenLabel: 'WxH', url: 'wxh', approvedAt: 4 },
    ],
    packaging: {
      version: 2 as const,
      dimensionsMm: { length: 200, width: 150, height: 100 },
      faces: { LxW: 'lxw', LxH: 'lxh', WxH: 'wxh' },
      dielineUrl: 'pdf',
      mockupUrl: 'mockup',
    },
  }
  const next = invalidatePackagingFromStep(session, 'face_lxh')
  assert.equal(next.packaging?.faces.LxW, 'lxw')
  assert.equal(next.packaging?.faces.LxH, undefined)
  assert.equal(next.packaging?.faces.WxH, undefined)
  assert.equal(next.packaging?.dielineUrl, undefined)
  assert.equal(next.referenceImages.some((r) => r.screenKey === 'face_lxw'), true)
  assert.equal(next.referenceImages.some((r) => r.screenKey === 'face_lxh'), false)
})

test('barcode validation and PNG generation are deterministic tools, not AI', async () => {
  assert.equal(validateBarcodeContent('ean13', '123'), 'EAN-13 cần đúng 13 chữ số.')
  assert.equal(validateBarcodeContent('code128', 'SKU-123'), null)
  const png = await generateBarcodeBuffer('code128', 'SKU-123', 256)
  assert.ok(png.length > 100)
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  const label = await generateBarcodeLabelBuffer({
    type: 'code128',
    content: 'SKU-123',
    brandName: 'Nano Herb',
    productName: 'Herbal Tea',
  })
  assert.ok(label.length > png.length)
})

