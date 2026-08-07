import type { WebLocale } from '@/lib/i18n/config'
import { getStudioPresetCopy } from '@/lib/i18n/studio-preset-copy'

/** Tỷ lệ Gemini imageConfig chấp nhận (gemini-3-pro-image). */
export const GEMINI_IMAGE_ASPECT_RATIOS = [
  '1:1',
  '1:4',
  '1:8',
  '2:3',
  '3:2',
  '3:4',
  '4:1',
  '4:3',
  '4:5',
  '5:4',
  '8:1',
  '9:16',
  '16:9',
  '21:9',
] as const

export type GeminiAspectRatio = (typeof GEMINI_IMAGE_ASPECT_RATIOS)[number]
export type BannerAspectRatio = GeminiAspectRatio
export const BANNER_VALID_ASPECT_RATIOS = GEMINI_IMAGE_ASPECT_RATIOS

/** Preset id hiện hành — mỗi tỷ lệ quảng cáo chỉ một mục. */
export type BannerAdPresetId =
  | 'horizontal_display_ads'
  | 'square_social_ads'
  | 'portrait_social_ads'
  | 'vertical_story_ads'
  | 'web_leaderboard'
  | 'wide_hero_desktop'
  | 'print_catalog_4_3'
  | 'print_poster_3_4'
  | 'catalog_photo_3_2'
  | 'pinterest_poster_2_3'
  | 'catalog_near_square_5_4'
  | 'ooh_vertical_1_4'
  | 'ooh_strip_8_1'
  /** @deprecated */
  | 'google_display'
  /** @deprecated */
  | 'google_square'
  /** @deprecated */
  | 'facebook_feed'
  /** @deprecated */
  | 'social_portrait'
  /** @deprecated */
  | 'facebook_story'
  /** @deprecated */
  | 'instagram_reels'
  /** @deprecated */
  | 'tiktok_reels'
  /** @deprecated */
  | 'web_header'
  /** @deprecated */
  | 'display_leaderboard'
  /** @deprecated */
  | 'wide_banner'
  /** @deprecated */
  | 'ratio_4_3'
  /** @deprecated */
  | 'ratio_3_4'
  /** @deprecated */
  | 'ratio_3_2'
  /** @deprecated */
  | 'ratio_2_3'
  /** @deprecated */
  | 'ratio_5_4'

export type BannerAdPreset = {
  id: BannerAdPresetId
  aspectRatio: BannerAspectRatio
  labelKey: keyof (typeof import('@/lib/i18n/studio-preset-copy/vi').STUDIO_PRESET_VI)['sale_banner']['steps']
  platform: 'google' | 'facebook' | 'instagram' | 'tiktok' | 'web' | 'other'
}

/** Một dòng / một tỷ lệ — label i18n ghi rõ kênh ads phù hợp. */
export const BANNER_AD_PRESETS = [
  { id: 'horizontal_display_ads', aspectRatio: '16:9', labelKey: 'horizontal_display_ads', platform: 'google' },
  { id: 'square_social_ads', aspectRatio: '1:1', labelKey: 'square_social_ads', platform: 'other' },
  { id: 'portrait_social_ads', aspectRatio: '4:5', labelKey: 'portrait_social_ads', platform: 'instagram' },
  { id: 'vertical_story_ads', aspectRatio: '9:16', labelKey: 'vertical_story_ads', platform: 'other' },
  { id: 'web_leaderboard', aspectRatio: '4:1', labelKey: 'web_leaderboard', platform: 'web' },
  { id: 'wide_hero_desktop', aspectRatio: '21:9', labelKey: 'wide_hero_desktop', platform: 'other' },
  { id: 'print_catalog_4_3', aspectRatio: '4:3', labelKey: 'print_catalog_4_3', platform: 'other' },
  { id: 'print_poster_3_4', aspectRatio: '3:4', labelKey: 'print_poster_3_4', platform: 'other' },
  { id: 'catalog_photo_3_2', aspectRatio: '3:2', labelKey: 'catalog_photo_3_2', platform: 'other' },
  { id: 'pinterest_poster_2_3', aspectRatio: '2:3', labelKey: 'pinterest_poster_2_3', platform: 'other' },
  { id: 'catalog_near_square_5_4', aspectRatio: '5:4', labelKey: 'catalog_near_square_5_4', platform: 'other' },
  { id: 'ooh_vertical_1_4', aspectRatio: '1:4', labelKey: 'ooh_vertical_1_4', platform: 'other' },
  { id: 'ooh_strip_8_1', aspectRatio: '8:1', labelKey: 'ooh_strip_8_1', platform: 'other' },
] as const satisfies readonly BannerAdPreset[]

