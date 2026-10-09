import type { WebLocale } from '@/lib/i18n/config'
import { formatWeddingDateForDisplay, resolveWeddingDateIso } from '@/lib/wedding/wedding-date-normalize'
import {
  firstClockTime,
  resolveWeddingDisplayTime,
} from '@/lib/wedding/wedding-calendar-utils'
import type { WeddingCard } from '@/lib/db/wedding-cards-pg'
import type { WeddingSideInviteSettings } from '@/lib/wedding/wedding-side-invite-settings'
import type { GuestInviteSide } from '@/lib/wedding/wedding-guest-invite-location'
import {
  resolveHostReferenceStyle,
  splitGuestDisplayName,
  stripQuyHonorificPrefix,
  type HostReferenceStyle,
} from '@/lib/wedding/wedding-guest-honorific-map'

export type { HostReferenceStyle }
export {
  WEDDING_GUEST_HONORIFIC_SUGGESTIONS,
  classifyGuestHonorific,
  resolveHostReferenceStyle,
  stripQuyHonorificPrefix,
} from '@/lib/wedding/wedding-guest-honorific-map'

export type PersonalWeddingInviteInput = {
  side: GuestInviteSide
  groomName: string
  brideName: string
  groomParents: string
  brideParents: string
  guestHonorific: string
  guestName: string
  weddingDateIso: string | null
  receptionTime: string
  partyStartTime: string
  address: string
  locale?: WebLocale
}

const VI_SURNAMES = new Set([
  'nguyễn',
  'trần',
  'lê',
  'phạm',
  'hoàng',
  'huỳnh',
  'phùng',
  'vũ',
  'võ',
  'đặng',
  'bùi',
  'đỗ',
  'hồ',
  'ngô',
  'dương',
  'lý',
  'đinh',
  'đoàn',
  'mai',
  'tạ',
  'châu',
  'trương',
  'lưu',
  'lương',
  'tôn',
  'hà',
  'tăng',
  'quách',
  'hứa',
])

function isLikelySurname(word: string): boolean {
  const key = word.trim().toLocaleLowerCase('vi')
  return VI_SURNAMES.has(key)
}

/** Tên gọi thân mật — bỏ họ nếu nhận diện được. */
export function extractGivenName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]
  if (isLikelySurname(parts[0])) {
    return parts.length === 2 ? parts[1] : parts.slice(1).join(' ')
  }
  return fullName.trim()
}

export function buildHostInviteLine(input: {
  style: HostReferenceStyle
  hostFullName: string
  spouseFullName?: string
}): string {
  const { style, hostFullName, spouseFullName } = input
  const hostLabel = style.useGivenName ? extractGivenName(hostFullName) : hostFullName.trim()
  if (!hostLabel) return ''

  let core = ''
  if (style.includeSpouse && spouseFullName?.trim()) {
    const spouseLabel = extractGivenName(spouseFullName)
    core = spouseLabel
      ? `${style.pronoun} ${hostLabel} và ${spouseLabel}`
      : `${style.pronoun} ${hostLabel}`
  } else if (style.pronoun) {
    core = `${style.pronoun} ${hostLabel}`
  } else {
    core = hostFullName.trim()
  }

  if (style.includeFamily) return `${core} và gia đình`
  return core
}

export function buildGuestDisplayName(honorific: string, name: string): string {
  const h = stripQuyHonorificPrefix(honorific)
  const n = name.trim()
  if (h && n) return `${h} ${n}`
  return n || h
}

/** Nhãn khách trong câu mời (xưng hô viết thường giữa câu). */
export function formatGuestInviteLabel(honorific: string, name: string): string {
  const h = stripQuyHonorificPrefix(honorific)
  const n = name.trim()
  if (!h) return n
  if (!n) return h
  const lowerHonorific = h.charAt(0).toLocaleLowerCase('vi') + h.slice(1)
  return `${lowerHonorific} ${n}`
}

