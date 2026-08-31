import { SHOP_DEMO_PRODUCTS, type ShopDemoProduct } from '@/lib/messaging/shop-demo-catalog'
import { SHOP_DEMO_CATALOG_EXTRAS, shopDemoProductToCatalog188Fields } from '@/lib/messaging/shop-demo-catalog-188'
import type { LivePdpBindProduct } from '@/lib/partner-website/shop/bind-live-product-to-pdp-html'
import { formatVnd } from '@/lib/partner-website/shop/cart-line-utils'
import {
  hydrateInventoryShopRowFromCatalog188,
  inventoryRowToShopProduct,
  type PartnerSiteShopProduct,
} from '@/lib/partner-website/shop/inventory-to-shop-product'
import {
  classifyOutfitAnchor,
  outfitSectionTitle,
  outfitSlotLabel,
  rowMatchesOutfitSlot,
  slotsForOutfitAnchor,
} from '@/lib/partner-website/shop/pdp-outfit-roles'

function demoBySourceSku(sourceSku: string): ShopDemoProduct | undefined {
  return SHOP_DEMO_PRODUCTS.find((p) => p.sourceSku === sourceSku)
}

function uniqueUrls(urls: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of urls) {
    const url = String(raw || '').trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    out.push(url)
  }
  return out
}

function demoBindId(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

const BIND_ID_BY_SKU: Record<string, string> = {
  O7073: demoBindId(1),
  Z2008: demoBindId(2),
  Q7349: demoBindId(3),
  O3837: demoBindId(4),
  P9508: demoBindId(5),
  Q0927: demoBindId(6),
  L4701: demoBindId(7),
  G3817: demoBindId(8),
  H9090: demoBindId(9),
}

/** Clothing sample with sizes + colors + gallery — editor layout, not inventory. */
const SOURCE =
  demoBySourceSku('O7073') ||
  SHOP_DEMO_PRODUCTS.find((p) => p.kind === 'clothing' && p.sizes.length > 0 && p.colors.length > 0) ||
  SHOP_DEMO_PRODUCTS[0]

const RELATED_SKUS = ['Z2008', 'Q7349', 'O3837'] as const

/** Keep the editor carousel light: a few gallery shots, not every color URL. */
const EDITOR_GALLERY_MAX = 4

/**
 * Local 188 shop rows that are “full” (K3699 / G1571…) all have a playable `.mp4`.
 * Seed O7073 has no `video_link`; Sửa nhanh still needs the video slot like live PDP.
 * G1571 is a dress on the same local catalog — sample media only, not inventory.
 */
const EDITOR_SAMPLE_VIDEO_URL = 'https://cdn.188.com.vn/G1571_1765961958_1.mp4'

const DEMO_PDP_SKU = 'DEMO-PDP-001'
const LIST_PRICE_AMOUNT = 350_000

function withDemoSku(info: Record<string, unknown> | null | undefined, sku: string): Record<string, unknown> | null {
  if (!info || typeof info !== 'object') return info ?? null
  const nested = info.product_info
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return { ...info, product_info: { ...(nested as Record<string, unknown>), sku } }
  }
  return info
}

