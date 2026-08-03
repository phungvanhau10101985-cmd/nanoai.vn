import type { ShopTemplatePresetFlags } from '@/lib/partner-website/template/shop-template-presets'

export type PartnerIndustryKey = 'fashion' | 'hotel' | 'food' | 'other' | null

export type PartnerWebsiteCapabilityFlags = {
  enabled: boolean
  products: boolean
  cart: boolean
  personalize: boolean
  chat: boolean
  lead_form: boolean
  faq: boolean
  categories: boolean
  booking: boolean
}

export type PartnerCommerceCapabilityFlags = {
  cart: boolean
  order_tracking: boolean
}

export type PartnerCapabilities = {
  website: PartnerWebsiteCapabilityFlags
  commerce: PartnerCommerceCapabilityFlags
}

const WEBSITE_DEFAULTS: PartnerWebsiteCapabilityFlags = {
  enabled: true,
  products: true,
  cart: true,
  personalize: true,
  chat: true,
  lead_form: true,
  faq: true,
  categories: true,
  booking: false,
}

const COMMERCE_DEFAULTS: PartnerCommerceCapabilityFlags = {
  cart: true,
  order_tracking: true,
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback
}

function websiteDefaultsForIndustry(industryKey: PartnerIndustryKey): PartnerWebsiteCapabilityFlags {
  if (industryKey === 'hotel') {
    return {
      enabled: true,
      products: false,
      cart: false,
      personalize: false,
      chat: true,
      lead_form: true,
      faq: true,
      categories: false,
      booking: true,
    }
  }
  if (industryKey === 'food') {
    return {
      ...WEBSITE_DEFAULTS,
      categories: true,
    }
  }
  return { ...WEBSITE_DEFAULTS }
}

function commerceDefaultsForIndustry(industryKey: PartnerIndustryKey): PartnerCommerceCapabilityFlags {
  if (industryKey === 'hotel') {
    return { cart: false, order_tracking: false }
  }
  return { ...COMMERCE_DEFAULTS }
}

export function defaultPartnerCapabilities(industryKey: PartnerIndustryKey): PartnerCapabilities {
  return {
    website: websiteDefaultsForIndustry(industryKey),
    commerce: commerceDefaultsForIndustry(industryKey),
  }
}

export function normalizePartnerCapabilities(
  raw: unknown,
  industryKey: PartnerIndustryKey = null
): PartnerCapabilities {
  const defaults = defaultPartnerCapabilities(industryKey)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return defaults
  }
  const obj = raw as Record<string, unknown>
  const websiteRaw =
    obj.website && typeof obj.website === 'object' && !Array.isArray(obj.website)
      ? (obj.website as Record<string, unknown>)
      : {}
  const commerceRaw =
    obj.commerce && typeof obj.commerce === 'object' && !Array.isArray(obj.commerce)
      ? (obj.commerce as Record<string, unknown>)
      : {}

  return {
    website: {
      enabled: bool(websiteRaw.enabled, defaults.website.enabled),
      products: bool(websiteRaw.products, defaults.website.products),
      cart: bool(websiteRaw.cart, defaults.website.cart),
      personalize: bool(websiteRaw.personalize, defaults.website.personalize),
      chat: bool(websiteRaw.chat, defaults.website.chat),
      lead_form: bool(websiteRaw.lead_form, defaults.website.lead_form),
      faq: bool(websiteRaw.faq, defaults.website.faq),
      categories: bool(websiteRaw.categories, defaults.website.categories),
      booking: bool(websiteRaw.booking, defaults.website.booking),
    },
    commerce: {
      cart: bool(commerceRaw.cart, defaults.commerce.cart),
      order_tracking: bool(commerceRaw.order_tracking, defaults.commerce.order_tracking),
    },
  }
}

export function partnerWebsiteEnabled(caps: PartnerCapabilities): boolean {
  return caps.website.enabled
}

export function partnerCommerceCartEnabled(caps: PartnerCapabilities): boolean {
  return caps.website.enabled && caps.website.cart && caps.commerce.cart
}

export function partnerWebsiteProductsEnabled(caps: PartnerCapabilities): boolean {
  return caps.website.enabled && caps.website.products
}

export function partnerWebsiteBookingEnabled(caps: PartnerCapabilities): boolean {
  return caps.website.enabled && caps.website.booking
}

