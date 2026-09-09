import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAdminLogoCreatePrompt } from './build-admin-logo-create-prompt'
import { CHAT_ICON_LOGO_DEFAULT_PROMPT } from './build-chat-icon-logo-prompt'

test('chat slot uses Tư vấn / Nhắn tin default and optional extra', () => {
  const base = buildAdminLogoCreatePrompt({ slot: 'chat', shopTitle: '188 Fashion' })
  assert.ok(base.startsWith(CHAT_ICON_LOGO_DEFAULT_PROMPT))
  assert.match(base, /188 Fashion/)
  assert.doesNotMatch(base, /Optional user request/)
  const extra = buildAdminLogoCreatePrompt({
    slot: 'chat',
    shopTitle: '188 Fashion',
    extra: 'icon cam, chữ 188',
    hasReference: true,
  })
  assert.match(extra, /Optional user request: icon cam, chữ 188/)
  assert.match(extra, /reference image is attached/i)
})

test('favicon / header / footer have a default prompt without requiring extra', () => {
  const fav = buildAdminLogoCreatePrompt({ slot: 'favicon', shopTitle: '188' })
  assert.match(fav, /favicon/i)
  assert.match(fav, /188/)
  assert.doesNotMatch(fav, /Optional user request/)
  const header = buildAdminLogoCreatePrompt({
    slot: 'header',
    shopTitle: '188',
    device: 'mobile',
    extra: 'chữ trắng',
    hasReference: true,
  })
  assert.match(header, /header logo/)
  assert.match(header, /mobile/)
  assert.match(header, /Optional user request: chữ trắng/)
  assert.match(header, /reference image is attached/i)
  const footer = buildAdminLogoCreatePrompt({ slot: 'footer', shopTitle: 'Shop' })
  assert.match(footer, /footer logo/)
})
