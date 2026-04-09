'use server'

import { getUserForAction } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { removeTryOnStorageFromPublicUrls } from '@/lib/storage/try-on-public-upload'
import { pgDeleteTryOnHistoryForUser, pgGetTryOnHistoryUrlsForUser } from '@/lib/db/dashboard-user-pg'
import { isPgConfigured } from '@/lib/db/pool'

export async function deleteHistoryItem(id: string) {
  const result = await getUserForAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  if (!isPgConfigured()) {
    return { error: 'Failed to delete item' }
  }

  const row = await pgGetTryOnHistoryUrlsForUser(user.id, id)
  if (!row) {
    return { error: 'Failed to delete item' }
  }

  await removeTryOnStorageFromPublicUrls([row.original_image_url, row.garment_image_url, row.result_image_url])

  const deleted = await pgDeleteTryOnHistoryForUser(user.id, id)
  if (!deleted) {
    return { error: 'Failed to delete item' }
  }

  revalidatePath('/dashboard/history')
  revalidatePath('/dashboard/history/translate')
  return { success: true }
}
