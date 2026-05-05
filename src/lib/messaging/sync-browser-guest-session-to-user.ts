import {
  fetchWidgetConversationPartnerIdsByExternalThreadIdFromPg,
  linkWidgetConversationsByGuestAccountEmailFromPg,
} from '@/lib/db/customer-care-pg'
import {
  findGuestAccountIdByEmailPg,
  insertGuestAccountPg,
  updateGuestAccountLastLoginPg,
  upsertGuestIdentityPg,
} from '@/lib/db/messaging-guest-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { isValidMessagingGuestSessionId } from '@/lib/messaging/guest-session-id'
import { mergeGuestSessionConversationToAccount } from '@/lib/messaging/guest-account-merge'
import { isValidUuidString } from '@/lib/validate-uuid'

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

/**
 * Khi user đăng nhập bằng luồng web chung, trình duyệt vẫn còn guest session của widget.
 * Dùng session đó để gom mọi hội thoại đã nhắn trước đăng nhập vào account theo email.
 */
export async function syncBrowserGuestSessionToUser(params: {
  guestSessionId: string | null | undefined
  userId: string | null | undefined
  email: string | null | undefined
}): Promise<number> {
  if (!isPgConfigured()) return 0
  const sessionId = String(params.guestSessionId ?? '').trim()
  const userId = String(params.userId ?? '').trim()
  const email = normalizeEmail(String(params.email ?? ''))
  if (!isValidMessagingGuestSessionId(sessionId) || !isValidUuidString(userId) || !email) {
    return 0
  }

  const partnerIds = await fetchWidgetConversationPartnerIdsByExternalThreadIdFromPg(sessionId)
  if (!partnerIds?.length) {
    if (email) await linkWidgetConversationsByGuestAccountEmailFromPg(userId, email)
    return 0
  }

  const nowIso = new Date().toISOString()
  let synced = 0
  for (const partnerId of partnerIds) {
    try {
      let accountId = await findGuestAccountIdByEmailPg(partnerId, email)
      if (!accountId) {
        accountId = await insertGuestAccountPg({
          partnerId,
          emailRaw: email,
          emailNormalized: email,
          firstVerifiedAt: nowIso,
          lastLoginAt: nowIso,
        })
      } else {
        await updateGuestAccountLastLoginPg(accountId, nowIso)
      }
      if (!accountId) continue
      const identityOk = await upsertGuestIdentityPg({
        partnerId,
        guestAccountId: accountId,
        provider: 'email_otp',
        providerSubject: email,
      })
      if (!identityOk) continue
      await mergeGuestSessionConversationToAccount(partnerId, sessionId, accountId)
      synced += 1
    } catch (e) {
      console.warn('[messaging] syncBrowserGuestSessionToUser skipped partner', partnerId, e)
    }
  }

  await linkWidgetConversationsByGuestAccountEmailFromPg(userId, email)
  return synced
}
