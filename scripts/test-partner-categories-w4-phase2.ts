// Smoke test Phase 2 (W4.4/W4.5): update, move+rebuild path, cycle guard, reorder, delete, product assign.
// Chạy: npx tsx scripts/test-partner-categories-w4-phase2.ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getPgPool } from '../src/lib/db/pool'
import {
  assignInventoryToCategoryFromPg,
  deletePartnerCategoryFromPg,
  fetchCategoryIdsForInventoryFromPg,
  fetchPartnerCategoryByIdFromPg,
  fetchPartnerCategoryChildCountFromPg,
  fetchPartnerCategoryTreeForAdminFromPg,
  insertPartnerCategoryFromPg,
  movePartnerCategoryFromPg,
  reorderPartnerCategorySiblingFromPg,
  setCategoryProductsFromPg,
  updatePartnerCategoryFieldsFromPg,
} from '../src/lib/db/messaging-partner-categories-pg'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

async function main() {
  const pool = getPgPool()

  const ownerRes = await pool.query(`select id from auth.users limit 1`)
  assert(ownerRes.rows.length, 'cần ít nhất 1 user trong auth.users')
  const ownerId = ownerRes.rows[0].id

  const partnerRes = await pool.query(
    `insert into public.messaging_partners (owner_user_id, display_name, slug)
     values ($1, 'W4 Phase2 Shop', 'w4-p2-shop-' || substr(gen_random_uuid()::text,1,8))
     returning id`,
    [ownerId]
  )
  const partnerId = partnerRes.rows[0].id as string
  console.log('Partner:', partnerId)

  try {
    // 1) Tạo cây: Áo (L1) -> Áo thun (L2) -> Áo thun nam (L3)
    const l1 = await insertPartnerCategoryFromPg({ partnerId, parentId: null, name: 'Áo' })
    assert(l1.ok, 'tạo L1 thất bại')
    const l2 = await insertPartnerCategoryFromPg({ partnerId, parentId: l1.row.id, name: 'Áo thun' })
    assert(l2.ok, 'tạo L2 thất bại')
    const l3 = await insertPartnerCategoryFromPg({ partnerId, parentId: l2.row.id, name: 'Áo thun nam' })
    assert(l3.ok, 'tạo L3 thất bại')
    console.log('OK create tree: ao -> ao/ao-thun -> ao/ao-thun/ao-thun-nam')

    // 2) Update fields (không đụng path)
    const updated = await updatePartnerCategoryFieldsFromPg(partnerId, l2.row.id, {
      description: 'Mô tả áo thun',
      seoTitle: 'Áo thun đẹp',
      isActive: false,
    })
    assert(updated?.description === 'Mô tả áo thun', 'update description thất bại')
    assert(updated?.isActive === false, 'update isActive thất bại')
    assert(updated?.path === 'ao/ao-thun', 'update field không được đổi path')
    console.log('OK updatePartnerCategoryFieldsFromPg giữ nguyên path/slug')

    // bật lại active để test tiếp
    await updatePartnerCategoryFieldsFromPg(partnerId, l2.row.id, { isActive: true })

    // 3) Tạo 1 nhánh khác để move sang: Quần (L1)
    const quan = await insertPartnerCategoryFromPg({ partnerId, parentId: null, name: 'Quần' })
    assert(quan.ok, 'tạo Quần thất bại')

    // 4) Move "Áo thun" (l2, kèm cả con "Áo thun nam") sang dưới "Quần"
    const moveResult = await movePartnerCategoryFromPg(partnerId, l2.row.id, { newParentId: quan.row.id })
    assert(moveResult.ok, `move thất bại: ${!moveResult.ok ? moveResult.error : ''}`)
    assert(moveResult.ok && moveResult.row.path === 'quan/ao-thun', `path sau move sai: ${moveResult.ok ? moveResult.row.path : ''}`)
    console.log('OK move L2 sang cha mới, path mới:', moveResult.ok ? moveResult.row.path : '')

    const l3After = await fetchPartnerCategoryByIdFromPg(partnerId, l3.row.id)
    assert(l3After?.path === 'quan/ao-thun/ao-thun-nam', `con (L3) không rebuild path đúng: ${l3After?.path}`)
    assert(l3After?.depth === 3, `con (L3) depth sai: ${l3After?.depth}`)
    console.log('OK descendant (L3) tự rebuild path/depth theo cha mới:', l3After?.path, 'depth=', l3After?.depth)

    // 5) Cycle guard: move "Quần" (cha mới) vào chính con cháu của nó (ao-thun) -> phải lỗi 'cycle'
    const cycleResult = await movePartnerCategoryFromPg(partnerId, quan.row.id, { newParentId: l2.row.id })
    assert(!cycleResult.ok && cycleResult.error === 'cycle', 'cycle guard không hoạt động')
    console.log('OK cycle guard chặn di chuyển vào chính nhánh con')

    // 6) Reorder: thêm 1 category "Giày" cùng cấp root, rồi đổi thứ tự
    const giay = await insertPartnerCategoryFromPg({ partnerId, parentId: null, name: 'Giày' })
    assert(giay.ok, 'tạo Giày thất bại')
    // root hiện có: Áo (sort 0), Quần (sort 0 mặc định), Giày (sort 0) — reorder theo id asc khi tie.
    const reorderOk = await reorderPartnerCategorySiblingFromPg(partnerId, giay.row.id, 'up')
    assert(reorderOk, 'reorder thất bại')
    console.log('OK reorder up chạy không lỗi (kết quả phụ thuộc thứ tự id, không assert cứng vị trí)')

    // 7) Gán sản phẩm
    const invRes = await pool.query(
      `insert into public.messaging_partner_inventory (partner_id, name, price_hint)
       values ($1::uuid, 'Áo thun nam test', '150k') returning id`,
      [partnerId]
    )
    const invId = invRes.rows[0].id as string

    const setOk = await setCategoryProductsFromPg(partnerId, l3.row.id, [invId])
    assert(setOk, 'setCategoryProductsFromPg thất bại')
    const cats1 = await fetchCategoryIdsForInventoryFromPg(invId)
    assert(cats1?.length === 1 && cats1[0].isPrimary === true, 'sản phẩm đầu tiên phải tự thành primary')
    console.log('OK setCategoryProductsFromPg gán + tự đặt primary khi chưa có danh mục nào khác')

    // Gán thêm 1 category nữa cho sản phẩm này (không qua "set" mà qua assign trực tiếp, không primary)
    const assignOk = await assignInventoryToCategoryFromPg(partnerId, invId, l1.row.id, false)
    assert(assignOk, 'assignInventoryToCategoryFromPg thất bại')
    const cats2 = await fetchCategoryIdsForInventoryFromPg(invId)
    assert(cats2?.length === 2, 'sản phẩm phải thuộc 2 danh mục sau khi assign thêm')
    console.log('OK sản phẩm giờ thuộc 2 danh mục (nhiều-nhiều)')

    // Set lại danh sách category cho l3 = [] -> gỡ hết khỏi l3, nhưng vẫn còn ở l1
    const clearOk = await setCategoryProductsFromPg(partnerId, l3.row.id, [])
    assert(clearOk, 'clear category products thất bại')
    const cats3 = await fetchCategoryIdsForInventoryFromPg(invId)
    assert(cats3?.length === 1 && cats3[0].categoryId === l1.row.id, 'sau khi clear l3, sản phẩm phải chỉ còn ở l1')
    console.log('OK setCategoryProductsFromPg([]) gỡ đúng — không đụng category khác')

    // 8) Xóa: kiểm tra child count trước khi xóa "Quần" (đang có con "Áo thun")
    const childCount = await fetchPartnerCategoryChildCountFromPg(partnerId, quan.row.id)
    assert(childCount === 1, `child count sai: ${childCount}`)
    console.log('OK fetchPartnerCategoryChildCountFromPg trả đúng số con trực tiếp')

    const deleteOk = await deletePartnerCategoryFromPg(partnerId, quan.row.id)
    assert(deleteOk, 'xóa Quần thất bại')
    const l2AfterDelete = await fetchPartnerCategoryByIdFromPg(partnerId, l2.row.id)
    const l3AfterDelete = await fetchPartnerCategoryByIdFromPg(partnerId, l3.row.id)
    assert(l2AfterDelete === null && l3AfterDelete === null, 'xóa cha phải cascade xóa hết con cháu (FK on delete cascade)')
    console.log('OK xóa "Quần" cascade xóa luôn "Áo thun" + "Áo thun nam"')

    const catsAfterCascade = await fetchCategoryIdsForInventoryFromPg(invId)
    assert(catsAfterCascade?.length === 1 && catsAfterCascade[0].categoryId === l1.row.id, 'link sản phẩm phải cascade theo category bị xóa')
    console.log('OK liên kết sản phẩm↔category cascade đúng theo FK')

    // 9) Cây admin (đầy đủ, kèm productCount)
    const adminTree = await fetchPartnerCategoryTreeForAdminFromPg(partnerId)
    assert(Array.isArray(adminTree) && adminTree.length >= 2, 'cây admin phải còn Áo + Giày')
    const aoNode = adminTree?.find((n) => n.slug === 'ao')
    assert(aoNode?.productCount === 1, `productCount của "Áo" phải = 1, thực tế: ${aoNode?.productCount}`)
    console.log('OK fetchPartnerCategoryTreeForAdminFromPg trả đúng productCount')

    console.log('\n✅ ALL PHASE 2 (W4.4/W4.5) CHECKS PASSED')
  } finally {
    await pool.query(`delete from public.messaging_partners where id = $1::uuid`, [partnerId])
    await pool.end()
  }
}

main().catch((e) => {
  console.error('\n❌ TEST FAILED:', e.message)
  process.exit(1)
})