/** Xưng hô khi nói về sự có mặt của khách (anh, chú, bà ngoại…). */
function guestPresenceRef(honorific: string): string {
  const h = stripQuyHonorificPrefix(honorific).trim()
  if (!h) return 'bạn'
  return h.charAt(0).toLocaleLowerCase('vi') + h.slice(1)
}

/**
 * Chủ ngữ của «gia đình …» trong câu vinh dự.
 * Khớp cách người mời tự xưng với từng khách (em / cháu / con / anh / chị).
 * Với bạn bè, «bạn» trùng đại từ khách nên dùng «mình».
 */
function familyHonorOwner(hostPronoun: string): string {
  const voice = hostPronoun.trim()
  const lower = voice ? voice.charAt(0).toLocaleLowerCase('vi') + voice.slice(1) : ''
  if (!lower || lower === 'bạn') return 'mình'
  return lower
}

function formatVietnameseClockTime(clock: string): string {
  const trimmed = clock.trim()
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed)
  if (!match) return trimmed
  const hour = Number(match[1])
  const minute = match[2]
  if (minute === '00') return `${hour} giờ`
  return `${hour} giờ ${minute}`
}

/** Khách mẫu trên preview nháp / Xem thiệp, khi chưa mở link một khách thật. */
export const WEDDING_DEMO_GUEST_HONORIFIC = 'Anh'
export const WEDDING_DEMO_GUEST_GIVEN_NAME = 'Minh'

export function weddingDemoGuestDisplayName(locale: WebLocale = 'vi'): string {
  if (locale === 'vi') return buildGuestDisplayName(WEDDING_DEMO_GUEST_HONORIFIC, WEDDING_DEMO_GUEST_GIVEN_NAME)
  return WEDDING_DEMO_GUEST_GIVEN_NAME
}

/** Lời mời cá nhân mẫu — cùng câu thiệp khách nhận khi mở link nhà trai / nhà gái. */
export function buildWeddingDemoPersonalInvite(input: {
  side: GuestInviteSide
  groomName: string
  brideName: string
  groomParents: string
  brideParents: string
  weddingDate: string | null
  receptionTime: string
  partyStartTime: string
  address: string
  guestName?: string
  locale?: WebLocale
}): { guestDisplayName: string; personalInvite: string } {
  const locale = input.locale ?? 'vi'
  const customGuest = (input.guestName ?? '').trim()
  const honorific = !customGuest && locale === 'vi' ? WEDDING_DEMO_GUEST_HONORIFIC : ''
  const givenName = customGuest || WEDDING_DEMO_GUEST_GIVEN_NAME
  const guestDisplayName = customGuest || weddingDemoGuestDisplayName(locale)
  const personalInvite = buildPersonalWeddingInvite({
    side: input.side,
    groomName: input.groomName.trim() || 'An',
    brideName: input.brideName.trim() || 'Lan',
    groomParents: input.groomParents,
    brideParents: input.brideParents,
    guestHonorific: honorific,
    guestName: givenName,
    weddingDateIso: resolveWeddingDateIso(input.weddingDate) || input.weddingDate,
    receptionTime: input.receptionTime,
    partyStartTime: input.partyStartTime,
    address: input.address,
    locale,
  })
  return { guestDisplayName, personalInvite }
}

