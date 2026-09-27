/**
 * Cấp ổ Bunny CDN cho shop đã có website mà chưa có zone.
 *
 *   npx tsx scripts/provision-partner-bunny-cdn.ts
 *
 * Cần DATABASE_URL và BUNNY_ACCOUNT_API_KEY trong .env.local.
 * In slug + hostname. Không in mật khẩu storage.
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import { Pool } from 'pg'

const cwd = process.cwd()
const envPath = resolve(cwd, '.env')
const localPath = resolve(cwd, '.env.local')
if (existsSync(envPath)) config({ path: envPath })
if (existsSync(localPath)) config({ path: localPath, override: true })
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/\r/g, '').trim()
}

type ShopRow = {
  partner_id: string
  slug: string
  site_slug: string
  is_published: boolean
}

async function main(): Promise<void> {
  const dsn = process.env.DATABASE_URL?.trim()
  if (!dsn) {
    console.error('Thiếu DATABASE_URL')
    process.exit(1)
  }
  if (!process.env.BUNNY_ACCOUNT_API_KEY?.trim()) {
    console.error('Thiếu BUNNY_ACCOUNT_API_KEY — không tạo được ổ CDN. Shop vẫn dùng CDN chung.')
    process.exit(1)
  }

  const pool = new Pool({ connectionString: dsn })
  try {
    const { rows } = await pool.query<ShopRow>(
      `select p.id::text as partner_id, p.slug, w.site_slug, w.is_published
       from public.messaging_partners p
       join public.messaging_partner_websites w on w.partner_id = p.id
       where coalesce(p.is_active, true) = true
         and p.purge_at is null
         and not exists (
           select 1 from public.messaging_partner_bunny_cdn c
           where c.partner_id = p.id
         )
       order by w.created_at, p.slug`
    )
    console.log(`[bunny-cdn] shop web chưa có ổ: ${rows.length}`)
    if (rows.length === 0) {
      console.log('[bunny-cdn] không có shop nào cần cấp')
      return
    }

    const { provisionPartnerBunnyCdn } = await import('../src/lib/storage/partner-bunny-cdn')
    const { fetchPartnerBunnyCdnFromPg } = await import('../src/lib/db/messaging-partner-bunny-cdn-pg')

    let failed = 0
    for (const shop of rows) {
      const label = `${shop.slug} site=${shop.site_slug} published=${shop.is_published}`
      try {
        await provisionPartnerBunnyCdn({ partnerId: shop.partner_id, slug: shop.slug })
        const row = await fetchPartnerBunnyCdnFromPg(shop.partner_id)
        if (row && !row.deletePending && row.hostname) {
          console.log(`[bunny-cdn] OK ${label} host=${row.hostname}`)
        } else {
          failed += 1
          console.error(`[bunny-cdn] FAIL ${label} chưa lưu được ổ`)
        }
      } catch (e) {
        failed += 1
        const message = e instanceof Error ? e.message : String(e)
        console.error(`[bunny-cdn] FAIL ${label} ${message}`)
      }
    }
    if (failed > 0) process.exit(1)
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error('[bunny-cdn] fatal', e)
  process.exit(1)
})
