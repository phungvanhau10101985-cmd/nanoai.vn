/**
 * Platform-owned section registry — logic lives in repo; tenants only configure props via JSON.
 * NanoAI admin can enable/disable section types via partner_website_platform_settings.
 */

export type SectionRegistryEntry = {
  type: string
  label: Record<string, string>
  description: Record<string, string>
  editableFields: string[]
  defaultProps: Record<string, unknown>
  platformLocked: boolean
}

export const PARTNER_WEBSITE_TEMPLATE_DEFINITIONS: Record<
  string,
  { label: Record<string, string>; description: Record<string, string> }
> = {
  'landing-v1': {
    label: {
      vi: 'Landing shop v1',
      en: 'Shop landing v1',
      zh: '店铺落地页 v1',
      ja: 'ショップ LP v1',
      ko: '샵 랜딩 v1',
    },
    description: {
      vi: 'Landing shop đầy đủ: hero, sản phẩm, FAQ, form liên hệ, chat — backend do platform.',
      en: 'Full shop landing: hero, products, FAQ, contact form, chat — platform backend.',
      zh: '完整店铺落地页：Hero、产品、FAQ、联系表单、聊天。',
      ja: 'フルショップLP：Hero、商品、FAQ、フォーム、チャット。',
      ko: '풀 샵 랜딩: Hero, 상품, FAQ, 문의 폼, 채팅.',
    },
  },
}

