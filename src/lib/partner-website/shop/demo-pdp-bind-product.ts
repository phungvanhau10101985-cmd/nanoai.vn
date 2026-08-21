import type { LivePdpBindProduct } from '@/lib/partner-website/shop/bind-live-product-to-pdp-html'

/** Editor-only sample so the shared PDP shell shows every live field. Not inventory. */
export const DEMO_PDP_BIND_PRODUCT: LivePdpBindProduct = {
  id: '00000000-0000-4000-8000-pdpdem000001',
  name: 'Áo thun cotton demo',
  sku: 'DEMO-PDP-001',
  description: 'Mô tả ngắn — chỉ để chỉnh giao diện. Khách xem thấy mô tả từng sản phẩm.',
  detailDescription:
    'Mô tả chi tiết demo: chất liệu, form, hướng dẫn bảo quản. Ô này là layout; nội dung thật lấy từ tồn kho.',
  priceHint: '299.000₫',
  priceAmount: 399000,
  salePriceAmount: 299000,
  saleStartsAt: '2020-01-01T00:00:00.000Z',
  saleEndsAt: '2099-12-31T00:00:00.000Z',
  imageUrl: 'https://placehold.co/800x1000/f1f5f9/334155?text=PDP+1',
  galleryImages: [
    'https://placehold.co/800x1000/f1f5f9/334155?text=PDP+1',
    'https://placehold.co/800x1000/e2e8f0/334155?text=PDP+2',
    'https://placehold.co/800x1000/cbd5e1/334155?text=PDP+3',
  ],
}
