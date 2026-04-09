/**
 * Postgres cho script .mjs (không import được TS từ src/lib/db/pg-query.ts).
 * Yêu cầu: process.env.DATABASE_URL (ví dụ từ .env.local).
 */
import { Pool } from 'pg'

let pool = null

function getPool() {
  const dsn = process.env.DATABASE_URL?.trim()
  if (!dsn) {
    throw new Error('DATABASE_URL is not set')
  }
  if (!pool) {
    pool = new Pool({ connectionString: dsn, max: 12, idleTimeoutMillis: 30_000 })
  }
  return pool
}

/** Trả về mảng rows (giống pattern app). */
export async function pgQuery(text, params) {
  const res = await getPool().query(text, params ?? [])
  return res.rows
}

/** Trả về QueryResult đầy đủ (insert batch, catch mã lỗi PostgreSQL). */
export async function pgQueryRaw(text, params) {
  return getPool().query(text, params ?? [])
}

export async function pgEnd() {
  if (pool) {
    await pool.end()
    pool = null
  }
}
