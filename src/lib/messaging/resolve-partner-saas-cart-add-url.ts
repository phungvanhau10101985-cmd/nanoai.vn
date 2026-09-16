import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { fetchPartnerWebsitePublishMetaFromPg } from '@/lib/db/messaging-partner-websites-pg'
import { buildPartnerShopCartAddUrlTemplate } from '@/lib/messaging/guest-purchase-flow'
import { partnerWebsitePublicPath } from '@/lib/partner-website/partner-website-slug'
import { resolvePartnerWebsitePublicUrl } from '@/lib/partner-website/resolve-partner-website-public-url'

/**
 * URL mẫu giỏ web cho shop SaaS cùng hệ thống.
 * Có website (đã đăng hoặc bản nháp `/site/{slug}`) thì tự liên kết — không API key, không dán URL.
 * Web khách ngoài hệ thống vẫn dùng `guest_external_cart_url_template` đã lưu.
 */
export async function resolvePartnerSaasCartAddUrlTemplate(partnerId: string): Promise<string | null> {
  const pid = partnerId.trim()
  if (!pid) return null
  const meta = await fetchPartnerWebsitePublishMetaFromPg(pid)
  if (!meta?.siteSlug) return null

  if (meta.isPublished) {
    const publicUrl = await resolvePartnerWebsitePublicUrl({
      partnerId: pid,
      siteSlug: meta.siteSlug,
      isPublished: true,
    })
    if (publicUrl) return buildPartnerShopCartAddUrlTemplate(publicUrl)
  }

  const base = getPublicAppUrlForServer().replace(/\/$/, '')
  return buildPartnerShopCartAddUrlTemplate(`${base}${partnerWebsitePublicPath(meta.siteSlug)}`)
}

export async function resolvePartnerSaasCartAddPreview(partnerId: string): Promise<{
  linked: boolean
  publicUrl: string | null
  autoTemplate: string | null
}> {
  const autoTemplate = await resolvePartnerSaasCartAddUrlTemplate(partnerId)
  if (!autoTemplate) {
    return { linked: false, publicUrl: null, autoTemplate: null }
  }
  const publicUrl = autoTemplate.replace(/\/cart\/add\/\{sku\}(?:\?from=nanoai)?$/i, '') || null
  return { linked: true, publicUrl, autoTemplate }
}