/** @deprecated — tất cả preset đã gom vào BANNER_AD_PRESETS */
export const BANNER_GENERIC_RATIO_PRESET_IDS: BannerAdPresetId[] = []

const LEGACY_PRESET_ID_MAP: Partial<Record<BannerAdPresetId, BannerAdPresetId>> = {
  google_display: 'horizontal_display_ads',
  web_header: 'horizontal_display_ads',
  google_square: 'square_social_ads',
  facebook_feed: 'square_social_ads',
  social_portrait: 'portrait_social_ads',
  facebook_story: 'vertical_story_ads',
  instagram_reels: 'vertical_story_ads',
  tiktok_reels: 'vertical_story_ads',
  display_leaderboard: 'web_leaderboard',
  wide_banner: 'wide_hero_desktop',
  ratio_4_3: 'print_catalog_4_3',
  ratio_3_4: 'print_poster_3_4',
  ratio_3_2: 'catalog_photo_3_2',
  ratio_2_3: 'pinterest_poster_2_3',
  ratio_5_4: 'catalog_near_square_5_4',
}

export function normalizeBannerAdPresetId(id: string): BannerAdPresetId {
  const raw = String(id ?? '').trim() as BannerAdPresetId
  return LEGACY_PRESET_ID_MAP[raw] ?? raw
}

export function findBannerAdPreset(id: string): BannerAdPreset | undefined {
  const normalized = normalizeBannerAdPresetId(id)
  return BANNER_AD_PRESETS.find((p) => p.id === normalized)
}

export function getBannerAdPresetById(id: BannerAdPresetId | string): BannerAdPreset {
  const normalized = normalizeBannerAdPresetId(String(id))
  return BANNER_AD_PRESETS.find((p) => p.id === normalized) ?? BANNER_AD_PRESETS[0]
}

export function getBannerAdPresetLabel(preset: BannerAdPreset, locale: WebLocale): string {
  const copy = getStudioPresetCopy(locale)
  return copy.sale_banner.steps[preset.labelKey]
}

