/**
 * Seed sample inventory items for a partner slug (local dev).
 * Includes size/color JSON, detail description, and detail images for shop PDP.
 * Usage: node scripts/seed-sample-inventory.mjs 188-com-vn-u560
 */
import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { pgQuery, pgQueryRaw, pgEnd } from './pg-query.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvFile(name) {
  const p = join(root, name)
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const k = trimmed.slice(0, eq).trim()
    let v = trimmed.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

const slug = process.argv[2]?.trim()
if (!slug) {
  console.error('Usage: node scripts/seed-sample-inventory.mjs <partner-slug>')
  process.exit(1)
}

const SAMPLES = [
  {
    name: 'Áo thun cotton basic',
    sku: 'DEMO-TSHIRT-WHT',
    description: JSON.stringify(['S', 'M', 'L', 'XL']),
    stock_note: JSON.stringify([
      { name: 'Trắng', img: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80' },
      { name: 'Đen', img: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&q=80' },
      { name: 'Xám', img: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&q=80' },
    ]),
    consult_note: 'Áo thun 100% cotton, form regular, phù hợp đi làm và dạo phố.',
    material_note:
      'Chất liệu cotton 100% thoáng mát, co giãn nhẹ khi mặc.\n\n' +
      'Form regular vừa vặn, cổ tròn bo viền chắc chắn. May 2 kim, đường chỉ đều.\n\n' +
      'Hướng dẫn bảo quản: giặt máy 30°C, lộn trái khi giặt, không tẩy mạnh.',
    material_detail_image_url: 'https://images.unsplash.com/photo-1622445275463-afa2ab1c20ea?w=800&q=80',
    real_use_image_url: 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=800&q=80',
    real_use_image_url_2: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=800&q=80',
    stock_qty: 48,
    price_hint: '299.000đ',
    image_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80',
    product_url: 'https://188.com.vn/ao-thun-cotton-basic-trang',
    sort_order: 1,
  },
  {
    name: 'Quần jean slim fit',
    sku: 'DEMO-JEAN-SLIM',
    description: JSON.stringify(['28', '29', '30', '31', '32', '33', '34']),
    stock_note: JSON.stringify([
      { name: 'Xanh đậm', img: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&q=80' },
      { name: 'Xanh nhạt', img: 'https://images.unsplash.com/photo-1473966968600-fa801b279a7a?w=800&q=80' },
      { name: 'Đen', img: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&q=80' },
    ]),
    consult_note: 'Jean co giãn nhẹ, ống slim, màu indigo classic.',
    material_note:
      'Denim cotton co giãn 2 chiều, giữ form slim suốt ngày dài.\n\n' +
      'Khóa kéo YKK, túi 5 túi chuẩn, đường may lockstitch bền.\n\n' +
      'Phối được với áo thun, sơ mi hoặc blazer cho smart casual.',
    material_detail_image_url: 'https://images.unsplash.com/photo-1604176354204-d352ae807f6a?w=800&q=80',
    real_use_image_url: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&q=80',
    real_use_image_url_2: 'https://images.unsplash.com/photo-1473966968600-fa801b279a7a?w=800&q=80',
    stock_qty: 32,
    price_hint: '649.000đ',
    image_url: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&q=80',
    product_url: 'https://188.com.vn/quan-jean-slim-fit-xanh-dam',
    sort_order: 2,
  },
  {
    name: 'Giày sneaker da',
    sku: 'DEMO-SNEAKER-WHT',
    description: JSON.stringify(['35', '36', '37', '38', '39', '40', '41', '42', '43', '44']),
    stock_note: JSON.stringify([
      { name: 'Trắng', img: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&q=80' },
      { name: 'Đen', img: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80' },
      { name: 'Xám', img: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=800&q=80' },
      { name: 'Navy', img: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=800&q=80' },
      { name: 'Be', img: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&q=80' },
      { name: 'Đỏ', img: 'https://images.unsplash.com/photo-1460353589841-842a72525b39?w=800&q=80' },
    ]),
    consult_note: 'Sneaker da tổng hợp, đế cao su chống trượt. Size 35–44, đủ màu cơ bản.',
    material_note:
      'Upper da tổng hợp cao cấp, lót mesh thoáng khí, đệm EVA êm chân.\n\n' +
      'Đế cao su chống trượt, gót cố định ổn định khi di chuyển. Trọng lượng nhẹ ~280g/size 42.\n\n' +
      'Phù hợp đi làm, dạo phố, du lịch. Vệ sinh bằng khăn ẩm, tránh ngâm nước lâu.',
    material_detail_image_url: 'https://images.unsplash.com/photo-1605348532640-c3751f6be311?w=800&q=80',
    real_use_image_url: 'https://images.unsplash.com/photo-1460353589841-842a72525b39?w=800&q=80',
    real_use_image_url_2: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&q=80',
    stock_qty: 120,
    price_hint: '890.000đ',
    image_url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&q=80',
    product_url: 'https://188.com.vn/giay-sneaker-da-trang',
    sort_order: 3,
  },
  {
    name: 'Dép quai ngang unisex',
    sku: 'DEMO-SANDAL',
    description: JSON.stringify(['36', '37', '38', '39', '40', '41', '42', '43']),
    stock_note: JSON.stringify([
      { name: 'Đen', img: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd1?w=800&q=80' },
      { name: 'Nâu', img: 'https://images.unsplash.com/photo-1603487742161-0a8652471370?w=800&q=80' },
      { name: 'Be', img: 'https://images.unsplash.com/photo-1608256246200-d53e180114a0?w=800&q=80' },
      { name: 'Xanh navy', img: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=800&q=80' },
      { name: 'Trắng', img: 'https://images.unsplash.com/photo-1603487742161-0a8652471370?w=800&q=80' },
      { name: 'Xám', img: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80' },
    ]),
    consult_note: 'Dép quai ngang êm chân, đế chống trượt. Size 36–43, 6 màu.',
    material_note:
      'Quai EVA mềm, không cọ xát da chân. Đế PU chống trượt, thoát nước nhanh.\n\n' +
      'Thiết kế unisex, phù hợp đi biển, dạo phố, mang trong nhà.\n\n' +
      'Rửa nước sạch, phơi nơi thoáng mát — không phơi nắng gắt.',
    material_detail_image_url: 'https://images.unsplash.com/photo-1603487742161-0a8652471370?w=800&q=80',
    real_use_image_url: 'https://images.unsplash.com/photo-1608256246200-d53e180114a0?w=800&q=80',
    real_use_image_url_2: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd1?w=800&q=80',
    stock_qty: 96,
    price_hint: '189.000đ',
    image_url: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd1?w=800&q=80',
    product_url: 'https://188.com.vn/dep-quai-ngang-unisex',
    sort_order: 6,
  },
  {
    name: 'Giày lười da nam',
    sku: 'DEMO-LOAFER',
    description: JSON.stringify(['38', '39', '40', '41', '42', '43', '44', '45']),
    stock_note: JSON.stringify([
      { name: 'Đen', img: 'https://images.unsplash.com/photo-1533860486412-8353c473625a?w=800&q=80' },
      { name: 'Nâu', img: 'https://images.unsplash.com/photo-1614252238956-1c5d3a5aeb13?w=800&q=80' },
      { name: 'Burgundy', img: 'https://images.unsplash.com/photo-1614252238956-1c5d3a5aeb13?w=800&q=80' },
      { name: 'Xanh navy', img: 'https://images.unsplash.com/photo-1614252238956-1c5d3a5aeb13?w=800&q=80' },
      { name: 'Be', img: 'https://images.unsplash.com/photo-1533860486412-8353c473625a?w=800&q=80' },
    ]),
    consult_note: 'Giày lười da bò, form classic. Size 38–45, phù hợp công sở smart casual.',
    material_note:
      'Da bò thật phủ PU, lót da lộn êm. Form classic dễ mang, không cần buộc dây.\n\n' +
      'Đế cao su chống trượt, gót ~2cm vừa phải. Phù hợp sơ mi, quần tây, chinos.\n\n' +
      'Bảo quản: lau khô, dùng xi đánh giày định kỳ, tránh mưa lớn.',
    material_detail_image_url: 'https://images.unsplash.com/photo-1614252238956-1c5d3a5aeb13?w=800&q=80',
    real_use_image_url: 'https://images.unsplash.com/photo-1533860486412-8353c473625a?w=800&q=80',
    real_use_image_url_2: 'https://images.unsplash.com/photo-1614252238956-1c5d3a5aeb13?w=800&q=80',
    stock_qty: 64,
    price_hint: '1.290.000đ',
    image_url: 'https://images.unsplash.com/photo-1533860486412-8353c473625a?w=800&q=80',
    product_url: 'https://188.com.vn/giay-luoi-da-nam',
    sort_order: 7,
  },
  {
    name: 'Túi tote canvas',
    sku: 'DEMO-TOTE-BE',
    description: JSON.stringify(['One size']),
    stock_note: JSON.stringify([
      { name: 'Be', img: 'https://images.unsplash.com/photo-1590874103328-eac38a683008?w=800&q=80' },
      { name: 'Đen', img: 'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?w=800&q=80' },
    ]),
    consult_note: 'Túi tote canvas bền, quai da giả, dung tích ~12L.',
    material_note:
      'Canvas 12oz chắc chắn, quai da PU bền, may đôi đường chỉ.\n\n' +
      'Dung tích ~12L, đựng laptop 14", sách, phụ kiện hằng ngày.\n\n' +
      'Có thể giặt tay nhẹ, phơi khô tự nhiên.',
    material_detail_image_url: 'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?w=800&q=80',
    real_use_image_url: 'https://images.unsplash.com/photo-1590874103328-eac38a683008?w=800&q=80',
    real_use_image_url_2: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=80',
    stock_qty: 15,
    price_hint: '249.000đ',
    image_url: 'https://images.unsplash.com/photo-1590874103328-eac38a683008?w=800&q=80',
    product_url: 'https://188.com.vn/tui-tote-canvas-be',
    sort_order: 4,
  },
  {
    name: 'Áo khoác gió chống nước',
    sku: 'DEMO-WIND-JKT',
    description: JSON.stringify(['M', 'L', 'XL', 'XXL']),
    stock_note: JSON.stringify([
      { name: 'Đen', img: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&q=80' },
      { name: 'Navy', img: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80' },
      { name: 'Xám', img: 'https://images.unsplash.com/photo-1594938298605-cd8d5a4f3c6f?w=800&q=80' },
    ]),
    consult_note: 'Áo gió nhẹ, chống nước nhẹ, gấp gọn trong túi.',
    material_note:
      'Vải polyester ripstop chống gió, phủ DWR chống nước nhẹ.\n\n' +
      'Gấp gọn vào túi ngực, trọng lượng ~220g. Túi kéo 2 bên + 1 túi ngực.\n\n' +
      'Phù hợp du lịch, chạy bộ sáng sớm, đi xe máy mùa mưa phùn.',
    material_detail_image_url: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80',
    real_use_image_url: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&q=80',
    real_use_image_url_2: 'https://images.unsplash.com/photo-1594938298605-cd8d5a4f3c6f?w=800&q=80',
    stock_qty: 12,
    price_hint: '520.000đ',
    image_url: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&q=80',
    product_url: 'https://188.com.vn/ao-khoac-gio-chong-nuoc',
    sort_order: 5,
  },
]

async function upsertItem(partnerId, item, now) {
  const existing = await pgQuery(
    `select id::text from public.messaging_partner_inventory
     where partner_id = $1::uuid and sku = $2 limit 1`,
    [partnerId, item.sku]
  )

  const params = [
    partnerId,
    item.sku,
    item.name,
    item.description,
    item.stock_note,
    item.stock_qty,
    item.price_hint,
    item.image_url,
    item.product_url,
    item.consult_note,
    item.material_note ?? '',
    item.material_detail_image_url ?? '',
    item.real_use_image_url ?? '',
    item.real_use_image_url_2 ?? '',
    item.product_video_url ?? '',
    item.sort_order,
    now,
  ]

  if (existing.length) {
    await pgQueryRaw(
      `update public.messaging_partner_inventory set
        name = $3, description = $4, stock_note = $5, stock_qty = $6::int, price_hint = $7,
        image_url = $8, product_url = $9, consult_note = $10,
        material_note = $11, material_detail_image_url = $12,
        real_use_image_url = $13, real_use_image_url_2 = $14, product_video_url = $15,
        sort_order = $16, updated_at = $17::timestamptz
       where partner_id = $1::uuid and sku = $2`,
      params
    )
    return { action: 'updated', id: existing[0].id }
  }

  const res = await pgQueryRaw(
    `insert into public.messaging_partner_inventory (
      partner_id, name, sku, description, stock_note, stock_qty, price_hint,
      image_url, product_url, consult_note, material_note, material_detail_image_url,
      real_use_image_url, real_use_image_url_2, product_video_url,
      sort_order, is_active, created_at, updated_at
    ) values (
      $1::uuid, $2, $3, $4, $5, $6::int, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, true, $17::timestamptz, $17::timestamptz
    ) returning id::text as id`,
    params
  )
  return { action: 'inserted', id: res.rows[0]?.id }
}

async function main() {
  const partners = await pgQuery(
    `select id::text as partner_id, slug, display_name
     from public.messaging_partners where slug = $1 limit 1`,
    [slug]
  )
  if (!partners.length) {
    console.error(`Partner not found: ${slug}`)
    process.exit(1)
  }
  const partnerId = partners[0].partner_id
  console.log('Partner:', partners[0])

  const websites = await pgQuery(
    `select site_slug, is_published from public.messaging_partner_websites where partner_id = $1::uuid`,
    [partnerId]
  )
  console.log('Website:', websites[0] ?? '(none)')

  const now = new Date().toISOString()
  let inserted = 0
  let updated = 0

  for (const item of SAMPLES) {
    const result = await upsertItem(partnerId, item, now)
    console.log(`${result.action}: ${item.name} → ${result.id}`)
    if (result.action === 'inserted') inserted++
    else updated++
  }

  const total = await pgQuery(
    `select count(*)::int as cnt from public.messaging_partner_inventory where partner_id = $1::uuid and coalesce(is_active,true)`,
    [partnerId]
  )
  console.log(`Done. inserted=${inserted}, updated=${updated}, active inventory=${total[0]?.cnt}`)
  if (websites[0]?.site_slug) {
    const demo = await pgQuery(
      `select sku, id::text from public.messaging_partner_inventory
       where partner_id = $1::uuid and sku = 'DEMO-SNEAKER-WHT'`,
      [partnerId]
    )
    if (demo[0]?.id) {
      console.log(`Sample PDP: /site/${websites[0].site_slug}/products/${demo[0].id}`)
    }
    console.log(`Catalog: /site/${websites[0].site_slug}/products`)
  }
  await pgEnd()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
