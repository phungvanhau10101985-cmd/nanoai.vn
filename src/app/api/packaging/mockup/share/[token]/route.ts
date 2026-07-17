import { NextRequest, NextResponse } from 'next/server'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchPackagingMockupShareByTokenPg } from '@/lib/db/packaging-mockup-share-pg'

type RouteContext = { params: { token: string } }

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
    }
    const token = context.params.token?.trim()
    if (!token) {
      return NextResponse.json({ error: 'token required' }, { status: 400 })
    }
    const row = await fetchPackagingMockupShareByTokenPg(token)
    if (!row) {
      return NextResponse.json({ error: 'Share link expired or not found' }, { status: 404 })
    }
    return NextResponse.json({
      dimensionsMm: row.dimensions_mm,
      faceUrls: row.face_urls,
      locale: row.locale,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
