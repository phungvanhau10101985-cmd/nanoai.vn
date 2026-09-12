const QR_HOST_ALLOW = new Set(['qr.sepay.vn', 'img.vietqr.io', 'api.vietqr.io'])

const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|169\.254\.|0\.0\.0\.0|::1|\[::1\])/i

export const DEPOSIT_QR_FETCH_TIMEOUT_MS = 15_000
export const DEPOSIT_QR_MAX_BYTES = 1_000_000

export function isAllowedDepositQrImageUrl(raw: string): boolean {
  const url = String(raw ?? '').trim()
  if (!/^https:\/\//i.test(url)) return false
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    const host = parsed.hostname.toLowerCase()
    if (!host || PRIVATE_HOST.test(host)) return false
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false
    if (QR_HOST_ALLOW.has(host)) return true
    return true
  } catch {
    return false
  }
}

export function depositQrDownloadFilename(orderCode: string): string {
  const safe = String(orderCode || 'don').replace(/[^\da-zA-Z._-]+/g, '_') || 'don'
  return `qr-chuyen-khoan-${safe}.png`
}
