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
import { PDP_LP_HIGHLIGHT_ICONS, PDP_LP_TRUST_ICONS } from '@/lib/partner-website/shop/pdp-ladipage-icons'

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

const EMPHASIS_RE = /(\d+(?:[.,]\d+)?(?:\s?%|\s?(?:cm|mm|kg|g))?)/gi

/** Tách số / % / đơn vị đo để tô đậm màu chính. */
export function splitLadipageEmphasis(text: string): Array<{ em: boolean; text: string }> {
  const parts: Array<{ em: boolean; text: string }> = []
  const re = new RegExp(EMPHASIS_RE.source, 'gi')
  let last = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    if (match.index > last) parts.push({ em: false, text: text.slice(last, match.index) })
    if (match[0]) parts.push({ em: true, text: match[0] })
    last = match.index + match[0].length
    if (!match[0]) break
  }
  if (last < text.length) parts.push({ em: false, text: text.slice(last) })
  if (!parts.length) parts.push({ em: false, text })
  return parts
}

function emphasize(text: string): string {
  return splitLadipageEmphasis(text)
    .map((part) => (part.em ? `<strong class="pw-lp-em">${esc(part.text)}</strong>` : esc(part.text)))
    .join('')
}

function iconBox(svg: string, small = false): string {
  return `<span class="pw-lp-ico${small ? ' pw-lp-ico-sm' : ''}" aria-hidden="true">${svg}</span>`
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

export const PDP_LADIPAGE_OFFER_CSS = `
.pw-lp-offer{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 0;padding:0}
.pw-lp-chip{display:inline-flex;align-items:center;padding:6px 12px;border-radius:999px;background:color-mix(in srgb,var(--pw-primary) 10%,#fff);color:var(--pw-primary);border:1px solid color-mix(in srgb,var(--pw-primary) 24%,#fff);font-size:13px;font-weight:800;line-height:1.3}
`

export const PDP_LADIPAGE_FACE_CSS = `
${PDP_LADIPAGE_OFFER_CSS}
[data-pw-pdp-ladipage]{box-sizing:border-box;color:var(--pw-text,#111827)}
.pw-lp-kicker{margin:0 0 6px;color:var(--pw-primary);font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
.pw-lp-em{color:var(--pw-primary);font-weight:800}
.pw-lp-ico{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:14px;flex:none;background:color-mix(in srgb,var(--pw-primary) 12%,#fff);color:var(--pw-primary)}
.pw-lp-ico svg{width:22px;height:22px;display:block}
.pw-lp-ico-sm{width:36px;height:36px;border-radius:999px}
.pw-lp-ico-sm svg{width:18px;height:18px}
.pw-lp-dot{width:7px;height:7px;border-radius:999px;background:var(--pw-primary);flex:none}
.pw-lp-arrow{margin-left:6px}
[data-pw-pdp-ladipage="hero"]{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:28px;align-items:center;margin:0 auto 8px;max-width:var(--pw-content,1200px);padding:28px 24px;border-radius:28px;border:1px solid color-mix(in srgb,var(--pw-primary) 18%,#fff);background:radial-gradient(circle at 0% 100%,color-mix(in srgb,var(--pw-primary) 16%,transparent),transparent 42%),radial-gradient(circle at 100% 0%,color-mix(in srgb,var(--pw-accent,var(--pw-primary)) 22%,transparent),transparent 40%),linear-gradient(135deg,color-mix(in srgb,var(--pw-primary) 8%,#fff),#fff 58%)}
[data-pw-pdp-ladipage="hero"] [data-pw-el="copy"]{display:flex;flex-direction:column;align-items:flex-start;gap:12px;position:relative;z-index:1}
[data-pw-pdp-ladipage="hero"] .pw-lp-hero-media{position:relative;z-index:1}
[data-pw-pdp-ladipage="hero"] .pw-lp-hero-media::before{content:"";position:absolute;inset:-10px;border-radius:28px;background:color-mix(in srgb,var(--pw-primary) 18%,transparent);filter:blur(16px);z-index:0}
[data-pw-pdp-ladipage="hero"] img{position:relative;z-index:1;display:block;width:100%;max-height:calc(70vh / var(--pw-scene-zoom,1));object-fit:contain;background:#fff;border-radius:22px;border:4px solid #fff;box-shadow:0 18px 40px color-mix(in srgb,var(--pw-primary) 16%,transparent)}
[data-pw-pdp-ladipage="hero"] [data-pw-el="badge"],[data-pw-pdp-ladipage="blurb"] [data-pw-el="badge"]{display:inline-flex;align-items:center;gap:8px;margin:0;padding:5px 12px;border-radius:999px;border:1px solid color-mix(in srgb,var(--pw-primary) 28%,#fff);background:color-mix(in srgb,var(--pw-primary) 10%,#fff);color:var(--pw-primary);font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
[data-pw-pdp-ladipage="hero"] [data-pw-el="title"]{margin:0;font-size:clamp(1.7rem,2.6vw,2.55rem);font-weight:800;letter-spacing:-.03em;line-height:1.12;color:#111827}
[data-pw-pdp-ladipage="hero"] [data-pw-el="subtitle"]{margin:0;max-width:36rem;font-size:1.05rem;font-weight:500;line-height:1.55;color:var(--pw-muted,#4b5563)}
[data-pw-pdp-ladipage="hero"] .pw-shop-btn-buy{border-radius:999px;font-weight:800;padding:12px 22px;margin-top:4px}
[data-pw-pdp-ladipage="trust"]{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;margin:14px auto 22px;max-width:var(--pw-content,1200px);padding:8px;border-radius:20px;background:#fff;border:1px solid var(--pw-border,#e5e7eb);box-shadow:0 8px 24px rgba(15,23,42,.05)}
[data-pw-pdp-ladipage="trust"] .pw-lp-trust-item{display:flex;align-items:flex-start;gap:12px;margin:0;padding:12px 16px;text-align:left}
[data-pw-pdp-ladipage="trust"] .pw-lp-trust-item+.pw-lp-trust-item{border-left:1px solid var(--pw-border,#e5e7eb)}
[data-pw-pdp-ladipage="trust"] strong{display:block;color:#111827;font-size:14px;font-weight:800}
[data-pw-pdp-ladipage="trust"] .pw-lp-trust-body{display:block;margin-top:3px;color:var(--pw-muted,#6b7280);font-size:12px;font-weight:500;line-height:1.45}
[data-pw-pdp-ladipage="blurb"]{margin:12px 0 8px;padding:12px 14px;border-radius:16px;background:color-mix(in srgb,var(--pw-primary) 8%,#fff);border:1px solid color-mix(in srgb,var(--pw-primary) 18%,#fff)}
[data-pw-pdp-ladipage="blurb"] [data-pw-el="subtitle"]{margin:8px 0 0;font-size:1.05rem;font-weight:800;line-height:1.4;color:#111827}
[data-pw-pdp-ladipage="story"]{display:grid;gap:36px;margin:28px auto 12px;max-width:var(--pw-content,1200px)}
[data-pw-pdp-ladipage="story"] h2{margin:0 0 16px;font-size:clamp(1.4rem,2vw,1.9rem);font-weight:800;letter-spacing:-.02em;line-height:1.15;color:#111827}
[data-pw-pdp-ladipage-highlights]{display:grid;gap:12px;grid-template-columns:1fr}
[data-pw-pdp-ladipage-card]{border:1px solid color-mix(in srgb,var(--pw-primary) 10%,var(--pw-border,#e5e7eb));background:#fff;border-radius:18px;padding:18px 16px 16px;box-shadow:0 1px 2px rgba(15,23,42,.04)}
[data-pw-pdp-ladipage-card] h3{margin:12px 0 6px;font-size:16px;font-weight:800;line-height:1.3}
[data-pw-pdp-ladipage-card] p{margin:0;color:var(--pw-muted,#4b5563);font-size:14px;line-height:1.55}
[data-pw-pdp-ladipage-material]{display:grid;gap:18px;align-items:center;padding:22px;border-radius:28px;border:1px solid color-mix(in srgb,var(--pw-primary) 12%,#fff);background:linear-gradient(135deg,var(--pw-surface,#f8fafc),color-mix(in srgb,var(--pw-primary) 7%,#fff))}
[data-pw-pdp-ladipage-material] img{width:100%;max-width:460px;aspect-ratio:1;object-fit:cover;border-radius:20px;background:#fff;box-shadow:0 12px 30px rgba(15,23,42,.08)}
[data-pw-pdp-ladipage-material] [data-pw-el="body"]{margin:10px 0 0;line-height:1.65;color:#374151}
[data-pw-pdp-ladipage-callouts]{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 0;padding:0;list-style:none}
[data-pw-pdp-ladipage-callouts] li{padding:7px 12px;border-radius:999px;background:#fff;border:1px solid color-mix(in srgb,var(--pw-primary) 28%,#fff);color:var(--pw-primary);font-size:13px;font-weight:800}
[data-pw-pdp-ladipage="trust-cta"]{position:relative;overflow:hidden;text-align:center;padding:36px 22px;border-radius:28px;border:0;color:#fff;background:radial-gradient(circle at 0 0,color-mix(in srgb,var(--pw-primary) 55%,transparent),transparent 46%),radial-gradient(circle at 100% 120%,color-mix(in srgb,var(--pw-accent,var(--pw-primary)) 42%,transparent),transparent 42%),#111827}
[data-pw-pdp-ladipage="trust-cta"] [data-pw-el="badge"]{display:inline-flex;margin:0 0 10px;padding:5px 12px;border-radius:999px;background:color-mix(in srgb,var(--pw-primary) 78%,#fff);color:#111827;font-weight:800}
[data-pw-pdp-ladipage="trust-cta"] [data-pw-el="subtitle"]{margin:8px auto 0;max-width:40rem;color:#fff;font-size:1.15rem;font-weight:650;line-height:1.5}
[data-pw-pdp-ladipage="trust-cta"] .pw-lp-em{color:color-mix(in srgb,var(--pw-primary) 28%,#fff)}
[data-pw-pdp-ladipage="trust-cta"] .pw-shop-btn-buy{margin-top:18px;border-radius:999px;background:#fff;color:#111827;font-weight:800;padding:13px 26px}
[data-pw-pdp-ladipage="trust-cta"] .pw-lp-foot{margin:12px 0 0;color:color-mix(in srgb,#fff 72%,transparent);font-size:12px}
.pw-lp-faq{overflow:hidden;border:1px solid var(--pw-border,#e5e7eb);border-radius:18px;background:#fff;box-shadow:0 1px 2px rgba(15,23,42,.04)}
[data-pw-pdp-ladipage="story"] .pw-lp-faq details{border:0;border-bottom:1px solid var(--pw-border,#e5e7eb);border-radius:0;padding:16px 16px;margin:0;background:transparent}
[data-pw-pdp-ladipage="story"] .pw-lp-faq details:last-child{border-bottom:0}
[data-pw-pdp-ladipage="story"] summary{display:flex;align-items:center;justify-content:space-between;gap:12px;font-weight:800;cursor:pointer;list-style:none;color:#111827}
[data-pw-pdp-ladipage="story"] summary::-webkit-details-marker{display:none}
[data-pw-pdp-ladipage="story"] summary::after{content:"+";display:grid;place-items:center;width:28px;height:28px;border-radius:999px;background:color-mix(in srgb,var(--pw-primary) 12%,#fff);color:var(--pw-primary);font-weight:700;flex:none}
[data-pw-pdp-ladipage="story"] details[open] summary::after{content:"–"}
[data-pw-pdp-ladipage="story"] details p{margin:10px 0 0;color:var(--pw-muted,#4b5563);font-size:14px;line-height:1.55}
@media (min-width:640px){[data-pw-pdp-ladipage-highlights]{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (min-width:768px){[data-pw-pdp-ladipage-material]{grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr)}}
@media (min-width:1024px){[data-pw-pdp-ladipage-highlights]{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:720px){
  [data-pw-pdp-ladipage="hero"]{grid-template-columns:1fr;padding:18px 14px}
  [data-pw-pdp-ladipage="trust"]{grid-template-columns:1fr}
  [data-pw-pdp-ladipage="trust"] .pw-lp-trust-item+.pw-lp-trust-item{border-left:0;border-top:1px solid var(--pw-border,#e5e7eb)}
}
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
      (point, index) =>
        `<div class="pw-lp-trust-item" data-pw-el="subtitle">${iconBox(PDP_LP_TRUST_ICONS[index % PDP_LP_TRUST_ICONS.length] || '', true)}<div><strong>${esc(point.title)}</strong><span class="pw-lp-trust-body">${esc(point.body)}</span></div></div>`
    )
    .join('')
  return wrap(
    'hero',
    `<section data-pw-pdp-ladipage="hero" data-pw-region="banner">
      <div data-pw-el="copy">
        <p data-pw-el="badge"><span class="pw-lp-dot" aria-hidden="true"></span>${esc(shop.lpSuggestedForYou)}</p>
        ${visible.showHeadline ? `<h2 data-pw-el="title">${esc(story.hero.headline || '')}</h2>` : ''}
        ${visible.showSub ? `<p data-pw-el="subtitle">${emphasize(story.hero.subheadline || '')}</p>` : ''}
        <button type="button" class="pw-shop-btn pw-shop-btn-buy" data-pw-el="cta" data-pw-buy data-pw-pdp-buy-now="1" data-pw-ladipage-buy="1">${esc(shop.buyNow)}<span class="pw-lp-arrow" aria-hidden="true">→</span></button>
      </div>
      ${image ? `<div class="pw-lp-hero-media"><img data-pw-el="media" src="${esc(image)}" alt="${esc(input.productName)}"/></div>` : ''}
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
      <p data-pw-el="badge"><span class="pw-lp-dot" aria-hidden="true"></span>${esc(shop.lpSuggestedForYou)}</p>
      ${sentence ? `<p data-pw-el="subtitle">${emphasize(sentence)}</p>` : ''}
    </div>`
  )
}

function storyHtml(input: PdpLadipageOverlay, locale: WebLocale): string {
  const story = input.story
  if (!story) return ''
  const shop = getPartnerSiteShopCopy(locale)
  const highlights = story.highlights.length
    ? `<section data-pw-region="content"><p class="pw-lp-kicker">${esc(shop.lpWhyKicker)}</p><h2 data-pw-el="heading">${esc(shop.lpHighlightsHeading)}</h2><div data-pw-pdp-ladipage-highlights>${story.highlights
        .map(
          (item, index) =>
            `<article data-pw-pdp-ladipage-card>${iconBox(PDP_LP_HIGHLIGHT_ICONS[index % PDP_LP_HIGHLIGHT_ICONS.length] || '')}<h3 data-pw-el="title"><span class="pw-lp-em">${esc(item.title)}</span></h3><p data-pw-el="body">${emphasize(item.desc)}</p></article>`
        )
        .join('')}</div></section>`
    : ''
  const callouts = (story.material?.callouts ?? []).map((item) => item.trim()).filter(Boolean)
  const material = story.material && (story.material.body || story.material.imageUrl || story.material.material)
    ? `<section data-pw-region="content" data-pw-pdp-ladipage-material="1">
        ${story.material.imageUrl ? `<img data-pw-el="image" src="${esc(story.material.imageUrl)}" alt="${esc(story.material.material || '')}"/>` : ''}
        <div>
          <p class="pw-lp-kicker">${esc(shop.lpMaterialKicker)}</p>
          <h2 data-pw-el="title">${esc(shop.lpMaterialHeading)}${story.material.material ? ` <span class="pw-lp-em">${esc(story.material.material)}</span>` : ''}</h2>
          ${story.material.body ? `<p data-pw-el="body">${emphasize(story.material.body)}</p>` : ''}
          ${callouts.length ? `<ul data-pw-pdp-ladipage-callouts>${callouts.map((item) => `<li>${emphasize(item)}</li>`).join('')}</ul>` : ''}
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
        <p class="pw-lp-kicker" style="color:#fff">${esc(shop.lpReadyKicker)}</p>
        ${rating}
        <p data-pw-el="subtitle">${emphasize(story.trust.body)}</p>
        <button type="button" class="pw-shop-btn pw-shop-btn-buy" data-pw-el="cta" data-pw-buy data-pw-pdp-buy-now="1" data-pw-ladipage-buy="1">${esc(story.trust.ctaLabel || shop.buyNow)}<span class="pw-lp-arrow" aria-hidden="true">→</span></button>
        <p class="pw-lp-foot">${esc(shop.lpTrustFoot)}</p>
      </section>`
    : ''
  const faq = story.faq.length
    ? `<section data-pw-region="content"><p class="pw-lp-kicker">${esc(shop.lpFaqKicker)}</p><h2 data-pw-el="title">${esc(shop.lpFaqHeading)}</h2><div class="pw-lp-faq">${story.faq
        .map(
          (item) =>
            `<details data-pw-el="faq-item"><summary>${esc(item.q)}</summary><p data-pw-el="body">${emphasize(item.a)}</p></details>`
        )
        .join('')}</div></section>`
    : ''
  const inner = `${highlights}${material}${trust}${faq}`
  if (!inner) return ''
  return wrap('story', `<div data-pw-pdp-ladipage="story">${inner}</div>`)
}

function offerHtml(line: string): string {
  const parts = line
    .split(' · ')
    .map((part) => part.trim())
    .filter(Boolean)
  if (!parts.length) return ''
  return wrap(
    'offer',
    `<p class="pw-lp-offer" data-pw-pdp-slot="deposit" data-pw-pdp-offer="1">${parts
      .map((part) => `<strong class="pw-lp-chip">${esc(part)}</strong>`)
      .join('')}</p>`
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
  if (story || overlay.offerLine.trim()) {
    if (!out.includes('data-pw-pdp-ladipage-css')) {
      const css = wrap('css', CSS)
      out = /<\/head>/i.test(out) ? out.replace(/<\/head>/i, `${css}</head>`) : `${css}${out}`
    }
  }
  if (story) {
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
