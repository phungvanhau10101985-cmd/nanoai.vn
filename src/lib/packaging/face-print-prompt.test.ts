import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildPackagingFacePromptBlock,
  collectPackagingBrandIdentifiers,
  PACKAGING_FACE_APPROVED_LOGO_RULES,
  PACKAGING_FACE_SAFE_ZONE_RULES,
  stripBrandLogoFromPackagingFaceVisualPrompt,
  stripPackagingFaceTechnicalMeasurementsFromVisualPrompt,
} from '@/lib/packaging/face-print-prompt'

test('packaging face visual rules avoid mm safe-zone numbers', () => {
  assert.doesNotMatch(PACKAGING_FACE_SAFE_ZONE_RULES, /\d+\s*mm/i)
  assert.match(PACKAGING_FACE_SAFE_ZONE_RULES, /never draw guides/i)
})

test('buildPackagingFacePromptBlock excludes print dimensions from visual brief', () => {
  const block = buildPackagingFacePromptBlock({
    faceKey: 'LxH',
    faceSlot: 'front',
    isSquare: false,
  })
  assert.doesNotMatch(block, /200\s*[×x]\s*120|10\s*mm|Gemini aspect/i)
  assert.match(block, /API supplies the exact aspect ratio/i)
  assert.match(block, /never visualize on the artwork/i)
  assert.match(block, /FACE ROLE: LxH \(FRONT\)/)
})

test('buildPackagingFacePromptBlock body strip avoids fold mm positions', () => {
  const block = buildPackagingFacePromptBlock({ isBodyStrip: true })
  assert.doesNotMatch(block, /\d+\s*[×x]\s*\d+\s*mm|fold guides are at/i)
  assert.match(block, /FRONT \| RIGHT \| BACK \| LEFT/i)
})

test('stripPackagingFaceTechnicalMeasurementsFromVisualPrompt removes legacy technical lines', () => {
  const visualPrompt = stripPackagingFaceTechnicalMeasurementsFromVisualPrompt(
    `Brand box front design.
TECHNICAL FACE: LxH (FRONT), exact print size 200 × 120 mm, Gemini aspect 3:2. Keep text/logos ≥ 10mm from panel edges.
Box 200x120x80 mm.`
  )
  assert.doesNotMatch(visualPrompt, /200|120|10mm|3:2|TECHNICAL FACE/i)
  assert.match(visualPrompt, /Brand box front design/i)
})

test('collectPackagingBrandIdentifiers gathers brand_name and project title', () => {
  const names = collectPackagingBrandIdentifiers({ brand_name: 'Bear' }, 'Bear Cosmetics')
  assert.deepEqual(names.sort(), ['Bear', 'Bear Cosmetics'].sort())
})

test('stripBrandLogoFromPackagingFaceVisualPrompt removes logo/brand lines but keeps label copy', () => {
  const prompt = stripBrandLogoFromPackagingFaceVisualPrompt(
    `Design: Mặt trước
User requirements: Logo thương hiệu Bear
Thương hiệu: Bear
Thành phần: nước, glycerin, vitamin E
Dung tích: 50ml
Project: Bear

Collected brand brief:
- brand_name: Bear
- logo: minimalist bear icon`,
    ['Bear', 'Bear Cosmetics']
  )
  assert.doesNotMatch(prompt, /Logo thương hiệu|brand_name|^Project:/im)
  assert.match(prompt, /Thành phần: nước, glycerin, vitamin E/i)
  assert.match(prompt, /Dung tích: 50ml/i)
})

test('PACKAGING_FACE_APPROVED_LOGO_RULES forbids duplicate logotype', () => {
  assert.match(PACKAGING_FACE_APPROVED_LOGO_RULES, /Do NOT draw, re-typeset/i)
  assert.match(PACKAGING_FACE_APPROVED_LOGO_RULES, /attached approved LOGO/i)
})