export function capabilitiesToTemplateFlags(caps: PartnerCapabilities): ShopTemplatePresetFlags {
  return {
    products: caps.website.products,
    personalize: caps.website.personalize,
    chat: caps.website.chat,
    lead: caps.website.lead_form,
    faq: caps.website.faq,
    categories: caps.website.categories,
    features: false,
    testimonials: false,
    pricing: false,
    trust: false,
  }
}

export function mergeTemplateFlagsWithCapabilities(
  presetFlags: ShopTemplatePresetFlags,
  caps: PartnerCapabilities
): ShopTemplatePresetFlags {
  const fromCaps = capabilitiesToTemplateFlags(caps)
  return {
    products: presetFlags.products && fromCaps.products,
    personalize: presetFlags.personalize && fromCaps.personalize,
    chat: presetFlags.chat && fromCaps.chat,
    lead: presetFlags.lead && fromCaps.lead,
    faq: presetFlags.faq && fromCaps.faq,
    categories: presetFlags.categories && fromCaps.categories,
    features: presetFlags.features,
    testimonials: presetFlags.testimonials,
    pricing: presetFlags.pricing,
    trust: presetFlags.trust,
  }
}

export type PartnerSiteIndustryCopyProfile = {
  heroBadge: Record<'vi' | 'en', string>
  heroCtaFallback: Record<'vi' | 'en', string>
  secondaryCta: Record<'vi' | 'en', string>
  categoriesFallback: Record<'vi' | 'en', string[]>
  newArrivalsFallback: Record<'vi' | 'en', string>
  bestSellersFallback: Record<'vi' | 'en', string>
  heroSubtitleFallback: Record<'vi' | 'en', string>
}

export function industryCopyProfile(industryKey: PartnerIndustryKey): PartnerSiteIndustryCopyProfile {
  if (industryKey === 'hotel') {
    return {
      heroBadge: { vi: 'Trải nghiệm nghỉ dưỡng', en: 'Stay experience' },
      heroCtaFallback: { vi: 'ĐẶT PHÒNG', en: 'BOOK NOW' },
      secondaryCta: { vi: 'Xem phòng', en: 'View rooms' },
      categoriesFallback: {
        vi: ['Phòng tiêu chuẩn', 'Phòng cao cấp', 'Suite', 'View biển'],
        en: ['Standard', 'Deluxe', 'Suite', 'Ocean view'],
      },
      newArrivalsFallback: { vi: 'Phòng nổi bật', en: 'FEATURED ROOMS' },
      bestSellersFallback: { vi: 'Gói ưu đãi', en: 'SPECIAL OFFERS' },
      heroSubtitleFallback: {
        vi: 'Đặt phòng trực tuyến — hỗ trợ qua chat',
        en: 'Book online — chat support available',
      },
    }
  }
  if (industryKey === 'food') {
    return {
      heroBadge: { vi: 'Thực đơn mới', en: 'Fresh menu' },
      heroCtaFallback: { vi: 'XEM THỰC ĐƠN', en: 'VIEW MENU' },
      secondaryCta: { vi: 'Khuyến mãi', en: 'Promotions' },
      categoriesFallback: {
        vi: ['Món chính', 'Đồ uống', 'Tráng miệng', 'Combo'],
        en: ['Main dishes', 'Drinks', 'Desserts', 'Combos'],
      },
      newArrivalsFallback: { vi: 'Món mới', en: 'NEW ITEMS' },
      bestSellersFallback: { vi: 'Bán chạy', en: 'BEST SELLERS' },
      heroSubtitleFallback: {
        vi: 'Đặt món nhanh — tư vấn qua chat',
        en: 'Order fast — chat for help',
      },
    }
  }
  return {
    heroBadge: { vi: 'Bộ sưu tập mới', en: 'New season' },
    heroCtaFallback: { vi: 'MUA NGAY', en: 'SHOP NOW' },
    secondaryCta: { vi: 'Khuyến mãi', en: 'Sale' },
    categoriesFallback: {
      vi: ['Sản phẩm', 'Danh mục A', 'Danh mục B', 'Phụ kiện'],
      en: ['Products', 'Category A', 'Category B', 'Accessories'],
    },
    newArrivalsFallback: { vi: 'Hàng mới về', en: 'NEW ARRIVALS' },
    bestSellersFallback: { vi: 'Sản phẩm bán chạy', en: 'BEST SELLERS' },
    heroSubtitleFallback: {
      vi: 'Sản phẩm chất lượng — tư vấn & đặt hàng nhanh qua chat',
      en: 'Quality products — chat to order fast',
    },
  }
}
