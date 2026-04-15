import type { AppUser } from '@/lib/auth/app-user'
import type { NextRequest } from 'next/server'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import {
  createGuestSessionId,
  readGuestSessionIdFromRequestStrictOrLoose,
} from '@/lib/messaging/guest-auth-session'
import { readGuestAccountIdFromRequest } from '@/lib/messaging/guest-account-session'
import { mergeGuestSessionConversationToAccount } from '@/lib/messaging/guest-account-merge'
import {
  findGuestAccountIdByEmailPg,
  insertGuestAccountPg,
  updateGuestAccountLastLoginPg,
  upsertGuestIdentityPg,
} from '@/lib/db/messaging-guest-pg'
import { isPgConfigured } from '@/lib/db/pool'

export async function resolveGuestIdentity(request: NextRequest) {
  const user = await getEmailSessionUser()

  if (user?.id) {
    return {
      user,
      externalThreadId: user.id,
      linkedUserId: user.id,
      guestAccountId: null as string | null,
      newSessionId: null as string | null,
    }
  }

  const accountId = readGuestAccountIdFromRequest(request)
  if (accountId) {
    return {
      user: null,
      externalThreadId: accountId,
      linkedUserId: null,
      guestAccountId: accountId,
      newSessionId: null as string | null,
    }
  }

  const existingSessionId = readGuestSessionIdFromRequestStrictOrLoose(request)
  if (existingSessionId) {
    return {
      user: null,
      externalThreadId: existingSessionId,
      linkedUserId: null,
      guestAccountId: null as string | null,
      newSessionId: null as string | null,
    }
  }

  const newSessionId = createGuestSessionId()
  return {
    user: null,
    externalThreadId: newSessionId,
    linkedUserId: null,
    guestAccountId: null as string | null,
    newSessionId,
  }
}

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

export async function upsertGuestAccountForGoogleIdentity(
  partnerId: string,
  request: NextRequest,
  user: AppUser | null
): Promise<string | null> {
  if (!user?.email) return null
  if (!isPgConfigured()) return null
  const email = normalizeEmail(user.email)
  const nowIso = new Date().toISOString()
  let accountId: string | undefined

  try {
    let id: string | null = await findGuestAccountIdByEmailPg(partnerId, email)
    if (!id) {
      id = await insertGuestAccountPg({
        partnerId,
        emailRaw: user.email!,
        emailNormalized: email,
        firstVerifiedAt: nowIso,
        lastLoginAt: nowIso,
      })
    } else {
      await updateGuestAccountLastLoginPg(id, nowIso)
    }
    if (id) {
      const identityOk = await upsertGuestIdentityPg({
        partnerId,
        guestAccountId: id,
        provider: 'google',
        providerSubject: email,
      })
      if (identityOk) {
        accountId = id
      }
    }
  } catch (e) {
    console.warn('[guest] upsertGuestAccountForGoogleIdentity PG failed', e)
  }

  const anonymousSessionId = readGuestSessionIdFromRequestStrictOrLoose(request)
  if (anonymousSessionId && accountId) {
    await mergeGuestSessionConversationToAccount(partnerId, anonymousSessionId, accountId)
  }
  if (accountId && user?.id) {
    await mergeGuestSessionConversationToAccount(partnerId, user.id, accountId)
  }
  return accountId ?? null
}
