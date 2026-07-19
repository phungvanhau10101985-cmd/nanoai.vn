import assert from 'node:assert/strict'
import test from 'node:test'

import {
  formatStudioColorPaletteBriefFromSelections,
  formatStudioColorPaletteBriefValue,
  formatStudioUiColorPalettePromptBlock,
  normalizeStudioHexColor,
  resolveStudioBrandColors,
  resolveStudioColorSelections,
} from '@/lib/hub-chat/studio-color-palette'
import { emptyStudioSession } from '@/lib/hub-chat/hub-studio-types'

test('normalizeStudioHexColor accepts hash and bare hex', () => {
  assert.equal(normalizeStudioHexColor('#f4c2c2'), '#F4C2C2')
  assert.equal(normalizeStudioHexColor('2563EB'), '#2563EB')
  assert.equal(normalizeStudioHexColor('bad'), null)
})

test('resolveStudioBrandColors includes preset and custom hex', () => {
  const colors = resolveStudioBrandColors(['pastel_pink', 'custom:#FF5733'])
  assert.equal(colors.length, 2)
  assert.equal(colors[0]?.hex, '#F4C2C2')
  assert.equal(colors[1]?.hex, '#FF5733')
})

test('formatStudioColorPaletteBriefFromSelections stores primary and secondary with hex', () => {
  const brief = formatStudioColorPaletteBriefFromSelections(
    [
      { key: 'white', role: 'primary' },
      { key: 'pastel_pink', role: 'primary' },
      { key: 'black', role: 'secondary' },
      { key: 'gray', role: 'secondary' },
    ],
    'vi'
  )
  assert.match(brief, /Màu chính:.*Trắng \(#FFFFFF\).*Hồng pastel \(#F4C2C2\)/)
  assert.match(brief, /Màu phụ:.*Đen \(#1A1A1A\).*Xám \(#9CA3AF\)/)
})

test('formatStudioColorPaletteBriefValue stores label and hex', () => {
  const colors = resolveStudioBrandColors(['white', 'black'])
  const brief = formatStudioColorPaletteBriefValue(colors, 'vi')
  assert.match(brief, /Màu chính:.*Trắng \(#FFFFFF\)/)
  assert.match(brief, /Màu phụ:.*Đen \(#1A1A1A\)/)
})

test('formatStudioUiColorPalettePromptBlock prioritizes primary over secondary', () => {
  const session = {
    ...emptyStudioSession(),
    briefNotes: {
      color_palette:
        'Màu chính: Trắng (#FFFFFF), Hồng pastel (#F4C2C2). Màu phụ: Đen (#1A1A1A), Xám (#9CA3AF).',
    },
  }
  const block = formatStudioUiColorPalettePromptBlock(session)
  assert.match(block, /PRIMARY \/ DOMINANT/i)
  assert.match(block, /SECONDARY \/ SUPPORTING/i)
  assert.match(block, /#FFFFFF/)
  assert.match(block, /MORE prominently than secondary/i)
})

test('resolveStudioColorSelections preserves roles', () => {
  const resolved = resolveStudioColorSelections([
    { key: 'blue', role: 'secondary' },
    { key: 'white', role: 'primary' },
  ])
  assert.equal(resolved.find((item) => item.color.key === 'white')?.role, 'primary')
  assert.equal(resolved.find((item) => item.color.key === 'blue')?.role, 'secondary')
})
