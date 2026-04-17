/** Lấy số VND từ chuỗi giá (vd. «890.000đ», «1,280,000»). */
export function parseVndAmountFromPriceHint(raw: string | null | undefined): number {
  const s = (raw ?? '').trim()
  if (!s) return 0
  const digits = s.replace(/[^\d]/g, '')
  if (!digits) return 0
  const n = Number.parseInt(digits, 10)
  return Number.isFinite(n) ? Math.max(0, n) : 0
}
