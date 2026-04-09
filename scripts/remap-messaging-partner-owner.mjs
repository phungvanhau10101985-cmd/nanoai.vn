#!/usr/bin/env node
/**
 * Gán lại owner_user_id cho messaging_partners sau migrate / lệch UUID auth.users.
 *
 * JWT đăng nhập (sub) = id trong auth.users. Dashboard chỉ list partner có owner_user_id = sub.
 *
 * Ví dụ:
 *   node scripts/remap-messaging-partner-owner.mjs --email=a@b.com --slug=my-shop
 *   node scripts/remap-messaging-partner-owner.mjs --email=a@b.com --from-owner=OLD_UUID --apply
 *
 * Mặc định dry-run (không ghi DB). Thêm --apply để thực hiện UPDATE.
 */
import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { pgQuery, pgEnd } from './pg-query.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')

function loadEnvLocal() {
  if (!existsSync(envPath)) {
    console.error('Không tìm thấy .env.local')
    process.exit(1)
  }
  const envContent = readFileSync(envPath, 'utf8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const k = trimmed.slice(0, eq).trim()
    let v = trimmed.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (!process.env[k]) process.env[k] = v
  }
}

function parseArgs() {
  const out = { apply: false, email: '', slug: '', fromOwner: '' }
  for (const a of process.argv.slice(2)) {
    if (a === '--apply') out.apply = true
    else if (a.startsWith('--email=')) out.email = a.slice('--email='.length).trim().toLowerCase()
    else if (a.startsWith('--slug=')) out.slug = a.slice('--slug='.length).trim()
    else if (a.startsWith('--from-owner=')) out.fromOwner = a.slice('--from-owner='.length).trim()
  }
  return out
}

function isUuid(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
}

async function main() {
  loadEnvLocal()
  if (!process.env.DATABASE_URL?.trim()) {
    console.error('Thiếu DATABASE_URL')
    process.exit(1)
  }

  const { apply, email, slug, fromOwner } = parseArgs()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Bắt buộc: --email=user@domain.com')
    console.error('Kèm một trong: --slug=... hoặc --from-owner=UUID-cũ')
    process.exit(1)
  }

  if (!slug && !fromOwner) {
    console.error('Cần --slug=... (một shop) hoặc --from-owner=UUID (mọi shop của owner cũ)')
    process.exit(1)
  }

  if (fromOwner && !isUuid(fromOwner)) {
    console.error('--from-owner phải là UUID hợp lệ')
    process.exit(1)
  }

  const users = await pgQuery(
    `select id::text, email from auth.users where lower(email) = $1 limit 2`,
    [email]
  )
  if (users.length === 0) {
    console.error(`Không có auth.users với email: ${email} (user phải đăng nhập ít nhất một lần sau migrate để có dòng auth).`)
    process.exit(1)
  }
  if (users.length > 1) {
    console.warn('Cảnh báo: nhiều hơn một auth.users cùng email — dùng bản ghi đầu tiên.')
  }
  const newOwnerId = users[0].id
  console.log(`auth.users id (owner mới): ${newOwnerId}  email: ${users[0].email}`)

  let targets = []
  if (slug) {
    const rows = await pgQuery(
      `select id::text, slug, owner_user_id::text
       from public.messaging_partners where slug = $1`,
      [slug]
    )
    if (rows.length === 0) {
      console.error(`Không có messaging_partners.slug = ${slug}`)
      process.exit(1)
    }
    targets = rows
  } else {
    targets = await pgQuery(
      `select id::text, slug, owner_user_id::text
       from public.messaging_partners where owner_user_id = $1::uuid`,
      [fromOwner]
    )
    if (targets.length === 0) {
      console.error(`Không có partner nào với owner_user_id = ${fromOwner}`)
      process.exit(1)
    }
  }

  for (const t of targets) {
    const same = String(t.owner_user_id) === String(newOwnerId)
    console.log(`- ${t.slug}  owner=${t.owner_user_id}  ${same ? '(đã đúng)' : '→ sẽ đổi thành ' + newOwnerId}`)
  }

  const needUpdate = targets.filter((t) => String(t.owner_user_id) !== String(newOwnerId))
  if (needUpdate.length === 0) {
    console.log('Không cần UPDATE.')
    await pgEnd()
    return
  }

  if (!apply) {
    console.log('\nDry-run. Chạy lại với --apply để ghi DB.')
    await pgEnd()
    return
  }

  const ids = needUpdate.map((t) => t.id)
  await pgQuery(
    `update public.messaging_partners
     set owner_user_id = $1::uuid, updated_at = now()
     where id = any($2::uuid[])`,
    [newOwnerId, ids]
  )
  console.log(`Đã cập nhật ${ids.length} dòng.`)
  await pgEnd()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
