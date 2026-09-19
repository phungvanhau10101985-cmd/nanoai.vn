import type { WebLocale } from '@/lib/i18n/config'
import { escapeAttr, escapeHtml } from '@/lib/packaging/mockup-share-html'
import {
  PARTNER_SIZE_GUIDE_INDEX_KINDS,
  PARTNER_SIZE_GUIDE_L2_KINDS,
  SIZE_GUIDE_APPAREL_FEMALE_HW_ROWS,
  SIZE_GUIDE_APPAREL_FEMALE_ROWS,
  SIZE_GUIDE_APPAREL_MALE_HW_ROWS,
  SIZE_GUIDE_APPAREL_MALE_ROWS,
  SIZE_GUIDE_BOXER_MALE_ROWS,
  SIZE_GUIDE_BRA_BAND_ROWS,
  SIZE_GUIDE_KIDS_APPAREL_ROWS,
  SIZE_GUIDE_SHOE_FEMALE_ROWS,
  SIZE_GUIDE_SHOE_KID_ROWS,
  SIZE_GUIDE_SHOE_MALE_ROWS,
  partnerSizeGuideCopy,
  partnerSizeGuideKindPathTail,
  type PartnerSizeGuideKind,
} from '@/lib/partner-website/shop/partner-site-size-guide'
import { partnerSiteHref } from '@/lib/messaging/partner-custom-domain-site-path'

export function partnerSiteSizeGuideHref(
  siteSlug: string,
  kind?: PartnerSizeGuideKind | null,
  customDomain = false
): string {
  const segs = kind ? partnerSizeGuideKindPathTail(kind) : ''
  const tail = segs ? `/size-guide/${segs}` : '/size-guide'
  return partnerSiteHref(siteSlug, tail, customDomain)
}

function tableHtml(headers: string[], rows: ReadonlyArray<ReadonlyArray<string>>, headClass: string): string {
  const th = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')
  const body = rows
    .map(
      (r) =>
        `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`
    )
    .join('')
  return `<div class="pw-size-guide-scroll"><table class="pw-size-guide-table"><thead><tr class="${headClass}">${th}</tr></thead><tbody>${body}</tbody></table></div>`
}

function headingHtml(text: string, shopName?: string | null): string {
  const shop = String(shopName || '').trim()
  const title = shop ? `${text} — ${shop}` : text
  return `<h2 class="pw-size-guide-h">${escapeHtml(title)}</h2>`
}

function noteHtml(text: string): string {
  return `<p class="pw-size-guide-note">${escapeHtml(text)}</p>`
}

function leadHtml(text: string): string {
  return `<p class="pw-size-guide-lead">${escapeHtml(text)}</p>`
}