export const PARTNER_WEBSITE_SECTION_REGISTRY: SectionRegistryEntry[] = [
  {
    type: 'hero-v1',
    label: { vi: 'Hero', en: 'Hero', zh: 'Hero', ja: 'Hero', ko: 'Hero' },
    description: {
      vi: 'Tiêu đề lớn, mô tả, nút CTA',
      en: 'Headline, subtitle, CTA button',
      zh: '标题、副标题、CTA',
      ja: '見出し・サブタイトル・CTA',
      ko: '헤드라인, 부제, CTA',
    },
    editableFields: ['title', 'subtitle', 'ctaText', 'backgroundImage', 'utmVariants'],
    defaultProps: {
      title: 'Welcome',
      subtitle: 'Your shop landing page',
      ctaText: 'Get started',
      utmVariants: [],
    },
    platformLocked: false,
  },
  {
    type: 'features-v1',
    label: { vi: 'Tính năng', en: 'Features', zh: '功能', ja: '機能', ko: '기능' },
    description: {
      vi: 'Lưới tính năng / lợi ích',
      en: 'Feature / benefit grid',
      zh: '功能网格',
      ja: '機能グリッド',
      ko: '기능 그리드',
    },
    editableFields: ['title', 'items'],
    defaultProps: {
      title: 'Features',
      items: [
        { title: 'Fast', description: 'Quick setup' },
        { title: 'Trusted', description: 'Secure platform' },
        { title: 'Support', description: 'Always here to help' },
      ],
    },
    platformLocked: false,
  },
  {
    type: 'faq-v1',
    label: { vi: 'FAQ', en: 'FAQ', zh: 'FAQ', ja: 'FAQ', ko: 'FAQ' },
    description: {
      vi: 'Câu hỏi thường gặp',
      en: 'Frequently asked questions',
      zh: '常见问题',
      ja: 'よくある質問',
      ko: '자주 묻는 질문',
    },
    editableFields: ['title', 'items'],
    defaultProps: {
      title: 'FAQ',
      items: [
        { q: 'How to order?', a: 'Click chat to message us.' },
        { q: 'Delivery?', a: 'We ship nationwide.' },
      ],
    },
    platformLocked: false,
  },
  {
    type: 'chat-cta-v1',
    label: { vi: 'Nút chat', en: 'Chat CTA', zh: '聊天按钮', ja: 'チャットCTA', ko: '채팅 CTA' },
    description: {
      vi: 'Kêu gọi chat mua hàng — URL chat do platform gắn, khách không sửa backend',
      en: 'Shop chat call-to-action — chat URL injected by platform',
      zh: '购物聊天号召 — 聊天链接由平台注入',
      ja: '購入チャットCTA — URLはプラットフォーム注入',
      ko: '채팅 CTA — 채팅 URL은 플랫폼이 주입',
    },
    editableFields: ['title', 'subtitle', 'buttonText'],
    defaultProps: {
      title: 'Ready to buy?',
      subtitle: 'Message us for sizes, price, and delivery.',
      buttonText: 'Chat to order',
    },
    platformLocked: true,
  },
  {
    type: 'trust-bar-v1',
    label: { vi: 'Uy tín', en: 'Trust bar', zh: '信任条', ja: '信頼バー', ko: '신뢰 바' },
    description: {
      vi: 'Số liệu / cam kết ngắn',
      en: 'Short stats / trust badges',
      zh: '数据/信任标识',
      ja: '実績・信頼バッジ',
      ko: '실적/신뢰 배지',
    },
    editableFields: ['items'],
    defaultProps: {
      items: [
        { value: '1000+', label: 'Customers' },
        { value: '24/7', label: 'Support' },
        { value: 'Fast', label: 'Delivery' },
      ],
    },
    platformLocked: false,
  },
  {
    type: 'products-v1',
    label: { vi: 'Sản phẩm', en: 'Products', zh: '产品', ja: '商品', ko: '상품' },
    description: {
      vi: 'Lưới sản phẩm — có thể đồng bộ kho hoặc nhập tay',
      en: 'Product grid — sync inventory or manual items',
      zh: '产品网格 — 同步库存或手动',
      ja: '商品グリッド — 在庫同期または手入力',
      ko: '상품 그리드 — 재고 동기화 또는 수동',
    },
    editableFields: ['title', 'subtitle', 'useInventory', 'limit', 'productCtaText', 'products'],
    defaultProps: {
      title: 'Products',
      subtitle: 'Best sellers',
      useInventory: true,
      limit: 8,
      productCtaText: 'View details',
      products: [
        {
          name: 'Sample product',
          price: '199.000đ',
          description: 'High quality item',
          imageUrl: '',
          ctaText: 'Chat',
        },
      ],
    },
    platformLocked: false,
  },
  {
    type: 'recently-viewed-v1',
    label: {
      vi: 'Vừa xem',
      en: 'Recently viewed',
      zh: '最近浏览',
      ja: '最近見た商品',
      ko: '최근 본 상품',
    },
    description: {
      vi: 'Sản phẩm khách vừa xem — tự động theo phiên',
      en: 'Products the visitor recently viewed — session-aware',
      zh: '访客最近浏览的商品 — 按会话自动填充',
      ja: '閲覧履歴 — セッション連動',
      ko: '최근 본 상품 — 세션 기반',
    },
    editableFields: ['title', 'subtitle', 'limit', 'productCtaText'],
    defaultProps: {
      title: 'Recently viewed',
      subtitle: 'Based on your browsing',
      limit: 8,
      productCtaText: 'View details',
    },
    platformLocked: true,
  },
  {
    type: 'favorites-v1',
    label: {
      vi: 'Yêu thích',
      en: 'Favorites',
      zh: '收藏',
      ja: 'お気に入り',
      ko: '찜',
    },
    description: {
      vi: 'Sản phẩm khách đã lưu yêu thích — tự động theo phiên',
      en: 'Products the visitor favorited — session-aware',
      zh: '访客收藏的商品 — 按会话自动填充',
      ja: 'お気に入り商品 — セッション連動',
      ko: '찜한 상품 — 세션 기반',
    },
    editableFields: ['title', 'subtitle', 'limit', 'productCtaText'],
    defaultProps: {
      title: 'Your favorites',
      subtitle: 'Products you saved',
      limit: 8,
      productCtaText: 'View details',
    },
    platformLocked: true,
  },
  {
    type: 'recommended-for-you-v1',
    label: {
      vi: 'Gợi ý cho bạn',
      en: 'Recommended for you',
      zh: '为你推荐',
      ja: 'あなたへのおすすめ',
      ko: '맞춤 추천',
    },
    description: {
      vi: 'Gợi ý từ giỏ hàng & lịch sử xem — backend platform',
      en: 'Suggestions from cart & browse history — platform backend',
      zh: '基于购物车和浏览记录的推荐 — 平台后端',
      ja: 'カート・閲覧履歴からのおすすめ — プラットフォーム',
      ko: '장바구니·열람 기록 기반 추천 — 플랫폼',
    },
    editableFields: ['title', 'subtitle', 'limit', 'productCtaText'],
    defaultProps: {
      title: 'Recommended for you',
      subtitle: 'Picked based on what you like',
      limit: 8,
      productCtaText: 'View details',
    },
    platformLocked: true,
  },
  {
    type: 'testimonials-v1',
    label: { vi: 'Đánh giá', en: 'Testimonials', zh: '评价', ja: 'お客様の声', ko: '후기' },
    description: {
      vi: 'Khách hàng nói gì',
      en: 'Customer quotes',
      zh: '客户评价',
      ja: 'お客様の声',
      ko: '고객 후기',
    },
    editableFields: ['title', 'items'],
    defaultProps: {
      title: 'Testimonials',
      items: [
        { name: 'Lan', quote: 'Great service and fast delivery!', role: 'Customer' },
        { name: 'Minh', quote: 'Quality products, will buy again.', role: 'Customer' },
      ],
    },
    platformLocked: false,
  },
  {
    type: 'pricing-v1',
    label: { vi: 'Bảng giá', en: 'Pricing', zh: '价格', ja: '料金', ko: '요금' },
    description: {
      vi: 'Gói dịch vụ / bảng giá đơn giản',
      en: 'Simple pricing plans',
      zh: '简单价格方案',
      ja: 'シンプル料金プラン',
      ko: '간단 요금제',
    },
    editableFields: ['title', 'plans'],
    defaultProps: {
      title: 'Pricing',
      plans: [
        { name: 'Basic', price: 'Free chat', features: ['Consultation', 'Size advice'], highlighted: false },
        { name: 'Pro shop', price: 'Contact us', features: ['Bulk order', 'Priority support'], highlighted: true },
      ],
    },
    platformLocked: false,
  },
  {
    type: 'lead-form-v1',
    label: { vi: 'Form liên hệ', en: 'Contact form', zh: '联系表单', ja: 'お問い合わせ', ko: '문의 폼' },
    description: {
      vi: 'Form gửi lead — API lưu DB do platform, khách chỉ sửa label',
      en: 'Lead form — save API is platform-owned',
      zh: '线索表单 — 保存 API 由平台管理',
      ja: 'リードフォーム — 保存APIはプラットフォーム',
      ko: '리드 폼 — 저장 API는 플랫폼',
    },
    editableFields: ['title', 'subtitle', 'submitText', 'nameLabel', 'phoneLabel', 'emailLabel', 'messageLabel', 'successMessage'],
    defaultProps: {
      title: 'Contact us',
      subtitle: 'Leave your info — we will reply via chat or phone.',
      submitText: 'Send',
      nameLabel: 'Name',
      phoneLabel: 'Phone',
      emailLabel: 'Email',
      messageLabel: 'Message',
      successMessage: 'Thank you! We will contact you soon.',
    },
    platformLocked: true,
  },
  {
    type: 'gallery-v1',
    label: { vi: 'Gallery', en: 'Gallery', zh: '图库', ja: 'ギャラリー', ko: '갤러리' },
    description: {
      vi: 'Lưới ảnh sản phẩm',
      en: 'Product image grid',
      zh: '产品图片网格',
      ja: '商品画像グリッド',
      ko: '상품 이미지 그리드',
    },
    editableFields: ['title', 'images'],
    defaultProps: {
      title: 'Gallery',
      images: [],
    },
    platformLocked: false,
  },
  {
    type: 'footer-v1',
    label: { vi: 'Footer', en: 'Footer', zh: '页脚', ja: 'フッター', ko: '푸터' },
    description: {
      vi: 'Chân trang thương hiệu',
      en: 'Brand footer',
      zh: '品牌页脚',
      ja: 'ブランドフッター',
      ko: '브랜드 푸터',
    },
    editableFields: ['brandName', 'note'],
    defaultProps: {
      brandName: 'Shop',
      note: 'Powered by NanoAI',
    },
    platformLocked: false,
  },
]

export function getSectionRegistryEntry(type: string): SectionRegistryEntry | undefined {
  return PARTNER_WEBSITE_SECTION_REGISTRY.find((s) => s.type === type)
}

export function isSectionTypeEnabled(type: string, enabledTypes: string[]): boolean {
  return enabledTypes.includes(type)
}

export function defaultPropsForSection(type: string): Record<string, unknown> {
  return { ...(getSectionRegistryEntry(type)?.defaultProps ?? {}) }
}

export function allRegisteredSectionTypes(): string[] {
  return PARTNER_WEBSITE_SECTION_REGISTRY.map((s) => s.type)
}
