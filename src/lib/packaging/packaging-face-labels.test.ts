import assert from 'node:assert/strict'
import test from 'node:test'

import {
  formatFaceSizeCompact,
  packagingFaceStepLabelWithSize,
  bagFaceStepLabelWithSize,
  resolvePackagingStepLabel,
} from '@/lib/packaging/packaging-face-labels'

test('formatFaceSizeCompact shows mm with locale decimal', () => {
  assert.equal(formatFaceSizeCompact('en', 100, 100), '100×100 mm')
  assert.equal(formatFaceSizeCompact('vi', 100, 100), '100×100 mm')
})

test('packagingFaceStepLabelWithSize appends face mm', () => {
  const label = packagingFaceStepLabelWithSize('vi', 'Mặt trước (L×H)', 'face_front', {
    length: 100,
    width: 100,
    height: 50,
  })
  assert.match(label, /Mặt trước \(L×H\)/)
  assert.match(label, /100×50 mm/)
})

test('resolvePackagingStepLabel enriches packaging face steps only', () => {
  const steps = [{ key: 'face_top', label: 'Mặt trên (L×W)', status: 'in_progress' as const }]
  const out = resolvePackagingStepLabel(steps, 'face_top', 'vi', 'packaging_kit', {
    length: 100,
    width: 100,
    height: 50,
  })
  assert.match(out, /100×100 mm/)
  const logo = resolvePackagingStepLabel(steps, 'logo', 'vi', 'packaging_kit', {
    length: 100,
    width: 100,
    height: 50,
  })
  assert.equal(logo, 'logo')
})

test('bagFaceStepLabelWithSize appends bag panel mm', () => {
  const label = bagFaceStepLabelWithSize('en', 'Back', 'face_back', {
    width: 200,
    height: 280,
    gusset: 60,
  })
  assert.match(label, /Back/)
  assert.match(label, /200×280 mm/)
})

test('resolvePackagingStepLabel enriches bag face steps', () => {
  const steps = [{ key: 'face_front', label: 'Front', status: 'in_progress' as const }]
  const out = resolvePackagingStepLabel(steps, 'face_front', 'en', 'bag_kit', null, {
    width: 200,
    height: 280,
    gusset: 60,
  })
  assert.match(out, /200×280 mm/)
})
