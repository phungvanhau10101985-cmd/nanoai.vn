import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import type { AppUser } from '@/lib/auth/app-user'
import {
  EMAIL_SESSION_COOKIE,
  EMAIL_SESSION_COOKIE_LEGACY,
  getAuthJwtSecretBytes,
  isEmailAuthEnabled,
} from '@/lib/auth/email-auth-config'

/** Phiên đăng nhập email (JWT cookie). */
export async function getEmailSessionUser(): Promise<AppUser | null> {
  if (!isEmailAuthEnabled()) return null
  const secret = getAuthJwtSecretBytes()
  if (!secret) return null
  const token =
    cookies().get(EMAIL_SESSION_COOKIE)?.value
    ?? cookies().get(EMAIL_SESSION_COOKIE_LEGACY)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })
    const id = String(payload.sub || '')
    const email = String((payload as { email?: string }).email || '')
    if (!id || !email) return null
    return {
      id,
      email,
      aud: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    }
  } catch {
    return null
  }
}
