import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, _ctx: { params: { code: string } }) {
  return NextResponse.json({ error: 'screen-live-disabled' }, { status: 410 })
}

export async function POST(_req: NextRequest, _ctx: { params: { code: string } }) {
  return NextResponse.json({ error: 'screen-live-disabled' }, { status: 410 })
}
