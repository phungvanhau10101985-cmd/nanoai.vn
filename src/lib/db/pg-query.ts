import { getPgPool, isPgConfigured } from '@/lib/db/pool'

/**
 * Lớp truy vấn Postgres trực tiếp (thay cho client HTTP/REST + SDK cũ).
 *
 * Thứ tự migrate gợi ý (toàn dự án — làm dần theo module):
 * 1. Bunny Storage — media mới không qua storage hosted cũ.
 * 2. DATABASE_URL + pool + helpers (file này) + health check.
 * 3. pg_dump / pg_restore schema + data `public` từ host cũ → Postgres đích.
 * 4. Auth: middleware + cookie + provider (JWT/session) phù hợp.
 * 5. Thay từng nhóm truy vấn qua HTTP client cũ bằng `pgQuery` / ORM (ưu tiên: credits, profiles, feature ít phụ thuộc).
 */

export async function pgQuery<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const pool = getPgPool()
  const res = await pool.query(text, params)
  return res.rows as T[]
}

export async function pgQueryOne<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await pgQuery<T>(text, params)
  return rows[0] ?? null
}

export async function checkPgConnection(): Promise<{ ok: boolean; error?: string }> {
  if (!isPgConfigured()) {
    return { ok: false, error: 'DATABASE_URL not set' }
  }
  try {
    const pool = getPgPool()
    await pool.query('select 1 as ok')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
