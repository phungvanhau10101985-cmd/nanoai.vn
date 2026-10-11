import { NextResponse } from 'next/server'
import { getUserOrBypass } from '@/lib/auth'
import { resolveAuthUserEmail } from '@/lib/email/account-notification-email'
import { getClientIpFromRequest, isRateLimited } from '@/lib/api/simple-ip-rate-limit'
import { CUSTOMER_ERROR_LIMITS as L, clipText, type CustomerErrorSource } from '@/lib/errors/customer-error-filter'
import { reportCustomerError } from '@/lib/errors/customer-error-report-pg'

export const dynamic = 'force-dynamic'

const CLIENT_SOURCES: CustomerErrorSource[] = ['toast', 'boundary']

export async function POST(req: Request) {
  const ip = getClientIpFromRequest(req)
  if (isRateLimited(`error-reports:${ip}`, 20, 10 * 60_000)) {
    return NextResponse.json({ ok: false }, { status: 429 })
  }
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  const source = CLIENT_SOURCES.includes(body.source as CustomerErrorSource)
    ? (body.source as CustomerErrorSource)
    : 'toast'
  const message = clipText(body.message, L.message)
  const title = clipText(body.title, L.title)
  if (!message && !title) return NextResponse.json({ ok: false }, { status: 400 })

  const user = await getUserOrBypass().catch(() => null)
  const row = await reportCustomerError({
    source,
    path: clipText(body.path, L.path),
    title,
    message,
    detail: clipText(body.detail, L.detail),
    digest: clipText(body.digest, L.digest),
    userId: user?.id ?? null,
    userEmail: user ? resolveAuthUserEmail(user) : null,
    ip,
    userAgent: req.headers.get('user-agent'),
  })
  return NextResponse.json({ ok: true, id: row?.id ?? null })
}
