import assert from 'node:assert/strict'
import test from 'node:test'

import { buildShopTemplateSampleHtml } from '@/lib/partner-website/template/build-shop-template-sample-html'
import {
  injectShopTemplateSampleColorPickerInHtml,
  parseShopTemplateSampleColorParam,
  shopTemplateSampleApplyDashboardPath,
  shopTemplateSampleThemeForPrimary,
  withShopTemplateSampleApplyQuery,
} from '@/lib/partner-website/template/shop-template-sample-color-picker'
import { getShopTemplatePreset, listShopTemplatePresets } from '@/lib/partner-website/template/shop-template-presets'
import { DEFAULT_PARTNER_WEBSITE_THEME } from '@/lib/partner-website/template/partner-website-template-types'
import { themeFromMainSwatch } from '@/lib/partner-website/template/partner-website-theme-tokens'

test('shopTemplateSampleApplyDashboardPath keeps look + hue', () => {
  assert.equal(
    shopTemplateSampleApplyDashboardPath('fashion-marketplace', '#2563eb'),
    '/dashboard/messaging/website?applyPreset=fashion-marketplace&color=2563eb'
  )
  assert.equal(
    withShopTemplateSampleApplyQuery('/dashboard/messaging/p/188-shop/website', {
      applyPreset: 'fashion-marketplace',
      color: 'c026d3',
    }),
    '/dashboard/messaging/p/188-shop/website?applyPreset=fashion-marketplace&color=c026d3'
  )
  assert.equal(
    withShopTemplateSampleApplyQuery('/dashboard/messaging/p/188-shop/website', {}),
    '/dashboard/messaging/p/188-shop/website'
  )
})

test('parseShopTemplateSampleColorParam accepts hex with or without hash', () => {
  assert.equal(parseShopTemplateSampleColorParam('2563eb'), '#2563eb')
  assert.equal(parseShopTemplateSampleColorParam('#0f766e'), '#0f766e')
  assert.equal(parseShopTemplateSampleColorParam('abc'), '#aabbcc')
  assert.equal(parseShopTemplateSampleColorParam('not-a-color'), null)
  assert.equal(parseShopTemplateSampleColorParam(''), null)
})

test('shopTemplateSampleThemeForPrimary keeps the original preset when hue matches', () => {
  const original = { ...DEFAULT_PARTNER_WEBSITE_THEME, ...getShopTemplatePreset('fashion-marketplace').theme }
  assert.equal(shopTemplateSampleThemeForPrimary(original, '#ff6b00'), original)
  assert.equal(shopTemplateSampleThemeForPrimary(original, 'ff6b00').buyButtonColor, original.buyButtonColor)
  const blue = shopTemplateSampleThemeForPrimary(original, '2563eb')
  assert.deepEqual(blue, themeFromMainSwatch(original, '#2563eb'))
  assert.equal(blue.primaryColor, '#2563eb')
  assert.equal(blue.cartButtonColor, '#2563eb')
})

test('gallery samples for every preset include a live color picker', () => {
  for (const preset of listShopTemplatePresets()) {
    const built = buildShopTemplateSampleHtml({ presetId: preset.id, locale: 'vi' })
    assert.equal(built.ok, true)
    if (!built.ok) continue
    assert.match(built.html, /data-pw-sample-colors="1"/)
    assert.match(built.html, /data-pw-sample-swatch="/)
    assert.match(built.html, /id="pw-sample-color-cfg"/)
    assert.match(built.html, /Màu giao diện/)
    assert.match(built.html, /Chọn giao diện này/)
    assert.match(built.html, /data-pw-sample-preset-code/)
    assert.match(built.html, new RegExp(`>${preset.code}<`))
    assert.match(built.html, /data-pw-sample-apply="1"/)
    assert.match(
      built.html,
      new RegExp(`/dashboard/messaging/website\\?applyPreset=${preset.id}`)
    )
    assert.doesNotMatch(built.html, /data-pw-sample-colors="1"[\s\S]*data-pw-sample-colors="1"/)
  }
})

test('fashion-marketplace sample ?color= paints primary before first paint', () => {
  const built = buildShopTemplateSampleHtml({
    presetId: 'fashion-marketplace',
    locale: 'vi',
    primaryColor: '2563eb',
  })
  assert.equal(built.ok, true)
  if (!built.ok) return
  assert.match(built.html, /--pw-primary:#2563eb/)
  assert.match(built.html, /data-pw-sample-hue="#2563eb"/)
  assert.match(built.html, /data-pw-sample-swatch="#2563eb"[^>]*aria-pressed="true"/)
  assert.match(built.html, /applyPreset=fashion-marketplace&amp;color=2563eb/)
  assert.doesNotMatch(built.html, /data-pw-sample-swatch="#ff6b00"[^>]*aria-pressed="true"/)
})

test('injectShopTemplateSampleColorPickerInHtml is idempotent', () => {
  const theme = { ...DEFAULT_PARTNER_WEBSITE_THEME, look: 'marketplace' as const, primaryColor: '#ff6b00' }
  const html = '<!DOCTYPE html><html lang="vi"><head></head><body><header></header></body></html>'
  const once = injectShopTemplateSampleColorPickerInHtml(html, { locale: 'vi', originalTheme: theme })
  const twice = injectShopTemplateSampleColorPickerInHtml(once, { locale: 'vi', originalTheme: theme })
  assert.equal(once, twice)
  assert.equal(once.split('data-pw-sample-colors="1"').length - 1, 1)
})
