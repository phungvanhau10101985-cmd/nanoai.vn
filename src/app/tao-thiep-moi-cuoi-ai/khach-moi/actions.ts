'use server'

import { revalidatePath } from 'next/cache'
import { getUserForCreditAction } from '@/lib/auth'
import {
  createWeddingInvitedGuest,
  createWeddingInvitedGuestsBatch,
  deleteWeddingInvitedGuest,
  ensureWeddingCardOwnerProfile,
  getWeddingCardForUser,
  listWeddingInvitedGuests,
  updateWeddingCardSideInviteSettings,
  updateWeddingInvitedGuest,
  confirmWeddingInvitedGuestStatusByHost,
  type WeddingInvitedGuestStatus,
} from '@/lib/db/wedding-cards-pg'
import { buildPersonalWeddingInviteFromSideContext } from '@/lib/wedding/build-personal-wedding-invite'
import { normalizeGuestInviteVenue, type WeddingGuestInviteVenue } from '@/lib/wedding/wedding-guest-invite-venue'
import { stripQuyHonorificPrefix } from '@/lib/wedding/wedding-guest-honorific-map'
import { weddingSideInviteSettingsFromCard } from '@/lib/wedding/wedding-side-invite-settings'
import {
  buildWeddingGuestImportTemplate,
  parseWeddingGuestImportSheet,
  WEDDING_GUEST_IMPORT_MAX_BYTES,
} from '@/lib/wedding/wedding-invited-guests-excel'

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

export async function downloadWeddingGuestImportTemplate(
  side?: 'groom' | 'bride',
): Promise<{ base64: string } | { error: string }> {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const buffer = buildWeddingGuestImportTemplate(side === 'bride' || side === 'groom' ? side : undefined)
  return { base64: buffer.toString('base64') }
}

export async function importWeddingInvitedGuests(formData: FormData) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const userId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const cardId = clean(formData.get('cardId'))
  const card = await getWeddingCardForUser(cardId, userId)
  if (!card) return { error: 'Không tìm thấy thiệp.' }
  const file = formData.get('file')
  if (!(file instanceof File) || file.size <= 0) return { error: 'Chọn file Excel khách mời.' }
  if (file.size > WEDDING_GUEST_IMPORT_MAX_BYTES) return { error: 'File quá lớn. Tối đa 1,5 MB.' }
  const forceRaw = clean(formData.get('forceSide'), 20)
  const forceSide = forceRaw === 'groom_home' || forceRaw === 'bride_home' ? forceRaw : undefined
  const parsed = parseWeddingGuestImportSheet(Buffer.from(await file.arrayBuffer()), { forceSide })
  if ('error' in parsed) return { error: parsed.error }
  if (!parsed.rows.length) {
    return {
      error: parsed.skippedSample
        ? 'File chỉ còn dòng mẫu. Xóa dòng mẫu, điền khách, rồi import lại.'
        : parsed.errors[0] || 'Không có dòng khách hợp lệ.',
    }
  }
  const sideSettings = weddingSideInviteSettingsFromCard(card)
  const created = await createWeddingInvitedGuestsBatch({
    cardId: card.id,
    userId,
    guests: parsed.rows.map((row) => {
      const side = row.inviteVenue === 'bride_home' ? 'bride' : 'groom'
      const honorific = stripQuyHonorificPrefix(row.guestHonorific)
      return {
        guestHonorific: honorific,
        guestName: row.guestName,
        inviteVenue: row.inviteVenue,
        personalInvite: buildPersonalWeddingInviteFromSideContext({
          side,
          card,
          sideSettings,
          guestHonorific: honorific,
          guestName: row.guestName,
        }).slice(0, 1000),
        status: row.status,
        guestCount: row.guestCount,
        wishMessage: row.wishMessage,
        notes: row.notes,
      }
    }),
  })
  if (!created) return { error: 'Không thêm được khách. Thử lại.' }
  revalidatePath('/tao-thiep-moi-cuoi-ai/khach-moi')
  return {
    created,
    skipped: parsed.errors.length + parsed.skippedSample,
    errors: parsed.errors,
  }
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

export async function confirmWeddingInvitedGuestStatus(formData: FormData) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const userId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const cardId = clean(formData.get('cardId'), 80)
  const guestId = clean(formData.get('guestId'), 80)
  if (!guestId) return { error: 'Lưu tên khách trước khi xác nhận trạng thái.' }
  const card = await getWeddingCardForUser(cardId, userId)
  if (!card) return { error: 'Không tìm thấy thiệp.' }

  const result = await confirmWeddingInvitedGuestStatusByHost({
    guestId,
    cardId,
    userId,
    status: parseStatus(formData.get('status')),
  })
  if ('error' in result) {
    if (result.error === 'guest_locked') {
      return { error: 'Khách đã tự xác nhận. Không sửa trạng thái được.' }
    }
    return { error: 'Không lưu được trạng thái.' }
  }

  revalidatePath('/tao-thiep-moi-cuoi-ai/khach-moi')
  revalidatePath('/tao-thiep-moi-cuoi-ai')
  return { guest: result.guest }
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
    brideInviteThankYouText: clean(formData.get('brideInviteThankYouText'), 2000) || card.brideInviteThankYouText,
    groomParents: formData.has('groomParents') ? clean(formData.get('groomParents'), 500) : card.groomParents,
    brideParents: formData.has('brideParents') ? clean(formData.get('brideParents'), 500) : card.brideParents,
    sectionConfig: formData.has('sectionConfig') ? clean(formData.get('sectionConfig'), 8000) : '',
  })

  if (!updated) return { error: 'Không lưu được địa chỉ mời.' }

  revalidatePath('/tao-thiep-moi-cuoi-ai/khach-moi')
  revalidatePath('/tao-thiep-moi-cuoi-ai')
  revalidatePath(`/thiep-moi-cuoi/${updated.slug}`)
  return { card: updated }
}
