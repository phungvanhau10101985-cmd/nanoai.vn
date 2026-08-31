import assert from 'node:assert/strict'
import test from 'node:test'
import { SHOP_DEMO_PRODUCTS, shopDemoSkuList } from '@/lib/messaging/shop-demo-catalog'
import {
  CATALOG_188_SNAPSHOT_KEYS,
  SHOP_DEMO_CATALOG_EXTRAS,
  SHOP_DEMO_COUNT,
  shopDemoCatalogSnapshot,
  shopDemoProductToCatalog188Fields,
} from '@/lib/messaging/shop-demo-catalog-188'
import {
  hydrateInventoryShopRowFromCatalog188,
  inventoryRowToShopProduct,
} from '@/lib/partner-website/shop/inventory-to-shop-product'

test('new shopping shops seed 9 fashion demo products (3+3+3)', () => {
  assert.equal(SHOP_DEMO_PRODUCTS.length, SHOP_DEMO_COUNT)
  assert.equal(shopDemoSkuList().length, 9)
  assert.deepEqual(
    SHOP_DEMO_PRODUCTS.map((p) => p.kind).sort(),
    ['clothing', 'clothing', 'clothing', 'handbags', 'handbags', 'handbags', 'shoes', 'shoes', 'shoes']
  )
  for (const product of SHOP_DEMO_PRODUCTS) {
    assert.ok(SHOP_DEMO_CATALOG_EXTRAS[product.sourceSku], product.sourceSku)
    assert.match(product.sku, /^DEMO-188-/)
    assert.ok(product.colors.length >= 2, product.sku)
    assert.ok(product.mainImage, product.sku)
    assert.ok(product.galleryUrls.length >= 3, product.sku)
    assert.ok(product.detailImageUrls.length >= 1, product.sku)
    assert.ok(product.category.parent.slug, product.sku)
    assert.ok(product.category.child.slug, product.sku)
  }
})

test('each demo product maps every catalog 188 snapshot field', () => {
  for (const product of SHOP_DEMO_PRODUCTS) {
    const snap = shopDemoCatalogSnapshot(product, SHOP_DEMO_PRODUCTS)
    for (const key of CATALOG_188_SNAPSHOT_KEYS) {
      assert.notEqual(snap[key], undefined, `${product.sku} missing ${key}`)
    }
    assert.equal(snap.origin, 'Trung Quốc')
    assert.ok(snap.brand_name)
    assert.ok(snap.chinese_name)
    assert.ok(snap.shop_name)
    assert.ok(snap.shop_name_chinese)
    assert.ok(snap.sub_subcategory)
    assert.ok(snap.style)
    assert.ok(snap.occasion)
    assert.ok(snap.weight)
    assert.ok(snap.features.length >= 2)
    assert.ok(snap.likes > 0)
    assert.ok(snap.purchases > 0)
    assert.ok(snap.rating_point >= 4)
    const info = snap.product_info as Record<string, unknown> | null
    assert.ok(info?.product_info)
    assert.ok(info?.specifications)
    assert.ok(info?.variants)
    assert.ok(info?.target_audience)
    assert.ok(info?.market_info)
    const specs = info?.specifications as Record<string, unknown> | undefined
    assert.ok(Array.isArray(specs?.features) && specs.features.length >= 2)
    const market = info?.market_info as Record<string, unknown> | undefined
    assert.equal(market?.lead_time_days, 3)
  }
})

test('demo catalog fields hydrate a live PDP row like 188 inventory', () => {
  const product = SHOP_DEMO_PRODUCTS.find((p) => p.sourceSku === 'O7073')
  assert.ok(product)
  const catalog = shopDemoProductToCatalog188Fields(product, SHOP_DEMO_PRODUCTS)
  const mapped = inventoryRowToShopProduct(
    'demo-shop',
    hydrateInventoryShopRowFromCatalog188({
      id: '66666666-6666-4666-8666-666666666666',
      name: product.name,
      sku: product.sku,
      image_url: product.mainImage,
      description: product.description,
      catalog_json: catalog.catalog_json,
      brand_name: catalog.brand_name,
      source_origin: catalog.source_origin,
      material_note: catalog.material_note,
      style: catalog.style,
      occasion: catalog.occasion,
      likes_count: catalog.likes_count,
      purchases_count: catalog.purchases_count,
      reviews_count: catalog.reviews_count,
      rating_score: catalog.rating_score,
      product_info_json: catalog.product_info_json,
      gallery_urls: catalog.gallery_urls,
      detail_image_urls: catalog.detail_image_urls,
      sizes_json: catalog.sizes,
      colors_json: catalog.colors,
      category_l1: catalog.category_l1,
      category_l2: catalog.category_l2,
      category_l3: catalog.category_l3,
    }),
    { pdp: true }
  )
  assert.equal(mapped?.brandName, '188 Fashion')
  assert.equal(mapped?.origin, 'Trung Quốc')
  assert.equal(mapped?.style, 'Tiểu thư / Hàn Quốc')
  assert.equal(mapped?.categoryL3, 'Đầm voan trễ vai Nữ')
  assert.ok((mapped?.likesCount || 0) > 0)
  assert.ok((mapped?.purchasesCount || 0) > 0)
  assert.ok(mapped?.productInfo && typeof mapped.productInfo === 'object')
  assert.ok((mapped?.galleryImages || []).length >= 3)
  assert.ok((mapped?.detailImages || []).length >= 4)
  assert.ok(mapped?.chineseName)
  assert.ok(mapped?.weight)
  assert.ok((mapped?.features || []).length >= 2)
  const info = mapped?.productInfo as Record<string, unknown> | undefined
  assert.ok(info?.target_audience)
  assert.ok(info?.market_info)
  assert.deepEqual(mapped?.sizes, ['S', 'M', 'L', 'XL'])
})
