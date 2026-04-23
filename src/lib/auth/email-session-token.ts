import { SignJWT } from 'jose'
import { cookies } from 'next/headers'
import {
  EMAIL_SESSION_COOKIE,
  EMAIL_SESSION_COOKIE_LEGACY,
  getPrimaryAuthJwtSecretBytes,
  isEmailAuthEnabled,
} from '@/lib/auth/email-auth-config'

function resolveEmailSessionMaxAgeSec(): number {
  const raw = process.env.EMAIL_SESSION_MAX_AGE_DAYS?.trim()
  const days = raw ? parseInt(raw, 10) : 3650
  const d = Number.isFinite(days) ? Math.min(3650, Math.max(30, days)) : 3650
  return 60 * 60 * 24 * d
}

/** Thời hạn cookie + JWT (mặc định 10 năm; chỉnh bằng EMAIL_SESSION_MAX_AGE_DAYS). */
export const EMAIL_SESSION_MAX_AGE_SEC = resolveEmailSessionMaxAgeSec()

export function getEmailSessionCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production'
  return {
    path: '/',
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    maxAge: EMAIL_SESSION_MAX_AGE_SEC,
  }
}

export async function createEmailSessionTokenString(userId: string, email: string): Promise<string | null> {
  const secret = getPrimaryAuthJwtSecretBytes()
  if (!secret) return null
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${EMAIL_SESSION_MAX_AGE_SEC}s`)
    .sign(secret)
}

export async function setEmailSessionCookie(userId: string, email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isEmailAuthEnabled()) return { ok: false, error: 'email_auth_disabled' }
  const token = await createEmailSessionTokenString(userId, email)
  if (!token) return { ok: false, error: 'auth_jwt_secret_missing' }
  const opts = getEmailSessionCookieOptions()
  cookies().set(EMAIL_SESSION_COOKIE, token, opts)
  cookies().set(EMAIL_SESSION_COOKIE_LEGACY, token, opts)
  return { ok: true }
}

export async function clearEmailSessionCookie(): Promise<void> {
  try {
    const clear = { path: '/', maxAge: 0 }
    cookies().set(EMAIL_SESSION_COOKIE, '', clear)
    cookies().set(EMAIL_SESSION_COOKIE_LEGACY, '', clear)
  } catch {
    /* ignore */
  }
}
