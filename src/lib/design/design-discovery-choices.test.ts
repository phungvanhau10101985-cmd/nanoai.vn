import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  designConceptSheetChoices,
  designFormatChoices,
  designRecreateDesignChoices,
  designRenderStyleChoices,
  findDesignRecreateDiscoveryChoice,
  getDesignRecreateDesignInputKind,
  getDesignRecreateDiscoveryInputKind,
  resolveDesignBoardLanguageKey,
} from '@/lib/design/design-discovery-choices'

test('design_recreate discovery steps map to pickers', () => {
  assert.equal(getDesignRecreateDiscoveryInputKind('design_sector'), 'sector_picker')
  assert.equal(getDesignRecreateDiscoveryInputKind('design_format'), 'format_picker')
  assert.equal(getDesignRecreateDiscoveryInputKind('render_style'), 'render_style_picker')
  assert.equal(getDesignRecreateDiscoveryInputKind('design_notes'), 'notes_picker')
  assert.equal(getDesignRecreateDiscoveryInputKind('design_language'), 'language_picker')
})

test('format and render choices follow selected sector', () => {
  const fashionFormats = designFormatChoices({ design_sector: 'fashion' })
  assert.ok(fashionFormats.some((c) => c.key === 'concept_board'))
  const fashionStyles = designRenderStyleChoices({ design_sector: 'fashion' })
  assert.ok(fashionStyles.some((c) => c.key === 'pencil_sketch'))
  assert.ok(fashionStyles.some((c) => c.key === 'marker_fashion_sketch'))
  assert.ok(fashionStyles.some((c) => c.key === 'fashion_concept_sheet'))
  const packagingStyles = designRenderStyleChoices({ design_sector: 'packaging' })
  assert.ok(packagingStyles.some((c) => c.key === 'flat_illustration'))
  assert.ok(!packagingStyles.some((c) => c.key === 'fashion_concept_sheet'))
})

test('findDesignRecreateDiscoveryChoice resolves format keys', () => {
  const choice = findDesignRecreateDiscoveryChoice('design_format', 'hero_illustration', {
    design_sector: 'fashion',
  })
  assert.equal(choice?.key, 'hero_illustration')
})

test('resolveDesignBoardLanguageKey parses brief values', () => {
  assert.equal(resolveDesignBoardLanguageKey({ design_language: 'en' }), 'en')
  assert.equal(resolveDesignBoardLanguageKey({ design_language: 'bilingual' }), 'bilingual')
  assert.equal(resolveDesignBoardLanguageKey({ design_language: 'Tiếng Việt' }), 'vi')
})

test('design concept step exposes picker (single redesign image flow)', () => {
  assert.equal(getDesignRecreateDesignInputKind('concept_sheet'), 'concept_sheet_picker')
  assert.ok(designConceptSheetChoices().length >= 3)
  assert.ok(designRecreateDesignChoices('concept_sheet').some((c) => c.key === 'full_board'))
})
