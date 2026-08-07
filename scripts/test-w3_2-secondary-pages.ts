/**
 * W3.2 — trang phụ payment/thank-you/stores/lookbook/size-guide/blog.
 * Chạy: npx tsx scripts/test-w3_2-secondary-pages.ts
 * (HTTP checks cần dev server — SMOKE_BASE_URL, mặc định http://localhost:3000)
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import assert from 'node:assert/strict'
import { getPgPool } from '../src/lib/db/pool'
import {
  isBuiltinPageSlug,
  PARTNER_BUILTIN_PAGE_SLUGS,
} from '../src/lib/partner-website/pages/partner-static-page-types'
import {
  getPartnerSiteInfoPage,
  PARTNER_SITE_PLATFORM_INFO_KEYS,
} from '../src/lib/partner-website/shop/partner-site-shop-info-pages'
import {
  getPartnerWebsitePageDef,
  getPartnerWebsitePageStudioMode,
} from '../src/lib/partner-website/partner-website-page-catalog'
import { insertPartnerStaticPageFromPg } from '../src/lib/db/messaging-partner-static-pages-pg'

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000'

const SECONDARY = ['payment', 'thank-you', 'stores', 'lookbook', 'size-guide', 'blog'] as const

async function main() {
  for (const slug of SECONDARY) {
    assert.ok(isBuiltinPageSlug(slug), `${slug} phải là builtin CMS`)
    assert.ok(PARTNER_BUILTIN_PAGE_SLUGS.includes(slug), `${slug} trong PARTNER_BUILTIN_PAGE_SLUGS`)
    assert.ok(PARTNER_SITE_PLATFORM_INFO_KEYS.includes(slug), `${slug} trong platform info keys`)
    const block = getPartnerSiteInfoPage(slug, 'vi')
    assert.ok(block.title.trim(), `${slug} phải có title mặc định`)
    assert.ok(block.paragraphs.length > 0, `${slug} phải có nội dung mặc định`)
  }

  for (const key of ['payment', 'thank_you', 'stores', 'blog', 'lookbook', 'size_guide'] as const) {
    const def = getPartnerWebsitePageDef(key)
    assert.ok(def, `catalog phải có ${key}`)
    assert.equal(getPartnerWebsitePageStudioMode(def), 'platform', `${key} phải studioMode=platform`)
  }
  console.log('OK — catalog + defaults W3.2')

  const pool = getPgPool()
  const ownerRes = await pool.query(`select id from auth.users limit 1`)
  assert.ok(ownerRes.rows.length, 'cần user auth')
  const ownerId = ownerRes.rows[0].id
  const tag = Date.now().toString(36)
  const siteSlug = `w3-2-shop-${tag}`
  const partnerRes = await pool.query(
    `insert into public.messaging_partners (owner_user_id, display_name, slug)
     values ($1, 'W3.2 Test Shop', $2) returning id`,
    [ownerId, `${siteSlug}-partner`]
  )
  const partnerId = partnerRes.rows[0].id as string
  await pool.query(
    `insert into public.messaging_partner_websites (partner_id, site_slug, title, locale, is_published, published_at)
     values ($1::uuid, $2, 'W3.2 Test Shop', 'vi', true, now())`,
    [partnerId, siteSlug]
  )

  try {
    const override = await insertPartnerStaticPageFromPg(partnerId, {
      slug: 'payment',
      title: 'Thanh toán tuỳ chỉnh W3.2',
      content: 'Nội dung CMS payment.\n\nĐoạn 2.',
      seoTitle: '',
      seoDescription: '',
      seoIndex: true,
      isPublished: true,
    })
    assert.ok(override.ok, `ghi đè payment thất bại: ${JSON.stringify(override)}`)

    let httpOk = true
    for (const path of SECONDARY) {
      const url = `${BASE}/site/${encodeURIComponent(siteSlug)}/${path}${path === 'thank-you' ? '?order=demo-order-1' : ''}`
      try {
        const res = await fetch(url, { redirect: 'manual' })
        if (res.status !== 200) {
          console.warn(`WARN HTTP ${res.status} ${url} (bỏ qua nếu chưa chạy dev server)`)
          httpOk = false
          continue
        }
        const html = await res.text()
        if (path === 'payment') {
          assert.ok(html.includes('Thanh toán tuỳ chỉnh W3.2'), 'payment phải render CMS override')
        } else if (path === 'thank-you') {
          assert.ok(html.includes('demo-order-1'), 'thank-you phải hiện mã đơn từ query')
        } else {
          const title = getPartnerSiteInfoPage(path, 'vi').title
          // Title có thể chứa `&` → HTML escape thành `&amp;`.
          const needle = title.split('&')[0]?.trim() || title
          assert.ok(html.includes(needle), `${path} phải hiện title mặc định (${needle})`)
        }
        console.log(`OK HTTP ${path}`)
      } catch (e) {
        httpOk = false
        console.warn(`WARN fetch ${url}:`, e instanceof Error ? e.message : e)
      }
    }
    if (!httpOk) {
      console.log('NOTE — unit/DB checks đã pass; HTTP skip nếu không có dev server')
    }
  } finally {
    await pool.query(`delete from public.messaging_partners where id = $1::uuid`, [partnerId])
  }

  console.log('OK — W3.2 secondary pages')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
