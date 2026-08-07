// Smoke test (S0.4): GTM container ID lưu/đọc theo từng partner + xuất hiện trong tracking config.
// Chạy: npx tsx scripts/test-tracking-s0_4-gtm.ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getPgPool } from '../src/lib/db/pool'
import { updateMessagingPartnerGtmContainerForOwnerFromPg } from '../src/lib/db/messaging-partners-pg'
import { fetchPublishedPartnerWebsiteBySlugPg } from '../src/lib/db/messaging-partner-websites-pg'
import { partnerSiteTrackingFromPublicRow } from '../src/lib/partner-website/shop/partner-site-tracking-from-site'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

async function main() {
  const pool = getPgPool()
  const ownerRes = await pool.query(`select id from auth.users limit 1`)
  assert(ownerRes.rows.length, 'cần ít nhất 1 user trong auth.users')
  const ownerId = ownerRes.rows[0].id as string

  const tag = Date.now().toString(36)
  const siteSlug = `s04-gtm-shop-${tag}`
  const partnerRes = await pool.query(
    `insert into public.messaging_partners (owner_user_id, display_name, slug)
     values ($1::uuid, 'S0.4 GTM Test Shop', $2) returning id`,
    [ownerId, `${siteSlug}-partner`]
  )
  const partnerId = partnerRes.rows[0].id as string
  await pool.query(
    `insert into public.messaging_partner_websites (partner_id, site_slug, title, locale, is_published)
     values ($1::uuid, $2, 'S0.4 GTM Test Shop', 'vi', true)`,
    [partnerId, siteSlug]
  )

  try {
    const ok = await updateMessagingPartnerGtmContainerForOwnerFromPg({
      partner_id: partnerId,
      owner_user_id: ownerId,
      gtm_container_id: 'GTM-ABC1234',
    })
    assert(ok, 'lưu GTM container thất bại')
    console.log('OK updateMessagingPartnerGtmContainerForOwnerFromPg: lưu thành công')

    const site = await fetchPublishedPartnerWebsiteBySlugPg(siteSlug, { allowDraft: true })
    assert(site, 'không tải được website vừa seed')
    assert(site!.gtmContainerId === 'GTM-ABC1234', `gtmContainerId phải khớp, thực tế "${site!.gtmContainerId}"`)
    console.log('OK fetchPublishedPartnerWebsiteBySlugPg: trả đúng gtmContainerId đã lưu')

    const tracking = partnerSiteTrackingFromPublicRow(site!)
    assert(tracking.gtmContainerId === 'GTM-ABC1234', 'partnerSiteTrackingFromPublicRow phải map đúng gtmContainerId')
    assert(tracking.siteSlug === siteSlug, 'partnerSiteTrackingFromPublicRow phải map đúng siteSlug')
    console.log('OK partnerSiteTrackingFromPublicRow: map đúng gtmContainerId + siteSlug vào tracking config')

    // Xoá — không phải chủ shop khác không sửa được.
    const otherOwnerRes = await pool.query(`select id from auth.users where id <> $1::uuid limit 1`, [ownerId])
    if (otherOwnerRes.rows.length) {
      const failed = await updateMessagingPartnerGtmContainerForOwnerFromPg({
        partner_id: partnerId,
        owner_user_id: otherOwnerRes.rows[0].id,
        gtm_container_id: 'GTM-HACK999',
      })
      assert(!failed, 'chủ shop khác không được sửa GTM container của shop này')
      console.log('OK cách ly quyền: chủ shop khác không sửa được GTM container')
    }

    console.log('\n✅ ALL S0.4 (GTM container per-partner) CHECKS PASSED')
  } finally {
    await pool.query(`delete from public.messaging_partners where id = $1::uuid`, [partnerId])
    await pool.end()
  }
}

main().catch((e) => {
  console.error('\n❌ TEST FAILED:', e.message)
  process.exit(1)
})
