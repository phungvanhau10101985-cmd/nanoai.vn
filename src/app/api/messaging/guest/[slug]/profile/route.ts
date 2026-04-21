import { NextRequest, NextResponse } from 'next/server'
import {
  EMAIL_SESSION_COOKIE,
  EMAIL_SESSION_COOKIE_LEGACY,
} from '@/lib/auth/email-auth-config'
import { resolveCanonicalUserIdByEmail } from '@/lib/auth/resolve-canonical-email-user'
import {
  createEmailSessionTokenString,
  getEmailSessionCookieOptions,
} from '@/lib/auth/email-session-token'
import { resolveFashionMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import { resolveGuestIdentity } from '@/lib/messaging/guest-widget-identity'
import type { GuestProfileGender } from '@/lib/db/messaging-guest-pg'
import { updateNanoaiChatProfilePg } from '@/lib/db/profiles-repo'
import { isPgConfigured } from '@/lib/db/pool'

export const dynamic = 'force-dynamic'

function parseGender(v: unknown): GuestProfileGender | null {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : ''
  if (s === 'male' || s === 'female') return s
  return null
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const r = await resolveFashionMessagingPartnerBySlug(slug)
  if (!r) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Server database unavailable.' }, { status: 503 })
  }

  const identity = await resolveGuestIdentity(request)
  const uid = identity.user?.id?.trim()
  const email = identity.user?.email?.trim()
  if (!uid || !email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  /** JWT `sub` có thể lệch `auth.users` (reset DB, xóa user…); profile FK vào `auth.users`. */
  const realUserId = await resolveCanonicalUserIdByEmail(email)
  if (!realUserId) {
    return NextResponse.json({ error: 'Could not save profile.' }, { status: 500 })
  }

  const body = (await request.json().catch(() => null)) as {
    birthDate?: string
    gender?: string
  } | null
  const birthDate = typeof body?.birthDate === 'string' ? body.birthDate.trim() : ''
  const gender = parseGender(body?.gender)
  if (!birthDate || !gender) {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  const ok = await updateNanoaiChatProfilePg(realUserId, {
    birthDateIso: birthDate,
    gender,
  })
  if (!ok) {
    return NextResponse.json({ error: 'Could not save profile.' }, { status: 400 })
  }

  const res = NextResponse.json({
    ok: true,
    guestProfile: { birthDate, gender },
    needsProfile: false,
  })
  if (realUserId !== uid) {
    const token = await createEmailSessionTokenString(realUserId, email)
    if (token) {
      const opts = getEmailSessionCookieOptions()
      res.cookies.set(EMAIL_SESSION_COOKIE, token, opts)
      res.cookies.set(EMAIL_SESSION_COOKIE_LEGACY, token, opts)
    }
  }
  return res
}
