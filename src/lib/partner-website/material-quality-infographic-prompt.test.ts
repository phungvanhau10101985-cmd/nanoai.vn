import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MATERIAL_QUALITY_INFOGRAPHIC_ASPECT_RATIO,
  buildMaterialQualityInfographicPrompt,
  fallbackMaterialQualityCallouts,
  padMaterialQualityCallouts,
} from './material-quality-infographic-prompt'

test('material infographic prompt locks the sample layout (center + 4 macros + magnifier + trust footer)', () => {
  const prompt = buildMaterialQualityInfographicPrompt({
    productName: 'Đầm voan hoa midi premium',
    material: 'Voan chiffon',
    locale: 'vi',
    callouts: ['Vân vải voan mỏng nhẹ', 'Đường may tinh xảo', 'Ren tinh tế', 'Phom dáng hoàn hảo'],
  })
  assert.equal(MATERIAL_QUALITY_INFOGRAPHIC_ASPECT_RATIO, '4:3')
  assert.match(prompt, /MAGNIFYING-GLASS/)
  assert.match(prompt, /TOP-LEFT tile/)
  assert.match(prompt, /BOTTOM-RIGHT tile/)
  assert.match(prompt, /3-column cross/)
  assert.match(prompt, /CAM KẾT: BAO ĐỔI TRẢ 7 NGÀY/)
  assert.match(prompt, /CHẤT LƯỢNG KHẲNG ĐỊNH ĐẲNG CẤP/)
  assert.match(prompt, /Vân vải voan mỏng nhẹ/)
  assert.match(prompt, /Ren tinh tế/)
  assert.match(prompt, /Landscape 4:3/)
  assert.match(prompt, /Do NOT depict a different product/)
})

test('fallback callouts are 4 role-specific labels and pad fills missing slots', () => {
  const vi = fallbackMaterialQualityCallouts('Da bò thật', 'vi')
  assert.equal(vi.length, 4)
  assert.match(vi[0], /vân da/i)
  assert.match(vi[1], /đường may/i)
  const padded = padMaterialQualityCallouts(['Vân da rõ nét'], 'Da bò thật', 'vi')
  assert.equal(padded.length, 4)
  assert.equal(padded[0], 'Vân da rõ nét')
  assert.ok(padded[1].length > 0)
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
