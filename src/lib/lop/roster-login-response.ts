import { NextResponse } from 'next/server'
import { EMAIL_SESSION_COOKIE, EMAIL_SESSION_COOKIE_LEGACY } from '@/lib/auth/email-auth-config'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import { createEmailSessionTokenString, getEmailSessionCookieOptions } from '@/lib/auth/email-session-token'
import type { EntryLoginResult } from '@/lib/db/class-entry-pg'
import {
  CLASS_BROWSER_COOKIE,
  classBrowserCookieOptions,
  signClassBrowserSession,
} from '@/lib/lop/class-browser-session'
import { normalizeStudentCode } from '@/lib/lop/class-roster'

const ROSTER_EMAIL_SUFFIX = '@hocsinh.invalid'

/** Cookie vào lớp bằng mã định danh. Tài khoản Google đang mở thì giữ nguyên. */
export async function rosterLoginJson(result: EntryLoginResult, studentCodeRaw: string) {
  if (!result.ok) {
    const status = result.error === 'schema' ? 503 : result.error === 'locked' ? 429 : 401
    return NextResponse.json({ error: result.error }, { status })
  }
  const browser = await signClassBrowserSession({
    classId: result.classId,
    userId: result.userId,
    studentCode: normalizeStudentCode(studentCodeRaw),
    email: result.email,
  })
  if (!browser) return NextResponse.json({ error: 'schema' }, { status: 503 })
  const res = NextResponse.json({ ok: true, classId: result.classId })
  res.cookies.set(CLASS_BROWSER_COOKIE, browser, classBrowserCookieOptions())

  const current = await getEmailSessionUser()
  const rosterOnly = result.email.toLowerCase().endsWith(ROSTER_EMAIL_SUFFIX)
  if (!current && rosterOnly) {
    const session = await createEmailSessionTokenString(result.userId, result.email)
    if (session) {
      const opts = getEmailSessionCookieOptions()
      res.cookies.set(EMAIL_SESSION_COOKIE, session, opts)
      res.cookies.set(EMAIL_SESSION_COOKIE_LEGACY, session, opts)
    }
  }
  return res
}
