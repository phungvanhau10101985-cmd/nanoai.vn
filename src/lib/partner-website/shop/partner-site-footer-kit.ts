/**
 * Footer kit — ẩn/hiện khối gốc (logo, 4 cột, copyright) như Head.
 * Không thêm phần tử bằng dấu + / Thêm vào chân trang.
 */
export const PW_FOOTER_KIT_ATTR = 'data-pw-footer-kit'

export const PW_FOOTER_KIT_STOCK = [
  'brand',
  'col:shop',
  'col:shopping',
  'col:support',
  'col:legal',
  'copyright',
] as const

export type PwFooterKitStockKind = (typeof PW_FOOTER_KIT_STOCK)[number]

const COL_KINDS = ['col:shop', 'col:shopping', 'col:support', 'col:legal'] as const
type FooterColKitKind = (typeof COL_KINDS)[number]

export function isPwFooterKitStockKind(v: string): v is PwFooterKitStockKind {
  return (PW_FOOTER_KIT_STOCK as readonly string[]).includes(v)
}

export function inferFooterColumnKitKind(html: string): FooterColKitKind | null {
  const score: Record<FooterColKitKind, number> = {
    'col:shop': 0,
    'col:shopping': 0,
    'col:support': 0,
    'col:legal': 0,
  }
  const hit = (kind: FooterColKitKind, n: number) => {
    score[kind] += n
  }
  if (/\/(privacy|terms)(?:\/|"|'|\?|#|\s|>)/i.test(html)) hit('col:legal', 4)
  if (/\/(faq|shipping|returns)(?:\/|"|'|\?|#|\s|>)/i.test(html)) hit('col:support', 3)
  if (/\/payment(?:\/|"|'|\?|#|\s|>)/i.test(html)) hit('col:support', 1)
  if (/\/(products|kho-sale|wishlist|size-guide)(?:\/|"|'|\?|#|\s|>)/i.test(html)) hit('col:shopping', 3)
  if (/\/(about|contact|stores|lookbook|blog)(?:\/|"|'|\?|#|\s|>)/i.test(html)) hit('col:shop', 3)
  if (/\/(cart|orders|account)(?:\/|"|'|\?|#|\s|>)/i.test(html)) hit('col:support', 1)
  const text = html.replace(/<[^>]+>/g, ' ').toLowerCase()
  if (/chính sách|privacy|terms|ポリシー|정책|政策/.test(text)) hit('col:legal', 2)
  if (/hỗ trợ|support|サポート|지원|支持/.test(text)) hit('col:support', 2)
  if (/mua sắm|shopping|ショッピング|쇼핑|购物/.test(text)) hit('col:shopping', 2)
  if (/cửa hàng|店铺|ショップ|스토어/.test(text) && !/mua sắm|shopping/.test(text)) hit('col:shop', 2)
  let best: FooterColKitKind | null = null
  let bestN = 0
  for (const kind of COL_KINDS) {
    if (score[kind] > bestN) {
      best = kind
      bestN = score[kind]
    }
  }
  return bestN > 0 ? best : null
}

function withKitAttr(openTag: string, kind: string): string {
  if (/\bdata-pw-footer-kit=/i.test(openTag)) return openTag
  return openTag.replace(/>$/, ` ${PW_FOOTER_KIT_ATTR}="${kind}">`)
}

function stampFooterKitInFooterBlock(block: string): string {
  let next = block.replace(/<div\b([^>]*\bpw-shop-footer-brand\b[^>]*)>/gi, (full) => withKitAttr(full, 'brand'))
  next = next.replace(/<(div|p|section)\b([^>]*\bdata-pw-el=["']copyright["'][^>]*)>/gi, (full) =>
    withKitAttr(full, 'copyright')
  )
  const used = new Set<string>()
  next = next.replace(
    /<nav\b([^>]*?(?:pw-shop-footer-col|pw-footer-col|data-pw-el=["']col["'])[^>]*)>([\s\S]*?)<\/nav>/gi,
    (full, _attrs: string, inner: string) => {
      const existing = /data-pw-footer-kit=["']([^"']+)["']/i.exec(full)
      if (existing?.[1]) {
        used.add(existing[1])
        return full
      }
      const inferred = inferFooterColumnKitKind(full)
      let kind: string | null = inferred && !used.has(inferred) ? inferred : null
      if (!kind) {
        for (const cand of COL_KINDS) {
          if (!used.has(cand)) {
            kind = cand
            break
          }
        }
      }
      if (!kind) return full
      used.add(kind)
      const close = full.indexOf('>')
      if (close < 0) return full
      return `${withKitAttr(full.slice(0, close + 1), kind)}${inner}</nav>`
    }
  )
  let addedI = 0
  next = next.replace(/<([a-z][a-z0-9]*)(\b[^>]*\bdata-pw-footer-added=["']1["'][^>]*)>/gi, (full) => {
    if (/\bdata-pw-footer-kit=/i.test(full)) return full
    addedI += 1
    return withKitAttr(full, `added:${addedI}`)
  })
  return next
}

/** Idempotent. Stamps kit ids on factory / leftover footer cells. */
export function stampFooterKitInHtml(html: string): string {
  if (!html || !/<footer\b/i.test(html)) return html
  return html.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, stampFooterKitInFooterBlock)
}
