import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildChatIconLogoPrompt,
  CHAT_ICON_LOGO_DEFAULT_PROMPT,
} from '@/lib/partner-website/visual-editor/build-chat-icon-logo-prompt'

test('chat icon logo prompt always has Tư vấn large and Nhắn tin small', () => {
  const prompt = buildChatIconLogoPrompt({ shopTitle: '188 Fashion' })
  assert.match(prompt, /Tư vấn/)
  assert.match(prompt, /Nhắn tin/)
  assert.match(prompt, /large bold/)
  assert.match(prompt, /smaller/)
  assert.match(prompt, /188 Fashion/)
  assert.doesNotMatch(prompt, /Optional user request/)
  assert.doesNotMatch(prompt, /reference image is attached/i)
  assert.ok(prompt.startsWith(CHAT_ICON_LOGO_DEFAULT_PROMPT))
})

test('chat icon logo prompt adds reference and optional extra only when present', () => {
  const withRef = buildChatIconLogoPrompt({
    shopTitle: '188',
    hasReference: true,
    extra: 'thêm túi cam',
  })
  assert.match(withRef, /reference image is attached/i)
  assert.match(withRef, /Optional user request: thêm túi cam/)
  assert.match(withRef, /Tư vấn/)
  const emptyExtra = buildChatIconLogoPrompt({ extra: '   ', hasReference: false })
  assert.doesNotMatch(emptyExtra, /Optional user request/)
})
