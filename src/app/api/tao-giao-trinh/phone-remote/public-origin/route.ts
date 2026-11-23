import { NextResponse } from 'next/server'
import { isLocalDevHost, phonePublicHref, readLocalPhonePublicOrigin } from '@/lib/curriculum/phone-remote-public-origin'

export const dynamic = 'force-dynamic'

/** Local: mọi QR điện thoại đi qua tunnel Cloudflare đang mở, không qua ngrok hay IP Wi‑Fi. */
export async function GET(req: Request) {
  const url = new URL(req.url)
  if (!isLocalDevHost(url.hostname)) {
    return NextResponse.json({ ok: true, origin: phonePublicHref(url.origin) })
  }
  const origin = await readLocalPhonePublicOrigin()
  if (!origin) return NextResponse.json({ ok: false, error: 'tunnel' }, { status: 503 })
  return NextResponse.json({ ok: true, origin })
}
