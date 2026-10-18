import { loadAdminIntegrationsValueJsonByKey } from '@/lib/db/admin-integrations-settings-pg'
import { getAuthUserEmailFromPg } from '@/lib/db/auth-user-email-pg'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { hashMetaCapiEmail } from '@/lib/tracking/meta-capi-hash'
import { sendTikTokWebEvent } from '@/lib/tracking/tiktok-events-api'
import { WEDDING_COMMERCE_CONTENT_ID, WEDDING_COMMERCE_CONTENT_NAME, weddingPurchaseEventId } from '@/lib/wedding/wedding-commerce-events'

const INTEGRATIONS_KEY = 'admin_integrations_config'

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

/** CompletePayment qua Events API khi ngân hàng báo tiền gói thiệp. event_id trùng pixel. */
export async function sendWeddingGuestPackPurchaseTikTok(input: {
  request: Request
  paymentId: string
  amountVnd: number
  userId: string
}): Promise<void> {
  const paymentId = input.paymentId.trim()
  const amountVnd = Math.round(Number(input.amountVnd) || 0)
  if (!paymentId || amountVnd <= 0) return
  const settingsRaw = await loadAdminIntegrationsValueJsonByKey(INTEGRATIONS_KEY)
  const settings =
    settingsRaw && typeof settingsRaw === 'object' && !Array.isArray(settingsRaw)
      ? (settingsRaw as { tiktokPixelId?: string; tiktokEventsApiToken?: string })
      : {}
  const pixelId = String(settings.tiktokPixelId ?? '').trim()
  const accessToken = String(settings.tiktokEventsApiToken ?? '').trim()
  if (!pixelId || !accessToken) return
  const origin = getPublicAppUrlForServer(input.request)
  const email = await getAuthUserEmailFromPg(input.userId).catch(() => null)
  const sent = await sendTikTokWebEvent({
    pixelId,
    accessToken,
    event: 'CompletePayment',
    eventId: weddingPurchaseEventId(paymentId),
    eventTimeSec: Math.floor(Date.now() / 1000),
    eventSourceUrl: `${origin}/tao-thiep-moi-cuoi-ai/khach-moi`,
    contentId: WEDDING_COMMERCE_CONTENT_ID,
    contentName: WEDDING_COMMERCE_CONTENT_NAME,
    valueVnd: amountVnd,
    orderId: paymentId,
    clientIp: clientIpFromRequest(input.request),
    userAgent: input.request.headers.get('user-agent'),
    emailSha256: hashMetaCapiEmail(email),
  })
  if (!sent.ok) console.warn('[wedding-purchase-tiktok]', sent.error)
}
