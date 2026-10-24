import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** Liveness probe for the process watchdog. Does not touch Postgres. */
export function GET() {
  return NextResponse.json({ ok: true })
}
