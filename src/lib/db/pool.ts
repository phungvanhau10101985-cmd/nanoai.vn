import { Pool, types } from 'pg'

/** Tránh tạo nhiều Pool khi Next.js hot-reload (mỗi lần reload module = thêm tối đa PG_POOL_MAX kết nối → lỗi «too many clients»). */
const globalForPool = globalThis as unknown as {
  __nanoaiPgPool?: Pool
}

/** Giữ cột Postgres `date` dạng YYYY-MM-DD — không parse thành JS Date (lệch ngày ở UTC+). */
types.setTypeParser(1082, (value: string) => value)

/** True khi đã set `DATABASE_URL` (Postgres trực tiếp, ví dụ VPS hoặc hosted DB). */
export function isPgConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim())
}

/**
 * Pool Postgres dùng cho server (API routes, Server Actions, workers).
 * Chỉ gọi sau khi đã migrate DB và set `DATABASE_URL` trỏ tới instance mới.
 *
 * - `PG_POOL_MAX`: mặc định 10, tối đa 30. Với DB nhỏ / tier giới hạn kết nối, có thể đặt 3–5.
 * - Nên dùng connection pooler (PgBouncer, port «pooler» trên host cloud) nếu deploy serverless nhiều instance.
 */
export function getPgPool(): Pool {
  const url = process.env.DATABASE_URL
  if (!url?.trim()) {
    throw new Error('DATABASE_URL is not set')
  }
  if (!globalForPool.__nanoaiPgPool) {
    const max = Math.min(30, Math.max(2, parseInt(process.env.PG_POOL_MAX || '10', 10) || 10))
    globalForPool.__nanoaiPgPool = new Pool({
      connectionString: url,
      max,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: Math.min(30_000, Math.max(2_000, parseInt(process.env.PG_CONNECT_TIMEOUT_MS || '10000', 10) || 10_000)),
    })
  }
  return globalForPool.__nanoaiPgPool
}
