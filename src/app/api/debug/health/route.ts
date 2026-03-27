import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const startedAt = Date.now()
  try {
    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

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
      authError: authError?.message || null,
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
