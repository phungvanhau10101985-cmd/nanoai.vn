import assert from 'node:assert/strict'
import test from 'node:test'

import { emptyStudioSession } from '@/lib/hub-chat/hub-studio-types'
import { defaultGenerationReferenceKeys } from '@/lib/hub-chat/hub-studio-generation-refs'
import {
  extractProductCode,
  resolveBarcodeLabelInput,
} from '@/lib/packaging/barcode-label-step'

test('extractProductCode parses labeled SKU', () => {
  assert.equal(extractProductCode('mã SP: 188-SRM-001'), '188-SRM-001')
  assert.equal(extractProductCode('SKU ABC-12345'), 'ABC-12345')
})

test('resolveBarcodeLabelInput uses brief brand and product name', () => {
  const session = {
    ...emptyStudioSession(),
    presetId: 'packaging_kit',
    briefNotes: {
      brand_name: '188 Cosmetics',
      product_type: 'Sữa rửa mặt tạo bọt',
    },
  }
  const resolved = resolveBarcodeLabelInput(session, 'tạo mã vạch')
  assert.equal(resolved.brandName, '188 Cosmetics')
  assert.equal(resolved.productName, 'Sữa rửa mặt tạo bọt')
  assert.equal(resolved.type, 'code128')
  assert.match(resolved.content, /188|COSMETICS|SUA|RUA/)
})

test('resolveBarcodeLabelInput prefers explicit product code', () => {
  const session = {
    ...emptyStudioSession(),
    briefNotes: {
      brand_name: '188 Cosmetics',
      product_type: 'Sữa rửa mặt',
    },
  }
  const resolved = resolveBarcodeLabelInput(session, 'Code128 mã SP: 188-SRM-001')
  assert.equal(resolved.content, '188-SRM-001')
  assert.equal(resolved.productCode, '188-SRM-001')
})

test('seal_sticker step uses logo reference only', () => {
  const session = {
    ...emptyStudioSession(),
    presetId: 'packaging_kit',
    currentStepKey: 'seal_sticker',
    referenceImages: [
      { screenKey: 'logo', screenLabel: 'Logo', url: 'logo.png', approvedAt: 1 },
      { screenKey: 'face_front', screenLabel: 'Front', url: 'front.png', approvedAt: 2 },
    ],
  }
  assert.deepEqual(defaultGenerationReferenceKeys(session, 'packaging_kit', 'seal_sticker'), ['logo'])
})
