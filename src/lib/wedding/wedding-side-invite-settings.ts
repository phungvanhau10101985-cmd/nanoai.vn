import type { WeddingCard } from '@/lib/db/wedding-cards-pg'
import { mergeWeddingSectionConfig, parseWeddingSectionConfig } from '@/lib/wedding/wedding-section-config'
import { parseWeddingTimeClockAndWeekday } from '@/lib/wedding/wedding-calendar-utils'
import { resolveWeddingDateIso } from '@/lib/wedding/wedding-date-normalize'

export type WeddingSideInviteSettings = {
  groomInviteAddress: string
  groomInviteMapUrl: string
  groomInviteReceptionTime: string
  groomInvitePartyStartTime: string
  groomInviteWeddingDate: string
  groomInviteText: string
  groomInviteTextEn: string
  groomInviteEventTimeline: string
  groomInviteDressCode: string
  groomInviteContact: string
  groomInviteCoverImageUrl: string
  groomInviteDefaultPersonalMessage: string
  groomInviteThankYouText: string
  brideInviteAddress: string
  brideInviteMapUrl: string
  brideInviteReceptionTime: string
  brideInvitePartyStartTime: string
  brideInviteWeddingDate: string
  brideInviteText: string
  brideInviteTextEn: string
  brideInviteEventTimeline: string
  brideInviteDressCode: string
  brideInviteContact: string
  brideInviteCoverImageUrl: string
  brideInviteDefaultPersonalMessage: string
  brideInviteThankYouText: string
}

export function weddingSideInviteSettingsFromCard(card: WeddingCard): WeddingSideInviteSettings {
  return {
    groomInviteAddress: card.groomInviteAddress,
    groomInviteMapUrl: card.groomInviteMapUrl,
    groomInviteReceptionTime: card.groomInviteReceptionTime,
    groomInvitePartyStartTime: card.groomInvitePartyStartTime,
    groomInviteWeddingDate: card.groomInviteWeddingDate ?? '',
    groomInviteText: card.groomInviteText,
    groomInviteTextEn: card.groomInviteTextEn,
    groomInviteEventTimeline: card.groomInviteEventTimeline,
    groomInviteDressCode: card.groomInviteDressCode,
    groomInviteContact: card.groomInviteContact,
    groomInviteCoverImageUrl: card.groomInviteCoverImageUrl,
    groomInviteDefaultPersonalMessage: card.groomInviteDefaultPersonalMessage,
    groomInviteThankYouText: card.groomInviteThankYouText,
    brideInviteAddress: card.brideInviteAddress,
    brideInviteMapUrl: card.brideInviteMapUrl,
    brideInviteReceptionTime: card.brideInviteReceptionTime,
    brideInvitePartyStartTime: card.brideInvitePartyStartTime,
    brideInviteWeddingDate: card.brideInviteWeddingDate ?? '',
    brideInviteText: card.brideInviteText,
    brideInviteTextEn: card.brideInviteTextEn,
    brideInviteEventTimeline: card.brideInviteEventTimeline,
    brideInviteDressCode: card.brideInviteDressCode,
    brideInviteContact: card.brideInviteContact,
    brideInviteCoverImageUrl: card.brideInviteCoverImageUrl,
    brideInviteDefaultPersonalMessage: card.brideInviteDefaultPersonalMessage,
    brideInviteThankYouText: card.brideInviteThankYouText,
  }
}

export function serializeWeddingSideInviteSettings(settings: WeddingSideInviteSettings): string {
  return JSON.stringify(settings)
}

export const EMPTY_WEDDING_SIDE_INVITE_SETTINGS: WeddingSideInviteSettings = {
  groomInviteAddress: '',
  groomInviteMapUrl: '',
  groomInviteReceptionTime: '',
  groomInvitePartyStartTime: '',
  groomInviteWeddingDate: '',
  groomInviteText: '',
  groomInviteTextEn: '',
  groomInviteEventTimeline: '',
  groomInviteDressCode: '',
  groomInviteContact: '',
  groomInviteCoverImageUrl: '',
  groomInviteDefaultPersonalMessage: '',
  groomInviteThankYouText: '',
  brideInviteAddress: '',
  brideInviteMapUrl: '',
  brideInviteReceptionTime: '',
  brideInvitePartyStartTime: '',
  brideInviteWeddingDate: '',
  brideInviteText: '',
  brideInviteTextEn: '',
  brideInviteEventTimeline: '',
  brideInviteDressCode: '',
  brideInviteContact: '',
  brideInviteCoverImageUrl: '',
  brideInviteDefaultPersonalMessage: '',
  brideInviteThankYouText: '',
}

