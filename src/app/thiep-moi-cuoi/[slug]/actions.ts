'use server'

import { revalidatePath } from 'next/cache'
import {
  createWeddingRsvp,
  createWeddingWish,
  getPublishedWeddingCardBySlug,
  syncInvitedGuestFromRsvp,
  upsertWeddingReminder,
} from '@/lib/db/wedding-cards-pg'
import { DEFAULT_WEB_LOCALE, normalizeWebLocale } from '@/lib/i18n/config'
import { normalizeGuestInviteVenue } from '@/lib/wedding/wedding-guest-invite-venue'
import { resolveWeddingDateIso } from '@/lib/wedding/wedding-date-normalize'

function clean(value: FormDataEntryValue | null, max = 300): string {
  return String(value ?? '').trim().slice(0, max)
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email)
}

function resolveCardWeddingDateIso(
  card: Awaited<ReturnType<typeof getPublishedWeddingCardBySlug>>,
  inviteVenue: ReturnType<typeof normalizeGuestInviteVenue>,
): string | null {
  if (!card) return null
  if (inviteVenue === 'groom_home') {
    return resolveWeddingDateIso(card.groomInviteWeddingDate ?? card.weddingDate)
  }
  if (inviteVenue === 'bride_home') {
    return resolveWeddingDateIso(card.brideInviteWeddingDate ?? card.weddingDate)
  }
  return resolveWeddingDateIso(card.weddingDate)
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

export async function subscribeWeddingReminder(slug: string, formData: FormData) {
  const card = await getPublishedWeddingCardBySlug(slug)
  if (!card) return { errorCode: 'CARD_NOT_FOUND' as const }

  const guestEmail = clean(formData.get('guestEmail'), 180).toLowerCase()
  const guestName = clean(formData.get('guestName'), 120)
  const inviteVenue = normalizeGuestInviteVenue(formData.get('inviteVenue'))
  const daysBeforeRaw = Number(formData.get('daysBefore') || 0)
  const daysBefore = Math.round(daysBeforeRaw)
  const locale = normalizeWebLocale(clean(formData.get('locale'), 8)) ?? DEFAULT_WEB_LOCALE

  if (!guestEmail || !isValidEmail(guestEmail)) return { errorCode: 'INVALID_EMAIL' as const }
  if (!Number.isFinite(daysBefore) || daysBefore < 1 || daysBefore > 90) {
    return { errorCode: 'INVALID_DAYS' as const }
  }

  const weddingDateIso = resolveCardWeddingDateIso(card, inviteVenue)
  if (!weddingDateIso) return { errorCode: 'NO_WEDDING_DATE' as const }

  const weddingDate = new Date(`${weddingDateIso}T12:00:00`)
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const msPerDay = 24 * 60 * 60 * 1000
  const daysUntilWedding = Math.ceil((weddingDate.getTime() - today.getTime()) / msPerDay)
  if (daysUntilWedding <= 0) return { errorCode: 'WEDDING_PASSED' as const }
  if (daysBefore >= daysUntilWedding) return { errorCode: 'DAYS_TOO_LARGE' as const }

  await upsertWeddingReminder({
    cardId: card.id,
    guestEmail,
    guestName,
    inviteVenue,
    daysBefore,
    locale,
  })

  return { success: true as const, daysBefore }
}
