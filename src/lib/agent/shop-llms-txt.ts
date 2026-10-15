import { hostnameFromHostHeader, isPlatformAppHostname } from '@/lib/messaging/partner-custom-domain-platform-host'

/** Lighthouse llms.txt: one H1, one Markdown link, at least 50 characters, and a fast 200. */
export function shopDisplayNameFromHost(host: string): string {
  const bare = hostnameFromHostHeader(host).replace(/^www\./, '')
  const label = bare.split('.')[0] || bare
  if (!label) return 'Shop'
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function buildShopLlmsTxt(origin: string, host: string): string {
  const root = origin.replace(/\/$/, '')
  const name = shopDisplayNameFromHost(host)
  return `# ${name}

> Cửa hàng trực tuyến ${name} (${root}). Danh mục sản phẩm, tìm kiếm, giỏ hàng và chính sách mua hàng cho tác nhân AI.

## Trang

- [Trang chủ](${root}/): Cửa hàng ${name}
- [Sản phẩm](${root}/products): Danh sách sản phẩm đang bán
- [Danh mục](${root}/c): Cây danh mục
- [Tìm kiếm](${root}/tim-kiem): Tìm theo chữ
- [Giỏ hàng](${root}/cart): Giỏ hàng của khách
- [Chính sách bảo mật](${root}/privacy): Quyền riêng tư
- [Điều khoản](${root}/terms): Điều khoản mua hàng
- [Vận chuyển](${root}/shipping): Phí và thời gian giao
- [Đổi trả](${root}/returns): Chính sách đổi trả
- [Sitemap](${root}/sitemap.xml): Sơ đồ trang
- [Tài liệu đầy đủ](${root}/llms-full.txt): Bản mô tả dài hơn cho tác nhân
`
}

export function buildShopLlmsFullTxt(origin: string, host: string): string {
  const root = origin.replace(/\/$/, '')
  const name = shopDisplayNameFromHost(host)
  return `${buildShopLlmsTxt(root, host)}
## Cách tác nhân dùng cửa hàng

- Đọc [trang chủ](${root}/) để thấy danh mục và sản phẩm nổi bật.
- Mở [một sản phẩm](${root}/products) từ liên kết trên thẻ; ảnh, tên, giá và mô tả nằm trên trang chi tiết.
- [Tìm kiếm](${root}/tim-kiem) nhận từ khóa. [Giỏ hàng](${root}/cart) giữ sản phẩm khách đã chọn.
- Chính sách giao hàng, đổi trả, bảo mật và điều khoản nằm ở chân trang: [vận chuyển](${root}/shipping), [đổi trả](${root}/returns), [bảo mật](${root}/privacy), [điều khoản](${root}/terms).
`
}

export function requestPublicOrigin(req: Request): { host: string; origin: string; shop: boolean } {
  const forwarded = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
  const host = hostnameFromHostHeader(forwarded)
  const shop = Boolean(host) && !isPlatformAppHostname(host)
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https'
  return { host, origin: host ? `${proto}://${host}` : '', shop }
}

export function llmsTextResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
