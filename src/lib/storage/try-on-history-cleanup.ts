import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { removeTryOnStorageFromPublicUrls } from '@/lib/storage/try-on-public-upload'

/**
 * Xóa bản ghi `try_on_history` và object trên Bunny theo các URL đã lưu.
 */
export async function deleteTryOnHistoryRowAndStorage(historyId: string): Promise<void> {
  if (!isPgConfigured()) {
    throw new Error('DATABASE_URL is required to delete try_on_history')
  }
  const pool = getPgPool()
  const { rows } = await pool.query<{
    original_image_url: string
    garment_image_url: string
    result_image_url: string | null
  }>(
    `select original_image_url, garment_image_url, result_image_url
     from public.try_on_history where id = $1::uuid limit 1`,
    [historyId]
  )
  const row = rows[0]
  if (row) {
    await removeTryOnStorageFromPublicUrls([row.original_image_url, row.garment_image_url, row.result_image_url])
  }
  await pool.query(`delete from public.try_on_history where id = $1::uuid`, [historyId])
}
