import { describe, expect, it } from 'vitest'
import {
  clampHeaderLogoOffsetX,
  clampHeaderLogoOffsetY,
  PW_LOGO_X_ATTR,
  PW_LOGO_X_MAX,
  PW_LOGO_X_MIN,
  PW_LOGO_Y_ATTR,
  stampHeaderLogoOffsetInHtml,
  withBrandLogoOffsetStyle,
} from '@/lib/partner-website/shop/header-logo-offset'
import { ensurePartnerSiteChromeKitInHtml } from '@/lib/partner-website/shop/partner-site-chrome-kit'

describe('header logo offset', () => {
  it('clamps x/y independently', () => {
    expect(clampHeaderLogoOffsetX(-999)).toBe(PW_LOGO_X_MIN)
    expect(clampHeaderLogoOffsetX(PW_LOGO_X_MAX + 8)).toBe(PW_LOGO_X_MAX)
    expect(clampHeaderLogoOffsetY(-999)).toBe(-120)
    expect(clampHeaderLogoOffsetY(12.6)).toBe(13)
  })

  it('stamps css vars on header brand only', () => {
    const html = `<header class="pw-header"><a class="pw-brand" href="/" ${PW_LOGO_X_ATTR}="24" ${PW_LOGO_Y_ATTR}="-8"><img class="pw-logo" alt=""/></a></header><footer><a class="pw-brand" href="/"><img alt="f"/></a></footer>`
    const next = stampHeaderLogoOffsetInHtml(html)
    expect(next).toContain(`${PW_LOGO_X_ATTR}="24"`)
    expect(next).toContain(`${PW_LOGO_Y_ATTR}="-8"`)
    expect(next).toContain('--pw-logo-x:24px')
    expect(next).toContain('--pw-logo-y:-8px')
    const footer = next.slice(next.indexOf('<footer'))
    expect(footer).not.toContain('--pw-logo-x')
  })

  it('does not invent 0,0 on a plain brand', () => {
    const html = '<header class="pw-header"><a class="pw-brand" href="/">Shop</a></header>'
    const next = stampHeaderLogoOffsetInHtml(html)
    expect(next).not.toContain(PW_LOGO_X_ATTR)
    expect(next).not.toContain('--pw-logo-x')
  })

  it('reads leftover css var when attr is missing', () => {
    const next = withBrandLogoOffsetStyle(' class="pw-brand" style="--pw-logo-x:16px"')
    expect(next).toContain(`${PW_LOGO_X_ATTR}="16"`)
    expect(next).toContain('--pw-logo-x:16px')
    expect(next).not.toContain(PW_LOGO_Y_ATTR)
  })

  it('ensure chrome kit keeps per-device logo offset on the brand', () => {
    const html = `<header class="pw-header"><div class="pw-header-main"><div class="pw-brand-cluster"><a class="pw-brand" href="/" ${PW_LOGO_X_ATTR}="32"><img class="pw-logo" alt=""/></a></div><div class="pw-header-actions"><a data-pw-chrome-btn="cart" href="/cart">Giỏ</a></div></div></header>`
    const next = ensurePartnerSiteChromeKitInHtml(html, { locale: 'vi', siteSlug: 'demo-shop', device: 'mobile' })
    expect(next).toContain(`${PW_LOGO_X_ATTR}="32"`)
    expect(next).toContain('--pw-logo-x:32px')
  })
})
