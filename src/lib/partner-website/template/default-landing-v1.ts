import type { WebLocale } from '@/lib/i18n/config'
import {
  DEFAULT_PARTNER_WEBSITE_THEME,
  type PartnerWebsitePage,
  type PartnerWebsiteTemplateSite,
  type PartnerWebsiteTheme,
} from '@/lib/partner-website/template/partner-website-template-types'
import { defaultPropsForSection } from '@/lib/partner-website/template/section-registry'
import { getShopTemplateSampleProducts } from '@/lib/partner-website/template/shop-template-sample-products'

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

const UI: Record<
  WebLocale,
  {
    heroTitle: string
    heroSubtitle: string
    cta: string
    trust: { value: string; label: string }[]
    productsTitle: string
    productsSubtitle: string
    productCta: string
    recentlyViewedTitle: string
    recentlyViewedSubtitle: string
    favoritesTitle: string
    favoritesSubtitle: string
    recommendedTitle: string
    recommendedSubtitle: string
    featuresTitle: string
    features: { title: string; description: string }[]
    testimonialsTitle: string
    testimonials: { name: string; quote: string; role: string }[]
    pricingTitle: string
    pricing: { name: string; price: string; features: string[]; highlighted: boolean }[]
    faqTitle: string
    faq: { q: string; a: string }[]
    leadTitle: string
    leadSubtitle: string
    leadSubmit: string
    leadName: string
    leadPhone: string
    leadEmail: string
    leadMessage: string
    leadSuccess: string
    chatTitle: string
    chatSubtitle: string
    chatButton: string
    footerNote: string
  }
