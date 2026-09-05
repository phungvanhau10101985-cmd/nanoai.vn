import { linkWidgetConversationsByGuestAccountEmailFromPg } from '@/lib/db/customer-care-pg'
import { listGuestChallengeSessionIdsByEmailPg } from '@/lib/db/messaging-guest-pg'
import { pgQuery } from '@/lib/db/pg-query'
import { resolveCanonicalUserIdByEmail } from '@/lib/auth/resolve-canonical-email-user'
import { createEmailSessionTokenString } from '@/lib/auth/email-session-token'
import type { SignupSource } from '@/lib/auth/signup-source'
import { mergeGuestSessionConversationToAccount } from '@/lib/messaging/guest-account-merge'

export type CompleteGuestEmailAuthResult = {
  authUserId: string | null
  sessionToken: string | null
  emailSessionIssued: boolean
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Gom mọi phiên guest (OTP challenge, legacy auth.users) vào một guest account. */
export async function mergeAllGuestSessionsForEmail(params: {
  partnerId: string
  email: string
  guestAccountId: string
  currentSessionId?: string | null
}): Promise<void> {
  const email = normalizeEmail(params.email)
  const { partnerId, guestAccountId } = params
  const sessionId = String(params.currentSessionId ?? '').trim()

  if (sessionId && sessionId !== guestAccountId) {
    await mergeGuestSessionConversationToAccount(partnerId, sessionId, guestAccountId)
  }

  try {
    const allSessionIds = await listGuestChallengeSessionIdsByEmailPg(partnerId, email, 300)
    for (const sid of allSessionIds) {
      if (!sid || sid === guestAccountId) continue
      await mergeGuestSessionConversationToAccount(partnerId, sid, guestAccountId)
    }
  } catch (e) {
    console.warn('[mergeAllGuestSessionsForEmail] challenge session merge skipped', e)
  }

  try {
    const legacy = await pgQuery<{ id: string }>(
      `select id::text as id
       from auth.users
       where lower(coalesce(email, '')) = $1`,
      [email]
    )
    for (const row of legacy) {
      const legacyThreadId = String(row.id || '').trim()
      if (!legacyThreadId || legacyThreadId === guestAccountId) continue
      await mergeGuestSessionConversationToAccount(partnerId, legacyThreadId, guestAccountId)
    }
  } catch (e) {
    console.warn('[mergeAllGuestSessionsForEmail] legacy auth user merge skipped', e)
  }
}

/**
 * Sau khi xác minh email trên web shop / chat widget:
 * - đảm bảo tài khoản NanoAI (`auth.users` + `profiles`)
 * - gắn hội thoại widget với `linked_user_id` để gửi email thông báo chat
 * - phát hành JWT phiên email nếu cấu hình cho phép
 */
export async function completeGuestEmailAuth(params: {
  partnerId: string
  email: string
  guestAccountId: string
  /** Mặc định web đối tác (chat widget / SSO). Shop gửi `customer_website`. */
  signupSource?: SignupSource
  partnerSlug?: string | null
}): Promise<CompleteGuestEmailAuthResult> {
  const email = normalizeEmail(params.email)
  const { partnerId, guestAccountId } = params
  const signupSource = params.signupSource ?? 'partner_website'

  const authUserId = await resolveCanonicalUserIdByEmail(email, {
    source: signupSource,
    partnerId,
    partnerSlug: params.partnerSlug,
  })
  if (authUserId && authUserId !== guestAccountId) {
    await mergeGuestSessionConversationToAccount(partnerId, authUserId, guestAccountId)
  }

  if (authUserId) {
    try {
      await linkWidgetConversationsByGuestAccountEmailFromPg(authUserId, email)
    } catch (e) {
      console.warn('[completeGuestEmailAuth] link widget conversations skipped', e)
    }
  }

  let sessionToken: string | null = null
  if (authUserId) {
    try {
      sessionToken = await createEmailSessionTokenString(authUserId, email)
      if (!sessionToken) {
        console.warn('[completeGuestEmailAuth] email JWT not issued (check AUTH_JWT_SECRET length >= 32)')
      }
    } catch (e) {
      console.warn('[completeGuestEmailAuth] session token skipped', e)
    }
  }

  try {
    const { processPartnerPromotionTrigger } = await import(
      '@/lib/messaging/partner-promotion-auto-grant'
    )
    await processPartnerPromotionTrigger({
      partnerId,
      trigger: 'signup',
      guestAccountId,
      linkedUserId: authUserId,
      emailNormalized: email,
    })
  } catch (e) {
    // Authentication must remain available if promotion maintenance is unavailable.
    console.warn('[completeGuestEmailAuth] signup promotion skipped', e)
  }

  return {
    authUserId,
    sessionToken,
    emailSessionIssued: Boolean(sessionToken),
  }
}
