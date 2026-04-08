import { Pool } from 'pg'

let pool: Pool | null = null

/** True when `DATABASE_URL` is set (Postgres trực tiếp, ví dụ VPS sau khi tách khỏi Supabase hosting). */
export function isPgConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim())
}

/**
 * Pool Postgres dùng cho server (API routes, Server Actions, workers).
 * Chỉ gọi sau khi đã migrate DB và set `DATABASE_URL` trỏ tới instance mới.
 */
export function getPgPool(): Pool {
  const url = process.env.DATABASE_URL
  if (!url?.trim()) {
    throw new Error('DATABASE_URL is not set')
  }
  if (!pool) {
    const max = Math.min(30, Math.max(2, parseInt(process.env.PG_POOL_MAX || '10', 10) || 10))
    pool = new Pool({ connectionString: url, max, idleTimeoutMillis: 30_000 })
  }
  return pool
}