export const GEMINI_RATIO_AD_USE: Record<GeminiAspectRatio, Record<WebLocale, string>> = {
  '1:1': {
    vi: 'Google Ads vuông, Facebook/Instagram feed vuông (1080×1080 / 1200×1200)',
    en: 'Google square ads, Facebook/Instagram square feed (1080×1080 / 1200×1200)',
    zh: 'Google 方形广告、Facebook/Instagram 方形信息流（1080×1080 / 1200×1200）',
    ja: 'Google正方形広告、Facebook/Instagram正方形フィード（1080×1080 / 1200×1200）',
    ko: 'Google 정사각 광고, Facebook/Instagram 정사각 피드 (1080×1080 / 1200×1200)',
  },
  '16:9': {
    vi: 'Google Display (~1200×628), YouTube, banner web/header',
    en: 'Google Display (~1200×628), YouTube, web/header banners',
    zh: 'Google 展示（约 1200×628）、YouTube、网页/页眉横幅',
    ja: 'Googleディスプレイ（約1200×628）、YouTube、Web/ヘッダー',
    ko: 'Google 디스플레이(~1200×628), YouTube, 웹/헤더 배너',
  },
  '9:16': {
    vi: 'Facebook/Instagram Story, Reels, TikTok (1080×1920)',
    en: 'Facebook/Instagram Story, Reels, TikTok (1080×1920)',
    zh: 'Facebook/Instagram Story、Reels、TikTok（1080×1920）',
    ja: 'Facebook/Instagram Story、Reels、TikTok（1080×1920）',
    ko: 'Facebook/Instagram Story, Reels, TikTok (1080×1920)',
  },
  '4:5': {
    vi: 'Facebook/Instagram feed dọc (1080×1350)',
    en: 'Facebook/Instagram portrait feed (1080×1350)',
    zh: 'Facebook/Instagram 竖版信息流（1080×1350）',
    ja: 'Facebook/Instagram縦型フィード（1080×1350）',
    ko: 'Facebook/Instagram 세로 피드 (1080×1350)',
  },
  '21:9': {
    vi: 'Hero desktop siêu rộng, quảng cáo màn hình lớn',
    en: 'Ultra-wide desktop hero, large-display ads',
    zh: '超宽桌面主视觉、大屏广告',
    ja: '超ワイドデスクトップヒーロー、大画面広告',
    ko: '초와이드 데스크톱 히어로, 대형 화면 광고',
  },
  '4:1': {
    vi: 'Leaderboard web, Google Display ngang mảnh',
    en: 'Web leaderboard, thin horizontal display ads',
    zh: '网页通栏、Google 展示横条',
    ja: 'Webリーダーボード、横長ディスプレイ',
    ko: '웹 리더보드, 가로 디스플레이 띠',
  },
  '4:3': {
    vi: 'In ấn, catalog ngang, slide quảng cáo',
    en: 'Print, horizontal catalog, ad slides',
    zh: '印刷、横版目录、广告幻灯片',
    ja: '印刷、横カタログ、広告スライド',
    ko: '인쇄, 가로 카탈로그, 광고 슬라이드',
  },
  '3:4': {
    vi: 'Poster dọc, in ấn, quảng cáo cửa hàng',
    en: 'Vertical poster, print, in-store ads',
    zh: '竖版海报、印刷、店内广告',
    ja: '縦ポスター、印刷、店頭広告',
    ko: '세로 포스터, 인쇄, 매장 광고',
  },
  '3:2': {
    vi: 'Catalog sản phẩm, ảnh ngang quảng cáo',
    en: 'Product catalog, horizontal ad photos',
    zh: '产品目录、横版广告图',
    ja: '商品カタログ、横広告写真',
    ko: '제품 카탈로그, 가로 광고 사진',
  },
  '2:3': {
    vi: 'Pinterest, poster dọc quảng cáo',
    en: 'Pinterest, vertical ad posters',
    zh: 'Pinterest、竖版广告海报',
    ja: 'Pinterest、縦広告ポスター',
    ko: 'Pinterest, 세로 광고 포스터',
  },
  '5:4': {
    vi: 'Catalog gần vuông, ảnh sản phẩm ads',
    en: 'Near-square catalog, product ad images',
    zh: '近方形目录、产品广告图',
    ja: 'やや正方形カタログ、商品広告画像',
    ko: '거의 정사각 카탈로그, 제품 광고 이미지',
  },
  '1:4': {
    vi: 'OOH dọc cực cao, màn portrait quảng cáo',
    en: 'Ultra-tall OOH, portrait screen ads',
    zh: '超高户外竖版、竖屏广告',
    ja: '超縦OOH、縦型ディスプレイ広告',
    ko: '초세로 OOH, 세로 화면 광고',
  },
  '1:8': {
    vi: 'Banner dọc siêu mảnh (màn đặc biệt)',
    en: 'Ultra-narrow vertical strip (specialty screens)',
    zh: '超窄竖条（特殊屏幕）',
    ja: '超細縦ストリップ（特殊ディスプレイ）',
    ko: '초좁은 세로 띠(특수 화면)',
  },
  '8:1': {
    vi: 'LED / sự kiện, banner ngang cực rộng',
    en: 'LED / events, ultra-wide horizontal ads',
    zh: 'LED/活动、超宽横条广告',
    ja: 'LED/イベント、超横長広告',
    ko: 'LED/이벤트, 초와이드 가로 광고',
  },
}

export function getGeminiRatioAdUse(ratio: string, locale: WebLocale): string {
  const key = ratio as GeminiAspectRatio
  return GEMINI_RATIO_AD_USE[key]?.[locale] ?? ''
}

const GEMINI_FOOTNOTE: Record<WebLocale, { title: string; note: string }> = {
  vi: {
    title: 'Bảng tham khảo tỷ lệ AI',
    note: 'Google Display chuẩn ~1.91:1 — chọn 16:9 (gần nhất). Mỗi mục trên đã ghi kênh ads phù hợp.',
  },
  en: {
    title: 'AI ratio reference',
    note: 'Standard Google Display ~1.91:1 — pick 16:9 (closest). Each item above lists matching ad channels.',
  },
  zh: {
    title: 'AI 比例参考',
    note: 'Google 展示标准约 1.91:1 — 选 16:9（最接近）。上方每项已标注适用广告渠道。',
  },
  ja: {
    title: 'AI比率リファレンス',
    note: 'Googleディスプレイ標準約1.91:1 — 16:9（最も近い）を選択。上記各項目に適合チャネル記載。',
  },
  ko: {
    title: 'AI 비율 참고',
    note: 'Google 디스플레이 표준 ~1.91:1 — 16:9(가장 가까움). 위 항목에 맞는 광고 채널이 표시됩니다.',
  },
}

export function getGeminiBannerRatioFootnote(locale: WebLocale): { title: string; note: string } {
  return GEMINI_FOOTNOTE[locale]
}

