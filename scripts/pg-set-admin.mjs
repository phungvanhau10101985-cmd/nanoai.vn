#!/usr/bin/env node
/**
 * Gán role admin trong public.profiles theo email đăng nhập (auth.users.email).
 * Chỉ Postgres — khớp với AdminLayout (profiles.role = 'admin').
 *
 * Biến môi trường:
 *   ADMIN_EMAIL   — bắt buộc (trừ khi truyền --email=)
 *   DATABASE_URL  — từ .env.local hoặc env
 *
 *   node scripts/pg-set-admin.mjs
 *   node scripts/pg-set-admin.mjs --email=ban@gmail.com --apply
 */
import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { Pool } from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')

function loadEnvLocal() {
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const k = trimmed.slice(0, eq).trim()
    let v = trimmed.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}

function parseEmail() {
  const arg = process.argv.find((a) => a.startsWith('--email='))
  if (arg) return arg.slice('--email='.length).trim().toLowerCase()
  return (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
}

async function main() {
  loadEnvLocal()
  const dsn = process.env.DATABASE_URL?.trim()
  if (!dsn) {
    console.error('Thiếu DATABASE_URL')
    process.exit(1)
  }

  const email = parseEmail()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Thiếu email: đặt ADMIN_EMAIL trong .env.local hoặc --email=ban@gmail.com')
    process.exit(1)
  }

  const apply = process.argv.includes('--apply')
  const pool = new Pool({ connectionString: dsn, max: 1 })
  try {
    const u = await pool.query(
      `select id::text, email from auth.users where lower(email) = lower($1) limit 2`,
      [email]
    )
    if (u.rows.length === 0) {
      console.error(
        `Không có auth.users với email này: ${email}\n→ Đăng nhập OTP/magic một lần trước, rồi chạy lại script.`
      )
      process.exit(1)
    }
    if (u.rows.length > 1) {
      console.warn('Cảnh báo: nhiều hơn một auth.users cùng email — dùng bản ghi đầu tiên.')
    }
    const uid = u.rows[0].id
    console.log(`User id: ${uid}  email: ${u.rows[0].email}`)

    const prof = await pool.query(`select id::text, role from public.profiles where id = $1::uuid`, [uid])
    if (prof.rows.length === 0) {
      console.log('Chưa có public.profiles — sẽ insert role=admin (cần trigger handle_new_user thường đã tạo profiles).')
    } else {
      console.log(`profiles hiện tại: role=${prof.rows[0].role}`)
    }

    if (!apply) {
      console.log('\nDry-run. Thêm --apply để ghi profiles.role = admin.')
      return
    }

    await pool.query(
      `insert into public.profiles (id, role, updated_at)
       values ($1::uuid, 'admin', now())
       on conflict (id) do update set role = 'admin', updated_at = now()`,
      [uid]
    )
    console.log('Đã đặt profiles.role = admin cho tài khoản này.')
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
