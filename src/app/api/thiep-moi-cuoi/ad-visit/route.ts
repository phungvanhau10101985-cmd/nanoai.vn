import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { recordWeddingCardAdVisit, weddingAdVisitorKey } from '@/lib/db/wedding-card-ad-visits-pg'
import {
  classifyWeddingAdSource,
  isWeddingTrafficBotUserAgent,
  weddingAdVisitShouldIgnore,
} from '@/lib/wedding/wedding-ad-source'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const COOKIE = 'pw_thiep_vid'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function ignored(): NextResponse {
  return new NextResponse(null, { status: 204 })
}

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0] || ''
  const raw = (forwarded || request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || '').trim()
  return raw.slice(0, 80)
}

export async function POST(request: NextRequest) {
  const site = request.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'same-site') return ignored()
  if (isWeddingTrafficBotUserAgent(request.headers.get('user-agent') || '')) return ignored()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return ignored()
  }
  if (!body || typeof body !== 'object') return ignored()
  const record = body as { cardId?: unknown; search?: unknown; referrer?: unknown }
  const cardId = typeof record.cardId === 'string' ? record.cardId.trim() : ''
  const search = typeof record.search === 'string' ? record.search.slice(0, 2000) : ''
  const referrer = typeof record.referrer === 'string' ? record.referrer.slice(0, 500) : ''
  if (!UUID_RE.test(cardId)) return ignored()
  if (weddingAdVisitShouldIgnore(search)) return ignored()
  const source = classifyWeddingAdSource(search, referrer)
  if (!source) return ignored()

  const existing = request.cookies.get(COOKIE)?.value || ''
  const cookieId = UUID_RE.test(existing) ? existing : randomUUID()
  try {
    await recordWeddingCardAdVisit({
      cardId,
      source,
      visitorKey: weddingAdVisitorKey(cookieId, clientIp(request)),
    })
  } catch {
    return ignored()
  }

  const response = NextResponse.json({ ok: true })
  if (cookieId !== existing) {
    response.cookies.set(COOKIE, cookieId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: 60 * 60 * 24 * 400,
    })
  }
  return response
}
