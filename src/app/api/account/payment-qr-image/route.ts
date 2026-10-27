import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { isCreditPaymentQrImageUrl } from '@/lib/payment-qr-image'

export const dynamic = 'force-dynamic'

const MAX_BYTES = 1_000_000
const TIMEOUT_MS = 15_000

/**
 * Trả byte ảnh QR dạng octet-stream để client tự cắt mảnh.
 * Không trả image/* — trình duyệt Facebook nhận ảnh QR nguyên tấm sẽ bật sheet chọn ngân hàng.
 */
async function fetchCreditQrBytes(qrUrl: string): Promise<Buffer> {
  if (!isCreditPaymentQrImageUrl(qrUrl)) throw new Error('QR url not allowed')
  let current = qrUrl
  for (let hop = 0; hop < 3; hop += 1) {
    const res = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'NanoAI/credit-qr', Accept: 'image/*,application/octet-stream' },
      cache: 'no-store',
    })
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (!loc) throw new Error('QR redirect')
      const next = new URL(loc, current).toString()
      if (!isCreditPaymentQrImageUrl(next)) throw new Error('QR redirect host')
      current = next
      continue
    }
    if (!res.ok) throw new Error(`QR fetch ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 32 || buf.length > MAX_BYTES) throw new Error('QR image size invalid')
    return buf
  }
  throw new Error('QR redirect')
}

export async function GET(request: NextRequest) {
  const auth = await getUserForAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
  const url = request.nextUrl.searchParams.get('url')?.trim() || ''
  if (!isCreditPaymentQrImageUrl(url)) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
  try {
    const raw = await fetchCreditQrBytes(url)
    return new NextResponse(new Uint8Array(raw), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="qr.bin"',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (e) {
    console.warn('[payment-qr-image]', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'QR fetch failed' }, { status: 502 })
  }
}
