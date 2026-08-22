import { describe, expect, it } from 'vitest'
import {
  canPickChromeGlyph,
  chromeGlyphCatalogJs,
  chromeGlyphsForKind,
  chromeGlyphSvg,
  defaultChromeGlyph,
  normalizeChromeGlyph,
} from './chrome-widget-icons'

describe('chrome widget icons', () => {
  it('offers several glyphs for shop feature buttons', () => {
    expect(canPickChromeGlyph('home')).toBe(true)
    expect(canPickChromeGlyph('cart')).toBe(true)
    expect(canPickChromeGlyph('categories')).toBe(true)
    expect(chromeGlyphsForKind('home').length).toBeGreaterThanOrEqual(4)
    expect(chromeGlyphsForKind('account').length).toBeGreaterThanOrEqual(4)
    expect(defaultChromeGlyph('home')).toBe('home')
  })

  it('does not swap Chat mua / Zalo / Facebook / search cluster icons', () => {
    expect(canPickChromeGlyph('chat')).toBe(false)
    expect(canPickChromeGlyph('chat-zalo')).toBe(false)
    expect(canPickChromeGlyph('chat-facebook')).toBe(false)
    expect(canPickChromeGlyph('chat-instagram')).toBe(false)
    expect(canPickChromeGlyph('chat-whatsapp')).toBe(false)
    expect(canPickChromeGlyph('search')).toBe(false)
    expect(canPickChromeGlyph('search-image')).toBe(false)
  })

  it('normalizes unknown glyphs to the kind default', () => {
    expect(normalizeChromeGlyph('cart', 'nope')).toBe('cart')
    expect(normalizeChromeGlyph('cart', 'bag')).toBe('bag')
    expect(normalizeChromeGlyph('chat', 'heart')).toBe('')
  })

  it('emits sized svg without emoji', () => {
    const svg = chromeGlyphSvg('home')
    expect(svg).toContain('viewBox="0 0 24 24"')
    expect(svg).toContain('width="20"')
    expect(svg).not.toContain('🏠')
  })

  it('exports a JS catalog for the editor script', () => {
    const js = chromeGlyphCatalogJs()
    expect(js).toContain('"home"')
    expect(js).toContain('"home-door"')
    expect(js).toContain('"kinds"')
  })
})
