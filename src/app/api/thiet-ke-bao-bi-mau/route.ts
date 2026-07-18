import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ error: 'Feature removed. Use Hub packaging flow on homepage.' }, { status: 410 })
}
