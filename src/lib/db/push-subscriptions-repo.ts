import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'

export async function upsertPushSubscription(input: {
  userId: string
  endpoint: string
  p256dh: string
  auth: string
  userAgent: string | null
}): Promise<{ ok: boolean; error?: string }> {
  if (!isPgConfigured()) {
    return { ok: false, error: 'database_not_configured' }
  }
  try {
    const pool = getPgPool()
    await pool.query(
      `insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, updated_at)
       values ($1::uuid, $2, $3, $4, $5, now())
       on conflict (user_id, endpoint) do update set
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         user_agent = excluded.user_agent,
         updated_at = now()`,
      [input.userId, input.endpoint, input.p256dh, input.auth, input.userAgent]
    )
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function countPushSubscriptionsForUser(userId: string): Promise<number> {
  if (!isPgConfigured()) return 0
  const row = await pgQueryOne<{ c: string }>(
    `select count(*)::text as c from public.push_subscriptions where user_id = $1::uuid`,
    [userId]
  )
  const n = Number(row?.c ?? 0)
  return Number.isFinite(n) ? n : 0
}

export async function deletePushSubscriptionsForUser(
  userId: string,
  endpoint?: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isPgConfigured()) {
    return { ok: false, error: 'database_not_configured' }
  }
  try {
    const pool = getPgPool()
    if (endpoint?.trim()) {
      await pool.query('delete from public.push_subscriptions where user_id = $1::uuid and endpoint = $2', [
        userId,
        endpoint.trim(),
      ])
    } else {
      await pool.query('delete from public.push_subscriptions where user_id = $1::uuid', [userId])
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
