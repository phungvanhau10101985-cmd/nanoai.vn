import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { fetchPartnerShopSiteCustomDomainOriginPg } from '@/lib/db/messaging-partner-custom-domains-pg'
import { fetchPartnerExternalShopSsoPg } from '@/lib/db/messaging-partners-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { hostnameFromOrigin, normalizePartnerShopOrigin } from '@/lib/partner-website/shop/partner-site-shop-sso'

export type ResolvedPartnerShopSso = {
  shopOrigin: string | null
  loginPath: string
  customerTokenPath: string
  /** Trang /site/ đang chạy trên domain shop (custom domain hoặc cùng host với shopOrigin). */
  customerTokenOnShopDomain: boolean
  /** Có thể dùng nút Google (redirect shop hoặc customer-token same-origin). */
  googleSsoAvailable: boolean
}

function defaultCustomerTokenPath(): string {
  return (
    process.env.PARTNER_SITE_CUSTOMER_TOKEN_PATH?.trim() ||
    process.env.NEXT_PUBLIC_PARTNER_SITE_CUSTOMER_TOKEN_PATH?.trim() ||
    '/api/v1/nanoai/customer-token'
  )
}

/** Origin shop SSO — chỉ từ cấu hình quản trị (tên miền riêng + tuỳ chọn website đăng nhập). */
export async function resolvePartnerShopSso(partnerId: string, req?: Request): Promise<ResolvedPartnerShopSso> {
  const platformOrigin = getPublicAppUrlForServer(req).replace(/\/$/, '')
  const platformHost = hostnameFromOrigin(platformOrigin) ?? ''
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

  return {
    shopOrigin,
    loginPath,
    customerTokenPath,
    customerTokenOnShopDomain,
    googleSsoAvailable,
  }
}
