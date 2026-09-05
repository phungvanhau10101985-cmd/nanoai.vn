/**
 * Smoke tests for closing non-Landing Partial debts.
 * Run: npx tsx scripts/test-close-partial-debts.ts
 */
import assert from 'node:assert/strict'
import { normalizePartnerSiteContactChannels } from '../src/lib/partner-website/shop/partner-site-contact-channels'
import {
  isPartnerFlashSaleActive,
  resolvePartnerEffectiveUnitPrice,
} from '../src/lib/partner-website/shop/partner-shop-flash-sale'
import { partnerShopFacetDefsForIndustry } from '../src/lib/partner-website/shop/partner-shop-industry-facets'
import { isPgConfigured } from '../src/lib/db/pool'
import { pgQueryOne } from '../src/lib/db/pg-query'

async function main() {
  const channels = normalizePartnerSiteContactChannels({
    contact_phone: '0901234567',
    contact_zalo_url: 'zalo.me/abc',
    contact_messenger_url: 'https://m.me/page',
    contact_instagram_url: '',
  })
  assert.equal(channels.phone, '0901234567')
  assert.equal(channels.zaloUrl, 'https://zalo.me/abc')
  assert.equal(channels.messengerUrl, 'https://m.me/page')
  assert.equal(channels.instagramUrl, null)
  console.log('OK S0.7 contact normalize')

  assert.deepEqual(
    partnerShopFacetDefsForIndustry('fashion').map((f) => f.key),
    ['size', 'style', 'color']
  )
  assert.equal(partnerShopFacetDefsForIndustry('hotel').length, 0)
  console.log('OK W4.11 facet defs')

  const now = Date.now()
  assert.equal(
    isPartnerFlashSaleActive({
      priceAmount: 200000,
      salePriceAmount: 150000,
      saleStartsAt: new Date(now - 60_000).toISOString(),
      saleEndsAt: new Date(now + 60_000).toISOString(),
    }),
    true
  )
  assert.equal(
    resolvePartnerEffectiveUnitPrice({
      priceAmount: 200000,
      salePriceAmount: 150000,
      saleStartsAt: new Date(now - 60_000).toISOString(),
      saleEndsAt: new Date(now + 60_000).toISOString(),
    }),
    150000
  )
  assert.equal(
    isPartnerFlashSaleActive({
      priceAmount: 200000,
      salePriceAmount: 250000,
      saleStartsAt: null,
      saleEndsAt: null,
    }),
    false
  )
  assert.equal(
    isPartnerFlashSaleActive({
      priceAmount: 200000,
      salePriceAmount: 0,
      saleStartsAt: null,
      saleEndsAt: null,
    }),
    false
  )
  assert.equal(
    resolvePartnerEffectiveUnitPrice({
      priceAmount: 200000,
      salePriceAmount: 0,
      saleStartsAt: null,
      saleEndsAt: null,
    }),
    200000
  )
  console.log('OK W1.4 flash sale helpers')

  if (isPgConfigured()) {
    const contactCol = await pgQueryOne<{ exists: boolean }>(
      `select exists (
         select 1 from information_schema.columns
         where table_schema='public' and table_name='messaging_partners' and column_name='contact_phone'
       ) as exists`
    )
    assert.equal(contactCol?.exists, true)
    const sizeGuideCol = await pgQueryOne<{ exists: boolean }>(
      `select exists (
         select 1 from information_schema.columns
         where table_schema='public' and table_name='messaging_partner_categories' and column_name='size_guide_image_url'
       ) as exists`
    )
    assert.equal(sizeGuideCol?.exists, true)
    const carrierCol = await pgQueryOne<{ exists: boolean }>(
      `select exists (
         select 1 from information_schema.columns
         where table_schema='public' and table_name='messaging_partner_payment_settings' and column_name='shipping_carrier_label'
       ) as exists`
    )
    assert.equal(carrierCol?.exists, true)
    const outbox = await pgQueryOne<{ exists: boolean }>(
      `select exists (
         select 1 from information_schema.tables
         where table_schema='public' and table_name='messaging_partner_meta_capi_outbox'
       ) as exists`
    )
    assert.equal(outbox?.exists, true)
    const saleCol = await pgQueryOne<{ exists: boolean }>(
      `select exists (
         select 1 from information_schema.columns
         where table_schema='public' and table_name='messaging_partner_inventory' and column_name='sale_price_amount'
       ) as exists`
    )
    assert.equal(saleCol?.exists, true)
    console.log('OK migrations schema')
  } else {
    console.log('SKIP DB schema (no DATABASE_URL)')
  }

  console.log('OK — close partial debts batch')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
