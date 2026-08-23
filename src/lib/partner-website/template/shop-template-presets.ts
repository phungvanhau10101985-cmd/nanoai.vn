import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'

export type ShopTemplatePresetId =
  | 'commerce-blue'
  | 'fashion-orange'
  | 'hospitality-stay'
  | 'food-warm'
  | 'commerce-minimal'
  | 'soft-neutral'
  | 'blank-white'

export function isShopTemplatePresetId(id: string | null | undefined): id is ShopTemplatePresetId {
  return (
    id === 'commerce-blue' ||
    id === 'fashion-orange' ||
    id === 'hospitality-stay' ||
    id === 'food-warm' ||
    id === 'commerce-minimal' ||
    id === 'soft-neutral' ||
    id === 'blank-white'
  )
}

export type ShopTemplatePresetFlags = {
  products: boolean
  personalize: boolean
  chat: boolean
  lead: boolean
  faq: boolean
  features: boolean
  testimonials: boolean
  pricing: boolean
  trust: boolean
  categories: boolean
}

export type ShopTemplatePreset = {
  id: ShopTemplatePresetId
  /** Stored as template_id for the chosen look (renders via landing-v1 sections). */
  templateId: string
  label: Record<WebLocale, string>
  description: Record<WebLocale, string>
  /** Swatch colors for picker card. */
  swatch: { primary: string; accent: string; background: string }
  /** Cover image for the template gallery card. */
  coverImageUrl: string
  /** Ready for merchants to apply (complete shop sample). */
  readyToUse: boolean
  theme: Partial<PartnerWebsiteTheme>
  flags: ShopTemplatePresetFlags
}

const COMMERCE_FULL_FLAGS: ShopTemplatePresetFlags = {
  products: true,
  personalize: true,
  chat: true,
  lead: true,
  faq: true,
  features: false,
  testimonials: false,
  pricing: false,
  trust: false,
  categories: true,
}

const BLANK_CANVAS_FLAGS: ShopTemplatePresetFlags = {
  products: true,
  personalize: true,
  chat: true,
  lead: false,
  faq: false,
  features: false,
  testimonials: false,
  pricing: false,
  trust: false,
  categories: false,
}

const HOSPITALITY_FLAGS: ShopTemplatePresetFlags = {
  products: false,
  personalize: false,
  chat: true,
  lead: true,
  faq: true,
  features: false,
  testimonials: false,
  pricing: false,
  trust: false,
  categories: false,
}

