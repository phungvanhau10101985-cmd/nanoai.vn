import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('slide_share_sessions')
      .select('content, topic, slides, slide_mode, curriculum_id')
      .eq('share_code', code.trim())
      .gt('expires_at', new Date().toISOString())
      .single()
    if (error || !data) {
      return NextResponse.json({ error: 'Không tìm thấy hoặc đã hết hạn' }, { status: 404 })
    }
    return NextResponse.json({
      content: data.content ?? '',
      topic: data.topic ?? '',
      slides: data.slides ?? [],
      slideMode: data.slide_mode ?? null,
      curriculumId: data.curriculum_id ?? null,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
