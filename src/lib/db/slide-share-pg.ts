import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type SlideShareSessionRowPg = {
  content: string
  topic: string
  slides: unknown[]
  slide_mode: string | null
  curriculum_id: string | null
}

/** Đọc phiên chia sẻ còn hạn — GET `/api/tao-giao-trinh/share/[code]`. */
export async function fetchSlideShareSessionByCodePg(shareCode: string): Promise<SlideShareSessionRowPg | null> {
  if (!isPgConfigured()) return null
  const code = shareCode.trim()
  if (!code) return null
  try {
    const row = await pgQueryOne<{
      content: string | null
      topic: string | null
      slides: unknown
      slide_mode: string | null
      curriculum_id: string | null
    }>(
      `select content, topic, slides, slide_mode, curriculum_id
       from public.slide_share_sessions
       where share_code = $1 and expires_at > timezone('utc'::text, now())
       limit 1`,
      [code]
    )
    if (!row) return null
    const slidesRaw = row.slides
    const slides = Array.isArray(slidesRaw) ? slidesRaw : []
    return {
      content: String(row.content ?? ''),
      topic: String(row.topic ?? ''),
      slides,
      slide_mode: row.slide_mode != null ? String(row.slide_mode) : null,
      curriculum_id: row.curriculum_id != null ? String(row.curriculum_id) : null,
    }
  } catch (e) {
    console.error('[slide-share-pg] fetchSlideShareSessionByCodePg', e)
    return null
  }
}

/** Tạo phiên chia sẻ — POST `/api/tao-giao-trinh/share`. Trả `true` nếu insert OK. */
export async function insertSlideShareSessionPg(input: {
  shareCode: string
  content: string
  topic: string
  slides: unknown[]
  slideMode: string | null
  curriculumId: string | null
  expiresAtIso: string
}): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    await pgQuery(
      `insert into public.slide_share_sessions (
         share_code, content, topic, slides, slide_mode, curriculum_id, expires_at
       ) values ($1, $2, $3, $4::jsonb, $5, $6, $7::timestamptz)`,
      [
        input.shareCode,
        input.content,
        input.topic,
        JSON.stringify(input.slides ?? []),
        input.slideMode,
        input.curriculumId,
        input.expiresAtIso,
      ]
    )
    return true
  } catch (e) {
    console.error('[slide-share-pg] insertSlideShareSessionPg', e)
    return null
  }
}
