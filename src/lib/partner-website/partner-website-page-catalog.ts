import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsiteStudioStepKey } from '@/lib/partner-website/partner-website-studio-flow'

export type PartnerWebsitePageKey =
  | 'home'
  | 'products'
  | 'product_detail'
  | 'cart'
  | 'about'
  | 'contact'
  | 'faq'
  | 'size_guide'
  | 'shipping'
  | 'returns'
  | 'privacy'
  | 'cookie'
  | 'terms'
  | 'collection'
  | 'order_tracking'
  | 'lookbook'
  | 'sale'
  | 'stores'
  | 'wishlist'
  | 'recently_viewed'
  | 'account'
  | 'orders'
  | 'addresses'
  | 'payment'
  | 'thank_you'
  | 'blog'

/**
 * How the page appears in the website studio picker:
 * - home_template: brief → pick fixed shop template (no AI HTML build)
 * - platform: React route already provided by NanoAI (no create conversation)
 * - legacy_ai: old per-page AI design flow (hidden from picker)
 */
export type PartnerWebsitePageStudioMode = 'home_template' | 'platform' | 'legacy_ai'

export type PartnerWebsitePageDef = {
  key: PartnerWebsitePageKey
  /** HTML path in project (home = index.html). */
  htmlPath: string
  /** Public path under /site/{slug}. */
  routePath: string
  /** Discovery steps for this page conversation. */
  discoveryKeys: PartnerWebsiteStudioStepKey[]
  /** Default feature brief chips (vi). */
  defaultFeaturesVi: string[]
  defaultFeaturesEn: string[]
  /** Studio picker behavior — defaults to legacy_ai when omitted. */
  studioMode?: PartnerWebsitePageStudioMode
}

export function getPartnerWebsitePageStudioMode(def: PartnerWebsitePageDef): PartnerWebsitePageStudioMode {
  return def.studioMode ?? 'legacy_ai'
}

/** Pages shown in the shop website studio picker (template home + platform commerce). */
export function listPartnerWebsiteStudioPickerPages(): PartnerWebsitePageDef[] {
  return PARTNER_WEBSITE_PAGE_CATALOG.filter((def) => {
    const mode = getPartnerWebsitePageStudioMode(def)
    return mode === 'home_template' || mode === 'platform'
  })
}

/**
 * Non-home pages only collect page features.
 * Colors / style inherit from home. Header / footer / bottom nav inherit from
 * that device's homepage (desktop, tablet, and mobile layouts stay independent).
 * Only the middle of each page differs — `docs/PARTNER_WEBSITE_SHARED_CHROME.md`.
 */
const PAGE_FEATURE_KEYS: PartnerWebsiteStudioStepKey[] = ['site_features']

