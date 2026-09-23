import type { WebLocale } from '@/lib/i18n/config'
import type { VisualDeviceVariant } from '@/lib/partner-website/visual-editor/visual-editor-pages'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { pdpLadipageTrustPoints } from '@/lib/partner-website/shop/pdp-ladipage-copy'
import type {
  LandingFaqItem,
  LandingHeroData,
  LandingHighlightItem,
  LandingMaterialData,
  LandingTrustCtaData,
} from '@/lib/partner-website/landing/landing-ai-types'

export type PdpLadipageStory = {
  landingId: string
  hero: LandingHeroData
  highlights: LandingHighlightItem[]
  material: LandingMaterialData | null
  trust: LandingTrustCtaData | null
  faq: LandingFaqItem[]
  averageRating: number | null
  totalReviews: number
}

export type PdpLadipageOverlay = {
  story: PdpLadipageStory | null
  offerLine: string
  productName: string
  imageUrl: string
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function textsOverlap(a: string, b: string): boolean {
  if (!a || !b) return false
  return a === b || a.includes(b) || b.includes(a)
}

/** Headline/sub chỉ hiện khi không trùng tên sản phẩm (và sub không trùng headline). */
export function pdpLadipageHeroCopyVisible(
  productName: string,
  headline: string,
  subheadline: string
): { showHeadline: boolean; showSub: boolean } {
  const name = foldText(productName)
  const head = foldText(headline)
  const sub = foldText(subheadline)
  const showHeadline = Boolean(head) && !textsOverlap(head, name)
  const showSub = Boolean(sub) && !textsOverlap(sub, name) && !textsOverlap(sub, head)
  return { showHeadline, showSub }
}

export function buildPdpLadipageFaqJsonLd(items: LandingFaqItem[]): Record<string, unknown> | null {
  const mainEntity = items
    .map((item) => ({
      q: item.q.trim(),
      a: item.a.trim(),
    }))
    .filter((item) => item.q && item.a)
    .map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    }))
  if (!mainEntity.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity,
  }
}

function wrap(name: string, inner: string): string {
  return `<!--pw-pdp-ladipage-${name}-->${inner}<!--/pw-pdp-ladipage-${name}-->`
}

function stripMarker(html: string, name: string): string {
  return html.replace(new RegExp(`<!--pw-pdp-ladipage-${name}-->[\\s\\S]*?<!--/pw-pdp-ladipage-${name}-->`, 'g'), '')
}

function stripAll(html: string): string {
  return ['css', 'faq-ld', 'hero', 'blurb', 'story', 'offer'].reduce(stripMarker, html)
}

function insertBefore(html: string, pattern: RegExp, block: string): string {
  if (!pattern.test(html)) return html
  return html.replace(pattern, `${block}$&`)
}

function isCompactDevice(device: VisualDeviceVariant | null | undefined): boolean {
  return device === 'mobile' || device === 'tablet'
}

