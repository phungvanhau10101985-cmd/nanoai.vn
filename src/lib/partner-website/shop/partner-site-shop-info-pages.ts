import type { WebLocale } from '@/lib/i18n/config'

/** Trang chính sách bắt buộc nêu tuân thủ quảng cáo Google Merchant Center / Facebook / TikTok. */
export const PARTNER_SITE_ADS_POLICY_PAGE_KEYS = [
  'privacy',
  'terms',
  'shipping',
  'returns',
  'payment',
] as const

export type PartnerSiteAdsPolicyPageKey = (typeof PARTNER_SITE_ADS_POLICY_PAGE_KEYS)[number]

const ADS_POLICY_PAGE_KEY_SET = new Set<string>(PARTNER_SITE_ADS_POLICY_PAGE_KEYS)

export function isPartnerSiteAdsPolicyPageKey(key: string | null | undefined): boolean {
  const normalized = String(key || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
  return ADS_POLICY_PAGE_KEY_SET.has(normalized)
}

const ADS_PLATFORM_POLICY_PARAGRAPH: Record<WebLocale, string> = {
  vi: 'Shop tuân thủ chính sách quảng cáo của Google Merchant Center, Facebook (Meta) và TikTok khi chạy catalog, pixel và chiến dịch quảng cáo. Thông tin sản phẩm, giá, tồn kho và dữ liệu khách được xử lý phù hợp với quy định của các nền tảng này.',
  en: 'This shop complies with the advertising policies of Google Merchant Center, Facebook (Meta), and TikTok when running catalogs, pixels, and ad campaigns. Product, price, inventory, and customer data are handled in line with those platforms’ rules.',
  zh: '本店在运行商品目录、像素与广告活动时遵守 Google Merchant Center、Facebook（Meta）和 TikTok 的广告政策。商品、价格、库存与客户数据均按上述平台规则处理。',
  ja: '当ショップはカタログ・ピクセル・広告キャンペーンの運用において、Google Merchant Center、Facebook（Meta）、TikTok の広告ポリシーを遵守します。商品・価格・在庫・お客様データは各プラットフォームの規定に沿って取り扱います。',
  ko: '이 샵은 카탈로그, 픽셀, 광고 캠페인 운영 시 Google Merchant Center, Facebook(Meta), TikTok의 광고 정책을 준수합니다. 상품, 가격, 재고, 고객 데이터는 해당 플랫폼 규정에 맞게 처리합니다.',
}

export function adsPlatformPolicyParagraph(locale: WebLocale): string {
  return ADS_PLATFORM_POLICY_PARAGRAPH[locale] || ADS_PLATFORM_POLICY_PARAGRAPH.en
}

export function contentHasAdsPlatformPolicy(text: string): boolean {
  const t = String(text || '').toLowerCase()
  return /google\s*merchant/.test(t) && /(facebook|\bmeta\b)/.test(t) && /tiktok/.test(t)
}

export function ensureAdsPlatformPolicyParagraphs(
  paragraphs: string[],
  locale: WebLocale
): string[] {
  const next = paragraphs.map((p) => String(p || '').trim()).filter(Boolean)
  if (contentHasAdsPlatformPolicy(next.join('\n'))) return next
  return [...next, adsPlatformPolicyParagraph(locale)]
}

export type PartnerSiteInfoPageKey =
  | 'about'
  | 'contact'
  | 'faq'
  | 'sale'
  | 'shipping'
  | 'returns'
  | 'privacy'
  | 'terms'
  /** W3.2 — trang phụ catalog (CMS ghi đè được). */
  | 'payment'
  | 'thank-you'
  | 'stores'
  | 'lookbook'
  | 'size-guide'
  | 'blog'
  /** 188 `/info/goi-y-tuoi-gioi` — vì sao cần tuổi / giới tính trên lưới đề xuất. */
  | 'goi-y-tuoi-gioi'

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
        ADS_PLATFORM_POLICY_PARAGRAPH.vi,
      ],
      bullets: ['Kiểm tra phí ship khi chat hoặc checkout', 'Theo dõi đơn trong mục Đơn hàng'],
    },
    en: {
      title: 'Shipping',
      paragraphs: [
        'Orders are processed after shop confirmation. Delivery time depends on your area and carrier.',
        ADS_PLATFORM_POLICY_PARAGRAPH.en,
      ],
      bullets: ['Ask about shipping fees in chat or at checkout', 'Track orders under Orders'],
    },
    zh: {
      title: '配送',
      paragraphs: ['店铺确认后处理订单。送达时间视地区与物流而定。', ADS_PLATFORM_POLICY_PARAGRAPH.zh],
      bullets: ['聊天或结账时确认运费', '在订单页跟踪'],
    },
    ja: {
      title: '配送',
      paragraphs: ['ショップ確認後に発送します。お届け日数は地域により異なります。', ADS_PLATFORM_POLICY_PARAGRAPH.ja],
      bullets: ['送料はチャットまたは購入時に確認', '注文ページで追跡'],
    },
    ko: {
      title: '배송',
      paragraphs: ['샵 확인 후 처리됩니다. 배송 기간은 지역·택배사에 따라 다릅니다.', ADS_PLATFORM_POLICY_PARAGRAPH.ko],
      bullets: ['배송비는 채팅 또는 결제 시 확인', '주문에서 배송 조회'],
    },
  },
  returns: {
    vi: {
      title: 'Đổi trả',
      paragraphs: [
        'Đổi trả theo chính sách từng shop. Giữ hóa đơn/mã đơn và liên hệ sớm qua chat để được hỗ trợ.',
        ADS_PLATFORM_POLICY_PARAGRAPH.vi,
      ],
    },
    en: {
      title: 'Returns',
      paragraphs: [
        'Returns follow each shop’s policy. Keep your order code and contact chat support promptly.',
        ADS_PLATFORM_POLICY_PARAGRAPH.en,
      ],
    },
    zh: { title: '退换', paragraphs: ['按店铺政策退换。请保留订单号并尽早通过聊天联系。', ADS_PLATFORM_POLICY_PARAGRAPH.zh] },
    ja: {
      title: '返品・交換',
      paragraphs: ['ショップ方針に従います。注文番号を控え、チャットでご連絡ください。', ADS_PLATFORM_POLICY_PARAGRAPH.ja],
    },
    ko: {
      title: '교환·반품',
      paragraphs: ['샵 정책에 따릅니다. 주문번호를 보관하고 채팅으로 빠르게 문의하세요.', ADS_PLATFORM_POLICY_PARAGRAPH.ko],
    },
  },
  privacy: {
    vi: {
      title: 'Chính sách bảo mật',
      paragraphs: [
        'Chúng tôi xử lý thông tin bạn cung cấp (form, chat, đơn hàng) để phục vụ mua sắm và hỗ trợ.',
        'Có thể dùng cookie/pixel phân tích hoặc quảng cáo theo cấu hình shop. Liên hệ shop nếu cần chỉnh sửa dữ liệu.',
        ADS_PLATFORM_POLICY_PARAGRAPH.vi,
      ],
    },
    en: {
      title: 'Privacy policy',
      paragraphs: [
        'We process information you provide (forms, chat, orders) to fulfill shopping and support.',
        'Analytics/ads cookies or pixels may run per shop settings. Contact the shop for data requests.',
        ADS_PLATFORM_POLICY_PARAGRAPH.en,
      ],
    },
    zh: {
      title: '隐私政策',
      paragraphs: [
        '我们处理您提供的信息（表单、聊天、订单）以完成购物与支持。',
        '可能按店铺设置使用分析/广告 Cookie。如需处理数据请联系店铺。',
        ADS_PLATFORM_POLICY_PARAGRAPH.zh,
      ],
    },
    ja: {
      title: 'プライバシー',
      paragraphs: [
        'フォーム・チャット・注文で提供された情報を購入・サポートのために処理します。',
        'ショップ設定に応じて分析/広告Cookieを使用する場合があります。',
        ADS_PLATFORM_POLICY_PARAGRAPH.ja,
      ],
    },
    ko: {
      title: '개인정보 처리방침',
      paragraphs: [
        '폼·채팅·주문으로 제공된 정보를 쇼핑·지원을 위해 처리합니다.',
        '샵 설정에 따라 분석/광고 쿠키를 사용할 수 있습니다.',
        ADS_PLATFORM_POLICY_PARAGRAPH.ko,
      ],
    },
  },
  terms: {
    vi: {
      title: 'Điều khoản sử dụng',
      paragraphs: [
        'Khi dùng website shop, bạn đồng ý cung cấp thông tin chính xác khi đặt hàng và tuân thủ chính sách đổi trả/vận chuyển của shop.',
        ADS_PLATFORM_POLICY_PARAGRAPH.vi,
      ],
    },
    en: {
      title: 'Terms of use',
      paragraphs: [
        'By using this shop site, you agree to provide accurate checkout details and follow the shop’s shipping and return policies.',
        ADS_PLATFORM_POLICY_PARAGRAPH.en,
      ],
    },
    zh: { title: '使用条款', paragraphs: ['使用本店网站即表示您同意提供准确订单信息并遵守配送与退换政策。', ADS_PLATFORM_POLICY_PARAGRAPH.zh] },
    ja: {
      title: '利用規約',
      paragraphs: ['本サイト利用時、正確な注文情報の提供と配送・返品ポリシーへの同意をお願いします。', ADS_PLATFORM_POLICY_PARAGRAPH.ja],
    },
    ko: {
      title: '이용약관',
      paragraphs: ['이 샵 사이트 이용 시 정확한 주문 정보 제공 및 배송·반품 정책 준수에 동의합니다.', ADS_PLATFORM_POLICY_PARAGRAPH.ko],
    },
  },
  payment: {
    vi: {
      title: 'Hướng dẫn thanh toán',
      paragraphs: [
        'Shop hỗ trợ thanh toán khi nhận hàng (COD), chuyển khoản ngân hàng, và ví điện tử (nếu đã cấu hình).',
        'Khi đơn yêu cầu đặt cọc, vui lòng chuyển đúng số tiền và nội dung tham chiếu — shop xác nhận sau khi nhận được thanh toán.',
        ADS_PLATFORM_POLICY_PARAGRAPH.vi,
      ],
      bullets: ['COD — thanh toán khi nhận hàng', 'Chuyển khoản — quét QR / chuyển đúng nội dung', 'Ví điện tử — quét QR ví của shop (nếu có)'],
    },
    en: {
      title: 'Payment guide',
      paragraphs: [
        'This shop may accept cash on delivery (COD), bank transfer, and e-wallet QR (when configured).',
        'If a deposit is required, transfer the exact amount with the payment reference — the shop confirms after payment is received.',
        ADS_PLATFORM_POLICY_PARAGRAPH.en,
      ],
      bullets: ['COD — pay on delivery', 'Bank transfer — scan QR / use the reference', 'E-wallet — scan the shop QR (if available)'],
    },
    zh: {
      title: '支付说明',
      paragraphs: [
        '本店可支持货到付款、银行转账及电子钱包（如已配置）。',
        '如需定金，请按提示金额与备注转账，店铺确认到账后继续履约。',
        ADS_PLATFORM_POLICY_PARAGRAPH.zh,
      ],
      bullets: ['货到付款', '银行转账 / QR', '电子钱包 QR（如有）'],
    },
    ja: {
      title: 'お支払い案内',
      paragraphs: [
        '代金引換・銀行振込・電子マネー（設定時）に対応する場合があります。',
        'デポジットが必要な場合は案内どおりの金額・明細でお振込みください。',
        ADS_PLATFORM_POLICY_PARAGRAPH.ja,
      ],
      bullets: ['代金引換', '銀行振込 / QR', '電子マネー QR（設定時）'],
    },
    ko: {
      title: '결제 안내',
      paragraphs: [
        '착불(COD), 계좌이체, 전자지갑 QR(설정 시)을 지원할 수 있습니다.',
        '보증금이 필요하면 안내된 금액과 참조 내용으로 이체해 주세요.',
        ADS_PLATFORM_POLICY_PARAGRAPH.ko,
      ],
      bullets: ['착불', '계좌이체 / QR', '전자지갑 QR(있을 때)'],
    },
  },
  'thank-you': {
    vi: {
      title: 'Cảm ơn bạn đã đặt hàng',
      paragraphs: [
        'Đơn hàng của bạn đã được ghi nhận. Shop sẽ liên hệ hoặc xử lý theo phương thức thanh toán đã chọn.',
        'Bạn có thể theo dõi đơn trong mục Đơn hàng, hoặc chat shop nếu cần hỗ trợ thêm.',
      ],
      bullets: ['Kiểm tra email/SMS nếu shop gửi xác nhận', 'Giữ mã đơn để tra cứu', 'Chat shop khi cần đổi địa chỉ hoặc size'],
    },
    en: {
      title: 'Thank you for your order',
      paragraphs: [
        'Your order has been received. The shop will follow up based on the payment method you chose.',
        'Track the order under Orders, or chat with the shop if you need help.',
      ],
      bullets: ['Check email/SMS for confirmation', 'Keep your order ID', 'Chat the shop to change address or options'],
    },
    zh: {
      title: '感谢您的订购',
      paragraphs: ['订单已收到。店铺将按您选择的支付方式继续处理。', '可在“订单”中跟踪，或通过聊天联系店铺。'],
      bullets: ['留意确认通知', '保留订单编号', '需要改地址可聊天联系'],
    },
    ja: {
      title: 'ご注文ありがとうございます',
      paragraphs: ['注文を受け付けました。選択した支払い方法に沿ってショップが対応します。', '注文ページで追跡するか、チャットでご相談ください。'],
      bullets: ['確認通知を確認', '注文IDを控える', '住所変更はチャットで'],
    },
    ko: {
      title: '주문해 주셔서 감사합니다',
      paragraphs: ['주문이 접수되었습니다. 선택한 결제 방식에 따라 샵이 처리합니다.', '주문 메뉴에서 조회하거나 채팅으로 문의하세요.'],
      bullets: ['확인 알림 확인', '주문 번호 보관', '주소 변경은 채팅으로'],
    },
  },
  stores: {
    vi: {
      title: 'Cửa hàng',
      paragraphs: [
        'Cập nhật địa chỉ showroom / cửa hàng offline, giờ mở cửa và hướng dẫn đến chỗ tại đây.',
        'Merchant có thể sửa nội dung trang này trong CMS (Trang tĩnh) — thêm địa chỉ, bản đồ hoặc link chỉ đường.',
      ],
      bullets: ['Địa chỉ & giờ mở cửa', 'Liên hệ trực tiếp tại cửa hàng', 'Chat trước khi đến nếu cần giữ hàng'],
    },
    en: {
      title: 'Stores',
      paragraphs: [
        'List offline store addresses, opening hours, and directions here.',
        'Merchants can edit this page in CMS (Static pages) — add addresses, map links, or visit tips.',
      ],
      bullets: ['Address & hours', 'In-store contact', 'Chat ahead to reserve items'],
    },
    zh: {
      title: '门店',
      paragraphs: ['在此填写线下门店地址、营业时间与路线。', '商家可在 CMS（静态页）中编辑本页内容。'],
      bullets: ['地址与营业时间', '到店联系', '到店前可先聊天'],
    },
    ja: {
      title: '店舗一覧',
      paragraphs: ['実店舗の住所・営業時間・アクセスを記載します。', 'CMS（固定ページ）から内容を編集できます。'],
      bullets: ['住所と営業時間', '店舗での連絡', '来店前にチャットも可'],
    },
    ko: {
      title: '매장',
      paragraphs: ['오프라인 매장 주소, 영업시간, 오시는 길을 안내합니다.', 'CMS(정적 페이지)에서 내용을 수정할 수 있습니다.'],
      bullets: ['주소·영업시간', '매장 연락', '방문 전 채팅 가능'],
    },
  },
  lookbook: {
    vi: {
      title: 'Lookbook',
      paragraphs: [
        'Không gian giới thiệu phong cách / chiến dịch của shop — hình ảnh, caption và gợi ý sản phẩm liên quan.',
        'Merchant sửa nội dung và thêm link sản phẩm qua CMS (Trang tĩnh).',
      ],
    },
    en: {
      title: 'Lookbook',
      paragraphs: [
        'A space for campaign looks and style inspiration — images, captions, and related product ideas.',
        'Merchants can edit content and product links via CMS (Static pages).',
      ],
    },
    zh: {
      title: 'Lookbook',
      paragraphs: ['展示店铺造型与活动灵感 — 图片、说明与相关商品。', '商家可在 CMS（静态页）编辑内容。'],
    },
    ja: {
      title: 'ルックブック',
      paragraphs: ['スタイルやキャンペーンのギャラリーです。', 'CMS（固定ページ）から内容を編集できます。'],
    },
    ko: {
      title: '룩북',
      paragraphs: ['스타일·캠페인 룩을 소개하는 공간입니다.', 'CMS(정적 페이지)에서 내용을 수정할 수 있습니다.'],
    },
  },
  'size-guide': {
    vi: {
      title: 'Hướng dẫn chọn size',
      paragraphs: [
        'Tham khảo cách đo và gợi ý chọn size trước khi đặt hàng. Bảng size chi tiết theo từng sản phẩm có thể nằm trên trang sản phẩm.',
        'Không chắc size? Chat shop để được tư vấn — merchant có thể cập nhật bảng đo tại đây qua CMS.',
      ],
      bullets: ['Đo ngực / eo / hông / chiều dài theo hướng dẫn', 'So với bảng size shop cung cấp', 'Chat nếu đang giữa hai size'],
    },
    en: {
      title: 'Size guide',
      paragraphs: [
        'How to measure and pick a size before ordering. Product-specific charts may also appear on each product page.',
        'Unsure? Chat the shop — merchants can update measurement tips here via CMS.',
      ],
      bullets: ['Measure chest / waist / hips / length as guided', 'Compare with the shop chart', 'Chat if you are between sizes'],
    },
    zh: {
      title: '尺码指南',
      paragraphs: ['下单前参考测量与选码建议。各商品页也可能有专属尺码表。', '不确定？可聊天咨询；商家可通过 CMS 更新本页。'],
      bullets: ['按说明测量', '对照店铺尺码表', '介于两码之间可咨询'],
    },
    ja: {
      title: 'サイズガイド',
      paragraphs: ['注文前の採寸とサイズ選びの目安です。商品ページにも個別ガイドがある場合があります。', '迷ったらチャットで相談を。CMSから内容を更新できます。'],
      bullets: ['案内どおり採寸', 'ショップの表と比較', '中間サイズは相談を'],
    },
    ko: {
      title: '사이즈 가이드',
      paragraphs: ['주문 전 측정과 사이즈 선택 안내입니다. 상품 페이지에 개별 표가 있을 수 있습니다.', '확신이 없으면 채팅으로 문의하세요. CMS에서 내용을 수정할 수 있습니다.'],
      bullets: ['안내에 따라 측정', '샵 사이즈표와 비교', '중간 사이즈는 문의'],
    },
  },
  blog: {
    vi: {
      title: 'Blog & tips',
      paragraphs: [
        'Trang giới thiệu bài viết / mẹo mua sắm của shop. Hiện hỗ trợ nội dung trang tĩnh — merchant soạn nội dung qua CMS.',
        'Danh sách nhiều bài + phân trang (blog đầy đủ) sẽ bổ sung sau; tạm thời dùng trang này làm landing nội dung.',
      ],
    },
    en: {
      title: 'Blog & tips',
      paragraphs: [
        'A landing page for shop tips and updates. Merchants can edit this static content via CMS.',
        'A full multi-post blog with pagination will come later — use this page as the content landing for now.',
      ],
    },
    zh: {
      title: '博客与技巧',
      paragraphs: ['店铺内容/购物技巧落地页。商家可通过 CMS 编辑静态内容。', '多文章列表与分页将在后续提供。'],
    },
    ja: {
      title: 'ブログ / Tips',
      paragraphs: ['ショップのTipsやお知らせ用ページです。CMSから編集できます。', '複数記事のブログ機能は今後追加予定です。'],
    },
    ko: {
      title: '블로그 / 팁',
      paragraphs: ['샵 팁과 소식을 위한 랜딩 페이지입니다. CMS에서 내용을 수정할 수 있습니다.', '여러 글 목록/페이지네이션은 추후 제공됩니다.'],
    },
  },
  'goi-y-tuoi-gioi': {
    vi: {
      title: 'Vì sao cần ngày sinh và giới tính?',
      paragraphs: [
        'Shop hỏi hai thông tin này để chăm sóc bạn tốt hơn — không phải để thu thập cho mục đích khác.',
        'Bạn vẫn mua sắm bình thường nếu chưa điền. Khi bổ sung ngày sinh và giới tính, shop mới gửi ưu đãi sinh nhật và gợi ý hợp tuổi, hợp gu.',
      ],
      bullets: [
        'Ưu đãi & quà tặng dịp sinh nhật — khi hồ sơ có ngày sinh.',
        'Gợi ý sản phẩm hợp tuổi, hợp gu trên lưới đề xuất (trộn cùng shop nguồn và danh mục cấp 3 bạn vừa xem).',
        'Ngày sinh và giới tính không hiển thị công khai; chỉ dùng cho ưu đãi và gợi ý trên tài khoản của bạn.',
        'Bạn có thể cập nhật hoặc chỉnh sửa bất cứ lúc nào trong Hồ sơ.',
      ],
    },
    en: {
      title: 'Why do we ask for date of birth and gender?',
      paragraphs: [
        'The shop asks for these two details to take better care of you — not to collect them for other uses.',
        'You can still shop without filling them in. Birthday offers and age-matched suggestions appear after you add date of birth and gender.',
      ],
      bullets: [
        'Birthday offers and gifts when your profile has a date of birth.',
        'Recommendations that mix your age/gender cohort with the same source shop and level-3 categories of items you just viewed.',
        'Date of birth and gender are not shown publicly; they are only used for offers and suggestions on your account.',
        'You can update them anytime in your profile.',
      ],
    },
    zh: {
      title: '为什么需要生日和性别？',
      paragraphs: [
        '店铺询问这两项信息是为了更好地服务你，而不是用于其他用途。',
        '未填写也可以正常购物。补充生日和性别后，才能收到生日优惠和更合适的推荐。',
      ],
      bullets: [
        '资料中有生日即可收到生日优惠。',
        '推荐会结合同龄同性别、同一来源店铺，以及你最近浏览商品的三级类目。',
        '生日和性别不会公开显示，仅用于你的优惠与推荐。',
        '可随时在个人资料中更新。',
      ],
    },
    ja: {
      title: '生年月日と性別が必要な理由',
      paragraphs: [
        'ショップはより良いご案内のためにこの2項目をお伺いします。他の目的では使いません。',
        '未入力でもお買い物できます。生年月日と性別を追加すると、誕生日特典と年齢に合うおすすめが表示されます。',
      ],
      bullets: [
        'プロフィールに生年月日があると誕生日特典をお届けします。',
        'おすすめは同年代・同性、同じ仕入れショップ、最近見た商品の第3階層カテゴリを混ぜます。',
        '生年月日と性別は公開されません。特典とおすすめのみに使います。',
        'プロフィールからいつでも更新できます。',
      ],
    },
    ko: {
      title: '생년월일과 성별이 필요한 이유',
      paragraphs: [
        '샵은 더 나은 안내를 위해 이 두 정보를 묻습니다. 다른 용도로 수집하지 않습니다.',
        '입력하지 않아도 쇼핑할 수 있습니다. 생년월일과 성별을 추가하면 생일 혜택과 나이에 맞는 추천이 나타납니다.',
      ],
      bullets: [
        '프로필에 생일이 있으면 생일 혜택을 받을 수 있습니다.',
        '추천은 같은 나이·성별, 같은 출처 샵, 최근 본 상품의 3단계 카테고리를 섞습니다.',
        '생년월일과 성별은 공개되지 않으며 혜택과 추천에만 사용됩니다.',
        '프로필에서 언제든 수정할 수 있습니다.',
      ],
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
  'payment',
  'thank-you',
  'stores',
  'lookbook',
  'size-guide',
  'blog',
  'goi-y-tuoi-gioi',
]
