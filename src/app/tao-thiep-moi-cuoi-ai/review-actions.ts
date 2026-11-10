'use server'

import { revalidatePath } from 'next/cache'
import { getUserOrBypass } from '@/lib/auth'
import { insertWeddingCardReview } from '@/lib/wedding/wedding-reviews'

export async function submitWeddingCardReview(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getUserOrBypass()
  if (!user) return { ok: false, error: 'login' }
  const meta = user.user_metadata ?? {}
  const fromMeta = String(meta.full_name || meta.name || '').trim()
  const fromEmail = String(user.email || '').split('@')[0]?.trim() || ''
  const authorName = (fromMeta || fromEmail || 'Khách').slice(0, 80)
  const rating = Number(formData.get('rating'))
  const body = String(formData.get('body') || '')
  const saved = await insertWeddingCardReview({
    userId: user.id,
    authorName,
    rating,
    body,
  })
  if (saved.ok) revalidatePath('/tao-thiep-moi-cuoi-ai')
  return saved
}
