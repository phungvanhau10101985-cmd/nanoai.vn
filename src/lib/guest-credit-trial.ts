import { createHash, randomUUID } from 'crypto'
import { cookies, headers } from 'next/headers'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'

export const GUEST_CREDIT_TRIAL_BUDGET_CREDITS = 3
export const GUEST_CREDIT_TRIAL_FINGERPRINT_BUDGET_CREDITS = 3
export const GUEST_CREDIT_TRIAL_IP_DAILY_BUDGET_CREDITS = 12
// Keep fingerprint lock effectively permanent so incognito/new browser
// on the same machine cannot repeatedly reclaim trial credits.
export const GUEST_CREDIT_TRIAL_FINGERPRINT_WINDOW_DAYS = 36500
const GUEST_TRIAL_ID_COOKIE = 'nano_guest_trial_id'
const GUEST_TRIAL_USER_ID_COOKIE = 'nano_guest_trial_user_id'
const GUEST_TRIAL_USED_CREDITS_COOKIE = 'nano_guest_trial_used_credits'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180

function safeCookieStore() {
  try {
    return cookies()
  } catch {
    return null
  }
}

function parseUsed(raw: string | undefined): number {
  const n = Number(raw ?? '0')
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.max(0, n)
}

function setCookie(name: string, value: string): void {
  const store = safeCookieStore()
  if (!store) return
  try {
    const writable = store as unknown as {
      set?: (name: string, value: string, options: Record<string, unknown>) => void
    }
    if (typeof writable.set !== 'function') return
    writable.set(name, value, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: COOKIE_MAX_AGE_SECONDS,
    })
  } catch {
    // Server Components may expose read-only cookies(). Skip write and keep flow non-blocking.
  }
}

function clearCookie(name: string): void {
  const store = safeCookieStore()
  if (!store) return
  try {
    const writable = store as unknown as {
      set?: (name: string, value: string, options: Record<string, unknown>) => void
    }
    if (typeof writable.set !== 'function') return
    writable.set(name, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    })
  } catch {
    // Server Components may expose read-only cookies(). Skip write and keep flow non-blocking.
  }
}

export function getGuestCreditTrialUsedCount(): number {
  const store = safeCookieStore()
  if (!store) return 0
  return parseUsed(store.get(GUEST_TRIAL_USED_CREDITS_COOKIE)?.value)
}

function setGuestCreditTrialUsedCredits(value: number): void {
  const safe = Math.max(0, value)
  setCookie(GUEST_TRIAL_USED_CREDITS_COOKIE, String(safe))
}

