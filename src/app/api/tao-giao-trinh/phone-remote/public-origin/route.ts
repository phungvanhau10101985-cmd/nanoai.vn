import { NextResponse } from 'next/server'
import {
  isLocalDevHost,
  LOCAL_PHONE_NGROK_ORIGIN,
  readRunningNgrokOrigin,
} from '@/lib/curriculum/phone-remote-public-origin'

export const dynamic = 'force-dynamic'

/** Local: origin cho QR là ngrok. Bản đang chạy trên domain thật giữ nguyên host. */
export async function GET(req: Request) {
  const url = new URL(req.url)
  if (!isLocalDevHost(url.hostname)) {
    return NextResponse.json({ ok: true, origin: url.origin })
  }
  const live = await readRunningNgrokOrigin()
  return NextResponse.json({ ok: true, origin: live || LOCAL_PHONE_NGROK_ORIGIN })
}
