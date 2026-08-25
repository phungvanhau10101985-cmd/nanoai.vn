/**
 * W2.2 — gợi ý sửa nhanh theo ngành (không hardcode fashion/cam).
 * Chạy: npx tsx scripts/test-w2_2-industry-quick-edits.ts
 */
import assert from 'node:assert/strict'
import { getPartnerWebsiteCopy } from '../src/lib/i18n/partner-website-copy'
import { getPartnerWebsiteEditSuggestions } from '../src/lib/partner-website/partner-website-quick-edits'

function main() {
  const t = getPartnerWebsiteCopy('vi')

  const fashion = getPartnerWebsiteEditSuggestions({
    locale: 'vi',
    t,
    industryKey: 'fashion',
    phase: 'built',
  })
  assert.ok(fashion.length >= 4, 'fashion phải có vài gợi ý')
  assert.ok(
    fashion.some((s) => /chat/i.test(s)),
    'fashion (có chat) phải có gợi ý CTA chat'
  )
  assert.ok(
    !fashion.some((s) => /tông cam|orange theme|shop thời trang|fashion shop/i.test(s)),
    `không được hardcode cam/thời trang: ${fashion.join(' | ')}`
  )

  const hotel = getPartnerWebsiteEditSuggestions({
    locale: 'vi',
    t,
    industryKey: 'hotel',
    phase: 'built',
  })
  assert.ok(
    hotel.some((s) => /đặt phòng|đặt chỗ|booking/i.test(s)),
    `hotel phải có CTA đặt chỗ: ${hotel.join(' | ')}`
  )
  assert.ok(
    !hotel.some((s) => /fashion|thời trang|cam đậm|orange/i.test(s)),
    `hotel không được dính fashion/cam: ${hotel.join(' | ')}`
  )

  const hotelChips = getPartnerWebsiteEditSuggestions({
    locale: 'en',
    t: getPartnerWebsiteCopy('en'),
    industryKey: 'hotel',
    phase: 'other',
  })
  assert.ok(
    hotelChips.some((s) => /faq/i.test(s)),
    'FAQ luôn gợi ý — Sửa nhanh thêm được thì dùng được'
  )

  console.log('OK — W2.2 industry quick-edits')
}

main()