function hashRaw(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function readHeader(name: string): string {
  try {
    return headers().get(name)?.trim() || ''
  } catch {
    return ''
  }
}

function getClientIpRaw(): string {
  const forwarded = readHeader('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || ''
  return readHeader('x-real-ip') || readHeader('cf-connecting-ip') || '0.0.0.0'
}

function getFingerprintRaw(): string {
  const ua = readHeader('user-agent') || 'na'
  const lang = readHeader('accept-language') || 'na'
  const secChUa = readHeader('sec-ch-ua') || 'na'
  const secChUaFullVersionList = readHeader('sec-ch-ua-full-version-list') || 'na'
  const secChUaArch = readHeader('sec-ch-ua-arch') || 'na'
  const secChUaBitness = readHeader('sec-ch-ua-bitness') || 'na'
  const secChUaModel = readHeader('sec-ch-ua-model') || 'na'
  const secPlatform = readHeader('sec-ch-ua-platform') || 'na'
  const secPlatformVersion = readHeader('sec-ch-ua-platform-version') || 'na'
  const secMobile = readHeader('sec-ch-ua-mobile') || 'na'
  const acceptEncoding = readHeader('accept-encoding') || 'na'
  const accept = readHeader('accept') || 'na'
  return [
    `ua=${ua}`,
    `lang=${lang}`,
    `sec_ch_ua=${secChUa}`,
    `sec_ch_ua_full_version_list=${secChUaFullVersionList}`,
    `sec_ch_ua_arch=${secChUaArch}`,
    `sec_ch_ua_bitness=${secChUaBitness}`,
    `sec_ch_ua_model=${secChUaModel}`,
    `sec_platform=${secPlatform}`,
    `sec_platform_version=${secPlatformVersion}`,
    `sec_mobile=${secMobile}`,
    `accept_encoding=${acceptEncoding}`,
    `accept=${accept}`,
  ].join('|')
}

function getHashedClientSignals(): { fingerprintHash: string; ipHash: string } {
  return {
    fingerprintHash: hashRaw(getFingerprintRaw()),
    ipHash: hashRaw(getClientIpRaw()),
  }
}

async function readGuestTrialStatsFromDb(input: {
  trialId: string
  fingerprintHash: string
  ipHash: string
}): Promise<{
  sessionUsed: number
  fingerprintUsed: number
  ipDailyUsed: number
} | null> {
  if (!isPgConfigured()) return null
  const pool = getPgPool()
  try {
    const [sessionRes, fpRes, ipRes] = await Promise.all([
      pool.query<{ used_credits: string | number | null }>(
        `select used_credits
         from public.guest_credit_trial_sessions
         where trial_id = $1::text
         limit 1`,
        [input.trialId]
      ),
      pool.query<{ used: string | number | null }>(
        `select coalesce(sum(amount), 0)::numeric as used
         from public.guest_credit_trial_events
         where fingerprint_hash = $1::text
           and created_at >= (now() - make_interval(days => $2::int))`,
        [input.fingerprintHash, GUEST_CREDIT_TRIAL_FINGERPRINT_WINDOW_DAYS]
      ),
      pool.query<{ used: string | number | null }>(
        `select coalesce(sum(amount), 0)::numeric as used
         from public.guest_credit_trial_events
         where ip_hash = $1::text
           and created_at >= date_trunc('day', now())`,
        [input.ipHash]
      ),
    ])
    const sessionUsed = Number(sessionRes.rows[0]?.used_credits ?? 0)
    const fingerprintUsed = Number(fpRes.rows[0]?.used ?? 0)
    const ipDailyUsed = Number(ipRes.rows[0]?.used ?? 0)
    return {
      sessionUsed: Number.isFinite(sessionUsed) ? sessionUsed : 0,
      fingerprintUsed: Number.isFinite(fingerprintUsed) ? fingerprintUsed : 0,
      ipDailyUsed: Number.isFinite(ipDailyUsed) ? ipDailyUsed : 0,
    }
  } catch {
    return null
  }
}

function computeRemainingCredits(stats: {
  sessionUsed: number
  fingerprintUsed: number
  ipDailyUsed: number
}): number {
  const bySession = GUEST_CREDIT_TRIAL_BUDGET_CREDITS - stats.sessionUsed
  const byFingerprint = GUEST_CREDIT_TRIAL_FINGERPRINT_BUDGET_CREDITS - stats.fingerprintUsed
  const byIp = GUEST_CREDIT_TRIAL_IP_DAILY_BUDGET_CREDITS - stats.ipDailyUsed
  return Math.max(0, Math.min(bySession, byFingerprint, byIp))
}

export async function getGuestCreditTrialRemainingCount(): Promise<number> {
  const trialId = getOrCreateGuestTrialId()
  const { fingerprintHash, ipHash } = getHashedClientSignals()
  const stats = await readGuestTrialStatsFromDb({ trialId, fingerprintHash, ipHash })
  if (!stats) {
    return Math.max(0, GUEST_CREDIT_TRIAL_BUDGET_CREDITS - getGuestCreditTrialUsedCount())
  }
  const remaining = computeRemainingCredits(stats)
  setGuestCreditTrialUsedCredits(GUEST_CREDIT_TRIAL_BUDGET_CREDITS - remaining)
  return remaining
}

export async function canGuestUseCreditTrial(): Promise<boolean> {
  const remaining = await getGuestCreditTrialRemainingCount()
  return remaining > 0
}

export async function consumeGuestCreditTrialUse(input: {
  amount: number
  eventKey?: string
}): Promise<{ ok: boolean; alreadyApplied: boolean; remaining: number; error?: string }> {
  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    const remainingNoop = await getGuestCreditTrialRemainingCount()
    return { ok: true, alreadyApplied: false, remaining: remainingNoop }
  }
  const trialId = getOrCreateGuestTrialId()
  const { fingerprintHash, ipHash } = getHashedClientSignals()

  if (!isPgConfigured()) {
    const used = getGuestCreditTrialUsedCount()
    const remaining = Math.max(0, GUEST_CREDIT_TRIAL_BUDGET_CREDITS - used)
    if (remaining + 1e-9 < amount) {
      return { ok: false, alreadyApplied: false, remaining, error: 'trial_exhausted' }
    }
    const nextUsed = used + amount
    setGuestCreditTrialUsedCredits(nextUsed)
    return {
      ok: true,
      alreadyApplied: false,
      remaining: Math.max(0, GUEST_CREDIT_TRIAL_BUDGET_CREDITS - nextUsed),
    }
  }

  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    if (input.eventKey) {
      const exists = await client.query<{ amount: string | number | null }>(
        `select amount
         from public.guest_credit_trial_events
         where event_key = $1::text
         limit 1`,
        [input.eventKey]
      )
      if (exists.rows.length > 0) {
        const statsExisting = await readGuestTrialStatsFromDb({ trialId, fingerprintHash, ipHash })
        const remainingExisting = statsExisting
          ? computeRemainingCredits(statsExisting)
          : Math.max(0, GUEST_CREDIT_TRIAL_BUDGET_CREDITS - getGuestCreditTrialUsedCount())
        await client.query('COMMIT')
        return { ok: true, alreadyApplied: true, remaining: remainingExisting }
      }
    }

    await client.query(
      `insert into public.guest_credit_trial_sessions
       (trial_id, fingerprint_hash, ip_hash, used_credits, created_at, updated_at, last_seen_at)
       values ($1::text, $2::text, $3::text, 0, now(), now(), now())
       on conflict (trial_id) do update set
         fingerprint_hash = excluded.fingerprint_hash,
         ip_hash = excluded.ip_hash,
         updated_at = now(),
         last_seen_at = now()`,
      [trialId, fingerprintHash, ipHash]
    )

    const statsSession = await client.query<{ used_credits: string | number | null }>(
      `select used_credits
       from public.guest_credit_trial_sessions
       where trial_id = $1::text
       limit 1
       for update`,
      [trialId]
    )
    const statsFp = await client.query<{ used: string | number | null }>(
      `select coalesce(sum(amount), 0)::numeric as used
       from public.guest_credit_trial_events
       where fingerprint_hash = $1::text
         and created_at >= (now() - make_interval(days => $2::int))`,
      [fingerprintHash, GUEST_CREDIT_TRIAL_FINGERPRINT_WINDOW_DAYS]
    )
    const statsIp = await client.query<{ used: string | number | null }>(
      `select coalesce(sum(amount), 0)::numeric as used
       from public.guest_credit_trial_events
       where ip_hash = $1::text
         and created_at >= date_trunc('day', now())`,
      [ipHash]
    )

    const sessionUsed = Number(statsSession.rows[0]?.used_credits ?? 0)
    const fingerprintUsed = Number(statsFp.rows[0]?.used ?? 0)
    const ipDailyUsed = Number(statsIp.rows[0]?.used ?? 0)
    const remaining = computeRemainingCredits({
      sessionUsed: Number.isFinite(sessionUsed) ? sessionUsed : 0,
      fingerprintUsed: Number.isFinite(fingerprintUsed) ? fingerprintUsed : 0,
      ipDailyUsed: Number.isFinite(ipDailyUsed) ? ipDailyUsed : 0,
    })

    if (remaining + 1e-9 < amount) {
      await client.query('ROLLBACK')
      setGuestCreditTrialUsedCredits(GUEST_CREDIT_TRIAL_BUDGET_CREDITS - remaining)
      return { ok: false, alreadyApplied: false, remaining, error: 'trial_exhausted' }
    }

    await client.query(
      `update public.guest_credit_trial_sessions
       set used_credits = used_credits + $2::numeric, updated_at = now(), last_seen_at = now()
       where trial_id = $1::text`,
      [trialId, amount]
    )

    await client.query(
      `insert into public.guest_credit_trial_events
       (trial_id, fingerprint_hash, ip_hash, amount, event_key, created_at)
       values ($1::text, $2::text, $3::text, $4::numeric, $5::text, now())`,
      [trialId, fingerprintHash, ipHash, amount, input.eventKey ?? null]
    )

    await client.query('COMMIT')
    const remainingAfter = Math.max(0, remaining - amount)
    setGuestCreditTrialUsedCredits(GUEST_CREDIT_TRIAL_BUDGET_CREDITS - remainingAfter)
    return { ok: true, alreadyApplied: false, remaining: remainingAfter }
  } catch {
    try {
      await client.query('ROLLBACK')
    } catch {
      // ignore rollback errors
    }
    return { ok: false, alreadyApplied: false, remaining: 0, error: 'trial_error' }
  } finally {
    client.release()
  }
}

