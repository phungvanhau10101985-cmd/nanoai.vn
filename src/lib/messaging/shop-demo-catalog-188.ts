/**
 * Map 9 sản phẩm demo → đủ cột catalog 188 (Excel / `catalog_json` / PDP).
 * Engine dùng chung mọi shop fashion — không khóa slug 188.
 */

import {
  buildCatalog188Snapshot,
  catalogFieldsFromSnapshot,
  type Catalog188Snapshot,
  type InventoryCatalog188Fields,
} from '@/lib/messaging/partner-inventory-catalog-188'
import type { ShopDemoKind, ShopDemoProduct } from '@/lib/messaging/shop-demo-catalog'

export const SHOP_DEMO_COUNT = 9

export type ShopDemoCategoryL3 = { slug: string; name: string; nameEn: string }

export type ShopDemoCatalogExtra = {
  l3: ShopDemoCategoryL3
  chineseName: string
  brand: string
  style: string
  occasion: string
  features: string[]
  weight: string
  likes: number
  purchases: number
  reviews: number
  questions: number
  ratingScore: number
  videoUrl: string
  gender: string
  ageRange: string
  season: string
}

const DEMO_ORIGIN = 'Trung Quốc'
const DEMO_SHOP_NAME = '188 Fashion'
const DEMO_SHOP_NAME_ZH = '188时尚'