export function buildPersonalWeddingInvite(input: PersonalWeddingInviteInput): string {
  const locale = input.locale ?? 'vi'
  const isGroom = input.side === 'groom'
  const childName = (isGroom ? input.groomName : input.brideName).trim()
  const spouseName = (isGroom ? input.brideName : input.groomName).trim()
  const parents = (isGroom ? input.groomParents : input.brideParents).trim()
  const splitGuest = input.guestHonorific.trim()
    ? null
    : splitGuestDisplayName(input.guestName)
  const guestHonorific = input.guestHonorific.trim() || splitGuest?.honorific || ''
  const guestName = splitGuest ? splitGuest.givenName : input.guestName
  const guestLabel = formatGuestInviteLabel(guestHonorific, guestName)

  if (!childName || !guestLabel) return ''

  const dateLabel = formatWeddingDateForDisplay(input.weddingDateIso, locale)
  const displayTime = resolveWeddingDisplayTime(input.receptionTime, input.partyStartTime)
  const clock = firstClockTime(displayTime)
  const timeLabel = locale === 'vi' ? formatVietnameseClockTime(clock) : clock

  if (locale === 'vi') {
    const hostStyle = resolveHostReferenceStyle(guestHonorific, input.side)
    const hostPart = buildHostInviteLine({
      style: hostStyle,
      hostFullName: childName,
      spouseFullName: spouseName,
    })
    const whenParts: string[] = []
    if (timeLabel) whenParts.push(`vào lúc ${timeLabel}`)
    if (dateLabel) whenParts.push(`ngày ${dateLabel}`)
    const whenPart = whenParts.length ? ` ${whenParts.join(' ')}` : ''
    const presence = guestPresenceRef(guestHonorific)
    const hostVoice = hostStyle.pronoun || 'Em'
    const familyOwner = familyHonorOwner(hostVoice)
    return `${hostPart} mời ${guestLabel}${whenPart} đến tham dự bữa cơm thân mật cùng gia đình. Sự có mặt của ${presence} là điều vinh dự của gia đình ${familyOwner}. ${hostVoice} trân trọng và mong đợi sự có mặt của ${presence}.`
  }

  const hostPart = parents ? `${childName} and family (${parents})` : childName
  const whenParts: string[] = []
  if (timeLabel) whenParts.push(`at ${timeLabel}`)
  if (dateLabel) whenParts.push(`on ${dateLabel}`)
  const whenPart = whenParts.length ? ` ${whenParts.join(' ')}` : ''
  return `${hostPart} cordially invite ${guestLabel}${whenPart} to an intimate family meal. Your presence is an honor for our family. We respectfully look forward to your presence.`
}

export function buildPersonalWeddingInviteFromSideContext(input: {
  side: GuestInviteSide
  card: Pick<
    WeddingCard,
    | 'groomName'
    | 'brideName'
    | 'groomParents'
    | 'brideParents'
    | 'weddingDate'
    | 'weddingTime'
    | 'partyStartTime'
    | 'venue'
    | 'groomHometown'
    | 'brideHometown'
  >
  sideSettings: WeddingSideInviteSettings
  guestHonorific: string
  guestName: string
  locale?: WebLocale
}): string {
  const prefix = input.side === 'groom' ? 'groomInvite' : 'brideInvite'
  const weddingDate =
    (input.sideSettings[`${prefix}WeddingDate` as keyof WeddingSideInviteSettings] as string)?.trim() ||
    input.card.weddingDate
  const receptionTime =
    (input.sideSettings[`${prefix}ReceptionTime` as keyof WeddingSideInviteSettings] as string)?.trim() ||
    input.card.weddingTime
  const partyStartTime =
    (input.sideSettings[`${prefix}PartyStartTime` as keyof WeddingSideInviteSettings] as string)?.trim() ||
    input.card.partyStartTime
  const address =
    (input.sideSettings[`${prefix}Address` as keyof WeddingSideInviteSettings] as string)?.trim() ||
    (input.side === 'groom' ? input.card.groomHometown : input.card.brideHometown).trim() ||
    input.card.venue.trim()

  return buildPersonalWeddingInvite({
    side: input.side,
    groomName: input.card.groomName,
    brideName: input.card.brideName,
    groomParents: input.card.groomParents,
    brideParents: input.card.brideParents,
    guestHonorific: input.guestHonorific,
    guestName: input.guestName,
    weddingDateIso: weddingDate,
    receptionTime,
    partyStartTime,
    address,
    locale: input.locale,
  })
}
