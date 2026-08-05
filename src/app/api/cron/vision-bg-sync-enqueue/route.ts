import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 10

/** Stub: Vision background enqueue removed — answer fast for leftover crons. */
function gone() {
  return NextResponse.json(
    {
      ok: false,
      removed: true,
      error: 'Vision bg-sync enqueue has been removed. Disable this crontab entry.',
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
