import type { NextRequest } from 'next/server'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import { readGuestAccountIdFromRequest } from '@/lib/messaging/guest-account-session'
import { readGuestSessionIdFromRequestStrictOrLoose } from '@/lib/messaging/guest-auth-session'
import { upsertGuestAccountForGoogleIdentity } from '@/lib/messaging/guest-widget-identity'

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

export async function resolveWidgetOrderThreadFromRequest(
  request: NextRequest,
  partnerId: string
): Promise<WidgetOrderThreadContext | null> {
  const user = await getEmailSessionUser()
  const sessionFromRequest = readGuestSessionIdFromRequestStrictOrLoose(request)?.trim() ?? null

  if (user?.id) {
    const accountId = await upsertGuestAccountForGoogleIdentity(partnerId, request, user)
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

  const accountId = readGuestAccountIdFromRequest(request)?.trim() ?? null
  if (accountId) {
    return {
      externalThreadId: accountId,
      linkedUserId: null,
      guestAccountId: accountId,
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
