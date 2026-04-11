/**
 * Xác thực JWT đăng nhập email trên Edge (middleware) — không dùng Node crypto / pg.
 */
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import {
  EMAIL_SESSION_COOKIE,
  EMAIL_SESSION_COOKIE_LEGACY,
  getAuthJwtSecretCandidatesBytes,
} from '@/lib/auth/email-auth-config'

export async function getJwtUserFromRequest(request: NextRequest): Promise<{ sub: string; email: string } | null> {
  const secrets = getAuthJwtSecretCandidatesBytes()
  if (!secrets.length) return null
  const token =
    request.cookies.get(EMAIL_SESSION_COOKIE)?.value
    ?? request.cookies.get(EMAIL_SESSION_COOKIE_LEGACY)?.value
  if (!token) return null
  for (const secret of secrets) {
    try {
      const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })
      const sub = String(payload.sub || '')
      const email = String((payload as { email?: string }).email || '')
      if (!sub || !email) return null
      return { sub, email }
    } catch {
      // try next secret candidate
    }
  }
  return null
}
