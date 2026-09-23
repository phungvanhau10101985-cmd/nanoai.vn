'use client'

import type { WebLocale } from '@/lib/i18n/config'
import {
  pwScaledFhdDesktopMediaQuery,
  pwUnlockedBelowLaptopMediaQuery,
} from '@/lib/partner-website/visual-editor/pw-coordinate-space'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { pdpLadipageTrustPoints } from '@/lib/partner-website/shop/pdp-ladipage-copy'
import {
  PDP_LADIPAGE_FACE_CSS,
  pdpLadipageHeroCopyVisible,
  type PdpLadipageStory,
} from '@/lib/partner-website/shop/pdp-ladipage-sections'

export function PartnerSitePdpLadipageBlocks({
  story,
  productName,
  imageUrl,
  locale,
  onBuy,
  part,
}: {
  story: PdpLadipageStory
  productName: string
  imageUrl: string
  locale: WebLocale
  onBuy: () => void
  part: 'hero' | 'blurb' | 'story'
}) {
  const shop = getPartnerSiteShopCopy(locale)
  const visible = pdpLadipageHeroCopyVisible(
    productName,
    story.hero.headline || '',
    story.hero.subheadline || ''
  )
  const sentence = visible.showSub
    ? story.hero.subheadline || ''
    : visible.showHeadline
      ? story.hero.headline || ''
      : ''
  const heroImage = imageUrl || story.hero.imageUrl || ''
  const points = pdpLadipageTrustPoints(locale)
  const showRating = story.averageRating != null && story.totalReviews > 0

  if (part === 'blurb') {
    return (
      <div data-pw-ladipage-mobile data-pw-pdp-ladipage="blurb" className="pw-pdp-ladipage-mobile-only">
        <p data-pw-el="badge" style={{ color: 'var(--pw-primary)', fontWeight: 700, fontSize: 12 }}>{shop.lpSuggestedForYou}</p>
        {sentence ? <p data-pw-el="subtitle">{sentence}</p> : null}
      </div>
    )
  }

  if (part === 'story') {
    return (
      <div data-pw-pdp-ladipage="story">
        <style>{PDP_LADIPAGE_FACE_CSS}</style>
        {story.highlights.length ? (
          <section data-pw-region="content">
            <h2 data-pw-el="heading">{shop.lpHighlightsHeading}</h2>
            <div data-pw-pdp-ladipage-highlights>
              {story.highlights.map((item, index) => (
                <article key={`${item.title}-${index}`} data-pw-pdp-ladipage-card>
                  <h3 data-pw-el="title">{item.title}</h3>
                  <p data-pw-el="body">{item.desc}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}
        {story.material && (story.material.body || story.material.imageUrl || story.material.material) ? (
          <section data-pw-region="content" data-pw-pdp-ladipage-material="1">
            {story.material.imageUrl ? <img data-pw-el="image" src={story.material.imageUrl} alt={story.material.material || ''} /> : null}
            <div>
              {story.material.material ? <p data-pw-el="title">{story.material.material}</p> : null}
              {story.material.body ? <p data-pw-el="body">{story.material.body}</p> : null}
              {story.material.callouts?.length ? (
                <ul data-pw-pdp-ladipage-callouts>
                  {story.material.callouts.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        ) : null}
        {story.trust?.body ? (
          <section data-pw-region="promo">
            {showRating ? (
              <p data-pw-el="badge">
                {shop.lpRealReviews
                  .replace('{rating}', String(story.averageRating))
                  .replace('{count}', String(story.totalReviews))}
              </p>
            ) : null}
            <p data-pw-el="subtitle">{story.trust.body}</p>
            <button type="button" className="pw-shop-btn pw-shop-btn-buy" data-pw-el="cta" data-pw-buy data-pw-pdp-buy-now="1" data-pw-ladipage-buy="1" onClick={onBuy}>
              {story.trust.ctaLabel || shop.buyNow}
            </button>
          </section>
        ) : null}
        {story.faq.length ? (
          <section data-pw-region="content">
            <h2 data-pw-el="title">{shop.lpFaqHeading}</h2>
            {story.faq.map((item, index) => (
              <details key={`${item.q}-${index}`} data-pw-el="faq-item">
                <summary>{item.q}</summary>
                <p data-pw-el="body">{item.a}</p>
              </details>
            ))}
          </section>
        ) : null}
      </div>
    )
  }

  return (
    <div data-pw-ladipage-desktop className="pw-pdp-ladipage-desktop-only">
      <style>{`
        html[data-pw-edit-device="mobile"] .pw-pdp-ladipage-desktop-only,
        html[data-pw-edit-device="tablet"] .pw-pdp-ladipage-desktop-only,
        html[data-pw-scene-lock="mobile"] .pw-pdp-ladipage-desktop-only,
        html[data-pw-scene-lock="tablet"] .pw-pdp-ladipage-desktop-only{display:none!important}
        html[data-pw-edit-device="desktop"] .pw-pdp-ladipage-mobile-only,
        html[data-pw-edit-device="laptop"] .pw-pdp-ladipage-mobile-only,
        html[data-pw-scene-lock="desktop"] .pw-pdp-ladipage-mobile-only,
        html[data-pw-scene-lock="laptop"] .pw-pdp-ladipage-mobile-only{display:none!important}
        @media ${pwUnlockedBelowLaptopMediaQuery()}{
          html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-pdp-ladipage-desktop-only{display:none!important}
        }
        @media (min-width:1280px), ${pwScaledFhdDesktopMediaQuery()}{
          html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-pdp-ladipage-mobile-only{display:none!important}
        }
        [data-pw-pdp-ladipage="trust"]{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:12px 0}
        [data-pw-pdp-ladipage="trust"] strong{display:block}
        [data-pw-pdp-ladipage="trust"] span{display:block;color:var(--pw-muted,#6b7280);font-size:13px}
        ${PDP_LADIPAGE_FACE_CSS}
      `}</style>
      <section data-pw-pdp-ladipage="hero" data-pw-region="banner">
        {heroImage ? <img data-pw-el="media" src={heroImage} alt={productName} style={{ width: '100%', objectFit: 'contain' }} /> : null}
        <div data-pw-el="copy">
          <p data-pw-el="badge" style={{ color: 'var(--pw-primary)', fontWeight: 700, fontSize: 12 }}>{shop.lpSuggestedForYou}</p>
          {visible.showHeadline ? <h2 data-pw-el="title">{story.hero.headline}</h2> : null}
          {visible.showSub ? <p data-pw-el="subtitle">{story.hero.subheadline}</p> : null}
          <button type="button" className="pw-shop-btn pw-shop-btn-buy" data-pw-el="cta" data-pw-buy data-pw-pdp-buy-now="1" data-pw-ladipage-buy="1" onClick={onBuy}>
            {shop.buyNow}
          </button>
        </div>
      </section>
      <div data-pw-pdp-ladipage="trust" data-pw-region="promo">
        {points.map((point) => (
          <p key={point.title} data-pw-el="subtitle" style={{ textAlign: 'center', margin: 0 }}>
            <strong>{point.title}</strong>
            <span>{point.body}</span>
          </p>
        ))}
      </div>
    </div>
  )
}
