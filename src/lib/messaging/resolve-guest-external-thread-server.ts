import { cookies } from 'next/headers'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import {
  MESSAGING_GUEST_ACCOUNT_COOKIE,
  MESSAGING_GUEST_ACCOUNT_COOKIE_LEGACY,
} from '@/lib/messaging/guest-account-session'
import {
  MESSAGING_GUEST_SESSION_COOKIE,
  MESSAGING_GUEST_SESSION_COOKIE_LEGACY,
} from '@/lib/messaging/guest-auth-session'
import { isValidMessagingGuestSessionId } from '@/lib/messaging/guest-session-id'
import { isValidUuidString } from '@/lib/validate-uuid'

/**
 * Khớp thứ tự với `resolveGuestIdentity` (API): email session → guest account cookie → guest session cookie.
 * Dùng trên RSC để đọc `metadata.ui_locale` của hội thoại widget trong DB.
 */
export async function resolveGuestExternalThreadIdFromCookies(): Promise<string | null> {
  const user = await getEmailSessionUser()
  if (user?.id && isValidUuidString(user.id)) return user.id

  const c = cookies()
  const acc =
    c.get(MESSAGING_GUEST_ACCOUNT_COOKIE)?.value?.trim() ??
    c.get(MESSAGING_GUEST_ACCOUNT_COOKIE_LEGACY)?.value?.trim() ??
    ''
  if (acc && isValidUuidString(acc)) return acc

  const sess =
    c.get(MESSAGING_GUEST_SESSION_COOKIE)?.value?.trim() ??
    c.get(MESSAGING_GUEST_SESSION_COOKIE_LEGACY)?.value?.trim() ??
    ''
  if (sess && isValidMessagingGuestSessionId(sess)) return sess

  return null
}
