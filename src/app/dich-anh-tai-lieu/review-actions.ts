'use server'

import { revalidatePath } from 'next/cache'
import { getUserOrBypass } from '@/lib/auth'
import { insertDocumentTranslateReview } from '@/lib/dich-anh-tai-lieu/reviews'

export async function submitDocumentTranslateReview(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getUserOrBypass()
  if (!user) return { ok: false, error: 'login' }
  const meta = user.user_metadata ?? {}
  const fromMeta = String(meta.full_name || meta.name || '').trim()
  const fromEmail = String(user.email || '').split('@')[0]?.trim() || ''
  const authorName = (fromMeta || fromEmail || 'Khách').slice(0, 80)
  const rating = Number(formData.get('rating'))
  const body = String(formData.get('body') || '')
  const saved = await insertDocumentTranslateReview({
    userId: user.id,
    authorName,
    rating,
    body,
  })
  if (saved.ok) revalidatePath('/dich-anh-tai-lieu')
  return saved
}
