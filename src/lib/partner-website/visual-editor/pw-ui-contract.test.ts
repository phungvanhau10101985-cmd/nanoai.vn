import { describe, expect, it } from 'vitest'
import {
  PW_CAP,
  PW_CHROME_REGIONS,
  PW_EDIT_SLOT,
  PW_EL,
  PW_EL_ATTR,
  PW_EL_VALUES,
  PW_LIVE_DATA_REGIONS,
  PW_LIVE_DOCUMENT_ATTRS,
  PW_LOCKED_REGIONS,
  PW_LOOK,
  PW_LOOK_ATTR,
  PW_PAGE,
  PW_PAGE_ATTR,
  PW_PAGE_BY_CATALOG_KEY,
  PW_PAGE_REGIONS,
  PW_PAGE_VALUES,
  PW_REGION,
  PW_REGION_ATTR,
  PW_REGION_BG_ROLE,
  PW_REGION_ELS,
  PW_REGION_VALUES,
  PW_TOKEN,
  PW_TOKEN_ATTR,
  PW_TOKEN_CSS_VAR,
  PW_TOKEN_VALUES,
  isPwCatalogTitleEl,
  isPwElKind,
  isPwImageLayerRegion,
  isPwLiveDataRegion,
  isPwLockedRegion,
  isPwLookKind,
  isPwPageKind,
  isPwRegionKind,
  isPwTokenKind,
  pageAllowsRegion,
  parsePwEditSlot,
  pwBgRoleForRegion,
  pwCapsOf,
  pwElAttr,
  pwElsForRegion,
  pwHasCap,
  pwIsLiveLocked,
  pwLookAttr,
  pwPageKindOf,
  pwRegionAttr,
  pwTokenAttr,
  regionAllowsEl,
} from './pw-ui-contract'
import { buildVisualEditorScript } from './build-visual-editor-script'

