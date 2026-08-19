import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

function readShop(rel: string) {
  return readFileSync(join(here, rel), 'utf8')
}

describe('listing native UI contract stamps', () => {
  it('does not ship default Chat mua or NanoAI FAB in header template', () => {
    const src = readShop('build-partner-site-header-html.ts')
    expect(src).not.toContain('buildPartnerSiteChatMuaButtonHtml')
    expect(src).not.toContain('pw-fab-chat')

    const template = readShop('../template/render-template-html.ts')
    expect(template).not.toContain('class="pw-fab-chat pw-chat-open"')

    const widgets = readShop('../visual-editor/chrome-widgets.ts')
    expect(widgets).toContain('buildPartnerSiteChatMuaButtonHtml')
    expect(widgets).toContain('data-pw-chrome-btn="${kind}"')
    expect(widgets).toContain('data-nanoai-open-chat')
    expect(widgets).toContain('pw-chrome-chat-logo')
  })

  it('stamps header HTML topbar and nav links', () => {
    const src = readShop('build-partner-site-header-html.ts')
    expect(src).toContain('pwRegionAttr(PW_REGION.topbar)')
    expect(src).toContain('pwElAttr(PW_EL.link)')
    expect(src).toContain('pwElAttr(PW_EL.navLink)')
    expect(src).toContain('data-pw-chrome-btn="account"')
    expect(src).not.toContain('data-pw-account-toggle')
  })

  it('stamps React catalog and category listing regions', () => {
    const catalog = readFileSync(
      join(here, '../../../components/partner-website/shop/partner-site-shop-catalog-client.tsx'),
      'utf8'
    )
    expect(catalog).toContain('data-pw-region={PW_REGION.catalog}')
    expect(catalog).toContain('data-pw-region={PW_REGION.toolbar}')
    expect(catalog).toContain('data-pw-el={PW_EL.sectionTitle}')
    expect(catalog).toContain('data-pw-el={PW_EL.cardBuy}')
    expect(catalog).toContain('data-pw-el={PW_EL.cardPrice}')

    const category = readFileSync(
      join(here, '../../../components/partner-website/shop/partner-site-category-products-client.tsx'),
      'utf8'
    )
    expect(category).toContain('data-pw-region={PW_REGION.filters}')
    expect(category).toContain('data-pw-region={PW_REGION.toolbar}')
    expect(category).toContain('data-pw-el={PW_EL.facet}')
    expect(category).toContain('data-pw-el={PW_EL.sort}')
    expect(category).toContain('data-pw-el={PW_EL.cardBuy}')
  })

  it('stamps React PDP gallery, buy box, reviews, and related catalog', () => {
    const pdp = readFileSync(
      join(here, '../../../components/partner-website/shop/partner-site-shop-product-client.tsx'),
      'utf8'
    )
    expect(pdp).toContain('data-pw-region={PW_REGION.gallery}')
    expect(pdp).toContain('data-pw-region={PW_REGION.pdpInfo}')
    expect(pdp).toContain('data-pw-el={PW_EL.mainImage}')
    expect(pdp).toContain('data-pw-el={PW_EL.price}')
    expect(pdp).toContain('data-pw-el={PW_EL.buy}')
    expect(pdp).toContain('data-pw-el={PW_EL.cardCart}')
    expect(pdp).toContain('data-pw-el={PW_EL.wishlist}')
    expect(pdp).toContain('data-pw-region={PW_REGION.catalog}')

    const reviews = readFileSync(
      join(here, '../../../components/partner-website/shop/partner-site-product-reviews-qa.tsx'),
      'utf8'
    )
    expect(reviews).toContain('data-pw-region={PW_REGION.reviews}')
    expect(reviews).toContain('data-pw-el={PW_EL.sectionTitle}')
    expect(reviews).toContain('data-pw-el={PW_EL.cardName}')
    expect(reviews).toContain('data-pw-el={PW_EL.body}')
  })

  it('stamps React cart list, summary, and checkout form', () => {
    const cart = readFileSync(
      join(here, '../../../components/partner-website/shop/partner-site-shop-cart-client.tsx'),
      'utf8'
    )
    expect(cart).toContain('data-pw-region={PW_REGION.cartList}')
    expect(cart).toContain('data-pw-region={PW_REGION.cartSummary}')
    expect(cart).toContain('data-pw-region={PW_REGION.form}')
    expect(cart).toContain('data-pw-el={PW_EL.line}')
    expect(cart).toContain('data-pw-el={PW_EL.remove}')
    expect(cart).toContain('data-pw-el={PW_EL.coupon}')
    expect(cart).toContain('data-pw-el={PW_EL.checkout}')
    expect(cart).toContain('data-pw-el={PW_EL.empty}')
  })

  it('stamps React account nav, main, and related account pages', () => {
    const account = readFileSync(
      join(here, '../../../components/partner-website/shop/partner-site-shop-account-client.tsx'),
      'utf8'
    )
    expect(account).toContain('data-pw-region={PW_REGION.accountNav}')
    expect(account).toContain('data-pw-region={PW_REGION.accountMain}')
    expect(account).toContain('data-pw-el={PW_EL.menuItem}')
    expect(account).toContain('data-pw-region={PW_REGION.form}')

    const saved = readFileSync(
      join(here, '../../../components/partner-website/shop/partner-site-shop-saved-products-client.tsx'),
      'utf8'
    )
    expect(saved).toContain('data-pw-region={PW_REGION.catalog}')
    expect(saved).toContain('data-pw-el={PW_EL.cardCart}')

    const addresses = readFileSync(
      join(here, '../../../components/partner-website/shop/partner-site-shop-addresses-client.tsx'),
      'utf8'
    )
    expect(addresses).toContain('data-pw-region={PW_REGION.accountMain}')
    expect(addresses).toContain('data-pw-el={PW_EL.submit}')

    const orders = readFileSync(
      join(here, '../../../components/partner-website/shop/partner-site-shop-orders-client.tsx'),
      'utf8'
    )
    expect(orders).toContain('data-pw-region={PW_REGION.accountMain}')
    expect(orders).toContain('data-pw-el={PW_EL.card}')
  })

  it('stamps React info, CMS page, landing, and template content/form', () => {
    const info = readFileSync(
      join(here, '../../../components/partner-website/shop/partner-site-shop-info-view.tsx'),
      'utf8'
    )
    expect(info).toContain('data-pw-region={PW_REGION.content}')
    expect(info).toContain('data-pw-el={PW_EL.heading}')
    expect(info).toContain('data-pw-el={PW_EL.body}')
    expect(info).toContain('data-pw-el={PW_EL.faqItem}')
    expect(info).toContain('data-pw-el={PW_EL.cta}')

    const cms = readFileSync(
      join(here, '../../../app/site/[slug]/pages/[pageSlug]/page.tsx'),
      'utf8'
    )
    expect(cms).toContain('pageKind={PW_PAGE.info}')
    expect(cms).toContain('data-pw-region={PW_REGION.content}')

    const landing = readFileSync(
      join(here, '../../../components/partner-website/landing/landing-ai-sections-view.tsx'),
      'utf8'
    )
    expect(landing).toContain('data-pw-page={PW_PAGE.landing}')
    expect(landing).toContain('data-pw-region={PW_REGION.banner}')
    expect(landing).toContain('data-pw-region={PW_REGION.content}')
    expect(landing).toContain('data-pw-region={PW_REGION.catalog}')
    expect(landing).toContain('data-pw-el={PW_EL.faqItem}')

    const template = readShop('../template/render-template-html.ts')
    expect(template).toContain('pwRegionAttr(PW_REGION.content)')
    expect(template).toContain('pwRegionAttr(PW_REGION.form)')
    expect(template).toContain('pwElAttr(PW_EL.faqItem)')
    expect(template).toContain('pwElAttr(PW_EL.submit)')
  })
})
