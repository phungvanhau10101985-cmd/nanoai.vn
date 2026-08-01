import { NextResponse, type NextRequest } from 'next/server'
import {
  applyGuestIdentityToResponse,
  mirrorGuestSessionToClient,
} from '@/lib/messaging/guest-auth-session'
import { isValidMessagingGuestSessionId } from '@/lib/messaging/guest-session-id'
import { resolveSiteVisitorContext } from '@/lib/partner-website/shop/partner-site-personalization'

export async function withSiteVisitorSession<T>(
  request: NextRequest,
  partnerId: string,
  handler: (ctx: Awaited<ReturnType<typeof resolveSiteVisitorContext>>) => Promise<T>
): Promise<{ data: T; sessionId: string | null; accountKey: string }> {
  const ctx = await resolveSiteVisitorContext(request, partnerId)
  const data = await handler(ctx)
  const sessionId =
    ctx.sessionId && isValidMessagingGuestSessionId(ctx.sessionId)
      ? ctx.sessionId
      : isValidMessagingGuestSessionId(ctx.thread.externalThreadId)
        ? ctx.thread.externalThreadId
        : null
  return { data, sessionId, accountKey: ctx.accountKey }
}

export function jsonSitePersonalization(
  request: NextRequest,
  body: unknown,
  status: number,
  opts: {
    sessionId: string | null
    thread: Awaited<ReturnType<typeof resolveSiteVisitorContext>>['thread']
  }
): NextResponse {
  const res = NextResponse.json(body, { status })
  if (opts.sessionId) {
    mirrorGuestSessionToClient(res, request, opts.sessionId)
  }
  applyGuestIdentityToResponse(res, request, {
    newSessionId: opts.sessionId,
    user: opts.thread.linkedUserId ? { id: opts.thread.linkedUserId } : null,
    effectiveExternalThreadId: opts.thread.externalThreadId,
    effectiveGuestAccountId: opts.thread.guestAccountId,
  })
  return res
}
