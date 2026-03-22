import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'

function generateShareCode(): string {
  return randomBytes(6).toString('base64url').slice(0, 8)
}

/** Lấy base URL đúng tên miền server – tránh localhost khi chạy production */
function getShareBaseUrl(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? ''
  const proto = req.headers.get('x-forwarded-proto') ?? (req.nextUrl.protocol.replace(':', ''))
  const effectiveProto = proto === 'on' || proto === 'https' ? 'https' : proto
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    return `${effectiveProto}://${host}`.replace(/\/$/, '')
  }
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl.replace(/\/$/, '')
  }
  if (process.env.NODE_ENV === 'production') {
    return (envUrl || 'https://nanoai.vn').replace(/\/$/, '')
  }
  return req.nextUrl.origin
}

/** Tạo phiên chia sẻ slide – trả về share_code và share_url */
export async function POST(req: NextRequest) {
  try {
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
    const supabase = await createClient()
    const { error } = await supabase.from('slide_share_sessions').insert({
      share_code: shareCode,
      content: content ?? '',
      topic: topic ?? '',
      slides,
      slide_mode: slideMode ?? null,
      curriculum_id: curriculumId ?? null,
      expires_at: expiresAt.toISOString(),
    })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const baseUrl = getShareBaseUrl(req)
    const shareUrl = `${baseUrl}/giao-trinh/xem-slide?share=${shareCode}`
    return NextResponse.json({ success: true, shareCode, shareUrl })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
