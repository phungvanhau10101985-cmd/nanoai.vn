import {
  DEPOSIT_QR_FETCH_TIMEOUT_MS,
  DEPOSIT_QR_MAX_BYTES,
  isAllowedDepositQrImageUrl,
} from '@/lib/messaging/deposit-qr-image'

export async function fetchDepositQrImageBytes(qrUrl: string): Promise<Buffer> {
  if (!isAllowedDepositQrImageUrl(qrUrl)) {
    throw new Error('QR url not allowed')
  }
  const res = await fetch(qrUrl, {
    signal: AbortSignal.timeout(DEPOSIT_QR_FETCH_TIMEOUT_MS),
    headers: { 'User-Agent': 'NanoAI/deposit-qr-proxy', Accept: 'image/*,application/octet-stream' },
    redirect: 'follow',
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`QR fetch ${res.status}`)
  const type = String(res.headers.get('content-type') || '').toLowerCase()
  if (type && !type.startsWith('image/') && !type.includes('octet-stream')) {
    throw new Error('QR response is not an image')
  }
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 32 || buf.length > DEPOSIT_QR_MAX_BYTES) {
    throw new Error('QR image size invalid')
  }
  return buf
}
