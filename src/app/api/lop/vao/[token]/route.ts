import { NextResponse } from 'next/server'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import { EMAIL_SESSION_COOKIE, EMAIL_SESSION_COOKIE_LEGACY } from '@/lib/auth/email-auth-config'
import { loginRosterStudentPg } from '@/lib/db/class-entry-pg'
import { CLASS_BROWSER_COOKIE } from '@/lib/lop/class-browser-session'
import { rosterLoginJson } from '@/lib/lop/roster-login-response'

export const dynamic = 'force-dynamic'

const ROSTER_EMAIL_SUFFIX = '@hocsinh.invalid'

function clearCookie() {
  return { path: '/', maxAge: 0 }
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const body = (await request.json().catch(() => null)) as {
    studentCode?: unknown
    password?: unknown
    switchStudent?: unknown
  } | null
  if (body?.switchStudent === true) {
    const current = await getEmailSessionUser()
    const res = NextResponse.json({ ok: true })
    res.cookies.set(CLASS_BROWSER_COOKIE, '', clearCookie())
    if (!current || String(current.email || '').toLowerCase().endsWith(ROSTER_EMAIL_SUFFIX)) {
      res.cookies.set(EMAIL_SESSION_COOKIE, '', clearCookie())
      res.cookies.set(EMAIL_SESSION_COOKIE_LEGACY, '', clearCookie())
    }
    return res
  }

  const studentCode = String(body?.studentCode ?? '')
  const result = await loginRosterStudentPg(token, studentCode, String(body?.password ?? ''))
  return rosterLoginJson(result, studentCode)
}
