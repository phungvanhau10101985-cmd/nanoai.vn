/**
 * URL ảnh phụ từ kho (trừ trùng ảnh chính) — dùng shop gallery & API tìm ảnh.
 * Server/client-safe (không import pg).
 */
export function colorImageUrlsForInventorySearch(
  mainImageUrl: string,
  materialDetail: string,
  realUse1: string,
  realUse2: string
): string[] {
  const main = (mainImageUrl ?? '').trim()
  const extra = [materialDetail, realUse1, realUse2]
    .map((u) => (u ?? '').trim())
    .filter((u) => /^https?:\/\//i.test(u))
  const out: string[] = []
  const seen = new Set<string>()
  for (const u of extra) {
    if (seen.has(u)) continue
    if (main && u === main) continue
    seen.add(u)
    out.push(u)
  }
  return out
}
