import { fetchMessagingPartnerBySlugFromPg } from '@/lib/db/messaging-partners-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { isReservedMessagingGuestSlug } from '@/lib/messaging/reserved-guest-slugs'

export type ActiveMessagingPartner = {
  id: string
  display_name: string
  embed_key: string
}

/**
 * Partner guest (slug) còn active — chỉ Postgres.
 */
export async function resolveActiveMessagingPartnerBySlug(slug: string): Promise<ActiveMessagingPartner | null> {
  if (isReservedMessagingGuestSlug(slug)) return null
  if (!isPgConfigured()) {
    console.warn('[resolveActiveMessagingPartnerBySlug] DATABASE_URL not set')
    return null
  }
  const fromPg = await fetchMessagingPartnerBySlugFromPg(slug)
  if (!fromPg) return null
  if (!fromPg.is_active) return null
  return {
    id: fromPg.id,
    display_name: fromPg.display_name,
    embed_key: fromPg.embed_key,
  }
}
