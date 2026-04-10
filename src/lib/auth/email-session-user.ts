import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import type { AppUser } from '@/lib/auth/app-user'
import {
  EMAIL_SESSION_COOKIE,
  EMAIL_SESSION_COOKIE_LEGACY,
  getAuthJwtSecretCandidatesBytes,
  isEmailAuthEnabled,
} from '@/lib/auth/email-auth-config'
import { isValidUuidString } from '@/lib/validate-uuid'

/** Phiên đăng nhập email (JWT cookie). */
export async function getEmailSessionUser(): Promise<AppUser | null> {
  if (!isEmailAuthEnabled()) return null
  const secrets = getAuthJwtSecretCandidatesBytes()
  if (!secrets.length) return null
  const token =
    cookies().get(EMAIL_SESSION_COOKIE)?.value
    ?? cookies().get(EMAIL_SESSION_COOKIE_LEGACY)?.value
  if (!token) return null
  for (const secret of secrets) {
    try {
      const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })
      const id = String(payload.sub || '').trim()
      const email = String((payload as { email?: string }).email || '').trim()
      if (!isValidUuidString(id) || !email) return null
      return {
        id,
        email,
        aud: 'authenticated',
        app_metadata: {},
        user_metadata: {},
        created_at: new Date().toISOString(),
      }
    } catch {
      // try next secret candidate
    }
  }
  return null
}
