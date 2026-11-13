import { loadAdminIntegrationsValueJsonByKey } from '@/lib/db/admin-integrations-settings-pg'
import { getAuthUserEmailFromPg } from '@/lib/db/auth-user-email-pg'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { metaClientIpFromHeaders } from '@/lib/tracking/meta-client-ip'
import { normalizeMetaFbc, normalizeMetaFbp } from '@/lib/tracking/meta-click-ids'
import { sendMetaPurchaseConversionsApi } from '@/lib/tracking/meta-purchase-events'
import { loadPlatformMetaClientMatch } from '@/lib/tracking/platform-meta-client-match'
import {
  partnerSiteMetaCapiCustomerInfo,
  partnerSiteMetaMatchingParams,
} from '@/lib/partner-website/shop/partner-site-meta-advanced-matching'
import { loadPlatformMetaProfile } from '@/lib/tracking/platform-meta-profile'

const INTEGRATIONS_KEY = 'admin_integrations_config'

function cookieFromRequest(request: Request, name: string): string | null {
  const raw = request.headers.get('cookie') || ''
  for (const part of raw.split(';')) {
    const trimmed = part.trim()
    if (!trimmed.startsWith(`${name}=`)) continue
    const value = trimmed.slice(name.length + 1)
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }
  return null
}

function purchaseEventId(paymentId: string): string {
  const safe = paymentId.replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 70)
  return `Purchase_${safe || 'paid'}`
}

/** Purchase CAPI khi ngân hàng đã xác nhận tiền. event_id trùng pixel trên trang đang chờ. */
export async function sendPlatformPaidPurchaseCapi(input: {
  request: Request
  paymentId: string
  amountVnd: number
  userId: string
  contentId: string
  contentName: string
  eventPath: string
}): Promise<void> {
  const paymentId = input.paymentId.trim()
  const amountVnd = Math.round(Number(input.amountVnd) || 0)
  const contentId = input.contentId.trim()
  if (!paymentId || amountVnd <= 0 || !contentId) return
  const settingsRaw = await loadAdminIntegrationsValueJsonByKey(INTEGRATIONS_KEY)
  const settings =
    settingsRaw && typeof settingsRaw === 'object' && !Array.isArray(settingsRaw)
      ? (settingsRaw as { facebookPixelId?: string; facebookCapiAccessToken?: string })
      : {}
  const pixelId = String(settings.facebookPixelId ?? '').trim()
  const accessToken = String(settings.facebookCapiAccessToken ?? '').trim()
  if (!pixelId || !accessToken) return
  const origin = getPublicAppUrlForServer(input.request)
  const email = await getAuthUserEmailFromPg(input.userId).catch(() => null)
  const profile = await loadPlatformMetaProfile(input.userId)
  const stored = await loadPlatformMetaClientMatch(input.userId)
  const cookieFbc = normalizeMetaFbc(cookieFromRequest(input.request, '_fbc'))
  const cookieFbp = normalizeMetaFbp(cookieFromRequest(input.request, '_fbp'))
  const fromBrowser = Boolean(cookieFbc || cookieFbp)
  const matching = partnerSiteMetaMatchingParams({
    email,
    phone: profile.phone,
    fullName: profile.fullName,
    gender: profile.gender,
    dateOfBirth: profile.birthDate,
    externalId: input.userId,
  })
  const sent = await sendMetaPurchaseConversionsApi({
    pixelId,
    accessToken,
    eventId: purchaseEventId(paymentId),
    eventSourceUrl: `${origin}${input.eventPath}`,
    clientIp: stored?.clientIp || (fromBrowser ? metaClientIpFromHeaders(input.request.headers) : null),
    userAgent: stored?.userAgent || (fromBrowser ? input.request.headers.get('user-agent') : null),
    fbc: cookieFbc || stored?.fbc || null,
    fbp: cookieFbp || stored?.fbp || null,
    customerEmail: matching.em || email,
    customerPhone: matching.ph || profile.phone,
    externalId: matching.external_id || input.userId,
    customerInfo: partnerSiteMetaCapiCustomerInfo(matching),
    customData: {
      value: amountVnd,
      currency: 'VND',
      content_ids: [contentId],
      content_type: 'product',
      num_items: 1,
      contents: [{ id: contentId, quantity: 1, item_price: amountVnd }],
      order_id: paymentId.slice(0, 80),
    },
  })
  if (!sent.ok) console.warn('[platform-paid-purchase-capi]', sent.error)
}