export const PDP_LADIPAGE_FACE_CSS = `
[data-pw-pdp-ladipage]{box-sizing:border-box;color:var(--pw-text,#111827)}
[data-pw-pdp-ladipage="hero"]{margin:0 auto 8px;max-width:var(--pw-content,1200px)}
[data-pw-pdp-ladipage="hero"] [data-pw-el="copy"]{display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:18px 0 8px}
[data-pw-pdp-ladipage="hero"] img{display:block;width:100%;max-height:calc(70vh / var(--pw-scene-zoom,1));object-fit:contain;background:var(--pw-surface,#f8fafc);border-radius:16px}
[data-pw-pdp-ladipage="hero"] [data-pw-el="badge"],[data-pw-pdp-ladipage="blurb"] [data-pw-el="badge"]{display:inline-flex;align-items:center;gap:6px;margin:0;padding:4px 10px;border-radius:999px;border:1px solid color-mix(in srgb,var(--pw-primary) 28%,#fff);background:color-mix(in srgb,var(--pw-primary) 10%,#fff);color:var(--pw-primary);font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
[data-pw-pdp-ladipage="hero"] [data-pw-el="title"]{margin:0;font-size:clamp(1.35rem,2vw,1.75rem);line-height:1.25}
[data-pw-pdp-ladipage="hero"] [data-pw-el="subtitle"],[data-pw-pdp-ladipage="blurb"] [data-pw-el="subtitle"]{margin:0;font-size:1rem;font-weight:650;line-height:1.4}
[data-pw-pdp-ladipage="trust"]{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0 auto 18px;max-width:var(--pw-content,1200px)}
[data-pw-pdp-ladipage="trust"] p{margin:0;padding:12px 10px;text-align:center;border-radius:14px;background:var(--pw-surface,#fff);border:1px solid var(--pw-border,#e5e7eb)}
[data-pw-pdp-ladipage="trust"] strong{display:block;color:var(--pw-text,#111827);font-size:14px}
[data-pw-pdp-ladipage="trust"] span{display:block;margin-top:4px;color:var(--pw-muted,#6b7280);font-size:12px;line-height:1.4}
[data-pw-pdp-ladipage="blurb"]{margin:10px 0 12px}
[data-pw-pdp-ladipage="story"]{display:grid;gap:28px;margin:28px auto;max-width:var(--pw-content,1200px)}
[data-pw-pdp-ladipage="story"] h2{margin:0 0 14px;font-size:1.35rem}
[data-pw-pdp-ladipage-highlights]{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
[data-pw-pdp-ladipage-card]{border:1px solid var(--pw-border,#e5e7eb);background:#fff;border-radius:16px;padding:16px 16px 14px;box-shadow:0 1px 2px rgba(15,23,42,.04)}
[data-pw-pdp-ladipage-card] h3{margin:0 0 6px;font-size:15px}
[data-pw-pdp-ladipage-card] p{margin:0;color:var(--pw-muted,#6b7280);font-size:14px;line-height:1.5}
[data-pw-pdp-ladipage-material]{display:grid;gap:16px;align-items:center;padding:18px;border-radius:18px;background:var(--pw-surface,#f8fafc)}
[data-pw-pdp-ladipage-material] img{width:100%;max-width:420px;aspect-ratio:1;object-fit:cover;border-radius:16px;background:#fff}
[data-pw-pdp-ladipage-material] [data-pw-el="title"]{margin:0;color:var(--pw-primary);font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
[data-pw-pdp-ladipage-material] [data-pw-el="body"]{margin:8px 0 0;line-height:1.6}
[data-pw-pdp-ladipage-callouts]{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 0;padding:0;list-style:none}
[data-pw-pdp-ladipage-callouts] li{padding:6px 10px;border-radius:999px;background:#fff;border:1px solid var(--pw-border,#e5e7eb);font-size:13px;font-weight:600}
[data-pw-pdp-ladipage="trust-cta"]{padding:18px;border-radius:18px;background:color-mix(in srgb,var(--pw-primary) 8%,#fff);border:1px solid color-mix(in srgb,var(--pw-primary) 18%,#fff)}
[data-pw-pdp-ladipage="story"] details{border:1px solid var(--pw-border,#e5e7eb);border-radius:12px;padding:12px 14px;margin:0 0 8px;background:#fff}
[data-pw-pdp-ladipage="story"] summary{font-weight:700;cursor:pointer}
[data-pw-pdp-offer]{margin:8px 0 0;color:var(--pw-muted,#6b7280);font-size:13px}
@media (min-width:768px){[data-pw-pdp-ladipage-material]{grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr)}}
`
const CSS = `<style data-pw-pdp-ladipage-css>${PDP_LADIPAGE_FACE_CSS}</style>`

