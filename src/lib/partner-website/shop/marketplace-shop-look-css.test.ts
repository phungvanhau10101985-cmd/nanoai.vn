import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildMarketplaceLookCss,
  injectMarketplaceLookIntoHtml,
  isMarketplaceLook,
  isMarketplaceTemplateId,
} from '@/lib/partner-website/shop/marketplace-shop-look-css'
import { buildShopTemplateSampleHtml } from '@/lib/partner-website/template/build-shop-template-sample-html'
import {
  getShopTemplatePreset,
  suggestedShopTemplatePresetForIndustry,
} from '@/lib/partner-website/template/shop-template-presets'

test('fashion-marketplace is an extra preset, not the fashion default', () => {
  assert.equal(isMarketplaceTemplateId('fashion-marketplace'), true)
  assert.equal(isMarketplaceTemplateId('fashion-orange'), false)
  assert.equal(suggestedShopTemplatePresetForIndustry('fashion'), 'fashion-orange')
  const preset = getShopTemplatePreset('fashion-marketplace')
  assert.equal(preset.theme.look, 'marketplace')
  assert.equal(isMarketplaceLook(preset.theme), true)
})

test('marketplace look CSS paints chrome with tokens, not brand hex', () => {
  const css = buildMarketplaceLookCss()
  assert.match(css, /html\[data-pw-look="marketplace"\]/)
  assert.match(css, /background:var\(--pw-primary\)!important/)
  assert.match(css, /background:var\(--pw-buy\)!important/)
  assert.match(css, /background:var\(--pw-footer/)
  assert.match(css, /color:var\(--pw-buy\)!important/)
  assert.doesNotMatch(css, /#ff6b00|#ff3333|#ff8c00/)
})

test('injectMarketplaceLookIntoHtml stamps look after chrome and skips other themes', () => {
  const html = '<!DOCTYPE html><html lang="vi"><head></head><body><header class="pw-header"></header></body></html>'
  const skipped = injectMarketplaceLookIntoHtml(html, { look: undefined })
  assert.equal(skipped, html)
  const out = injectMarketplaceLookIntoHtml(html, { look: 'marketplace' })
  assert.match(out, /data-pw-look="marketplace"/)
  assert.match(out, /id="pw-marketplace-look-css"/)
  assert.match(out, /family=Nunito/)
})

test('marketplace gallery sample is not 188-branded and keeps live hooks', () => {
  const built = buildShopTemplateSampleHtml({ presetId: 'fashion-marketplace', locale: 'vi' })
  assert.equal(built.ok, true)
  if (!built.ok) return
  assert.match(built.html, /data-pw-look="marketplace"/)
  assert.match(built.html, /Sàn mua sắm/)
  assert.match(built.html, /data-pw-catalog/)
  assert.match(built.html, /data-pw-featured-categories="1"/)
  assert.doesNotMatch(built.html, /188\.com\.vn/)
})
