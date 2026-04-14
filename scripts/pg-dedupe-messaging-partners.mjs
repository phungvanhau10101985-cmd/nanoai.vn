#!/usr/bin/env node
/**
 * Trên server: chỉ giữ **đúng 2 shop** messaging (bảng `messaging_partners`):
 *   - một shop **188.com.vn** (nhận diện theo slug/display_name chứa 188),
 *   - một shop **NanoAI** (ưu tiên id seed `11111111-...`, slug `nanoai`, hoặc tên bắt đầu NanoAI).
 *
 * Mọi partner khác bị **xóa** (kèm hội thoại `customer_care_conversations` của partner đó — bắt buộc vì FK không CASCADE).
 *
 * Yêu cầu: `DATABASE_URL` (`.env.local` hoặc biến môi trường). Nên dùng user Postgres có quyền xóa (thường connection trực tiếp, không phải role RLS hạn chế).
 *
 * Chạy:
 *   node scripts/pg-dedupe-messaging-partners.mjs              # dry-run: chỉ in ra
 *   node scripts/pg-dedupe-messaging-partners.mjs --apply      # xóa thật
 *
 * Ghi đè id giữ lại (khuyến nghị sau khi xem dry-run):
 *   node scripts/pg-dedupe-messaging-partners.mjs --apply --keep-188=<uuid> --keep-nano=<uuid>
 */
import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { Pool } from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')

const SEED_NANOAI_ID = '11111111-1111-1111-1111-111111111111'

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

function argUuid(prefix) {
  const a = process.argv.find((x) => x.startsWith(prefix))
  if (!a) return null
  const v = a.slice(prefix.length).trim()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null
}

async function main() {
  loadEnvLocal()
  const dsn = process.env.DATABASE_URL?.trim()
  if (!dsn) {
    console.error('Thiếu DATABASE_URL')
    process.exit(1)
  }

  const apply = process.argv.includes('--apply')
  const keep188Arg = argUuid('--keep-188=')
  const keepNanoArg = argUuid('--keep-nano=')

  const pool = new Pool({ connectionString: dsn, max: 1 })
  try {
    const { rows: all } = await pool.query(
      `select id::text, slug, display_name, brand_name, created_at::text
       from public.messaging_partners
       order by created_at asc`
    )

    console.log(`Tổng partner hiện có: ${all.length}`)
    for (const r of all) {
      console.log(`  ${r.id}  slug=${JSON.stringify(r.slug)}  display_name=${JSON.stringify(r.display_name)}`)
    }

    let keep188 = keep188Arg
    let keepNano = keepNanoArg

    if (!keep188) {
      const q188 = await pool.query(
        `select id::text from public.messaging_partners
         where lower(slug) like '%188%' or lower(coalesce(display_name,'')) like '%188.com.vn%'
         order by created_at asc
         limit 1`
      )
      keep188 = q188.rows[0]?.id ?? null
    }

    if (!keepNano) {
      const qNano = await pool.query(
        `select id::text from public.messaging_partners
         where id <> $1::uuid
           and (
             id = $2::uuid
             or lower(slug) = 'nanoai'
             or lower(slug) like 'nanoai-%'
             or lower(coalesce(display_name,'')) like 'nanoai%'
             or lower(coalesce(brand_name,'')) like 'nanoai%'
           )
         order by
           case when id = $2::uuid then 0 else 1 end,
           case when lower(slug) = 'nanoai' then 0 else 1 end,
           created_at asc
         limit 1`,
        [keep188 ?? '00000000-0000-0000-0000-000000000000', SEED_NANOAI_ID]
      )
      keepNano = qNano.rows[0]?.id ?? null
    }

    if (!keep188) {
      console.error('\nKhông tìm thấy shop 188 (slug hoặc display_name chứa 188 / 188.com.vn). Chỉ định --keep-188=<uuid>.')
      process.exit(1)
    }
    if (!keepNano) {
      console.error('\nKhông tìm thấy shop NanoAI. Chỉ định --keep-nano=<uuid>.')
      process.exit(1)
    }
    if (keep188 === keepNano) {
      console.error('\nGiữ lại 188 và NanoAI trùng cùng một id — kiểm tra dữ liệu hoặc truyền uuid rõ ràng.')
      process.exit(1)
    }

    const toDelete = all.map((r) => r.id).filter((id) => id !== keep188 && id !== keepNano)

    console.log('\n--- Giữ lại ---')
    console.log(`  188: ${keep188}`)
    console.log(`  NanoAI: ${keepNano}`)
    console.log(`\n--- Sẽ xóa (${toDelete.length} partner) ---`)
    for (const id of toDelete) {
      const r = all.find((x) => x.id === id)
      console.log(`  ${id}  ${r ? `slug=${JSON.stringify(r.slug)}` : ''}`)
    }

    if (!apply) {
      console.log('\n(Dry-run) Không xóa. Chạy lại với --apply để thực hiện.')
      return
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const conv = await client.query(
        `delete from public.customer_care_conversations where partner_id = any($1::uuid[]) returning id`,
        [toDelete]
      )
      console.log(`\nĐã xóa ${conv.rowCount} hội thoại customer_care (partner sắp xóa).`)

      const del = await client.query(
        `delete from public.messaging_partners where id = any($1::uuid[]) returning id`,
        [toDelete]
      )
      console.log(`Đã xóa ${del.rowCount} dòng messaging_partners.`)

      await client.query('COMMIT')
      console.log('\nHoàn tất (transaction commit).')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
