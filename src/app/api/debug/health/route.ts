import { NextRequest, NextResponse } from 'next/server'
import { checkPgConnection } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const startedAt = Date.now()
  try {
    const user = await getEmailSessionUser()

    const pgConfigured = isPgConfigured()
    const pgCheck = pgConfigured ? await checkPgConnection() : { ok: false, error: 'DATABASE_URL not set' }

    const cookieHeader = req.headers.get('cookie') || ''
    const payload = {
      ok: true,
      path: '/api/debug/health',
      now: new Date().toISOString(),
      tookMs: Date.now() - startedAt,
      host: req.headers.get('host') || '',
      xForwardedProto: req.headers.get('x-forwarded-proto') || '',
      hasCookieHeader: cookieHeader.length > 0,
      cookieBytes: cookieHeader.length,
      userId: user?.id || null,
      authError: user ? null : 'no_jwt_session',
      postgres: {
        databaseUrlConfigured: pgConfigured,
        selectOneOk: pgCheck.ok,
        error: pgCheck.error ?? null,
      },
    }

    console.info('[debug-health] ok', {
      host: payload.host,
      hasCookieHeader: payload.hasCookieHeader,
      userId: payload.userId,
      tookMs: payload.tookMs,
    })

    return NextResponse.json(payload)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[debug-health] failed', { error: msg })
    return NextResponse.json(
      {
        ok: false,
        path: '/api/debug/health',
        now: new Date().toISOString(),
        tookMs: Date.now() - startedAt,
        error: msg,
      },
      { status: 500 }
    )
  }
}
