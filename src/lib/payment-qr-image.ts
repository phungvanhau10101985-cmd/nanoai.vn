/** Ảnh QR nạp credit được phép tải về để cắt mảnh (không proxy host khác). */
const CREDIT_QR_HOSTS = new Set(['qr.sepay.vn', 'img.vietqr.io', 'api.vietqr.io'])

/** Cột × hàng. Một ô không chứa đủ mã VietQR trên thẻ SePay (mã nằm giữa). */
export const CREDIT_QR_TILE_COLS = 4
export const CREDIT_QR_TILE_ROWS = 8

export type CreditQrTile = { x: number; y: number; w: number; h: number }

export function isCreditPaymentQrImageUrl(raw: string): boolean {
  const url = String(raw ?? '').trim()
  if (!url) return false
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    if (parsed.username || parsed.password) return false
    return CREDIT_QR_HOSTS.has(parsed.hostname.toLowerCase())
  } catch {
    return false
  }
}

/**
 * Chia bitmap thành lưới khít, phủ hết pixel, không chồng.
 * Facebook đọc từng canvas; một ô không đủ 3 finder pattern của VietQR.
 */
export function creditQrTiles(
  width: number,
  height: number,
  cols = CREDIT_QR_TILE_COLS,
  rows = CREDIT_QR_TILE_ROWS,
): CreditQrTile[] {
  const w = Math.floor(width)
  const h = Math.floor(height)
  const c = Math.max(1, Math.min(cols, w))
  const r = Math.max(1, Math.min(rows, h))
  if (w <= 0 || h <= 0) return []
  const tiles: CreditQrTile[] = []
  for (let row = 0; row < r; row += 1) {
    const y = Math.floor((row * h) / r)
    const y2 = Math.floor(((row + 1) * h) / r)
    for (let col = 0; col < c; col += 1) {
      const x = Math.floor((col * w) / c)
      const x2 = Math.floor(((col + 1) * w) / c)
      tiles.push({ x, y, w: x2 - x, h: y2 - y })
    }
  }
  return tiles
}
