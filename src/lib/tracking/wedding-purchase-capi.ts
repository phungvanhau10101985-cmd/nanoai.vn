import { loadAdminIntegrationsValueJsonByKey } from '@/lib/db/admin-integrations-settings-pg'
import { getAuthUserEmailFromPg } from '@/lib/db/auth-user-email-pg'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { normalizeMetaFbc, normalizeMetaFbp } from '@/lib/tracking/meta-click-ids'
import { sendMetaPurchaseConversionsApi } from '@/lib/tracking/meta-purchase-events'
import { weddingPackPaymentCustomData, weddingPurchaseEventId } from '@/lib/wedding/wedding-commerce-events'
import type { WeddingGuestPackId } from '@/lib/wedding/wedding-guest-pack'

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

function clientIpFromRequest(request: Request): string | null {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first && /^[\d.:a-fA-Fx]+$/.test(first)) return first
  }
  const xr = request.headers.get('x-real-ip')?.trim()
  if (xr && /^[\d.:a-fA-Fx]+$/.test(xr)) return xr
  return null
}

/**
 * Purchase CAPI khi ngân hàng báo tiền gói thiệp về.
 * event_id trùng pixel trên trang QR (`Purchase_<paymentId>`) để Meta đếm một lần.
 * value = số tiền của đơn gói.
 */
export async function sendWeddingGuestPackPurchaseCapi(input: {
  request: Request
  paymentId: string
  packId: WeddingGuestPackId
  amountVnd: number
  userId: string
}): Promise<void> {
  const paymentId = input.paymentId.trim()
  const amountVnd = Math.round(Number(input.amountVnd) || 0)
  if (!paymentId || amountVnd <= 0) return
  const settingsRaw = await loadAdminIntegrationsValueJsonByKey(INTEGRATIONS_KEY)
  const settings =
    settingsRaw && typeof settingsRaw === 'object' && !Array.isArray(settingsRaw)
      ? (settingsRaw as { facebookPixelId?: string; facebookCapiAccessToken?: string })
      : {}
  const pixelId = String(settings.facebookPixelId ?? '').trim()
  const accessToken = String(settings.facebookCapiAccessToken ?? '').trim()
  if (!pixelId || !accessToken) return
  const custom = weddingPackPaymentCustomData({
    packId: input.packId,
    amountVnd,
    paymentId,
  })
  const origin = getPublicAppUrlForServer(input.request)
  const email = await getAuthUserEmailFromPg(input.userId).catch(() => null)
  const sent = await sendMetaPurchaseConversionsApi({
    pixelId,
    accessToken,
    eventId: weddingPurchaseEventId(paymentId),
    eventSourceUrl: `${origin}/tao-thiep-moi-cuoi-ai/khach-moi`,
    clientIp: clientIpFromRequest(input.request),
    userAgent: input.request.headers.get('user-agent'),
    fbc: normalizeMetaFbc(cookieFromRequest(input.request, '_fbc')),
    fbp: normalizeMetaFbp(cookieFromRequest(input.request, '_fbp')),
    customerEmail: email,
    externalId: input.userId,
    customData: {
      value: custom.value,
      currency: custom.currency,
      content_ids: custom.content_ids,
      content_type: custom.content_type,
      num_items: custom.num_items,
      contents: custom.contents,
      order_id: custom.order_id || paymentId,
    },
  })
  if (!sent.ok) console.warn('[wedding-purchase-capi]', sent.error)
}