export function listGeminiRatioAdGuide(locale: WebLocale): Array<{ ratio: GeminiAspectRatio; use: string }> {
  return GEMINI_IMAGE_ASPECT_RATIOS.map((ratio) => ({
    ratio,
    use: GEMINI_RATIO_AD_USE[ratio][locale],
  }))
}

export function isValidBannerAspectRatio(value: string): value is BannerAspectRatio {
  return (BANNER_VALID_ASPECT_RATIOS as readonly string[]).includes(value)
}

export function normalizeBannerAspectRatioForGemini(ratio: string | undefined | null): GeminiAspectRatio {
  const raw = String(ratio ?? '').trim() || '16:9'
  if ((GEMINI_IMAGE_ASPECT_RATIOS as readonly string[]).includes(raw)) {
    return raw as GeminiAspectRatio
  }
  if (raw === '1.91:1') return '16:9'
  return '16:9'
}

type ActiveBannerPresetId = (typeof BANNER_AD_PRESETS)[number]['id']

const PLATFORM_HINTS: Record<ActiveBannerPresetId, Record<WebLocale, string>> = {
  horizontal_display_ads: {
    vi: 'Banner ngang Google Display, YouTube, web/header — headline rõ, CTA nổi bật (AI 16:9).',
    en: 'Horizontal Google Display, YouTube, web/header — clear headline, strong CTA (AI 16:9).',
    zh: 'Google 展示、YouTube、网页/页眉横版 — 标题清晰、CTA 突出（AI 16:9）。',
    ja: 'Googleディスプレイ、YouTube、Web/ヘッダー横長 — 見出し明確、CTA強調（AI 16:9）。',
    ko: 'Google 디스플레이, YouTube, 웹/헤더 가로 — 헤드라인 명확, CTA 강조 (AI 16:9).',
  },
  square_social_ads: {
    vi: 'Banner vuông Facebook Feed & Google Ads — text ngắn, visual thu hút (AI 1:1).',
    en: 'Square Facebook Feed & Google Ads — short copy, scroll-stopping visual (AI 1:1).',
    zh: 'Facebook 信息流与 Google Ads 方形 — 短文案、吸引滚动（AI 1:1）。',
    ja: 'Facebookフィード＆Google Ads正方形 — 短いコピー、目を引くビジュアル（AI 1:1）。',
    ko: 'Facebook 피드 & Google Ads 정사각 — 짧은 카피, 시선을 끄는 비주얼 (AI 1:1).',
  },
  portrait_social_ads: {
    vi: 'Facebook/Instagram feed dọc — sản phẩm nổi bật, text gọn (AI 4:5).',
    en: 'Facebook/Instagram portrait feed — product stands out, concise copy (AI 4:5).',
    zh: 'Facebook/Instagram 竖版信息流 — 产品突出、文案简洁（AI 4:5）。',
    ja: 'Facebook/Instagram縦型フィード — 商品強調、簡潔コピー（AI 4:5）。',
    ko: 'Facebook/Instagram 세로 피드 — 제품 강조, 간결한 카피 (AI 4:5).',
  },
  vertical_story_ads: {
    vi: 'Story Facebook/Instagram, Reels, TikTok — full màn dọc, hook mạnh (AI 9:16).',
    en: 'Facebook/Instagram Story, Reels, TikTok — full vertical, strong hook (AI 9:16).',
    zh: 'Facebook/Instagram Story、Reels、TikTok — 全屏竖版、强钩子（AI 9:16）。',
    ja: 'Facebook/Instagram Story、Reels、TikTok — 全画面縦型、強いフック（AI 9:16）。',
    ko: 'Facebook/Instagram Story, Reels, TikTok — 전체 세로, 강한 훅 (AI 9:16).',
  },
  web_leaderboard: {
    vi: 'Leaderboard web / banner ngang mảnh — logo + CTA ngắn (AI 4:1).',
    en: 'Web leaderboard / thin strip — logo + short CTA (AI 4:1).',
    zh: '网页通栏/细长横条 — Logo + 短 CTA（AI 4:1）。',
    ja: 'Webリーダーボード/横長細 — ロゴ＋短いCTA（AI 4:1）。',
    ko: '웹 리더보드/가로 띠 — 로고 + 짧은 CTA (AI 4:1).',
  },
  wide_hero_desktop: {
    vi: 'Hero desktop siêu rộng — slogan lớn, visual ấn tượng (AI 21:9).',
    en: 'Ultra-wide desktop hero — bold slogan, impactful visual (AI 21:9).',
    zh: '超宽桌面主视觉 — 大标语、强视觉（AI 21:9）。',
    ja: '超ワイドデスクトップヒーロー — 大きなスローガン、インパクト（AI 21:9）。',
    ko: '초와이드 데스크톱 히어로 — 큰 슬로건, 임팩트 비주얼 (AI 21:9).',
  },
  print_catalog_4_3: {
    vi: 'In ấn / catalog ngang — bố cục sản phẩm rõ (AI 4:3).',
    en: 'Print / horizontal catalog — clear product layout (AI 4:3).',
    zh: '印刷/横版目录 — 产品布局清晰（AI 4:3）。',
    ja: '印刷/横カタログ — 商品レイアウト明確（AI 4:3）。',
    ko: '인쇄/가로 카탈로그 — 제품 레이아웃 명확 (AI 4:3).',
  },
  print_poster_3_4: {
    vi: 'Poster dọc / in ấn cửa hàng — headline lớn (AI 3:4).',
    en: 'Vertical poster / in-store print — large headline (AI 3:4).',
    zh: '竖版海报/店内印刷 — 大标题（AI 3:4）。',
    ja: '縦ポスター/店頭印刷 — 大見出し（AI 3:4）。',
    ko: '세로 포스터/매장 인쇄 — 큰 헤드라인 (AI 3:4).',
  },
  catalog_photo_3_2: {
    vi: 'Catalog / ảnh ngang sản phẩm — visual sạch (AI 3:2).',
    en: 'Catalog / horizontal product photo — clean visual (AI 3:2).',
    zh: '目录/横版产品图 — 干净视觉（AI 3:2）。',
    ja: 'カタログ/横商品写真 — クリーンなビジュアル（AI 3:2）。',
    ko: '카탈로그/가로 제품 사진 — 깔끔한 비주얼 (AI 3:2).',
  },
  pinterest_poster_2_3: {
    vi: 'Pinterest / poster dọc — hook visual, text tối thiểu (AI 2:3).',
    en: 'Pinterest / vertical poster — visual hook, minimal text (AI 2:3).',
    zh: 'Pinterest/竖版海报 — 视觉钩子、少文字（AI 2:3）。',
    ja: 'Pinterest/縦ポスター — ビジュアルフック、最小文字（AI 2:3）。',
    ko: 'Pinterest/세로 포스터 — 비주얼 훅, 최소 텍스트 (AI 2:3).',
  },
  catalog_near_square_5_4: {
    vi: 'Catalog gần vuông — sản phẩm + giá nổi bật (AI 5:4).',
    en: 'Near-square catalog — product + price emphasis (AI 5:4).',
    zh: '近方形目录 — 产品+价格突出（AI 5:4）。',
    ja: 'やや正方形カタログ — 商品＋価格強調（AI 5:4）。',
    ko: '거의 정사각 카탈로그 — 제품+가격 강조 (AI 5:4).',
  },
  ooh_vertical_1_4: {
    vi: 'OOH / màn dọc cực cao — chữ lớn, logo rõ (AI 1:4).',
    en: 'OOH / ultra-tall portrait screen — large type, clear logo (AI 1:4).',
    zh: '户外/超高竖屏 — 大字、Logo 清晰（AI 1:4）。',
    ja: 'OOH/超縦型ディスプレイ — 大文字、ロゴ明確（AI 1:4）。',
    ko: 'OOH/초세로 화면 — 큰 글자, 로고 명확 (AI 1:4).',
  },
  ooh_strip_8_1: {
    vi: 'LED / sự kiện — banner ngang cực rộng, ít chữ (AI 8:1).',
    en: 'LED / events — ultra-wide strip, minimal copy (AI 8:1).',
    zh: 'LED/活动 — 超宽横条、少文字（AI 8:1）。',
    ja: 'LED/イベント — 超横長ストリップ、文字最小（AI 8:1）。',
    ko: 'LED/이벤트 — 초와이드 띠, 최소 문구 (AI 8:1).',
  },
}

export function getBannerAdPlatformHint(presetId: BannerAdPresetId, locale: WebLocale): string {
  const id = normalizeBannerAdPresetId(presetId) as ActiveBannerPresetId
  return PLATFORM_HINTS[id]?.[locale] ?? PLATFORM_HINTS.horizontal_display_ads[locale]
}

export const DEFAULT_BANNER_AD_PRESET_ID: BannerAdPresetId = 'horizontal_display_ads'

/** Tối đa số tỷ lệ banner tạo trong một lần bấm. */
export const MAX_BANNER_BATCH_PRESETS = 4

/** @deprecated */
export const BANNER_GENERIC_RATIO_PRESETS: Array<{
  aspectRatio: BannerAspectRatio
  labels: Record<WebLocale, string>
}> = []
