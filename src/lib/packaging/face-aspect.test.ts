import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildBoxFaceConfirmSummary,
  buildPackagingFaceAspectPlan,
  closestGptFaceAspectRatio,
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

test('portrait face picks the closest ratio each model can return', () => {
  assert.equal(getFaceGeminiAspectRatio(100, 200), '9:16')
  assert.equal(closestGptFaceAspectRatio(100, 200), '2:3')
})

test('serum box 50×130 mm does not request a ratio the model rejects', () => {
  assert.equal(getFaceGeminiAspectRatio(50, 130), '9:16')
  assert.notEqual(getFaceGeminiAspectRatio(50, 130), '9:21')
  assert.notEqual(getFaceGeminiAspectRatio(50, 130), '16:9')
  assert.equal(closestGptFaceAspectRatio(50, 130), '2:3')
  assert.equal(getFaceGeminiAspectRatio(50, 50), '1:1')
  assert.equal(closestGptFaceAspectRatio(50, 50), '1:1')
  const summary = buildBoxFaceConfirmSummary('vi', { length: 50, width: 50, height: 130 })
  assert.match(summary, /Gemini \*\*9:16\*\*/)
  assert.match(summary, /GPT \*\*2:3\*\*/)
  assert.match(summary, /GPT \*\*1:1\*\*/)
})

test('detects box face confirmation ack messages', () => {
  assert.equal(isBoxFaceConfirmAck('OK'), true)
  assert.equal(isBoxFaceConfirmAck('xác nhận'), true)
  assert.equal(isBoxFaceConfirmAck('20 x 15 x 10'), false)
})
