import type { WeddingGuestInviteVenue } from '@/lib/wedding/wedding-guest-invite-venue'

export function normalizeGuestNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function buildWeddingPersonalInviteUrl(
  publishUrl: string,
  input: { guestName: string; inviteVenue?: WeddingGuestInviteVenue },
): string {
  const trimmed = input.guestName.trim()
  if (!trimmed) return publishUrl
  try {
    const url = new URL(publishUrl)
    url.searchParams.set('guest', trimmed)
    if (input.inviteVenue) url.searchParams.set('venue', input.inviteVenue)
    return url.toString()
  } catch {
    const params = new URLSearchParams()
    params.set('guest', trimmed)
    if (input.inviteVenue) params.set('venue', input.inviteVenue)
    const join = publishUrl.includes('?') ? '&' : '?'
    return `${publishUrl}${join}${params.toString()}`
  }
}

/** Link mở lại thiệp theo email khách đăng ký nhắc lịch. */
export function buildWeddingReminderInviteUrl(
  publishUrl: string,
  input: { guestEmail: string; guestName?: string; inviteVenue?: WeddingGuestInviteVenue },
): string {
  const email = input.guestEmail.trim().toLowerCase()
  if (!email) return publishUrl
  try {
    const url = new URL(publishUrl)
    url.searchParams.set('email', email)
    const guestName = input.guestName?.trim()
    if (guestName) url.searchParams.set('guest', guestName)
    if (input.inviteVenue) url.searchParams.set('venue', input.inviteVenue)
    return url.toString()
  } catch {
    const params = new URLSearchParams()
    params.set('email', email)
    const guestName = input.guestName?.trim()
    if (guestName) params.set('guest', guestName)
    if (input.inviteVenue) params.set('venue', input.inviteVenue)
    const join = publishUrl.includes('?') ? '&' : '?'
    return `${publishUrl}${join}${params.toString()}`
  }
}
