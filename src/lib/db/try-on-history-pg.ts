import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export async function insertTryOnHistoryProcessingPg(params: {
  userId: string
  originalImageUrl: string
  garmentImageUrl: string | null
  feature: string
  aspectRatio?: string | null
  veoExtendParentId?: string | null
}): Promise<{ id: string } | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `insert into public.try_on_history (
         user_id, original_image_url, garment_image_url, status, feature, aspect_ratio, veo_extend_parent_id
       ) values ($1::uuid, $2, $3, 'processing', $4, $5, $6::uuid)
       returning id::text as id`,
      [
        params.userId,
        params.originalImageUrl,
        params.garmentImageUrl,
        params.feature,
        params.aspectRatio ?? null,
        params.veoExtendParentId ?? null,
      ]
    )
    return row?.id ? { id: row.id } : null
  } catch (e) {
    console.error('[try-on-history-pg] insertTryOnHistoryProcessingPg', e)
    return null
  }
}

/** Một bản ghi đã hoàn tất ngay khi insert (ví dụ ghép video). */
export async function insertTryOnHistoryCompletedDirectPg(params: {
  userId: string
  originalImageUrl: string
  garmentImageUrl: string
  resultImageUrl: string
  feature: string
  aspectRatio?: string | null
}): Promise<{ id: string } | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `insert into public.try_on_history (
         user_id, original_image_url, garment_image_url, result_image_url, status, feature, aspect_ratio
       ) values ($1::uuid, $2, $3, $4, 'completed', $5, $6)
       returning id::text as id`,
      [
        params.userId,
        params.originalImageUrl,
        params.garmentImageUrl,
        params.resultImageUrl,
        params.feature,
        params.aspectRatio ?? null,
      ]
    )
    return row?.id ? { id: row.id } : null
  } catch (e) {
    console.error('[try-on-history-pg] insertTryOnHistoryCompletedDirectPg', e)
    return null
  }
}

export async function getTryOnHistoryRowByIdPg(historyId: string): Promise<{
  id: string
  user_id: string
  feature: string | null
  veo_gemini_video_uri: string | null
  aspect_ratio: string | null
  status: string
} | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQueryOne<{
      id: string
      user_id: string
      feature: string | null
      veo_gemini_video_uri: string | null
      aspect_ratio: string | null
      status: string
    }>(
      `select id::text, user_id::text, feature, veo_gemini_video_uri, aspect_ratio, status::text
       from public.try_on_history where id = $1::uuid limit 1`,
      [historyId]
    )
  } catch (e) {
    console.error('[try-on-history-pg] getTryOnHistoryRowByIdPg', e)
    return null
  }
}

export async function updateTryOnHistoryCompletedPg(
  historyId: string,
  resultImageUrl: string,
  extra?: { feature?: string | null; aspect_ratio?: string | null; veo_gemini_video_uri?: string | null }
): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `update public.try_on_history
       set result_image_url = $1,
           status = 'completed',
           feature = coalesce($3::text, feature),
           aspect_ratio = coalesce($4::text, aspect_ratio),
           veo_gemini_video_uri = coalesce($5::text, veo_gemini_video_uri)
       where id = $2::uuid`,
      [
        resultImageUrl,
        historyId,
        extra?.feature ?? null,
        extra?.aspect_ratio ?? null,
        extra?.veo_gemini_video_uri ?? null,
      ]
    )
    return true
  } catch (e) {
    console.error('[try-on-history-pg] updateTryOnHistoryCompletedPg', e)
    return false
  }
}

export async function deleteTryOnHistoryPg(historyId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(`delete from public.try_on_history where id = $1::uuid`, [historyId])
    return true
  } catch (e) {
    console.error('[try-on-history-pg] deleteTryOnHistoryPg', e)
    return false
  }
}
