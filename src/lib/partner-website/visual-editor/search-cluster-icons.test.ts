import { describe, expect, it } from 'vitest'
import {
  normalizeSearchGlyph,
  searchGlyphPath,
  searchGlyphPathsJs,
  searchGlyphSvg,
} from './search-cluster-icons'

describe('search cluster icons', () => {
  it('normalizes unknown camera/lens glyphs', () => {
    expect(normalizeSearchGlyph('camera', 'nope')).toBe('camera')
    expect(normalizeSearchGlyph('lens', 'nope')).toBe('lens')
    expect(normalizeSearchGlyph('camera', 'scan')).toBe('scan')
    expect(normalizeSearchGlyph('lens', 'lens-plus')).toBe('lens-plus')
  })

  it('emits sized svg that does not use emoji', () => {
    const camera = searchGlyphSvg('camera')
    const lens = searchGlyphSvg('lens')
    expect(camera).toContain('viewBox="0 0 24 24"')
    expect(camera).toContain('width="16"')
    expect(camera).not.toContain('📷')
    expect(lens).toContain('pw-shop-search-submit-icon')
    expect(searchGlyphPath('photo').length).toBeGreaterThan(10)
  })

  it('exports a JS map for the editor script', () => {
    const js = searchGlyphPathsJs()
    expect(js).toContain('"camera"')
    expect(js).toContain('"lens-spark"')
  })
})
