import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isFeatureChatPause,
  resolveSharedFeatureOpen,
  resolveStudyHelpMenu,
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

test('ai tutor opens the feature page button', () => {
  const open = resolveSharedFeatureOpen('học với gia sư', 'vi')
  assert.ok(open)
  assert.equal(open.open.kind, 'feature_page')
  assert.equal(open.open.href, '/gia-su-ai')
  assert.equal(open.open.buttonLabel, 'Mở tính năng')
  assert.doesNotMatch(open.message, /https?:\/\//)
})

test('homework help opens the feature page button', () => {
  const open = resolveSharedFeatureOpen('hỗ trợ làm bài', 'vi')
  assert.ok(open)
  assert.equal(open.open.kind, 'feature_page')
  assert.equal(open.open.href, '/ho-tro-lam-bai')
  assert.equal(open.open.buttonLabel, 'Mở tính năng')
})

test('phục chế ảnh opens photo restoration', () => {
  const open = resolveSharedFeatureOpen('Phục chế ảnh cho tôi', 'vi')
  assert.ok(open)
  assert.equal(open.open.kind, 'feature_page')
  assert.equal(open.open.href, '/phuc-dung-anh')
  assert.match(open.open.label, /Phục dựng/)
})

test('giúp tôi học bài lists study features instead of one tool', () => {
  const menu = resolveStudyHelpMenu('Giúp tôi học bài', 'vi')
  assert.ok(menu)
  assert.match(menu.message, /học bài/)
  assert.doesNotMatch(menu.message, /https?:\/\//)
  assert.deepEqual(
    menu.opens.map((open) => open.href),
    ['/ho-tro-lam-bai', '/gia-su-ai', '/hoc-tieng-anh-ai', '/hoc-bai-hoc-co-san']
  )
  assert.equal(menu.opens[3]?.label, 'Bài học có sẵn')
  assert.equal(resolveSharedFeatureOpen('Giúp tôi học bài', 'vi'), null)
})

test('a named study tool still opens that one feature', () => {
  assert.equal(resolveStudyHelpMenu('học với gia sư', 'vi'), null)
  assert.equal(resolveStudyHelpMenu('hỗ trợ làm bài', 'vi'), null)
  const open = resolveSharedFeatureOpen('học với gia sư', 'vi')
  assert.equal(open?.open.href, '/gia-su-ai')
})

test('greeting does not invent a feature', () => {
  assert.equal(resolveSharedFeatureOpen('xin chào shop', 'vi'), null)
  assert.equal(isFeatureChatPause('xin chào shop'), false)
})
