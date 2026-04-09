import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { isPgConfigured } from '@/lib/db/pool'
import { insertSlideShareSessionPg } from '@/lib/db/slide-share-pg'
import { defaultPublicOrigin } from '@/lib/public-app-origin'

function generateShareCode(): string {
  return randomBytes(6).toString('base64url').slice(0, 8)
}

/** Lấy base URL đúng tên miền server – tránh localhost khi chạy production */
function getShareBaseUrl(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? ''
  const proto = req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '')
  const effectiveProto = proto === 'on' || proto === 'https' ? 'https' : proto
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    return `${effectiveProto}://${host}`.replace(/\/$/, '')
  }
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl.replace(/\/$/, '')
  }
  if (process.env.NODE_ENV === 'production') {
    return (envUrl || defaultPublicOrigin()).replace(/\/$/, '')
  }
  return req.nextUrl.origin
}

/** Tạo phiên chia sẻ slide – trả về share_code và share_url */
export async function POST(req: NextRequest) {
  try {
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
    }
    const body = await req.json()
    const { content, topic, slides, slideMode, curriculumId } = body as {
      content?: string
      topic?: string
      slides?: unknown[]
      slideMode?: string
      curriculumId?: string
    }
    if (!Array.isArray(slides) || slides.length === 0) {
      return NextResponse.json({ error: 'slides required' }, { status: 400 })
    }
    const shareCode = generateShareCode()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const ok = await insertSlideShareSessionPg({
      shareCode,
      content: content ?? '',
      topic: topic ?? '',
      slides,
      slideMode: slideMode ?? null,
      curriculumId: curriculumId ?? null,
      expiresAtIso: expiresAt.toISOString(),
    })
    if (ok !== true) {
      return NextResponse.json({ error: 'Không lưu được phiên chia sẻ.' }, { status: 500 })
    }
    const baseUrl = getShareBaseUrl(req)
    const shareUrl = `${baseUrl}/giao-trinh/xem-slide?share=${shareCode}`
    return NextResponse.json({ success: true, shareCode, shareUrl })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