/** Platform presets — any industry can apply; capabilities filter sections at runtime. */
export const SHOP_TEMPLATE_PRESETS: ShopTemplatePreset[] = [
  {
    id: 'commerce-blue',
    templateId: 'commerce-blue',
    label: {
      vi: 'Shop đa ngành (xanh)',
      en: 'Universal commerce (blue)',
      zh: '通用商城（蓝）',
      ja: '汎用ショップ（ブルー）',
      ko: '범용 쇼핑몰 (블루)',
    },
    description: {
      vi: 'Giao diện mua sắm đa ngành: hero, danh mục, sản phẩm, giỏ, chat, form liên hệ.',
      en: 'Multi-industry shopping UI: hero, categories, products, cart, chat, lead form.',
      zh: '多行业购物界面：Hero、分类、产品、购物车、聊天、表单。',
      ja: '多業種向けショップUI：Hero・カテゴリ・商品・カート・チャット・フォーム。',
      ko: '다업종 쇼핑 UI: 히어로, 카테고리, 상품, 장바구니, 채팅, 문의 폼.',
    },
    swatch: { primary: '#2563eb', accent: '#1d4ed8', background: '#ffffff' },
    coverImageUrl:
      'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=80',
    readyToUse: true,
    theme: {
      primaryColor: '#2563eb',
      accentColor: '#1d4ed8',
      backgroundColor: '#ffffff',
      textColor: '#1e293b',
      mutedColor: '#64748b',
      fontFamily:
        '"Be Vietnam Pro", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    },
    flags: COMMERCE_FULL_FLAGS,
  },
  {
    id: 'fashion-orange',
    templateId: 'fashion-orange',
    label: {
      vi: 'Shop thời trang cam',
      en: 'Orange fashion shop',
      zh: '橙色时尚店',
      ja: 'オレンジファッション',
      ko: '오렌지 패션 샵',
    },
    description: {
      vi: 'Giao diện mua sắm full: hero, danh mục, hàng mới, bán chạy, giỏ, wishlist, chat.',
      en: 'Full shopping UI: hero, categories, new arrivals, best sellers, cart, wishlist, chat.',
      zh: '完整购物界面：Hero、分类、新品、畅销、购物车、收藏、聊天。',
      ja: 'フルショップUI：Hero・カテゴリ・新着・ベストセラー・カート・お気に入り・チャット。',
      ko: '풀 쇼핑 UI: 히어로, 카테고리, 신상품, 베스트셀러, 장바구니, 찜, 채팅.',
    },
    swatch: { primary: '#f97316', accent: '#ea580c', background: '#ffffff' },
    coverImageUrl:
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80',
    readyToUse: true,
    theme: {
      primaryColor: '#f97316',
      accentColor: '#ea580c',
      backgroundColor: '#ffffff',
      textColor: '#1f2937',
      mutedColor: '#6b7280',
      fontFamily:
        '"Be Vietnam Pro", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    },
    flags: COMMERCE_FULL_FLAGS,
  },
  {
    id: 'hospitality-stay',
    templateId: 'hospitality-stay',
    label: {
      vi: 'Khách sạn / lưu trú',
      en: 'Hotel / hospitality',
      zh: '酒店 / 住宿',
      ja: 'ホテル / 宿泊',
      ko: '호텔 / 숙박',
    },
    description: {
      vi: 'Landing đặt phòng: hero, FAQ, chat, form liên hệ — không giỏ hàng sản phẩm.',
      en: 'Booking landing: hero, FAQ, chat, contact form — no product cart.',
      zh: '预订落地页：Hero、FAQ、聊天、联系表单 — 无商品购物车。',
      ja: '予約ランディング：Hero・FAQ・チャット・問い合わせ — 商品カートなし。',
      ko: '예약 랜딩: 히어로, FAQ, 채팅, 문의 폼 — 상품 장바구니 없음.',
    },
    swatch: { primary: '#0f766e', accent: '#14b8a6', background: '#f0fdfa' },
    coverImageUrl:
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
    readyToUse: true,
    theme: {
      primaryColor: '#0f766e',
      accentColor: '#14b8a6',
      backgroundColor: '#f0fdfa',
      textColor: '#134e4a',
      mutedColor: '#5eead4',
      fontFamily:
        '"Be Vietnam Pro", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    },
    flags: HOSPITALITY_FLAGS,
  },
  {
    id: 'food-warm',
    templateId: 'food-warm',
    label: {
      vi: 'Quán ăn / F&B (ấm)',
      en: 'Food & beverage (warm)',
      zh: '餐饮（暖色）',
      ja: '飲食（ウォーム）',
      ko: '음식점 (웜톤)',
    },
    description: {
      vi: 'Tone ấm cho quán ăn/đồ uống: hero, danh mục món, sản phẩm, chat đặt món.',
      en: 'Warm tones for F&B: hero, menu categories, products, order chat.',
      zh: '餐饮暖色：Hero、菜单分类、产品、点餐聊天。',
      ja: '飲食向け暖色：Hero・カテゴリ・商品・注文チャット。',
      ko: 'F&B 웜톤: 히어로, 메뉴 카테고리, 상품, 주문 채팅.',
    },
    swatch: { primary: '#c2410c', accent: '#ea580c', background: '#fff7ed' },
    coverImageUrl:
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
    readyToUse: true,
    theme: {
      primaryColor: '#c2410c',
      accentColor: '#ea580c',
      backgroundColor: '#fff7ed',
      textColor: '#431407',
      mutedColor: '#9a3412',
      fontFamily:
        '"Be Vietnam Pro", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    },
    flags: COMMERCE_FULL_FLAGS,
  },
  {
    id: 'commerce-minimal',
    templateId: 'commerce-minimal',
    label: {
      vi: 'Shop tối giản',
      en: 'Minimal commerce',
      zh: '极简商城',
      ja: 'ミニマルショップ',
      ko: '미니멀 쇼핑몰',
    },
    description: {
      vi: 'Nền trắng, chữ đen, nhấn đen — tập trung sản phẩm và chuyển đổi.',
      en: 'White canvas, black accents — product-first conversion layout.',
      zh: '白底黑强调 — 以产品与转化为中心。',
      ja: '白基調・黒アクセント — 商品中心のCV向け。',
      ko: '화이트·블랙 액센트 — 상품 중심 전환 UI.',
    },
    swatch: { primary: '#111827', accent: '#374151', background: '#ffffff' },
    coverImageUrl:
      'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80',
    readyToUse: true,
    theme: {
      primaryColor: '#111827',
      accentColor: '#374151',
      backgroundColor: '#ffffff',
      textColor: '#111827',
      mutedColor: '#6b7280',
      fontFamily:
        '"Be Vietnam Pro", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    },
    flags: COMMERCE_FULL_FLAGS,
  },
  {
    id: 'soft-neutral',
    templateId: 'soft-neutral',
    label: {
      vi: 'Trung tính mềm',
      en: 'Soft neutral',
      zh: '柔和中性',
      ja: 'ソフトニュートラル',
      ko: '소프트 뉴트럴',
    },
    description: {
      vi: 'Tone be/xám nhẹ — phù hợp lifestyle, handmade, cửa hàng nhỏ.',
      en: 'Soft beige/gray — lifestyle, handmade, boutique shops.',
      zh: '柔和米色/灰 — 生活方式、手作、精品店。',
      ja: 'ベージュ／グレー — ライフスタイル・ハンドメイド向け。',
      ko: '베이지·그레이 — 라이프스타일·핸드메이드.',
    },
    swatch: { primary: '#78716c', accent: '#a8a29e', background: '#fafaf9' },
    coverImageUrl:
      'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80',
    readyToUse: true,
    theme: {
      primaryColor: '#78716c',
      accentColor: '#a8a29e',
      backgroundColor: '#fafaf9',
      textColor: '#292524',
      mutedColor: '#78716c',
      fontFamily:
        '"Be Vietnam Pro", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    },
    flags: COMMERCE_FULL_FLAGS,
  },
  {
    id: 'blank-white',
    templateId: 'blank-white',
    label: {
      vi: 'Canvas trắng',
      en: 'Blank white canvas',
      zh: '空白画布',
      ja: '白紙キャンバス',
      ko: '빈 흰 캔버스',
    },
    description: {
      vi: 'Trang trắng sạch — tạo web từ số 0 bằng Sửa nhanh (Thêm / sửa khối, nút, nền).',
      en: 'Empty white page — build from zero in Quick edit (Add / edit blocks, buttons, backgrounds).',
      zh: '空白白页 — 在快速编辑中从零搭建（添加/编辑区块、按钮、背景）。',
      ja: '真っ白なキャンバス — クイック編集でゼロから作成（追加・編集）。',
      ko: '흰 빈 페이지 — 빠른 수정에서 처음부터 만들기(추가/수정).',
    },
    swatch: { primary: '#111827', accent: '#374151', background: '#ffffff' },
    coverImageUrl:
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    readyToUse: true,
    theme: {
      primaryColor: '#111827',
      accentColor: '#374151',
      backgroundColor: '#ffffff',
      textColor: '#111827',
      mutedColor: '#6b7280',
      buyButtonColor: '#111827',
      cartButtonColor: '#6b7280',
      surfaceColor: '#f8fafc',
      borderColor: '#e5e7eb',
      fontFamily:
        '"Be Vietnam Pro", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    },
    flags: BLANK_CANVAS_FLAGS,
  },
]

export const DEFAULT_SHOP_TEMPLATE_PRESET_ID: ShopTemplatePresetId = 'commerce-blue'

export function getShopTemplatePreset(id: string | null | undefined): ShopTemplatePreset {
  const found = SHOP_TEMPLATE_PRESETS.find((p) => p.id === id)
  return found ?? SHOP_TEMPLATE_PRESETS[0]!
}

export function listShopTemplatePresets(): ShopTemplatePreset[] {
  return SHOP_TEMPLATE_PRESETS
}

export function shopTemplatePresetLabel(preset: ShopTemplatePreset, locale: WebLocale): string {
  return preset.label[locale] || preset.label.en
}

export function shopTemplatePresetDescription(preset: ShopTemplatePreset, locale: WebLocale): string {
  return preset.description[locale] || preset.description.en
}

export function suggestedShopTemplatePresetForIndustry(
  industryKey: 'fashion' | 'hotel' | 'food' | 'other' | null | undefined
): ShopTemplatePresetId {
  if (industryKey === 'hotel') return 'hospitality-stay'
  if (industryKey === 'fashion') return 'fashion-orange'
  if (industryKey === 'food') return 'food-warm'
  return 'commerce-blue'
}
