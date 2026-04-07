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

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const p = await resolvePartner(slug)
  if ('error' in p) return NextResponse.redirect(new URL(`/messaging/p/${encodeURIComponent(slug)}?auth=failed`, request.url))
  const { db, partnerId } = p

  const email = String(request.nextUrl.searchParams.get('email') ?? '').trim().toLowerCase()
  const token = String(request.nextUrl.searchParams.get('token') ?? '').trim()
  const sessionId = readGuestSessionIdFromRequest(request)
  if (!email || !token || !sessionId) {
    return NextResponse.redirect(new URL(`/messaging/p/${encodeURIComponent(slug)}?auth=failed`, request.url))
  }

  const ip = getClientIpFromRequest(request)
  const rlKey = `guest-auth-email-verify-magic:${partnerId}:${ip}:${email}`
  if (isRateLimited(rlKey, VERIFY_RATE_MAX, VERIFY_RATE_WINDOW_MS)) {
    const retry = getRateLimitRetryAfterSec(rlKey)
    return NextResponse.json(
      { error: 'Too many requests. Try again later.', retry_after_sec: retry },
      { status: 429, headers: { 'Retry-After': String(retry) } }
    )
  }

  const hash = sha256(`magic:${partnerId}:${email}:${token}`)
  const nowIso = new Date().toISOString()
  const { data: row } = await db
    .from('messaging_guest_email_challenges')
    .select('id, expires_at, consumed_at')
    .eq('partner_id', partnerId)
    .eq('email_normalized', email)
    .eq('session_id', sessionId)
    .eq('magic_token_hash', hash)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!row?.id || row.expires_at < nowIso) {
    return NextResponse.redirect(new URL(`/messaging/p/${encodeURIComponent(slug)}?auth=failed`, request.url))
  }

  await db.from('messaging_guest_email_challenges').update({ consumed_at: nowIso }).eq('id', row.id)

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
  if (!accountId) {
    return NextResponse.redirect(new URL(`/messaging/p/${encodeURIComponent(slug)}?auth=failed`, request.url))
  }

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

  const redirectUrl = new URL(`/messaging/p/${encodeURIComponent(slug)}?auth=ok`, request.url)
  const res = NextResponse.redirect(redirectUrl)
  writeGuestAccountCookie(res, request, accountId)
  return res
}
