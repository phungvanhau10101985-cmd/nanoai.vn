'use server'

import { revalidatePath } from 'next/cache'
import { getUserOrBypass } from '@/lib/auth'
import { insertLanguageCoachReview, LANGUAGE_REVIEW_PAGE_PATH, languageReviewPageKey } from '@/lib/hoc-ngoai-ngu/reviews'

export async function submitLanguageCoachReview(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getUserOrBypass()
  if (!user) return { ok: false, error: 'login' }
  const meta = user.user_metadata ?? {}
  const fromMeta = String(meta.full_name || meta.name || '').trim()
  const fromEmail = String(user.email || '').split('@')[0]?.trim() || ''
  const authorName = (fromMeta || fromEmail || 'Khách').slice(0, 80)
  const rating = Number(formData.get('rating'))
  const body = String(formData.get('body') || '')
  const pageKey = languageReviewPageKey(String(formData.get('pageKey') || ''))
  const saved = await insertLanguageCoachReview({
    userId: user.id,
    authorName,
    rating,
    body,
    pageKey,
  })
  if (saved.ok) {
    revalidatePath(LANGUAGE_REVIEW_PAGE_PATH[pageKey])
  }
  return saved
}
