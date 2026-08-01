'use server'

import { revalidatePath } from 'next/cache'
import { getUserForCreditAction } from '@/lib/auth'
import {
  createWeddingInvitedGuest,
  deleteWeddingInvitedGuest,
  ensureWeddingCardOwnerProfile,
  getWeddingCardForUser,
  listWeddingInvitedGuests,
  updateWeddingCardSideInviteSettings,
  updateWeddingInvitedGuest,
  type WeddingInvitedGuestStatus,
} from '@/lib/db/wedding-cards-pg'
import { normalizeGuestInviteVenue, type WeddingGuestInviteVenue } from '@/lib/wedding/wedding-guest-invite-venue'
import { stripQuyHonorificPrefix } from '@/lib/wedding/wedding-guest-honorific-map'

function clean(value: FormDataEntryValue | null, max = 300): string {
  return String(value ?? '').trim().slice(0, max)
}

function parseStatus(raw: FormDataEntryValue | null): WeddingInvitedGuestStatus {
  const v = clean(raw, 20)
  if (v === 'attending' || v === 'declined') return v
  return 'pending'
}

function parseGuestCount(raw: FormDataEntryValue | null): number {
  return Math.max(0, Math.min(20, Number(raw ?? 1) || 1))
}

export async function loadWeddingInvitedGuestsPage(cardId: string) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const userId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const card = await getWeddingCardForUser(cardId, userId)
  if (!card) return { error: 'Không tìm thấy thiệp.' }
  const guests = await listWeddingInvitedGuests(card.id, userId)
  return { card, guests }
}

export async function saveWeddingInvitedGuest(formData: FormData) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const userId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const cardId = clean(formData.get('cardId'), 80)
  const guestId = clean(formData.get('guestId'), 80)
  const card = await getWeddingCardForUser(cardId, userId)
  if (!card) return { error: 'Không tìm thấy thiệp.' }

  const payload = {
    cardId,
    userId,
    guestHonorific: stripQuyHonorificPrefix(clean(formData.get('guestHonorific'), 80)),
    guestName: clean(formData.get('guestName'), 200),
    inviteVenue: normalizeGuestInviteVenue(formData.get('inviteVenue')) as WeddingGuestInviteVenue,
    personalInvite: clean(formData.get('personalInvite'), 1000),
    status: parseStatus(formData.get('status')),
    guestCount: parseGuestCount(formData.get('guestCount')),
    wishMessage: clean(formData.get('wishMessage'), 1000),
    notes: clean(formData.get('notes'), 1000),
  }

  const guest = guestId
    ? await updateWeddingInvitedGuest({ guestId, ...payload })
    : await createWeddingInvitedGuest(payload)

  if (!guest) return { error: 'Không lưu được khách mời. Kiểm tra tên khách.' }

  revalidatePath('/tao-thiep-moi-cuoi-ai/khach-moi')
  revalidatePath('/tao-thiep-moi-cuoi-ai')
  return { guest }
}

export async function removeWeddingInvitedGuest(formData: FormData) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const userId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const cardId = clean(formData.get('cardId'), 80)
  const guestId = clean(formData.get('guestId'), 80)
  if (!guestId) return { error: 'Thiếu mã khách.' }
  const ok = await deleteWeddingInvitedGuest(guestId, cardId, userId)
  if (!ok) return { error: 'Không xóa được khách mời.' }
  revalidatePath('/tao-thiep-moi-cuoi-ai/khach-moi')
  revalidatePath('/tao-thiep-moi-cuoi-ai')
  return { success: true }
}

export async function saveWeddingSideInviteSettings(formData: FormData) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const userId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const cardId = clean(formData.get('cardId'), 80)
  const card = await getWeddingCardForUser(cardId, userId)
  if (!card) return { error: 'Không tìm thấy thiệp.' }

  const updated = await updateWeddingCardSideInviteSettings({
    cardId,
    userId,
    groomInviteAddress: clean(formData.get('groomInviteAddress'), 500),
    groomInviteMapUrl: clean(formData.get('groomInviteMapUrl'), 500),
    groomInviteReceptionTime: clean(formData.get('groomInviteReceptionTime'), 80),
    groomInvitePartyStartTime: clean(formData.get('groomInvitePartyStartTime'), 80),
    groomInviteWeddingDate: clean(formData.get('groomInviteWeddingDate'), 20),
    groomInviteText: card.groomInviteText,
    groomInviteTextEn: card.groomInviteTextEn,
    groomInviteEventTimeline: clean(formData.get('groomInviteEventTimeline'), 4000),
    groomInviteDressCode: clean(formData.get('groomInviteDressCode'), 600),
    groomInviteContact: clean(formData.get('groomInviteContact'), 120),
    groomInviteCoverImageUrl: clean(formData.get('groomInviteCoverImageUrl'), 1000),
    groomInviteDefaultPersonalMessage: card.groomInviteDefaultPersonalMessage,
    groomInviteThankYouText: clean(formData.get('groomInviteThankYouText'), 2000),
    brideInviteAddress: clean(formData.get('brideInviteAddress'), 500),
    brideInviteMapUrl: clean(formData.get('brideInviteMapUrl'), 500),
    brideInviteReceptionTime: clean(formData.get('brideInviteReceptionTime'), 80),
    brideInvitePartyStartTime: clean(formData.get('brideInvitePartyStartTime'), 80),
    brideInviteWeddingDate: clean(formData.get('brideInviteWeddingDate'), 20),
    brideInviteText: card.brideInviteText,
    brideInviteTextEn: card.brideInviteTextEn,
    brideInviteEventTimeline: clean(formData.get('brideInviteEventTimeline'), 4000),
    brideInviteDressCode: clean(formData.get('brideInviteDressCode'), 600),
    brideInviteContact: clean(formData.get('brideInviteContact'), 120),
    brideInviteCoverImageUrl: clean(formData.get('brideInviteCoverImageUrl'), 1000),
    brideInviteDefaultPersonalMessage: card.brideInviteDefaultPersonalMessage,
    brideInviteThankYouText: clean(formData.get('brideInviteThankYouText'), 2000),
  })

  if (!updated) return { error: 'Không lưu được địa chỉ mời.' }

  revalidatePath('/tao-thiep-moi-cuoi-ai/khach-moi')
  revalidatePath('/tao-thiep-moi-cuoi-ai')
  revalidatePath(`/thiep-moi-cuoi/${updated.slug}`)
  return { card: updated }
}
