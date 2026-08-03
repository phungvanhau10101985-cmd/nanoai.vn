import {
  fetchPartnerCapabilitiesForPartnerFromPg,
  fetchMessagingPartnerBySlugFromPg,
} from '@/lib/db/messaging-partners-pg'
import {
  partnerCommerceCartEnabled,
  type PartnerCapabilities,
} from '@/lib/partner-website/partner-capabilities'
import { resolveActiveMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'

export type CommercePartnerResolveError = 'not_found' | 'commerce_cart_disabled' | 'commerce_disabled'

type CommercePartnerOk = {
  partnerId: string
  displayName: string
  capabilities: PartnerCapabilities
}

async function resolveCommercePartnerBase(slug: string): Promise<
  | CommercePartnerOk
  | { error: 'not_found' }
> {
  const active = await resolveActiveMessagingPartnerBySlug(slug)
  if (!active) return { error: 'not_found' }
  const caps = await fetchPartnerCapabilitiesForPartnerFromPg(active.id, active.industry_key)
  return {
    partnerId: active.id,
    displayName: active.display_name,
    capabilities: caps,
  }
}

export async function resolveCommerceCartPartnerBySlug(slug: string): Promise<
  | { partnerId: string }
  | { error: CommercePartnerResolveError }
> {
  const base = await resolveCommercePartnerBase(slug)
  if ('error' in base) return base
  if (!partnerCommerceCartEnabled(base.capabilities)) {
    return { error: 'commerce_cart_disabled' }
  }
  return { partnerId: base.partnerId }
}

export async function resolveCommerceOrderPartnerBySlug(slug: string): Promise<
  | { partnerId: string; displayName: string }
  | { error: CommercePartnerResolveError }
> {
  const base = await resolveCommercePartnerBase(slug)
  if ('error' in base) return base
  const { capabilities } = base
  if (!capabilities.commerce.cart && !capabilities.commerce.order_tracking) {
    return { error: 'commerce_disabled' }
  }
  return { partnerId: base.partnerId, displayName: base.displayName }
}

export function commercePartnerErrorResponse(error: CommercePartnerResolveError): {
  status: number
  message: string
} {
  if (error === 'commerce_cart_disabled' || error === 'commerce_disabled') {
    return {
      status: 409,
      message: 'Commerce cart/orders are disabled for this partner.',
    }
  }
  return { status: 404, message: 'Not found' }
}

/** Load partner row by slug when website is enabled (any industry). */
export async function resolvePartnerWebsitePartnerBySlug(slug: string) {
  const row = await fetchMessagingPartnerBySlugFromPg(slug)
  if (!row || !row.is_active || row.purge_at) return null
  const caps = await fetchPartnerCapabilitiesForPartnerFromPg(row.id, row.industry_key)
  if (!caps.website.enabled) return null
  return { ...row, capabilities: caps }
}