export const SHOP_DEMO_CATALOG_EXTRAS: Record<string, ShopDemoCatalogExtra> = {
  L4701: {
    l3: { slug: 'tui-hop-box-bag-nu', name: 'Túi hộp / box bag Nữ', nameEn: 'Box bags' },
    chineseName: '牛皮V字镶珠盒形女包',
    brand: '188 Fashion',
    style: 'Sang trọng',
    occasion: 'Dạo phố, dự tiệc',
    features: ['Form hộp chữ V', 'Đính hạt', 'Da bò', 'Nhiều màu'],
    weight: '480g',
    likes: 142,
    purchases: 96,
    reviews: 28,
    questions: 7,
    ratingScore: 4.8,
    videoUrl: '',
    gender: 'Nữ',
    ageRange: '18–35',
    season: 'Quanh năm',
  },
  H9090: {
    l3: { slug: 'cap-laptop-15-inch-nam', name: 'Cặp laptop 15 inch Nam', nameEn: '15-inch laptop briefcases' },
    chineseName: '牛津布防水男士公文包',
    brand: '188 Fashion',
    style: 'Công sở',
    occasion: 'Đi làm, công tác',
    features: ['Chống thấm', 'Ngăn laptop 15 inch', 'Nhiều ngăn', 'Quai đệm'],
    weight: '920g',
    likes: 88,
    purchases: 54,
    reviews: 16,
    questions: 5,
    ratingScore: 4.6,
    videoUrl: '',
    gender: 'Nam',
    ageRange: '25–45',
    season: 'Quanh năm',
  },
  G3817: {
    l3: { slug: 'tui-xich-chain-bag-nu', name: 'Túi xích / chain bag Nữ', nameEn: 'Chain bags' },
    chineseName: '鳄鱼纹链条斜挎女包',
    brand: '188 Fashion',
    style: 'Cá tính',
    occasion: 'Dạo phố, tiệc nhẹ',
    features: ['Da cá sấu giả', 'Dây xích kim loại', 'Kim tuyến', 'Đeo chéo / xách tay'],
    weight: '610g',
    likes: 176,
    purchases: 41,
    reviews: 19,
    questions: 8,
    ratingScore: 4.7,
    videoUrl: '',
    gender: 'Nữ',
    ageRange: '18–35',
    season: 'Quanh năm',
  },
  O3837: {
    l3: { slug: 'boot-martin-co-ngan-nu', name: 'Boot Martin cổ ngắn Nữ', nameEn: 'Martin ankle boots' },
    chineseName: '马丁短靴加绒厚底',
    brand: '188 Fashion',
    style: 'Martin / cá tính',
    occasion: 'Mùa đông, dạo phố',
    features: ['Đế dày 4–5 cm', 'Lót lông ấm', 'Size 35–40', 'Cổ ngắn'],
    weight: '780g',
    likes: 204,
    purchases: 118,
    reviews: 33,
    questions: 11,
    ratingScore: 4.7,
    videoUrl: '',
    gender: 'Nữ',
    ageRange: '18–35',
    season: 'Thu đông',
  },
  P9508: {
    l3: { slug: 'sneaker-de-day-nu', name: 'Sneaker đế dày Nữ', nameEn: 'Chunky sneakers' },
    chineseName: '厚底增高透气网面运动鞋',
    brand: '188 Fashion',
    style: 'Thể thao / street',
    occasion: 'Dạo phố, đi chơi',
    features: ['Lưới thoáng khí', 'Đế dày 5–6 cm', 'Tăng chiều cao', 'Size 33–40'],
    weight: '690g',
    likes: 231,
    purchases: 147,
    reviews: 41,
    questions: 9,
    ratingScore: 4.8,
    videoUrl: '',
    gender: 'Nữ',
    ageRange: '18–30',
    season: 'Xuân hè',
  },
  Q0927: {
    l3: { slug: 'chelsea-boot-de-bang-nu', name: 'Chelsea boot đế bằng Nữ', nameEn: 'Chelsea boots' },
    chineseName: '切尔西平底弹力靴',
    brand: '188 Fashion',
    style: 'Casual / công sở',
    occasion: 'Đi làm, dạo phố',
    features: ['Cổ thun dễ xỏ', 'Đế bằng chống trượt', 'Tôn dáng', 'Size 35–40'],
    weight: '720g',
    likes: 119,
    purchases: 67,
    reviews: 21,
    questions: 6,
    ratingScore: 4.6,
    videoUrl: '',
    gender: 'Nữ',
    ageRange: '18–35',
    season: 'Thu đông',
  },
  O7073: {
    l3: { slug: 'dam-voan-tre-vai-nu', name: 'Đầm voan trễ vai Nữ', nameEn: 'Off-shoulder chiffon dresses' },
    chineseName: '碎花雪纺露肩连衣裙',
    brand: '188 Fashion',
    style: 'Tiểu thư / Hàn Quốc',
    occasion: 'Dạo phố, hẹn hò, dự tiệc',
    features: ['Voan thêu hoa', 'Trễ vai', 'Dáng xòe', 'Size S–XL'],
    weight: '280g',
    likes: 268,
    purchases: 154,
    reviews: 46,
    questions: 12,
    ratingScore: 4.9,
    videoUrl: '',
    gender: 'Nữ',
    ageRange: '18–35',
    season: 'Xuân hè',
  },
  Z2008: {
    l3: { slug: 'ao-thun-co-thuyen-cut-out-nu', name: 'Áo thun cổ thuyền cut-out Nữ', nameEn: 'Cut-out boat-neck tees' },
    chineseName: '斜襟镂空船领女T恤',
    brand: '188 Fashion',
    style: 'Thanh lịch',
    occasion: 'Công sở, dạo phố',
    features: ['Cotton thoáng', 'Cổ thuyền cut-out', 'Vạt chéo tôn dáng', 'Size S–L'],
    weight: '190g',
    likes: 157,
    purchases: 102,
    reviews: 27,
    questions: 8,
    ratingScore: 4.7,
    videoUrl: '',
    gender: 'Nữ',
    ageRange: '18–35',
    season: 'Xuân hè',
  },
  Q7349: {
    l3: { slug: 'bo-ramie-hai-manh-nu', name: 'Bộ ramie hai mảnh Nữ', nameEn: 'Ramie two-piece sets' },
    chineseName: '苎麻绣花衬衫阔腿裤套装',
    brand: '188 Fashion',
    style: 'Hàng Châu / thanh lịch',
    occasion: 'Đi làm, dạo phố',
    features: ['Ramie thoáng mát', 'Áo thêu hoa', 'Quần ống rộng cạp cao', 'Size M–XL'],
    weight: '420g',
    likes: 98,
    purchases: 39,
    reviews: 14,
    questions: 4,
    ratingScore: 4.5,
    videoUrl: '',
    gender: 'Nữ',
    ageRange: '25–40',
    season: 'Hè',
  },
}

const KIND_GROUP: Record<ShopDemoKind, { rating: number; question: number }> = {
  handbags: { rating: 101, question: 201 },
  shoes: { rating: 102, question: 202 },
  clothing: { rating: 103, question: 203 },
}

function extraOf(product: ShopDemoProduct): ShopDemoCatalogExtra {
  const extra = SHOP_DEMO_CATALOG_EXTRAS[product.sourceSku]
  if (!extra) {
    throw new Error(`[shop-demo-catalog-188] missing extras for ${product.sourceSku}`)
  }
  return extra
}

function demoSlug(name: string, sourceSku: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)
  return `${base}-${sourceSku.toLowerCase()}`
}

