import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { getAuthJwtSecretCandidatesBytes, getPrimaryAuthJwtSecretBytes } from '@/lib/auth/email-auth-config'
import { getEmailSessionCookieOptions } from '@/lib/auth/email-session-token'
import { isValidUuidString } from '@/lib/validate-uuid'

/** Vào lớp bằng mã định danh: chỉ nhớ trên trình duyệt, không gắn tài khoản Google. */
export const CLASS_BROWSER_COOKIE = 'lop_class_browser'

const ISSUER = 'lop-browser'

export type ClassBrowserSession = {
  classId: string
  userId: string
  studentCode: string
  email: string
}

export async function signClassBrowserSession(session: ClassBrowserSession): Promise<string | null> {
  const secret = getPrimaryAuthJwtSecretBytes()
  if (!secret || !isValidUuidString(session.classId) || !isValidUuidString(session.userId)) return null
  return new SignJWT({
    classId: session.classId,
    studentCode: session.studentCode,
    email: session.email,
    kind: ISSUER,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(session.userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${getEmailSessionCookieOptions().maxAge}s`)
    .sign(secret)
}

export async function readClassBrowserSession(): Promise<ClassBrowserSession | null> {
  const secrets = getAuthJwtSecretCandidatesBytes()
  const token = cookies().get(CLASS_BROWSER_COOKIE)?.value
  if (!token || !secrets.length) return null
  for (const secret of secrets) {
    try {
      const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'], issuer: ISSUER })
      const userId = String(payload.sub || '').trim()
      const classId = String(payload.classId || '').trim()
      const studentCode = String(payload.studentCode || '').trim()
      const email = String(payload.email || '').trim()
      if (!isValidUuidString(userId) || !isValidUuidString(classId)) return null
      return { classId, userId, studentCode, email }
    } catch {
      /* thử secret cũ */
    }
  }
  return null
}

export function classBrowserCookieOptions() {
  return getEmailSessionCookieOptions()
}
