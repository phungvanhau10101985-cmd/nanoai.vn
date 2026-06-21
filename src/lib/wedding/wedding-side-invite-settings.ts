import type { WeddingCard } from '@/lib/db/wedding-cards-pg'

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
