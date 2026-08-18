import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MATERIAL_QUALITY_INFOGRAPHIC_ASPECT_RATIO,
  buildMaterialQualityInfographicPrompt,
  fallbackMaterialQualityCallouts,
  padMaterialQualityCallouts,
  shortMaterialInfographicTitle,
} from './material-quality-infographic-prompt'

test('material infographic prompt uses the 1:1 feature-board template', () => {
  const prompt = buildMaterialQualityInfographicPrompt({
    productName: 'Đầm voan hoa midi premium',
    material: 'Voan chiffon',
    locale: 'vi',
    callouts: ['Vân vải voan mỏng nhẹ', 'Đường may tinh xảo', 'Ren tinh tế', 'Phom dáng hoàn hảo'],
  })
  assert.equal(MATERIAL_QUALITY_INFOGRAPHIC_ASPECT_RATIO, '1:1')
  assert.match(prompt, /1:1 aspect ratio/)
  assert.match(prompt, /HEADER SECTION/)
  assert.match(prompt, /MAIN CENTER HERO IMAGE/)
  assert.match(prompt, /realistic magnifying glass/i)
  assert.match(prompt, /floating pop-up card/)
  assert.match(prompt, /never a blank\/white empty card/)
  assert.match(prompt, /FORBIDDEN: giant watermark/)
  assert.match(prompt, /Solid cream rectangular banner/)
  assert.match(prompt, /SURROUNDING DETAIL CARDS/)
  assert.match(prompt, /FOOTER TRUST BANNER/)
  assert.match(prompt, /CAM KẾT: BAO ĐỔI TRẢ 7 NGÀY/)
  assert.match(prompt, /CHẤT LƯỢNG KHẲNG ĐỊNH ĐẲNG CẤP/)
  assert.match(prompt, /VÂN VẢI VOAN MỎNG NHẸ/)
  assert.match(prompt, /EXACTLY ONE real product photo/)
  assert.doesNotMatch(prompt, /LAYOUT TEMPLATE/)
})

test('long SEO names are shortened and color lists are stripped from the printed headline', () => {
  const title = shortMaterialInfographicTitle(
    'Áo thun cộc tay nam cotton cổ tròn phong cách Hàn Quốc màu xanh rêu, trắng, nâu, đen...',
    'cotton',
    'vi'
  )
  assert.ok(title.length <= 36)
  assert.doesNotMatch(title, /XANH RÊU/)
  assert.equal(
    shortMaterialInfographicTitle(
      'váy dạ tiệc nữ dáng ôm body cổ chữ V lớp lót phong cách Châu Âu màu tím',
      '',
      'vi'
    ),
    'VÁY DẠ TIỆC CAO CẤP'
  )
  const prompt = buildMaterialQualityInfographicPrompt({
    productName: 'Áo thun cộc tay nam cotton cổ tròn phong cách Hàn Quốc màu xanh rêu, trắng, nâu, đen...',
    material: '',
    locale: 'vi',
  })
  assert.match(prompt, /ÁO THUN/)
  assert.doesNotMatch(prompt, /headline banner[^"]*XANH RÊU/)
  assert.match(prompt, /Vải Mềm Mịn • Thoáng Khí Tự Nhiên • Dễ Chăm Sóc/)
})

test('fallback callouts are 4 role-specific labels and pad fills missing slots', () => {
  const vi = fallbackMaterialQualityCallouts('Da bò thật', 'vi')
  assert.equal(vi.length, 4)
  assert.match(vi[0], /vân da/i)
  const padded = padMaterialQualityCallouts(['Vân da rõ nét'], 'Da bò thật', 'vi')
  assert.equal(padded.length, 4)
  assert.equal(padded[0], 'Vân da rõ nét')
})

test('non-vi locale prints translated headline/footer, not Vietnamese sample copy', () => {
  const prompt = buildMaterialQualityInfographicPrompt({
    productName: 'Leather tote',
    material: 'Full-grain leather',
    locale: 'en',
  })
  assert.match(prompt, /QUALITY THAT ASSERTS CLASS/)
  assert.match(prompt, /7-DAY RETURNS/)
  assert.doesNotMatch(prompt, /CAM KẾT/)
})
