import type { WebLocale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries'

export type WeddingGuestInviteVenue = '' | 'groom_home' | 'bride_home'

export type GuestInviteVenueTx = Pick<
  Dictionary['weddingCardPublic'],
  'guestInviteVenueGroom' | 'guestInviteVenueBride'
>

export function normalizeGuestInviteVenue(raw: unknown): WeddingGuestInviteVenue {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (v === 'groom_home' || v === 'groom' || v === 'groom-home' || v === 'nha-trai' || v === 'nha_trai') {
    return 'groom_home'
  }
  if (v === 'bride_home' || v === 'bride' || v === 'bride-home' || v === 'nha-gai' || v === 'nha_gai') {
    return 'bride_home'
  }
  return ''
}

export function guestInviteVenueLabel(
  venue: WeddingGuestInviteVenue,
  tx: GuestInviteVenueTx,
): string {
  if (venue === 'groom_home') return tx.guestInviteVenueGroom
  if (venue === 'bride_home') return tx.guestInviteVenueBride
  return ''
}

export function guestInviteVenueOptions(tx: GuestInviteVenueTx & { guestInviteVenueNone: string }) {
  return [
    { value: '' as const, label: tx.guestInviteVenueNone },
    { value: 'groom_home' as const, label: tx.guestInviteVenueGroom },
    { value: 'bride_home' as const, label: tx.guestInviteVenueBride },
  ]
}
