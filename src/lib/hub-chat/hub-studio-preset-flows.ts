import type { StudioGeneratorKind } from '@/lib/hub-chat/hub-studio-presets'

export type StudioStepPhase = 'discovery' | 'design'

export type StudioFlowStepDef = {
  key: string
  labelKey: string
  phase: StudioStepPhase
  generator?: StudioGeneratorKind
  /** Banner / ad: e.g. "1.91:1", "1:1", "9:16" */
  aspectRatio?: string
  /** Platform hint for prompts: google, facebook, instagram, shopee… */
  platform?: string
  formFactor?: 'mobile' | 'desktop' | 'square'
  /** First approved design asset becomes style anchor (e.g. story main character). */
  referenceAnchor?: boolean
}

export const MOBILE_SHOP_FLOW: StudioFlowStepDef[] = [
  { key: 'brand_name', labelKey: 'brand_name', phase: 'discovery' },
  { key: 'domain_name', labelKey: 'domain_name', phase: 'discovery' },
  { key: 'industry_product', labelKey: 'industry_product', phase: 'discovery' },
  { key: 'style_mood', labelKey: 'style_mood', phase: 'discovery' },
  { key: 'color_palette', labelKey: 'color_palette', phase: 'discovery' },
  { key: 'target_audience', labelKey: 'target_audience', phase: 'discovery' },
  { key: 'logo', labelKey: 'logo', phase: 'design', generator: 'logo', formFactor: 'square' },
  { key: 'home_mobile', labelKey: 'home_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'home_desktop', labelKey: 'home_desktop', phase: 'design', generator: 'ui_desktop', formFactor: 'desktop' },
  { key: 'product_detail_mobile', labelKey: 'product_detail_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'product_detail_desktop', labelKey: 'product_detail_desktop', phase: 'design', generator: 'ui_desktop', formFactor: 'desktop' },
  { key: 'cart_mobile', labelKey: 'cart_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'cart_desktop', labelKey: 'cart_desktop', phase: 'design', generator: 'ui_desktop', formFactor: 'desktop' },
  { key: 'category_mobile', labelKey: 'category_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'category_desktop', labelKey: 'category_desktop', phase: 'design', generator: 'ui_desktop', formFactor: 'desktop' },
  { key: 'product_list_mobile', labelKey: 'product_list_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'product_list_desktop', labelKey: 'product_list_desktop', phase: 'design', generator: 'ui_desktop', formFactor: 'desktop' },
  { key: 'search_results_mobile', labelKey: 'search_results_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'search_results_desktop', labelKey: 'search_results_desktop', phase: 'design', generator: 'ui_desktop', formFactor: 'desktop' },
  { key: 'checkout_mobile', labelKey: 'checkout_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'checkout_desktop', labelKey: 'checkout_desktop', phase: 'design', generator: 'ui_desktop', formFactor: 'desktop' },
  { key: 'order_success_mobile', labelKey: 'order_success_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'order_success_desktop', labelKey: 'order_success_desktop', phase: 'design', generator: 'ui_desktop', formFactor: 'desktop' },
  { key: 'login_mobile', labelKey: 'login_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'login_desktop', labelKey: 'login_desktop', phase: 'design', generator: 'ui_desktop', formFactor: 'desktop' },
  { key: 'profile_mobile', labelKey: 'profile_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'profile_desktop', labelKey: 'profile_desktop', phase: 'design', generator: 'ui_desktop', formFactor: 'desktop' },
  { key: 'order_detail_mobile', labelKey: 'order_detail_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'order_detail_desktop', labelKey: 'order_detail_desktop', phase: 'design', generator: 'ui_desktop', formFactor: 'desktop' },
  { key: 'wishlist_mobile', labelKey: 'wishlist_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'wishlist_desktop', labelKey: 'wishlist_desktop', phase: 'design', generator: 'ui_desktop', formFactor: 'desktop' },
  { key: 'about_mobile', labelKey: 'about_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'about_desktop', labelKey: 'about_desktop', phase: 'design', generator: 'ui_desktop', formFactor: 'desktop' },
  { key: 'contact_mobile', labelKey: 'contact_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'contact_desktop', labelKey: 'contact_desktop', phase: 'design', generator: 'ui_desktop', formFactor: 'desktop' },
  { key: 'policy_mobile', labelKey: 'policy_mobile', phase: 'design', generator: 'ui_mockup', formFactor: 'mobile' },
  { key: 'policy_desktop', labelKey: 'policy_desktop', phase: 'design', generator: 'ui_desktop', formFactor: 'desktop' },
]

export const LANDING_PAGE_FLOW: StudioFlowStepDef[] = [
  { key: 'product_name', labelKey: 'product_name', phase: 'discovery' },
  { key: 'value_prop', labelKey: 'value_prop', phase: 'discovery' },
  { key: 'target_audience', labelKey: 'target_audience', phase: 'discovery' },
  { key: 'style_mood', labelKey: 'style_mood', phase: 'discovery' },
  { key: 'color_palette', labelKey: 'color_palette', phase: 'discovery' },
  {
    key: 'landing_full',
    labelKey: 'landing_full',
    phase: 'design',
    generator: 'ui_mockup',
    aspectRatio: '1:4',
    formFactor: 'mobile',
    referenceAnchor: true,
  },
]

export const PRODUCT_LISTING_FLOW: StudioFlowStepDef[] = [
  { key: 'product_name', labelKey: 'product_name', phase: 'discovery' },
  { key: 'category', labelKey: 'category', phase: 'discovery' },
  { key: 'marketplace', labelKey: 'marketplace', phase: 'discovery' },
  { key: 'selling_points', labelKey: 'selling_points', phase: 'discovery' },
  { key: 'photo_style', labelKey: 'photo_style', phase: 'discovery' },
  { key: 'product_white', labelKey: 'product_white', phase: 'design', generator: 'product_photo', aspectRatio: '1:1', formFactor: 'square' },
  { key: 'product_lifestyle', labelKey: 'product_lifestyle', phase: 'design', generator: 'product_photo', aspectRatio: '1:1', formFactor: 'square' },
  { key: 'product_detail', labelKey: 'product_detail', phase: 'design', generator: 'product_photo', aspectRatio: '1:1', formFactor: 'square' },
  { key: 'promo_banner_sq', labelKey: 'promo_banner_sq', phase: 'design', generator: 'banner', aspectRatio: '1:1', platform: 'shopee', formFactor: 'square' },
  { key: 'promo_banner_story', labelKey: 'promo_banner_story', phase: 'design', generator: 'banner', aspectRatio: '9:16', platform: 'tiktok', formFactor: 'mobile' },
]

export const PACKAGING_KIT_FLOW: StudioFlowStepDef[] = [
  { key: 'brand_name', labelKey: 'brand_name', phase: 'discovery' },
  { key: 'product_type', labelKey: 'product_type', phase: 'discovery' },
  { key: 'box_size', labelKey: 'box_size', phase: 'discovery' },
  { key: 'box_face_confirm', labelKey: 'box_face_confirm', phase: 'discovery' },
  { key: 'style_mood', labelKey: 'style_mood', phase: 'discovery' },
  { key: 'color_palette', labelKey: 'color_palette', phase: 'discovery' },
  { key: 'face_print_style', labelKey: 'face_print_style', phase: 'discovery' },
  { key: 'logo', labelKey: 'logo', phase: 'design', generator: 'logo', formFactor: 'square' },
  { key: 'face_top', labelKey: 'face_top', phase: 'design', generator: 'packaging_face', formFactor: 'square' },
  { key: 'face_front', labelKey: 'face_front', phase: 'design', generator: 'packaging_face', formFactor: 'square' },
  { key: 'face_right', labelKey: 'face_right', phase: 'design', generator: 'packaging_face', formFactor: 'square' },
  { key: 'face_bottom', labelKey: 'face_bottom', phase: 'design', generator: 'packaging_face', formFactor: 'square' },
  { key: 'face_back', labelKey: 'face_back', phase: 'design', generator: 'packaging_face', formFactor: 'square' },
  { key: 'face_left', labelKey: 'face_left', phase: 'design', generator: 'packaging_face', formFactor: 'square' },
  { key: 'box_mockup_3d', labelKey: 'box_mockup_3d', phase: 'design', generator: 'packaging_mockup', aspectRatio: '1:1', formFactor: 'square' },
  { key: 'box_dieline_pdf', labelKey: 'box_dieline_pdf', phase: 'design', generator: 'dieline_pdf', formFactor: 'desktop' },
  { key: 'product_label', labelKey: 'product_label', phase: 'design', generator: 'packaging', aspectRatio: '1:1', formFactor: 'square' },
  { key: 'seal_sticker', labelKey: 'seal_sticker', phase: 'design', generator: 'packaging', aspectRatio: '1:1', formFactor: 'square' },
  { key: 'barcode_label', labelKey: 'barcode_label', phase: 'design', generator: 'barcode', formFactor: 'square' },
]

/** Bước cũ chỉ dùng để tiếp tục các phiên packaging_kit đã lưu trước flow 6 mặt. */
const LEGACY_PACKAGING_STEPS: StudioFlowStepDef[] = [
  { key: 'box_flat', labelKey: 'box_flat', phase: 'design', generator: 'packaging', aspectRatio: '1:1', formFactor: 'square' },
  { key: 'face_lxw', labelKey: 'face_lxw', phase: 'design', generator: 'packaging_face', formFactor: 'square' },
  { key: 'face_lxh', labelKey: 'face_lxh', phase: 'design', generator: 'packaging_face', formFactor: 'square' },
  { key: 'face_wxh', labelKey: 'face_wxh', phase: 'design', generator: 'packaging_face', formFactor: 'square' },
  { key: 'body_strip', labelKey: 'body_strip', phase: 'design', generator: 'packaging_face', formFactor: 'desktop' },
]

export const BAG_KIT_FLOW: StudioFlowStepDef[] = [
  { key: 'brand_name', labelKey: 'brand_name', phase: 'discovery' },
  { key: 'product_type', labelKey: 'product_type', phase: 'discovery' },
  { key: 'bag_size', labelKey: 'bag_size', phase: 'discovery' },
  { key: 'bag_panel_confirm', labelKey: 'bag_panel_confirm', phase: 'discovery' },
  { key: 'style_mood', labelKey: 'style_mood', phase: 'discovery' },
  { key: 'color_palette', labelKey: 'color_palette', phase: 'discovery' },
  { key: 'face_print_style', labelKey: 'face_print_style', phase: 'discovery' },
  { key: 'logo', labelKey: 'logo', phase: 'design', generator: 'logo', formFactor: 'square' },
  { key: 'face_back', labelKey: 'face_back', phase: 'design', generator: 'packaging_face', formFactor: 'square' },
  { key: 'face_front', labelKey: 'face_front', phase: 'design', generator: 'packaging_face', formFactor: 'square' },
  {
    key: 'bag_mockup_3d',
    labelKey: 'bag_mockup_3d',
    phase: 'design',
    generator: 'packaging_mockup',
    aspectRatio: '1:1',
    formFactor: 'square',
  },
  { key: 'bag_dieline_pdf', labelKey: 'bag_dieline_pdf', phase: 'design', generator: 'bag_dieline_pdf', formFactor: 'desktop' },
]

export const FOOD_MENU_FLOW: StudioFlowStepDef[] = [
  { key: 'venue_name', labelKey: 'venue_name', phase: 'discovery' },
  { key: 'menu_type', labelKey: 'menu_type', phase: 'discovery' },
  { key: 'food_illustration', labelKey: 'food_illustration', phase: 'discovery' },
  { key: 'menu_style', labelKey: 'menu_style', phase: 'discovery' },
  { key: 'color_tone', labelKey: 'color_tone', phase: 'discovery' },
  {
    key: 'menu_design',
    labelKey: 'menu_design',
    phase: 'design',
    generator: 'banner',
    aspectRatio: '3:4',
    formFactor: 'mobile',
  },
]

export const DESIGN_RECREATE_FLOW: StudioFlowStepDef[] = [
  { key: 'design_sector', labelKey: 'design_sector', phase: 'discovery' },
  { key: 'design_format', labelKey: 'design_format', phase: 'discovery' },
  { key: 'render_style', labelKey: 'render_style', phase: 'discovery' },
  { key: 'sample_upload', labelKey: 'sample_upload', phase: 'discovery' },
  { key: 'color_palette', labelKey: 'color_palette', phase: 'discovery' },
  { key: 'design_notes', labelKey: 'design_notes', phase: 'discovery' },
  { key: 'design_language', labelKey: 'design_language', phase: 'discovery' },
  /** Logo bắt buộc — gắn lên bảng thiết kế sau khi duyệt. */
  { key: 'logo', labelKey: 'logo', phase: 'design', generator: 'logo', formFactor: 'square' },
  /** Một ảnh thiết kế lại — sau đó chỉ Tạo lại (không bước Tiếp). */
  {
    key: 'concept_sheet',
    labelKey: 'concept_sheet',
    phase: 'design',
    generator: 'banner',
    aspectRatio: '3:4',
    formFactor: 'mobile',
  },
]

/** Ảnh tự chụp → bộ ảnh bán nền tảng khác. Không hỏi tên/loại — AI đặt sau ảnh cuối. */
export const CATALOG_PHOTO_PACK_FLOW: StudioFlowStepDef[] = [
  { key: 'material', labelKey: 'material', phase: 'discovery' },
  { key: 'product_kind', labelKey: 'product_kind', phase: 'discovery' },
  { key: 'shot_look', labelKey: 'shot_look', phase: 'discovery' },
  { key: 'color_main', labelKey: 'color_main', phase: 'design', generator: 'product_photo', aspectRatio: '1:1', formFactor: 'square' },
  { key: 'gallery_2', labelKey: 'gallery_2', phase: 'design', generator: 'product_photo', aspectRatio: '1:1', formFactor: 'square' },
  { key: 'gallery_3', labelKey: 'gallery_3', phase: 'design', generator: 'product_photo', aspectRatio: '1:1', formFactor: 'square' },
  { key: 'detail_close', labelKey: 'detail_close', phase: 'design', generator: 'product_photo', aspectRatio: '1:1', formFactor: 'square' },
  { key: 'material_card', labelKey: 'material_card', phase: 'design', generator: 'product_photo', aspectRatio: '1:1', formFactor: 'square' },
]

export const PRESET_FLOW_MAP: Record<string, StudioFlowStepDef[]> = {
  mobile_shop: MOBILE_SHOP_FLOW,
  product_listing: PRODUCT_LISTING_FLOW,
  packaging_kit: PACKAGING_KIT_FLOW,
  food_menu: FOOD_MENU_FLOW,
  bag_kit: BAG_KIT_FLOW,
  catalog_photo_pack: CATALOG_PHOTO_PACK_FLOW,
}

export function getFlowSteps(presetId: string): StudioFlowStepDef[] {
  return PRESET_FLOW_MAP[presetId] ?? []
}

export function isDiscoveryStep(presetId: string, stepKey: string): boolean {
  const step = getFlowSteps(presetId).find((s) => s.key === stepKey)
  return step?.phase === 'discovery'
}

export function getFlowStep(presetId: string, stepKey: string): StudioFlowStepDef | undefined {
  return (
    getFlowSteps(presetId).find((s) => s.key === stepKey) ??
    (presetId === 'packaging_kit' ? LEGACY_PACKAGING_STEPS.find((s) => s.key === stepKey) : undefined)
  )
}

export function allDiscoveryDone(presetId: string, steps: { key: string; status: string }[]): boolean {
  const discoveryKeys = getFlowSteps(presetId).filter((s) => s.phase === 'discovery').map((s) => s.key)
  return discoveryKeys.every((k) => steps.find((s) => s.key === k)?.status === 'done')
}

/** First style anchor: logo step, or referenceAnchor design step (e.g. story main character). */
export function getPrimaryLogoStepKey(presetId: string): string | null {
  const flow = getFlowSteps(presetId)
  const logo = flow.find((s) => s.phase === 'design' && s.generator === 'logo')
  if (logo) return logo.key
  const anchor = flow.find((s) => s.phase === 'design' && s.referenceAnchor)
  return anchor?.key ?? null
}

export function isLogoDesignStep(presetId: string, stepKey: string): boolean {
  const step = getFlowStep(presetId, stepKey)
  return step?.phase === 'design' && step.generator === 'logo'
}

/** Brief context for generation — logo step uses discovery + logo only; other steps use flow up to target. */
export function briefNotesForStepGeneration(
  presetId: string,
  stepKey: string,
  briefNotes: Record<string, string>
): Record<string, string> {
  const flow = getFlowSteps(presetId)
  const targetIdx = flow.findIndex((s) => s.key === stepKey)
  if (targetIdx < 0) return {}

  const logoKey = getPrimaryLogoStepKey(presetId)
  const out: Record<string, string> = {}

  for (const [key, value] of Object.entries(briefNotes)) {
    const trimmed = value?.trim()
    if (!trimmed) continue
    const idx = flow.findIndex((s) => s.key === key)
    if (idx < 0 || idx > targetIdx) continue
    if (logoKey && stepKey === logoKey) {
      const step = flow[idx]
      if (step?.phase !== 'discovery' && key !== logoKey) continue
    }
    out[key] = trimmed
  }
  return out
}

export function isStepAfterPrimaryLogo(presetId: string, stepKey: string): boolean {
  const logoKey = getPrimaryLogoStepKey(presetId)
  if (!logoKey) return false
  const flow = getFlowSteps(presetId)
  const logoIdx = flow.findIndex((s) => s.key === logoKey)
  const stepIdx = flow.findIndex((s) => s.key === stepKey)
  return stepIdx > logoIdx
}

export function primaryLogoApproved(
  steps: { key: string; status: string }[],
  presetId: string
): boolean {
  const logoKey = getPrimaryLogoStepKey(presetId)
  if (!logoKey) return true
  return steps.find((s) => s.key === logoKey)?.status === 'done'
}

export function hasPrimaryLogoReference(
  referenceImages: { screenKey: string }[],
  presetId: string
): boolean {
  const logoKey = getPrimaryLogoStepKey(presetId)
  if (!logoKey) return true
  return referenceImages.some((r) => r.screenKey === logoKey)
}

export function orderedReferenceUrls(
  referenceImages: { screenKey: string; url: string }[],
  presetId: string
): string[] {
  const logoKey = getPrimaryLogoStepKey(presetId)
  if (!logoKey) return referenceImages.map((r) => r.url)
  const logoRef = referenceImages.find((r) => r.screenKey === logoKey)
  const rest = referenceImages.filter((r) => r.screenKey !== logoKey)
  return [...(logoRef ? [logoRef.url] : []), ...rest.map((r) => r.url)]
}

export const SALE_BANNER_COPY_BRIEF_KEYS = [
  'domain_name',
  'campaign_name',
  'product_offer',
  'discount_cta',
] as const

/** Visual direction only — must NOT be rendered as on-banner text. */
export const SALE_BANNER_VISUAL_BRIEF_KEYS = [
  'brand_style',
  'color_tone',
  'banner_style',
  'banner_model',
] as const

export const SALE_BANNER_DISCOVERY_BRIEF_KEYS = [
  ...SALE_BANNER_COPY_BRIEF_KEYS,
  ...SALE_BANNER_VISUAL_BRIEF_KEYS,
] as const

export function hasSaleBannerDiscoveryBrief(briefNotes: Record<string, string> | undefined): boolean {
  if (!briefNotes) return false
  return SALE_BANNER_DISCOVERY_BRIEF_KEYS.some((k) => Boolean(briefNotes[k]?.trim()))
}

export const FOOD_MENU_DISCOVERY_BRIEF_KEYS = [
  'venue_name',
  'menu_type',
  'food_illustration',
  'menu_style',
  'color_tone',
] as const

export function hasFoodMenuDiscoveryBrief(briefNotes: Record<string, string> | undefined): boolean {
  if (!briefNotes) return false
  return FOOD_MENU_DISCOVERY_BRIEF_KEYS.some((k) => Boolean(briefNotes[k]?.trim()))
}

export const LANDING_DISCOVERY_BRIEF_KEYS = [
  'product_name',
  'value_prop',
  'target_audience',
  'style_mood',
  'color_palette',
] as const

export const LANDING_DESIGN_STEP_KEYS = ['landing_full'] as const

export type LandingDesignStepKey = (typeof LANDING_DESIGN_STEP_KEYS)[number]

/** Phiên cũ — map screenKey/briefNotes cũ sang landing_full. */
export const LEGACY_LANDING_STEP_ALIASES: Record<string, LandingDesignStepKey> = {
  hero_desktop: 'landing_full',
  hero_mobile: 'landing_full',
  features_desktop: 'landing_full',
  features_mobile: 'landing_full',
  pricing_desktop: 'landing_full',
  pricing_mobile: 'landing_full',
  testimonials_desktop: 'landing_full',
  testimonials_mobile: 'landing_full',
  faq_desktop: 'landing_full',
  faq_mobile: 'landing_full',
  cta_footer_desktop: 'landing_full',
  cta_footer_mobile: 'landing_full',
  features: 'landing_full',
  pricing: 'landing_full',
  testimonials: 'landing_full',
  faq: 'landing_full',
  cta_footer: 'landing_full',
}

const LEGACY_BRIEF_KEY_BY_CANONICAL: Partial<Record<LandingDesignStepKey, string>> = {
  landing_full: 'hero_desktop',
}

export function normalizeLandingDesignStepKey(stepKey: string): LandingDesignStepKey | null {
  if (LANDING_DESIGN_STEP_KEYS.includes(stepKey as LandingDesignStepKey)) {
    return stepKey as LandingDesignStepKey
  }
  return LEGACY_LANDING_STEP_ALIASES[stepKey] ?? null
}

export function readLandingSectionBrief(
  stepKey: string,
  briefNotes: Record<string, string> | undefined
): string {
  if (!briefNotes) return ''
  const direct = briefNotes[stepKey]?.trim()
  if (direct) return direct
  const canonical = normalizeLandingDesignStepKey(stepKey)
  if (canonical) {
    const fromCanonical = briefNotes[canonical]?.trim()
    if (fromCanonical) return fromCanonical
    const legacyKey = LEGACY_BRIEF_KEY_BY_CANONICAL[canonical]
    if (legacyKey) {
      return briefNotes[legacyKey]?.trim() ?? ''
    }
  }
  const stripped = stepKey.replace(/_(desktop|mobile)$/, '')
  if (stripped !== stepKey && briefNotes[stripped]?.trim()) {
    return briefNotes[stripped].trim()
  }
  return ''
}

export function isLandingDesignStepKey(stepKey: string | null | undefined): stepKey is LandingDesignStepKey {
  if (!stepKey) return false
  if (LANDING_DESIGN_STEP_KEYS.includes(stepKey as LandingDesignStepKey)) return true
  return stepKey in LEGACY_LANDING_STEP_ALIASES
}

export function hasLandingDiscoveryBrief(briefNotes: Record<string, string> | undefined): boolean {
  if (!briefNotes) return false
  return Boolean(briefNotes.product_name?.trim() && briefNotes.value_prop?.trim())
}

export function landingSectionHasCopy(
  stepKey: string,
  briefNotes: Record<string, string>,
  sectionCopy?: string
): boolean {
  const copy = sectionCopy?.trim() || readLandingSectionBrief(stepKey, briefNotes)
  if (copy && copy.length >= 2) return true
  const canonical = normalizeLandingDesignStepKey(stepKey) ?? stepKey
  if (canonical === 'landing_full' && hasLandingDiscoveryBrief(briefNotes)) return true
  return false
}

export function isLandingFullPageStep(stepKey: string): boolean {
  return normalizeLandingDesignStepKey(stepKey) === 'landing_full'
}

export function hasLandingHeaderLogo(landingPage: { logoUrl?: string | null } | undefined): boolean {
  return Boolean(landingPage?.logoUrl?.trim())
}

export function isLandingFirstDesignStep(stepKey: string): boolean {
  return normalizeLandingDesignStepKey(stepKey) === 'landing_full'
}
