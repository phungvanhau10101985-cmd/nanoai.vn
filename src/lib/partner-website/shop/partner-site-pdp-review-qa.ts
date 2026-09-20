import { PW_EL, PW_REGION, pwElAttr, pwRegionAttr } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import type { WebLocale } from '@/lib/i18n/config'

const STYLE_ID = 'pw-pdp-review-qa-css'

export const PW_PDP_REVIEW_STAR_ICON =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'

export const PW_PDP_REVIEW_QA_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'

export const PW_PDP_HELPFUL_THUMB_ICON =
  '<svg class="pw-pdp-helpful-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 11H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h3z"/></svg>'

export const PW_PDP_REVIEW_QA_CSS = `
html .pw-pdp-rq-grid{display:grid;grid-template-columns:1fr;gap:12px;margin-top:16px;padding-top:16px;border-top:1px solid var(--pw-border)}
@media (min-width:1024px){html:not([data-pw-edit-device]):not([data-pw-scene-lock]) .pw-pdp-rq-grid{grid-template-columns:1fr 1fr}}
html[data-pw-edit-device="desktop"] .pw-pdp-rq-grid,html[data-pw-edit-device="laptop"] .pw-pdp-rq-grid,html[data-pw-scene-lock="desktop"] .pw-pdp-rq-grid,html[data-pw-scene-lock="laptop"] .pw-pdp-rq-grid{grid-template-columns:1fr 1fr}
html .pw-pdp-rq-card{border:1px solid var(--pw-border);border-radius:12px;box-shadow:0 1px 2px rgba(0,0,0,.04);padding:0;overflow:hidden;min-height:180px;background:var(--pw-bg,#fff);display:flex;flex-direction:column}
html .pw-pdp-rq-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-bottom:1px solid var(--pw-border);background:linear-gradient(to right,var(--pw-surface),var(--pw-bg,#fff))}
html .pw-pdp-rq-head-row{display:flex;align-items:center;gap:8px;min-width:0}
html .pw-pdp-rq-icon{display:flex;width:32px;height:32px;flex:none;align-items:center;justify-content:center;border-radius:8px}
html .pw-pdp-rq-icon svg{width:16px;height:16px}
html .pw-pdp-rq-icon-review{background:color-mix(in srgb,#f59e0b 18%,#fff);color:#d97706}
html .pw-pdp-rq-icon-qa{background:color-mix(in srgb,var(--pw-primary) 16%,#fff);color:var(--pw-primary)}
html .pw-pdp-rq-head-title{margin:0;font-size:14px;font-weight:700;color:var(--pw-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
html .pw-pdp-rq-head-sub{margin:2px 0 0;font-size:12px;color:var(--pw-muted)}
html .pw-pdp-rq-badge{flex:none;display:inline-flex;align-items:center;gap:4px;font-size:13px;font-weight:700;color:#d97706;background:color-mix(in srgb,#f59e0b 12%,#fff);border-radius:8px;padding:4px 8px}
html .pw-pdp-rq-body{padding:12px;flex:1;display:flex;flex-direction:column;min-height:0}
html .pw-pdp-rq-sample{flex:1;font-size:13px;color:var(--pw-text);display:flex;flex-direction:column;min-height:0}
html .pw-pdp-rq-sample-box{border:1px solid var(--pw-border);background:color-mix(in srgb,var(--pw-surface) 60%,#fff);border-radius:8px;padding:10px;flex:1}
html .pw-pdp-rq-sample-box .pw-pdp-rq-item{background:transparent;padding:0;border-radius:0}
html .pw-pdp-rq-name{font-weight:700}
html .pw-pdp-rq-title{color:var(--pw-primary);font-weight:600;margin:4px 0}
html .pw-pdp-rq-reply{margin-top:8px;padding:6px 8px;border-left:2px solid var(--pw-primary);background:color-mix(in srgb,var(--pw-primary) 8%,#fff);border-radius:0 8px 8px 0;font-size:12px}
html .pw-pdp-rq-reply.buyer{border-left-color:var(--pw-border);background:var(--pw-surface,#f9fafb);color:var(--pw-muted)}
html .pw-pdp-rq-ctas{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid var(--pw-border)}
html .pw-pdp-rq-ctas .pw-shop-btn{background:var(--pw-buy);color:#fff;border:none;flex:1;min-width:100px}
html .pw-pdp-rq-ctas .pw-shop-btn-outline{background:transparent;color:var(--pw-buy);border:1px solid var(--pw-buy);flex:none}
html .pw-pdp-rq-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px 12px;flex:1}
html .pw-pdp-rq-empty-icon{width:48px;height:48px;border-radius:999px;display:flex;align-items:center;justify-content:center;margin-bottom:8px}
html .pw-pdp-rq-empty-icon svg{width:24px;height:24px}
html .pw-pdp-rq-empty-icon.pw-pdp-rq-icon-review{background:color-mix(in srgb,#f59e0b 12%,#fff);color:#fbbf24}
html .pw-pdp-rq-empty-icon.pw-pdp-rq-icon-qa{background:var(--pw-surface);color:var(--pw-muted)}
html .pw-pdp-rq-item-head{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
html .pw-pdp-rq-who{display:flex;align-items:center;flex-wrap:wrap;gap:6px 8px;min-width:0}
html .pw-pdp-rq-who>strong{min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
html .pw-pdp-rq-date{margin-top:2px;font-size:12px}
html .pw-pdp-rq-meta-side{font-size:12px;font-weight:400;color:var(--pw-muted);white-space:nowrap}
html .pw-pdp-verified{display:inline-flex;align-items:center;gap:4px;flex:none;white-space:nowrap;color:#15803d;font-size:11px;font-weight:700;line-height:1;background:color-mix(in srgb,#16a34a 10%,#fff);border:1px solid color-mix(in srgb,#16a34a 22%,#fff);border-radius:999px;padding:3px 8px 3px 5px;vertical-align:middle}
html .pw-pdp-verified-icon{width:13px;height:13px;flex:none;display:block}
html .pw-pdp-verified-label{white-space:nowrap}
html .pw-pdp-rq-toast{position:fixed;top:16px;right:16px;z-index:110;max-width:min(360px,calc(100vw - 32px));background:#111827;color:#fff;padding:10px 14px;border-radius:8px;font-size:13px;line-height:1.4;box-shadow:0 8px 24px rgba(0,0,0,.18)}
html .pw-pdp-rq-toast[hidden]{display:none!important}
html .pw-pdp-rq-need-buy{margin-bottom:12px;padding:16px;border:1px solid var(--pw-border);border-radius:12px;background:var(--pw-surface,#f9fafb);font-size:14px;color:var(--pw-text)}
html .pw-pdp-rq-need-buy p{margin:0 0 12px}
html .pw-pdp-helpful{display:flex;align-items:center;justify-content:flex-start;margin-top:10px;padding-top:8px;border-top:1px solid var(--pw-border)}
html .pw-pdp-helpful-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--pw-border);background:#fff;cursor:pointer;color:#4b5563;font-size:12px;font-weight:600;line-height:1;border-radius:999px;padding:6px 12px 6px 10px;min-height:32px}
html .pw-pdp-helpful-btn:hover{border-color:var(--pw-primary);color:var(--pw-primary);background:color-mix(in srgb,var(--pw-primary) 8%,#fff)}
html .pw-pdp-helpful-btn:active{transform:scale(.97)}
html .pw-pdp-helpful-btn:focus-visible{outline:2px solid var(--pw-primary);outline-offset:2px}
html .pw-pdp-helpful-btn.is-on{border-color:color-mix(in srgb,var(--pw-primary) 42%,#fff);background:color-mix(in srgb,var(--pw-primary) 14%,#fff);color:var(--pw-primary)}
html .pw-pdp-helpful-btn[data-pw-busy]{opacity:.72;pointer-events:none}
html .pw-pdp-helpful-icon{width:15px;height:15px;flex:none;display:block}
html .pw-pdp-helpful-n{font-variant-numeric:tabular-nums;font-weight:700;min-width:1.15em;text-align:center}
html .pw-pdp-helpful-label{white-space:nowrap}
html .pw-pdp-qa-reply-link{background:none;border:none;padding:0;color:var(--pw-buy);cursor:pointer;font-size:12px;font-weight:600}
html .pw-pdp-qa-reply-link:hover{text-decoration:underline}
html .pw-pdp-qa-answer-form{margin-top:8px;display:grid;gap:8px}
html .pw-pdp-qa-answer-form[hidden]{display:none!important}
html .pw-pdp-qa-answer-actions{display:flex;gap:8px;flex-wrap:wrap}
html .pw-pdp-qa-ask-title{margin:0 0 8px;font-size:14px;font-weight:600;color:var(--pw-text)}
html .pw-pdp-qa-ask-form{display:flex;flex-direction:column;gap:8px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--pw-border)}
html .pw-pdp-qa-login-banner{border:1px solid color-mix(in srgb,var(--pw-primary) 35%,#fff);background:color-mix(in srgb,var(--pw-primary) 8%,#fff);border-radius:8px;padding:12px 16px;margin-bottom:12px;font-size:14px;color:var(--pw-text)}
html .pw-pdp-qa-login-banner p{margin:0 0 12px}
html .pw-pdp-rq-modal{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px}
html .pw-pdp-rq-modal[hidden]{display:none!important}
html .pw-pdp-rq-dialog{width:100%;max-width:42rem;max-height:90vh;overflow:auto;background:var(--pw-bg,#fff);border-radius:12px;padding:16px}
html .pw-pdp-rq-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}
html .pw-pdp-rq-strip{display:flex;gap:10px;align-items:center;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--pw-border)}
html .pw-pdp-rq-strip img{width:56px;height:56px;object-fit:cover;border-radius:8px}
html .pw-pdp-rq-list{display:grid;gap:12px}
html .pw-pdp-rq-item{background:var(--pw-surface);border-radius:10px;padding:12px}
html .pw-pdp-rq-item:target{outline:2px solid var(--pw-primary);outline-offset:2px}
html .nanoai-ve-active .pw-pdp-rq-modal{display:none!important}
`

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function emptyStateHtml(kind: 'review' | 'qa', label: string): string {
  const icon = kind === 'review' ? PW_PDP_REVIEW_STAR_ICON : PW_PDP_REVIEW_QA_ICON
  const cls = kind === 'review' ? 'pw-pdp-rq-icon-review' : 'pw-pdp-rq-icon-qa'
  return `<div class="pw-pdp-rq-empty"><span class="pw-pdp-rq-empty-icon ${cls}" aria-hidden="true">${icon}</span><p class="pw-shop-muted">${escapeHtml(label)}</p></div>`
}