export const PARTNER_WEBSITE_PAGE_CATALOG: PartnerWebsitePageDef[] = [
  {
    key: 'home',
    htmlPath: 'index.html',
    routePath: '/',
    studioMode: 'home_template',
    // Setup is brand + logo + pick fixed template (no AI interview).
    discoveryKeys: ['brand_name', 'logo_url'],
    defaultFeaturesVi: [
      'Catalog + giỏ hàng + chat + yêu thích + vừa xem',
      'Đầy đủ: sản phẩm, FAQ, form liên hệ, chat, cá nhân hóa',
    ],
    defaultFeaturesEn: [
      'Catalog + cart + chat + favorites + recently viewed',
      'Full: products, FAQ, contact form, chat, personalization',
    ],
  },
  {
    key: 'products',
    htmlPath: 'products.html',
    routePath: '/products',
    studioMode: 'platform',
    discoveryKeys: PAGE_FEATURE_KEYS,
    defaultFeaturesVi: [
      'Lưới sản phẩm, bộ lọc, tìm kiếm, phân trang, nút xem chi tiết',
      'Danh mục bên trái, sort giá, thẻ SP + thêm giỏ',
    ],
    defaultFeaturesEn: [
      'Product grid, filters, search, pagination, view detail',
      'Category sidebar, price sort, product cards + add to cart',
    ],
  },
  {
    key: 'product_detail',
    htmlPath: 'product-detail.html',
    routePath: '/products/[id]',
    studioMode: 'platform',
    discoveryKeys: PAGE_FEATURE_KEYS,
    defaultFeaturesVi: [
      'Ảnh SP, giá, chọn size/màu, thêm giỏ, mua ngay, chat tư vấn, mô tả',
      'Gallery, biến thể, số lượng, thử đồ, gợi ý SP liên quan',
    ],
    defaultFeaturesEn: [
      'Gallery, price, size/color, add to cart, buy now, consult chat, description',
      'Variants, qty, try-on, related products',
    ],
  },
  {
    key: 'cart',
    htmlPath: 'cart.html',
    routePath: '/cart',
    studioMode: 'platform',
    discoveryKeys: PAGE_FEATURE_KEYS,
    defaultFeaturesVi: [
      'Danh sách giỏ, đổi số lượng, tổng tiền, form đặt hàng, nút thanh toán',
      'Giỏ trống state, mã giảm giá, tiếp tục mua',
    ],
    defaultFeaturesEn: [
      'Cart lines, qty, totals, checkout form, place order',
      'Empty cart state, coupon, continue shopping',
    ],
  },
  {
    key: 'sale',
    htmlPath: 'sale.html',
    routePath: '/sale',
    studioMode: 'platform',
    discoveryKeys: PAGE_FEATURE_KEYS,
    defaultFeaturesVi: [
      'Banner flash sale, countdown, lưới SP giảm giá, filter %/giá',
      'Ưu đãi theo khung giờ + CTA chat lấy mã',
    ],
    defaultFeaturesEn: [
      'Flash-sale banner, countdown, discounted grid, %/price filters',
      'Timed offers + chat CTA for coupon codes',
    ],
  },
  {
    key: 'wishlist',
    htmlPath: 'wishlist.html',
    routePath: '/wishlist',
    studioMode: 'platform',
    discoveryKeys: PAGE_FEATURE_KEYS,
    defaultFeaturesVi: [
      'Danh sách yêu thích (API favorites), thêm giỏ, bỏ yêu thích, empty state',
      'Gợi ý SP tương tự + CTA tiếp tục mua',
    ],
    defaultFeaturesEn: [
      'Favorites grid (favorites API), add to cart, unfavorite, empty state',
      'Similar-product tips + continue shopping CTA',
    ],
  },
  {
    key: 'recently_viewed',
    htmlPath: 'recently-viewed.html',
    routePath: '/recently-viewed',
    studioMode: 'platform',
    discoveryKeys: PAGE_FEATURE_KEYS,
    defaultFeaturesVi: [
      'Lưới SP đã xem gần đây (API recently-viewed), xóa lịch sử, thêm giỏ / yêu thích',
      'Empty state + CTA tiếp tục mua sắm',
    ],
    defaultFeaturesEn: [
      'Recently viewed grid (recently-viewed API), clear history, add to cart / favorite',
      'Empty state + continue shopping CTA',
    ],
  },
  {
    key: 'account',
    htmlPath: 'account.html',
    routePath: '/account',
    discoveryKeys: PAGE_FEATURE_KEYS,
    defaultFeaturesVi: [
      'Đăng nhập/đăng ký, hồ sơ, đơn gần đây, địa chỉ giao hàng',
      'Menu tài khoản + CTA chat hỗ trợ',
    ],
    defaultFeaturesEn: [
      'Sign in/up, profile, recent orders, shipping addresses',
      'Account menu + support chat CTA',
    ],
  },
  {
    key: 'orders',
    htmlPath: 'orders.html',
    routePath: '/orders',
    discoveryKeys: PAGE_FEATURE_KEYS,
    defaultFeaturesVi: [
      'Danh sách đơn hàng, trạng thái, xem chi tiết, mua lại',
      'Empty state + CTA tiếp tục mua sắm',
    ],
    defaultFeaturesEn: [
      'Order list, status, detail, buy again',
      'Empty state + continue shopping CTA',
    ],
  },
  {
    key: 'addresses',
    htmlPath: 'addresses.html',
    routePath: '/addresses',
    discoveryKeys: PAGE_FEATURE_KEYS,
    defaultFeaturesVi: [
      'Sổ địa chỉ giao hàng, thêm/sửa/xóa, đặt mặc định',
      'Form địa chỉ + xác nhận',
    ],
    defaultFeaturesEn: [
      'Shipping address book, add/edit/delete, set default',
      'Address form + confirm',
    ],
  },
  {
    key: 'payment',
    htmlPath: 'payment.html',
    routePath: '/payment',
    studioMode: 'platform',
    discoveryKeys: PAGE_FEATURE_KEYS,
    defaultFeaturesVi: [
      'Các phương thức TT (COD, chuyển khoản, ví), hướng dẫn từng bước',
      'Tuân thủ chính sách quảng cáo Google Merchant Center, Facebook, TikTok',
    ],
    defaultFeaturesEn: [
      'Payment methods (COD, bank transfer, e-wallets), step guides',
      'Complies with Google Merchant Center, Facebook, and TikTok ad policies',
    ],
  },
  {
    key: 'thank_you',
    htmlPath: 'thank-you.html',
    routePath: '/thank-you',
    studioMode: 'platform',
    discoveryKeys: PAGE_FEATURE_KEYS,
    defaultFeaturesVi: [
      'Xác nhận đặt hàng thành công, mã đơn, bước tiếp theo, CTA theo dõi đơn',
      'Gợi ý SP liên quan + chat nếu cần hỗ trợ',
    ],
    defaultFeaturesEn: [
      'Order success confirmation, order code, next steps, track CTA',
      'Related products + support chat',
    ],
  },
  {
    key: 'stores',
    htmlPath: 'stores.html',
    routePath: '/stores',
    studioMode: 'platform',
    discoveryKeys: PAGE_FEATURE_KEYS,
    defaultFeaturesVi: [
      'Danh sách cửa hàng, địa chỉ, giờ mở cửa, bản đồ, chỉ đường',
      'Filter theo thành phố + CTA gọi/chat',
    ],
    defaultFeaturesEn: [
      'Store list, address, hours, map, directions',
      'City filter + call/chat CTA',
    ],
  },
  {
    key: 'blog',
    htmlPath: 'blog.html',
    routePath: '/blog',
    studioMode: 'platform',
    discoveryKeys: PAGE_FEATURE_KEYS,
    defaultFeaturesVi: [
      'Danh sách bài viết/style tip, thẻ chủ đề, đọc tiếp, CTA shop',
      'Featured post + lưới bài mới',
    ],
    defaultFeaturesEn: [
      'Article/style-tip list, topic tags, read more, shop CTA',
      'Featured post + latest grid',
    ],
  },
  {
    key: 'collection',
    htmlPath: 'collection.html',
    routePath: '/collection',
    discoveryKeys: PAGE_FEATURE_KEYS,
    defaultFeaturesVi: [
      'Hero bộ sưu tập, lưới SP theo collection, filter nhanh, CTA xem tất cả',
      'Story ngắn + look ảnh + sản phẩm thuộc BST',
    ],
    defaultFeaturesEn: [
      'Collection hero, product grid, quick filters, see-all CTA',
      'Short story + look images + collection products',
    ],
  },
  {
    key: 'lookbook',
    htmlPath: 'lookbook.html',
    routePath: '/lookbook',
    studioMode: 'platform',
    discoveryKeys: PAGE_FEATURE_KEYS,
    defaultFeaturesVi: [
      'Gallery look/editorial, shop the look, CTA chat / xem SP',
      'Masonry ảnh campaign + caption + link sản phẩm',
    ],
    defaultFeaturesEn: [
      'Editorial look gallery, shop the look, chat / product CTA',
      'Campaign masonry + captions + product links',
    ],
  },
  {
    key: 'size_guide',
    htmlPath: 'size-guide.html',
    routePath: '/size-guide',
    studioMode: 'platform',
    discoveryKeys: PAGE_FEATURE_KEYS,
    defaultFeaturesVi: [
      'Bảng size áo/quần, cách đo, tip chọn size, CTA chat tư vấn',
      'Tabs theo loại SP + ảnh minh họa đo',
    ],
    defaultFeaturesEn: [
      'Size charts, how to measure, fit tips, consult chat CTA',
      'Tabs by product type + measurement illustrations',
    ],
  },
  {
    key: 'shipping',
    htmlPath: 'shipping.html',
    routePath: '/shipping',
    studioMode: 'platform',
    discoveryKeys: PAGE_FEATURE_KEYS,
    defaultFeaturesVi: [
      'Phí ship, thời gian giao, khu vực, đơn miễn ship, FAQ ngắn',
      'Tuân thủ chính sách quảng cáo Google Merchant Center, Facebook, TikTok',
    ],
    defaultFeaturesEn: [
      'Shipping fees, delivery time, regions, free-ship rules, short FAQ',
      'Complies with Google Merchant Center, Facebook, and TikTok ad policies',
    ],
  },
  {
    key: 'returns',
    htmlPath: 'returns.html',
    routePath: '/returns',
    studioMode: 'platform',
    discoveryKeys: PAGE_FEATURE_KEYS,
    defaultFeaturesVi: [
      'Đổi trả + hoàn tiền rõ ràng: điều kiện, thời hạn, phí, hàng không áp dụng, cách hoàn tiền',
      'Tuân thủ chính sách quảng cáo Google Merchant Center, Facebook, TikTok',
    ],
    defaultFeaturesEn: [
      'Returns + refunds: conditions, window, fees, exclusions, refund method/timeline',
      'Complies with Google Merchant Center, Facebook, and TikTok ad policies',
    ],
  },
  {
    key: 'order_tracking',
    htmlPath: 'order-tracking.html',
    routePath: '/order-tracking',
    discoveryKeys: PAGE_FEATURE_KEYS,
    defaultFeaturesVi: [
      'Form mã đơn + SĐT, trạng thái giao hàng, CTA chat nếu lỗi',
      'Timeline trạng thái + hướng dẫn tra cứu',
    ],
    defaultFeaturesEn: [
      'Order code + phone form, delivery status, chat if issue',
      'Status timeline + lookup instructions',
    ],
  },
  {
    key: 'about',
    htmlPath: 'about.html',
    routePath: '/about',
    studioMode: 'platform',
    discoveryKeys: ['site_features', 'value_prop'],
    defaultFeaturesVi: [
      'Câu chuyện thương hiệu, đội ngũ, giá trị, ảnh xưởng/cửa hàng',
      'Timeline, sứ mệnh, chứng nhận',
    ],
    defaultFeaturesEn: [
      'Brand story, team, values, store/workshop photos',
      'Timeline, mission, certifications',
    ],
  },
  {
    key: 'contact',
    htmlPath: 'contact.html',
    routePath: '/contact',
    studioMode: 'platform',
    discoveryKeys: PAGE_FEATURE_KEYS,
    defaultFeaturesVi: [
      'Form liên hệ, SĐT/Zalo, địa chỉ, bản đồ, giờ mở cửa',
      'Chat CTA + form lead',
    ],
    defaultFeaturesEn: [
      'Contact form, phone/Zalo, address, map, hours',
      'Chat CTA + lead form',
    ],
  },
  {
    key: 'faq',
    htmlPath: 'faq.html',
    routePath: '/faq',
    studioMode: 'platform',
    discoveryKeys: PAGE_FEATURE_KEYS,
    defaultFeaturesVi: [
      'Accordion FAQ: vận chuyển, đổi trả, thanh toán, size',
      'Tìm trong FAQ + CTA chat nếu chưa rõ',
    ],
    defaultFeaturesEn: [
      'FAQ accordion: shipping, returns, payment, sizing',
      'FAQ search + chat CTA',
    ],
  },
  {
    key: 'privacy',
    htmlPath: 'privacy.html',
    routePath: '/privacy',
    studioMode: 'platform',
    discoveryKeys: PAGE_FEATURE_KEYS,
    defaultFeaturesVi: [
      'Thu thập dữ liệu (form, chat, đơn hàng), pixel/Google Ads, quyền khách, liên hệ shop',
      'Tuân thủ chính sách quảng cáo Google Merchant Center, Facebook (Meta) và TikTok',
    ],
    defaultFeaturesEn: [
      'Data collection (forms, chat, orders), pixels/Google Ads, customer rights, contact',
      'Complies with Google Merchant Center, Facebook (Meta), and TikTok advertising policies',
    ],
  },
  {
    key: 'cookie',
    htmlPath: 'cookie.html',
    routePath: '/cookie',
    discoveryKeys: PAGE_FEATURE_KEYS,
    defaultFeaturesVi: [
      'Cookie/pixel dùng gì (bắt buộc, phân tích, quảng cáo Google/Meta), cách tắt, liên kết bảo mật',
      'Bảng loại cookie + thời gian lưu + Consent Mode gợi ý',
    ],
    defaultFeaturesEn: [
      'What cookies/pixels do (essential, analytics, Google/Meta ads), how to opt out, privacy link',
      'Cookie types table + retention + Consent Mode notes',
    ],
  },
  {
    key: 'terms',
    htmlPath: 'terms.html',
    routePath: '/terms',
    studioMode: 'platform',
    discoveryKeys: PAGE_FEATURE_KEYS,
    defaultFeaturesVi: [
      'Điều khoản mua hàng, thanh toán, trách nhiệm, luật áp dụng',
      'Tuân thủ chính sách quảng cáo Google Merchant Center, Facebook, TikTok',
    ],
    defaultFeaturesEn: [
      'Purchase terms, payment, liability, governing law',
      'Complies with Google Merchant Center, Facebook, and TikTok ad policies',
    ],
  },
]

