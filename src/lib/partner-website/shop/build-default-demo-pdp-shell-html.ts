import { escapeAttr, escapeHtml } from '@/lib/packaging/mockup-share-html'
import type { WebLocale } from '@/lib/i18n/config'
import {
  formatPartnerShopMoneyVnd,
  resolvePartnerEffectiveUnitPrice,
} from '@/lib/partner-website/shop/partner-shop-flash-sale'
import { DEMO_PDP_BIND_PRODUCT } from '@/lib/partner-website/shop/demo-pdp-bind-product'
import { buildPdpDetailTabsHtml } from '@/lib/partner-website/shop/bind-live-product-to-pdp-html'
import {
  buildPartnerSiteHeaderHtml,
  buildPartnerSitePdpBottomNavHtml,
} from '@/lib/partner-website/shop/build-partner-site-header-html'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteHomePath,
  partnerSiteInfoPath,
  partnerSiteProductsPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { buildOutfitProductsSectionHtml } from '@/lib/partner-website/shop/outfit-products'
import { buildRelatedProductsSectionHtml } from '@/lib/partner-website/shop/related-products'
import { PW_EL, PW_PAGE, PW_REGION, pwElAttr, pwPageAttr, pwRegionAttr } from '@/lib/partner-website/visual-editor/pw-ui-contract'

function uniqueUrls(urls: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of urls) {
    const url = String(raw || '').trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    out.push(url)
  }
  return out
}

function thumbHtml(url: string, name: string, active: boolean): string {
  return `<button type="button" class="pw-shop-product-thumb${active ? ' is-active' : ''}" ${pwElAttr(PW_EL.thumb)}><img src="${escapeAttr(url)}" alt="${escapeAttr(name)}" loading="lazy" decoding="async" /></button>`
}