function listHtml(items: readonly string[]): string {
  return `<ul class="pw-size-guide-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
}

function noteLinkHtml(text: string, href: string, label: string): string {
  return `<p class="pw-size-guide-note">${escapeHtml(text)} <a href="${escapeAttr(href)}">${escapeHtml(label)}</a></p>`
}

function kindInnerHtml(
  kind: PartnerSizeGuideKind,
  locale: WebLocale,
  shopName: string | null | undefined,
  hrefs: { kidsShoes: string; bra: string }
): string {
  const t = partnerSizeGuideCopy(locale)
  const boxerTable = () =>
    tableHtml([t.sizeVnCol, t.waist, t.hipBoxer], SIZE_GUIDE_BOXER_MALE_ROWS, 'pw-size-guide-head-hw')
  const render: Record<PartnerSizeGuideKind, () => string> = {
    'giay-dep-nam': () =>
      [
        headingHtml(t.heading[kind], shopName),
        leadHtml(t.measureShoes),
        tableHtml([t.shoeCm, t.shoeMaleSize], SIZE_GUIDE_SHOE_MALE_ROWS, 'pw-size-guide-head-shoe'),
        noteHtml(t.noteShoesMale),
      ].join(''),
    'giay-dep-nu': () =>
      [
        headingHtml(t.heading[kind], shopName),
        leadHtml(t.measureShoesFemale),
        tableHtml([t.shoeCm, t.shoeFemaleSize], SIZE_GUIDE_SHOE_FEMALE_ROWS, 'pw-size-guide-head-shoe'),
        noteHtml(t.noteShoesFemale),
      ].join(''),
    'thoi-trang-nam': () =>
      [
        headingHtml(t.heading[kind], shopName),
        leadHtml(t.measureApparelMale),
        tableHtml([t.sizeCol, t.chest, t.shoulder, t.waist, t.hip], SIZE_GUIDE_APPAREL_MALE_ROWS, 'pw-size-guide-head-apparel'),
        headingHtml(t.hwMaleTitle, null),
        leadHtml(t.hwMaleLead),
        tableHtml([t.sizeCol, t.height, t.weight], SIZE_GUIDE_APPAREL_MALE_HW_ROWS, 'pw-size-guide-head-hw'),
        noteHtml(t.noteApparelMale),
      ].join(''),
    'thoi-trang-nu': () =>
      [
        headingHtml(t.heading[kind], shopName),
        leadHtml(t.measureApparelFemale),
        tableHtml([t.sizeCol, t.chest, t.waist, t.hip], SIZE_GUIDE_APPAREL_FEMALE_ROWS, 'pw-size-guide-head-apparel'),
        headingHtml(t.hwFemaleTitle, null),
        leadHtml(t.hwFemaleLead),
        tableHtml([t.sizeCol, t.height, t.weight], SIZE_GUIDE_APPAREL_FEMALE_HW_ROWS, 'pw-size-guide-head-hw'),
        noteHtml(t.noteApparelFemale),
      ].join(''),
    'do-lot-nam': () =>
      [
        headingHtml(t.heading[kind], shopName),
        leadHtml(t.measureBoxer),
        boxerTable(),
        noteHtml(t.noteBoxer),
      ].join(''),
    'do-lot-nu': () =>
      [
        headingHtml(t.heading[kind], shopName),
        leadHtml(t.measureUnderwear),
        noteLinkHtml(t.noteUnderwear, hrefs.bra, t.cardTitle['do-lot-nu/bra-ao-nguc-nu']),
      ].join(''),
    'trang-phuc-bau-hau-san': () =>
      [headingHtml(t.heading[kind], shopName), leadHtml(t.measureMaternity), noteHtml(t.noteMaternity)].join(''),
    'thoi-trang-tre-em': () =>
      [
        headingHtml(t.heading[kind], shopName),
        leadHtml(t.measureKids),
        tableHtml([t.ageCol, t.height, t.weight, t.asianSize], SIZE_GUIDE_KIDS_APPAREL_ROWS, 'pw-size-guide-head-apparel'),
        noteHtml(t.noteKids),
        noteLinkHtml(t.noteKidsShoesLink, hrefs.kidsShoes, t.cardTitle['thoi-trang-tre-em/giay-dep-tre-em']),
      ].join(''),
    'the-thao-da-ngoai': () =>
      [
        headingHtml(t.heading[kind], shopName),
        leadHtml(t.measureSports),
        tableHtml([t.sizeCol, t.chest, t.shoulder, t.waist, t.hip], SIZE_GUIDE_APPAREL_MALE_ROWS, 'pw-size-guide-head-apparel'),
        headingHtml(t.hwMaleTitle, null),
        leadHtml(t.hwSportsLead),
        tableHtml([t.sizeCol, t.height, t.weight], SIZE_GUIDE_APPAREL_MALE_HW_ROWS, 'pw-size-guide-head-hw'),
        noteHtml(t.noteSports),
      ].join(''),
    'thoi-trang-tre-em/giay-dep-tre-em': () =>
      [
        headingHtml(t.heading[kind], shopName),
        leadHtml(t.measureKidsShoes),
        tableHtml([t.shoeCm, t.shoeKidSize], SIZE_GUIDE_SHOE_KID_ROWS, 'pw-size-guide-head-shoe'),
        noteHtml(t.noteKidsShoes),
        noteHtml(t.noteKidsShoesGrow),
      ].join(''),
    'do-lot-nam/quan-lot-boxer-brief-nam': () =>
      [
        headingHtml(t.heading[kind], shopName),
        leadHtml(t.measureBoxer),
        boxerTable(),
        noteHtml(t.noteBoxer),
      ].join(''),
    'do-lot-nu/bra-ao-nguc-nu': () =>
      [
        headingHtml(t.heading[kind], shopName),
        leadHtml(t.measureBra),
        leadHtml(t.measureBraBand),
        tableHtml([t.braUnderbust, t.braBand], SIZE_GUIDE_BRA_BAND_ROWS, 'pw-size-guide-head-hw'),
        leadHtml(t.measureBraCup),
        listHtml(t.braCupItems),
        noteHtml(t.noteBra),
      ].join(''),
    'giay-dep-nu/giay-cao-got-nu': () =>
      [
        headingHtml(t.heading[kind], shopName),
        leadHtml(t.measureHeels),
        tableHtml([t.shoeCm, t.shoeFemaleSize], SIZE_GUIDE_SHOE_FEMALE_ROWS, 'pw-size-guide-head-shoe'),
        noteHtml(t.noteHeels),
      ].join(''),
    'giay-dep-nu/giay-cuoi-du-tiec-nu': () =>
      [
        headingHtml(t.heading[kind], shopName),
        leadHtml(t.measureHeels),
        leadHtml(t.measureWedding),
        tableHtml([t.shoeCm, t.shoeFemaleSize], SIZE_GUIDE_SHOE_FEMALE_ROWS, 'pw-size-guide-head-shoe'),
        noteHtml(t.noteHeels),
      ].join(''),
  }
  return render[kind]()
}

export const PARTNER_SIZE_GUIDE_CSS = `.pw-size-guide{max-width:760px;color:var(--pw-text,#111827);font-size:14px;line-height:1.6}
.pw-size-guide-h{margin:1.1rem 0 0;font-size:1.05rem;font-weight:800;color:var(--pw-text,#111827)}
.pw-size-guide-h:first-child{margin-top:0}
.pw-size-guide-lead{margin:.5rem 0 0;color:var(--pw-text,#111827)}
.pw-size-guide-list{margin:.5rem 0 0;padding-left:1.2rem}
.pw-size-guide-list li{margin:.25rem 0}
.pw-size-guide-note{margin:.75rem 0 0;font-size:12px;line-height:1.6;color:var(--pw-muted,#4b5563)}
.pw-size-guide-scroll{margin-top:.75rem;overflow-x:auto;-webkit-overflow-scrolling:touch}
.pw-size-guide-table{width:100%;border-collapse:collapse;text-align:left;font-size:13px;min-width:280px}
.pw-size-guide-table th,.pw-size-guide-table td{padding:8px;border:1px solid var(--pw-border,#e5e7eb);vertical-align:top}
.pw-size-guide-head-shoe th{background:color-mix(in srgb,var(--pw-primary,#f97316) 16%,#fff)}
.pw-size-guide-head-apparel th{background:var(--pw-surface,#f9fafb)}
.pw-size-guide-head-hw th{background:color-mix(in srgb,var(--pw-primary,#f97316) 8%,#f8fafc)}
.pw-size-guide-cards{display:grid;gap:8px;grid-template-columns:1fr;list-style:none;margin:16px 0 0;padding:0}
@media (min-width:640px){.pw-size-guide-cards{grid-template-columns:1fr 1fr}}
.pw-size-guide-card{display:block;border:1px solid var(--pw-border,#e5e7eb);border-radius:12px;padding:14px 16px;background:color-mix(in srgb,var(--pw-surface,#f9fafb) 80%,#fff);color:var(--pw-text,#111827);font-weight:600;text-decoration:none}
.pw-size-guide-card:hover{border-color:var(--pw-primary);background:color-mix(in srgb,var(--pw-primary) 8%,#fff);color:var(--pw-primary)}
.pw-size-guide-foot{margin:24px 0 0;padding-top:16px;border-top:1px solid var(--pw-border,#e5e7eb);font-size:12px;color:var(--pw-muted,#6b7280)}
.pw-size-guide-foot a{color:var(--pw-primary);text-decoration:underline}
.pw-size-guide-crumb{margin:0 0 12px;font-size:12px;color:var(--pw-muted,#6b7280)}
.pw-size-guide-crumb a{color:inherit;text-decoration:underline}
[data-pw-size-guide-modal]{position:fixed;inset:0;z-index:100080;display:grid;place-items:center;padding:16px;background:rgba(0,0,0,.5)}
[data-pw-size-guide-modal][hidden]{display:none!important}
.pw-size-guide-dialog{background:#fff;border-radius:12px;max-width:min(100vw - 32px,560px);max-height:min(92vh,820px);width:100%;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 16px 48px rgba(0,0,0,.2)}
.pw-size-guide-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 16px;border-bottom:1px solid var(--pw-border,#f3f4f6);flex-shrink:0}
.pw-size-guide-dialog-head strong{font-size:14px}
.pw-size-guide-dialog-body{overflow:auto;padding:12px 16px 20px;min-height:0}
.nanoai-ve-active [data-pw-size-guide-modal]{display:none!important}`

function cssTag(): string {
  return `<style data-pw-size-guide-css="1">${PARTNER_SIZE_GUIDE_CSS}</style>`
}

function cardsForKinds(
  kinds: readonly PartnerSizeGuideKind[],
  input: { locale: WebLocale; siteSlug: string; customDomain?: boolean }
): string {
  const t = partnerSizeGuideCopy(input.locale)
  const items = kinds
    .map((kind) => {
      const href = partnerSiteSizeGuideHref(input.siteSlug, kind, Boolean(input.customDomain))
      return `<li><a class="pw-size-guide-card" data-pw-el="link" href="${escapeAttr(href)}">${escapeHtml(t.cardTitle[kind])}</a></li>`
    })
    .join('')
  return `<ul class="pw-size-guide-cards">${items}</ul>`
}

function indexCardsHtml(input: { locale: WebLocale; siteSlug: string; customDomain?: boolean }): string {
  const t = partnerSizeGuideCopy(input.locale)
  return `${cardsForKinds(PARTNER_SIZE_GUIDE_INDEX_KINDS, input)}<h2 class="pw-size-guide-h">${escapeHtml(t.indexL2Title)}</h2>${cardsForKinds(PARTNER_SIZE_GUIDE_L2_KINDS, input)}`
}

export function buildPartnerSizeGuideIndexInnerHtml(input: {
  locale: WebLocale
  siteSlug: string
  customDomain?: boolean
  includeLead?: boolean
}): string {
  const t = partnerSizeGuideCopy(input.locale)
  const lead = input.includeLead === false ? '' : leadHtml(t.indexLead)
  return `${lead}${indexCardsHtml(input)}`
}

export function buildPartnerSizeGuideKindInnerHtml(input: {
  kind: PartnerSizeGuideKind
  locale: WebLocale
  siteSlug: string
  shopName?: string | null
  customDomain?: boolean
}): string {
  const t = partnerSizeGuideCopy(input.locale)
  const indexHref = partnerSiteSizeGuideHref(input.siteSlug, null, Boolean(input.customDomain))
  const crumb = `<p class="pw-size-guide-crumb"><a href="${escapeAttr(indexHref)}">${escapeHtml(t.indexTitle)}</a></p>`
  const foot = `<p class="pw-size-guide-foot">${escapeHtml(t.footnote)} <a href="${escapeAttr(indexHref)}">${escapeHtml(t.backToIndex)}</a></p>`
  const hrefs = {
    kidsShoes: partnerSiteSizeGuideHref(input.siteSlug, 'thoi-trang-tre-em/giay-dep-tre-em', Boolean(input.customDomain)),
    bra: partnerSiteSizeGuideHref(input.siteSlug, 'do-lot-nu/bra-ao-nguc-nu', Boolean(input.customDomain)),
  }
  return `${crumb}${kindInnerHtml(input.kind, input.locale, input.shopName, hrefs)}${foot}`
}

export function buildPartnerSizeGuideHostHtml(input: {
  kind?: PartnerSizeGuideKind | null
  locale: WebLocale
  siteSlug: string
  shopName?: string | null
  customDomain?: boolean
  includeLead?: boolean
}): string {
  const kind = input.kind || null
  const inner = kind
    ? buildPartnerSizeGuideKindInnerHtml({
        kind,
        locale: input.locale,
        siteSlug: input.siteSlug,
        shopName: input.shopName,
        customDomain: input.customDomain,
      })
    : buildPartnerSizeGuideIndexInnerHtml({
        locale: input.locale,
        siteSlug: input.siteSlug,
        customDomain: input.customDomain,
        includeLead: input.includeLead,
      })
  const role = kind || 'index'
  return `<div class="pw-size-guide" data-pw-size-guide="${escapeAttr(role)}" data-pw-el="body">${inner}</div>`
}

export function buildPartnerSizeGuideModalHtml(input: {
  kind?: PartnerSizeGuideKind | null
  locale: WebLocale
  siteSlug: string
  shopName?: string | null
  customDomain?: boolean
  closeLabel: string
  title: string
  imageUrl?: string | null
}): string {
  const inner = buildPartnerSizeGuideHostHtml({
    kind: input.kind,
    locale: input.locale,
    siteSlug: input.siteSlug,
    shopName: input.shopName,
    customDomain: input.customDomain,
    includeLead: !input.kind,
  })
  const img = String(input.imageUrl || '').trim()
  const imgHtml = img
    ? `<img src="${escapeAttr(img)}" alt="${escapeAttr(input.title)}" decoding="async" style="width:100%;height:auto;margin-top:16px;border-radius:8px;border:1px solid var(--pw-border,#e5e7eb)" />`
    : ''
  return `<div data-pw-size-guide-modal hidden role="dialog" aria-modal="true" aria-labelledby="pw-size-guide-heading">
  <div class="pw-size-guide-dialog">
    <div class="pw-size-guide-dialog-head">
      <strong id="pw-size-guide-heading">${escapeHtml(input.title)}</strong>
      <button type="button" data-pw-size-guide-close aria-label="${escapeAttr(input.closeLabel)}">✕</button>
    </div>
    <div class="pw-size-guide-dialog-body">${inner}${imgHtml}</div>
  </div>
</div>`
}

function isSizeGuideVisualPage(pageKey?: string | null, cmsSlug?: string | null, html?: string): boolean {
  const key = String(pageKey || '').trim().toLowerCase().replace(/-/g, '_')
  const slug = String(cmsSlug || '').trim().toLowerCase()
  if (key === 'size_guide' || slug === 'size-guide') return true
  if (html && /data-pw-size-guide=/.test(html) && /data-pw-page=["']info["']/.test(html)) return true
  return false
}

/** Idempotent: gắn thẻ nhóm hàng (L1 + nhóm con) vào trang visual `/size-guide`. */
export function ensurePartnerSizeGuideInHtml(
  html: string,
  input: {
    locale: WebLocale
    siteSlug?: string | null
    shopName?: string | null
    pageKey?: string | null
    cmsSlug?: string | null
    customDomain?: boolean
  }
): string {
  if (!html.trim()) return html
  if (!isSizeGuideVisualPage(input.pageKey, input.cmsSlug, html)) return html
  const siteSlug = String(input.siteSlug || '').trim()
  const host = buildPartnerSizeGuideHostHtml({
    locale: input.locale,
    siteSlug,
    shopName: input.shopName,
    customDomain: input.customDomain,
    includeLead: false,
  })
  let out = html.replace(/<style\b[^>]*data-pw-size-guide-css\b[^>]*>[\s\S]*?<\/style>/gi, '')
  out = out.replace(/<([a-z0-9]+)([^>]*\bdata-pw-size-guide=(["'])[^"']*\3[^>]*)>[\s\S]*?<\/\1>/gi, '')
  if (/<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, `${cssTag()}</head>`)
  } else {
    out = `${cssTag()}${out}`
  }
  if (/data-pw-info-body/i.test(out)) {
    return out.replace(
      /<(div|section|article)\b([^>]*\bdata-pw-info-body\b[^>]*)>([\s\S]*?)<\/\1>/i,
      (_m, tag: string, attrs: string, inner: string) => `<${tag}${attrs}>${inner}${host}</${tag}>`
    )
  }
  if (/data-pw-region=["']content["']/i.test(out)) {
    return out.replace(
      /<(article|section|div|main)\b([^>]*\bdata-pw-region=["']content["'][^>]*)>([\s\S]*?)<\/\1>/i,
      (_m, tag: string, attrs: string, inner: string) => `<${tag}${attrs}>${inner}${host}</${tag}>`
    )
  }
  return `${out}${host}`
}

export function stripPartnerSizeGuideFromHtml(html: string): string {
  return html
    .replace(/<style\b[^>]*data-pw-size-guide-css\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<([a-z0-9]+)([^>]*\bdata-pw-size-guide-modal\b[^>]*)>[\s\S]*?<\/\1>/gi, '')
    .replace(/<([a-z0-9]+)([^>]*\bdata-pw-size-guide=(["'])[^"']*\3[^>]*)>[\s\S]*?<\/\1>/gi, '')
}

/** PDP: modal bảng size (chỉ khi SP có size). Idempotent. */
export function ensurePartnerPdpSizeGuideModalInHtml(
  html: string,
  input: {
    locale: WebLocale
    siteSlug?: string | null
    shopName?: string | null
    customDomain?: boolean
    hasSizes: boolean
    kind?: PartnerSizeGuideKind | null
    closeLabel: string
    title: string
    imageUrl?: string | null
  }
): string {
  let out = html
    .replace(/<style\b[^>]*data-pw-size-guide-css\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<([a-z0-9]+)([^>]*\bdata-pw-size-guide-modal\b[^>]*)>[\s\S]*?<\/\1>/gi, '')
  if (!input.hasSizes || !input.kind) return out
  if (/<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, `${cssTag()}</head>`)
  } else {
    out = `${cssTag()}${out}`
  }
  const modal = buildPartnerSizeGuideModalHtml({
    kind: input.kind || null,
    locale: input.locale,
    siteSlug: String(input.siteSlug || '').trim(),
    shopName: input.shopName,
    customDomain: input.customDomain,
    closeLabel: input.closeLabel,
    title: input.title,
    imageUrl: input.imageUrl,
  })
  if (/<\/body>/i.test(out)) return out.replace(/<\/body>/i, `${modal}</body>`)
  return `${out}${modal}`
}
