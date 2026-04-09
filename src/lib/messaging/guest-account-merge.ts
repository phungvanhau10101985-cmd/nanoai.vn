import { mergeGuestSessionConversationToAccountPg } from '@/lib/db/customer-care-pg'
import { isPgConfigured } from '@/lib/db/pool'

/**
 * Merge session → account cho widget guest. Chỉ Postgres (`DATABASE_URL`).
 */
export async function mergeGuestSessionConversationToAccount(
  partnerId: string,
  sessionId: string,
  guestAccountId: string
) {
  if (!isPgConfigured()) return
  try {
    const ok = await mergeGuestSessionConversationToAccountPg(partnerId, sessionId, guestAccountId)
    if (!ok) {
      console.warn('[guest-account-merge] mergeGuestSessionConversationToAccountPg returned false')
    }
  } catch (e) {
    console.warn('[guest-account-merge] PG merge failed', e)
  }
}
