import type { WeddingCard } from '@/lib/db/wedding-cards-pg'
import { resolveWeddingDisplayTime } from '@/lib/wedding/wedding-calendar-utils'
import type { WeddingGuestInviteVenue } from '@/lib/wedding/wedding-guest-invite-venue'
import { parseWeddingSectionConfig } from '@/lib/wedding/wedding-section-config'

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
  | 'sectionConfig'
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
  const owned = parseWeddingSectionConfig(card.sectionConfig).sidePartyOwned === true
  const receptionTime = (isGroom ? card.groomInviteReceptionTime : card.brideInviteReceptionTime).trim()
  const partyStartTime = (isGroom ? card.groomInvitePartyStartTime : card.brideInvitePartyStartTime).trim()
  const sideAddress = (isGroom ? card.groomInviteAddress : card.brideInviteAddress).trim()
  const sideMap = (isGroom ? card.groomInviteMapUrl : card.brideInviteMapUrl).trim()
  const sideDate = (isGroom ? card.groomInviteWeddingDate : card.brideInviteWeddingDate) ?? ''
  const sideTimeline = (isGroom ? card.groomInviteEventTimeline : card.brideInviteEventTimeline).trim()

  return {
    side,
    address: owned
      ? sideAddress
      : sideAddress || (isGroom ? card.groomHometown : card.brideHometown).trim() || card.venue.trim(),
    mapUrl: owned ? sideMap : sideMap || card.mapUrl.trim(),
    receptionTime: owned ? receptionTime : receptionTime || card.weddingTime.trim(),
    partyStartTime: owned ? partyStartTime : partyStartTime || card.partyStartTime.trim(),
    displayTime: resolveWeddingDisplayTime(
      owned ? receptionTime : receptionTime || card.weddingTime.trim(),
      owned ? partyStartTime : partyStartTime || card.partyStartTime.trim(),
    ) || (owned ? receptionTime : receptionTime || card.weddingTime.trim()),
    weddingDate: owned ? sideDate || null : sideDate || card.weddingDate,
    invitationText: card.invitationText.trim(),
    invitationTextEn: card.invitationTextEn.trim(),
    eventTimeline: owned ? sideTimeline : sideTimeline || card.eventTimeline.trim(),
    dressCode: card.dressCode.trim(),
    contact: (isGroom ? card.groomInviteContact : card.brideInviteContact).trim(),
    coverImageUrl: (isGroom ? card.groomInviteCoverImageUrl : card.brideInviteCoverImageUrl).trim(),
    defaultPersonalInvite: (
      isGroom ? card.groomInviteDefaultPersonalMessage : card.brideInviteDefaultPersonalMessage
    ).trim(),
    thankYouText: card.thankYouText.trim(),
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
