import {
  listPartnerLoyaltyTiersFromPg,
  resolvePartnerCustomerLoyaltyStatusFromPg,
} from '@/lib/db/messaging-partner-loyalty-pg'
import { resolvePartnerStorefrontSaleIdentity } from '@/lib/partner-website/shop/partner-site-personalization'
import {
  buildPartnerSiteLoyaltyView,
  type PartnerSiteLoyaltyStatusView,
} from '@/lib/partner-website/shop/partner-site-loyalty'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** RSC first paint for membership — cookies only, never finalize auth. */
export async function loadSiteLoyaltyForRequest(
  partnerId: string
): Promise<PartnerSiteLoyaltyStatusView | null> {
  const identity = await resolvePartnerStorefrontSaleIdentity(partnerId)
  const guestAccountId =
    identity.accountKey &&
    identity.accountKey !== identity.linkedUserId &&
    UUID_RE.test(identity.accountKey)
      ? identity.accountKey
      : null
  const [status, tiers] = await Promise.all([
    resolvePartnerCustomerLoyaltyStatusFromPg({
      partnerId,
      identity: {
        emailNormalized: identity.emailNormalized,
        linkedUserId: identity.linkedUserId,
        guestAccountId,
      },
    }),
    listPartnerLoyaltyTiersFromPg(partnerId),
  ])
  if (!status) return null
  return buildPartnerSiteLoyaltyView({
    status,
    tiers: tiers ?? [],
  })
}
