/**
 * Default «Tạo web» workspace: fashion / 188.com.vn first.
 * Chạy: npx tsx scripts/test-pick-preferred-website-partner.ts
 */
import assert from 'node:assert/strict'
import {
  looksLikeConnected188Shop,
  pickPreferredWebsitePartnerId,
} from '../src/lib/partner-website/pick-preferred-website-partner'

function main() {
  const hotel = {
    id: 'hotel-1',
    slug: 'khach-san-a',
    display_name: 'Khách sạn A',
    industry_key: 'hotel' as const,
  }
  const fashion188 = {
    id: 'fashion-188',
    slug: 'shop-188',
    display_name: '188.com.vn',
    brand_name: '188 Fashion',
    industry_key: 'fashion' as const,
  }
  const fashionOther = {
    id: 'fashion-2',
    slug: 'ao-cuoi',
    display_name: 'Áo cưới',
    industry_key: 'fashion' as const,
  }

  assert.equal(
    pickPreferredWebsitePartnerId([hotel, fashionOther, fashion188]),
    'fashion-188'
  )
  assert.equal(pickPreferredWebsitePartnerId([hotel, fashionOther]), 'fashion-2')
  assert.equal(pickPreferredWebsitePartnerId([hotel, fashion188], 'hotel-1'), 'hotel-1')
  assert.equal(looksLikeConnected188Shop(fashion188), true)
  assert.equal(looksLikeConnected188Shop(fashionOther), false)
  console.log('test-pick-preferred-website-partner: ok')
}

main()
