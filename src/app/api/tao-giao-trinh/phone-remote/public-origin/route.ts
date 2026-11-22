import { NextResponse } from 'next/server'
import {
  isLocalDevHost,
  LOCAL_PHONE_NGROK_ORIGIN,
  readLanDevOrigin,
  readRunningNgrokOrigin,
} from '@/lib/curriculum/phone-remote-public-origin'

export const dynamic = 'force-dynamic'

/** Local: QR điện thoại mở IP Wi‑Fi cùng mạng. */
export async function GET(req: Request) {
  const url = new URL(req.url)
  if (!isLocalDevHost(url.hostname)) {
    return NextResponse.json({ ok: true, origin: url.origin })
  }
  const port = Number(url.port || 3000)
  const lan = readLanDevOrigin(port)
  if (lan) return NextResponse.json({ ok: true, origin: lan })
  const live = await readRunningNgrokOrigin()
  return NextResponse.json({ ok: true, origin: live || LOCAL_PHONE_NGROK_ORIGIN })
}
