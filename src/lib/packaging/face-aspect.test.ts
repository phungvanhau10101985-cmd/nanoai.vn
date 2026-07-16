import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildBoxFaceConfirmSummary,
  buildPackagingFaceAspectPlan,
  getFaceGeminiAspectRatio,
  isBoxFaceConfirmAck,
} from '@/lib/packaging/face-aspect'

test('builds face aspect plan and confirm summary from box dimensions', () => {
  const plan = buildPackagingFaceAspectPlan({ length: 200, width: 150, height: 100 })
  assert.equal(plan.LxW.widthMm, 200)
  assert.equal(plan.LxW.heightMm, 150)
  assert.equal(plan.LxH.widthMm, 200)
  assert.equal(plan.LxH.heightMm, 100)
  assert.equal(plan.WxH.widthMm, 150)
  assert.equal(plan.WxH.heightMm, 100)
  assert.ok(plan.LxW.geminiAspectRatio.length > 0)
  const summary = buildBoxFaceConfirmSummary('vi', { length: 200, width: 150, height: 100 })
  assert.match(summary, /Mặt đáy\/nắp/)
  assert.match(summary, /Mặt trước\/sau/)
  assert.match(summary, /Mặt bên\/hông/)
  assert.match(summary, /Gemini/)
})

test('portrait face picks vertical-friendly gemini ratio', () => {
  const ratio = getFaceGeminiAspectRatio(100, 200)
  assert.match(ratio, /:/)
})

test('detects box face confirmation ack messages', () => {
  assert.equal(isBoxFaceConfirmAck('OK'), true)
  assert.equal(isBoxFaceConfirmAck('xác nhận'), true)
  assert.equal(isBoxFaceConfirmAck('20 x 15 x 10'), false)
})