export function getPartnerWebsitePageDef(pageKey: string): PartnerWebsitePageDef | null {
  const key = pageKey.trim().toLowerCase()
  return PARTNER_WEBSITE_PAGE_CATALOG.find((p) => p.key === key) ?? null
}

export function normalizePartnerWebsitePageKey(raw: string | undefined | null): PartnerWebsitePageKey {
  const def = getPartnerWebsitePageDef(raw ?? 'home')
  return def?.key ?? 'home'
}

export function discoveryKeysForPage(pageKey: string): PartnerWebsiteStudioStepKey[] {
  return getPartnerWebsitePageDef(pageKey)?.discoveryKeys ?? PARTNER_WEBSITE_PAGE_CATALOG[0]!.discoveryKeys
}

export function pageCatalogLabels(locale: WebLocale): Record<
  PartnerWebsitePageKey,
  { title: string; hint: string }
> {
  if (locale === 'en') {
    return {
      home: { title: 'Home', hint: 'Shop homepage — hero, products, chat' },
      products: { title: 'Product list', hint: 'Catalog grid, filters, search' },
      product_detail: { title: 'Product detail', hint: 'Gallery, variants, add to cart' },
      cart: { title: 'Cart & checkout', hint: 'Cart lines and order form' },
      sale: { title: 'Sale / promo', hint: 'Flash sale, discounts, countdown' },
      wishlist: { title: 'Wishlist / favorites', hint: 'Saved favorite products' },
      recently_viewed: { title: 'Recently viewed', hint: 'Products you viewed lately' },
      account: { title: 'Account', hint: 'Sign in, profile, orders' },
      orders: { title: 'Orders', hint: 'Order history and status' },
      addresses: { title: 'Addresses', hint: 'Shipping address book' },
      payment: { title: 'Payment guide', hint: 'COD, transfer, e-wallets' },
      thank_you: { title: 'Order success', hint: 'Thank-you after checkout' },
      stores: { title: 'Stores', hint: 'Offline store list & map' },
      blog: { title: 'Blog / tips', hint: 'Style tips and news' },
      collection: { title: 'Collection', hint: 'Collection story + product grid' },
      lookbook: { title: 'Lookbook', hint: 'Editorial looks, shop the look' },
      size_guide: { title: 'Size guide', hint: 'Charts, measure tips, fit advice' },
      shipping: { title: 'Shipping', hint: 'Fees, regions, delivery time; ads policy compliance' },
      returns: { title: 'Returns & refunds', hint: 'Exchange, return, refund; ads policy compliance' },
      order_tracking: { title: 'Order tracking', hint: 'Lookup order status' },
      about: { title: 'About', hint: 'Brand story and values' },
      contact: { title: 'Contact', hint: 'Form, phone, map' },
      faq: { title: 'FAQ', hint: 'Shipping, returns, payment Q&A' },
      privacy: { title: 'Privacy policy', hint: 'Data, pixels, Google Merchant / Facebook / TikTok ads' },
      cookie: { title: 'Cookie policy', hint: 'Cookies, analytics & ad tracking' },
      terms: { title: 'Terms', hint: 'Purchase terms; Google Merchant / Facebook / TikTok ads' },
    }
  }
  if (locale === 'zh') {
    return {
      home: { title: '首页', hint: '店铺首页 — 主视觉、商品、聊天' },
      products: { title: '商品列表', hint: '目录网格、筛选、搜索' },
      product_detail: { title: '商品详情', hint: '图集、规格、加购' },
      cart: { title: '购物车/下单', hint: '购物车与订单表单' },
      sale: { title: '促销/特卖', hint: '闪购、折扣、倒计时' },
      wishlist: { title: '心愿单/收藏', hint: '收藏的商品' },
      recently_viewed: { title: '最近浏览', hint: '最近看过的商品' },
      account: { title: '账户', hint: '登录、资料、订单' },
      orders: { title: '订单', hint: '订单记录与状态' },
      addresses: { title: '地址', hint: '收货地址簿' },
      payment: { title: '支付说明', hint: '货到付款、转账、电子钱包' },
      thank_you: { title: '下单成功', hint: '感谢页与下一步' },
      stores: { title: '门店', hint: '线下门店与地图' },
      blog: { title: '博客/穿搭', hint: '穿搭技巧与资讯' },
      collection: { title: '系列页', hint: '系列故事与商品网格' },
      lookbook: { title: 'Lookbook', hint: '造型画廊、按款购买' },
      size_guide: { title: '尺码指南', hint: '尺码表、测量与穿搭建议' },
      shipping: { title: '配送说明', hint: '运费、区域、时效' },
      returns: { title: '退换/退款', hint: '退换与退款政策' },
      order_tracking: { title: '订单查询', hint: '查询物流状态' },
      about: { title: '关于我们', hint: '品牌故事与价值' },
      contact: { title: '联系我们', hint: '表单、电话、地图' },
      faq: { title: '常见问题', hint: '物流、退换、支付问答' },
      privacy: { title: '隐私政策', hint: '数据、广告像素、用户权利' },
      cookie: { title: 'Cookie政策', hint: 'Cookie、分析与广告追踪' },
      terms: { title: '服务条款', hint: '购买与使用条款' },
    }
  }
  if (locale === 'ja') {
    return {
      home: { title: 'ホーム', hint: 'ショップホーム — ヒーロー・商品・チャット' },
      products: { title: '商品一覧', hint: 'カタログ・絞り込み・検索' },
      product_detail: { title: '商品詳細', hint: 'ギャラリー・バリエーション・カート' },
      cart: { title: 'カート/注文', hint: 'カートと注文フォーム' },
      sale: { title: 'セール', hint: 'タイムセール・割引・カウントダウン' },
      wishlist: { title: 'お気に入り', hint: '保存した商品' },
      recently_viewed: { title: '閲覧履歴', hint: '最近見た商品' },
      account: { title: 'アカウント', hint: 'ログイン・プロフィール・注文' },
      orders: { title: '注文履歴', hint: '注文一覧と配送状況' },
      addresses: { title: '住所', hint: 'お届け先アドレス帳' },
      payment: { title: 'お支払い案内', hint: '代引・振込・電子マネー' },
      thank_you: { title: '注文完了', hint: 'サンクスページと次の案内' },
      stores: { title: '店舗一覧', hint: '実店舗と地図' },
      blog: { title: 'ブログ/Tips', hint: 'スタイリングとニュース' },
      collection: { title: 'コレクション', hint: 'コレクション紹介と商品一覧' },
      lookbook: { title: 'ルックブック', hint: 'スタイリングギャラリー' },
      size_guide: { title: 'サイズガイド', hint: '採寸表・フィッティング' },
      shipping: { title: '配送について', hint: '送料・地域・お届け日数' },
      returns: { title: '返品・返金', hint: '返品・交換・返金ポリシー' },
      order_tracking: { title: '注文追跡', hint: '配送状況の確認' },
      about: { title: '会社概要', hint: 'ブランドストーリー' },
      contact: { title: 'お問い合わせ', hint: 'フォーム・電話・地図' },
      faq: { title: 'FAQ', hint: '配送・返品・支払い' },
      privacy: { title: 'プライバシー', hint: 'データ・広告ピクセル・権利' },
      cookie: { title: 'Cookieポリシー', hint: 'Cookie・分析・広告トラッキング' },
      terms: { title: '利用規約', hint: '購入・利用条件' },
    }
  }
  if (locale === 'ko') {
    return {
      home: { title: '홈', hint: '샵 홈 — 히어로, 상품, 채팅' },
      products: { title: '상품 목록', hint: '카탈로그, 필터, 검색' },
      product_detail: { title: '상품 상세', hint: '갤러리, 옵션, 장바구니' },
      cart: { title: '장바구니/주문', hint: '장바구니와 주문 폼' },
      sale: { title: '세일/프로모', hint: '타임세일, 할인, 카운트다운' },
      wishlist: { title: '위시리스트/찜', hint: '찜한 상품' },
      recently_viewed: { title: '최근 본 상품', hint: '최근에 본 상품 목록' },
      account: { title: '계정', hint: '로그인, 프로필, 주문' },
      orders: { title: '주문', hint: '주문 내역과 상태' },
      addresses: { title: '주소', hint: '배송지 주소록' },
      payment: { title: '결제 안내', hint: '착불, 이체, 전자지갑' },
      thank_you: { title: '주문 완료', hint: '감사 페이지와 다음 단계' },
      stores: { title: '매장', hint: '오프라인 매장과 지도' },
      blog: { title: '블로그/팁', hint: '스타일 팁과 소식' },
      collection: { title: '컬렉션', hint: '컬렉션 소개와 상품 그리드' },
      lookbook: { title: '룩북', hint: '스타일링 갤러리, 샵 더 룩' },
      size_guide: { title: '사이즈 가이드', hint: '치수표, 측정, 핏 팁' },
      shipping: { title: '배송 안내', hint: '배송비, 지역, 소요 시간' },
      returns: { title: '교환/반품/환불', hint: '교환·반품·환불 정책' },
      order_tracking: { title: '주문 조회', hint: '배송 상태 확인' },
      about: { title: '소개', hint: '브랜드 스토리' },
      contact: { title: '문의', hint: '폼, 전화, 지도' },
      faq: { title: 'FAQ', hint: '배송, 교환, 결제' },
      privacy: { title: '개인정보처리방침', hint: '데이터, 광고 픽셀, 권리' },
      cookie: { title: '쿠키 정책', hint: '쿠키, 분석, 광고 추적' },
      terms: { title: '이용약관', hint: '구매 및 이용 조건' },
    }
  }
  return {
    home: { title: 'Trang chủ', hint: 'Chọn mẫu cố định — gắn catalog, giỏ, chat' },
    products: { title: 'Danh sách sản phẩm', hint: 'Trang nền tảng — catalog, lọc, tìm kiếm' },
    product_detail: { title: 'Chi tiết sản phẩm', hint: 'Trang nền tảng — ảnh, biến thể, thêm giỏ' },
    cart: { title: 'Giỏ hàng / đặt hàng', hint: 'Trang nền tảng — giỏ và form đặt hàng' },
    sale: { title: 'Khuyến mãi / Sale', hint: 'Flash sale, giảm giá, countdown' },
    wishlist: { title: 'Yêu thích', hint: 'Trang nền tảng — favorites' },
    recently_viewed: { title: 'Đã xem gần đây', hint: 'Trang nền tảng — recently viewed' },
    account: { title: 'Tài khoản', hint: 'Đăng nhập, hồ sơ, đơn hàng' },
    orders: { title: 'Đơn hàng', hint: 'Lịch sử và trạng thái đơn' },
    addresses: { title: 'Địa chỉ', hint: 'Sổ địa chỉ giao hàng' },
    payment: { title: 'Thanh toán', hint: 'COD, chuyển khoản, ví điện tử' },
    thank_you: { title: 'Đặt hàng thành công', hint: 'Xác nhận đơn và bước tiếp' },
    stores: { title: 'Cửa hàng', hint: 'Danh sách store offline + bản đồ' },
    blog: { title: 'Blog / tips', hint: 'Tin tức, tips phối đồ' },
    collection: { title: 'Bộ sưu tập', hint: 'Story BST + lưới sản phẩm' },
    lookbook: { title: 'Lookbook', hint: 'Gallery look, shop the look' },
    size_guide: { title: 'Hướng dẫn size', hint: 'Bảng size, cách đo, tip chọn' },
    shipping: { title: 'Vận chuyển', hint: 'Phí ship, khu vực; tuân thủ quảng cáo Google/Facebook/TikTok' },
    returns: { title: 'Đổi trả & hoàn tiền', hint: 'Đổi trả, hoàn tiền; tuân thủ quảng cáo Google/Facebook/TikTok' },
    order_tracking: { title: 'Theo dõi đơn', hint: 'Tra cứu trạng thái đơn hàng' },
    about: { title: 'Giới thiệu', hint: 'Câu chuyện thương hiệu' },
    contact: { title: 'Liên hệ', hint: 'Form, SĐT, bản đồ' },
    faq: { title: 'FAQ', hint: 'Vận chuyển, đổi trả, thanh toán' },
    privacy: { title: 'Chính sách bảo mật', hint: 'Dữ liệu, pixel; Google Merchant / Facebook / TikTok' },
    cookie: { title: 'Chính sách cookie', hint: 'Cookie, phân tích & quảng cáo' },
    terms: { title: 'Điều khoản', hint: 'Điều khoản mua hàng; Google Merchant / Facebook / TikTok' },
  }
}

export function defaultFeatureSuggestions(pageKey: string, locale: WebLocale): string[] {
  const def = getPartnerWebsitePageDef(pageKey)
  if (!def) return []
  return locale === 'vi' ? def.defaultFeaturesVi : def.defaultFeaturesEn
}