function shopDemoToPdpProduct(
  product: ShopDemoProduct,
  opts: {
    id: string
    sku: string
    videoUrl?: string | null
    stockQty?: number
    priceAmount?: number
    salePriceAmount?: number
    depositRequired?: boolean
  }
): PartnerSiteShopProduct | null {
  const catalog = shopDemoProductToCatalog188Fields(product, SHOP_DEMO_PRODUCTS)
  const sale = opts.salePriceAmount ?? product.priceAmount
  const list = opts.priceAmount ?? product.priceAmount
  const onSale = sale > 0 && list > sale
  return inventoryRowToShopProduct(
    'demo-shop',
    hydrateInventoryShopRowFromCatalog188({
      id: opts.id,
      name: product.name,
      sku: opts.sku,
      image_url: product.mainImage,
      description: product.description,
      consult_note: product.consultNote,
      material_note: product.material,
      material_detail_image_url: product.materialDetailImageUrl,
      real_use_image_url: product.realUseImageUrl,
      real_use_image_url_2: product.realUseImageUrl2,
      product_video_url: opts.videoUrl ?? catalog.catalog_json.video_link,
      price_hint: formatVnd(onSale ? sale : list),
      price_amount: list,
      sale_price_amount: onSale ? sale : null,
      sale_starts_at: onSale ? '2020-01-01T00:00:00.000Z' : null,
      sale_ends_at: onSale ? '2099-12-31T00:00:00.000Z' : null,
      stock_qty: opts.stockQty ?? product.stockQty,
      catalog_json: catalog.catalog_json,
      brand_name: catalog.brand_name,
      source_origin: catalog.source_origin,
      chinese_name: catalog.chinese_name,
      deposit_required: opts.depositRequired ?? catalog.deposit_required,
      category_l1: catalog.category_l1,
      category_l2: catalog.category_l2,
      category_l3: catalog.category_l3,
      likes_count: catalog.likes_count,
      purchases_count: catalog.purchases_count,
      reviews_count: catalog.reviews_count,
      questions_count: catalog.questions_count,
      rating_score: catalog.rating_score,
      product_info_json: catalog.product_info_json,
      gallery_urls: product.galleryUrls,
      detail_image_urls: product.detailImageUrls,
      sizes_json: product.sizes,
      colors_json: product.colors,
      style: catalog.style,
      occasion: catalog.occasion,
      weight: catalog.weight,
      color_summary: catalog.color_summary,
      features_json: catalog.features_json,
      source_shop_name: catalog.source_shop_name,
      source_shop_name_chinese: catalog.source_shop_name_chinese,
      catalog_slug: catalog.catalog_slug,
      sizeGuideImageUrl: product.materialDetailImageUrl,
    }),
    { pdp: true }
  )
}

function relatedBindCards(): NonNullable<LivePdpBindProduct['relatedProducts']> {
  return RELATED_SKUS.map((sku) => {
    const product = demoBySourceSku(sku)
    if (!product) return null
    return {
      id: BIND_ID_BY_SKU[sku] || demoBindId(0),
      name: product.name,
      imageUrl: product.mainImage,
      priceHint: formatVnd(product.priceAmount),
    }
  }).filter((p): p is NonNullable<typeof p> => Boolean(p))
}

function outfitBindFromDemos(source: ShopDemoProduct): Pick<LivePdpBindProduct, 'outfitTitle' | 'outfitSlots'> {
  const extra = SHOP_DEMO_CATALOG_EXTRAS[source.sourceSku]
  const classified = classifyOutfitAnchor([
    source.name,
    source.category.parent.name,
    source.category.child.name,
    extra?.l3.name,
    extra?.gender,
  ])
  if (!classified.role) return { outfitTitle: outfitSectionTitle(null, 'vi'), outfitSlots: [] }
  const others = SHOP_DEMO_PRODUCTS.filter((p) => p.sourceSku !== source.sourceSku)
  const slots = slotsForOutfitAnchor(classified.role, classified.gender)
    .map((id) => {
      const items = others.filter((p) => {
        const peerExtra = SHOP_DEMO_CATALOG_EXTRAS[p.sourceSku]
        return rowMatchesOutfitSlot(
          id,
          p.name,
          p.category.parent.name,
          p.category.child.name,
          peerExtra?.l3.name
        )
      })
      if (!items.length) return null
      return {
        id,
        label: outfitSlotLabel(id, 'vi'),
        listingHref: '#',
        items: items.map((p) => ({
          id: BIND_ID_BY_SKU[p.sourceSku] || p.sku,
          name: p.name,
          imageUrl: p.mainImage,
          priceHint: formatVnd(p.priceAmount),
        })),
      }
    })
    .filter((slot): slot is NonNullable<typeof slot> => Boolean(slot))
  return {
    outfitTitle: outfitSectionTitle(classified.role, 'vi'),
    outfitSlots: slots,
  }
}

