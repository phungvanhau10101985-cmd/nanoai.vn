import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildChatIconInkFacts,
  buildChatIconLogoPrompt,
  CHAT_ICON_LOGO_DEFAULT_PROMPT,
  collectChatIconStyleReferences,
  collectChatIconStyleReferencesFromForm,
  resolveChatIconStyleReferenceUrl,
} from '@/lib/partner-website/visual-editor/build-chat-icon-logo-prompt'

test('chat icon logo prompt always has Tư vấn large and Nhắn tin small', () => {
  const prompt = buildChatIconLogoPrompt({ shopTitle: '188 Fashion' })
  assert.match(prompt, /tư vấn/)
  assert.match(prompt, /nhắn tin/)
  assert.match(prompt, /ROUND STAMP/)
  assert.match(prompt, /circular RING/)
  assert.match(prompt, /SOLID/)
  assert.match(prompt, /188 Fashion/)
  assert.match(prompt, /shopping-bag/)
  assert.ok(prompt.includes(CHAT_ICON_LOGO_DEFAULT_PROMPT))
  assert.doesNotMatch(prompt, /Optional user request/)
  assert.doesNotMatch(prompt, /reference image is attached/i)
})

test('chat icon logo prompt adds reference and optional extra only when present', () => {
  const withRef = buildChatIconLogoPrompt({
    shopTitle: '188',
    hasReference: true,
    extra: 'thêm túi cam',
  })
  assert.match(withRef, /reference image is attached/i)
  assert.match(withRef, /Optional user request: thêm túi cam/)
  assert.match(withRef, /tư vấn/)
  const emptyExtra = buildChatIconLogoPrompt({ extra: '   ', hasReference: false })
  assert.doesNotMatch(emptyExtra, /Optional user request/)
  const withColors = buildChatIconLogoPrompt({
    colorFacts: buildChatIconInkFacts({ main: '#c2410c' }),
  })
  assert.match(withColors, /#c2410c/)
  assert.match(withColors, /INSIDE of the circle/)
})

test('chat icon ink facts allow white interior and skip near-white ink', () => {
  const orange = buildChatIconInkFacts({ main: '#c2410c', accent: '#fb923c' })
  assert.match(orange, /#c2410c/)
  assert.match(orange, /white/)
  assert.doesNotMatch(orange, /ONLY these user-picked/)
  const white = buildChatIconInkFacts({ main: '#ffffff' })
  assert.doesNotMatch(white, /#ffffff/)
  assert.match(white, /saturated solid/)
})

test('chat icon style reference prefers user upload, then shop logo, then current chat icon', () => {
  assert.equal(
    resolveChatIconStyleReferenceUrl({
      userRef: 'https://cdn.example/user.png',
      shopLogoUrl: 'https://cdn.example/shop.png',
      chatIconUrl: 'https://cdn.example/chat.png',
    }),
    'https://cdn.example/user.png'
  )
  assert.equal(
    resolveChatIconStyleReferenceUrl({
      shopLogoUrl: 'https://cdn.example/shop.png',
      chatIconUrl: 'https://cdn.example/chat.png',
    }),
    'https://cdn.example/shop.png'
  )
  assert.equal(
    resolveChatIconStyleReferenceUrl({
      chatIconUrl: 'https://cdn.example/chat.png',
    }),
    'https://cdn.example/chat.png'
  )
  assert.equal(resolveChatIconStyleReferenceUrl({ shopLogoUrl: '/uploads/logo.png' }), '')
})

test('chat icon generate refs: user upload is style, shop logo is mark-only', () => {
  const user = collectChatIconStyleReferences({
    userRef: 'https://cdn.example/user.png',
    shopLogoUrl: 'https://cdn.example/shop.png',
  })
  assert.deepEqual(user.urls, ['https://cdn.example/user.png'])
  assert.equal(user.meta[0]?.screenKey, 'chat_icon_style')
  const shop = collectChatIconStyleReferences({
    shopLogoUrl: 'https://cdn.example/shop.png',
    chatIconUrl: 'https://cdn.example/chat.png',
  })
  assert.deepEqual(shop.urls, ['https://cdn.example/shop.png'])
  assert.equal(shop.meta[0]?.screenKey, 'chat_icon_shop_mark')
  const chatOnly = collectChatIconStyleReferences({
    chatIconUrl: 'https://cdn.example/chat.png',
  })
  assert.equal(chatOnly.meta[0]?.screenKey, 'chat_icon_style')
})

test('pre-filled shop logo in the form still counts as shop mark, not a user style upload', () => {
  const prefilled = collectChatIconStyleReferencesFromForm({
    formRef: 'https://cdn.example/shop.png',
    shopLogoUrl: 'https://cdn.example/shop.png',
    chatIconUrl: 'https://cdn.example/chat.png',
  })
  assert.equal(prefilled.meta[0]?.screenKey, 'chat_icon_shop_mark')
  const uploaded = collectChatIconStyleReferencesFromForm({
    formRef: 'https://cdn.example/user.png',
    shopLogoUrl: 'https://cdn.example/shop.png',
  })
  assert.equal(uploaded.meta[0]?.screenKey, 'chat_icon_style')
})
