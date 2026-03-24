import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { EXAM_ESSAY_IMAGE_RETENTION_DAYS } from '@/lib/exam-essay-config'

/**
 * Cron: xóa file ảnh bài tự luận trên storage quá hạn (bucket exam-essay-images).
 * Bảo vệ: Authorization: Bearer <EXAM_ESSAY_IMAGES_CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const secret = process.env.EXAM_ESSAY_IMAGES_CRON_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: 'EXAM_ESSAY_IMAGES_CRON_SECRET not configured.' }, { status: 503 })
  }
  const auth = req.headers.get('authorization')?.trim()
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    return NextResponse.json({ error: 'Missing Supabase service env.' }, { status: 500 })
  }

  const admin = createClient(url, key)
  try {
    const { data, error } = await admin.rpc('cleanup_exam_essay_images_older_than', {
      p_days: EXAM_ESSAY_IMAGE_RETENTION_DAYS,
    })
    if (error) {
      console.error('[cron/exam-essay-images-cleanup]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const deleted = (() => {
      if (typeof data === 'bigint') return Number(data)
      if (typeof data === 'number' && Number.isFinite(data)) return data
      if (typeof data === 'string') {
        const n = Number(data)
        return Number.isFinite(n) ? n : 0
      }
      return 0
    })()
    return NextResponse.json({
      ok: true,
      deleted,
      retentionDays: EXAM_ESSAY_IMAGE_RETENTION_DAYS,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[cron/exam-essay-images-cleanup]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
