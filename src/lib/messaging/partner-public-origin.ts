import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { fetchActivePartnerCustomDomainOriginPg } from '@/lib/db/messaging-partner-custom-domains-pg'
import { isPgConfigured } from '@/lib/db/pool'

export { buildPartnerChatPublicUrl, buildPartnerSitePublicUrl } from '@/lib/messaging/partner-public-url'

/** Origin công khai cho shop: tên miền riêng đã SSL nếu có, không thì domain NanoAI. */
export async function resolvePartnerPublicOrigin(partnerId: string, req?: Request): Promise<string> {
  if (isPgConfigured()) {
    const custom = await fetchActivePartnerCustomDomainOriginPg(partnerId)
    if (custom) return custom.replace(/\/$/, '')
  }
  return getPublicAppUrlForServer(req).replace(/\/$/, '')
}