> = {
  vi: {
    heroTitle: 'BỘ SƯU TẬP MỚI',
    heroSubtitle: 'Khám phá xu hướng mới nhất',
    cta: 'MUA NGAY',
    trust: [
      { value: '1000+', label: 'Khách hàng' },
      { value: '24/7', label: 'Tư vấn chat' },
      { value: 'Toàn quốc', label: 'Giao hàng' },
    ],
    productsTitle: 'Hàng mới về',
    productsSubtitle: '',
    productCta: 'Thêm vào giỏ',
    recentlyViewedTitle: 'Bạn vừa xem',
    recentlyViewedSubtitle: 'Tiếp tục khám phá sản phẩm bạn quan tâm',
    favoritesTitle: 'Sản phẩm yêu thích',
    favoritesSubtitle: 'Danh sách bạn đã lưu — xem lại bất cứ lúc nào',
    recommendedTitle: 'Gợi ý cho bạn',
    recommendedSubtitle: 'Dựa trên giỏ hàng và lịch sử xem của bạn',
    featuresTitle: 'Vì sao chọn chúng tôi',
    features: [
      { title: 'Chính hãng', description: 'Cam kết chất lượng từng sản phẩm' },
      { title: 'Tư vấn nhanh', description: 'Chat trực tiếp — hỏi size, giá, ship' },
      { title: 'Đổi trả', description: 'Hỗ trợ theo chính sách shop' },
    ],
    testimonialsTitle: 'Khách hàng nói gì',
    testimonials: [
      { name: 'Chị Lan', quote: 'Tư vấn nhiệt tình, giao nhanh!', role: 'Khách mua online' },
      { name: 'Anh Minh', quote: 'Hàng đúng mô tả, sẽ ủng hộ tiếp.', role: 'Khách quen' },
    ],
    pricingTitle: 'Dịch vụ',
    pricing: [
      { name: 'Tư vấn', price: 'Miễn phí qua chat', features: ['Hỏi size', 'Báo giá', 'Tình trạng hàng'], highlighted: false },
      { name: 'Mua sỉ', price: 'Liên hệ', features: ['Giá sỉ', 'Giao bulk', 'Hỗ trợ riêng'], highlighted: true },
    ],
    faqTitle: 'Câu hỏi thường gặp',
    faq: [
      { q: 'Mua hàng thế nào?', a: 'Bấm Chat mua hàng hoặc điền form — shop phản hồi qua tin nhắn.' },
      { q: 'Giao hàng bao lâu?', a: 'Tùy khu vực — shop báo cụ thể khi bạn chat.' },
      { q: 'Đổi trả?', a: 'Theo chính sách shop — hỏi trực tiếp qua chat.' },
    ],
    leadTitle: 'Liên hệ',
    leadSubtitle: 'Để lại thông tin — shop sẽ gọi hoặc nhắn lại sớm.',
    leadSubmit: 'Gửi',
    leadName: 'Họ tên',
    leadPhone: 'Số điện thoại',
    leadEmail: 'Email',
    leadMessage: 'Nội dung',
    leadSuccess: 'Cảm ơn! Shop sẽ liên hệ sớm.',
    chatTitle: 'Sẵn sàng mua hàng?',
    chatSubtitle: 'Nhắn tin để hỏi size, giá và giao hàng.',
    chatButton: 'Chat mua hàng',
    footerNote: 'Website shop — tạo trên NanoAI',
  },
  en: {
    heroTitle: 'SUMMER ELEGANCE COLLECTION',
    heroSubtitle: 'Shop the latest trends.',
    cta: 'EXPLORE NOW',
    trust: [
      { value: '1000+', label: 'Customers' },
      { value: '24/7', label: 'Chat support' },
      { value: 'Nationwide', label: 'Delivery' },
    ],
    productsTitle: 'NEW ARRIVALS',
    productsSubtitle: '',
    productCta: 'ADD TO CART',
    recentlyViewedTitle: 'Recently viewed',
    recentlyViewedSubtitle: 'Continue exploring items you viewed',
    favoritesTitle: 'Your favorites',
    favoritesSubtitle: 'Products you saved — revisit anytime',
    recommendedTitle: 'Recommended for you',
    recommendedSubtitle: 'Based on your cart and browsing',
    featuresTitle: 'Why choose us',
    features: [
      { title: 'Authentic', description: 'Quality guaranteed' },
      { title: 'Fast advice', description: 'Chat for size, price, shipping' },
      { title: 'Returns', description: 'Per shop policy' },
    ],
    testimonialsTitle: 'What customers say',
    testimonials: [
      { name: 'Sarah', quote: 'Great service!', role: 'Customer' },
      { name: 'James', quote: 'Exactly as described.', role: 'Repeat buyer' },
    ],
    pricingTitle: 'Services',
    pricing: [
      { name: 'Consult', price: 'Free via chat', features: ['Sizing', 'Quotes', 'Stock check'], highlighted: false },
      { name: 'Wholesale', price: 'Contact us', features: ['Bulk pricing', 'Priority'], highlighted: true },
    ],
    faqTitle: 'FAQ',
    faq: [
      { q: 'How to order?', a: 'Click Chat or submit the contact form.' },
      { q: 'Delivery time?', a: 'Ask us in chat for your area.' },
    ],
    leadTitle: 'Contact us',
    leadSubtitle: 'We will reply by chat or phone.',
    leadSubmit: 'Send',
    leadName: 'Name',
    leadPhone: 'Phone',
    leadEmail: 'Email',
    leadMessage: 'Message',
    leadSuccess: 'Thank you! We will contact you soon.',
    chatTitle: 'Ready to order?',
    chatSubtitle: 'Message us for size, price, and delivery.',
    chatButton: 'Chat to order',
    footerNote: 'Shop website — Built with NanoAI',
  },
  zh: {
    heroTitle: '全新系列',
    heroSubtitle: '探索最新潮流',
    cta: '立即购买',
    trust: [
      { value: '1000+', label: '客户' },
      { value: '24/7', label: '聊天支持' },
      { value: '全国', label: '配送' },
    ],
    productsTitle: '新品上市',
    productsSubtitle: '',
    productCta: '加入购物车',
    recentlyViewedTitle: '最近浏览',
    recentlyViewedSubtitle: '继续查看您感兴趣的商品',
    favoritesTitle: '收藏的商品',
    favoritesSubtitle: '您保存的商品 — 随时查看',
    recommendedTitle: '为你推荐',
    recommendedSubtitle: '基于购物车和浏览记录',
    featuresTitle: '为什么选择我们',
    features: [
      { title: '正品', description: '品质保证' },
      { title: '快速咨询', description: '聊天问尺码价格' },
      { title: '退换', description: '按店铺政策' },
    ],
    testimonialsTitle: '客户评价',
    testimonials: [
      { name: 'Lily', quote: '服务很好！', role: '客户' },
      { name: 'Tom', quote: '与描述一致。', role: '回头客' },
    ],
    pricingTitle: '服务',
    pricing: [
      { name: '咨询', price: '聊天免费', features: ['尺码', '报价'], highlighted: false },
      { name: '批发', price: '联系我们', features: ['批量价'], highlighted: true },
    ],
    faqTitle: '常见问题',
    faq: [
      { q: '如何下单？', a: '点击聊天或填写表单。' },
      { q: '配送多久？', a: '请在聊天中咨询。' },
    ],
    leadTitle: '联系我们',
    leadSubtitle: '我们会尽快回复。',
    leadSubmit: '发送',
    leadName: '姓名',
    leadPhone: '电话',
    leadEmail: '邮箱',
    leadMessage: '留言',
    leadSuccess: '谢谢！我们会尽快联系您。',
    chatTitle: '准备下单？',
    chatSubtitle: '私信咨询尺码、价格与配送。',
    chatButton: '聊天购买',
    footerNote: 'NanoAI 店铺网站',
  },
  ja: {
    heroTitle: '新作コレクション',
    heroSubtitle: '最新トレンドをチェック',
    cta: '今すぐ購入',
    trust: [
      { value: '1000+', label: 'お客様' },
      { value: '24/7', label: 'チャット' },
      { value: '全国', label: '配送' },
    ],
    productsTitle: '新着商品',
    productsSubtitle: '',
    productCta: 'カートに追加',
    recentlyViewedTitle: '最近見た商品',
    recentlyViewedSubtitle: '閲覧した商品を続けて見る',
    favoritesTitle: 'お気に入り',
    favoritesSubtitle: '保存した商品 — いつでも再訪',
    recommendedTitle: 'あなたへのおすすめ',
    recommendedSubtitle: 'カートと閲覧履歴に基づく',
    featuresTitle: '選ばれる理由',
    features: [
      { title: '正規品', description: '品質保証' },
      { title: '迅速相談', description: 'サイズ・価格はチャットで' },
      { title: '返品', description: '店舗ポリシーに準拠' },
    ],
    testimonialsTitle: 'お客様の声',
    testimonials: [
      { name: 'Yuki', quote: '対応が早い！', role: 'お客様' },
      { name: 'Ken', quote: '説明通りでした。', role: 'リピーター' },
    ],
    pricingTitle: 'サービス',
    pricing: [
      { name: '相談', price: 'チャット無料', features: ['サイズ', '見積'], highlighted: false },
      { name: '卸', price: 'お問い合わせ', features: ['大口価格'], highlighted: true },
    ],
    faqTitle: 'FAQ',
    faq: [
      { q: '注文方法は？', a: 'チャットまたはフォームから。' },
      { q: '配送期間は？', a: 'チャットでご確認ください。' },
    ],
    leadTitle: 'お問い合わせ',
    leadSubtitle: '折り返しご連絡します。',
    leadSubmit: '送信',
    leadName: 'お名前',
    leadPhone: '電話',
    leadEmail: 'メール',
    leadMessage: 'メッセージ',
    leadSuccess: 'ありがとうございます。',
    chatTitle: 'ご購入の準備は？',
    chatSubtitle: 'チャットでサイズ・価格・配送を。',
    chatButton: 'チャットで購入',
    footerNote: 'NanoAI ショップサイト',
  },
  ko: {
    heroTitle: '신규 컬렉션',
    heroSubtitle: '최신 트렌드를 만나보세요',
    cta: '지금 구매',
    trust: [
      { value: '1000+', label: '고객' },
      { value: '24/7', label: '채팅 지원' },
      { value: '전국', label: '배송' },
    ],
    productsTitle: '신상품',
    productsSubtitle: '',
    productCta: '장바구니 담기',
    recentlyViewedTitle: '최근 본 상품',
    recentlyViewedSubtitle: '관심 상품을 계속 둘러보세요',
    favoritesTitle: '찜한 상품',
    favoritesSubtitle: '저장한 상품 — 언제든 다시 보기',
    recommendedTitle: '맞춤 추천',
    recommendedSubtitle: '장바구니와 열람 기록 기반',
    featuresTitle: '왜 우리인가',
    features: [
      { title: '정품', description: '품질 보장' },
      { title: '빠른 상담', description: '채팅으로 사이즈·가격' },
      { title: '교환', description: '샵 정책에 따름' },
    ],
    testimonialsTitle: '고객 후기',
    testimonials: [
      { name: 'Kim', quote: '친절해요!', role: '고객' },
      { name: 'Park', quote: '설명과 같아요.', role: '단골' },
    ],
    pricingTitle: '서비스',
    pricing: [
      { name: '상담', price: '채팅 무료', features: ['사이즈', '견적'], highlighted: false },
      { name: '도매', price: '문의', features: ['대량가'], highlighted: true },
    ],
    faqTitle: 'FAQ',
    faq: [
      { q: '주문 방법?', a: '채팅 또는 문의 폼을 이용하세요.' },
      { q: '배송 기간?', a: '채팅으로 문의하세요.' },
    ],
    leadTitle: '문의하기',
    leadSubtitle: '빠르게 답변드리겠습니다.',
    leadSubmit: '보내기',
    leadName: '이름',
    leadPhone: '전화',
    leadEmail: '이메일',
    leadMessage: '메시지',
    leadSuccess: '감사합니다! 곧 연락드립니다.',
    chatTitle: '구매 준비되셨나요?',
    chatSubtitle: '채팅으로 사이즈, 가격, 배송 문의.',
    chatButton: '채팅 구매',
    footerNote: 'NanoAI 샵 웹사이트',
  },
}

