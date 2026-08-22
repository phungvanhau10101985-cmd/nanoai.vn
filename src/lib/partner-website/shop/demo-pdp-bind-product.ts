import { SHOP_DEMO_PRODUCTS, type ShopDemoProduct } from '@/lib/messaging/shop-demo-catalog'
import type { LivePdpBindProduct } from '@/lib/partner-website/shop/bind-live-product-to-pdp-html'

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

/** Clothing sample with sizes + colors + gallery — editor layout, not inventory. */
const SOURCE =
  demoBySourceSku('O7073') ||
  SHOP_DEMO_PRODUCTS.find((p) => p.kind === 'clothing' && p.sizes.length > 0 && p.colors.length > 0) ||
  SHOP_DEMO_PRODUCTS[0]

const RELATED_A = demoBySourceSku('Z2008')
const RELATED_B = demoBySourceSku('B8864')
const RELATED_C = demoBySourceSku('O3837')

/** Keep the editor sample light: a few gallery shots, not every color/real-use URL. */
const GALLERY = uniqueUrls([SOURCE.mainImage, ...SOURCE.galleryUrls]).slice(0, 4)

const DETAILS = uniqueUrls([...SOURCE.detailImageUrls])
const REAL_USE = uniqueUrls([SOURCE.realUseImageUrl, SOURCE.realUseImageUrl2])

/** Editor-only sample so the shared PDP shell shows every live field. Not inventory. */
export const DEMO_PDP_BIND_PRODUCT: LivePdpBindProduct = {
  id: '00000000-0000-4000-8000-000000000001',
  name: SOURCE.name,
  sku: 'DEMO-PDP-001',
  description: SOURCE.consultNote,
  detailDescription: SOURCE.material
    ? `Chất liệu: ${SOURCE.material}\n\n${SOURCE.description}`
    : SOURCE.description,
  consultNote: SOURCE.consultNote,
  priceHint: '200.000₫',
  priceAmount: 350000,
  salePriceAmount: SOURCE.priceAmount || 200000,
  saleStartsAt: '2020-01-01T00:00:00.000Z',
  saleEndsAt: '2099-12-31T00:00:00.000Z',
  imageUrl: SOURCE.mainImage,
  galleryImages: GALLERY,
  detailImages: DETAILS.slice(0, 2),
  materialImageUrl: SOURCE.materialDetailImageUrl,
  realUseImageUrls: REAL_USE.slice(0, 1),
  productVideoUrl: null,
  sizeGuideImageUrl: SOURCE.materialDetailImageUrl || DETAILS[0] || SOURCE.mainImage,
  depositPolicy: true,
  stockQty: 4,
  sizes: SOURCE.sizes.length ? SOURCE.sizes : ['S', 'M', 'L', 'XL'],
  colors: SOURCE.colors.map((c) => ({ name: c.name, img: c.img })),
  breadcrumb: [
    { name: SOURCE.category.parent.name, href: '#' },
    { name: SOURCE.category.child.name, href: '#' },
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
  relatedProducts: [
    RELATED_A
      ? {
          id: '00000000-0000-4000-8000-000000000002',
          name: RELATED_A.name,
          imageUrl: RELATED_A.mainImage,
          priceHint: '200.000₫',
        }
      : null,
    RELATED_B
      ? {
          id: '00000000-0000-4000-8000-000000000003',
          name: RELATED_B.name,
          imageUrl: RELATED_B.mainImage,
          priceHint: '200.000₫',
        }
      : null,
    RELATED_C
      ? {
          id: '00000000-0000-4000-8000-000000000004',
          name: RELATED_C.name,
          imageUrl: RELATED_C.mainImage,
          priceHint: '920.000₫',
        }
      : null,
  ].filter((p): p is NonNullable<typeof p> => Boolean(p)),
}