function heroHtml(input: PdpLadipageOverlay, locale: WebLocale): string {
  const story = input.story
  if (!story) return ''
  const shop = getPartnerSiteShopCopy(locale)
  const visible = pdpLadipageHeroCopyVisible(
    input.productName,
    story.hero.headline || '',
    story.hero.subheadline || ''
  )
  const image = (input.imageUrl || story.hero.imageUrl || '').trim()
  const points = pdpLadipageTrustPoints(locale)
  const trust = points
    .map(
      (point) =>
        `<p data-pw-el="subtitle"><strong>${esc(point.title)}</strong><span>${esc(point.body)}</span></p>`
    )
    .join('')
  return wrap(
    'hero',
    `<section data-pw-pdp-ladipage="hero" data-pw-region="banner">
      ${image ? `<img data-pw-el="media" src="${esc(image)}" alt="${esc(input.productName)}"/>` : ''}
      <div data-pw-el="copy">
        <p data-pw-el="badge">${esc(shop.lpSuggestedForYou)}</p>
        ${visible.showHeadline ? `<h2 data-pw-el="title">${esc(story.hero.headline || '')}</h2>` : ''}
        ${visible.showSub ? `<p data-pw-el="subtitle">${esc(story.hero.subheadline || '')}</p>` : ''}
        <button type="button" class="pw-shop-btn pw-shop-btn-buy" data-pw-el="cta" data-pw-buy data-pw-pdp-buy-now="1" data-pw-ladipage-buy="1">${esc(shop.buyNow)}</button>
      </div>
    </section>
    <div data-pw-pdp-ladipage="trust" data-pw-region="promo">${trust}</div>`
  )
}

function blurbHtml(input: PdpLadipageOverlay, locale: WebLocale): string {
  const story = input.story
  if (!story) return ''
  const shop = getPartnerSiteShopCopy(locale)
  const visible = pdpLadipageHeroCopyVisible(
    input.productName,
    story.hero.headline || '',
    story.hero.subheadline || ''
  )
  const sentence = visible.showSub
    ? story.hero.subheadline || ''
    : visible.showHeadline
      ? story.hero.headline || ''
      : ''
  return wrap(
    'blurb',
    `<div data-pw-pdp-ladipage="blurb">
      <p data-pw-el="badge">${esc(shop.lpSuggestedForYou)}</p>
      ${sentence ? `<p data-pw-el="subtitle">${esc(sentence)}</p>` : ''}
    </div>`
  )
}

