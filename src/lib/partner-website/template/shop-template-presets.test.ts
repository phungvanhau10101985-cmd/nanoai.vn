import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getShopTemplatePreset,
  listShopTemplatePresets,
  resolveShopTemplatePresetId,
  shopTemplatePresetHeading,
  SHOP_TEMPLATE_PRESETS,
} from '@/lib/partner-website/template/shop-template-presets'

test('every shop preset has a unique short code GD01–GD08', () => {
  const codes = SHOP_TEMPLATE_PRESETS.map((p) => p.code)
  assert.deepEqual(codes, ['GD01', 'GD02', 'GD03', 'GD04', 'GD05', 'GD06', 'GD07', 'GD08'])
  assert.equal(new Set(codes).size, codes.length)
  assert.equal(getShopTemplatePreset('fashion-marketplace').code, 'GD03')
  assert.equal(getShopTemplatePreset('fashion-orange').code, 'GD02')
  assert.equal(getShopTemplatePreset('blank-white').code, 'GD08')
})

test('resolveShopTemplatePresetId accepts id or short code', () => {
  assert.equal(resolveShopTemplatePresetId('GD03'), 'fashion-marketplace')
  assert.equal(resolveShopTemplatePresetId('gd03'), 'fashion-marketplace')
  assert.equal(resolveShopTemplatePresetId('fashion-marketplace'), 'fashion-marketplace')
  assert.equal(resolveShopTemplatePresetId('landing-v1'), null)
  assert.equal(getShopTemplatePreset('GD01').id, 'commerce-blue')
})

test('shopTemplatePresetHeading shows code then name', () => {
  const preset = listShopTemplatePresets().find((p) => p.code === 'GD03')
  assert.ok(preset)
  assert.equal(shopTemplatePresetHeading(preset, 'vi'), 'GD03 · Sàn mua sắm')
})

test('every preset fills buy/cart/footer in the shared color frame', () => {
  for (const preset of SHOP_TEMPLATE_PRESETS) {
    assert.ok(preset.theme.buyButtonColor, `${preset.code} buy`)
    assert.ok(preset.theme.cartButtonColor, `${preset.code} cart`)
    assert.ok(preset.theme.footerColor, `${preset.code} footer`)
    if (preset.theme.look === 'marketplace') {
      assert.equal(preset.theme.cartButtonColor, preset.theme.primaryColor)
      assert.equal(preset.theme.footerColor, '#111827')
    } else {
      assert.equal(preset.theme.cartButtonColor, '#6b7280')
      assert.equal(preset.theme.buyButtonColor, preset.theme.primaryColor)
      assert.equal(preset.theme.footerColor, '#ffffff')
    }
  }
})
