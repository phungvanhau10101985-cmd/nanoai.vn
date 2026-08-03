import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'

export type ShopTemplatePresetId = 'commerce-blue' | 'fashion-orange' | 'hospitality-stay'

export function isShopTemplatePresetId(id: string | null | undefined): id is ShopTemplatePresetId {
  return id === 'commerce-blue' || id === 'fashion-orange' || id === 'hospitality-stay'
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
      fontFamily: '"Outfit", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
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
      fontFamily: '"Outfit", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
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
      fontFamily: '"Outfit", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    },
    flags: HOSPITALITY_FLAGS,
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
  return 'commerce-blue'
}
