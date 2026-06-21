import type { WeddingCard } from '@/lib/db/wedding-cards-pg'
import { resolveWeddingDisplayTime } from '@/lib/wedding/wedding-calendar-utils'
import type { WeddingGuestInviteVenue } from '@/lib/wedding/wedding-guest-invite-venue'

export type GuestInviteSide = 'groom' | 'bride'

type GuestInviteCardFields = Pick<
  WeddingCard,
  | 'weddingDate'
  | 'venue'
  | 'mapUrl'
  | 'weddingTime'
  | 'partyStartTime'
  | 'invitationText'
  | 'invitationTextEn'
  | 'eventTimeline'
  | 'dressCode'
  | 'thankYouText'
  | 'groomName'
  | 'brideName'
  | 'groomParents'
  | 'brideParents'
  | 'groomHometown'
  | 'brideHometown'
  | 'groomInviteAddress'
  | 'groomInviteMapUrl'
  | 'groomInviteReceptionTime'
  | 'groomInvitePartyStartTime'
  | 'groomInviteWeddingDate'
  | 'groomInviteText'
  | 'groomInviteTextEn'
  | 'groomInviteEventTimeline'
  | 'groomInviteDressCode'
  | 'groomInviteContact'
  | 'groomInviteCoverImageUrl'
  | 'groomInviteDefaultPersonalMessage'
  | 'groomInviteThankYouText'
  | 'brideInviteAddress'
  | 'brideInviteMapUrl'
  | 'brideInviteReceptionTime'
  | 'brideInvitePartyStartTime'
  | 'brideInviteWeddingDate'
  | 'brideInviteText'
  | 'brideInviteTextEn'
  | 'brideInviteEventTimeline'
  | 'brideInviteDressCode'
  | 'brideInviteContact'
  | 'brideInviteCoverImageUrl'
  | 'brideInviteDefaultPersonalMessage'
  | 'brideInviteThankYouText'
>

export type GuestInviteContext = {
  side: GuestInviteSide | null
  address: string
  mapUrl: string
  receptionTime: string
  partyStartTime: string
  displayTime: string
  weddingDate: string | null
  invitationText: string
  invitationTextEn: string
  eventTimeline: string
  dressCode: string
  contact: string
  coverImageUrl: string
  defaultPersonalInvite: string
  thankYouText: string
  parents: string
  hometown: string
}

function buildSideContext(
  card: GuestInviteCardFields,
  side: GuestInviteSide,
): GuestInviteContext {
  const isGroom = side === 'groom'
  const receptionTime = (
    isGroom ? card.groomInviteReceptionTime : card.brideInviteReceptionTime
  ).trim() || card.weddingTime.trim()
  const partyStartTime = (
    isGroom ? card.groomInvitePartyStartTime : card.brideInvitePartyStartTime
  ).trim() || card.partyStartTime.trim()

  return {
    side,
    address:
      (isGroom ? card.groomInviteAddress : card.brideInviteAddress).trim() ||
      (isGroom ? card.groomHometown : card.brideHometown).trim() ||
      card.venue.trim(),
    mapUrl:
      (isGroom ? card.groomInviteMapUrl : card.brideInviteMapUrl).trim() || card.mapUrl.trim(),
    receptionTime,
    partyStartTime,
    displayTime: resolveWeddingDisplayTime(receptionTime, partyStartTime) || receptionTime,
    weddingDate: (isGroom ? card.groomInviteWeddingDate : card.brideInviteWeddingDate) ?? card.weddingDate,
    invitationText:
      (isGroom ? card.groomInviteText : card.brideInviteText).trim() || card.invitationText.trim(),
    invitationTextEn:
      (isGroom ? card.groomInviteTextEn : card.brideInviteTextEn).trim() || card.invitationTextEn.trim(),
    eventTimeline:
      (isGroom ? card.groomInviteEventTimeline : card.brideInviteEventTimeline).trim() ||
      card.eventTimeline.trim(),
    dressCode:
      (isGroom ? card.groomInviteDressCode : card.brideInviteDressCode).trim() || card.dressCode.trim(),
    contact: (isGroom ? card.groomInviteContact : card.brideInviteContact).trim(),
    coverImageUrl: (isGroom ? card.groomInviteCoverImageUrl : card.brideInviteCoverImageUrl).trim(),
    defaultPersonalInvite: (
      isGroom ? card.groomInviteDefaultPersonalMessage : card.brideInviteDefaultPersonalMessage
    ).trim(),
    thankYouText:
      (isGroom ? card.groomInviteThankYouText : card.brideInviteThankYouText).trim() ||
      card.thankYouText.trim(),
    parents:
      (isGroom ? card.groomParents : card.brideParents).trim() ||
      (isGroom ? card.groomName : card.brideName).trim(),
    hometown: (isGroom ? card.groomHometown : card.brideHometown).trim(),
  }
}

export function resolveGuestInviteLocation(
  card: GuestInviteCardFields,
  venue: WeddingGuestInviteVenue,
): GuestInviteContext {
  if (venue === 'groom_home') return buildSideContext(card, 'groom')
  if (venue === 'bride_home') return buildSideContext(card, 'bride')
  return {
    side: null,
    address: card.venue.trim(),
    mapUrl: card.mapUrl.trim(),
    receptionTime: card.weddingTime.trim(),
    partyStartTime: card.partyStartTime.trim(),
    displayTime: resolveWeddingDisplayTime(card.weddingTime, card.partyStartTime) || card.weddingTime.trim(),
    weddingDate: card.weddingDate,
    invitationText: card.invitationText.trim(),
    invitationTextEn: card.invitationTextEn.trim(),
    eventTimeline: card.eventTimeline.trim(),
    dressCode: card.dressCode.trim(),
    contact: '',
    coverImageUrl: '',
    defaultPersonalInvite: '',
    thankYouText: card.thankYouText.trim(),
    parents: '',
    hometown: '',
  }
}

export function isSideSpecificGuestInvite(venue: WeddingGuestInviteVenue): venue is 'groom_home' | 'bride_home' {
  return venue === 'groom_home' || venue === 'bride_home'
}
