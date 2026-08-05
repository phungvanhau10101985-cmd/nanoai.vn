import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 10

/** Stub: Vision warehouse reindex removed — answer fast for leftover crons. */
function gone() {
  return NextResponse.json(
    {
      ok: false,
      removed: true,
      error: 'Vision warehouse reindex has been removed. Disable this crontab entry.',
    },
    { status: 410 }
  )
}

export async function GET() {
  return gone()
}

export async function POST() {
  return gone()
}
