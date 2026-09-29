import { NextResponse } from 'next/server'
import { AI_CATALOG_DATA } from '@/lib/agent/ai-catalog-data'

export const dynamic = 'force-static'

export function GET() {
  return NextResponse.json(AI_CATALOG_DATA, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