function buildDemoPdpBindProduct(): LivePdpBindProduct {
  const mapped = shopDemoToPdpProduct(SOURCE, {
    id: BIND_ID_BY_SKU[SOURCE.sourceSku] || demoBindId(1),
    sku: DEMO_PDP_SKU,
    videoUrl: EDITOR_SAMPLE_VIDEO_URL,
    stockQty: 4,
    priceAmount: LIST_PRICE_AMOUNT,
    salePriceAmount: SOURCE.priceAmount,
    depositRequired: true,
  })
  if (!mapped) {
    throw new Error('[demo-pdp-bind-product] failed to map O7073 catalog fields')
  }
  const extra = SHOP_DEMO_CATALOG_EXTRAS[SOURCE.sourceSku]
  const outfit = outfitBindFromDemos(SOURCE)
  const galleryImages = uniqueUrls([mapped.imageUrl, ...(mapped.galleryImages || [])]).slice(0, EDITOR_GALLERY_MAX)
  return {
    id: mapped.id,
    name: mapped.name,
    sku: DEMO_PDP_SKU,
    description: mapped.description,
    detailDescription: mapped.detailDescription,
    consultNote: mapped.consultNote,
    priceHint: mapped.priceHint,
    priceAmount: mapped.priceAmount,
    salePriceAmount: mapped.salePriceAmount,
    saleStartsAt: mapped.saleStartsAt,
    saleEndsAt: mapped.saleEndsAt,
    imageUrl: mapped.imageUrl,
    galleryImages,
    detailImages: uniqueUrls(mapped.detailImages),
    materialImageUrl: mapped.materialImageUrl,
    realUseImageUrls: uniqueUrls(mapped.realUseImageUrls),
    productVideoUrl: mapped.productVideoUrl,
    sizeGuideImageUrl: mapped.sizeGuideImageUrl,
    depositPolicy: mapped.depositPolicy,
    stockQty: mapped.stockQty,
    brandName: mapped.brandName,
    origin: mapped.origin,
    material: mapped.material,
    style: mapped.style,
    occasion: mapped.occasion,
    weight: mapped.weight,
    features: mapped.features,
    chineseName: mapped.chineseName,
    colorSummary: mapped.colorSummary,
    likesCount: mapped.likesCount,
    purchasesCount: mapped.purchasesCount,
    reviewsCount: mapped.reviewsCount,
    ratingScore: mapped.ratingScore,
    questionsCount: mapped.questionsCount,
    productInfo: withDemoSku(mapped.productInfo, DEMO_PDP_SKU),
    categoryL1: mapped.categoryL1,
    categoryL2: mapped.categoryL2,
    categoryL3: mapped.categoryL3,
    categoryPath: extra
      ? `${SOURCE.category.parent.slug}/${SOURCE.category.child.slug}/${extra.l3.slug}`
      : `${SOURCE.category.parent.slug}/${SOURCE.category.child.slug}`,
    sizes: mapped.sizes,
    colors: mapped.colors,
    breadcrumb: [
      { name: mapped.categoryL1 || SOURCE.category.parent.name, href: '#' },
      { name: mapped.categoryL2 || SOURCE.category.child.name, href: '#' },
      { name: mapped.categoryL3 || extra?.l3.name || SOURCE.category.child.name, href: '#' },
    ],
    reviews: [
      {
        name: 'Lan',
        rating: 5,
        title: 'Đúng form',
        body: 'Form đẹp, vải mềm, đúng size M. Ảnh sát thực tế.',
        imageUrls: [SOURCE.realUseImageUrl || SOURCE.mainImage],
        merchantReply: 'Cảm ơn chị đã ủng hộ shop!',
        merchantReplyBy: 'Shop',
        usefulCount: 3,
      },
      {
        name: 'Minh Anh',
        rating: 4,
        title: 'Màu kem dịu',
        body: 'Màu kem dịu, giao nhanh. Nên +1 size nếu thích rộng.',
        imageUrls: [],
        usefulCount: 1,
      },
    ],
    questions: [
      {
        asker: 'Hương',
        body: 'Đầm có lót trong không ạ? Mặc có xuyên không?',
        answer: 'Dạ có lót mỏng, không xuyên. Chị chọn đúng size là vừa đẹp.',
        answerBy: 'Shop',
        answerType: 'admin',
      },
      {
        asker: 'Trang',
        body: 'Chiều cao 1m58, 48kg nên lấy size nào?',
        answer: 'Chị lấy size S giúp em ạ.',
        answerBy: 'Lan',
        answerType: 'buyer',
      },
    ],
    relatedProducts: relatedBindCards(),
    outfitTitle: outfit.outfitTitle,
    outfitSlots: outfit.outfitSlots,
  }
}

/** Editor-only sample so the shared PDP shell shows every live field. Not inventory. */
export const DEMO_PDP_BIND_PRODUCT: LivePdpBindProduct = buildDemoPdpBindProduct()
