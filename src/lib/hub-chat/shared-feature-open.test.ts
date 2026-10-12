import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isFeatureChatPause,
  resolveSharedFeatureOpen,
} from '@/lib/hub-chat/shared-feature-open'

test('standalone feature page opens that page', () => {
  const open = resolveSharedFeatureOpen('thử đồ 4 người', 'vi')
  assert.ok(open)
  assert.equal(open.open.kind, 'feature_page')
  assert.equal(open.open.href, '/thu-do-online/4-nguoi')
  assert.match(open.message, /Bấm vào link bên dưới để mở tính năng/)
  assert.equal(open.open.buttonLabel, 'Mở tính năng')
  assert.doesNotMatch(open.message, /https?:\/\//)
})

test('in-hub studio opens the hub preset link', () => {
  const open = resolveSharedFeatureOpen('tạo web', 'vi')
  assert.ok(open)
  assert.equal(open.open.kind, 'hub')
  assert.equal(open.open.href, '/?hubPreset=mobile_shop')
  assert.equal(open.open.presetId, 'mobile_shop')
  assert.match(open.message, /Bấm vào link bên dưới để mở tính năng/)
})

test('wedding invitation is a feature page', () => {
  const open = resolveSharedFeatureOpen('tạo thiệp cưới', 'vi')
  assert.ok(open)
  assert.equal(open.open.kind, 'feature_page')
  assert.equal(open.open.href, '/tao-thiep-moi-cuoi-ai')
})

test('thanks is a pause, not a feature', () => {
  assert.equal(resolveSharedFeatureOpen('cảm ơn shop', 'vi'), null)
  assert.equal(isFeatureChatPause('cảm ơn shop'), true)
})

test('greeting does not invent a feature', () => {
  assert.equal(resolveSharedFeatureOpen('xin chào shop', 'vi'), null)
  assert.equal(isFeatureChatPause('xin chào shop'), false)
})
