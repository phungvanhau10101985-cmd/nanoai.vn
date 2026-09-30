import { NextRequest, NextResponse } from 'next/server'
import {
  GUEST_CHAT_IMAGE_MAX_BYTES,
  isGuestMessagingStoragePathForPartner,
  isPartnerMessagingStoragePathForPartner,
  mimeFromGuestImagePath,
} from '@/lib/messaging/guest-chat-image'
import { downloadPartnerBunnyObject } from '@/lib/storage/partner-bunny-cdn'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PARTNER_IN_PATH =
  /^messaging-(?:guest|partner)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i

/** Ảnh chat đã PUT Bunny — phát cùng origin vì điện thoại thường không mở được `*.b-cdn.net`. */
export async function GET(request: NextRequest) {
  const path = (request.nextUrl.searchParams.get('path') || '').trim()
  const partnerId = PARTNER_IN_PATH.exec(path)?.[1] ?? ''
  if (
    !partnerId ||
    path.includes('..') ||
    (!isGuestMessagingStoragePathForPartner(path, partnerId) &&
      !isPartnerMessagingStoragePathForPartner(path, partnerId))
  ) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  try {
    const bytes = await downloadPartnerBunnyObject(partnerId, path, GUEST_CHAT_IMAGE_MAX_BYTES)
    if (!bytes) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': mimeFromGuestImagePath(path),
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
