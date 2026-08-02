import type { WebLocale } from '@/lib/i18n/config'

export type PartnerSiteInfoPageKey =
  | 'about'
  | 'contact'
  | 'faq'
  | 'sale'
  | 'shipping'
  | 'returns'
  | 'privacy'
  | 'terms'

export type PartnerSiteInfoBlock = {
  title: string
  paragraphs: string[]
  bullets?: string[]
  faq?: { q: string; a: string }[]
}

const PAGES: Record<PartnerSiteInfoPageKey, Record<WebLocale, PartnerSiteInfoBlock>> = {
  about: {
    vi: {
      title: 'Về chúng tôi',
      paragraphs: [
        'Chúng tôi mang đến thời trang chọn lọc — chất liệu tốt, form chuẩn, giao hàng nhanh.',
        'Mọi sản phẩm trên web đều đồng bộ kho thật; bạn có thể chat để hỏi size, màu và tình trạng hàng.',
      ],
    },
    en: {
      title: 'About us',
      paragraphs: [
        'We curate fashion pieces with quality fabrics, modern fits, and fast delivery.',
        'Every product syncs with live inventory — chat us for size, color, and availability.',
      ],
    },
    zh: {
      title: '关于我们',
      paragraphs: ['精选时尚单品，优质面料，快速配送。', '商品与库存同步 — 可通过聊天咨询尺码与颜色。'],
    },
    ja: {
      title: '私たちについて',
      paragraphs: [
        '上質な素材とフィット感にこだわったファッションを届けます。',
        '在庫と同期。サイズ・カラーはチャットでご相談ください。',
      ],
    },
    ko: {
      title: '소개',
      paragraphs: [
        '좋은 소재와 핏의 패션을 선별해 빠르게 배송합니다.',
        '재고와 동기화됩니다 — 사이즈·컬러는 채팅으로 문의하세요.',
      ],
    },
  },
  contact: {
    vi: {
      title: 'Liên hệ',
      paragraphs: [
        'Cần tư vấn size, giá hoặc giao hàng? Nhắn chat shop hoặc để lại thông tin — chúng tôi phản hồi sớm.',
      ],
      bullets: ['Chat trực tiếp trên web', 'Form liên hệ ở trang chủ', 'Theo dõi đơn trong mục Đơn hàng'],
    },
    en: {
      title: 'Contact',
      paragraphs: ['Need size, price, or shipping help? Chat with the shop or leave a message — we reply quickly.'],
      bullets: ['Live chat on the site', 'Contact form on the homepage', 'Track orders under Orders'],
    },
    zh: {
      title: '联系我们',
      paragraphs: ['咨询尺码、价格或配送？请聊天或留言，我们会尽快回复。'],
      bullets: ['网站即时聊天', '首页联系表单', '订单页跟踪'],
    },
    ja: {
      title: 'お問い合わせ',
      paragraphs: ['サイズ・価格・配送のご相談はチャットまたはメッセージで。'],
      bullets: ['サイト内チャット', 'ホームの問い合わせフォーム', '注文ページで追跡'],
    },
    ko: {
      title: '문의',
      paragraphs: ['사이즈·가격·배송 문의는 채팅 또는 메시지로 남겨 주세요.'],
      bullets: ['사이트 채팅', '홈 문의 폼', '주문에서 배송 조회'],
    },
  },
  faq: {
    vi: {
      title: 'Câu hỏi thường gặp',
      paragraphs: ['Một số câu hỏi phổ biến khi mua sắm trên web shop.'],
      faq: [
        { q: 'Mua hàng thế nào?', a: 'Chọn sản phẩm → Thêm vào giỏ → Thanh toán, hoặc chat để được hỗ trợ.' },
        { q: 'Giao hàng bao lâu?', a: 'Tùy khu vực — shop báo cụ thể khi bạn đặt hoặc chat.' },
        { q: 'Đổi trả?', a: 'Theo chính sách shop — xem trang Đổi trả hoặc hỏi qua chat.' },
      ],
    },
    en: {
      title: 'FAQ',
      paragraphs: ['Common questions when shopping on this site.'],
      faq: [
        { q: 'How do I order?', a: 'Pick a product → Add to cart → Checkout, or chat for help.' },
        { q: 'How long is shipping?', a: 'Depends on your area — ask in chat for details.' },
        { q: 'Returns?', a: 'Follow the shop policy — see Returns or ask via chat.' },
      ],
    },
    zh: {
      title: '常见问题',
      paragraphs: ['购物时的常见问题。'],
      faq: [
        { q: '如何下单？', a: '选商品 → 加入购物车 → 结账，或聊天咨询。' },
        { q: '多久送达？', a: '视地区而定 — 可在聊天中询问。' },
        { q: '退换？', a: '按店铺政策 — 见退换页或聊天。' },
      ],
    },
    ja: {
      title: 'FAQ',
      paragraphs: ['よくあるご質問。'],
      faq: [
        { q: '注文方法は？', a: '商品を選ぶ → カートへ → 購入、またはチャットで相談。' },
        { q: '配送期間は？', a: '地域により異なります。チャットでご確認ください。' },
        { q: '返品は？', a: 'ショップポリシーに準じます。返品ページまたはチャットへ。' },
      ],
    },
    ko: {
      title: 'FAQ',
      paragraphs: ['자주 묻는 질문입니다.'],
      faq: [
        { q: '주문 방법?', a: '상품 선택 → 장바구니 → 결제, 또는 채팅 문의.' },
        { q: '배송 기간?', a: '지역에 따라 다릅니다 — 채팅으로 확인하세요.' },
        { q: '교환/반품?', a: '샵 정책을 따르며 반품 페이지 또는 채팅으로 문의하세요.' },
      ],
    },
  },
  sale: {
    vi: {
      title: 'Khuyến mãi',
      paragraphs: ['Săn ưu đãi — xem toàn bộ sản phẩm đang bán và hỏi chat để nhận mã giảm khi có.'],
    },
    en: {
      title: 'Sale',
      paragraphs: ['Browse deals — view all products and chat for coupon codes when available.'],
    },
    zh: { title: '促销', paragraphs: ['浏览优惠商品，有优惠码时可通过聊天领取。'] },
    ja: { title: 'セール', paragraphs: ['お得な商品をチェック。クーポンはチャットでお問い合わせください。'] },
    ko: { title: '세일', paragraphs: ['특가 상품을 둘러보고, 쿠폰은 채팅으로 문의하세요.'] },
  },
  shipping: {
    vi: {
      title: 'Vận chuyển',
      paragraphs: [
        'Đơn được xử lý sau khi shop xác nhận. Thời gian giao phụ thuộc khu vực và phương thức vận chuyển.',
      ],
      bullets: ['Kiểm tra phí ship khi chat hoặc checkout', 'Theo dõi đơn trong mục Đơn hàng'],
    },
    en: {
      title: 'Shipping',
      paragraphs: [
        'Orders are processed after shop confirmation. Delivery time depends on your area and carrier.',
      ],
      bullets: ['Ask about shipping fees in chat or at checkout', 'Track orders under Orders'],
    },
    zh: {
      title: '配送',
      paragraphs: ['店铺确认后处理订单。送达时间视地区与物流而定。'],
      bullets: ['聊天或结账时确认运费', '在订单页跟踪'],
    },
    ja: {
      title: '配送',
      paragraphs: ['ショップ確認後に発送します。お届け日数は地域により異なります。'],
      bullets: ['送料はチャットまたは購入時に確認', '注文ページで追跡'],
    },
    ko: {
      title: '배송',
      paragraphs: ['샵 확인 후 처리됩니다. 배송 기간은 지역·택배사에 따라 다릅니다.'],
      bullets: ['배송비는 채팅 또는 결제 시 확인', '주문에서 배송 조회'],
    },
  },
  returns: {
    vi: {
      title: 'Đổi trả',
      paragraphs: [
        'Đổi trả theo chính sách từng shop. Giữ hóa đơn/mã đơn và liên hệ sớm qua chat để được hỗ trợ.',
      ],
    },
    en: {
      title: 'Returns',
      paragraphs: [
        'Returns follow each shop’s policy. Keep your order code and contact chat support promptly.',
      ],
    },
    zh: { title: '退换', paragraphs: ['按店铺政策退换。请保留订单号并尽早通过聊天联系。'] },
    ja: {
      title: '返品・交換',
      paragraphs: ['ショップ方針に従います。注文番号を控え、チャットでご連絡ください。'],
    },
    ko: {
      title: '교환·반품',
      paragraphs: ['샵 정책에 따릅니다. 주문번호를 보관하고 채팅으로 빠르게 문의하세요.'],
    },
  },
  privacy: {
    vi: {
      title: 'Chính sách bảo mật',
      paragraphs: [
        'Chúng tôi xử lý thông tin bạn cung cấp (form, chat, đơn hàng) để phục vụ mua sắm và hỗ trợ.',
        'Có thể dùng cookie/pixel phân tích hoặc quảng cáo theo cấu hình shop. Liên hệ shop nếu cần chỉnh sửa dữ liệu.',
      ],
    },
    en: {
      title: 'Privacy policy',
      paragraphs: [
        'We process information you provide (forms, chat, orders) to fulfill shopping and support.',
        'Analytics/ads cookies or pixels may run per shop settings. Contact the shop for data requests.',
      ],
    },
    zh: {
      title: '隐私政策',
      paragraphs: ['我们处理您提供的信息（表单、聊天、订单）以完成购物与支持。', '可能按店铺设置使用分析/广告 Cookie。如需处理数据请联系店铺。'],
    },
    ja: {
      title: 'プライバシー',
      paragraphs: [
        'フォーム・チャット・注文で提供された情報を購入・サポートのために処理します。',
        'ショップ設定に応じて分析/広告Cookieを使用する場合があります。',
      ],
    },
    ko: {
      title: '개인정보 처리방침',
      paragraphs: [
        '폼·채팅·주문으로 제공된 정보를 쇼핑·지원을 위해 처리합니다.',
        '샵 설정에 따라 분석/광고 쿠키를 사용할 수 있습니다.',
      ],
    },
  },
  terms: {
    vi: {
      title: 'Điều khoản sử dụng',
      paragraphs: [
        'Khi dùng website shop, bạn đồng ý cung cấp thông tin chính xác khi đặt hàng và tuân thủ chính sách đổi trả/vận chuyển của shop.',
      ],
    },
    en: {
      title: 'Terms of use',
      paragraphs: [
        'By using this shop site, you agree to provide accurate checkout details and follow the shop’s shipping and return policies.',
      ],
    },
    zh: { title: '使用条款', paragraphs: ['使用本店网站即表示您同意提供准确订单信息并遵守配送与退换政策。'] },
    ja: {
      title: '利用規約',
      paragraphs: ['本サイト利用時、正確な注文情報の提供と配送・返品ポリシーへの同意をお願いします。'],
    },
    ko: {
      title: '이용약관',
      paragraphs: ['이 샵 사이트 이용 시 정확한 주문 정보 제공 및 배송·반품 정책 준수에 동의합니다.'],
    },
  },
}

export function getPartnerSiteInfoPage(
  key: PartnerSiteInfoPageKey,
  locale: WebLocale
): PartnerSiteInfoBlock {
  return PAGES[key][locale] || PAGES[key].en
}

export const PARTNER_SITE_PLATFORM_INFO_KEYS: PartnerSiteInfoPageKey[] = [
  'about',
  'contact',
  'faq',
  'sale',
  'shipping',
  'returns',
  'privacy',
  'terms',
]
