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

export const PW_PDP_RQ_CLOSE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>'

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
html .pw-pdp-rq-ctas-wide .pw-shop-btn{flex:1 1 100%;width:100%}
html .pw-pdp-rq-ctas-empty{justify-content:center;border-top:none;margin-top:0;padding-top:0}
html .pw-pdp-rq-ctas-empty .pw-shop-btn{flex:none;width:auto}
html .pw-pdp-rq-body:has(.pw-pdp-rq-empty) .pw-pdp-rq-ctas{border-top:none;margin-top:0;padding-top:0;justify-content:center}
html .pw-pdp-rq-ctas-empty .pw-shop-btn-outline,
html .pw-pdp-rq-body:has(.pw-pdp-rq-empty) .pw-pdp-rq-ctas .pw-shop-btn-outline{color:#374151;border-color:#d1d5db;background:transparent}
html .pw-pdp-rq-list-heading{font-size:16px;font-weight:700;color:var(--pw-text);border-bottom:1px solid var(--pw-border);padding:0 0 8px;margin:16px 0 12px}
html .pw-pdp-rq-list-heading:first-child{margin-top:0}
html .pw-pdp-rq-item.is-mine{border-color:color-mix(in srgb,var(--pw-primary) 40%,#fff);background:color-mix(in srgb,var(--pw-primary) 8%,#fff)}
html .pw-pdp-rq-mine-badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:var(--pw-buy);color:#fff;margin-bottom:4px}
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
html .pw-pdp-rq-need-buy .pw-shop-btn{width:100%;background:#e5e7eb;color:#1f2937;border:none}
html .pw-pdp-helpful{display:flex;align-items:center;flex-wrap:wrap;gap:8px;justify-content:flex-start;margin-top:8px;padding-top:4px}
html .pw-pdp-helpful-n{font-size:12px;font-weight:400;color:var(--pw-muted);line-height:1.3}
html .pw-pdp-helpful-n[hidden],html .pw-pdp-helpful-n[data-pw-helpful-n="0"]{display:none!important}
html .pw-pdp-helpful-btn{display:inline-flex;align-items:center;gap:4px;border:none;background:#f3f4f6;cursor:pointer;color:#4b5563;font-size:12px;font-weight:600;line-height:1;border-radius:6px;padding:4px 8px}
html .pw-pdp-helpful-btn:hover{background:#e5e7eb}
html .pw-pdp-helpful-btn:active{transform:scale(.97)}
html .pw-pdp-helpful-btn:focus-visible{outline:2px solid var(--pw-primary);outline-offset:2px}
html .pw-pdp-helpful-btn.is-on{background:color-mix(in srgb,var(--pw-primary) 16%,#fff);color:var(--pw-primary)}
html .pw-pdp-helpful-btn[data-pw-busy]{opacity:.55;pointer-events:none}
html .pw-pdp-helpful-icon{width:12px;height:12px;flex:none;display:block}
html .pw-pdp-helpful-label{white-space:nowrap}
html .pw-pdp-rq-modal .pw-pdp-helpful-btn{font-size:14px;padding:4px 10px;gap:6px;border-radius:4px}
html .pw-pdp-rq-modal .pw-pdp-helpful-icon{width:16px;height:16px}
html .pw-pdp-rq-modal .pw-pdp-helpful-btn.is-on{background:var(--pw-primary);color:#fff}
html .pw-pdp-qa-reply-link{background:none;border:none;padding:0;color:var(--pw-buy);cursor:pointer;font-size:12px;font-weight:600}
html .pw-pdp-qa-reply-link:hover{text-decoration:underline}
html .pw-pdp-qa-answer-form{margin-top:8px;display:grid;gap:8px}
html .pw-pdp-qa-answer-form[hidden]{display:none!important}
html .pw-pdp-qa-answer-actions{display:flex;gap:8px;flex-wrap:wrap}
html .pw-pdp-qa-ask-title{margin:0 0 8px;font-size:14px;font-weight:600;color:var(--pw-text)}
html .pw-pdp-qa-ask-form{display:flex;flex-direction:column;gap:8px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--pw-border)}
html .pw-pdp-qa-ask-form-row{display:flex;flex-direction:column;gap:8px}
@media (min-width:640px){html .pw-pdp-qa-ask-form-row{flex-direction:row;align-items:flex-start}}
html .pw-pdp-qa-ask-form textarea{flex:1;min-width:0;resize:none;border:1px solid var(--pw-border);border-radius:8px;padding:8px 12px;font-size:14px}
html .pw-pdp-qa-ask-form .pw-shop-btn{flex:none;align-self:stretch}
html .pw-pdp-qa-login-banner{border:1px solid color-mix(in srgb,var(--pw-primary) 35%,#fff);background:color-mix(in srgb,var(--pw-primary) 8%,#fff);border-radius:8px;padding:12px 16px;margin-bottom:12px;font-size:14px;color:var(--pw-text)}
html .pw-pdp-qa-login-banner p{margin:0 0 12px}
html .pw-pdp-rq-modal{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px}
html .pw-pdp-rq-modal[hidden]{display:none!important}
html .pw-pdp-rq-modal[data-pw-rq-modal="write"]{z-index:81}
html .pw-pdp-rq-dialog{width:100%;max-width:42rem;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;background:var(--pw-bg,#fff);border-radius:12px;padding:0;box-shadow:0 20px 40px rgba(0,0,0,.18)}
html .pw-pdp-rq-dialog-write{max-width:28rem}
html .pw-pdp-rq-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0;padding:12px 16px;border-bottom:1px solid var(--pw-border);flex:none}
html .pw-pdp-rq-dialog-head>strong{font-size:18px;font-weight:600;color:var(--pw-text)}
html .pw-pdp-rq-dialog-head-actions{display:flex;align-items:center;gap:8px}
html .pw-pdp-rq-dialog-head .pw-shop-btn{padding:6px 12px;font-size:14px}
html .pw-pdp-rq-dialog-body{overflow:auto;flex:1;padding:16px;min-height:0}
html .pw-pdp-rq-close{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;padding:0;border:none;background:transparent;border-radius:8px;color:#6b7280;cursor:pointer}
html .pw-pdp-rq-close:hover{background:#f3f4f6;color:#374151}
html .pw-pdp-rq-close svg{width:24px;height:24px;display:block}
html .pw-pdp-write-form{display:grid;gap:16px}
html .pw-pdp-write-star-caption{margin:0 0 8px;font-size:14px;font-weight:500;color:var(--pw-text)}
html .pw-pdp-write-stars{display:flex;align-items:center;gap:4px}
html .pw-pdp-write-stars [data-pw-review-star]{font-size:1.875rem;line-height:1;background:none;border:none;cursor:pointer;color:#f59e0b;padding:0}
html .pw-pdp-write-form label{display:block;font-size:14px;font-weight:500;margin:0 0 4px;color:var(--pw-text)}
html .pw-pdp-write-form textarea{width:100%;border:1px solid var(--pw-border);border-radius:8px;padding:8px 12px;font-size:14px;resize:none}
html .pw-pdp-write-media{display:flex;gap:8px;color:#9ca3af;font-size:14px;flex-wrap:wrap}
html .pw-pdp-write-media span{padding:8px 12px;border:1px dashed var(--pw-border);border-radius:8px}
html .pw-pdp-write-note{margin:0;font-size:12px;color:#dc2626}
html .pw-pdp-write-form .pw-shop-btn{width:100%;padding:12px}
html .pw-pdp-rq-strip{display:flex;gap:12px;align-items:center;margin-bottom:16px;padding:12px;border-radius:8px;background:var(--pw-surface,#f9fafb)}
html .pw-pdp-rq-strip img{width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid var(--pw-border);background:#fff}
html .pw-pdp-rq-list{display:grid;gap:16px}
html .pw-pdp-rq-item{background:var(--pw-surface);border-radius:10px;padding:16px}
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

export function pdpReviewQaEmptySampleInner(kind: 'review' | 'qa', locale: WebLocale): string {
  const t = getPartnerSiteShopCopy(locale)
  return emptyStateHtml(kind, kind === 'review' ? t.reviewsEmpty : t.qaEmpty)
}

function maskHtmlForTagScan(html: string): string {
  return html.replace(
    /<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi,
    (block) => ' '.repeat(block.length)
  )
}

function closingTagIndex(masked: string, from: number, tag: string): number {
  const re = new RegExp(`<${tag}\\b[^>]*>|</${tag}\\s*>`, 'gi')
  re.lastIndex = from
  let depth = 1
  let match: RegExpExecArray | null
  while ((match = re.exec(masked))) {
    if (match[0][1] === '/') {
      depth -= 1
      if (depth === 0) return match.index
      continue
    }
    if (!/\/>$/.test(match[0])) depth += 1
  }
  return -1
}

/** Replace inners of boolean attrs like `data-pw-rq-review-sample` without stopping at the first nested `</div>`. */
export function replaceBooleanAttrInners(
  html: string,
  attr: string,
  inner: string
): string {
  const masked = maskHtmlForTagScan(html)
  const attrRe = attr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const openRe = new RegExp(`<([a-z0-9]+)\\b(?=[^>]*\\b${attrRe}(?:[\\s=/>]))[^>]*>`, 'gi')
  const chunks: Array<{ start: number; end: number; next: string }> = []
  let match: RegExpExecArray | null
  while ((match = openRe.exec(masked))) {
    const tag = (match[1] || 'div').toLowerCase()
    const start = match.index
    const openEnd = start + match[0].length
    const close = closingTagIndex(masked, openEnd, tag)
    if (close < 0) continue
    const closeTok = html.slice(close).match(new RegExp(`^</${tag}\\s*>`, 'i'))?.[0] ?? `</${tag}>`
    const end = close + closeTok.length
    openRe.lastIndex = end
    chunks.push({
      start,
      end,
      next: `${html.slice(start, openEnd)}${inner}${closeTok}`,
    })
  }
  if (!chunks.length) return html
  let out = ''
  let cursor = 0
  for (const chunk of chunks) {
    out += html.slice(cursor, chunk.start)
    out += chunk.next
    cursor = chunk.end
  }
  return out + html.slice(cursor)
}

export function replacePdpReviewQaSampleInners(
  html: string,
  reviewInner: string,
  qaInner: string
): string {
  const withReview = replaceBooleanAttrInners(html, 'data-pw-rq-review-sample', reviewInner)
  return replaceBooleanAttrInners(withReview, 'data-pw-rq-qa-sample', qaInner)
}

function replaceElTextByAttr(html: string, attr: string, text: string): string {
  const attrRe = attr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return html.replace(
    new RegExp(`(<[^>]*\\b${attrRe}\\b[^>]*>)[\\s\\S]*?(</)`, 'i'),
    `$1${text}$2`
  )
}

export function stampPdpReviewQaCounts(
  html: string,
  locale: WebLocale,
  counts?: { reviewsCount?: number | null; ratingScore?: number | null; questionsCount?: number | null }
): string {
  const t = getPartnerSiteShopCopy(locale)
  const reviews = Math.max(0, Math.round(Number(counts?.reviewsCount ?? 0) || 0))
  const questions = Math.max(0, Math.round(Number(counts?.questionsCount ?? 0) || 0))
  const score = Number(counts?.ratingScore ?? 0) || 0
  let out = replaceElTextByAttr(html, 'data-pw-rq-review-count', `${reviews} ${escapeHtml(t.reviewsTotalSuffix)}`)
  out = replaceElTextByAttr(out, 'data-pw-rq-review-score', `${score ? score.toFixed(1) : '0'}/5 ★`)
  return replaceElTextByAttr(out, 'data-pw-rq-qa-count', `${questions} ${escapeHtml(t.qaCountSuffix)}`)
}

/** Live leftover from the editor dress demo — wipe sample bodies, keep card chrome. */
export function resetPdpReviewQaSamplesInHtml(html: string, locale: WebLocale): string {
  if (!/data-pw-rq-review-sample|data-pw-rq-qa-sample/.test(html)) return html
  return stampPdpReviewQaCounts(
    replacePdpReviewQaSampleInners(
      html,
      pdpReviewQaEmptySampleInner('review', locale),
      pdpReviewQaEmptySampleInner('qa', locale)
    ),
    locale,
    { reviewsCount: 0, ratingScore: 0, questionsCount: 0 }
  )
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
      <div class="pw-pdp-rq-ctas pw-pdp-rq-ctas-empty">
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
      <div class="pw-pdp-rq-ctas pw-pdp-rq-ctas-wide pw-pdp-rq-ctas-empty">
        <button type="button" class="pw-shop-btn" data-pw-rq-open-qa>${escapeHtml(t.qaSeeList)}</button>
      </div>
    </div>
  </section>
</div>`
}

function pdpRqCloseButtonHtml(locale: WebLocale): string {
  const t = getPartnerSiteShopCopy(locale)
  return `<button type="button" class="pw-pdp-rq-close" data-pw-rq-close aria-label="${escapeHtml(t.reviewsCloseAria)}">${PW_PDP_RQ_CLOSE_ICON}</button>`
}

export function buildPdpReviewWriteModalHtml(locale: WebLocale): string {
  const t = getPartnerSiteShopCopy(locale)
  return `<div id="pw-pdp-write-modal" class="pw-pdp-rq-modal" hidden data-pw-rq-modal="write" role="dialog" aria-modal="true">
  <div class="pw-pdp-rq-dialog pw-pdp-rq-dialog-write">
    <div class="pw-pdp-rq-dialog-head">
      <strong>${escapeHtml(t.reviewsTitle)}</strong>
      ${pdpRqCloseButtonHtml(locale)}
    </div>
    <div class="pw-pdp-rq-dialog-body" data-pw-pdp-slot="review-form"></div>
  </div>
</div>`
}

export function buildPdpReviewQaModalsHtml(locale: WebLocale): string {
  const t = getPartnerSiteShopCopy(locale)
  const closeBtn = pdpRqCloseButtonHtml(locale)
  return `<div id="pw-pdp-reviews-modal" class="pw-pdp-rq-modal" hidden data-pw-rq-modal="reviews" role="dialog" aria-modal="true">
  <div class="pw-pdp-rq-dialog">
    <div class="pw-pdp-rq-dialog-head">
      <strong>${escapeHtml(t.reviewsTitle)}</strong>
      <div class="pw-pdp-rq-dialog-head-actions">
        <button type="button" class="pw-shop-btn pw-shop-btn-outline" data-pw-rq-open-write>${escapeHtml(t.reviewsWriteButton)}</button>
        ${closeBtn}
      </div>
    </div>
    <div class="pw-pdp-rq-dialog-body">
      <div class="pw-pdp-rq-strip" data-pw-rq-product-strip></div>
      <div class="pw-pdp-rq-list" data-pw-pdp-slot="review-list"></div>
    </div>
  </div>
</div>
${buildPdpReviewWriteModalHtml(locale)}
<div id="pw-pdp-qa-modal" class="pw-pdp-rq-modal" hidden data-pw-rq-modal="qa" role="dialog" aria-modal="true">
  <div class="pw-pdp-rq-dialog">
    <div class="pw-pdp-rq-dialog-head">
      <strong>${escapeHtml(t.qaModalTitle)}</strong>
      ${closeBtn}
    </div>
    <div class="pw-pdp-rq-dialog-body">
      <div class="pw-pdp-rq-strip" data-pw-rq-product-strip></div>
      <div data-pw-pdp-slot="qa-form"></div>
      <div class="pw-pdp-rq-list" data-pw-pdp-slot="qa-list"></div>
    </div>
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
  if (/data-pw-rq-grid=/.test(out) || /data-pw-pdp-slot=["']reviews-qa["']/.test(out)) {
    out = resetPdpReviewQaSamplesInHtml(out, locale)
  }
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
  } else if (!/id=["']pw-pdp-write-modal["']/.test(out)) {
    const writeOnly = buildPdpReviewWriteModalHtml(locale)
    out = /<\/body>/i.test(out) ? out.replace(/<\/body>/i, `${writeOnly}\n</body>`) : `${out}\n${writeOnly}`
  }
  return out
}
