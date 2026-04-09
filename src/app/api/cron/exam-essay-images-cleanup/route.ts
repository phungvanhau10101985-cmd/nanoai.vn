import { NextRequest, NextResponse } from 'next/server'
import { EXAM_ESSAY_IMAGE_RETENTION_DAYS } from '@/lib/exam-essay-config'
import {
  cleanupBunnyExamEssayImagesOlderThan,
  examEssayBunnyStorageConfigured,
} from '@/lib/storage/exam-essay-public-upload'

/**
 * Cron: xóa file ảnh bài tự luận quá hạn trên Bunny (cây `exam-essay-images/`).
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

  if (!examEssayBunnyStorageConfigured()) {
    return NextResponse.json(
      { error: 'Bunny Storage chưa cấu hình (BUNNY_STORAGE_ZONE, BUNNY_STORAGE_API_KEY, BUNNY_STORAGE_PUBLIC_BASE_URL).' },
      { status: 503 }
    )
  }

  try {
    const deletedBunny = await cleanupBunnyExamEssayImagesOlderThan(EXAM_ESSAY_IMAGE_RETENTION_DAYS)
    return NextResponse.json({
      ok: true,
      deleted: deletedBunny,
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