export function buildDefaultLandingV1Site(input: {
  locale: WebLocale
  title: string
  briefText?: string
  logoUrl?: string | null
  theme?: Partial<PartnerWebsiteTheme>
}): PartnerWebsiteTemplateSite {
  const t = UI[input.locale] ?? UI.en
  const briefLine = input.briefText?.split(/\n+/).filter(Boolean)[0]?.slice(0, 120)
  const brand = input.title.trim() || t.heroTitle
  const theme: PartnerWebsiteTheme = {
    ...DEFAULT_PARTNER_WEBSITE_THEME,
    ...input.theme,
    logoUrl: input.logoUrl ?? input.theme?.logoUrl ?? null,
  }

  const locale = input.locale
  const catTitle =
    locale === 'vi'
      ? 'Danh mục nổi bật'
      : locale === 'zh'
        ? '精选分类'
        : locale === 'ja'
          ? '注目カテゴリ'
          : locale === 'ko'
            ? '추천 카테고리'
            : 'FEATURED CATEGORIES'
  const bestTitle =
    locale === 'vi'
      ? 'Sản phẩm bán chạy'
      : locale === 'zh'
        ? '畅销商品'
        : locale === 'ja'
          ? 'ベストセラー'
          : locale === 'ko'
            ? '베스트셀러'
            : 'BEST SELLERS'
  const categoryItems = defaultFashionCategories(locale)
  const sampleProducts = getShopTemplateSampleProducts(locale)

  const pages: PartnerWebsitePage[] = [
    {
      slug: '/',
      title: brand,
      sections: [
        {
          id: uid('hero'),
          type: 'hero-v1',
          props: {
            ...defaultPropsForSection('hero-v1'),
            title: t.heroTitle,
            subtitle: briefLine || t.heroSubtitle,
            ctaText: t.cta,
            backgroundImage:
              'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1600&q=80',
          },
        },
        {
          id: uid('cats'),
          type: 'categories-v1',
          props: { title: catTitle, items: categoryItems },
        },
        {
          id: uid('new'),
          type: 'products-v1',
          props: {
            ...defaultPropsForSection('products-v1'),
            title: t.productsTitle,
            subtitle: t.productsSubtitle,
            useInventory: true,
            limit: 8,
            productCtaText: t.productCta,
            variant: 'new-arrivals',
            showNewBadge: true,
            products: sampleProducts.slice(0, 4),
          },
        },
        {
          id: uid('best'),
          type: 'products-v1',
          props: {
            ...defaultPropsForSection('products-v1'),
            title: bestTitle,
            subtitle: '',
            useInventory: true,
            limit: 8,
            productCtaText: t.productCta,
            variant: 'best-sellers',
            showNewBadge: false,
            products: sampleProducts.slice(4, 8),
          },
        },
        ...buildLandingV1PersonalizationSections(input.locale, t.productCta),
        {
          id: uid('faq'),
          type: 'faq-v1',
          props: { title: t.faqTitle, items: t.faq },
        },
        {
          id: uid('lead'),
          type: 'lead-form-v1',
          props: {
            title: t.leadTitle,
            subtitle: t.leadSubtitle,
            submitText: t.leadSubmit,
            nameLabel: t.leadName,
            phoneLabel: t.leadPhone,
            emailLabel: t.leadEmail,
            messageLabel: t.leadMessage,
            successMessage: t.leadSuccess,
          },
        },
        {
          id: uid('chat'),
          type: 'chat-cta-v1',
          props: {
            title: t.chatTitle,
            subtitle: t.chatSubtitle,
            buttonText: t.chatButton,
          },
        },
        {
          id: uid('foot'),
          type: 'footer-v1',
          props: {
            brandName: brand,
            note: t.footerNote,
            aboutText:
              locale === 'vi'
                ? 'Shop thời trang — chất lượng, giao nhanh, tư vấn tận tâm.'
                : 'Fashion shop — quality pieces, fast delivery, friendly support.',
          },
        },
      ],
    },
  ]

  return { templateId: 'fashion-orange', theme, pages }
}