function storyHtml(input: PdpLadipageOverlay, locale: WebLocale): string {
  const story = input.story
  if (!story) return ''
  const shop = getPartnerSiteShopCopy(locale)
  const highlights = story.highlights.length
    ? `<section data-pw-region="content"><h2 data-pw-el="heading">${esc(shop.lpHighlightsHeading)}</h2><div data-pw-pdp-ladipage-highlights>${story.highlights
        .map(
          (item) =>
            `<article data-pw-pdp-ladipage-card><h3 data-pw-el="title">${esc(item.title)}</h3><p data-pw-el="body">${esc(item.desc)}</p></article>`
        )
        .join('')}</div></section>`
    : ''
  const callouts = (story.material?.callouts ?? []).map((item) => item.trim()).filter(Boolean)
  const material = story.material && (story.material.body || story.material.imageUrl || story.material.material)
    ? `<section data-pw-region="content" data-pw-pdp-ladipage-material="1">
        ${story.material.imageUrl ? `<img data-pw-el="image" src="${esc(story.material.imageUrl)}" alt="${esc(story.material.material || '')}"/>` : ''}
        <div>
          ${story.material.material ? `<p data-pw-el="title">${esc(story.material.material)}</p>` : ''}
          ${story.material.body ? `<p data-pw-el="body">${esc(story.material.body)}</p>` : ''}
          ${callouts.length ? `<ul data-pw-pdp-ladipage-callouts>${callouts.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}
        </div>
      </section>`
    : ''
  const rating =
    story.averageRating != null && story.totalReviews > 0
      ? `<p data-pw-el="badge">${esc(
          shop.lpRealReviews
            .replace('{rating}', String(story.averageRating))
            .replace('{count}', String(story.totalReviews))
        )}</p>`
      : ''
  const trust = story.trust?.body
    ? `<section data-pw-region="promo" data-pw-pdp-ladipage="trust-cta">
        ${rating}
        <p data-pw-el="subtitle">${esc(story.trust.body)}</p>
        <button type="button" class="pw-shop-btn pw-shop-btn-buy" data-pw-el="cta" data-pw-buy data-pw-pdp-buy-now="1" data-pw-ladipage-buy="1">${esc(story.trust.ctaLabel || shop.buyNow)}</button>
      </section>`
    : ''
  const faq = story.faq.length
    ? `<section data-pw-region="content"><h2 data-pw-el="title">${esc(shop.lpFaqHeading)}</h2>${story.faq
        .map(
          (item) =>
            `<details data-pw-el="faq-item"><summary>${esc(item.q)}</summary><p data-pw-el="body">${esc(item.a)}</p></details>`
        )
        .join('')}</section>`
    : ''
  const inner = `${highlights}${material}${trust}${faq}`
  if (!inner) return ''
  return wrap('story', `<div data-pw-pdp-ladipage="story">${inner}</div>`)
}

function offerHtml(line: string): string {
  const text = line.trim()
  if (!text) return ''
  return wrap(
    'offer',
    `<p class="pw-shop-muted" data-pw-pdp-slot="deposit" data-pw-pdp-offer="1">${esc(text)}</p>`
  )
}

/**
 * Gắn section LadiPage đã publish vào HTML PDP live. Không ghi vào file Sửa nhanh.
 * Mobile/tablet: badge + câu hero dưới gallery, story dưới buy box.
 * Desktop/laptop: hero + dải tin cậy trước gallery.
 */
export function bindPdpLadipageToHtml(
  html: string,
  overlay: PdpLadipageOverlay | null | undefined,
  opts: { locale: WebLocale; device?: VisualDeviceVariant | null }
): string {
  if (!overlay) return html
  let out = stripAll(html)
  const compact = isCompactDevice(opts.device)
  const story = overlay.story
  if (story) {
    if (!out.includes('data-pw-pdp-ladipage-css')) {
      const css = wrap('css', CSS)
      out = /<\/head>/i.test(out) ? out.replace(/<\/head>/i, `${css}</head>`) : `${css}${out}`
    }
    const faqLd = buildPdpLadipageFaqJsonLd(story.faq)
    if (faqLd) {
      const script = wrap(
        'faq-ld',
        `<script type="application/ld+json" data-pw-pdp-ladipage-faq-ld>${JSON.stringify(faqLd).replace(/</g, '\\u003c')}</script>`
      )
      out = /<\/head>/i.test(out) ? out.replace(/<\/head>/i, `${script}</head>`) : `${script}${out}`
    }
    if (compact) {
      const blurb = blurbHtml(overlay, opts.locale)
      out = insertBefore(out, /<(?:div|section)\b[^>]*(?:class="[^"]*\bpw-shop-pdp-info\b|data-pw-region=["']pdp-info["'])[^>]*>/i, blurb)
    } else {
      const hero = heroHtml(overlay, opts.locale)
      out = insertBefore(out, /<(?:div|section)\b[^>]*class="[^"]*\bpw-shop-product-layout\b[^"]*"[^>]*>/i, hero)
    }
    const storyBlock = storyHtml(overlay, opts.locale)
    out = insertBefore(out, /<(?:div|section)\b[^>]*class="[^"]*\bpw-shop-product-detail\b[^"]*"[^>]*>/i, storyBlock)
  }
  const offer = offerHtml(overlay.offerLine)
  if (offer) {
    out = out.replace(/<p\b[^>]*data-pw-pdp-slot=["']deposit["'][^>]*>[\s\S]*?<\/p>/gi, '')
    out = insertBefore(out, /<(?:div|section)\b[^>]*class="[^"]*\bpw-pdp-actions\b[^"]*"[^>]*>/i, offer)
  }
  return out
}
