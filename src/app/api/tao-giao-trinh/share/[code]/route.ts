import { NextRequest, NextResponse } from 'next/server'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchSlideShareSessionByCodePg } from '@/lib/db/slide-share-pg'

/** Lấy dữ liệu slide chia sẻ theo mã */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    if (!code?.trim()) {
      return NextResponse.json({ error: 'code required' }, { status: 400 })
    }
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
    }
    const data = await fetchSlideShareSessionByCodePg(code)
    if (!data) {
      return NextResponse.json({ error: 'Không tìm thấy hoặc đã hết hạn' }, { status: 404 })
    }
    return NextResponse.json({
      content: data.content,
      topic: data.topic,
      slides: data.slides ?? [],
      slideMode: data.slide_mode ?? null,
      curriculumId: data.curriculum_id ?? null,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
