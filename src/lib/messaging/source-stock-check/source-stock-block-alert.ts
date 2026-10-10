import { getAuthUserEmailFromPg } from '@/lib/db/auth-user-email-pg'
import { fetchPartnerPaymentSettingsFromPg } from '@/lib/db/messaging-partner-orders-pg'
import {
  fetchMessagingPartnerOwnerUserIdFromPg,
  listMessagingPartnerNotifyUserIdsFromPg,
} from '@/lib/db/messaging-partners-pg'
import { isSmtpConfigured, sendSmtpMail } from '@/lib/email/smtp'
import { deliverUserNotificationPg } from '@/lib/notifications/deliver-user-notification-pg'

const lastSent = new Map<string, number>()
const COOLDOWN_MS = 30 * 60 * 1000

function isMailbox(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value)
}

async function resolveOwnerEmail(partnerId: string): Promise<string | null> {
  const settings = await fetchPartnerPaymentSettingsFromPg(partnerId)
  const notify = String(settings?.notify_email || '').trim().toLowerCase()
  if (isMailbox(notify)) return notify
  const ownerId = await fetchMessagingPartnerOwnerUserIdFromPg(partnerId)
  if (!ownerId) return null
  const owner = (await getAuthUserEmailFromPg(ownerId))?.trim().toLowerCase() || ''
  return isMailbox(owner) ? owner : null
}

/**
 * Email + chuông quản trị shop khi cả 3 nền bị Cloudflare.
 * Một workspace chỉ gửi một lần mỗi 30 phút.
 */
export async function maybeNotifyPartnerAllPlatformsBlocked(input: {
  partnerId: string
  inventoryId?: string
  link?: string
  detail?: string
}): Promise<boolean> {
  const now = Date.now()
  const prev = lastSent.get(input.partnerId) || 0
  if (prev && now - prev < COOLDOWN_MS) return false
  lastSent.set(input.partnerId, now)
  void sendBlockedAlert(input).catch((e) => {
    console.warn('[source-stock block alert]', e instanceof Error ? e.message : e)
  })
  return true
}

async function sendBlockedAlert(input: {
  partnerId: string
  inventoryId?: string
  link?: string
  detail?: string
}): Promise<void> {
  const title = 'Kiểm tra tồn nguồn: cả 3 nền bị Cloudflare'
  const body = [
    'Vipomall, PandaMall và CSSBuy đều bị Cloudflare/CAPTCHA.',
    'Worker kiểm tra tồn nguồn của workspace này đã dừng, không chạy sản phẩm tiếp theo và không gắn cờ hết hàng.',
    'Bật lại trong Cài đặt shop → Kiểm tra nguồn hàng sau khi Cloudflare hết chặn.',
    input.link ? `Link: ${input.link}` : '',
    input.detail ? `Chi tiết: ${input.detail}` : '',
  ]
    .filter(Boolean)
    .join('\n')
  const pushUrl = `/dashboard/messaging/settings?section=inventory-source-stock&partner=${input.partnerId}`
  try {
    const userIds = await listMessagingPartnerNotifyUserIdsFromPg(input.partnerId)
    await Promise.all(
      userIds.map((user_id) =>
        deliverUserNotificationPg({
          user_id,
          type: 'messaging_partner_source_stock_blocked',
          title,
          body,
          meta: {
            push_url: pushUrl,
            partner_id: input.partnerId,
            inventory_id: input.inventoryId || null,
            skip_platform_push: true,
            skip_email: true,
          },
        })
      )
    )
  } catch (e) {
    console.warn('[source-stock block alert] in-app', e instanceof Error ? e.message : e)
  }
  if (!isSmtpConfigured()) {
    console.warn('[source-stock block alert] SMTP chưa cấu hình, không gửi email')
    return
  }
  const to = await resolveOwnerEmail(input.partnerId)
  if (!to) {
    console.warn('[source-stock block alert] không có email quản trị shop')
    return
  }
  await sendSmtpMail({
    to,
    subject: `[NanoAI] ${title}`,
    text: body,
  })
}
