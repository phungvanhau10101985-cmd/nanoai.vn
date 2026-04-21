import { fetchMessagingPartnerByIdFromPg } from '@/lib/db/messaging-partners-pg'
import { requireMessagingPartnerOwner } from '@/lib/messaging/partner-inventory-route-auth'

/**
 * Verify caller owns the given hospitality (hotel) partner.
 *
 * Thin wrapper over {@link requireMessagingPartnerOwner} plus a required
 * `industry_key === 'hotel'` check. Hospitality routes should import this
 * helper rather than reaching into fashion messaging modules directly, so
 * owner-check semantics for hotel workspaces can evolve independently.
 */
export async function requireHospitalityPartnerOwner(partnerId: string): Promise<
  { ok: true; userId: string } | { ok: false; error: string; status: number }
> {
  const base = await requireMessagingPartnerOwner(partnerId)
  if (!base.ok) return base
  const gate = await fetchMessagingPartnerByIdFromPg(partnerId)
  if (!gate || gate.industry_key !== 'hotel') {
    return { ok: false, error: 'Hospitality partner not found.', status: 404 }
  }
  return base
}
