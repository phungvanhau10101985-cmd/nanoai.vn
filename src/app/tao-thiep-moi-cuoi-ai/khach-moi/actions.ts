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
  loadWeddingAttendanceSources,
  getWeddingRsvpNotifyRowForOwner,
  saveWeddingRsvpNotifySettings,
  type WeddingInvitedGuestStatus,
} from '@/lib/db/wedding-cards-pg'
import {
  summarizeWeddingAttendanceSources,
  findOutsideRsvps,
  weddingNotifyRecipients,
} from '@/lib/wedding/wedding-attendance-summary'
import { buildPersonalWeddingInviteFromSideContext } from '@/lib/wedding/build-personal-wedding-invite'
import { normalizeGuestInviteVenue, type WeddingGuestInviteVenue } from '@/lib/wedding/wedding-guest-invite-venue'
import { stripQuyHonorificPrefix } from '@/lib/wedding/wedding-guest-honorific-map'
import { weddingSideInviteSettingsFromCard } from '@/lib/wedding/wedding-side-invite-settings'
import {
  buildWeddingGuestImportTemplate,
  parseWeddingGuestImportSheet,
  WEDDING_GUEST_IMPORT_MAX_BYTES,
} from '@/lib/wedding/wedding-invited-guests-excel'
import {
  weddingGuestPackBlockedMessage,
  weddingGuestPackLimitSide,
  type WeddingGuestPackId,
  type WeddingGuestPackSide,
  type WeddingGuestSideQuotas,
} from '@/lib/wedding/wedding-guest-pack'
import {
  completeWeddingGuestPackPayment,
  createWeddingGuestPackPayment,
  getWeddingGuestPackPaymentForUser,
  loadWeddingGuestPackQuotas,
} from '@/lib/db/wedding-guest-pack-pg'

async function guestPackLimitResult(
  cardId: string,
  userId: string,
  side: WeddingGuestPackSide,
): Promise<{
  error: string
  code: 'guest_pack_limit'
  side: WeddingGuestPackSide
  quotas: WeddingGuestSideQuotas | null
}> {
  const quotas = await loadWeddingGuestPackQuotas(cardId, userId)
  const quota = quotas?.[side] ?? null
  return {
    error: quota ? weddingGuestPackBlockedMessage(quota, side) : 'Đã hết chỗ khách. Chọn gói để thêm tiếp.',
    code: 'guest_pack_limit' as const,
    side,
    quotas,
  }
}

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
  const importLimit = weddingGuestPackLimitSide(String(created))
  if (importLimit) return guestPackLimitResult(card.id, userId, importLimit)
  if (!created) return { error: 'Không thêm được khách. Thử lại.' }
  revalidatePath('/tao-thiep-moi-cuoi-ai/khach-moi')
  revalidatePath('/tao-thiep-moi-cuoi-ai/ket-qua')
  return {
    created,
    skipped: parsed.errors.length + parsed.skippedSample,
    errors: parsed.errors,
  }
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value)
}

export async function loadWeddingInvitedGuestsPage(cardId: string) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const userId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const card = await getWeddingCardForUser(cardId, userId)
  if (!card) return { error: 'Không tìm thấy thiệp.' }
  const guests = await listWeddingInvitedGuests(card.id, userId)
  const quotas = await loadWeddingGuestPackQuotas(card.id, userId)
  const [sources, settings] = await Promise.all([
    loadWeddingAttendanceSources(card.id, userId),
    getWeddingRsvpNotifyRowForOwner(card.id, userId),
  ])
  const outsideRsvps = sources ? findOutsideRsvps(sources.guests, sources.rsvps) : []
  return {
    card,
    guests,
    quotas,
    outsideRsvps,
    notifySettings: {
      groomEmail: settings?.groomEmail ?? '',
      brideEmail: settings?.brideEmail ?? '',
      notify: Boolean(settings?.daily || settings?.onIncrease),
    },
  }
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
  if (groomEmail && !isEmail(groomEmail)) return { error: 'Email bên mời / chú rể chưa đúng.' }
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
  revalidatePath('/tao-thiep-moi-cuoi-ai/khach-moi')
  revalidatePath('/tao-thiep-moi-cuoi-ai/ket-qua')
  return { success: true as const }
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

  if (typeof guest === 'string') {
    const saveLimit = weddingGuestPackLimitSide(guest) || (guest.includes('bride') ? 'bride' : 'groom')
    return guestPackLimitResult(cardId, userId, saveLimit)
  }
  if (!guest) return { error: 'Không lưu được khách mời. Kiểm tra tên khách.' }

  revalidatePath('/tao-thiep-moi-cuoi-ai/khach-moi')
  revalidatePath('/tao-thiep-moi-cuoi-ai/ket-qua')
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
  revalidatePath('/tao-thiep-moi-cuoi-ai/ket-qua')
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
  revalidatePath('/tao-thiep-moi-cuoi-ai/ket-qua')
  revalidatePath('/tao-thiep-moi-cuoi-ai')
  return { success: true }
}

export async function startWeddingGuestPackPayment(
  cardId: string,
  packId: WeddingGuestPackId,
  side: WeddingGuestPackSide,
) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  if (side !== 'groom' && side !== 'bride') return { error: 'Chọn nhà trai hoặc nhà gái.' }
  const userId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const card = await getWeddingCardForUser(cardId, userId)
  if (!card) return { error: 'Không tìm thấy thiệp.' }
  const payment = await createWeddingGuestPackPayment({ userId, cardId: card.id, packId, side })
  if ('error' in payment) return { error: payment.error }
  return { payment }
}

export async function readWeddingGuestPackPayment(paymentId: string) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const userId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const payment = await getWeddingGuestPackPaymentForUser(paymentId, userId)
  if (!payment) return { error: 'Không thấy giao dịch.' }
  const quotas = payment.status === 'completed' ? await loadWeddingGuestPackQuotas(payment.cardId, userId) : null
  return { payment, quotas }
}

export async function confirmWeddingGuestPackPaymentLocal(paymentId: string) {
  if (process.env.NODE_ENV === 'production') return { error: 'Chỉ dùng trên máy local.' }
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const userId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const payment = await getWeddingGuestPackPaymentForUser(paymentId, userId)
  if (!payment) return { error: 'Không thấy giao dịch.' }
  if (payment.status === 'completed') {
    const quotas = await loadWeddingGuestPackQuotas(payment.cardId, userId)
    return { payment, quotas }
  }
  const completed = await completeWeddingGuestPackPayment({
    paymentId: payment.id,
    transactionId: `local-${payment.id}`,
    normalizedContent: payment.transactionContent.trim().toUpperCase(),
    sepayData: { source: 'local-dev' },
  })
  if ('error' in completed) return { error: 'Chưa ghi được gói.' }
  const quotas = await loadWeddingGuestPackQuotas(payment.cardId, userId)
  const next = await getWeddingGuestPackPaymentForUser(paymentId, userId)
  return { payment: next, quotas }
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