describe('pw ui contract', () => {
  it('exposes stable region and element codes', () => {
    expect(pwRegionAttr(PW_REGION.banner)).toBe('data-pw-region="banner"')
    expect(pwElAttr(PW_EL.copy)).toBe('data-pw-el="copy"')
    expect(PW_REGION_ATTR).toBe('data-pw-region')
    expect(PW_EL_ATTR).toBe('data-pw-el')
    expect(isPwImageLayerRegion(PW_REGION.banner)).toBe(true)
    expect(isPwImageLayerRegion(PW_REGION.catalog)).toBe(false)
    expect(isPwLockedRegion(PW_REGION.catalog)).toBe(true)
    expect(PW_LOCKED_REGIONS).toContain('catalog')
    expect(isPwCatalogTitleEl(PW_EL.sectionTitle)).toBe(true)
  })

  it('keeps baseline home/chrome codes unchanged', () => {
    expect(PW_REGION.header).toBe('header')
    expect(PW_REGION.nav).toBe('nav')
    expect(PW_REGION.banner).toBe('banner')
    expect(PW_REGION.categories).toBe('categories')
    expect(PW_REGION.catalog).toBe('catalog')
    expect(PW_REGION.footer).toBe('footer')
    expect(PW_REGION.promo).toBe('promo')
    expect(PW_REGION.content).toBe('content')
    expect(PW_EL.logo).toBe('logo')
    expect(PW_EL.catToggle).toBe('cat-toggle')
    expect(PW_EL.ctaSecondary).toBe('cta-secondary')
    expect(PW_EL.sectionTitle).toBe('section-title')
    expect(PW_EL.cardBuy).toBe('card-buy')
  })

  it('stamps look codes for every visual face', () => {
    expect(PW_LOOK.shop).toBe('shop')
    expect(PW_LOOK.marketplace).toBe('marketplace')
    expect(PW_LOOK_ATTR).toBe('data-pw-look')
    expect(pwLookAttr(PW_LOOK.shop)).toBe('data-pw-look="shop"')
    expect(isPwLookKind('shop')).toBe(true)
    expect(isPwLookKind('ladipage')).toBe(false)
    expect(PW_LIVE_DOCUMENT_ATTRS).toContain('data-pw-page')
    expect(PW_LIVE_DOCUMENT_ATTRS).toContain('data-pw-look')
    expect(PW_LIVE_DOCUMENT_ATTRS).toContain('data-pw-coordinate-version')
  })

  it('rejects unknown codes', () => {
    expect(isPwPageKind('checkout')).toBe(false)
    expect(isPwRegionKind('hero')).toBe(false)
    expect(isPwElKind('MUA NGAY')).toBe(false)
    expect(isPwTokenKind('--pw-primary')).toBe(false)
    expect(isPwTokenKind('primary')).toBe(true)
    expect(isPwRegionKind('pdp-info')).toBe(true)
    expect(isPwElKind('main-image')).toBe(true)
  })

  it('maps catalog page keys to editor page families', () => {
    expect(pwPageKindOf('home')).toBe(PW_PAGE.home)
    expect(pwPageKindOf('products')).toBe(PW_PAGE.listing)
    expect(pwPageKindOf('collection')).toBe(PW_PAGE.listing)
    expect(pwPageKindOf('product_detail')).toBe(PW_PAGE.product)
    expect(pwPageKindOf('cart')).toBe(PW_PAGE.cart)
    expect(pwPageKindOf('account')).toBe(PW_PAGE.account)
    expect(pwPageKindOf('faq')).toBe(PW_PAGE.info)
    expect(pwPageKindOf('landing')).toBe(PW_PAGE.landing)
    expect(pwPageKindOf('unknown')).toBe(null)
    expect(Object.keys(PW_PAGE_BY_CATALOG_KEY).sort()).toEqual(
      [
        'about',
        'account',
        'addresses',
        'blog',
        'cart',
        'collection',
        'contact',
        'cookie',
        'faq',
        'home',
        'lookbook',
        'order_tracking',
        'orders',
        'payment',
        'privacy',
        'product_detail',
        'products',
        'recently_viewed',
        'returns',
        'sale',
        'shipping',
        'size_guide',
        'stores',
        'terms',
        'thank_you',
        'wishlist',
      ].sort()
    )
  })

  it('covers every page / region / el in the matrices', () => {
    for (const page of PW_PAGE_VALUES) {
      expect(PW_PAGE_REGIONS[page].length).toBeGreaterThan(0)
      for (const region of PW_PAGE_REGIONS[page]) {
        expect(isPwRegionKind(region)).toBe(true)
      }
    }
    const elsInRegions = new Set<string>()
    for (const region of PW_REGION_VALUES) {
      const els = PW_REGION_ELS[region]
      expect(els.length).toBeGreaterThan(0)
      for (const el of els) {
        expect(isPwElKind(el)).toBe(true)
        elsInRegions.add(el)
      }
    }
    expect([...PW_EL_VALUES].sort()).toEqual([...elsInRegions].sort())
  })

  it('keeps chrome on shop pages and listing/product/cart regions distinct', () => {
    for (const page of [PW_PAGE.home, PW_PAGE.listing, PW_PAGE.product, PW_PAGE.cart, PW_PAGE.account, PW_PAGE.info]) {
      for (const chrome of [PW_REGION.header, PW_REGION.nav, PW_REGION.footer]) {
        expect(pageAllowsRegion(page, chrome)).toBe(true)
      }
    }
    expect(pageAllowsRegion(PW_PAGE.listing, PW_REGION.filters)).toBe(true)
    expect(pageAllowsRegion(PW_PAGE.listing, PW_REGION.categories)).toBe(true)
    expect(pageAllowsRegion(PW_PAGE.home, PW_REGION.filters)).toBe(false)
    expect(pageAllowsRegion(PW_PAGE.product, PW_REGION.gallery)).toBe(true)
    expect(pageAllowsRegion(PW_PAGE.cart, PW_REGION.cartList)).toBe(true)
    expect(pageAllowsRegion(PW_PAGE.cart, PW_REGION.form)).toBe(true)
    expect(pageAllowsRegion(PW_PAGE.account, PW_REGION.accountNav)).toBe(true)
    expect(pageAllowsRegion(PW_PAGE.account, PW_REGION.form)).toBe(true)
    expect(pageAllowsRegion(PW_PAGE.info, PW_REGION.content)).toBe(true)
    expect(pageAllowsRegion(PW_PAGE.info, PW_REGION.form)).toBe(true)
    expect(pageAllowsRegion(PW_PAGE.landing, PW_REGION.banner)).toBe(true)
    expect(pageAllowsRegion(PW_PAGE.landing, PW_REGION.content)).toBe(true)
    expect(pageAllowsRegion(PW_PAGE.landing, PW_REGION.catalog)).toBe(true)
    expect(pageAllowsRegion(PW_PAGE.landing, PW_REGION.form)).toBe(true)
    expect(PW_CHROME_REGIONS).toEqual(['header', 'nav', 'topbar', 'footer'])
  })

  it('allows only declared els inside a region', () => {
    expect(regionAllowsEl(PW_REGION.banner, PW_EL.title)).toBe(true)
    expect(regionAllowsEl(PW_REGION.banner, PW_EL.cardPrice)).toBe(false)
    expect(regionAllowsEl(PW_REGION.catalog, PW_EL.cardBuy)).toBe(true)
    expect(regionAllowsEl(PW_REGION.categories, PW_EL.grid)).toBe(true)
    expect(regionAllowsEl(PW_REGION.categories, PW_EL.sectionMore)).toBe(true)
    expect(regionAllowsEl(PW_REGION.header, PW_EL.logo)).toBe(true)
    expect(regionAllowsEl(PW_REGION.content, PW_EL.heading)).toBe(true)
    expect(regionAllowsEl(PW_REGION.content, PW_EL.faqItem)).toBe(true)
    expect(regionAllowsEl(PW_REGION.content, PW_EL.cta)).toBe(true)
    expect(regionAllowsEl(PW_REGION.form, PW_EL.submit)).toBe(true)
    expect(pwElsForRegion('unknown')).toEqual([])
  })

  it('locks live commerce fields and keeps merchant chrome editable', () => {
    expect(pwIsLiveLocked(PW_EL.cardPrice, PW_REGION.catalog)).toBe(true)
    expect(pwIsLiveLocked(PW_EL.card, PW_REGION.catalog)).toBe(true)
    expect(pwIsLiveLocked(PW_EL.cardName, PW_REGION.catalog)).toBe(true)
    expect(pwHasCap(PW_EL.sectionTitle, PW_CAP.text, PW_REGION.catalog)).toBe(true)
    expect(pwIsLiveLocked(PW_EL.sectionTitle, PW_REGION.catalog)).toBe(false)
    expect(pwHasCap(PW_EL.cardName, PW_CAP.text, PW_REGION.categories)).toBe(true)
    expect(pwHasCap(PW_EL.cardMedia, PW_CAP.image, PW_REGION.categories)).toBe(true)
    expect(pwHasCap(PW_EL.title, PW_CAP.text, PW_REGION.banner)).toBe(true)
    expect(pwHasCap(PW_EL.media, PW_CAP.image, PW_REGION.banner)).toBe(true)
    expect(pwHasCap(PW_EL.media, PW_CAP.mediaPan, PW_REGION.banner)).toBe(true)
    expect(pwIsLiveLocked(PW_EL.mainImage, PW_REGION.gallery)).toBe(true)
    expect(pwIsLiveLocked(PW_EL.title, PW_REGION.pdpInfo)).toBe(true)
    expect(pwIsLiveLocked(PW_EL.line, PW_REGION.cartList)).toBe(true)
    expect(pwHasCap(PW_EL.empty, PW_CAP.text, PW_REGION.cartList)).toBe(true)
    expect(pwHasCap(PW_EL.link, PW_CAP.href, PW_REGION.footer)).toBe(true)
    expect(pwHasCap(PW_EL.link, PW_CAP.text, PW_REGION.footer)).toBe(true)
    expect(pwCapsOf('not-an-el')).toEqual([])
    expect(isPwLockedRegion(PW_REGION.gallery)).toBe(false)
    expect(isPwLiveDataRegion(PW_REGION.gallery)).toBe(true)
    expect(PW_LIVE_DATA_REGIONS).toContain(PW_REGION.catalog)
  })

  it('binds tokens to --pw-* and pages/slots to attributes', () => {
    expect(PW_PAGE_ATTR).toBe('data-pw-page')
    expect(PW_TOKEN_ATTR).toBe('data-pw-token')
    expect(pwTokenAttr(PW_TOKEN.buy)).toBe('data-pw-token="buy"')
    expect(PW_TOKEN_VALUES).toHaveLength(10)
    for (const token of PW_TOKEN_VALUES) {
      expect(PW_TOKEN_CSS_VAR[token]).toBe(`--pw-${token}`)
    }
    expect(pwBgRoleForRegion(PW_REGION.banner)).toBe('banner')
    expect(pwBgRoleForRegion(PW_REGION.gallery)).toBe('gallery')
    expect(pwBgRoleForRegion(PW_REGION.content)).toBe('content')
    expect(pwBgRoleForRegion(PW_REGION.form)).toBe('form')
    expect(pwBgRoleForRegion(PW_REGION.nav)).toBe(null)
    expect(pwBgRoleForRegion(PW_REGION.topbar)).toBe(null)
    expect(PW_REGION_BG_ROLE[PW_REGION.header]).toBe('header')
    expect(parsePwEditSlot(PW_EDIT_SLOT.heroTitle)).toEqual({ name: 'heroTitle', index: null })
    expect(parsePwEditSlot('categoryName:2')).toEqual({ name: 'categoryName', index: 2 })
    expect(parsePwEditSlot('')).toBe(null)
  })

  it('visual editor prefers contract codes over heuristics', () => {
    const s = buildVisualEditorScript('vi')
    expect(s).toContain('function hoverNameOf')
    expect(s).toContain('nanoai-ve-hover-name')
    expect(s).toContain("d.type === 'setHoverNameOn'")
    expect(s).toContain('stampPwUiContract')
    expect(s).toContain("classList.add('pw-nav-sale')")
    expect(s).toContain('data-pw-region')
    expect(s).toContain('data-pw-el')
    expect(s).toContain("pwRegionOf")
    expect(s).toContain("=== 'banner'")
    expect(s).toContain("=== 'catalog'")
    expect(s).toContain("=== 'header'")
    expect(s).toContain("pwElOf(el) === 'card'")
    expect(s).toContain("pwElOf(el) === 'copy'")
    expect(s).toContain("markClosestSection")
    expect(s).toContain('[data-pw-edit="heroImage"]')
    expect(s).toContain('[data-pw-edit="newArrivalsTitle"]')
    expect(s).toContain('bannerLayerTarget')
    expect(s).toContain("mode === 'image'")
    expect(s).toContain('layerUnitOf')
    expect(s).toContain('layerPromoteHost')
    expect(s).toContain('listLayerPack')
    expect(s).toContain('elementLayerPos')
    expect(s).toContain("d.type === 'layerElFront'")
    expect(s).toContain("if (layerMode === 'block') return banner")
    expect(s).toContain('.nanoai-ve-highlight[data-pw-region="banner"]')
    expect(s).toContain('ensureMoveBlock(blocks[i])')
    expect(s).toContain('isBannerContentEl')
    expect(s).toContain("cta-secondary")
    expect(s).toContain('photoSrcOf(el)')
    expect(s).toContain('function photoSrcOf')
    expect(s).toContain('applyBannerPhoto')
    expect(s).toContain('parseBannerZoom')
    expect(s).toContain('data-pw-banner-zoom')
    expect(s).toContain('is-banner-zoom')
    expect(s).toContain('isBannerPhoto')
    expect(s).toContain('bannerZoom')
    expect(s).toContain("d.type === 'setBannerZoom'")
    expect(s).toContain('isBannerLeafEl')
    expect(s).toContain('containsForeignShopRegion')
    expect(s).toContain('repairMisidentifiedBannerHosts')
    expect(s).toContain('resolvePointerTarget')
    expect(s).toContain('findCategoriesSelectable')
    expect(s).toContain('nanoai-ve-photo-edit')
    expect(s).toContain('syncBannerPhotoEdit')
    expect(s).toContain('.pw-shop-filters')
    expect(s).toContain('.pw-shop-toolbar')
    expect(s).toContain('.pw-shop-breadcrumb')
    expect(s).toContain("data-pw-region', 'topbar'")
    expect(s).toContain('.pw-shop-price')
    expect(s).toContain('card-buy')
    expect(s).toContain('.pw-shop-product-gallery')
    expect(s).toContain('.pw-shop-pdp-info')
    expect(s).toContain('.pw-shop-reviews')
    expect(s).toContain("data-pw-region', 'gallery'")
    expect(s).toContain("data-pw-region', 'pdp-info'")
    expect(s).toContain("data-pw-el', 'main-image'")
    expect(s).toContain('.pw-shop-cart-list')
    expect(s).toContain('.pw-shop-cart-summary')
    expect(s).toContain("data-pw-region', 'cart-list'")
    expect(s).toContain("data-pw-region', 'cart-summary'")
    expect(s).toContain('.pw-shop-account-sidebar')
    expect(s).toContain("data-pw-region', 'account-nav'")
    expect(s).toContain("data-pw-region', 'account-main'")
    expect(s).toContain("data-pw-el', 'menu-item'")
    expect(s).toContain('.pw-footer-col, .pw-shop-footer-col')
    expect(s).toContain("data-pw-el', 'link'")
    expect(s).toContain("data-pw-el', 'col'")
    expect(s).toContain('.pw-shop-info')
    expect(s).toContain("data-pw-region', 'content'")
    expect(s).toContain('.pw-lead-form')
    expect(s).toContain('[data-lp-section="hero"]')
    expect(s).toContain('[data-lp-section="faq"]')
    expect(s).toContain("data-pw-el', 'faq-item'")
    expect(s).toContain('ownPwRegion')
    expect(s).toContain("ownPwRegion(el) === 'banner'")
    expect(s).toContain('[data-pw-el="card-cart"]')
    expect(s).not.toContain('thêm vào giỏ|add to cart|mua ngay')
    expect(s).not.toContain('r.width < 420 || r.height < 140 || r.height > 780')
    expect(s).toContain('data-pw-bg-role')
    expect(s).toContain('[data-pw-region="\' + role + \'"]')
  })
})