export function buildPdpReviewQaCardsHtml(locale: WebLocale): string {
  const t = getPartnerSiteShopCopy(locale)
  return `<div class="pw-pdp-rq-grid" data-pw-rq-grid="1" data-pw-pdp-slot="reviews-qa" ${pwRegionAttr(PW_REGION.reviews)} data-pw-bg-role="reviews">
  <section id="pw-pdp-reviews" class="pw-pdp-rq-card" data-pw-rq="reviews">
    <div class="pw-pdp-rq-head">
      <div class="pw-pdp-rq-head-row">
        <span class="pw-pdp-rq-icon pw-pdp-rq-icon-review" aria-hidden="true">${PW_PDP_REVIEW_STAR_ICON}</span>
        <div>
          <h3 class="pw-pdp-rq-head-title" ${pwElAttr(PW_EL.sectionTitle)}>${escapeHtml(t.reviewsFromCustomers)}</h3>
          <p class="pw-pdp-rq-head-sub" data-pw-rq-review-count>0 ${escapeHtml(t.reviewsTotalSuffix)}</p>
        </div>
      </div>
      <span class="pw-pdp-rq-badge" data-pw-rq-review-score>0/5 ★</span>
    </div>
    <div class="pw-pdp-rq-body">
      <div class="pw-pdp-rq-sample" data-pw-rq-review-sample>${emptyStateHtml('review', t.reviewsEmpty)}</div>
      <div class="pw-pdp-rq-ctas">
        <button type="button" class="pw-shop-btn" data-pw-rq-open-reviews>${escapeHtml(t.reviewsSeeMore)}</button>
        <button type="button" class="pw-shop-btn pw-shop-btn-outline" data-pw-rq-open-write>${escapeHtml(t.reviewsWriteButton)}</button>
      </div>
    </div>
  </section>
  <section id="pw-pdp-qa" class="pw-pdp-rq-card" data-pw-pdp-slot="qa" data-pw-rq="qa">
    <div class="pw-pdp-rq-head">
      <div class="pw-pdp-rq-head-row">
        <span class="pw-pdp-rq-icon pw-pdp-rq-icon-qa" aria-hidden="true">${PW_PDP_REVIEW_QA_ICON}</span>
        <div>
          <h3 class="pw-pdp-rq-head-title">${escapeHtml(t.qaTitle)}</h3>
          <p class="pw-pdp-rq-head-sub" data-pw-rq-qa-count>0 ${escapeHtml(t.qaCountSuffix)}</p>
        </div>
      </div>
    </div>
    <div class="pw-pdp-rq-body">
      <div class="pw-pdp-rq-sample" data-pw-rq-qa-sample>${emptyStateHtml('qa', t.qaEmpty)}</div>
      <div class="pw-pdp-rq-ctas">
        <button type="button" class="pw-shop-btn" data-pw-rq-open-qa>${escapeHtml(t.qaSeeList)}</button>
      </div>
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
  const tag = `<style id="${STYLE_ID}">${PW_PDP_REVIEW_QA_CSS}</style>`
  if (html.includes(`id="${STYLE_ID}"`) || html.includes(`id='${STYLE_ID}'`)) {
    return html.replace(/<style\b[^>]*id=["']pw-pdp-review-qa-css["'][^>]*>[\s\S]*?<\/style>/i, tag)
  }
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
    if (/data-pw-pdp-slot=["']reviews-qa["']/.test(out)) {
      out = out.replace(
        /<[^>]*data-pw-pdp-slot=["']reviews-qa["'][^>]*>[\s\S]*?<\/(?:div|section)>/i,
        cards
      )
    }
    if (!/data-pw-rq-grid=/.test(out) && /\bpw-pdp-actions\b/.test(out)) {
      const next = out.replace(
        /(<div\b[^>]*\bpw-pdp-actions\b[^>]*>[\s\S]*?<\/div>)/i,
        `$1\n${cards}`
      )
      if (next !== out) out = next
    }
    if (!/data-pw-rq-grid=/.test(out) && /pw-shop-product-detail/.test(out)) {
      const next = out.replace(
        /(<section[^>]*class=["'][^"']*pw-shop-product-detail)/i,
        `${cards}\n$1`
      )
      if (next !== out) out = next
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