function defaultFashionCategories(locale: WebLocale): Array<{
  name: string
  imageUrl: string
  href?: string
}> {
  const names =
    locale === 'vi'
      ? ['Thời trang', 'Túi xách', 'Giày dép', 'Phụ kiện']
      : locale === 'zh'
        ? ['服装', '箱包', '鞋履', '配饰']
        : locale === 'ja'
          ? ['ファッション', 'バッグ', 'シューズ', 'アクセサリー']
          : locale === 'ko'
            ? ['패션', '가방', '신발', '액세서리']
            : ['Clothing', 'Handbags', 'Shoes', 'Accessories']
  const images = [
    'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=600&q=80',
  ]
  return names.map((name, i) => ({
    name,
    imageUrl: images[i]!,
  }))
}

export function getLandingV1SectionCopy(locale: WebLocale) {
  return UI[locale] ?? UI.en
}

export function buildLandingV1PersonalizationSections(
  locale: WebLocale,
  productCta: string
): PartnerWebsitePage['sections'] {
  const t = getLandingV1SectionCopy(locale)
  return [
    {
      id: uid('recent'),
      type: 'recently-viewed-v1',
      props: {
        ...defaultPropsForSection('recently-viewed-v1'),
        title: t.recentlyViewedTitle,
        subtitle: t.recentlyViewedSubtitle,
        limit: 8,
        productCtaText: productCta,
      },
    },
    {
      id: uid('fav'),
      type: 'favorites-v1',
      props: {
        ...defaultPropsForSection('favorites-v1'),
        title: t.favoritesTitle,
        subtitle: t.favoritesSubtitle,
        limit: 8,
        productCtaText: productCta,
      },
    },
    {
      id: uid('rec'),
      type: 'recommended-for-you-v1',
      props: {
        ...defaultPropsForSection('recommended-for-you-v1'),
        title: t.recommendedTitle,
        subtitle: t.recommendedSubtitle,
        limit: 8,
        productCtaText: productCta,
      },
    },
  ]
}

