import { PW_EL, PW_REGION, pwElAttr, pwRegionAttr } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import type { WebLocale } from '@/lib/i18n/config'

const STYLE_ID = 'pw-pdp-review-qa-css'

export const PW_PDP_REVIEW_QA_CSS = `
html .pw-pdp-rq-grid{display:grid;grid-template-columns:1fr;gap:12px;margin-top:16px;padding-top:16px;border-top:1px solid var(--pw-border)}
@media (min-width:768px){html .pw-pdp-rq-grid{grid-template-columns:1fr 1fr}}
html .pw-pdp-rq-card{border:1px solid var(--pw-border);border-radius:12px;box-shadow:0 1px 2px rgba(0,0,0,.04);padding:14px;min-height:180px;background:var(--pw-bg,#fff);display:flex;flex-direction:column;gap:10px}
html .pw-pdp-rq-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
html .pw-pdp-rq-head-title{margin:0;font-size:15px;font-weight:700;color:var(--pw-text)}
html .pw-pdp-rq-head-sub{margin:2px 0 0;font-size:12px;color:var(--pw-muted)}
html .pw-pdp-rq-badge{flex:none;font-size:13px;font-weight:700;color:var(--pw-buy);background:var(--pw-surface);border-radius:999px;padding:4px 8px}
html .pw-pdp-rq-sample{flex:1;font-size:13px;color:var(--pw-text)}
html .pw-pdp-rq-name{font-weight:700}
html .pw-pdp-rq-title{color:var(--pw-primary);font-weight:600;margin:4px 0}
html .pw-pdp-rq-reply{margin-top:8px;padding:8px 10px;border-left:2px solid var(--pw-primary);background:var(--pw-surface);border-radius:0 8px 8px 0;font-size:13px}
html .pw-pdp-rq-reply.buyer{border-left-color:var(--pw-border);background:transparent}
html .pw-pdp-rq-ctas{display:flex;flex-wrap:wrap;gap:8px;margin-top:auto}
html .pw-pdp-rq-ctas .pw-shop-btn{background:var(--pw-buy);color:#fff;border:none}
html .pw-pdp-rq-ctas .pw-shop-btn-outline{background:transparent;color:var(--pw-buy);border:1px solid var(--pw-buy)}
html .pw-pdp-verified{display:inline-flex;align-items:center;gap:4px;margin-left:6px;color:#15803d;font-size:11px;font-weight:600}
html .pw-pdp-helpful{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:12px;color:var(--pw-muted)}
html .pw-pdp-helpful button{border:none;background:transparent;cursor:pointer;color:#6b7280;font-size:12px}
html .pw-pdp-helpful button.is-on{color:#dc2626}
html .pw-pdp-rq-modal{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px}
html .pw-pdp-rq-modal[hidden]{display:none!important}
html .pw-pdp-rq-dialog{width:100%;max-width:42rem;max-height:90vh;overflow:auto;background:var(--pw-bg,#fff);border-radius:12px;padding:16px}
html .pw-pdp-rq-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}
html .pw-pdp-rq-strip{display:flex;gap:10px;align-items:center;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--pw-border)}
html .pw-pdp-rq-strip img{width:56px;height:56px;object-fit:cover;border-radius:8px}
html .pw-pdp-rq-list{display:grid;gap:12px}
html .pw-pdp-rq-item{background:var(--pw-surface);border-radius:10px;padding:12px}
html .nanoai-ve-active .pw-pdp-rq-modal{display:none!important}
`

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildPdpReviewQaCardsHtml(locale: WebLocale): string {
  const t = getPartnerSiteShopCopy(locale)
  return `<div class="pw-pdp-rq-grid" data-pw-rq-grid="1" ${pwRegionAttr(PW_REGION.reviews)} data-pw-bg-role="reviews">
  <section id="pw-pdp-reviews" class="pw-pdp-rq-card" data-pw-rq="reviews">
    <div class="pw-pdp-rq-head">
      <div>
        <h3 class="pw-pdp-rq-head-title" ${pwElAttr(PW_EL.sectionTitle)}>${escapeHtml(t.reviewsFromCustomers)}</h3>
        <p class="pw-pdp-rq-head-sub" data-pw-rq-review-count>0 ${escapeHtml(t.reviewsTotalSuffix)}</p>
      </div>
      <span class="pw-pdp-rq-badge" data-pw-rq-review-score>5/5 ★</span>
    </div>
    <div class="pw-pdp-rq-sample" data-pw-rq-review-sample><p class="pw-shop-muted">${escapeHtml(t.reviewsEmpty)}</p></div>
    <div class="pw-pdp-rq-ctas">
      <button type="button" class="pw-shop-btn" data-pw-rq-open-reviews>${escapeHtml(t.reviewsSeeAll)}</button>
      <button type="button" class="pw-shop-btn pw-shop-btn-outline" data-pw-rq-open-write>${escapeHtml(t.reviewsWriteButton)}</button>
    </div>
  </section>
  <section id="pw-pdp-qa" class="pw-pdp-rq-card" data-pw-pdp-slot="qa" data-pw-rq="qa">
    <div class="pw-pdp-rq-head">
      <div>
        <h3 class="pw-pdp-rq-head-title">${escapeHtml(t.qaTitle)}</h3>
        <p class="pw-pdp-rq-head-sub" data-pw-rq-qa-count>0 ${escapeHtml(t.qaCountSuffix)}</p>
      </div>
    </div>
    <div class="pw-pdp-rq-sample" data-pw-rq-qa-sample><p class="pw-shop-muted">${escapeHtml(t.qaEmpty)}</p></div>
    <div class="pw-pdp-rq-ctas">
      <button type="button" class="pw-shop-btn" data-pw-rq-open-qa>${escapeHtml(t.qaSeeMore)}</button>
    </div>
  </section>
</div>`
}

