'use client'

import type { WebLocale } from '@/lib/i18n/config'
import {
  pwScaledFhdDesktopMediaQuery,
  pwUnlockedBelowLaptopMediaQuery,
} from '@/lib/partner-website/visual-editor/pw-coordinate-space'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { pdpLadipageTrustPoints } from '@/lib/partner-website/shop/pdp-ladipage-copy'
import { PDP_LP_HIGHLIGHT_ICONS, PDP_LP_TRUST_ICONS } from '@/lib/partner-website/shop/pdp-ladipage-icons'
import {
  PDP_LADIPAGE_FACE_CSS,
  PDP_LADIPAGE_OFFER_CSS,
  pdpLadipageHeroCopyVisible,
  splitLadipageEmphasis,
  type PdpLadipageStory,
} from '@/lib/partner-website/shop/pdp-ladipage-sections'

const DEVICE_CSS = `
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
`

function LpIcon({ svg, small = false }: { svg: string; small?: boolean }) {
  return (
    <span
      className={small ? 'pw-lp-ico pw-lp-ico-sm' : 'pw-lp-ico'}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

function EmText({ text, emphasizeAll = false }: { text: string; emphasizeAll?: boolean }) {
  if (emphasizeAll) return <span className="pw-lp-em">{text}</span>
  const parts = splitLadipageEmphasis(text)
  return (
    <>
      {parts.map((part, index) =>
        part.em ? (
          <strong key={`${part.text}-${index}`} className="pw-lp-em">
            {part.text}
          </strong>
        ) : (
          <span key={`${part.text}-${index}`}>{part.text}</span>
        )
      )}
    </>
  )
}

function BuyButton({ label, onBuy }: { label: string; onBuy: () => void }) {
  return (
    <button
      type="button"
      className="pw-shop-btn pw-shop-btn-buy"
      data-pw-el="cta"
      data-pw-buy
      data-pw-pdp-buy-now="1"
      data-pw-ladipage-buy="1"
      onClick={onBuy}
    >
      {label}
      <span className="pw-lp-arrow" aria-hidden="true">
        →
      </span>
    </button>
  )
}

export function PartnerSitePdpOfferLine({ line }: { line: string }) {
  const parts = line
    .split(' · ')
    .map((part) => part.trim())
    .filter(Boolean)
  if (!parts.length) return null
  return (
    <>
      <style>{PDP_LADIPAGE_OFFER_CSS}</style>
      <p className="pw-lp-offer" data-pw-pdp-slot="deposit" data-pw-pdp-offer="1">
        {parts.map((part, index) => (
          <strong key={`${part}-${index}`} className="pw-lp-chip">
            {part}
          </strong>
        ))}
      </p>
    </>
  )
}

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
  const heroImage = imageUrl || story.hero.imageUrl || ''
  const points = pdpLadipageTrustPoints(locale)
  const showRating = story.averageRating != null && story.totalReviews > 0
  const face = (
    <style>{`${DEVICE_CSS}${PDP_LADIPAGE_FACE_CSS}`}</style>
  )

  if (part === 'blurb') {
    return (
      <div data-pw-ladipage-mobile data-pw-pdp-ladipage="blurb" className="pw-pdp-ladipage-mobile-only">
        {face}
        <p data-pw-el="badge">
          <span className="pw-lp-dot" aria-hidden="true" />
          {shop.lpSuggestedForYou}
        </p>
        {visible.showHeadline ? <h2 data-pw-el="title">{story.hero.headline}</h2> : null}
        {visible.showSub ? (
          <p data-pw-el="subtitle">
            <EmText text={story.hero.subheadline || ''} />
          </p>
        ) : null}
        <BuyButton label={shop.buyNow} onBuy={onBuy} />
      </div>
    )
  }

  if (part === 'story') {
    return (
      <div data-pw-pdp-ladipage="story">
        {face}
        {story.highlights.length ? (
          <section data-pw-region="content">
            <p className="pw-lp-kicker">{shop.lpWhyKicker}</p>
            <h2 data-pw-el="heading">{shop.lpHighlightsHeading}</h2>
            <div data-pw-pdp-ladipage-highlights="">
              {story.highlights.map((item, index) => (
                <article key={`${item.title}-${index}`} data-pw-pdp-ladipage-card="">
                  <LpIcon svg={PDP_LP_HIGHLIGHT_ICONS[index % PDP_LP_HIGHLIGHT_ICONS.length] || ''} />
                  <h3 data-pw-el="title">
                    <EmText text={item.title} emphasizeAll />
                  </h3>
                  <p data-pw-el="body">
                    <EmText text={item.desc} />
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : null}
        {story.material && (story.material.body || story.material.imageUrl || story.material.material) ? (
          <section data-pw-region="content" data-pw-pdp-ladipage-material="1">
            {story.material.imageUrl ? (
              <img data-pw-el="image" src={story.material.imageUrl} alt={story.material.material || ''} />
            ) : null}
            <div>
              <p className="pw-lp-kicker">{shop.lpMaterialKicker}</p>
              <h2 data-pw-el="title">
                {shop.lpMaterialHeading}
                {story.material.material ? (
                  <>
                    {' '}
                    <EmText text={story.material.material} emphasizeAll />
                  </>
                ) : null}
              </h2>
              {story.material.body ? (
                <p data-pw-el="body">
                  <EmText text={story.material.body} />
                </p>
              ) : null}
              {story.material.callouts?.length ? (
                <ul data-pw-pdp-ladipage-callouts="">
                  {story.material.callouts.map((item) => (
                    <li key={item}>
                      <EmText text={item} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        ) : null}
        {story.trust?.body ? (
          <section data-pw-region="promo" data-pw-pdp-ladipage="trust-cta">
            <p className="pw-lp-kicker" style={{ color: '#fff' }}>
              {shop.lpReadyKicker}
            </p>
            {showRating ? (
              <p data-pw-el="badge">
                {shop.lpRealReviews
                  .replace('{rating}', String(story.averageRating))
                  .replace('{count}', String(story.totalReviews))}
              </p>
            ) : null}
            <p data-pw-el="subtitle">
              <EmText text={story.trust.body} />
            </p>
            <BuyButton label={story.trust.ctaLabel || shop.buyNow} onBuy={onBuy} />
            <p className="pw-lp-foot">{shop.lpTrustFoot}</p>
          </section>
        ) : null}
        {story.faq.length ? (
          <section data-pw-region="content">
            <p className="pw-lp-kicker">{shop.lpFaqKicker}</p>
            <h2 data-pw-el="title">{shop.lpFaqHeading}</h2>
            <div className="pw-lp-faq">
              {story.faq.map((item, index) => (
                <details key={`${item.q}-${index}`} data-pw-el="faq-item">
                  <summary>{item.q}</summary>
                  <p data-pw-el="body">
                    <EmText text={item.a} />
                  </p>
                </details>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    )
  }

  return (
    <div data-pw-ladipage-desktop className="pw-pdp-ladipage-desktop-only">
      {face}
      <section data-pw-pdp-ladipage="hero">
        <div data-pw-el="copy">
          <p data-pw-el="badge">
            <span className="pw-lp-dot" aria-hidden="true" />
            {shop.lpSuggestedForYou}
          </p>
          {visible.showHeadline ? <h2 data-pw-el="title">{story.hero.headline}</h2> : null}
          {visible.showSub ? (
            <p data-pw-el="subtitle">
              <EmText text={story.hero.subheadline || ''} />
            </p>
          ) : null}
          <BuyButton label={shop.buyNow} onBuy={onBuy} />
        </div>
        {heroImage ? (
          <div className="pw-lp-hero-media">
            <img data-pw-el="media" src={heroImage} alt={productName} />
          </div>
        ) : null}
      </section>
      <div data-pw-pdp-ladipage="trust">
        {points.map((point, index) => (
          <div key={point.title} className="pw-lp-trust-item" data-pw-el="subtitle">
            <LpIcon svg={PDP_LP_TRUST_ICONS[index % PDP_LP_TRUST_ICONS.length] || ''} small />
            <div>
              <strong>{point.title}</strong>
              <span className="pw-lp-trust-body">{point.body}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
