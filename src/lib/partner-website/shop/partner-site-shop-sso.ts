/** Path on partner shop web (e.g. 188.com.vn) — same-origin when site uses custom domain. */
export const PARTNER_SITE_CUSTOMER_TOKEN_PATH =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_PARTNER_SITE_CUSTOMER_TOKEN_PATH?.trim()) ||
  '/api/v1/nanoai/customer-token'

export type PartnerSiteShopSsoConfig = {
  shopOrigin: string | null
  loginPath: string
  customerTokenPath: string
  /** true khi shopOrigin là domain shop riêng (188.com.vn), không phải domain NanoAI. */
  customerTokenOnShopDomain: boolean
  /** Hiển thị nút Google — chỉ khi partner có web shop riêng (tự suy hoặc cấu hình workspace). */
  googleSsoAvailable: boolean
}

export function normalizePartnerShopOrigin(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  try {
    const url = trimmed.startsWith('http') ? new URL(trimmed) : new URL(`https://${trimmed}`)
    return `${url.protocol}//${url.host}`.replace(/\/$/, '')
  } catch {
    return null
  }
}

export function hostnameFromOrigin(origin: string | null | undefined): string | null {
  if (!origin) return null
  try {
    return new URL(origin).hostname.toLowerCase()
  } catch {
    return null
  }
}

/** Chỉ gọi GET customer-token khi trang đang chạy cùng hostname với shop (vd. 188.com.vn hoặc custom domain). */
export function isPartnerShopTokenSameOrigin(shopOrigin: string | null | undefined): boolean {
  if (typeof window === 'undefined') return false
  const shopHost = hostnameFromOrigin(shopOrigin)
  if (!shopHost) return false
  return window.location.hostname.toLowerCase() === shopHost
}

export function buildPartnerShopGoogleLoginUrl(input: {
  shopOrigin: string
  loginPath: string
  returnUrl: string
}): string {
  const base = normalizePartnerShopOrigin(input.shopOrigin)
  if (!base) return input.returnUrl
  const path = input.loginPath.trim().startsWith('/') ? input.loginPath.trim() : `/${input.loginPath.trim()}`
  const url = new URL(path, base)
  url.searchParams.set('next', input.returnUrl)
  return url.toString()
}

export async function fetchPartnerSiteShopSsoConfig(siteSlug: string): Promise<PartnerSiteShopSsoConfig | null> {
  const res = await fetch(`/api/site/${encodeURIComponent(siteSlug)}/shop-sso`, {
    credentials: 'same-origin',
    cache: 'no-store',
  })
  if (!res.ok) return null
  const json = (await res.json().catch(() => ({}))) as Partial<PartnerSiteShopSsoConfig>
  return {
    shopOrigin: normalizePartnerShopOrigin(json.shopOrigin ?? null),
    loginPath: json.loginPath?.trim() || '/dang-nhap',
    customerTokenPath: json.customerTokenPath?.trim() || PARTNER_SITE_CUSTOMER_TOKEN_PATH,
    customerTokenOnShopDomain: Boolean(json.customerTokenOnShopDomain),
    googleSsoAvailable: Boolean(json.googleSsoAvailable),
  }
}