export function buildPdpReviewQaModalsHtml(locale: WebLocale): string {
  const t = getPartnerSiteShopCopy(locale)
  return `<div id="pw-pdp-reviews-modal" class="pw-pdp-rq-modal" hidden data-pw-rq-modal="reviews" role="dialog" aria-modal="true">
  <div class="pw-pdp-rq-dialog">
    <div class="pw-pdp-rq-dialog-head">
      <strong>${escapeHtml(t.reviewsTitle)}</strong>
      <div>
        <button type="button" class="pw-shop-btn" data-pw-rq-open-write>${escapeHtml(t.reviewsWriteButton)}</button>
        <button type="button" class="pw-shop-btn pw-shop-btn-outline" data-pw-rq-close>×</button>
      </div>
    </div>
    <div class="pw-pdp-rq-strip" data-pw-rq-product-strip></div>
    <div data-pw-pdp-slot="review-form" hidden></div>
    <div class="pw-pdp-rq-list" data-pw-pdp-slot="review-list"></div>
  </div>
</div>
<div id="pw-pdp-qa-modal" class="pw-pdp-rq-modal" hidden data-pw-rq-modal="qa" role="dialog" aria-modal="true">
  <div class="pw-pdp-rq-dialog">
    <div class="pw-pdp-rq-dialog-head">
      <strong>${escapeHtml(t.qaModalTitle)}</strong>
      <button type="button" class="pw-shop-btn pw-shop-btn-outline" data-pw-rq-close>×</button>
    </div>
    <div class="pw-pdp-rq-strip" data-pw-rq-product-strip></div>
    <div data-pw-pdp-slot="qa-form"></div>
    <div class="pw-pdp-rq-list" data-pw-pdp-slot="qa-list"></div>
  </div>
</div>`
}

export function injectPdpReviewQaCss(html: string): string {
  if (html.includes(STYLE_ID)) return html
  const tag = `<style id="${STYLE_ID}">${PW_PDP_REVIEW_QA_CSS}</style>`
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${tag}\n</head>`)
  return `${tag}\n${html}`
}

export function ensurePdpReviewQaCardsInBuyBox(html: string, locale: WebLocale): string {
  if (!/data-pw-page=["']product["']/.test(html) && !/data-pw-region=["']pdp-info["']/.test(html)) {
    return html
  }
  let out = injectPdpReviewQaCss(html)
  const cards = buildPdpReviewQaCardsHtml(locale)
  const modals = buildPdpReviewQaModalsHtml(locale)
  if (!/data-pw-rq-grid=/.test(out)) {
    if (/id=["']pw-pdp-reviews["']/.test(out) && /id=["']pw-pdp-qa["']/.test(out)) {
      out = out
        .replace(/<section[^>]*id=["']pw-pdp-reviews["'][\s\S]*?<\/section>/i, '')
        .replace(/<section[^>]*id=["']pw-pdp-qa["'][\s\S]*?<\/section>/i, '')
    }
    if (/pw-shop-product-detail/.test(out)) {
      const next = out.replace(
        /(<section[^>]*class=["'][^"']*pw-shop-product-detail)/i,
        `${cards}\n$1`
      )
      if (next !== out) out = next
    }
    if (!/data-pw-rq-grid=/.test(out) && /data-pw-region=["']pdp-info["']/.test(out)) {
      out = out.replace(
        /(<div[^>]*data-pw-region=["']pdp-info["'][^>]*>)/i,
        `$1\n${cards}`
      )
    }
    if (!/data-pw-rq-grid=/.test(out)) {
      out = /<\/main>/i.test(out) ? out.replace(/<\/main>/i, `${cards}</main>`) : `${out}\n${cards}`
    }
  }
  if (!/id=["']pw-pdp-reviews-modal["']/.test(out)) {
    out = /<\/body>/i.test(out) ? out.replace(/<\/body>/i, `${modals}\n</body>`) : `${out}\n${modals}`
  }
  return out
}