function relatedSourceIds(product: ShopDemoProduct, all: ShopDemoProduct[]): { low: string; high: string } {
  const peers = all.filter((p) => p.kind === product.kind && p.sourceSku !== product.sourceSku)
  return {
    low: peers[0]?.sourceProductId || '',
    high: peers[1]?.sourceProductId || peers[0]?.sourceProductId || '',
  }
}

export function shopDemoProductInfo(
  product: ShopDemoProduct,
  extra: ShopDemoCatalogExtra
): Record<string, unknown> {
  return {
    product_info: {
      sku: product.sku,
      name: product.name,
      brand: extra.brand,
      origin: DEMO_ORIGIN,
      category: {
        level_1: product.category.parent.name,
        level_2: product.category.child.name,
        level_3: extra.l3.name,
      },
    },
    specifications: {
      upper_material: product.material,
      style: extra.style,
      occasion: extra.occasion,
      weight_note_vi: extra.weight,
      material_vi: product.material,
    },
    variants: {
      colors: product.colors.map((c) => c.name),
      sizes: product.sizes,
    },
    target_audience: {
      gender: extra.gender,
      age_range: extra.ageRange,
      wearing_style: extra.style,
    },
    market_info: {
      main_sales_regions: 'Việt Nam',
      export_ready: true,
      season: extra.season,
    },
  }
}

export function shopDemoCatalogSnapshot(
  product: ShopDemoProduct,
  allProducts: ShopDemoProduct[] = [product]
): Catalog188Snapshot {
  const extra = extraOf(product)
  const related = relatedSourceIds(product, allProducts)
  const group = KIND_GROUP[product.kind]
  const slug = demoSlug(product.name, product.sourceSku)
  return buildCatalog188Snapshot({
    productId: product.sourceProductId,
    sku: product.sku,
    origin: DEMO_ORIGIN,
    brand: extra.brand,
    name: product.name,
    description: product.description,
    price: product.priceAmount,
    shopName: DEMO_SHOP_NAME,
    shopId: product.sourceProductId,
    priceLow: related.low,
    priceHigh: related.high,
    ratingGroupId: group.rating,
    questionGroupId: group.question,
    sizes: product.sizes,
    colors: product.colors,
    gallery: product.galleryUrls,
    detail: product.detailImageUrls,
    productUrl: slug,
    videoUrl: extra.videoUrl,
    mainImage: product.mainImage,
    likes: extra.likes,
    purchases: extra.purchases,
    reviews: extra.reviews,
    questions: extra.questions,
    ratingScore: extra.ratingScore,
    stockQty: product.stockQty,
    depositRequired: false,
    categoryL1: product.category.parent.name,
    categoryL2: product.category.child.name,
    categoryL3: extra.l3.name,
    material: product.material,
    style: extra.style,
    color: product.colors.map((c) => c.name).join(', '),
    occasion: extra.occasion,
    features: extra.features,
    weight: extra.weight,
    productInfo: shopDemoProductInfo(product, extra),
    chineseName: extra.chineseName,
    shopNameChinese: DEMO_SHOP_NAME_ZH,
    slug,
  })
}

export function shopDemoProductToCatalog188Fields(
  product: ShopDemoProduct,
  allProducts?: ShopDemoProduct[]
): InventoryCatalog188Fields {
  return catalogFieldsFromSnapshot(shopDemoCatalogSnapshot(product, allProducts))
}

export function shopDemoCategoryL3(product: ShopDemoProduct): ShopDemoCategoryL3 {
  return extraOf(product).l3
}

export const CATALOG_188_SNAPSHOT_KEYS: Array<keyof Catalog188Snapshot> = [
  'product_id',
  'code',
  'origin',
  'brand_name',
  'name',
  'description',
  'price',
  'shop_name',
  'shop_id',
  'pro_lower_price',
  'pro_high_price',
  'group_rating',
  'group_question',
  'sizes',
  'colors',
  'images',
  'gallery',
  'link_default',
  'video_link',
  'main_image',
  'likes',
  'purchases',
  'rating_total',
  'question_total',
  'rating_point',
  'available',
  'deposit_require',
  'category',
  'subcategory',
  'sub_subcategory',
  'raw_category',
  'raw_subcategory',
  'raw_sub_subcategory',
  'material',
  'style',
  'color',
  'occasion',
  'features',
  'weight',
  'product_info',
  'chinese_name',
  'shop_name_chinese',
  'slug',
]
