import type { WebLocale } from '@/lib/i18n/config'

/** Trang chính sách bắt buộc nêu tuân thủ quảng cáo Google Merchant Center / Facebook / TikTok. */
export const PARTNER_SITE_ADS_POLICY_PAGE_KEYS = [
  'privacy',
  'terms',
  'shipping',
  'returns',
  'payment',
  'how-to-buy',
  'brand-origin',
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
  | 'how-to-buy'
  | 'brand-origin'
  | 'reviews-policy'
  | 'trust'
  | 'company'
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
  'how-to-buy': {
    vi: {
      title: 'Hướng dẫn mua hàng',
      paragraphs: [
        'Chọn sản phẩm trên website, kiểm tra ảnh / size / màu trên trang chi tiết, rồi thêm giỏ hoặc mua. Đặt hàng cần đăng nhập để shop xác nhận đơn và liên hệ giao hàng.',
        'Một số sản phẩm yêu cầu đặt cọc theo cài đặt thanh toán của shop (tỷ lệ hoặc số tiền cố định — không phải mọi shop đều giống nhau). Phần còn lại và phí vận chuyển (nếu có) thanh toán khi nhận hàng. Sản phẩm không yêu cầu cọc được xử lý ngay sau khi đặt.',
        'Khi chuyển khoản, ghi đúng nội dung tham chiếu trên trang cọc / đơn hàng để shop đối chiếu. Giao không đúng mô tả hoặc lỗi sản xuất: shop gửi lại mẫu đúng hoặc hoàn tiền đã thanh toán theo chính sách đổi trả.',
        'Size không vừa: liên hệ sớm qua chat; shop hỗ trợ đổi theo trang Đổi trả. Sau khi nhận hàng, hãy đánh giá để khách khác có thông tin trung thực.',
        ADS_PLATFORM_POLICY_PARAGRAPH.vi,
      ],
      bullets: [
        'Xem chi tiết → chọn màu / size → Thêm giỏ hoặc Mua',
        'Cọc (nếu có) theo đúng số shop hiển thị lúc đặt hàng',
        'COD, chuyển khoản hoặc ví điện tử — tùy shop đã cấu hình',
        'Theo dõi đơn trong mục Đơn hàng; chat shop khi cần hỗ trợ',
      ],
    },
    en: {
      title: 'How to buy',
      paragraphs: [
        'Pick a product, check photos / size / color on the detail page, then add to cart or buy. Checkout requires sign-in so the shop can confirm and ship.',
        'Some items need a deposit per this shop’s payment settings (a percent or a fixed amount — not the same for every shop). The remainder and shipping (if any) are paid on delivery. Items without a deposit are processed after you place the order.',
        'When transferring, use the exact payment reference on the deposit / order page. Wrong item or manufacturing defect: the shop resends the correct item or refunds what you paid, following the returns policy.',
        'If the size does not fit, contact chat promptly; exchanges follow the Returns page. After delivery, please leave a review so other shoppers have honest information.',
        ADS_PLATFORM_POLICY_PARAGRAPH.en,
      ],
      bullets: [
        'Open the product → choose color / size → Add to cart or Buy',
        'Pay any deposit shown at checkout for that shop',
        'COD, bank transfer, or e-wallet — as the shop configured',
        'Track under Orders; chat the shop if you need help',
      ],
    },
    zh: {
      title: '购买指南',
      paragraphs: [
        '在网站选择商品，核对详情页的图片、尺码与颜色后加入购物车或立即购买。下单需登录，便于店铺确认并发货。',
        '部分商品需按本店支付设置支付定金（比例或固定金额，各店不同）。余款与运费（如有）可货到付款。无需定金的商品在下单后即可处理。',
        '转账请填写订单/定金页上的备注。若发错或存在生产缺陷，店铺将按退换政策补发或退款。',
        '尺码不合适请尽快通过聊天联系；换货以退换页为准。收货后欢迎评价，方便其他顾客参考。',
        ADS_PLATFORM_POLICY_PARAGRAPH.zh,
      ],
      bullets: ['查看详情 → 选颜色/尺码 → 加购或购买', '按本店结账页显示的定金支付（如有）', '货到付款、银行转账或电子钱包', '在订单页跟踪，需要时聊天联系店铺'],
    },
    ja: {
      title: 'ご購入ガイド',
      paragraphs: [
        '商品を選び、詳細ページで写真・サイズ・カラーを確認してからカートまたは購入へ進みます。注文にはログインが必要です。',
        'デポジットはショップの支払い設定（割合または定額）に従います。店舗ごとに異なります。残金と送料（ある場合）は代金引換できます。デポジット不要の商品は注文後に処理します。',
        '振込時は注文／デポジットページの内容を正確に記入してください。誤配送や製造不良は返品ポリシーに従い再送または返金します。',
        'サイズが合わない場合は早めにチャットでご連絡ください。受取後のレビューにご協力ください。',
        ADS_PLATFORM_POLICY_PARAGRAPH.ja,
      ],
      bullets: ['詳細を見る → カラー／サイズ → カートまたは購入', '決済時に表示されたデポジット（必要な場合）', '代金引換・銀行振込・電子マネー', '注文ページで追跡、必要ならチャット'],
    },
    ko: {
      title: '구매 안내',
      paragraphs: [
        '상품을 고르고 상세 페이지에서 사진·사이즈·색상을 확인한 뒤 장바구니 또는 구매로 진행하세요. 주문은 로그인이 필요합니다.',
        '보증금은 이 샵의 결제 설정(비율 또는 고정 금액)을 따릅니다. 샵마다 다릅니다. 잔액과 배송비(있을 경우)는 착불할 수 있습니다. 보증금이 없는 상품은 주문 후 바로 처리됩니다.',
        '이체 시 주문/보증금 페이지의 참조 내용을 정확히 적어 주세요. 오배송이나 제조 불량은 교환·반품 정책에 따라 재발송 또는 환불합니다.',
        '사이즈가 맞지 않으면 채팅으로 빨리 문의하세요. 수령 후 다른 고객을 위해 리뷰를 남겨 주세요.',
        ADS_PLATFORM_POLICY_PARAGRAPH.ko,
      ],
      bullets: ['상세 보기 → 색상/사이즈 → 장바구니 또는 구매', '결제 화면에 표시된 보증금(있을 때)', '착불, 계좌이체, 전자지갑', '주문에서 조회, 필요 시 채팅'],
    },
  },
  'brand-origin': {
    vi: {
      title: 'Nguồn gốc và thương hiệu sản phẩm',
      paragraphs: [
        'Shop là nhà bán lẻ độc lập trên website này. Hàng được chọn từ nhiều nhà cung ứng trong và ngoài nước (tùy danh mục đang bán), quản lý bằng mã SKU để truy xuất.',
        'Trước khi giao, shop kiểm tra hình thức, chất liệu và độ hoàn thiện. Shop chịu trách nhiệm về chất lượng sản phẩm phân phối trên website — không kinh doanh hàng giả, hàng nhái, hàng vi phạm bản quyền.',
        'Trừ khi trang sản phẩm ghi rõ, shop không tuyên bố là đại diện chính thức hay được ủy quyền của thương hiệu được nhắc đến. Ảnh và mô tả phản ánh hàng đang bán; thắc mắc nguồn gốc vui lòng chat shop.',
        'Shop tuân thủ Luật Bảo vệ quyền lợi người tiêu dùng Việt Nam và quy định minh bạch thông tin thương mại của Bộ Công Thương.',
        ADS_PLATFORM_POLICY_PARAGRAPH.vi,
      ],
      bullets: [
        'SKU riêng từng sản phẩm',
        'Kiểm tra trước khi đóng gói',
        'Không hàng giả / hàng nhái',
        'Đơn vị chịu trách nhiệm: xem trang Thông tin đơn vị',
      ],
    },
    en: {
      title: 'Product origin & brands',
      paragraphs: [
        'This shop is an independent retailer. Goods are sourced from domestic and overseas suppliers (depending on the catalog) and tracked by SKU.',
        'Items are checked for appearance, materials, and finish before shipping. The shop is responsible for the quality sold on this website and does not sell counterfeit or copyright-infringing goods.',
        'Unless a product page says otherwise, the shop is not an official brand representative or licensee. Photos and descriptions match what is sold; ask in chat about origin.',
        'The shop follows Vietnam’s consumer-protection law and Ministry of Industry and Trade transparency rules.',
        ADS_PLATFORM_POLICY_PARAGRAPH.en,
      ],
      bullets: [
        'SKU per product',
        'Checked before packing',
        'No counterfeits',
        'Legal entity: see Company information',
      ],
    },
    zh: {
      title: '商品来源与品牌',
      paragraphs: [
        '本店为独立零售商。商品来自国内外供应商（视在售品类而定），以 SKU 管理可追溯。',
        '发货前检查外观、材质与做工。本店对网站所售商品质量负责，不经营假冒、侵权商品。',
        '除非商品页另行说明，本店并非所提及品牌的官方授权代表。图片与描述对应在售商品；来源疑问请通过聊天咨询。',
        '本店遵守越南消费者权益保护法及工贸部商业信息公开规定。',
        ADS_PLATFORM_POLICY_PARAGRAPH.zh,
      ],
      bullets: ['每件商品独立 SKU', '包装前质检', '不售假冒伪劣', '责任主体见「单位信息」页'],
    },
    ja: {
      title: '商品の産地とブランド',
      paragraphs: [
        '当ショップは独立した小売です。取扱カテゴリに応じて国内外の供給元から仕入れ、SKU で管理します。',
        '出荷前に外観・素材・仕上げを確認します。偽造品・権利侵害品は扱いません。',
        '商品ページに明記がない限り、言及ブランドの公式代理店ではありません。産地の質問はチャットへ。',
        'ベトナム消費者保護法および商工省の情報透明性ルールに従います。',
        ADS_PLATFORM_POLICY_PARAGRAPH.ja,
      ],
      bullets: ['商品ごとの SKU', '梱包前チェック', '偽造品なし', '責任主体は「事業者情報」'],
    },
    ko: {
      title: '상품 원산지와 브랜드',
      paragraphs: [
        '이 샵은 독립 소매점입니다. 판매 카테고리에 따라 국내외 공급처에서 매입하며 SKU로 추적합니다.',
        '발송 전 외관·소재·마감을 확인합니다. 위조·권리 침해 상품은 취급하지 않습니다.',
        '상품 페이지에 달리 적혀 있지 않으면 언급된 브랜드의 공식 대리점이 아닙니다. 원산지는 채팅으로 문의하세요.',
        '베트남 소비자보호법과 산업통상부 정보 공개 규정을 따릅니다.',
        ADS_PLATFORM_POLICY_PARAGRAPH.ko,
      ],
      bullets: ['상품별 SKU', '포장 전 검수', '위조품 없음', '책임 주체는 사업자 정보 페이지'],
    },
  },
  'reviews-policy': {
    vi: {
      title: 'Chính sách quản lý đánh giá và chất lượng',
      paragraphs: [
        'Chỉ khách đã nhận hàng (đơn đã giao) mới được đánh giá sản phẩm. Shop không sửa nội dung đánh giá của khách. Đánh giá sai sự thật, spam hoặc không liên quan đến sản phẩm có thể bị ẩn hoặc xóa để giữ tính trung thực.',
        'Phản hồi đúng thực tế — tích cực hoặc tiêu cực — được giữ lại để khách khác có góc nhìn khách quan. Sản phẩm kém chất lượng hoặc nhận nhiều đánh giá không tốt sẽ được rà soát và có thể gỡ khỏi website.',
        'Thắc mắc về đánh giá hoặc chất lượng: liên hệ qua trang Liên hệ hoặc chat trên web. Chính sách đổi trả xem trang Đổi trả.',
      ],
      bullets: [
        'Đánh giá gắn với đơn đã nhận hàng',
        'Không chỉnh sửa lời khách',
        'Ẩn spam / nội dung giả',
        'Gỡ hàng không đạt chất lượng',
      ],
    },
    en: {
      title: 'Review & quality policy',
      paragraphs: [
        'Only customers who received the order (delivered) may review a product. The shop does not edit customer review text. False, spam, or off-topic reviews may be hidden or removed to keep feedback honest.',
        'Factual feedback — positive or negative — stays so other shoppers can judge fairly. Poor-quality items or products with many negative reviews are reviewed and may be taken down.',
        'Questions about reviews or quality: use Contact or on-site chat. Returns are on the Returns page.',
      ],
      bullets: [
        'Reviews tied to delivered orders',
        'Customer wording is not edited',
        'Spam / fake content may be hidden',
        'Substandard items may be removed',
      ],
    },
    zh: {
      title: '评价与质量管理政策',
      paragraphs: [
        '仅已收货（已送达）的顾客可评价商品。店铺不修改顾客评价原文。虚假、垃圾或与商品无关的评价可能被隐藏或删除。',
        '符合事实的评价——无论好评差评——均予保留。质量差或差评较多的商品将被审核，必要时下架。',
        '评价或质量疑问请通过联系页或网站聊天咨询。退换见退换页。',
      ],
      bullets: ['评价与已送达订单绑定', '不改写顾客原文', '可隐藏垃圾/虚假内容', '不合格商品可下架'],
    },
    ja: {
      title: 'レビューと品質管理ポリシー',
      paragraphs: [
        '商品レビューは受取済み（配達完了）のお客様のみ可能です。ショップは本文を編集しません。虚偽・スパム・無関係な内容は非表示または削除する場合があります。',
        '事実に基づく評価（良い／悪い）は残します。品質が低い商品や低評価が多い商品は見直し、掲載を終了することがあります。',
        'レビューや品質の問い合わせはお問い合わせページまたはチャットへ。返品は返品ページをご覧ください。',
      ],
      bullets: ['配達完了注文に紐づくレビュー', 'お客様の文言は編集しない', 'スパム／虚偽は非表示可', '基準未満の商品は削除可'],
    },
    ko: {
      title: '리뷰 및 품질 관리 정책',
      paragraphs: [
        '상품 리뷰는 수령(배송 완료)한 고객만 작성할 수 있습니다. 샵은 고객 리뷰 문구를 수정하지 않습니다. 허위·스팸·상품과 무관한 내용은 숨기거나 삭제할 수 있습니다.',
        '사실에 맞는 평가(긍정·부정)는 유지합니다. 품질이 낮거나 부정 리뷰가 많은 상품은 검토 후 내릴 수 있습니다.',
        '리뷰·품질 문의는 문의 페이지 또는 채팅으로. 교환·반품은 해당 페이지를 보세요.',
      ],
      bullets: ['배송 완료 주문에 연결된 리뷰', '고객 문구 미수정', '스팸/허위 숨김 가능', '기준 미달 상품 삭제 가능'],
    },
  },
  trust: {
    vi: {
      title: 'Shop có uy tín không?',
      paragraphs: [
        'Mua online, khách thường hỏi shop có thật và có giữ lời cam kết hay không. Trang này giúp bạn tự kiểm tra — không thay cho đánh giá của chính bạn.',
        'Website công khai chính sách giao hàng, đổi trả, bảo mật, điều khoản, nguồn gốc hàng và thông tin đơn vị chịu trách nhiệm. Đơn hàng, cọc (nếu có) và đánh giá sau nhận hàng đều gắn với tài khoản khách trên chính website này.',
        'Sản phẩm có đánh giá từ người đã mua; hàng nhiều phản hồi kém có thể bị gỡ. Địa chỉ / điện thoại / email liên hệ nằm trên trang Liên hệ và Thông tin đơn vị — chủ shop cần điền đủ thông tin pháp lý.',
        'Hãy đọc chính sách, xem đánh giá sản phẩm, và chat shop trước khi đặt nếu còn băn khoăn.',
      ],
      bullets: [
        'Chính sách và đơn vị chịu trách nhiệm công khai trên web',
        'Đánh giá gắn đơn đã giao',
        'Liên hệ và địa chỉ trên trang Liên hệ / Thông tin đơn vị',
        'Đổi trả và nguồn gốc hàng có trang riêng',
      ],
    },
    en: {
      title: 'Is this shop trustworthy?',
      paragraphs: [
        'Online shoppers often ask whether the seller is real and keeps its promises. This page helps you check — it does not replace your own judgment.',
        'Shipping, returns, privacy, terms, product origin, and the responsible business are published on this website. Orders, deposits (if any), and post-delivery reviews are tied to the customer account on this site.',
        'Products can show reviews from buyers; items with persistently poor feedback may be removed. Contact details are on Contact and Company information — the merchant should fill in legal identity.',
        'Read the policies, check product reviews, and chat the shop before ordering if anything is unclear.',
      ],
      bullets: [
        'Policies and legal entity are on the site',
        'Reviews tied to delivered orders',
        'Contact details on Contact / Company pages',
        'Separate pages for returns and product origin',
      ],
    },
    zh: {
      title: '本店是否可信？',
      paragraphs: [
        '网购时顾客常问店铺是否真实、能否履约。本页帮助您自行核对，不能代替您的判断。',
        '本站公开配送、退换、隐私、条款、货源及责任主体。订单、定金（如有）与收货后评价均绑定本站顾客账户。',
        '商品可展示已购顾客评价；持续差评的商品可能下架。联系方式见联系页与单位信息——商家应填写完整法定信息。',
        '下单前请阅读政策、查看评价，有疑问请聊天咨询。',
      ],
      bullets: ['政策与责任主体在网站公开', '评价绑定已送达订单', '联系方式见联系/单位信息页', '退换与货源有独立页面'],
    },
    ja: {
      title: 'このショップは信頼できますか？',
      paragraphs: [
        'オンライン購入では、販売者が実在し約束を守るかが気になります。このページは確認の手助けであり、ご自身の判断に代わるものではありません。',
        '配送・返品・プライバシー・利用規約・産地・責任主体を本サイトに公開しています。注文、デポジット（ある場合）、受取後レビューは本サイトの顧客アカウントに紐づきます。',
        '購入者レビューを表示できます。低評価が続く商品は掲載終了することがあります。連絡先はお問い合わせ／事業者情報へ。事業者は法人情報を記入してください。',
        'ご注文前にポリシーとレビューを確認し、不明点はチャットでお尋ねください。',
      ],
      bullets: ['ポリシーと責任主体を公開', '配達完了注文のレビュー', '連絡先はお問い合わせ／事業者情報', '返品と産地は別ページ'],
    },
    ko: {
      title: '이 샵은 믿을 수 있나요?',
      paragraphs: [
        '온라인 쇼핑에서는 판매자가 실재하고 약속을 지키는지가 중요합니다. 이 페이지는 확인을 도울 뿐, 고객의 판단을 대신하지 않습니다.',
        '배송·교환반품·개인정보·약관·원산지·책임 주체를 이 웹사이트에 공개합니다. 주문, 보증금(있을 때), 수령 후 리뷰는 이 사이트 고객 계정에 연결됩니다.',
        '구매자 리뷰를 보여줄 수 있으며, 나쁜 평가가 계속되면 상품을 내릴 수 있습니다. 연락처는 문의/사업자 정보 페이지에 있습니다. 판매자는 법적 정보를 기입해야 합니다.',
        '주문 전에 정책과 리뷰를 읽고, 궁금하면 채팅으로 문의하세요.',
      ],
      bullets: ['정책과 책임 주체 공개', '배송 완료 주문 리뷰', '연락처는 문의/사업자 정보', '교환반품·원산지는 별도 페이지'],
    },
  },
  company: {
    vi: {
      title: 'Thông tin đơn vị sở hữu website',
      paragraphs: [
        'Trang này nêu đơn vị chịu trách nhiệm pháp lý đối với website shop. Chủ shop điền tên pháp lý (hộ kinh doanh / doanh nghiệp), mã đăng ký hoặc MST, địa chỉ trụ sở và thông tin liên hệ trên chính trang này.',
        'Khi chưa điền, khách vui lòng dùng trang Liên hệ (chat, form, số điện thoại / email shop đã cấu hình) và yêu cầu chủ shop bổ sung giấy tờ đăng ký trước khi cần xuất hóa đơn hoặc làm việc trực tiếp.',
        'Mọi giao dịch trên website do đơn vị ghi trên trang này chịu trách nhiệm trước khách hàng và pháp luật. Liên hệ trước khi đến làm việc (nếu shop có địa chỉ tiếp khách).',
      ],
      bullets: [
        'Tên pháp lý / mã đăng ký: chủ shop điền trên trang này',
        'Địa chỉ trụ sở: chủ shop điền trên trang này',
        'Điện thoại và email: trang Liên hệ hoặc ô này',
        'Nút Bộ Công Thương trên chân trang trỏ cổng thông báo website',
      ],
    },
    en: {
      title: 'Company / business information',
      paragraphs: [
        'This page names the legal entity responsible for the shop website. The merchant fills in the legal name (household business or company), registration or tax code, registered address, and contact details on this page.',
        'If those fields are still empty, use the Contact page (chat, form, configured phone / email) and ask the merchant to add registration details before invoicing or an in-person visit.',
        'Transactions on this website are the responsibility of the entity listed here. Please contact the shop before visiting (if they receive guests).',
      ],
      bullets: [
        'Legal name / registration code: merchant fills in on this page',
        'Registered address: merchant fills in on this page',
        'Phone and email: Contact page or this page',
        'The footer MoIT button links to the public website-notice portal',
      ],
    },
    zh: {
      title: '网站开办单位信息',
      paragraphs: [
        '本页列明对本店网站负责的法律主体。商家应在本页填写法定名称（个体户/企业）、登记或税号、注册地址与联系方式。',
        '若尚未填写，请使用联系页（聊天、表单、已配置的电话/邮箱），并请商家在开票或上门前补全登记信息。',
        '本站交易由本页所列主体对顾客与法律负责。如需上门，请先联系店铺。',
      ],
      bullets: ['法定名称/登记号：商家在本页填写', '注册地址：商家在本页填写', '电话与邮箱：联系页或本页', '页脚工贸部按钮指向网站公示入口'],
    },
    ja: {
      title: 'ウェブサイト運営者情報',
      paragraphs: [
        'このページはショップサイトの責任主体を示します。事業者は本ページに、正式名称（個人事業／法人）、登録番号または税号、所在地、連絡先を記入してください。',
        '未記入の場合はお問い合わせページ（チャット、フォーム、設定済みの電話／メール）をご利用ください。請求書や来訪の前に登録情報の追記を依頼してください。',
        '本サイト上の取引はここに記載の主体がお客様と法令に対して責任を負います。来訪前にご連絡ください。',
      ],
      bullets: ['正式名称／登録番号：事業者が本ページに記入', '所在地：事業者が本ページに記入', '電話・メール：お問い合わせまたは本ページ', 'フッターの商工省ボタンは届出ポータルへ'],
    },
    ko: {
      title: '웹사이트 사업자 정보',
      paragraphs: [
        '이 페이지는 샵 웹사이트의 법적 책임 주체를 밝힙니다. 판매자는 이 페이지에 상호(개인사업/법인), 등록번호 또는 세금번호, 소재지, 연락처를 기입해야 합니다.',
        '아직 비어 있으면 문의 페이지(채팅, 폼, 설정된 전화/이메일)를 이용하고, 세금계산서나 방문 전에 등록 정보를 채워 달라고 요청하세요.',
        '이 웹사이트의 거래는 이 페이지에 적힌 주체가 고객과 법령에 대해 책임집니다. 방문 전에 연락해 주세요.',
      ],
      bullets: ['상호/등록번호: 판매자가 이 페이지에 기입', '소재지: 판매자가 이 페이지에 기입', '전화·이메일: 문의 페이지 또는 여기', '푸터 산업통상부 버튼은 웹사이트 신고 포털로 연결'],
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
        'Chọn nhóm hàng có size: giày nam/nữ, quần áo nam/nữ, đồ lót (boxer cỡ VN, bra), trang phục bầu, thời trang trẻ em (kèm giày trẻ), thể thao. Nhóm con như cao gót / giày cưới có bảng riêng. Túi xách / phụ kiện không size không hiện bảng này.',
        'Trên từng sản phẩm có size, bấm «Hướng dẫn chọn size» để xem đúng bảng của loại hàng đó.',
      ],
    },
    en: {
      title: 'Size guide',
      paragraphs: [
        'Guides are for products with sizes: men’s/women’s shoes, apparel, underwear (VN boxer sizes, bras), maternity, kids (including kids’ shoes), and sports. Sub-groups like heels and wedding shoes have their own charts. Bags and accessories without sizes do not show this guide.',
        'On a product with sizes, tap Size guide for that group’s chart.',
      ],
    },
    zh: {
      title: '尺码指南',
      paragraphs: [
        '适用于有尺码的商品：男鞋/女鞋、服装、内衣（越南码平角裤、文胸）、孕产、童装（含童鞋）、运动。高跟鞋/婚宴鞋等子品类有独立对照表。无尺码的箱包配饰不显示。',
        '商品页如有尺码，点击尺码指南即可查看该品类表格。',
      ],
    },
    ja: {
      title: 'サイズガイド',
      paragraphs: [
        'サイズがある商品：メンズ/レディース靴、衣料、アンダーウェア（ベトナムサイズのボクサー、ブラ）、マタニティ、キッズ（キッズシューズ含む）、スポーツ。ヒールやウェディング靴などのサブグループは専用表です。サイズのないバッグ等は出ません。',
        'サイズのある商品ページではサイズガイドを開くとそのグループの表が表示されます。',
      ],
    },
    ko: {
      title: '사이즈 가이드',
      paragraphs: [
        '사이즈가 있는 상품: 남성/여성 신발, 의류, 속옷(베트남 사이즈 드로즈, 브라), 임부, 아동(아동 신발 포함), 스포츠. 힐·웨딩슈즈 등 하위 그룹은 별도 표. 사이즈 없는 가방/액세서리는 표시하지 않습니다.',
        '사이즈가 있는 상품에서 사이즈 가이드를 누르면 해당 그룹 표가 나옵니다.',
      ],
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
  'how-to-buy',
  'brand-origin',
  'reviews-policy',
  'trust',
  'company',
  'thank-you',
  'stores',
  'lookbook',
  'size-guide',
  'blog',
  'goi-y-tuoi-gioi',
]
