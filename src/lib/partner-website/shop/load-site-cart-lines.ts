import { cookies } from 'next/headers'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import { fetchMessagingGuestCartFromPg } from '@/lib/db/messaging-guest-cart-pg'
import {
  MESSAGING_GUEST_ACCOUNT_COOKIE,
  MESSAGING_GUEST_ACCOUNT_COOKIE_LEGACY,
  MESSAGING_GUEST_ACCOUNT_SYNC_COOKIE,
} from '@/lib/messaging/guest-account-session'
import { parseSiteCartLines, type SiteCartLine } from '@/lib/partner-website/shop/cart-line-utils'

/** RSC first paint for giỏ — cookie account, không chờ session bootstrap client. */
export async function loadSiteCartLinesForRequest(partnerId: string): Promise<SiteCartLine[] | null> {
  const user = await getEmailSessionUser()
  const jar = cookies()
  const guestAccount =
    jar.get(MESSAGING_GUEST_ACCOUNT_COOKIE)?.value?.trim() ||
    jar.get(MESSAGING_GUEST_ACCOUNT_COOKIE_LEGACY)?.value?.trim() ||
    jar.get(MESSAGING_GUEST_ACCOUNT_SYNC_COOKIE)?.value?.trim() ||
    ''
  const accountKey = guestAccount || user?.id?.trim() || ''
  if (!accountKey) return null
  const raw = await fetchMessagingGuestCartFromPg({ partnerId, accountKey })
  return parseSiteCartLines(raw)
}