export function normalizeTemplatePages(raw: unknown): PartnerWebsitePage[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((p): p is PartnerWebsitePage => Boolean(p) && typeof p === 'object')
    .map((p) => ({
      slug: typeof p.slug === 'string' ? p.slug : '/',
      title: typeof p.title === 'string' ? p.title : 'Page',
      sections: Array.isArray(p.sections)
        ? p.sections
            .filter((s): s is PartnerWebsitePage['sections'][0] => Boolean(s) && typeof s === 'object')
            .map((s) => ({
              id: String(s.id ?? uid('sec')),
              type: String(s.type ?? 'hero-v1'),
              props: typeof s.props === 'object' && s.props ? (s.props as Record<string, unknown>) : {},
            }))
        : [],
    }))
}

export function normalizeTemplateTheme(raw: unknown, logoUrl?: string | null): PartnerWebsiteTheme {
  const base = { ...DEFAULT_PARTNER_WEBSITE_THEME, logoUrl: logoUrl ?? null }
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  return {
    primaryColor: typeof o.primaryColor === 'string' ? o.primaryColor : base.primaryColor,
    accentColor: typeof o.accentColor === 'string' ? o.accentColor : base.accentColor,
    backgroundColor: typeof o.backgroundColor === 'string' ? o.backgroundColor : base.backgroundColor,
    textColor: typeof o.textColor === 'string' ? o.textColor : base.textColor,
    mutedColor: typeof o.mutedColor === 'string' ? o.mutedColor : base.mutedColor,
    fontFamily: typeof o.fontFamily === 'string' ? o.fontFamily : base.fontFamily,
    logoUrl: typeof o.logoUrl === 'string' ? o.logoUrl : logoUrl ?? base.logoUrl ?? null,
    ...(o.useVisualHtml === true ? { useVisualHtml: true } : {}),
  }
}
