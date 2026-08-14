import { describe, expect, it } from 'vitest'
import { buildLogoSlotPrompt, logoAspectFromSize, mergeLogoSlotPrompt } from './build-logo-slot-prompt'
import { collectHttpImageUrls } from './logo-generation-context'

describe('buildLogoSlotPrompt', () => {
  it('puts white background and header size into the prompt', () => {
    const p = buildLogoSlotPrompt({
      shopTitle: '188.com.vn',
      slot: 'header',
      device: 'desktop',
      bgColor: 'rgb(255, 255, 255)',
      width: 140,
      height: 36,
    })
    expect(p).toContain('188.com.vn')
    expect(p).toContain('desktop header')
    expect(p).toContain('#ffffff')
    expect(p).toContain('white')
    expect(p).toContain('140x36px')
    expect(p).toContain('4:1')
    expect(p).toContain('wide wordmark')
  })

  it('includes shop primary color and surrounding background image', () => {
    const p = buildLogoSlotPrompt({
      shopTitle: '188.com.vn',
      slot: 'header',
      device: 'desktop',
      bgColor: '#ffffff',
      width: 140,
      height: 36,
      primaryColor: '#f97316',
      accentColor: '#ea580c',
      buyButtonColor: '#c2410c',
      bgImageUrl: 'https://cdn.example.com/header-bg.jpg',
    })
    expect(p).toContain('#f97316')
    expect(p).toContain('dominant/primary')
    expect(p).toContain('#ea580c')
    expect(p).toContain('#c2410c')
    expect(p).toContain('surrounding background area')
  })

  it('describes a dark mobile footer', () => {
    const p = buildLogoSlotPrompt({
      shopTitle: 'Shop',
      slot: 'footer',
      device: 'mobile',
      bgColor: '#111111',
      width: 80,
      height: 80,
    })
    expect(p).toContain('mobile footer')
    expect(p).toContain('#111111')
    expect(p).toContain('black')
    expect(p).toContain('compact mark')
  })

  it('appends color facts when the user prompt omits them', () => {
    const merged = mergeLogoSlotPrompt('chữ 188 tối giản', {
      shopTitle: '188.com.vn',
      slot: 'header',
      device: 'desktop',
      bgColor: '#ffffff',
      width: 140,
      height: 36,
      primaryColor: '#f97316',
    })
    expect(merged.startsWith('chữ 188 tối giản')).toBe(true)
    expect(merged).toContain('#ffffff')
    expect(merged).toContain('#f97316')
  })
})

describe('collectHttpImageUrls', () => {
  it('keeps unique http urls', () => {
    expect(
      collectHttpImageUrls(['https://a.com/x.png', 'data:image/png;base64,xx', 'https://a.com/x.png', ''])
    ).toEqual(['https://a.com/x.png'])
  })
})

describe('logoAspectFromSize', () => {
  it('maps the drawn frame to the closest Gemini ratio', () => {
    expect(logoAspectFromSize(40, 40)).toBe('1:1')
    expect(logoAspectFromSize(120, 80)).toBe('3:2')
    expect(logoAspectFromSize(80, 120)).toBe('2:3')
    expect(logoAspectFromSize(160, 90)).toBe('16:9')
    expect(logoAspectFromSize(210, 90)).toBe('21:9')
    expect(logoAspectFromSize(140, 36)).toBe('4:1')
    expect(logoAspectFromSize(160, 36)).toBe('4:1')
    expect(logoAspectFromSize(200, 24)).toBe('8:1')
    expect(logoAspectFromSize(36, 160)).toBe('9:16')
  })
})
