import { normalizeGuestNameKey } from '@/lib/wedding/wedding-guest-invite-link'
import type { WeddingGuestInviteVenue } from '@/lib/wedding/wedding-guest-invite-venue'

export type WeddingSideWishSide = 'groom' | 'bride' | 'other'

export type WeddingSideWish = {
  id: string
  guestName: string
  message: string
  side: WeddingSideWishSide
}

export type SideWishGuest = {
  id: string
  guestHonorific: string
  guestName: string
  inviteVenue: WeddingGuestInviteVenue
  wishMessage: string
}

export type SideWishMessage = {
  id: string
  guestName: string
  message: string
}

export type WeddingSideWishGroups = {
  groom: WeddingSideWish[]
  bride: WeddingSideWish[]
  other: WeddingSideWish[]
}

export function guestWishDisplayName(honorific: string, name: string): string {
  const title = honorific.trim()
  const guest = name.trim()
  return (title ? `${title} ${guest}` : guest).replace(/\s+/g, ' ').trim()
}

function pushWishIndex(index: Map<string, SideWishMessage[]>, key: string, wish: SideWishMessage) {
  if (!key) return
  const list = index.get(key)
  if (list) list.push(wish)
  else index.set(key, [wish])
}

/** Lời chúc khách mời: nhà trai gắn nhà trai, nhà gái gắn nhà gái. */
export function mergePublishedGuestWishesBySide(
  guests: SideWishGuest[],
  wishes: SideWishMessage[],
): WeddingSideWishGroups {
  const groom: WeddingSideWish[] = []
  const bride: WeddingSideWish[] = []
  const usedWishIds = new Set<string>()
  const consumedNameKeys = new Set<string>()
  const wishesByKey = new Map<string, SideWishMessage[]>()

  for (const wish of wishes) {
    const message = wish.message.trim()
    if (!message) continue
    pushWishIndex(wishesByKey, normalizeGuestNameKey(wish.guestName), wish)
  }

  for (const guest of guests) {
    if (guest.inviteVenue !== 'groom_home' && guest.inviteVenue !== 'bride_home') continue
    const displayName = guestWishDisplayName(guest.guestHonorific, guest.guestName)
    if (!displayName) continue
    const keys = [normalizeGuestNameKey(displayName), normalizeGuestNameKey(guest.guestName)].filter(Boolean)
    let message = guest.wishMessage.trim()
    if (!message) {
      for (const key of keys) {
        const hit = wishesByKey.get(key)?.find((wish) => wish.message.trim())
        if (!hit) continue
        message = hit.message.trim()
        usedWishIds.add(hit.id)
        break
      }
    }
    if (!message) continue
    for (const key of keys) {
      consumedNameKeys.add(key)
      for (const hit of wishesByKey.get(key) ?? []) {
        if (hit.message.trim() === message) usedWishIds.add(hit.id)
      }
    }
    const item: WeddingSideWish = {
      id: guest.id,
      guestName: displayName,
      message,
      side: guest.inviteVenue === 'groom_home' ? 'groom' : 'bride',
    }
    if (item.side === 'groom') groom.push(item)
    else bride.push(item)
  }

  const other: WeddingSideWish[] = []
  for (const wish of wishes) {
    if (usedWishIds.has(wish.id)) continue
    const key = normalizeGuestNameKey(wish.guestName)
    if (key && consumedNameKeys.has(key)) continue
    const message = wish.message.trim()
    if (!message) continue
    other.push({
      id: wish.id,
      guestName: wish.guestName.trim(),
      message,
      side: 'other',
    })
  }

  return { groom, bride, other }
}
