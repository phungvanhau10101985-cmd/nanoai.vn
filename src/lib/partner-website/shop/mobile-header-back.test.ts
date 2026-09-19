import { describe, expect, it } from 'vitest'
import {
  buildMobileHeadBackHtml,
  ensureMobileHeadBackInHtml,
  htmlHasMobileHeadBack,
  isMobileHeadBackTarget,
  isPartnerShopHeadBackFace,
  PARTNER_SHOP_MOBILE_HEAD_BACK_SCRIPT,
  PW_MOBILE_HEAD_BACK_CSS,
} from '@/lib/partner-website/shop/mobile-header-back'
import { buildPartnerSiteHeaderHtml } from '@/lib/partner-website/shop/build-partner-site-header-html'
import { ensurePartnerSiteChromeKitInHtml } from '@/lib/partner-website/shop/partner-site-chrome-kit'

describe('mobile header back', () => {
  it('stamps the button before categories on tablet factory HTML', () => {
    const { header } = buildPartnerSiteHeaderHtml({
      locale: 'vi',
      title: 'Demo',
      siteSlug: 'demo-shop',
      device: 'tablet',
    })
    expect(htmlHasMobileHeadBack(header)).toBe(true)
    expect(header.indexOf('data-pw-chrome-btn="back"')).toBeLessThan(
      header.indexOf('data-pw-chrome-btn="categories"')
    )
  })

  it('stamps the button before categories on mobile factory HTML', () => {
    const { header } = buildPartnerSiteHeaderHtml({
      locale: 'vi',
      title: 'Demo',
      siteSlug: 'demo-shop',
      device: 'mobile',
    })
    expect(htmlHasMobileHeadBack(header)).toBe(true)
    expect(header.indexOf('data-pw-chrome-btn="back"')).toBeLessThan(
      header.indexOf('data-pw-chrome-btn="categories"')
    )
    expect(header).toContain('aria-label="Quay lại"')
  })

  it('treats mobile and tablet as back targets, not desktop or laptop', () => {
    expect(isMobileHeadBackTarget('<html></html>', 'desktop')).toBe(false)
    expect(isMobileHeadBackTarget('<html></html>', 'laptop')).toBe(false)
    expect(isMobileHeadBackTarget('<html></html>', 'tablet')).toBe(true)
    expect(isMobileHeadBackTarget('<html data-pw-edit-device="mobile"></html>')).toBe(true)
    expect(isMobileHeadBackTarget('<html data-pw-edit-device="tablet"></html>')).toBe(true)
    expect(isPartnerShopHeadBackFace({ editDevice: 'tablet' })).toBe(true)
    expect(isPartnerShopHeadBackFace({ editDevice: 'desktop', viewportCompact: true })).toBe(false)
    expect(isPartnerShopHeadBackFace({ viewportCompact: true })).toBe(true)
  })

  it('ensure inserts the button only on mobile files missing it', () => {
    const html = `<html data-pw-edit-device="mobile"><body><header class="pw-header">
      <div class="pw-brand-cluster">
        <button type="button" data-pw-chrome-btn="categories">Danh mục</button>
      </div>
    </header></body></html>`
    const mobile = ensureMobileHeadBackInHtml(html, { locale: 'vi', device: 'mobile' })
    expect(mobile).toContain('data-pw-chrome-btn="back"')
    expect(mobile.indexOf('data-pw-chrome-btn="back"')).toBeLessThan(
      mobile.indexOf('data-pw-chrome-btn="categories"')
    )
    const again = ensureMobileHeadBackInHtml(mobile, { locale: 'vi', device: 'mobile' })
    expect((again.match(/data-pw-chrome-btn="back"/g) || []).length).toBe(1)

    const tablet = ensureMobileHeadBackInHtml(html.replace('mobile', 'tablet'), {
      locale: 'vi',
      device: 'tablet',
    })
    expect(tablet).toContain('data-pw-chrome-btn="back"')
    expect(tablet.indexOf('data-pw-chrome-btn="back"')).toBeLessThan(
      tablet.indexOf('data-pw-chrome-btn="categories"')
    )

    const desktop = ensureMobileHeadBackInHtml(html.replace('mobile', 'desktop'), {
      locale: 'vi',
      device: 'desktop',
    })
    expect(desktop).not.toContain('data-pw-chrome-btn="back"')
  })

  it('chrome kit ensure seeds the mobile and tablet back button', () => {
    const html = `<header class="pw-header"><div class="pw-header-main"><div class="pw-brand-cluster">
      <button type="button" data-pw-chrome-btn="categories">Danh mục</button>
      <a class="pw-brand" href="/">Shop</a>
    </div><div class="pw-header-actions"><a data-pw-chrome-btn="cart" href="/cart">Giỏ</a></div></div></header>`
    const next = ensurePartnerSiteChromeKitInHtml(html, {
      locale: 'vi',
      siteSlug: 'demo-shop',
      device: 'mobile',
    })
    expect(next).toContain('data-pw-chrome-btn="back"')
    expect(next).toContain('data-pw-head-back="1"')
    const tabletKit = ensurePartnerSiteChromeKitInHtml(html, {
      locale: 'vi',
      siteSlug: 'demo-shop',
      device: 'tablet',
    })
    expect(tabletKit).toContain('data-pw-chrome-btn="back"')
  })

  it('hides by default and shows on mobile and tablet non-home', () => {
    expect(PW_MOBILE_HEAD_BACK_CSS).toContain('[data-pw-chrome-btn="back"],[data-pw-head-back]{display:none!important}')
    expect(PW_MOBILE_HEAD_BACK_CSS).toContain(':not([data-pw-page="home"])')
    expect(PW_MOBILE_HEAD_BACK_CSS).toContain('max-width:767px')
    expect(PW_MOBILE_HEAD_BACK_CSS).toContain('data-pw-edit-device="tablet"')
    expect(PW_MOBILE_HEAD_BACK_CSS).toContain('min-width:768px) and (max-width:1079px')
    expect(PW_MOBILE_HEAD_BACK_CSS).toContain('max-resolution:1.24dppx')
  })

  it('clicks previous page and skips the visual editor', () => {
    expect(PARTNER_SHOP_MOBILE_HEAD_BACK_SCRIPT).toContain('history.back')
    expect(PARTNER_SHOP_MOBILE_HEAD_BACK_SCRIPT).toContain('nanoai-ve-active')
    expect(PARTNER_SHOP_MOBILE_HEAD_BACK_SCRIPT).not.toContain('</script>')
    expect(buildMobileHeadBackHtml({ locale: 'en' })).toContain('aria-label="Back"')
  })
})
