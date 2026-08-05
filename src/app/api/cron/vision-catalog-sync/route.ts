import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 10

/**
 * Vision Warehouse catalog sync was removed from this project.
 * Keep a fast stub so leftover VPS crontabs do not hang Nginx/Next
 * waiting on a missing or heavy upstream (was contributing to 504s).
 */
function gone() {
  return NextResponse.json(
    {
      ok: false,
      removed: true,
      error: 'Vision catalog sync has been removed. Disable this crontab entry.',
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
