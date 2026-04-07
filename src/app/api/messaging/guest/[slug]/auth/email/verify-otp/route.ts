import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { isReservedMessagingGuestSlug } from '@/lib/messaging/reserved-guest-slugs'
import { readGuestSessionIdFromRequest } from '@/lib/messaging/guest-auth-session'
import { writeGuestAccountCookie } from '@/lib/messaging/guest-account-session'
import { mergeGuestSessionConversationToAccount } from '@/lib/messaging/guest-account-merge'
import {
  getClientIpFromRequest,
  getRateLimitRetryAfterSec,
  isRateLimited,
} from '@/lib/api/simple-ip-rate-limit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
const VERIFY_RATE_MAX = Math.max(5, parseInt(process.env.GUEST_AUTH_EMAIL_VERIFY_RATE_LIMIT_MAX || '20', 10) || 20)
const VERIFY_RATE_WINDOW_MS = Math.max(
  10_000,
  parseInt(process.env.GUEST_AUTH_EMAIL_VERIFY_RATE_LIMIT_WINDOW_MS || '600000', 10) || 600_000
)

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}
function sha256(v: string) {
  return crypto.createHash('sha256').update(v).digest('hex')
}

async function resolvePartner(slug: string) {
  if (isReservedMessagingGuestSlug(slug)) return { error: 'not_found' as const }
  const db = createServiceRoleClient()
  const { data: partner, error } = await db
    .from('messaging_partners')
    .select('id, is_active')
    .eq('slug', slug)
    .maybeSingle()
  if (error || !partner?.is_active) return { error: 'not_found' as const }
  return { db, partnerId: partner.id }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const p = await resolvePartner(slug)
  if ('error' in p) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { db, partnerId } = p

  const sessionId = readGuestSessionIdFromRequest(request)
  if (!sessionId) return NextResponse.json({ error: 'Missing session' }, { status: 400 })

  const body = (await request.json().catch(() => null)) as { email?: string; otp?: string } | null
  const email = normalizeEmail(body?.email ?? '')
  const otp = String(body?.otp ?? '').trim()
  if (!email || !otp) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })

  const ip = getClientIpFromRequest(request)
  const rlKey = `guest-auth-email-verify-otp:${partnerId}:${ip}:${email}`
  if (isRateLimited(rlKey, VERIFY_RATE_MAX, VERIFY_RATE_WINDOW_MS)) {
    const retry = getRateLimitRetryAfterSec(rlKey)
    return NextResponse.json(
      { error: 'Too many requests. Try again later.', retry_after_sec: retry },
      { status: 429, headers: { 'Retry-After': String(retry) } }
    )
  }

  const nowIso = new Date().toISOString()
  const { data: challenge } = await db
    .from('messaging_guest_email_challenges')
    .select('id, code_hash, expires_at, attempt_count, consumed_at')
    .eq('partner_id', partnerId)
    .eq('email_normalized', email)
    .eq('session_id', sessionId)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!challenge?.id) return NextResponse.json({ error: 'OTP_INVALID' }, { status: 400 })
  if (challenge.expires_at < nowIso) return NextResponse.json({ error: 'OTP_INVALID' }, { status: 400 })
  if ((challenge.attempt_count ?? 0) >= 5) return NextResponse.json({ error: 'OTP_INVALID' }, { status: 400 })

  const hash = sha256(`otp:${partnerId}:${email}:${otp}`)
  if (hash !== challenge.code_hash) {
    await db
      .from('messaging_guest_email_challenges')
      .update({ attempt_count: (challenge.attempt_count ?? 0) + 1 })
      .eq('id', challenge.id)
    return NextResponse.json({ error: 'OTP_INVALID' }, { status: 400 })
  }

  await db.from('messaging_guest_email_challenges').update({ consumed_at: nowIso }).eq('id', challenge.id)

  const { data: existingAccount } = await db
    .from('messaging_guest_accounts')
    .select('id')
    .eq('partner_id', partnerId)
    .eq('email_normalized', email)
    .maybeSingle()
  let accountId = existingAccount?.id as string | undefined
  if (!accountId) {
    const { data: created } = await db
      .from('messaging_guest_accounts')
      .insert({
        partner_id: partnerId,
        email_raw: email,
        email_normalized: email,
        first_verified_at: nowIso,
        last_login_at: nowIso,
      })
      .select('id')
      .single()
    accountId = created?.id
  } else {
    await db
      .from('messaging_guest_accounts')
      .update({ last_login_at: nowIso })
      .eq('id', accountId)
  }
  if (!accountId) return NextResponse.json({ error: 'Account failed' }, { status: 500 })

  await db
    .from('messaging_guest_identities')
    .upsert(
      {
        partner_id: partnerId,
        guest_account_id: accountId,
        provider: 'email_otp',
        provider_subject: email,
      },
      { onConflict: 'partner_id,provider,provider_subject' }
    )

  await mergeGuestSessionConversationToAccount(db, partnerId, sessionId, accountId)

  const res = NextResponse.json({ ok: true, accountId })
  writeGuestAccountCookie(res, request, accountId)
  return res
}
