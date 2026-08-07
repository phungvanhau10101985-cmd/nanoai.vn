// Smoke test Phase 1 (W1.4): DB layer cho khuyến mãi/voucher (CRUD, validate, usage, grant).
// Chạy: npx tsx scripts/test-partner-promotions-w1_4-phase1.ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getPgPool } from '../src/lib/db/pool'
import {
  checkCustomerHasPriorOrderFromPg,
  deletePartnerPromotionFromPg,
  fetchActivePromotionGrantsForCustomerFromPg,
  fetchPartnerPromotionsForAdminFromPg,
  grantPromotionToCustomerFromPg,
  insertPartnerPromotionFromPg,
  recordPromotionUsageFromPg,
  updatePartnerPromotionFromPg,
  validatePromotionCodeFromPg,
} from '../src/lib/db/messaging-partner-promotions-pg'
import { insertPartnerCategoryFromPg, setCategoryProductsFromPg } from '../src/lib/db/messaging-partner-categories-pg'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

async function main() {
  const pool = getPgPool()
  const ownerRes = await pool.query(`select id from auth.users limit 1`)
  assert(ownerRes.rows.length, 'cần ít nhất 1 user trong auth.users')
  const ownerId = ownerRes.rows[0].id

  const tag = Date.now().toString(36)
  const partnerRes = await pool.query(
    `insert into public.messaging_partners (owner_user_id, display_name, slug)
     values ($1, 'W1.4 Test Shop', $2) returning id`,
    [ownerId, `w1-4-partner-${tag}`]
  )
  const partnerId = partnerRes.rows[0].id as string

  const invRes = await pool.query(
    `insert into public.messaging_partner_inventory (partner_id, name, price_hint, image_url, product_url, is_active)
     values ($1::uuid, 'Áo test W1.4', '200.000đ', 'https://placehold.co/100', 'https://example.com/p', true)
     returning id`,
    [partnerId]
  )
  const inventoryId = invRes.rows[0].id as string
  const invRes2 = await pool.query(
    `insert into public.messaging_partner_inventory (partner_id, name, price_hint, image_url, product_url, is_active)
     values ($1::uuid, 'Quần test W1.4', '300.000đ', 'https://placehold.co/100', 'https://example.com/p2', true)
     returning id`,
    [partnerId]
  )
  const inventoryId2 = invRes2.rows[0].id as string

  const category = await insertPartnerCategoryFromPg({ partnerId, parentId: null, name: 'Áo' })
  assert(category.ok, 'tạo category thất bại')
  const assigned = await setCategoryProductsFromPg(partnerId, category.row.id, [inventoryId])
  assert(assigned, 'gán category thất bại')

  async function seedGuestAccount(emailTag: string): Promise<string> {
    const r = await pool.query(
      `insert into public.messaging_guest_accounts (partner_id, email_raw, email_normalized)
       values ($1::uuid, $2, $2) returning id`,
      [partnerId, `${emailTag}-${tag}@example.com`]
    )
    return r.rows[0].id as string
  }
  const guestA = await seedGuestAccount('w14-buyer-a')
  const guestB = await seedGuestAccount('w14-buyer-b')

  try {
    // 1) Tạo voucher percent + cap, public redeemable.
    const percentPromo = await insertPartnerPromotionFromPg(partnerId, {
      code: 'welcome10', name: 'Chào mừng 10%', discountType: 'percent', discountPercent: 10, maxDiscountAmount: 30000,
      minSubtotal: 100000, perUserLimit: 1,
    })
    assert(percentPromo.ok, `tạo voucher percent thất bại: ${JSON.stringify(percentPromo)}`)
    assert(percentPromo.row.code === 'WELCOME10', `code phải tự uppercase: ${percentPromo.row.code}`)
    console.log('OK insertPartnerPromotionFromPg: tạo voucher percent + cap, code tự uppercase')

    // 2) Trùng code -> duplicate_code.
    const dup = await insertPartnerPromotionFromPg(partnerId, {
      code: 'WELCOME10', name: 'Trùng mã', discountType: 'percent', discountPercent: 5,
    })
    assert(!dup.ok && dup.error === 'duplicate_code', `phải chặn trùng code: ${JSON.stringify(dup)}`)
    console.log('OK enforce unique (partner, code) ở DB')

    // 3) Validate: subtotal dưới ngưỡng -> below_min_subtotal.
    const belowMin = await validatePromotionCodeFromPg({
      partnerId, code: 'welcome10', subtotal: 50000, cartLines: [{ inventoryId, lineSubtotal: 50000 }], guestAccountId: guestA,
    })
    assert(!belowMin.ok && belowMin.error === 'below_min_subtotal', `phải chặn dưới ngưỡng: ${JSON.stringify(belowMin)}`)
    console.log('OK validatePromotionCodeFromPg: chặn đúng below_min_subtotal')

    // 4) Validate OK: giảm 10%, cap 30k -> subtotal 500k thì giảm lẽ ra 50k nhưng bị cap 30k.
    const okValidate = await validatePromotionCodeFromPg({
      partnerId, code: 'WELCOME10', subtotal: 500000, cartLines: [{ inventoryId, lineSubtotal: 500000 }], guestAccountId: guestA,
    })
    assert(okValidate.ok, `phải validate OK: ${JSON.stringify(okValidate)}`)
    assert(okValidate.ok && okValidate.discountAmount === 30000, `phải cap đúng 30000, thực tế ${okValidate.ok ? okValidate.discountAmount : 'n/a'}`)
    console.log('OK validatePromotionCodeFromPg: tính đúng 10% + cap max_discount_amount = 30000')

    // 5) Ghi nhận sử dụng + per_user_limit=1 -> lần 2 cùng khách bị chặn.
    const fakeOrderRes = await pool.query(
      `insert into public.messaging_partner_orders (partner_id, conversation_id, status)
       select $1::uuid, (select id from public.customer_care_conversations where partner_id = $1::uuid limit 1), 'awaiting_payment'
       where exists (select 1 from public.customer_care_conversations where partner_id = $1::uuid)
       returning id`,
      [partnerId]
    )
    let fakeOrderId: string
    if (fakeOrderRes.rows.length) {
      fakeOrderId = fakeOrderRes.rows[0].id
    } else {
      const conv = await pool.query(
        `insert into public.customer_care_conversations (channel, external_thread_id, guest_account_id, partner_id)
         values ('widget', $1, $2::uuid, $3::uuid) returning id`,
        [`w1_4-thread-${tag}`, guestA, partnerId]
      )
      const order = await pool.query(
        `insert into public.messaging_partner_orders (partner_id, conversation_id, status)
         values ($1::uuid, $2::uuid, 'awaiting_payment') returning id`,
        [partnerId, conv.rows[0].id]
      )
      fakeOrderId = order.rows[0].id
    }
    const recorded = await recordPromotionUsageFromPg({
      partnerId, promotionId: percentPromo.row.id, orderId: fakeOrderId, discountAmount: 30000, guestAccountId: guestA,
    })
    assert(recorded, 'ghi nhận sử dụng thất bại')
    const afterUsage = await validatePromotionCodeFromPg({
      partnerId, code: 'WELCOME10', subtotal: 500000, cartLines: [{ inventoryId, lineSubtotal: 500000 }], guestAccountId: guestA,
    })
    assert(!afterUsage.ok && afterUsage.error === 'per_user_limit_reached', `phải chặn per_user_limit: ${JSON.stringify(afterUsage)}`)
    const stillOkForB = await validatePromotionCodeFromPg({
      partnerId, code: 'WELCOME10', subtotal: 500000, cartLines: [{ inventoryId, lineSubtotal: 500000 }], guestAccountId: guestB,
    })
    assert(stillOkForB.ok, `khách khác (B) vẫn phải dùng được: ${JSON.stringify(stillOkForB)}`)
    console.log('OK recordPromotionUsageFromPg + per_user_limit enforce đúng theo từng khách')

    // 6) Voucher target theo category — chỉ áp cho SP trong category, tính đúng eligible subtotal.
    const catPromo = await insertPartnerPromotionFromPg(partnerId, {
      code: 'AOTHUN20', name: '20% áo', discountType: 'percent', discountPercent: 20, categoryId: category.row.id,
    })
    assert(catPromo.ok, 'tạo voucher theo category thất bại')
    const mixedCart = [
      { inventoryId, lineSubtotal: 200000 }, // thuộc category Áo
      { inventoryId: inventoryId2, lineSubtotal: 300000 }, // KHÔNG thuộc category Áo
    ]
    const catValidate = await validatePromotionCodeFromPg({
      partnerId, code: 'AOTHUN20', subtotal: 500000, cartLines: mixedCart, guestAccountId: guestB,
    })
    assert(catValidate.ok, `voucher theo category phải OK khi có SP thuộc category: ${JSON.stringify(catValidate)}`)
    assert(catValidate.ok && catValidate.eligibleSubtotal === 200000, `eligibleSubtotal phải = 200000 (chỉ tính SP trong category), thực tế ${catValidate.ok ? catValidate.eligibleSubtotal : 'n/a'}`)
    assert(catValidate.ok && catValidate.discountAmount === 40000, `discount phải = 20% * 200000 = 40000, thực tế ${catValidate.ok ? catValidate.discountAmount : 'n/a'}`)
    console.log('OK voucher target category: chỉ tính giảm giá trên SP thuộc category (không giảm cả đơn)')

    const noEligibleCart = [{ inventoryId: inventoryId2, lineSubtotal: 300000 }]
    const noEligible = await validatePromotionCodeFromPg({
      partnerId, code: 'AOTHUN20', subtotal: 300000, cartLines: noEligibleCart, guestAccountId: guestA,
    })
    assert(!noEligible.ok && noEligible.error === 'no_eligible_items', `giỏ không có SP thuộc category phải bị chặn: ${JSON.stringify(noEligible)}`)
    console.log('OK voucher target category: chặn đúng khi giỏ không có SP thuộc category (no_eligible_items)')

    // 7) Voucher không public redeemable — cần grant.
    const privatePromo = await insertPartnerPromotionFromPg(partnerId, {
      code: 'VIPGIFT', name: 'Quà VIP', discountType: 'fixed_amount', discountAmount: 50000, isPublicRedeemable: false,
    })
    assert(privatePromo.ok, 'tạo voucher private thất bại')
    const noGrant = await validatePromotionCodeFromPg({
      partnerId, code: 'VIPGIFT', subtotal: 200000, cartLines: [{ inventoryId, lineSubtotal: 200000 }], guestAccountId: guestA,
    })
    assert(!noGrant.ok && noGrant.error === 'grant_required', `chưa được cấp phải chặn grant_required: ${JSON.stringify(noGrant)}`)
    const grant = await grantPromotionToCustomerFromPg({
      partnerId, promotionId: privatePromo.row.id, guestAccountId: guestA, source: 'admin_gift', validDays: 7,
    })
    assert(grant, 'cấp voucher vào ví thất bại')
    const withGrant = await validatePromotionCodeFromPg({
      partnerId, code: 'VIPGIFT', subtotal: 200000, cartLines: [{ inventoryId, lineSubtotal: 200000 }], guestAccountId: guestA,
    })
    assert(withGrant.ok && withGrant.discountAmount === 50000, `sau khi được cấp phải dùng được, giảm đúng 50000: ${JSON.stringify(withGrant)}`)
    console.log('OK voucher is_public_redeemable=false: chặn grant_required, sau khi admin tặng thì dùng được')

    // 8) Ví quà hiển thị đúng.
    const wallet = await fetchActivePromotionGrantsForCustomerFromPg({ partnerId, guestAccountId: guestA })
    assert(wallet && wallet.length === 1 && wallet[0].promotion.code === 'VIPGIFT', `ví quà phải hiện đúng 1 voucher VIPGIFT: ${JSON.stringify(wallet)}`)
    console.log('OK fetchActivePromotionGrantsForCustomerFromPg: ví quà hiển thị đúng')

    // 9) first_order_only.
    const firstOrderPromo = await insertPartnerPromotionFromPg(partnerId, {
      code: 'FIRSTORDER', name: 'Đơn đầu tiên', discountType: 'percent', discountPercent: 15, firstOrderOnly: true,
    })
    assert(firstOrderPromo.ok, 'tạo voucher first_order_only thất bại')
    const hasPriorA = await checkCustomerHasPriorOrderFromPg({ partnerId, guestAccountId: guestA })
    assert(hasPriorA, 'guestA đã có đơn (bước 5) -> phải trả về true')
    const blockedFirstOrder = await validatePromotionCodeFromPg({
      partnerId, code: 'FIRSTORDER', subtotal: 200000, cartLines: [{ inventoryId, lineSubtotal: 200000 }], guestAccountId: guestA,
    })
    assert(!blockedFirstOrder.ok && blockedFirstOrder.error === 'first_order_only', `guestA đã có đơn phải bị chặn first_order_only: ${JSON.stringify(blockedFirstOrder)}`)
    const okFirstOrder = await validatePromotionCodeFromPg({
      partnerId, code: 'FIRSTORDER', subtotal: 200000, cartLines: [{ inventoryId, lineSubtotal: 200000 }], guestAccountId: guestB,
    })
    assert(okFirstOrder.ok, `guestB chưa có đơn phải dùng được: ${JSON.stringify(okFirstOrder)}`)
    console.log('OK first_order_only: chặn đúng khách đã mua, cho phép khách chưa từng mua')

    // 10) Mã không tồn tại / hết hạn / inactive.
    const notFound = await validatePromotionCodeFromPg({ partnerId, code: 'KHONGTONTAI', subtotal: 100000, cartLines: [] })
    assert(!notFound.ok && notFound.error === 'not_found', 'mã không tồn tại phải trả not_found')
    const expiredPromo = await insertPartnerPromotionFromPg(partnerId, {
      code: 'HETHAN', name: 'Hết hạn', discountType: 'percent', discountPercent: 5, validTo: new Date(Date.now() - 86400000).toISOString(),
    })
    assert(expiredPromo.ok, 'tạo voucher hết hạn thất bại')
    const expiredCheck = await validatePromotionCodeFromPg({ partnerId, code: 'HETHAN', subtotal: 100000, cartLines: [] })
    assert(!expiredCheck.ok && expiredCheck.error === 'expired', `phải trả expired: ${JSON.stringify(expiredCheck)}`)
    console.log('OK validatePromotionCodeFromPg: not_found + expired đúng')

    // 11) Admin: list + update + delete.
    const adminList = await fetchPartnerPromotionsForAdminFromPg({ partnerId })
    assert(adminList && adminList.total === 5, `admin phải thấy 5 voucher, thực tế ${adminList?.total}`)
    const updated = await updatePartnerPromotionFromPg(partnerId, percentPromo.row.id, { isActive: false })
    assert(updated.ok && updated.row.isActive === false, 'update isActive thất bại')
    const inactiveCheck = await validatePromotionCodeFromPg({ partnerId, code: 'WELCOME10', subtotal: 500000, cartLines: [] })
    assert(!inactiveCheck.ok && inactiveCheck.error === 'inactive', 'voucher vừa tắt phải trả inactive')
    const deleted = await deletePartnerPromotionFromPg(partnerId, percentPromo.row.id)
    assert(deleted, 'xoá voucher thất bại')
    console.log('OK admin: list/update/delete hoạt động đúng')

    console.log('\n✅ ALL W1.4 PHASE 1 (DB layer: promotions/voucher/ví quà) CHECKS PASSED')
  } finally {
    await pool.query(`delete from public.customer_care_conversations where partner_id = $1::uuid`, [partnerId])
    await pool.query(`delete from public.messaging_partners where id = $1::uuid`, [partnerId])
    await pool.end()
  }
}

main().catch((e) => {
  console.error('\n❌ TEST FAILED:', e.message)
  process.exit(1)
})
