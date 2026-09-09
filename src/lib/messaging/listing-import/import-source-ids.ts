/**
 * Chuẩn hoá URL / id nguồn Taobao · Tmall · 1688 — khớp `import_source_ids.py` (188).
 * Engine đa tenant, không khóa slug 188.
 */

const STRIP_INVISIBLE_PREFIX = /^[\ufeff\u200b\u200c\u200d\u2060\s]+/
const T_PREFIX_ITEM_RE = /^[Tt](\d{5,})$/
const TAOBAO_TMALL_HOST_RE = /(?:^|\.)taobao\.com$|(?:^|\.)tmall\.com$/i
const ABB_1688_OFFER_RE = /^abb-(\d+)$/i
const CANONICAL_TAOBAO_ITEM_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,220}$/

export function parseTPrefixedItemId(raw: string): string | null {
  const m = T_PREFIX_ITEM_RE.exec((raw || '').trim())
  return m?.[1] ?? null
}

export function normalizeProductImportUrl(raw: string): string {
  let s = (raw || '').trim()
  if (!s) return ''
  s = s.replace(STRIP_INVISIBLE_PREFIX, '')
  s = s.replace(/[\ufeff\u200b-\u200d\u2060]/g, '')
  if (!s.trim()) return ''
  s = s.trim()

  const http = s.match(/\bhttps?:\/\/[^\s\]\)<>'"]+/i)
  if (http) {
    s = http[0].replace(/[.,;:"”’)\]]+$/, '')
  }

  s = s.trim().replace(/^["']+|["']+$/g, '').replace(/^[<>]+|[<>]+$/g, '')
  if (!s) return ''
  if (!/^https?:\/\//i.test(s) && /^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(s)) {
    s = `https://${s}`
  }
  try {
    const u = new URL(s)
    u.hash = ''
    return u.toString()
  } catch {
    return s
  }
}

export function extractTaobaoTmallItemId(url: string): string | null {
  const norm = normalizeProductImportUrl(url)
  if (!norm) return null
  try {
    const p = new URL(norm)
    const host = (p.hostname || '').toLowerCase().replace(/^www\./, '')
    if (!TAOBAO_TMALL_HOST_RE.test(host)) return null
    for (const key of ['id', 'item_id', 'itemId']) {
      const val = p.searchParams.get(key)?.trim()
      if (val && /^\d+$/.test(val)) return val
    }
  } catch {
    return null
  }
  return null
}

export function extract1688OfferId(url: string): string | null {
  const norm = normalizeProductImportUrl(url)
  if (!norm) return null
  try {
    const p = new URL(norm)
    for (const [key, val] of p.searchParams.entries()) {
      if (key.toLowerCase() === 'offerid' && val.trim()) return val.trim()
    }
    const m = /\/offer\/(\d+)\.html/i.exec(p.pathname || '')
    if (m?.[1]) return m[1]
  } catch {
    /* ignore */
  }
  return null
}

export function extractAbbOfferDigits(slug: string): string | null {
  const m = ABB_1688_OFFER_RE.exec((slug || '').trim())
  return m?.[1] ?? null
}

export function supplyProductLinkDefaultForItemSlug(slug: string): string {
  const oid = extractAbbOfferDigits(slug)
  if (oid) return `https://detail.1688.com/offer/${oid}.html`
  const tid = (slug || '').trim()
  if (!tid) return ''
  return `https://detail.tmall.com/item.htm?id=${encodeURIComponent(tid)}`
}

export function buildCanonicalTaobaoProductId(itemId: string): string {
  const tid = String(itemId || '').trim()
  if (!tid) throw new Error('thiếu mã item Taobao (slug / id).')
  if (!CANONICAL_TAOBAO_ITEM_RE.test(tid)) {
    throw new Error(`mã item Taobao không hợp lệ: ${tid}`)
  }
  return `T${tid}`
}

export function buildCanonical1688ProductId(offerDigits: string): string {
  const oid = String(offerDigits || '').trim()
  if (!/^\d+$/.test(oid)) throw new Error('offer id 1688 phải là chuỗi chữ số.')
  return `A${oid}`
}

export function normalizeListingParserItemId(raw: string): string {
  const t = raw.trim()
  const m = /^([aAtT])(\d+)$/.exec(t)
  if (m) return `${m[1].toUpperCase()}${m[2]}`
  return t
}
