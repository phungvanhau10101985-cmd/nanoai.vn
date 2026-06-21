'use server'

import { revalidatePath } from 'next/cache'
import { createWeddingRsvp, createWeddingWish, getPublishedWeddingCardBySlug, syncInvitedGuestFromRsvp } from '@/lib/db/wedding-cards-pg'

function clean(value: FormDataEntryValue | null, max = 300): string {
  return String(value ?? '').trim().slice(0, max)
}

export async function submitWeddingGuestResponse(slug: string, formData: FormData) {
  const card = await getPublishedWeddingCardBySlug(slug)
  if (!card) return { error: 'Không tìm thấy thiệp.' }
  const guestName = clean(formData.get('guestName'), 120)
  const message = clean(formData.get('message'), 1000)
  const guestCount = Math.max(0, Math.min(20, Number(formData.get('guestCount') || 1) || 1))
  const attending = formData.get('attending') !== 'false'
  if (!guestName) return { error: 'Vui lòng nhập tên khách mời.' }
  if (card.rsvpEnabled) {
    await createWeddingRsvp({ cardId: card.id, guestName, attending, guestCount, message })
    await syncInvitedGuestFromRsvp({ cardId: card.id, guestName, attending, guestCount, message })
  }
  if (message) {
    await createWeddingWish({ cardId: card.id, guestName, message })
  }
  revalidatePath(`/thiep-moi-cuoi/${slug}`)
  return { success: true }
}
