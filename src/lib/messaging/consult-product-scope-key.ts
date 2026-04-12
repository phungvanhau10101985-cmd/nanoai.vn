/** Phân tách messageId và productUrlKey — tránh trùng ký tự trong UUID. */
export const CONSULT_PRODUCT_SCOPE_SEP = '\u001f' as const

export function makeConsultProductScopeKey(messageId: string, productUrlKey: string): string {
  const mid = messageId.trim()
  const pk = productUrlKey.trim()
  return `${mid}${CONSULT_PRODUCT_SCOPE_SEP}${pk}`
}

export function parseConsultProductScopeKey(s: string): { messageId: string; productUrlKey: string } | null {
  const i = s.indexOf(CONSULT_PRODUCT_SCOPE_SEP)
  if (i <= 0 || i >= s.length - 1) return null
  const messageId = s.slice(0, i).trim()
  const productUrlKey = s.slice(i + CONSULT_PRODUCT_SCOPE_SEP.length).trim()
  if (!messageId || !productUrlKey) return null
  return { messageId, productUrlKey }
}

/** Đã tư vấn theo URL sản phẩm trong hội thoại (mọi thẻ cùng URL đều «Mua hàng»). */
export function isProductConsultedInScopeSet(
  consultedProductKeys: ReadonlySet<string> | null | undefined,
  productUrlKey: string
): boolean {
  const want = productUrlKey.trim()
  if (!want) return false
  if (!consultedProductKeys || consultedProductKeys.size === 0) return false
  for (const k of consultedProductKeys) {
    const p = parseConsultProductScopeKey(k)
    if (p?.productUrlKey === want) return true
  }
  return false
}
