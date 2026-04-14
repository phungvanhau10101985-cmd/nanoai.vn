#!/usr/bin/env node
/**
 * Cộng credits cho user theo email (local/dev).
 *   node scripts/pg-add-credits-once.mjs --email=x@y.com --amount=1000 --apply
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

async function main() {
  loadEnvLocal()
  const dsn = process.env.DATABASE_URL?.trim()
  if (!dsn) {
    console.error('Thiếu DATABASE_URL')
    process.exit(1)
  }

  const emailArg = process.argv.find((a) => a.startsWith('--email='))
  const amountArg = process.argv.find((a) => a.startsWith('--amount='))
  const email = emailArg ? emailArg.slice('--email='.length).trim().toLowerCase() : ''
  const amount = amountArg ? parseFloat(amountArg.slice('--amount='.length)) : NaN
  const apply = process.argv.includes('--apply')

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Dùng: node scripts/pg-add-credits-once.mjs --email=user@gmail.com --amount=1000 --apply')
    process.exit(1)
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    console.error('amount phải là số dương')
    process.exit(1)
  }

  const pool = new Pool({ connectionString: dsn, max: 1 })
  try {
    const u = await pool.query(`select id::text, email from auth.users where lower(email) = lower($1) limit 2`, [email])
    if (u.rows.length === 0) {
      console.error(`Không có auth.users: ${email} — đăng nhập OTP một lần trước.`)
      process.exit(1)
    }
    const uid = u.rows[0].id
    console.log(`User: ${u.rows[0].email}  id=${uid}`)
    console.log(`Sẽ cộng ${amount} credits.`)

    if (!apply) {
      console.log('Dry-run. Thêm --apply để ghi DB.')
      return
    }

    await pool.query(
      `insert into public.profiles (id, role) values ($1::uuid, 'user')
       on conflict (id) do nothing`,
      [uid]
    )

    const prof = await pool.query(`select role from public.profiles where id = $1::uuid`, [uid])
    console.log(`profiles.role=${prof.rows[0]?.role ?? '?'}`)

    const r = await pool.query(
      `insert into public.credits (user_id, balance) values ($1::uuid, $2::numeric)
       on conflict (user_id) do update set
         balance = public.credits.balance + excluded.balance,
         updated_at = now()
       returning balance::text as balance`,
      [uid, amount]
    )
    console.log(`OK. Số dư mới: ${r.rows[0]?.balance}`)
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