export function getOrCreateGuestTrialId(): string {
  const store = safeCookieStore()
  const existing = store?.get(GUEST_TRIAL_ID_COOKIE)?.value?.trim()
  if (existing) return existing
  const id = randomUUID()
  setCookie(GUEST_TRIAL_ID_COOKIE, id)
  return id
}

export function getGuestTrialIdFromCookie(): string | null {
  const store = safeCookieStore()
  const raw = store?.get(GUEST_TRIAL_ID_COOKIE)?.value?.trim() ?? ''
  return raw || null
}

export function getGuestTrialUserIdFromCookie(): string | null {
  const store = safeCookieStore()
  const raw = store?.get(GUEST_TRIAL_USER_ID_COOKIE)?.value?.trim() ?? ''
  return raw || null
}

export function setGuestTrialUserIdCookie(userId: string): void {
  if (!userId) return
  setCookie(GUEST_TRIAL_USER_ID_COOKIE, userId)
}

export function clearGuestTrialUserIdCookie(): void {
  clearCookie(GUEST_TRIAL_USER_ID_COOKIE)
}

export function isGuestTrialUserId(userId: string): boolean {
  if (!userId) return false
  const cookieUserId = getGuestTrialUserIdFromCookie()
  return cookieUserId === userId
}

export async function isGuestTrialUser(userId: string): Promise<boolean> {
  if (!userId) return false
  if (isGuestTrialUserId(userId)) return true
  if (!isPgConfigured()) return false
  try {
    const row = await pgQueryOne<{ is_guest: boolean }>(
      `select lower(coalesce(email, '')) like 'guest-trial-%@guest.nanoai.local' as is_guest
       from auth.users
       where id = $1::uuid
       limit 1`,
      [userId]
    )
    return Boolean(row?.is_guest)
  } catch {
    return false
  }
}

export function buildGuestTrialEmail(guestTrialId: string): string {
  const normalized = guestTrialId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  return `guest-trial-${normalized}@guest.nanoai.local`
}
