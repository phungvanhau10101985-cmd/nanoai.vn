'use server'

import { revalidatePath } from 'next/cache'
import { getUserForCreditAction } from '@/lib/auth'
import {
  ensureWeddingCardOwnerProfile,
  getWeddingCardForUser,
  loadWeddingAttendanceSources,
  saveWeddingRsvpNotifySettings,
} from '@/lib/db/wedding-cards-pg'
import { summarizeWeddingAttendanceSources, weddingNotifyRecipients } from '@/lib/wedding/wedding-attendance-summary'

function clean(value: FormDataEntryValue | null, max = 180): string {
  return String(value ?? '').trim().slice(0, max)
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value)
}

export async function saveWeddingAttendanceNotifySettings(formData: FormData) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const userId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const cardId = clean(formData.get('cardId'), 80)
  const card = await getWeddingCardForUser(cardId, userId)
  if (!card) return { error: 'Không tìm thấy thiệp.' }

  const groomEmail = clean(formData.get('groomEmail'))
  const brideEmail = clean(formData.get('brideEmail'))
  const notify = formData.get('notify') === 'true'
  if (groomEmail && !isEmail(groomEmail)) return { error: 'Email chú rể chưa đúng.' }
  if (brideEmail && !isEmail(brideEmail)) return { error: 'Email cô dâu chưa đúng.' }
  if (notify && weddingNotifyRecipients(groomEmail, brideEmail).length === 0) {
    return { error: 'Điền ít nhất một email để nhận thông báo.' }
  }

  const sources = await loadWeddingAttendanceSources(card.id, userId)
  const people = sources
    ? summarizeWeddingAttendanceSources(sources.guests, sources.rsvps).total.peopleAttending
    : 0
  const saved = await saveWeddingRsvpNotifySettings({
    cardId: card.id,
    userId,
    groomEmail,
    brideEmail,
    daily: notify,
    onIncrease: false,
    currentPeople: people,
  })
  if (!saved) return { error: 'Không lưu được cài đặt.' }
  revalidatePath('/tao-thiep-moi-cuoi-ai/ket-qua')
  return { success: true as const }
}
