import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type InsertNotificationInput = {
  user_id: string
  type: string
  title: string
  body: string
  meta?: Record<string, unknown>
}

export type NotificationRow = {
  id: string
  type: string
  title: string
  body: string
  read_at: string | null
  created_at: string
  meta: Record<string, unknown>
}

export async function insertNotificationPg(input: InsertNotificationInput): Promise<{ ok: boolean; error?: string }> {
  if (!isPgConfigured()) return { ok: false, error: 'database_not_configured' }
  try {
    const pool = getPgPool()
    const result = await pool.query(
      `insert into public.notifications (user_id, type, title, body, meta)
       values ($1::uuid, $2, $3, $4, $5::jsonb)
       on conflict do nothing`,
      [
        input.user_id,
        input.type,
        input.title,
        input.body,
        JSON.stringify(input.meta ?? {}),
      ]
    )
    return result.rowCount === 1
      ? { ok: true }
      : { ok: false, error: 'duplicate_notification' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}

export async function listNotificationsForUser(
  userId: string,
  opts: { limit: number; unreadOnly: boolean }
): Promise<NotificationRow[]> {
  const lim = Math.min(50, Math.max(1, opts.limit))
  if (!isPgConfigured()) {
    console.warn('[listNotificationsForUser] DATABASE_URL not set')
    return []
  }
  if (opts.unreadOnly) {
    return pgQuery<NotificationRow>(
      `select id::text, type, title, body, read_at::text, created_at::text, coalesce(meta, '{}'::jsonb) as meta
       from public.notifications
       where user_id = $1::uuid and read_at is null
       order by created_at desc
       limit $2`,
      [userId, lim]
    )
  }
  return pgQuery<NotificationRow>(
    `select id::text, type, title, body, read_at::text, created_at::text, coalesce(meta, '{}'::jsonb) as meta
     from public.notifications
     where user_id = $1::uuid
     order by created_at desc
     limit $2`,
    [userId, lim]
  )
}

export async function markNotificationReadForUser(notificationId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isPgConfigured()) {
    return { ok: false, error: 'database_not_configured' }
  }
  try {
    const pool = getPgPool()
    await pool.query('update public.notifications set read_at = now() where id = $1::uuid and user_id = $2::uuid', [
      notificationId,
      userId,
    ])
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function markAllNotificationsReadForUser(userId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isPgConfigured()) {
    return { ok: false, error: 'database_not_configured' }
  }
  try {
    const pool = getPgPool()
    await pool.query('update public.notifications set read_at = now() where user_id = $1::uuid and read_at is null', [
      userId,
    ])
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function countUnreadNotificationsForUser(userId: string): Promise<number> {
  if (!isPgConfigured()) return 0
  const row = await pgQueryOne<{ c: string }>(
    `select count(*)::text as c from public.notifications where user_id = $1::uuid and read_at is null`,
    [userId]
  )
  const n = Number(row?.c ?? 0)
  return Number.isFinite(n) ? n : 0
}

export async function hasRecentUserNotificationFromPg(input: {
  userId: string
  type: string
  metaKey: string
  metaValue: string
  withinMinutes: number
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const minutes = Math.max(1, Math.min(24 * 60, Math.floor(input.withinMinutes) || 20))
  const key = input.metaKey.trim().slice(0, 80)
  const value = input.metaValue.trim()
  if (!key || !value) return false
  try {
    const row = await pgQueryOne<{ id: string }>(
      `select id::text
       from public.notifications
       where user_id = $1::uuid
         and type = $2
         and created_at > now() - ($3::int * interval '1 minute')
         and coalesce(meta->>$4, '') = $5
       limit 1`,
      [input.userId, input.type, minutes, key, value]
    )
    return Boolean(row?.id)
  } catch (e) {
    console.warn('[hasRecentUserNotificationFromPg]', e)
    return false
  }
}
