import {
  resolveActiveMessagingPartnerBySlug,
  type ActiveMessagingPartner,
} from '@/lib/messaging/resolve-active-messaging-partner'

export type HospitalityPartner = ActiveMessagingPartner

/**
 * Resolve a hospitality (hotel) partner by slug.
 *
 * Returns `null` when the slug does not match an active partner or the partner
 * is not a hotel workspace. Acts as the sole boundary between hospitality code
 * and the shared `messaging_partners` plumbing so fashion-side changes cannot
 * silently break hotel slug resolution.
 */
export async function resolveHospitalityPartnerBySlug(
  slug: string
): Promise<HospitalityPartner | null> {
  const active = await resolveActiveMessagingPartnerBySlug(slug)
  if (!active) return null
  if (active.industry_key !== 'hotel') return null
  return active
}
