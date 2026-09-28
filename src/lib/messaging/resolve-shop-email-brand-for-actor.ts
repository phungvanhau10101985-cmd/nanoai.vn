import { fetchMessagingPartnerBySlugFromPg } from '@/lib/db/messaging-partners-pg'
import { resolvePartnerDashboardAccessFromPg } from '@/lib/messaging/partner-dashboard-access'
import { resolvePartnerShopEmailContext } from '@/lib/messaging/partner-shop-email-context'
import { isValidUuidString } from '@/lib/validate-uuid'

/**
 * Tên shop để gắn mail khi user đang thao tác đúng workspace đó.
 * Hint là UUID hoặc slug. Không có quyền thì trả null (mail nền tảng giữ NanoAI).
 */
export async function resolveShopEmailBrandForActor(
  userId: string,
  partnerHint: string | null | undefined
): Promise<string | null> {
  const hint = String(partnerHint ?? '')
    .trim()
    .replace(/[\r\n]/g, '')
    .slice(0, 80)
  if (!hint || !userId.trim()) return null

  let partnerId = ''
  if (isValidUuidString(hint)) {
    partnerId = hint
  } else if (/^[a-z0-9][a-z0-9-]{0,62}$/i.test(hint)) {
    const row = await fetchMessagingPartnerBySlugFromPg(hint)
    partnerId = row?.id ?? ''
  }
  if (!isValidUuidString(partnerId)) return null

  const access = await resolvePartnerDashboardAccessFromPg(userId, partnerId)
  if (!access) return null

  try {
    const ctx = await resolvePartnerShopEmailContext(partnerId)
    const name = ctx.shopDisplayName.trim()
    return name || null
  } catch (e) {
    console.warn('[resolveShopEmailBrandForActor]', e)
    return null
  }
}
