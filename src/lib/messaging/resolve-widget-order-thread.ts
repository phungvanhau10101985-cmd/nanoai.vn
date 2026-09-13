import { cookies, headers } from 'next/headers'
import type { NextRequest } from 'next/server'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import { findGuestAccountIdByEmailPg } from '@/lib/db/messaging-guest-pg'
import {
  MESSAGING_GUEST_ACCOUNT_COOKIE,
  MESSAGING_GUEST_ACCOUNT_COOKIE_LEGACY,
  MESSAGING_GUEST_ACCOUNT_HEADER,
  MESSAGING_GUEST_ACCOUNT_SYNC_COOKIE,
  readGuestAccountIdFromRequest,
} from '@/lib/messaging/guest-account-session'
import {
  MESSAGING_GUEST_SESSION_COOKIE,
  MESSAGING_GUEST_SESSION_COOKIE_LEGACY,
  MESSAGING_GUEST_SESSION_HEADER,
  MESSAGING_GUEST_SESSION_SYNC_COOKIE,
  readGuestSessionIdFromRequestStrictOrLoose,
} from '@/lib/messaging/guest-auth-session'
import { LOOSE_RFC4122_UUID_STRING_RE, isValidMessagingGuestSessionId } from '@/lib/messaging/guest-session-id'
import { requestSkipsPartnerSiteShopAuthResume } from '@/lib/partner-website/shop/partner-site-shop-auth-skip-sync'
import { isValidUuidString } from '@/lib/validate-uuid'

/**
 * Ngữ cảnh thread cho đơn widget — khớp `guest/[slug]/route.ts`:
 * Google đã có `messaging_guest_accounts` → `externalThreadId` = id tài khoản khách (sau merge trùng `order.external_thread_id`).
 * Đơn nháp ẩn danh cũ: cần `anonymousSessionId` (header) để khớp `order.external_thread_id` trước merge.
 */
export type WidgetOrderThreadContext = {
  externalThreadId: string
  linkedUserId: string | null
  guestAccountId: string | null
  anonymousSessionId: string | null
}

async function resolveWidgetOrderThreadFromIdentity(
  partnerId: string,
  input: {
    skipPlatformResume: boolean
    sessionId: string | null
    accountId: string | null
  }
): Promise<WidgetOrderThreadContext | null> {
  const user = input.skipPlatformResume ? null : await getEmailSessionUser()
  const sessionFromRequest = input.sessionId?.trim() || null
  const accountFromRequest = input.accountId?.trim() || null

  if (user?.id) {
    let accountId = accountFromRequest
    if (!accountId && user.email) {
      accountId = await findGuestAccountIdByEmailPg(partnerId, user.email.trim().toLowerCase())
    }
    if (accountId) {
      return {
        externalThreadId: accountId,
        linkedUserId: user.id,
        guestAccountId: accountId,
        anonymousSessionId: sessionFromRequest,
      }
    }
    return {
      externalThreadId: user.id,
      linkedUserId: user.id,
      guestAccountId: null,
      anonymousSessionId: sessionFromRequest,
    }
  }

  if (accountFromRequest) {
    return {
      externalThreadId: accountFromRequest,
      linkedUserId: null,
      guestAccountId: accountFromRequest,
      anonymousSessionId: sessionFromRequest,
    }
  }

  if (sessionFromRequest) {
    return {
      externalThreadId: sessionFromRequest,
      linkedUserId: null,
      guestAccountId: null,
      anonymousSessionId: null,
    }
  }

  return null
}

export async function resolveWidgetOrderThreadFromRequest(
  request: NextRequest,
  partnerId: string
): Promise<WidgetOrderThreadContext | null> {
  return resolveWidgetOrderThreadFromIdentity(partnerId, {
    skipPlatformResume: requestSkipsPartnerSiteShopAuthResume(request),
    sessionId: readGuestSessionIdFromRequestStrictOrLoose(request),
    accountId: readGuestAccountIdFromRequest(request),
  })
}

/** RSC / live page: cookie + header, cùng thứ tự API GET đơn. Không finalize Google. */
export async function resolveWidgetOrderThreadFromCookies(
  partnerId: string
): Promise<WidgetOrderThreadContext | null> {
  const headerStore = headers()
  const jar = cookies()
  const headerSession = headerStore.get(MESSAGING_GUEST_SESSION_HEADER)?.trim() ?? ''
  const cookieSession =
    jar.get(MESSAGING_GUEST_SESSION_COOKIE)?.value?.trim() ??
    jar.get(MESSAGING_GUEST_SESSION_COOKIE_LEGACY)?.value?.trim() ??
    jar.get(MESSAGING_GUEST_SESSION_SYNC_COOKIE)?.value?.trim() ??
    ''
  const sessionId =
    (isValidMessagingGuestSessionId(headerSession) ? headerSession : null) ??
    (isValidMessagingGuestSessionId(cookieSession) ? cookieSession : null) ??
    (LOOSE_RFC4122_UUID_STRING_RE.test(headerSession) ? headerSession : null) ??
    (LOOSE_RFC4122_UUID_STRING_RE.test(cookieSession) ? cookieSession : null)
  const headerAccount = headerStore.get(MESSAGING_GUEST_ACCOUNT_HEADER)?.trim() ?? ''
  const cookieAccount =
    jar.get(MESSAGING_GUEST_ACCOUNT_COOKIE)?.value?.trim() ??
    jar.get(MESSAGING_GUEST_ACCOUNT_COOKIE_LEGACY)?.value?.trim() ??
    jar.get(MESSAGING_GUEST_ACCOUNT_SYNC_COOKIE)?.value?.trim() ??
    ''
  const accountId =
    (isValidUuidString(headerAccount) ? headerAccount : null) ??
    (isValidUuidString(cookieAccount) ? cookieAccount : null)
  return resolveWidgetOrderThreadFromIdentity(partnerId, {
    skipPlatformResume: requestSkipsPartnerSiteShopAuthResume({
      headers: { get: (name) => headerStore.get(name) },
    }),
    sessionId,
    accountId,
  })
}
