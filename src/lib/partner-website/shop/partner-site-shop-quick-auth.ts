import {
  isPartnerShopTokenSameOrigin,
  PARTNER_SITE_CUSTOMER_TOKEN_PATH,
} from '@/lib/partner-website/shop/partner-site-shop-sso'

export { PARTNER_SITE_CUSTOMER_TOKEN_PATH } from '@/lib/partner-website/shop/partner-site-shop-sso'

export type PartnerSiteQuickAuthResult =
  | { ok: true; source: 'resume' | 'sync' | 'shop_token' | 'pc_token' }
  | { ok: false }

export async function authPartnerSiteFromShopToken(input: {
  partnerSlug: string
  token: string
  authHeaders: () => Record<string, string>
  captureFromResponse: (res: Response) => void
}): Promise<boolean> {
  const token = input.token.trim()
  if (!token) return false
  const authRes = await fetch(`/api/messaging/guest/${encodeURIComponent(input.partnerSlug)}/auth/partner-site`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...input.authHeaders() },
    body: JSON.stringify({ token }),
  })
  input.captureFromResponse(authRes)
  const authJson = (await authRes.json().catch(() => ({}))) as { ok?: boolean; accountId?: string }
  return Boolean(authRes.ok && authJson.ok && authJson.accountId)
}

export async function tryPartnerSiteQuickAuth(input: {
  partnerSlug: string
  siteSlug: string
  authHeaders: () => Record<string, string>
  captureFromResponse: (res: Response) => void
  /** Origin shop (188.com.vn) — chỉ fetch customer-token khi cùng hostname. */
  shopOrigin?: string | null
  customerTokenPath?: string
  customerTokenOnShopDomain?: boolean
}): Promise<PartnerSiteQuickAuthResult> {
  const { partnerSlug, siteSlug, authHeaders, captureFromResponse, shopOrigin = null } = input
  const customerTokenPath = input.customerTokenPath?.trim() || PARTNER_SITE_CUSTOMER_TOKEN_PATH
  const canUseShopToken =
    Boolean(input.customerTokenOnShopDomain) && isPartnerShopTokenSameOrigin(shopOrigin)

  async function resumeGuest(): Promise<boolean> {
    const res = await fetch(`/api/messaging/guest/${encodeURIComponent(partnerSlug)}/auth/resume`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({}),
    })
    captureFromResponse(res)
    const json = (await res.json().catch(() => ({}))) as { synced?: boolean; accountId?: string }
    return Boolean(res.ok && json.synced && json.accountId)
  }

  async function syncSiteSession(): Promise<boolean> {
    const res = await fetch(`/api/site/${encodeURIComponent(siteSlug)}/auth/sync-session`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: authHeaders(),
    })
    captureFromResponse(res)
    const json = (await res.json().catch(() => ({}))) as { synced?: boolean; accountId?: string }
    return Boolean(res.ok && json.synced && json.accountId)
  }

  async function authFromShopToken(): Promise<boolean> {
    if (!canUseShopToken) return false
    if (!customerTokenPath.startsWith('/')) return false
    const tokenRes = await fetch(customerTokenPath, { credentials: 'include' })
    if (!tokenRes.ok) return false
    const tokenJson = (await tokenRes.json().catch(() => ({}))) as { token?: string }
    const token = tokenJson.token?.trim()
    if (!token) return false
    return authPartnerSiteFromShopToken({
      partnerSlug,
      token,
      authHeaders,
      captureFromResponse,
    })
  }

  if (await resumeGuest()) return { ok: true, source: 'resume' }
  if (await syncSiteSession()) return { ok: true, source: 'sync' }
  if (await authFromShopToken()) return { ok: true, source: 'shop_token' }
  return { ok: false }
}
