import { getOriginFromRequest, getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { isGoogleOAuthEnabled } from '@/lib/auth/google-oauth-config'
import { fetchPartnerShopSiteCustomDomainOriginPg } from '@/lib/db/messaging-partner-custom-domains-pg'
import { fetchPartnerExternalShopSsoPg } from '@/lib/db/messaging-partners-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { isPlatformAppHostname } from '@/lib/messaging/partner-custom-domain-platform-host'
import { hostnameFromOrigin, normalizePartnerShopOrigin } from '@/lib/partner-website/shop/partner-site-shop-sso'

export type ResolvedPartnerShopSso = {
  shopOrigin: string | null
  loginPath: string
  customerTokenPath: string
  /** Trang /site/ đang chạy trên domain shop (custom domain hoặc cùng host với shopOrigin). */
  customerTokenOnShopDomain: boolean
  /** Có thể redirect Google qua web shop riêng (188.com.vn…). */
  googleSsoAvailable: boolean
  /** NanoAI Google OAuth — nút Google trên /site/{slug} ngay cả khi chưa gắn domain shop. */
  platformGoogleAuthEnabled: boolean
  /** Origin NanoAI dùng cho bridge `/auth/shop-google` (không phải domain khách). */
  platformAuthOrigin: string
}

function defaultCustomerTokenPath(): string {
  return (
    process.env.PARTNER_SITE_CUSTOMER_TOKEN_PATH?.trim() ||
    process.env.NEXT_PUBLIC_PARTNER_SITE_CUSTOMER_TOKEN_PATH?.trim() ||
    '/api/v1/nanoai/customer-token'
  )
}

/** Origin NanoAI cho OAuth bridge — không bao giờ trả về hostname domain khách. */
function resolvePlatformAuthOrigin(req?: Request): string {
  const configured =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    ''
  if (configured) return configured.replace(/\/$/, '')
  if (req) {
    const fromReq = getOriginFromRequest(req)
    if (fromReq) {
      try {
        if (isPlatformAppHostname(new URL(fromReq).hostname)) return fromReq.replace(/\/$/, '')
      } catch {
        /* ignore */
      }
    }
  }
  return getPublicAppUrlForServer().replace(/\/$/, '')
}

/** Origin shop SSO — chỉ từ cấu hình quản trị (tên miền riêng + tuỳ chọn website đăng nhập). */
export async function resolvePartnerShopSso(partnerId: string, req?: Request): Promise<ResolvedPartnerShopSso> {
  const platformAuthOrigin = resolvePlatformAuthOrigin(req)
  const platformHost = hostnameFromOrigin(platformAuthOrigin) ?? ''
  const loginPathDefault = '/dang-nhap'
  const customerTokenPath = defaultCustomerTokenPath()

  let shopOrigin: string | null = null
  let loginPath = loginPathDefault

  if (isPgConfigured()) {
    const ssoRow = await fetchPartnerExternalShopSsoPg(partnerId)
    if (ssoRow?.external_shop_login_path?.trim()) {
      loginPath = ssoRow.external_shop_login_path.trim().startsWith('/')
        ? ssoRow.external_shop_login_path.trim()
        : `/${ssoRow.external_shop_login_path.trim()}`
    }

    if (ssoRow?.external_shop_origin?.trim()) {
      shopOrigin = normalizePartnerShopOrigin(ssoRow.external_shop_origin)
    }

    if (!shopOrigin) {
      shopOrigin = await fetchPartnerShopSiteCustomDomainOriginPg(partnerId)
    }
  }

  const shopHost = hostnameFromOrigin(shopOrigin)
  const customerTokenOnShopDomain = Boolean(shopHost && platformHost && shopHost !== platformHost)
  const googleSsoAvailable = Boolean(shopOrigin)
  const platformGoogleAuthEnabled = isGoogleOAuthEnabled()

  return {
    shopOrigin,
    loginPath,
    customerTokenPath,
    customerTokenOnShopDomain,
    googleSsoAvailable,
    platformGoogleAuthEnabled,
    platformAuthOrigin,
  }
}