/** Shared PDP shell for Sửa nhanh — every live field present so layout can be edited. */
export function buildDefaultDemoPdpShellHtml(input?: {
  locale?: WebLocale
  siteSlug?: string | null
  variant?: 'desktop' | 'laptop' | 'tablet' | 'mobile'
  title?: string | null
  logoUrl?: string | null
}): string {
  const locale = input?.locale || 'vi'
  const variant = input?.variant || 'desktop'
  const useMobileHero = variant === 'mobile'
  const slug = String(input?.siteSlug || '').trim()
  const t = getPartnerSiteShopCopy(locale)
  const p = DEMO_PDP_BIND_PRODUCT
  const name = p.name
  const images = uniqueUrls([p.imageUrl, ...(p.galleryImages ?? [])]).slice(0, 4)
  const main = images[0] || ''
  const sizes = (p.sizes ?? []).filter(Boolean)
  const colors = (p.colors ?? []).filter((c) => c.name)
  const realUse = uniqueUrls(p.realUseImageUrls ?? [])
  const material = String(p.materialImageUrl || '').trim()
  const sizeGuide = String(p.sizeGuideImageUrl || '').trim()
  const reviews = p.reviews ?? []
  const questions = p.questions ?? []
  const related = p.relatedProducts ?? []
  const crumbs = p.breadcrumb ?? []
  const stock = Math.max(0, Math.round(Number(p.stockQty ?? 0)))
  const effective =
    resolvePartnerEffectiveUnitPrice({
      priceAmount: p.priceAmount ?? null,
      salePriceAmount: p.salePriceAmount ?? null,
      saleStartsAt: p.saleStartsAt ?? null,
      saleEndsAt: p.saleEndsAt ?? null,
    }) ??
    p.salePriceAmount ??
    p.priceAmount ??
    0
  const compare =
    p.priceAmount != null && effective < p.priceAmount ? formatPartnerShopMoneyVnd(p.priceAmount) : ''
  const price = formatPartnerShopMoneyVnd(effective)
  const savings =
    p.priceAmount != null && effective < p.priceAmount
      ? formatPartnerShopMoneyVnd(p.priceAmount - effective)
      : ''
  const freeShip = t.pdpShippingFreeFrom.replace('{amount}', formatPartnerShopMoneyVnd(299000))
  const shippingHref = slug ? escapeAttr(partnerSiteInfoPath(slug, 'shipping')) : '#'
  const returnsHref = slug ? escapeAttr(partnerSiteInfoPath(slug, 'returns')) : '#'
  const sizeGuideHref = slug ? escapeAttr(partnerSiteInfoPath(slug, 'size-guide')) : '#'
  const homeHref = slug ? escapeAttr(partnerSiteHomePath(slug)) : '#'
  const productsHref = slug ? escapeAttr(partnerSiteProductsPath(slug)) : '#'
  const shareBtn = `<button type="button" class="pw-pdp-pill" data-pw-pdp-slot="share">${escapeHtml(t.pdpShareCopy)}</button>`
  const thumbs = `${images.map((url, i) => thumbHtml(url, name, i === 0)).join('')}${shareBtn}`
  const dots = images.map((_, i) => `<span${i === 0 ? ' class="is-active"' : ''}></span>`).join('')
  const sizePills = sizes
    .map(
      (s, i) =>
        `<button type="button" class="pw-pdp-pill${i === 0 ? ' is-active' : ''}" data-pw-pdp-option-value="${escapeAttr(s)}">${escapeHtml(s)}</button>`
    )
    .join('')
  const colorPills = colors
    .map((c, i) => {
      const img = String(c.img || '').trim()
      const face = img
        ? `<img src="${escapeAttr(img)}" alt="${escapeAttr(c.name)}" />`
        : escapeHtml(c.name)
      return `<button type="button" class="pw-pdp-pill pw-pdp-color${i === 0 ? ' is-active' : ''}" data-pw-pdp-option-value="${escapeAttr(c.name)}">${face}</button>`
    })
    .join('')
  const breadcrumbHtml = [
    `<a href="${homeHref}" ${pwElAttr(PW_EL.link)}>${escapeHtml(t.navHome)}</a>`,
    ...crumbs.map(
      (c) =>
        `<a href="${escapeAttr(c.href || productsHref)}" ${pwElAttr(PW_EL.crumb)}>${escapeHtml(c.name)}</a>`
    ),
    `<span ${pwElAttr(PW_EL.crumb)}>${escapeHtml(name)}</span>`,
  ].join(' / ')
  const reviewCards = reviews
    .map((r) => {
      const stars = '★'.repeat(Math.min(5, Math.max(1, Math.round(r.rating || 5))))
      const photos = (r.imageUrls ?? [])
        .map((url) => String(url || '').trim())
        .filter(Boolean)
        .map(
          (url) =>
            `<img src="${escapeAttr(url)}" alt="" style="width:72px;height:72px;object-fit:cover;border-radius:8px" />`
        )
        .join('')
      const reply = String(r.merchantReply || '').trim()
      return `<article ${pwElAttr(PW_EL.card)} style="border-bottom:1px solid var(--pw-border);padding-bottom:16px">
        <strong ${pwElAttr(PW_EL.cardName)}>${escapeHtml(r.name)}</strong>
        <span class="pw-pdp-star"> ${stars}</span>
        ${r.title ? `<p style="font-weight:600;margin:6px 0 2px">${escapeHtml(r.title)}</p>` : ''}
        <p ${pwElAttr(PW_EL.body)}>${escapeHtml(r.body)}</p>
        ${photos ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0">${photos}</div>` : ''}
        ${
          reply
            ? `<div style="margin-top:8px;padding:10px;background:var(--pw-surface);border-radius:8px;font-size:14px"><strong>${escapeHtml(t.reviewsMerchantReplyPrefix)} ${escapeHtml(r.merchantReplyBy || 'Shop')}:</strong> ${escapeHtml(reply)}</div>`
            : ''
        }
        <button type="button" class="pw-shop-btn pw-shop-btn-outline" style="margin-top:8px;font-size:13px;padding:4px 10px">👍 ${escapeHtml(t.reviewsUsefulLabel)} (${r.usefulCount ?? 0})</button>
      </article>`
    })
    .join('')
  const qaCards = questions
    .map((q) => {
      const answer = String(q.answer || '').trim()
      const badge = q.answerType === 'buyer' ? t.qaVerifiedBadge : t.qaAdminBadge
      const reply = answer
        ? `<div style="margin-left:16px;margin-top:8px;font-size:14px"><strong>${escapeHtml(q.answerBy || 'Shop')}</strong> <span style="font-size:11px;padding:2px 6px;border-radius:999px;background:var(--pw-surface)">${escapeHtml(badge)}</span><p style="margin:4px 0 0">${escapeHtml(answer)}</p></div>`
        : `<p class="pw-shop-muted" style="margin-left:16px;font-size:13px">${escapeHtml(t.qaNoAnswersYet)}</p>`
      return `<article ${pwElAttr(PW_EL.card)} style="border-bottom:1px solid var(--pw-border);padding-bottom:16px"><strong ${pwElAttr(PW_EL.cardName)}>${escapeHtml(q.asker)}</strong><p ${pwElAttr(PW_EL.body)}>${escapeHtml(q.body)}</p>${reply}</article>`
    })
    .join('')
  const relatedSection = buildRelatedProductsSectionHtml({
    locale,
    siteSlug: slug || undefined,
    cards: related,
    excludeId: p.id,
  })
  const outfitSection = buildOutfitProductsSectionHtml({
    locale,
    siteSlug: slug || undefined,
    excludeId: p.id,
  })
  const realUseImgs = realUse
    .slice(0, 1)
    .map((url) => `<img src="${escapeAttr(url)}" alt="${escapeAttr(name)}" loading="lazy" decoding="async" />`)
    .join('')
  const galleryHero = `<div class="pw-pdp-hero" ${pwRegionAttr(PW_REGION.gallery)} data-pw-bg-role="gallery">
      <img class="pw-pdp-hero-img" ${pwElAttr(PW_EL.mainImage)} src="${escapeAttr(main)}" alt="${escapeAttr(name)}" decoding="async" />
      <span class="pw-pdp-hero-count">1/${images.length}</span>
      <div class="pw-pdp-hero-dots">${dots}</div>
      <nav class="pw-pdp-hero-thumbs">${thumbs}</nav>
    </div>`
  const galleryDesktop = `<div class="pw-shop-product-gallery pw-pdp-gallery-desktop" ${pwRegionAttr(PW_REGION.gallery)} data-pw-bg-role="gallery">
        <img class="pw-shop-product-img" ${pwElAttr(PW_EL.mainImage)} src="${escapeAttr(main)}" alt="${escapeAttr(name)}" decoding="async" />
        <p class="pw-shop-muted" style="font-size:12px;margin:4px 0 0">${escapeHtml(t.galleryZoomHint)}</p>
        <div class="pw-shop-product-thumbs">${thumbs}</div>
      </div>`

  const chrome = buildPartnerSiteHeaderHtml({
    locale,
    title: String(input?.title || '').trim() || t.navHome,
    logoUrl: input?.logoUrl,
    siteSlug: slug || undefined,
    samplePreview: !slug,
  })

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body ${pwPageAttr(PW_PAGE.product)}>
${chrome.header}
<main class="pw-shop pw-shop-main">
  <nav class="pw-shop-breadcrumb" ${pwRegionAttr(PW_REGION.breadcrumb)} data-pw-pdp-slot="breadcrumb">${breadcrumbHtml}</nav>
  <div class="pw-pdp">
    ${useMobileHero ? galleryHero : ''}
    <div class="pw-shop-product-layout">
      ${useMobileHero ? '' : galleryDesktop}
      <div class="pw-shop-pdp-info pw-pdp-info-pad" ${pwRegionAttr(PW_REGION.pdpInfo)} data-pw-bg-role="pdp-info">
        <h1 class="pw-pdp-title" ${pwElAttr(PW_EL.title)}>${escapeHtml(name)}</h1>
        ${
          p.brandName
            ? `<p class="pw-pdp-brand" data-pw-pdp-slot="brand">${escapeHtml(t.pdpBrandLabel)}: ${escapeHtml(p.brandName)}</p>`
            : ''
        }
        <p class="pw-pdp-sku">${escapeHtml(t.skuLabel)}: <strong ${pwElAttr(PW_EL.sku)}>${escapeHtml(p.sku || '')}</strong></p>
        <div class="pw-pdp-stats" data-pw-pdp-slot="stats">
          <span><span class="pw-pdp-star">★</span> <strong>${escapeHtml(Number(p.ratingScore ?? 4.8).toFixed(1))}</strong></span>
          <span class="pw-pdp-stats-dot">•</span>
          <span><strong>${escapeHtml(String(p.reviewsCount ?? reviews.length))}</strong> ${escapeHtml(t.pdpRatingLabel)}</span>
          <span class="pw-pdp-stats-dot">•</span>
          <span><strong>${escapeHtml(String(p.purchasesCount ?? 0))}</strong> ${escapeHtml(t.pdpPurchasesLabel)}</span>
        </div>
        <div class="pw-pdp-price-card">
          <span class="pw-shop-urgency-badge" ${pwElAttr(PW_EL.badge)}>${escapeHtml(t.flashSaleBadge)}</span>
          <p class="pw-shop-price" ${pwElAttr(PW_EL.price)}>${escapeHtml(price)}${
            compare
              ? `<span class="pw-pdp-compare" ${pwElAttr(PW_EL.comparePrice)}>${escapeHtml(compare)}</span>`
              : ''
          }</p>
          ${savings ? `<p class="pw-pdp-save" data-pw-pdp-slot="savings">${escapeHtml(t.pdpSavings.replace('{amount}', savings))}</p>` : ''}
        </div>
        ${
          stock > 0
            ? `<span class="pw-shop-urgency-badge" ${pwElAttr(PW_EL.badge)} data-pw-pdp-slot="low-stock">${escapeHtml(t.lowStockUrgency.replace('{n}', String(stock)))}</span>`
            : ''
        }
        <div class="pw-pdp-policy">${escapeHtml(t.pdpShippingNote.replace('{free}', freeShip))} <a href="${shippingHref}">${escapeHtml(t.pdpShippingPolicyLink)}</a> · <a href="${returnsHref}">${escapeHtml(t.pdpReturnsPolicyLink)}</a></div>
        <p class="pw-pdp-policy" style="border-top:none;padding-top:0;margin-top:8px"><strong>${escapeHtml(t.pdpServiceLabel)}:</strong> ${escapeHtml(t.pdpServiceNote)}</p>
        <p style="margin:10px 0 0;font-size:12px;font-weight:700">${escapeHtml(t.pdpNotesTitle)}</p>
        <ul class="pw-pdp-notes"><li>${escapeHtml(t.pdpNoteFit)}</li><li>${escapeHtml(t.pdpNoteColor)}</li></ul>
        <div style="margin-top:16px" ${pwElAttr(PW_EL.variant)} data-pw-pdp-option="size">
          <p style="font-weight:700;margin:0 0 8px;font-size:14px">${escapeHtml(t.sizeLabel)}</p>
          <div class="pw-pdp-pills">${sizePills}</div>
          <button type="button" class="pw-shop-btn pw-shop-btn-outline" style="margin-top:8px;font-size:13px">${escapeHtml(t.sizeGuideButton)}</button>
          ${
            sizeGuide
              ? `<div data-pw-pdp-slot="size-guide" style="margin-top:8px"><img src="${escapeAttr(sizeGuide)}" alt="${escapeAttr(t.sizeGuideModalTitle)}" loading="lazy" decoding="async" style="width:100%;max-width:360px;height:auto;border-radius:8px;border:1px solid var(--pw-border)" /></div>`
              : `<a href="${sizeGuideHref}" style="display:inline-block;margin-top:8px;font-size:13px">${escapeHtml(t.sizeGuideFallbackLink)}</a>`
          }
        </div>
        <div style="margin-top:16px" ${pwElAttr(PW_EL.variant)} data-pw-pdp-option="color">
          <p style="font-weight:700;margin:0 0 8px;font-size:14px">${escapeHtml(t.colorLabel)}</p>
          <div class="pw-pdp-pills">${colorPills}</div>
        </div>
        ${
          p.consultNote
            ? `<div data-pw-pdp-slot="consult" style="margin-top:16px;padding:12px;border-radius:12px;background:var(--pw-surface);border:1px solid var(--pw-border)"><p style="margin:0 0 6px;font-weight:700;font-size:13px">${escapeHtml(t.pdpConsultNoteTitle)}</p><p class="pw-shop-muted" style="margin:0">${escapeHtml(p.consultNote)}</p></div>`
            : ''
        }
        <div style="margin-top:16px">
          <p style="font-weight:700;margin:0 0 8px;font-size:14px">${escapeHtml(t.pdpQtyBuy)}</p>
          <div class="pw-pdp-qty" ${pwElAttr(PW_EL.qty)}><button type="button">−</button><span>1</span><button type="button">+</button></div>
        </div>
        <div class="pw-pdp-total"><span>${escapeHtml(t.pdpLineTotal)}</span><span class="pw-shop-price" style="font-size:1.15rem">${escapeHtml(price)}</span></div>
        ${savings ? `<p class="pw-pdp-save">${escapeHtml(t.pdpSavings.replace('{amount}', savings))}</p>` : ''}
        <p class="pw-shop-muted" data-pw-pdp-slot="deposit" style="margin-top:12px;font-size:13px">${escapeHtml(t.depositPolicyNote)}</p>
        <div class="pw-pdp-actions pw-pdp-actions-inline">
          <button type="button" class="pw-shop-btn pw-shop-btn-cart" data-pw-chrome-btn="add-cart" ${pwElAttr(PW_EL.cardCart)} data-pw-add-cart data-pw-pdp-add-cart="1">${escapeHtml(t.addToCart)}</button>
          <button type="button" class="pw-shop-btn pw-shop-btn-buy" data-pw-chrome-btn="buy-now" ${pwElAttr(PW_EL.buy)} data-pw-buy data-pw-pdp-buy-now="1">${escapeHtml(t.buyNow)}</button>
          <button type="button" class="pw-shop-btn pw-shop-btn-outline" ${pwElAttr(PW_EL.cta)} data-nanoai-open-chat>${escapeHtml(t.consultChat)}</button>
          <button type="button" class="pw-shop-btn pw-shop-btn-outline" data-pw-chrome-btn="try-on" ${pwElAttr(PW_EL.cta)} data-nanoai-try-on>${escapeHtml(t.tryOnLink)}</button>
          <button type="button" class="pw-shop-btn pw-shop-btn-outline" data-pw-chrome-btn="favorite-product" ${pwElAttr(PW_EL.wishlist)} data-pw-favorite data-pw-pdp-favorite="1" data-pw-like-base="${escapeAttr(String(p.likesCount ?? 0))}">♡ <span data-pw-like-count>${escapeHtml(String(p.likesCount ?? 0))}</span></button>
        </div>
      </div>
    </div>
    ${outfitSection}
    <section class="pw-shop-product-detail" ${pwRegionAttr(PW_REGION.pdpInfo)} data-pw-bg-role="pdp-info">
      ${buildPdpDetailTabsHtml(p, locale)}
      ${
        material
          ? `<div data-pw-pdp-slot="material"><h2>${escapeHtml(t.pdpMaterialImagesTitle)}</h2><div class="pw-shop-detail-grid"><img src="${escapeAttr(material)}" alt="${escapeAttr(name)}" loading="lazy" decoding="async" /></div></div>`
          : ''
      }
      ${
        realUseImgs
          ? `<div data-pw-pdp-slot="real-use"><h2>${escapeHtml(t.pdpRealUseImagesTitle)}</h2><div class="pw-shop-detail-grid">${realUseImgs}</div></div>`
          : ''
      }
      <div data-pw-pdp-slot="video">
        <h2>${escapeHtml(t.productVideoTitle)}</h2>
        <video class="pw-shop-product-video" controls preload="none"></video>
      </div>
    </section>
    <section id="pw-pdp-reviews" class="pw-shop-reviews" ${pwRegionAttr(PW_REGION.reviews)} data-pw-bg-role="reviews">
      <h2 ${pwElAttr(PW_EL.sectionTitle)}>${escapeHtml(t.reviewsTitle)}</h2>
      <div style="display:flex;align-items:center;gap:12px;margin-top:8px"><span style="font-size:1.5rem;font-weight:700">4.8/5</span><span class="pw-pdp-star">★★★★★</span><span class="pw-shop-muted">(${reviews.length} ${escapeHtml(t.reviewsTotalSuffix)})</span></div>
      <div data-pw-pdp-slot="review-form" style="margin-top:16px;padding:16px;border:1px solid var(--pw-border);border-radius:12px;display:grid;gap:10px">
        <p style="margin:0;font-weight:700">${escapeHtml(t.reviewsWriteButton)}</p>
        <p class="pw-shop-muted" style="margin:0">${escapeHtml(t.reviewsFormRatingLabel)} ★★★★★</p>
        <textarea rows="3" placeholder="${escapeAttr(t.reviewsFormContentPlaceholder)}"></textarea>
        <p class="pw-shop-muted" style="margin:0">${escapeHtml(t.reviewsFormImagesLabel)}</p>
        <button type="button" class="pw-shop-btn">${escapeHtml(t.reviewsFormSubmit)}</button>
      </div>
      <div style="margin-top:20px;display:grid;gap:16px">${reviewCards}</div>
      <button type="button" class="pw-shop-btn pw-shop-btn-outline" style="margin-top:12px">${escapeHtml(t.reviewsLoadMore)}</button>
    </section>
    <section id="pw-pdp-qa" class="pw-shop-reviews" ${pwRegionAttr(PW_REGION.reviews)} data-pw-pdp-slot="qa">
      <h2 ${pwElAttr(PW_EL.sectionTitle)}>${escapeHtml(t.qaTitle)}</h2>
      <button type="button" class="pw-shop-btn pw-shop-btn-outline">${escapeHtml(t.qaAskButton)}</button>
      <div style="margin-top:12px;display:grid;gap:8px;max-width:480px">
        <textarea rows="3" placeholder="${escapeAttr(t.qaFormPlaceholder)}"></textarea>
        <button type="button" class="pw-shop-btn">${escapeHtml(t.qaFormSubmit)}</button>
      </div>
      <div style="margin-top:20px;display:grid;gap:16px">${qaCards}</div>
    </section>
    ${relatedSection}
    ${
      useMobileHero
        ? ''
        : buildPartnerSitePdpBottomNavHtml({
            locale,
            homeHref: slug ? partnerSiteHomePath(slug) : '#',
            stickyOnly: true,
          })
    }
  </div>
</main>
${
  useMobileHero
    ? buildPartnerSitePdpBottomNavHtml({ locale, homeHref: slug ? partnerSiteHomePath(slug) : '#' })
    : chrome.bottomNav
}
</body>
</html>`
}
