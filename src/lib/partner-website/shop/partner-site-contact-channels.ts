/** S0.7 — public storefront contact channels (deep links, not webhook tokens). */

export type PartnerSiteContactChannels = {
  phone: string | null
  zaloUrl: string | null
  messengerUrl: string | null
  instagramUrl: string | null
}

export function normalizeContactPhone(raw: unknown): string | null {
  const s = String(raw ?? '')
    .trim()
    .replace(/[^\d+]/g, '')
    .slice(0, 32)
  return s.length >= 6 ? s : null
}

export function normalizeContactHttpUrl(raw: unknown, max = 500): string | null {
  const s = String(raw ?? '')
    .trim()
    .slice(0, max)
  if (!s) return null
  if (/^https?:\/\//i.test(s)) return s
  if (/^(zalo\.me|m\.me|www\.|instagram\.com)/i.test(s)) return `https://${s}`
  return null
}

export function normalizePartnerSiteContactChannels(input: {
  contact_phone?: unknown
  contact_zalo_url?: unknown
  contact_messenger_url?: unknown
  contact_instagram_url?: unknown
}): PartnerSiteContactChannels {
  return {
    phone: normalizeContactPhone(input.contact_phone),
    zaloUrl: normalizeContactHttpUrl(input.contact_zalo_url),
    messengerUrl: normalizeContactHttpUrl(input.contact_messenger_url),
    instagramUrl: normalizeContactHttpUrl(input.contact_instagram_url),
  }
}

export function partnerSiteContactChannelsHasAny(c: PartnerSiteContactChannels | null | undefined): boolean {
  if (!c) return false
  return Boolean(c.phone || c.zaloUrl || c.messengerUrl || c.instagramUrl)
}

export function partnerSiteTelHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}
