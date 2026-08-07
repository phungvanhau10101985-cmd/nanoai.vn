/**
 * Phase 9 MVP smoke (unit + light DB): W2.4/W2.5/W2.3 helpers, S0.10 currency, M3.4 aliases schema.
 * Chạy: npx tsx scripts/test-phase9-mvp-batch.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import assert from 'node:assert/strict'
import {
  listShopTemplatePresets,
  suggestedShopTemplatePresetForIndustry,
} from '../src/lib/partner-website/template/shop-template-presets'
import {
  DEFAULT_PARTNER_SITE_FOOTER_LINKS,
  normalizePartnerSiteNavLinks,
  visibleSortedNavLinks,
} from '../src/lib/partner-website/shop/partner-site-nav-footer'
import { normalizePartnerShopCurrency } from '../src/lib/partner-website/shop/partner-shop-currency'
import { getPgPool } from '../src/lib/db/pool'

async function main() {
  const presets = listShopTemplatePresets()
  assert.ok(presets.length >= 6, `cần >=6 presets, có ${presets.length}`)
  assert.equal(suggestedShopTemplatePresetForIndustry('food'), 'food-warm')
  assert.equal(suggestedShopTemplatePresetForIndustry('hotel'), 'hospitality-stay')
  console.log('OK W2.5 presets')

  const footer = normalizePartnerSiteNavLinks(null, DEFAULT_PARTNER_SITE_FOOTER_LINKS)
  assert.ok(footer.length > 5)
  const hidden = footer.map((x, i) => (i === 0 ? { ...x, visible: false } : x))
  assert.equal(visibleSortedNavLinks(hidden).length, footer.length - 1)
  console.log('OK W2.3 nav/footer normalize')

  assert.equal(normalizePartnerShopCurrency('usd'), 'USD')
  assert.equal(normalizePartnerShopCurrency(null), 'VND')
  console.log('OK S0.10 currency')

  const pool = getPgPool()
  const cols = await pool.query(
    `select column_name from information_schema.columns
     where table_schema='public' and table_name='messaging_partner_websites'
       and column_name in ('nav_json','footer_json')`
  )
  assert.equal(cols.rows.length, 2, 'nav_json/footer_json phải tồn tại')

  const notif = await pool.query(
    `select to_regclass('public.messaging_partner_customer_notifications') as t`
  )
  assert.ok(notif.rows[0]?.t, 'bảng customer notifications')

  const cur = await pool.query(
    `select column_name from information_schema.columns
     where table_schema='public' and table_name='messaging_partners' and column_name='default_currency'`
  )
  assert.equal(cur.rows.length, 1, 'default_currency')

  const aliases = await pool.query(
    `select to_regclass('public.messaging_partner_search_aliases') as t`
  )
  assert.ok(aliases.rows[0]?.t, 'bảng search aliases')
  console.log('OK migrations schema')

  console.log('OK — Phase 9 MVP batch')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
