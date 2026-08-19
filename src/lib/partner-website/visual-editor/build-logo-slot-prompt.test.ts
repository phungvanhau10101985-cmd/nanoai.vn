import { describe, expect, it } from 'vitest'
import { buildLogoSlotPrompt, logoAspectFromSize, logoSizeFromAspect, mergeLogoSlotPrompt } from './build-logo-slot-prompt'
import { collectHttpImageUrls, logoColorSwatchSize } from './logo-generation-context'

describe('buildLogoSlotPrompt', () => {
  it('puts user-picked background and header size into the prompt', () => {
    const p = buildLogoSlotPrompt({
      shopTitle: '188.com.vn',
      slot: 'header',
      device: 'desktop',
      bgColor: 'rgb(255, 255, 255)',
      inkColor: '#111827',
      width: 140,
      height: 36,
    })
    expect(p).toContain('188.com.vn')
    expect(p).toContain('desktop header')
    expect(p).toContain('#ffffff')
    expect(p).toContain('#111827')
    expect(p).toContain('two colors the user picked')
    expect(p).toContain('flat fill')
    expect(p).toContain('edge to edge')
    expect(p).toContain('letterboxing')
    expect(p).toContain('transparent PNG')
    expect(p).toContain('140x36px')
    expect(p).toContain('21:9')
    expect(p).toContain('Chosen frame')
    expect(p).toContain('WIDE WORDMARK')
  })

  it('does not pull shop theme or header photo colors into the prompt', () => {
    const p = buildLogoSlotPrompt({
      shopTitle: '188.com.vn',
      slot: 'header',
      device: 'desktop',
      bgColor: '#ffffff',
      inkColor: '#111827',
      width: 140,
      height: 36,
    })
    expect(p).toContain('#ffffff')
    expect(p).toContain('#111827')
    expect(p).toContain('Do not sample colors from the shop UI')
    expect(p).not.toContain('shop interface color')
    expect(p).not.toContain('real slot is attached')
    expect(p).not.toContain('#f97316')
    expect(p).not.toContain('#ea580c')
  })

  it('uses only the ink the user picked on a colored header', () => {
    const p = buildLogoSlotPrompt({
      shopTitle: '188.com.vn',
      slot: 'header',
      device: 'mobile',
      bgColor: '#c2410c',
      inkColor: '#ffffff',
      width: 72,
      height: 36,
    })
    expect(p).toContain('#c2410c')
    expect(p).toContain('#ffffff')
    expect(p).toContain('user picked logo ink #ffffff')
    expect(p).not.toContain('shop interface color')
    expect(p).not.toContain('White glyphs')
  })

  it('stacks a square lockup instead of a thin horizontal strip', () => {
    const p = buildLogoSlotPrompt({
      shopTitle: '188.com.vn',
      slot: 'header',
      device: 'desktop',
      bgColor: '#c2410c',
      inkColor: '#ffffff',
      aspectRatio: '1:1',
      width: 64,
      height: 64,
    })
    expect(p).toContain('1:1')
    expect(p).toContain('SQUARE LOCKUP')
    expect(p).toContain('ABOVE the wordmark')
    expect(p).toContain('85%')
    expect(p).toContain('Forbidden: a wide horizontal strip')
    expect(p).toContain('white or cream footer band')
    expect(p).not.toContain('WIDE WORDMARK')
    expect(p).not.toContain('compact mark')
  })

  it('describes a dark mobile footer with user-picked colors', () => {
    const p = buildLogoSlotPrompt({
      shopTitle: 'Shop',
      slot: 'footer',
      device: 'mobile',
      bgColor: '#111111',
      inkColor: '#ffffff',
      width: 80,
      height: 80,
    })
    expect(p).toContain('mobile footer')
    expect(p).toContain('#111111')
    expect(p).toContain('#ffffff')
    expect(p).toContain('SQUARE LOCKUP')
  })

  it('keeps a short user request and still appends the hidden technical prompt', () => {
    const merged = mergeLogoSlotPrompt('chữ 188 tối giản', {
      shopTitle: '188.com.vn',
      slot: 'header',
      device: 'desktop',
      bgColor: '#ffffff',
      inkColor: '#c2410c',
      width: 140,
      height: 36,
    })
    expect(merged.startsWith('chữ 188 tối giản')).toBe(true)
    expect(merged).toContain('desktop header')
    expect(merged).toContain('#ffffff')
    expect(merged).toContain('#c2410c')
    expect(merged).not.toContain('#f97316')
  })

  it('uses the ink color the user picked, even on a colored header', () => {
    const p = buildLogoSlotPrompt({
      shopTitle: '188.com.vn',
      slot: 'header',
      device: 'mobile',
      bgColor: '#c2410c',
      inkColor: '#111827',
      aspectRatio: '16:9',
      width: 120,
      height: 30,
    })
    expect(p).toContain('#c2410c')
    expect(p).toContain('#111827')
    expect(p).toContain('user picked logo ink #111827')
    expect(p).not.toContain('White glyphs')
  })

  it('uses only the hidden technical prompt when the user leaves the request empty', () => {
    const merged = mergeLogoSlotPrompt('  ', {
      shopTitle: '188.com.vn',
      slot: 'footer',
      device: 'desktop',
      bgColor: '#ffffff',
      inkColor: '#111827',
      width: 118,
      height: 50,
    })
    expect(merged).toContain('Website logo for')
    expect(merged).toContain('desktop footer')
  })
})

describe('collectHttpImageUrls', () => {
  it('keeps unique http urls', () => {
    expect(
      collectHttpImageUrls(['https://a.com/x.png', 'data:image/png;base64,xx', 'https://a.com/x.png', ''])
    ).toEqual(['https://a.com/x.png'])
  })
})

describe('logoColorSwatchSize', () => {
  it('makes a square chip for 1:1 so Gemini does not letterbox a 512x160 strip', () => {
    const s = logoColorSwatchSize('1:1')
    expect(s.w).toBe(s.h)
    expect(s.w).toBe(512)
  })

  it('keeps a wide chip for 16:9', () => {
    const s = logoColorSwatchSize('16:9')
    expect(s.w / s.h).toBeCloseTo(16 / 9, 1)
    expect(s.h).toBeLessThan(s.w)
  })
})

describe('logoSizeFromAspect', () => {
  it('keeps the chosen ratio inside a header-sized box', () => {
    const box = logoSizeFromAspect('16:9', 'mobile')
    expect(box.w / box.h).toBeCloseTo(16 / 9, 1)
    expect(box.w).toBeGreaterThanOrEqual(24)
    expect(box.h).toBeLessThanOrEqual(52)
  })
})

describe('logoAspectFromSize', () => {
  it('maps the drawn frame to the closest Gemini ratio', () => {
    expect(logoAspectFromSize(40, 40)).toBe('1:1')
    expect(logoAspectFromSize(120, 80)).toBe('3:2')
    expect(logoAspectFromSize(80, 120)).toBe('2:3')
    expect(logoAspectFromSize(160, 90)).toBe('16:9')
    expect(logoAspectFromSize(210, 90)).toBe('21:9')
    expect(logoAspectFromSize(140, 36)).toBe('21:9')
    expect(logoAspectFromSize(160, 36)).toBe('21:9')
    expect(logoAspectFromSize(200, 24)).toBe('21:9')
    expect(logoAspectFromSize(36, 160)).toBe('9:16')
  })
})
