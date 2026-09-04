import { NextResponse } from 'next/server'

/** Watchdog / nginx — không đụng DB, không đụng shop HTML. */
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 })
}