export function appendWeddingSideInviteSettingsToFormData(
  formData: FormData,
  settings: WeddingSideInviteSettings,
): void {
  for (const [key, value] of Object.entries(settings)) {
    formData.append(key, value)
  }
}

export type WeddingSideInviteSide = 'groom' | 'bride'

/** Ô bên trai/gái để trống thì lấy từ thiệp chung. Có chữ riêng thì giữ riêng. */
export const WEDDING_SIDE_LINKED_FIELDS = [
  'WeddingDate',
  'ReceptionTime',
  'PartyStartTime',
  'Address',
  'MapUrl',
  'EventTimeline',
  'DressCode',
  'ThankYouText',
] as const

export type WeddingSideLinkedField = (typeof WEDDING_SIDE_LINKED_FIELDS)[number]

export type WeddingSideSharedSource = {
  weddingDate?: string | null
  weddingTime?: string | null
  partyStartTime?: string | null
  venue?: string | null
  mapUrl?: string | null
  eventTimeline?: string | null
  dressCode?: string | null
  thankYouText?: string | null
  groomHometown?: string | null
  brideHometown?: string | null
}

export function weddingSideSharedFallback(
  card: WeddingSideSharedSource | null | undefined,
  side: WeddingSideInviteSide,
): Record<WeddingSideLinkedField, string> {
  const hometown = (side === 'groom' ? card?.groomHometown : card?.brideHometown) ?? ''
  return {
    WeddingDate: String(card?.weddingDate ?? '').trim(),
    ReceptionTime: String(card?.weddingTime ?? '').trim(),
    PartyStartTime: String(card?.partyStartTime ?? '').trim(),
    Address: hometown.trim() || String(card?.venue ?? '').trim(),
    MapUrl: String(card?.mapUrl ?? '').trim(),
    EventTimeline: String(card?.eventTimeline ?? '').trim(),
    DressCode: String(card?.dressCode ?? '').trim(),
    ThankYouText: String(card?.thankYouText ?? '').trim(),
  }
}

export function weddingSideLinkedKey(
  side: WeddingSideInviteSide,
  field: WeddingSideLinkedField,
): keyof WeddingSideInviteSettings {
  const prefix = side === 'groom' ? 'groomInvite' : 'brideInvite'
  return `${prefix}${field}`
}

export function weddingSideHasLinkedOverride(
  settings: WeddingSideInviteSettings,
  side: WeddingSideInviteSide,
): boolean {
  return WEDDING_SIDE_LINKED_FIELDS.some((field) => settings[weddingSideLinkedKey(side, field)].trim())
}

export function clearWeddingSideLinkedOverrides(
  settings: WeddingSideInviteSettings,
  side: WeddingSideInviteSide,
): WeddingSideInviteSettings {
  const next = { ...settings }
  for (const field of WEDDING_SIDE_LINKED_FIELDS) {
    next[weddingSideLinkedKey(side, field)] = ''
  }
  return next
}

export function pickSideInviteSettings(
  settings: WeddingSideInviteSettings,
  side: WeddingSideInviteSide,
): Pick<
  WeddingSideInviteSettings,
  | 'groomInviteAddress'
  | 'groomInviteDefaultPersonalMessage'
  | 'brideInviteAddress'
  | 'brideInviteDefaultPersonalMessage'
> & {
  defaultPersonalMessage: string
} {
  if (side === 'groom') {
    return {
      groomInviteAddress: settings.groomInviteAddress,
      groomInviteDefaultPersonalMessage: settings.groomInviteDefaultPersonalMessage,
      brideInviteAddress: settings.brideInviteAddress,
      brideInviteDefaultPersonalMessage: settings.brideInviteDefaultPersonalMessage,
      defaultPersonalMessage: settings.groomInviteDefaultPersonalMessage,
    }
  }
  return {
    groomInviteAddress: settings.groomInviteAddress,
    groomInviteDefaultPersonalMessage: settings.groomInviteDefaultPersonalMessage,
    brideInviteAddress: settings.brideInviteAddress,
    brideInviteDefaultPersonalMessage: settings.brideInviteDefaultPersonalMessage,
    defaultPersonalMessage: settings.brideInviteDefaultPersonalMessage,
  }
}

export const SIDE_INVITE_LINKED_FIELDS = [
  'WeddingDate',
  'ReceptionTime',
  'PartyStartTime',
  'Address',
  'MapUrl',
  'Text',
  'EventTimeline',
  'DressCode',
  'ThankYouText',
] as const

