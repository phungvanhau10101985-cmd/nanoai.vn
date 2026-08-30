import { describe, expect, it } from 'vitest'
import {
  ensureSearchClusterInHtml,
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
    expect(searchGlyphSvg('lens', 'pw-search-default-glyph')).not.toContain('pw-shop-search-submit-icon')
    expect(searchGlyphPath('photo').length).toBeGreaterThan(10)
  })

  it('exports a JS map for the editor script', () => {
    const js = searchGlyphPathsJs()
    expect(js).toContain('"camera"')
    expect(js).toContain('"lens-spark"')
  })

  it('ensures left default lens, image-search, and one submit svg', () => {
    const html = `<form class="pw-search-form" data-pw-search-form>
      <input data-pw-search type="search" name="q"/>
      <button type="submit" class="pw-search-submit">Tìm</button>
    </form>`
    const next = ensureSearchClusterInHtml(html)
    expect(next).toContain('pw-search-default-icon')
    expect(next).toContain('pw-search-default-glyph')
    expect(next).toContain('data-pw-image-search')
    expect(next).toContain('data-pw-search-glyph="camera"')
    expect(next).toMatch(/pw-search-submit[\s\S]*<svg/)
    expect(ensureSearchClusterInHtml(next)).toBe(next)
  })
})
