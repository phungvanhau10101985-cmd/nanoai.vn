import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMenuImageGenerationPrompt } from './menu-image-prompt-builder'

test('buildMenuImageGenerationPrompt — ghép trực tiếp không qua Gemini', () => {
  const result = buildMenuImageGenerationPrompt({
    locale: 'vi',
    briefNotes: {
      menu_type: 'quán bia',
      menu_style: 'truyền thống',
      color_tone: 'ấm, rustic',
    },
    dishes: [],
    dishesBulkText: 'Lạc rang muốiĐĩa20.000',
    formatPresetId: 'menu_a4_portrait',
    aspectRatio: '3:4',
    formatLabel: 'Menu A4 dọc',
    venueName: 'Quán Bia Lan Gầy',
    hasLogo: true,
  })

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.ok(result.prompt.includes('Quán Bia Lan Gầy'))
  assert.ok(result.prompt.includes('Lạc rang muối'))
  assert.ok(result.prompt.includes('MENU CONTENT'))
  assert.ok(result.prompt.includes('menu_type: quán bia'))
  assert.ok(!result.prompt.includes('---IMAGE_PROMPT---'))
})

test('buildMenuImageGenerationPrompt — rỗng', () => {
  assert.deepEqual(
    buildMenuImageGenerationPrompt({
      locale: 'vi',
      briefNotes: {},
      dishes: [],
      formatPresetId: 'menu_a4_portrait',
      aspectRatio: '3:4',
      formatLabel: 'Menu A4 dọc',
    }),
    { ok: false, error: 'EMPTY_DISHES' }
  )
})
