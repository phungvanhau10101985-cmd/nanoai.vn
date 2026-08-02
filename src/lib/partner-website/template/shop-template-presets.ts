import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'

export type ShopTemplatePresetId = 'fashion-orange'

export function isShopTemplatePresetId(id: string | null | undefined): id is ShopTemplatePresetId {
  return id === 'fashion-orange'
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

/** Single full-shop sample matching the orange fashion mockup (desktop + mobile). */
export const SHOP_TEMPLATE_PRESETS: ShopTemplatePreset[] = [
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
    flags: {
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
    },
  },
]

export const DEFAULT_SHOP_TEMPLATE_PRESET_ID: ShopTemplatePresetId = 'fashion-orange'

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
