/**
 * Stamp data-pw-facet trên thanh lọc listing (HTML cũ thiếu mã).
 * Một engine mọi shop. Bootstrap chỉ đọc mã, không đoán class.
 */

const FACET_ORDER = ['size', 'style', 'color'] as const
const PRICE_ORDER = ['min_price', 'max_price'] as const

function stampOpenTag(open: string, name: string, value: string): string {
  const re = new RegExp(`\\s${name}\\s*=\\s*(["'])[\\s\\S]*?\\1`, 'i')
  if (re.test(open)) return open.replace(re, ` ${name}="${value}"`)
  return open.replace(/>$/, ` ${name}="${value}">`)
}

function stampFiltersInner(inner: string): string {
  let facetIdx = 0
  let priceIdx = 0
  let next = inner.replace(/<select\b[^>]*>/gi, (open) => {
    if (/\bdata-pw-el=["']sort["']/i.test(open) || /\bdata-pw-facet=["']sort["']/i.test(open)) {
      return stampOpenTag(open, 'data-pw-el', 'sort')
    }
    if (/\bdata-pw-facet=/.test(open)) return open
    const kind = FACET_ORDER[facetIdx]
    if (!kind) return open
    facetIdx += 1
    let stamped = /\bdata-pw-el=/.test(open) ? open : stampOpenTag(open, 'data-pw-el', 'facet')
    stamped = stampOpenTag(stamped, 'data-pw-facet', kind)
    return stamped
  })
  next = next.replace(/<input\b[^>]*>/gi, (open) => {
    if (!/\btype=["']number["']/i.test(open)) return open
    if (/\bdata-pw-facet=/.test(open)) return open
    const kind = PRICE_ORDER[priceIdx]
    if (!kind) return open
    priceIdx += 1
    return stampOpenTag(open, 'data-pw-facet', kind)
  })
  return next
}

export function stampPartnerListingFilterAttrsInHtml(html: string): string {
  if (!html || !/\bdata-pw-region=["']filters["']/i.test(html)) return html
  return html.replace(
    /<(div|section)\b([^>]*\bdata-pw-region=["']filters["'][^>]*)>([\s\S]*?)<\/\1>/i,
    (full, tag: string, attrs: string, inner: string) =>
      `<${tag}${attrs}>${stampFiltersInner(inner)}</${tag}>`
  )
}
