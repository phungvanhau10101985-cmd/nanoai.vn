import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 5

function gone() {
  return NextResponse.json(
    {
      error: 'Anonymous embed chat API has been removed. Use hosted chat /messaging/p/{slug} with NanoAI login.',
      code: 'ANON_EMBED_REMOVED',
    },
    { status: 410 }
  )
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { Allow: 'POST, OPTIONS' } })
}

export async function POST() {
  return gone()
}
