// Smoke test (S0.3): Meta CAPI hashing + route /api/site/{slug}/tracking/meta-capi qua HTTP thật.
// Yêu cầu: dev server đang chạy tại http://localhost:3000 (npm run dev).
// Chạy: npx tsx scripts/test-tracking-s0_3-capi.ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createHash } from 'node:crypto'
import { getPgPool } from '../src/lib/db/pool'
import { hashMetaCapiEmail, hashMetaCapiPhone, normalizeVnPhoneForMetaCapi } from '../src/lib/tracking/meta-capi-hash'

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

async function main() {
  // 1) Hash email — chuẩn hoá lowercase+trim trước khi hash.
  const emailHash = hashMetaCapiEmail('  Test@Example.com  ')
  assert(emailHash === sha256('test@example.com'), `hash email sai: ${emailHash}`)
  assert(hashMetaCapiEmail('khong-hop-le') === null, 'email không hợp lệ phải trả null')
  assert(hashMetaCapiEmail(null) === null, 'email null phải trả null')
  console.log('OK hashMetaCapiEmail: chuẩn hoá lowercase+trim đúng trước khi hash SHA-256')

  // 2) Chuẩn hoá + hash SĐT VN — về định dạng quốc gia (84xxxxxxxxx) trước khi hash.
  assert(normalizeVnPhoneForMetaCapi('0987654321') === '84987654321', 'chuẩn hoá SĐT bắt đầu bằng 0 sai')
  assert(normalizeVnPhoneForMetaCapi('+84987654321') === '84987654321', 'chuẩn hoá SĐT có sẵn +84 sai')
  assert(normalizeVnPhoneForMetaCapi('84987654321') === '84987654321', 'chuẩn hoá SĐT có sẵn 84 sai')
  const phoneHash = hashMetaCapiPhone('0987654321')
  assert(phoneHash === sha256('84987654321'), `hash SĐT sai: ${phoneHash}`)
  console.log('OK hashMetaCapiPhone: chuẩn hoá về 84xxxxxxxxx trước khi hash SHA-256')

  // 3) Route CAPI: validate lỗi input.
  const pool = getPgPool()
  const ownerRes = await pool.query(`select id from auth.users limit 1`)
  assert(ownerRes.rows.length, 'cần ít nhất 1 user trong auth.users')
  const ownerId = ownerRes.rows[0].id

  const tag = Date.now().toString(36)
  const siteSlug = `s03-capi-shop-${tag}`
  const partnerRes = await pool.query(
    `insert into public.messaging_partners (owner_user_id, display_name, slug)
     values ($1, 'S0.3 CAPI Test Shop', $2) returning id`,
    [ownerId, `${siteSlug}-partner`]
  )
  const partnerId = partnerRes.rows[0].id as string
  await pool.query(
    `insert into public.messaging_partner_websites (partner_id, site_slug, title, locale)
     values ($1::uuid, $2, 'S0.3 CAPI Test Shop', 'vi')`,
    [partnerId, siteSlug]
  )

  try {
    const badEventName = await fetch(`${BASE}/api/site/${siteSlug}/tracking/meta-capi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventName: 'NotARealEvent', eventId: 'x', customData: { content_ids: ['a'] } }),
    })
    assert(badEventName.status === 400, `event name không hợp lệ phải 400, thực tế ${badEventName.status}`)
    console.log('OK route meta-capi validate eventName sai -> 400')

    const missingCustomData = await fetch(`${BASE}/api/site/${siteSlug}/tracking/meta-capi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventName: 'ViewContent', eventId: 'x' }),
    })
    assert(missingCustomData.status === 400, `thiếu customData phải 400, thực tế ${missingCustomData.status}`)
    console.log('OK route meta-capi validate thiếu customData -> 400')

    // 4) Shop CHƯA cấu hình Meta Pixel/CAPI -> skip an toàn (không lỗi, không gọi Graph API thật).
    const okNoPixel = await fetch(`${BASE}/api/site/${siteSlug}/tracking/meta-capi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: 'Purchase',
        eventId: 'Purchase_test-order-123',
        customData: { content_ids: ['sku1'], content_name: 'Test', content_type: 'product', currency: 'VND', value: 100000 },
      }),
    })
    assert(okNoPixel.status === 200, `shop chưa cấu hình pixel phải 200, thực tế ${okNoPixel.status}`)
    const okNoPixelJson = (await okNoPixel.json()) as { ok: boolean; skipped?: boolean; reason?: string }
    assert(okNoPixelJson.ok === true && okNoPixelJson.skipped === true && okNoPixelJson.reason === 'not_configured', `phải skip an toàn khi chưa cấu hình: ${JSON.stringify(okNoPixelJson)}`)
    console.log('OK route meta-capi: shop chưa cấu hình Meta Pixel/CAPI -> skip an toàn, không lỗi, không gọi Graph API')

    // 5) Site không tồn tại -> 404.
    const notFoundRes = await fetch(`${BASE}/api/site/khong-ton-tai-${tag}/tracking/meta-capi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventName: 'ViewContent', eventId: 'x', customData: { content_ids: ['a'] } }),
    })
    assert(notFoundRes.status === 404, `site không tồn tại phải 404, thực tế ${notFoundRes.status}`)
    console.log('OK route meta-capi: site không tồn tại -> 404')

    console.log('\n✅ ALL S0.3 (Meta CAPI hashing + route proxy) CHECKS PASSED')
  } finally {
    await pool.query(`delete from public.messaging_partners where id = $1::uuid`, [partnerId])
    await pool.end()
  }
}

main().catch((e) => {
  console.error('\n❌ TEST FAILED:', e.message)
  process.exit(1)
})