export type SideInviteLinkedField = (typeof SIDE_INVITE_LINKED_FIELDS)[number]

type SharedLetterSource = Pick<
  WeddingCard,
  | 'weddingDate'
  | 'weddingTime'
  | 'partyStartTime'
  | 'venue'
  | 'mapUrl'
  | 'invitationText'
  | 'eventTimeline'
  | 'dressCode'
  | 'thankYouText'
  | 'groomHometown'
  | 'brideHometown'
>

/** Ô gửi riêng để trống thì dùng đúng nội dung đã điền ở thiệp chung. */
export function sharedLetterFallbackForSide(
  card: SharedLetterSource | null | undefined,
  side: WeddingSideInviteSide,
  field: SideInviteLinkedField,
): string {
  if (!card) return ''
  switch (field) {
    case 'WeddingDate':
      return resolveWeddingDateIso(card.weddingDate) ?? ''
    case 'ReceptionTime':
      return parseWeddingTimeClockAndWeekday(card.weddingTime).time
    case 'PartyStartTime':
      return parseWeddingTimeClockAndWeekday(card.partyStartTime).time
    case 'Address':
      return (side === 'groom' ? card.groomHometown : card.brideHometown).trim() || card.venue.trim()
    case 'MapUrl':
      return card.mapUrl.trim()
    case 'Text':
      return card.invitationText.trim()
    case 'EventTimeline':
      return card.eventTimeline.trim()
    case 'DressCode':
      return card.dressCode.trim()
    case 'ThankYouText':
      return card.thankYouText.trim()
    default:
      return ''
  }
}

/** Trùng thiệp chung thì giữ ô riêng trống để hai bên vẫn theo thư chung. */
export function linkSideInviteValue(next: string, fallback: string): string {
  if (next.trim() === fallback.trim()) return ''
  return next
}

function firstFilled(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const text = value?.trim() ?? ''
    if (text) return text
  }
  return ''
}

/** Copy party facts from an older shared letter into each house once, then stop. */
export function ownSidePartyFields(card: WeddingCard): WeddingCard {
  if (parseWeddingSectionConfig(card.sectionConfig).sidePartyOwned) return card
  const date = resolveWeddingDateIso(card.weddingDate) ?? ''
  const reception = parseWeddingTimeClockAndWeekday(card.weddingTime).time
  const party = parseWeddingTimeClockAndWeekday(card.partyStartTime).time
  const groomDate = firstFilled(card.groomInviteWeddingDate, date)
  const brideDate = firstFilled(card.brideInviteWeddingDate, date)
  return {
    ...card,
    weddingDate: groomDate || brideDate || card.weddingDate,
    groomInviteWeddingDate: groomDate || null,
    brideInviteWeddingDate: brideDate || null,
    groomInviteReceptionTime: firstFilled(card.groomInviteReceptionTime, reception),
    brideInviteReceptionTime: firstFilled(card.brideInviteReceptionTime, reception),
    groomInvitePartyStartTime: firstFilled(card.groomInvitePartyStartTime, party),
    brideInvitePartyStartTime: firstFilled(card.brideInvitePartyStartTime, party),
    groomInviteAddress: firstFilled(card.groomInviteAddress, card.groomHometown, card.venue),
    brideInviteAddress: firstFilled(card.brideInviteAddress, card.brideHometown, card.venue),
    groomInviteMapUrl: firstFilled(card.groomInviteMapUrl, card.mapUrl),
    brideInviteMapUrl: firstFilled(card.brideInviteMapUrl, card.mapUrl),
    groomInviteEventTimeline: firstFilled(card.groomInviteEventTimeline, card.eventTimeline),
    brideInviteEventTimeline: firstFilled(card.brideInviteEventTimeline, card.eventTimeline),
    sectionConfig: mergeWeddingSectionConfig(card.sectionConfig, { sidePartyOwned: true }),
  }
}

export function patchSideInviteSettings(
  settings: WeddingSideInviteSettings,
  side: WeddingSideInviteSide,
  patch: Partial<WeddingSideInviteSettings>,
): WeddingSideInviteSettings {
  const prefix = side === 'groom' ? 'groomInvite' : 'brideInvite'
  const next = { ...settings }
  for (const [key, value] of Object.entries(patch)) {
    if (key.startsWith(prefix) && value !== undefined) {
      ;(next as Record<string, string>)[key] = value as string
    }
  }
  return next
}
