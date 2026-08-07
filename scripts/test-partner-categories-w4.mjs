// Smoke test W4.1/W4.2: tạo cây danh mục, gán sản phẩm, kiểm tra cách ly tenant + tương thích ngược (W4.3).
// Chạy: node scripts/test-partner-categories-w4.mjs
import pg from 'pg'
import { config } from 'dotenv'

config({ path: '.env.local' })

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const client = await pool.connect()
  try {
    console.log('== W4 smoke test ==')

    // 0) Chuẩn bị 2 partner test độc lập (mô phỏng multi-tenant) — dùng bảng messaging_partners thật.
    const ownerRes = await client.query(
      `select id from auth.users limit 1`
    )
    if (!ownerRes.rows.length) throw new Error('Cần ít nhất 1 user trong auth.users để test owner_user_id')
    const ownerId = ownerRes.rows[0].id

    const p1 = await client.query(
      `insert into public.messaging_partners (owner_user_id, display_name, slug)
       values ($1, 'W4 Test Shop A', 'w4-test-shop-a-' || substr(gen_random_uuid()::text,1,8))
       returning id`,
      [ownerId]
    )
    const p2 = await client.query(
      `insert into public.messaging_partners (owner_user_id, display_name, slug)
       values ($1, 'W4 Test Shop B', 'w4-test-shop-b-' || substr(gen_random_uuid()::text,1,8))
       returning id`,
      [ownerId]
    )
    const partnerA = p1.rows[0].id
    const partnerB = p2.rows[0].id
    console.log('Partner A:', partnerA)
    console.log('Partner B:', partnerB)

    // 1) Tạo cây danh mục cho Partner A: Áo (L1) -> Áo thun (L2)
    const l1 = await client.query(
      `insert into public.messaging_partner_categories (partner_id, name, slug, path, depth)
       values ($1::uuid, 'Áo', 'ao', 'ao', 1)
       returning id, path, depth`,
      [partnerA]
    )
    console.log('L1 created:', l1.rows[0])

    const l2 = await client.query(
      `insert into public.messaging_partner_categories (partner_id, parent_id, name, slug, path, depth)
       values ($1::uuid, $2::uuid, 'Áo thun', 'ao-thun', 'ao/ao-thun', 2)
       returning id, path, depth`,
      [partnerA, l1.rows[0].id]
    )
    console.log('L2 created:', l2.rows[0])

    // 2) Trùng slug cùng cha -> phải lỗi unique
    let dupFailed = false
    try {
      await client.query(
        `insert into public.messaging_partner_categories (partner_id, parent_id, name, slug, path, depth)
         values ($1::uuid, $2::uuid, 'Áo thun 2', 'ao-thun', 'ao/ao-thun', 2)`,
        [partnerA, l1.rows[0].id]
      )
    } catch (e) {
      dupFailed = true
      console.log('OK duplicate slug rejected:', e.code === '23505')
    }
    if (!dupFailed) throw new Error('FAIL: trùng slug cùng cha không bị chặn')

    // 3) Category cha khác partner -> phải bị trigger chặn
    let crossTenantFailed = false
    try {
      await client.query(
        `insert into public.messaging_partner_categories (partner_id, parent_id, name, slug, path, depth)
         values ($1::uuid, $2::uuid, 'Hack', 'hack', 'hack', 2)`,
        [partnerB, l1.rows[0].id]
      )
    } catch (e) {
      crossTenantFailed = true
      console.log('OK cross-tenant parent rejected:', /partner_id/.test(e.message))
    }
    if (!crossTenantFailed) throw new Error('FAIL: parent khác partner không bị chặn')

    // 4) Tạo 1 sản phẩm test cho Partner A, gán vào L2, đặt primary
    const inv = await client.query(
      `insert into public.messaging_partner_inventory (partner_id, name, price_hint)
       values ($1::uuid, 'Áo thun test W4', '199k')
       returning id`,
      [partnerA]
    )
    const invId = inv.rows[0].id
    await client.query(
      `insert into public.messaging_partner_inventory_categories (inventory_id, category_id, is_primary)
       values ($1::uuid, $2::uuid, true)`,
      [invId, l2.rows[0].id]
    )
    console.log('OK assigned inventory to category with is_primary=true')

    // 5) Gán thêm 1 danh mục phụ (không primary) -> vẫn ok (nhiều-nhiều)
    await client.query(
      `insert into public.messaging_partner_inventory_categories (inventory_id, category_id, is_primary)
       values ($1::uuid, $2::uuid, false)`,
      [invId, l1.rows[0].id]
    )
    console.log('OK assigned same inventory to a second category (many-to-many)')

    // 6) Thử đặt primary thứ 2 -> phải bị chặn (unique partial index)
    let secondPrimaryFailed = false
    try {
      await client.query(
        `insert into public.messaging_partner_inventory_categories (inventory_id, category_id, is_primary)
         values ($1::uuid, $2::uuid, true)
         on conflict (inventory_id, category_id) do nothing`,
        [invId, l1.rows[0].id]
      )
      // Force a real second-primary row via update path check instead:
      await client.query(
        `update public.messaging_partner_inventory_categories
         set is_primary = true
         where inventory_id = $1::uuid and category_id = $2::uuid`,
        [invId, l1.rows[0].id]
      )
    } catch (e) {
      secondPrimaryFailed = true
      console.log('OK second primary rejected:', e.code === '23505')
    }
    if (!secondPrimaryFailed) throw new Error('FAIL: 2 danh mục chính cho cùng 1 sản phẩm không bị chặn')

    // 7) Inventory và category khác partner -> trigger phải chặn
    const invB = await client.query(
      `insert into public.messaging_partner_inventory (partner_id, name, price_hint)
       values ($1::uuid, 'SP shop B', '99k')
       returning id`,
      [partnerB]
    )
    let crossAssignFailed = false
    try {
      await client.query(
        `insert into public.messaging_partner_inventory_categories (inventory_id, category_id, is_primary)
         values ($1::uuid, $2::uuid, false)`,
        [invB.rows[0].id, l2.rows[0].id]
      )
    } catch (e) {
      crossAssignFailed = true
      console.log('OK cross-tenant inventory<->category assign rejected:', /partner_id/.test(e.message))
    }
    if (!crossAssignFailed) throw new Error('FAIL: gán sản phẩm/category khác partner không bị chặn')

    // 8) W4.3 — bảng inventory hiện có KHÔNG bị đổi cột; route /products cũ vẫn chạy được với shop
    //    CHƯA có category nào (Partner B chưa tạo category nào ở bước trên).
    const hasCatB = await client.query(
      `select exists(select 1 from public.messaging_partner_categories where partner_id = $1::uuid) as e`,
      [partnerB]
    )
    console.log('Partner B has categories (phải là false — W4.3 backward-compat):', hasCatB.rows[0].e)
    if (hasCatB.rows[0].e !== false) throw new Error('FAIL: Partner B không nên có category nào')

    const invColsCheck = await client.query(
      `select count(*)::int as c from information_schema.columns
       where table_schema='public' and table_name='messaging_partner_inventory'
         and column_name in ('category_id','category')`
    )
    console.log(
      'Bảng inventory không có cột category mới (phải = 0 — không đổi schema cũ):',
      invColsCheck.rows[0].c
    )
    if (invColsCheck.rows[0].c !== 0) throw new Error('FAIL: inventory bị thêm cột category ngoài kế hoạch')

    // 9) Cleanup
    await client.query(`delete from public.messaging_partners where id = any($1::uuid[])`, [
      [partnerA, partnerB],
    ])
    console.log('Cleanup done (cascade xoá category + inventory + links theo FK).')

    console.log('\n✅ ALL W4.1/W4.2 CHECKS PASSED')
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((e) => {
  console.error('\n❌ TEST FAILED:', e.message)
  process.exit(1)
})
