import type { WebLocale } from '@/lib/i18n/config'
import { getStudioPresetCopy } from '@/lib/i18n/studio-preset-copy'
import type { HubStudioProcessStep } from '@/lib/hub-chat/hub-studio-types'
import {
  getFlowStep,
  getFlowSteps,
  hasSaleBannerDiscoveryBrief,
  type StudioFlowStepDef,
} from '@/lib/hub-chat/hub-studio-preset-flows'

export type StudioGeneratorKind =
  | 'ui_mockup'
  | 'ui_desktop'
  | 'banner'
  | 'logo'
  | 'product_photo'
  | 'invitation'
  | 'lyria_music'
  | 'packaging'
  | 'packaging_face'
  | 'packaging_mockup'
  | 'dieline_pdf'
  | 'barcode'
  | 'bag_dieline_pdf'
  | 'interior'
  | 'story_panel'
  | 'infographic'
  | 'portrait'

export type StudioPresetDef = {
  id: string
  labelKey: string
  intents: string[]
  needsUpload?: boolean
  uploadHintKey?: string
}

export const STUDIO_PRESETS: StudioPresetDef[] = [
  {
    id: 'mobile_shop',
    labelKey: 'mobile_shop',
    intents: [
      'app mobile',
      'mobile app',
      'giao diện app',
      'ui app',
      'shop online',
      'app bán hàng',
      'bán hàng',
      'ecommerce app',
      '购物app',
      'モバイルアプリ',
      'モバイルアプリ ui',
      '모바일 앱',
    ],
  },
  {
    id: 'sale_banner',
    labelKey: 'sale_banner',
    needsUpload: false,
    intents: [
      'banner sale',
      'banner khuyến mãi',
      'banner quảng cáo',
      'tạo banner',
      'baner quảng cáo',
      'baner quang cao',
      'tạo baner',
      'tao baner',
      'quảng cáo google',
      'quang cao google',
      'banner google',
      'baner google',
      'quảng cáo',
      'poster sale',
      'khai trương',
      'google ads',
      'facebook ads',
      '促销横幅',
      'セールバナー',
      '세일 배너',
    ],
  },
  {
    id: 'brand_kit',
    labelKey: 'brand_kit',
    intents: [
      'bộ thương hiệu',
      'brand kit',
      'logo và banner',
      'nhận diện thương hiệu',
      '品牌套件',
      'ブランドキット',
      '브랜드 키트',
    ],
  },
  {
    id: 'landing_page',
    labelKey: 'landing_page',
    intents: [
      'landing page mockup',
      'landing segment',
      'mockup landing',
      'thiết kế ảnh landing',
      'ảnh phân đoạn landing',
      'trang đích mockup',
      'website giới thiệu',
      'giao diện web mockup',
      'saas landing mockup',
      '落地页 mockup',
      'ランディング mockup',
      '랜딩 mockup',
    ],
  },
  {
    id: 'product_listing',
    labelKey: 'product_listing',
    needsUpload: true,
    uploadHintKey: 'product_listing',
    intents: [
      'ảnh sản phẩm',
      'sản phẩm shopee',
      'đăng bán',
      'product photo',
      'white background',
      '产品图',
      '商品画像',
      '상품 사진',
    ],
  },
  {
    id: 'ad_music',
    labelKey: 'ad_music',
    intents: [
      'nhạc quảng cáo',
      'jingle',
      'nhạc nền',
      'advertising music',
      'lyria',
      '广告音乐',
      'ジングル',
      '광고 음악',
    ],
  },
  {
    id: 'lookbook',
    labelKey: 'lookbook',
    needsUpload: true,
    uploadHintKey: 'lookbook',
    intents: [
      'lookbook',
      'bộ sưu tập',
      'thời trang',
      'fashion collection',
      'catalogue',
      'ルックブック',
      '룩북',
    ],
  },
  {
    id: 'packaging_kit',
    labelKey: 'packaging_kit',
    intents: [
      'bộ đóng gói',
      'bao bì',
      'design package',
      'packaging',
      'hộp sản phẩm',
      'nhãn sản phẩm',
      'tem niêm phong',
      '包装设计',
      'パッケージ',
      '패키징',
    ],
  },
  {
    id: 'interior_design',
    labelKey: 'interior_design',
    needsUpload: true,
    uploadHintKey: 'interior_design',
    intents: [
      'nội thất',
      'ngoại thất',
      'interior design',
      'my house',
      'xây nhà',
      'phòng khách',
      '室内设计',
      'インテリア',
      '인테리어',
    ],
  },
  {
    id: 'social_media_kit',
    labelKey: 'social_media_kit',
    intents: [
      'social media kit',
      'bộ social',
      'content shop',
      'post instagram',
      'facebook cover',
      'pinterest',
      '社交媒体',
      'SNSキット',
      'SNS 키트',
    ],
  },
  {
    id: 'story_with_images',
    labelKey: 'story_with_images',
    intents: [
      'kể chuyện bằng hình',
      'story with images',
      'truyện tranh',
      'children book',
      'picture book',
      '绘本',
      '絵本',
      '그림책',
    ],
  },
  {
    id: 'infographic_series',
    labelKey: 'infographic_series',
    needsUpload: true,
    uploadHintKey: 'infographic_series',
    intents: [
      'infographic',
      'infographic series',
      'slide tóm tắt',
      'tóm tắt sách',
      '信息图',
      'インフォグラフィック',
      '인포그래픽',
    ],
  },
  {
    id: 'fashion_campaign',
    labelKey: 'fashion_campaign',
    needsUpload: true,
    uploadHintKey: 'fashion_campaign',
    intents: [
      'campaign thời trang',
      'fashion campaign',
      'thử đồ campaign',
      'try on lookbook',
      'outfit campaign',
      '时尚 campaign',
      'ファッションキャンペーン',
      '패션 캠페인',
    ],
  },
  {
    id: 'profile_photo_pack',
    labelKey: 'profile_photo_pack',
    needsUpload: true,
    uploadHintKey: 'profile_photo_pack',
    intents: [
      'bộ ảnh thẻ',
      'ảnh thẻ profile',
      'linkedin photo',
      'professional headshot',
      '证件照',
      '証明写真',
      '증명사진',
    ],
  },
  {
    id: 'bag_kit',
    labelKey: 'bag_kit',
    intents: [
      'túi đựng',
      'tui dung',
      'túi giấy',
      'tui giay',
      'paper bag',
      'shopping bag',
      'shopping bag design',
      'thiết kế túi',
      'thiet ke tui',
      'flat bag',
      'gusset bag',
      '纸袋',
      '购物袋',
      '紙袋',
      'ショッピングバッグ',
      '종이백',
      '쇼핑백',
    ],
  },
  {
    id: 'food_menu',
    labelKey: 'food_menu',
    needsUpload: false,
    intents: [
      'thiết kế menu',
      'thiet ke menu',
      'menu quán ăn',
      'menu quan an',
      'menu quán nước',
      'menu quan nuoc',
      'thực đơn',
      'thuc don',
      'thiết kế thực đơn',
      'thiet ke thuc don',
      'menu nhà hàng',
      'menu nha hang',
      'menu cafe',
      'menu cà phê',
      'restaurant menu',
      'cafe menu',
      'food menu',
      'drink menu',
      '菜单设计',
      '餐厅菜单',
      'メニューデザイン',
      'レストランメニュー',
      '메뉴 디자인',
      '식당 메뉴',
    ],
  },
  {
    id: 'design_recreate',
    labelKey: 'design_recreate',
    needsUpload: true,
    uploadHintKey: 'design_recreate',
    intents: [
      'tạo lại bản thiết kế',
      'tao lai ban thiet ke',
      'tạo lại thiết kế',
      'tao lai thiet ke',
      'dựng lại bản thiết kế',
      'dung lai ban thiet ke',
      'dựng lại thiết kế',
      'dung lai thiet ke',
      'làm lại bản thiết kế',
      'lam lai ban thiet ke',
      'làm lại thiết kế',
      'lam lai thiet ke',
      'thiết kế lại',
      'thiet ke lai',
      'làm giống mẫu',
      'lam giong mau',
      'recreate design',
      'redesign from sample',
      'thiết kế theo mẫu',
      'thiet ke theo mau',
      'concept sheet từ ảnh',
      'concept sheet tu anh',
      'bảng concept thiết kế',
      'bang concept thiet ke',
      'fashion concept board',
      'design from sample',
      'mẫu sản phẩm thiết kế',
      '设计还原',
      '重新设计',
      '概念板',
      'デザイン再現',
      'デザインやり直',
      '디자인 재현',
      '다시 디자인',
    ],
  },
]

type PresetCopy = {
  title: string
  kickoff: string
  uploadHint?: string
  steps: Record<string, string>
  asks: Record<string, string>
}

function presetCopy(locale: WebLocale, presetId: string): PresetCopy | null {
  const map = getStudioPresetCopy(locale) as Record<string, PresetCopy>
  const row = map[presetId]
  if (!row?.kickoff || !row.steps || !row.asks) return null
  return row
}

export function getStudioPreset(id: string): StudioPresetDef | undefined {
  return STUDIO_PRESETS.find((p) => p.id === id)
}

function foldHubIntentText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * "tạo lại / dựng lại / làm lại … thiết kế" (có cả "lại" + "thiết kế") → design_recreate.
 * Ví dụ: "tạo lại bản thiết kế", "dựng lại thiết kế", "thiết kế lại từ mẫu".
 */
export function matchesDesignRecreateAgainIntent(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed) return false
  const folded = foldHubIntentText(trimmed)
  const hasDesignWord =
    folded.includes('thiet ke') ||
    folded.includes('ban thiet ke') ||
    /\bdesign\b/.test(folded) ||
    folded.includes('concept sheet') ||
    folded.includes('concept board')
  if (!hasDesignWord) return false

  const hasAgainWord =
    /(^|[^a-z])lai([^a-z]|$)/.test(folded) ||
    /\b(recreate|redesign|remake|rebuild)\b/.test(folded) ||
    folded.includes('dung lai') ||
    folded.includes('tao lai') ||
    folded.includes('lam lai') ||
    folded.includes('thiet ke lai')

  return hasAgainWord
}

export function scoreStudioPresetMatch(message: string, preset: StudioPresetDef): number {
  const lower = message.toLowerCase()
  let score = 0
  for (const intent of preset.intents) {
    if (lower.includes(intent.toLowerCase())) score += intent.length
  }
  if (preset.id === 'design_recreate' && matchesDesignRecreateAgainIntent(message)) {
    // Strong enough to win over weak standalone / other studio keyword hits.
    score = Math.max(score, 48)
  }
  return score
}

export function matchStudioPresetWithScore(
  message: string
): { preset: StudioPresetDef; score: number } | null {
  let best: { preset: StudioPresetDef; score: number } | null = null
  for (const preset of STUDIO_PRESETS) {
    const score = scoreStudioPresetMatch(message, preset)
    if (score > 0 && (!best || score > best.score)) {
      best = { preset, score }
    }
  }
  return best
}

export function matchStudioPreset(message: string): StudioPresetDef | null {
  return matchStudioPresetWithScore(message)?.preset ?? null
}

export function presetStepLabel(locale: WebLocale, presetId: string, stepKey: string): string {
  const copy = presetCopy(locale, presetId)
  return copy?.steps[stepKey] ?? stepKey
}

export function presetTitle(locale: WebLocale, presetId: string): string {
  const copy = presetCopy(locale, presetId)
  return copy?.title ?? presetId
}

export function getStepAskPrompt(locale: WebLocale, presetId: string, stepKey: string): string {
  const copy = presetCopy(locale, presetId)
  return copy?.asks[stepKey] ?? ''
}

/** Short example for the chat input placeholder — parallel to asks[stepKey]. */
export function getStepAskExample(locale: WebLocale, presetId: string, stepKey: string): string {
  const copy = presetCopy(locale, presetId) as { askExamples?: Record<string, string> } | undefined
  return copy?.askExamples?.[stepKey]?.trim() ?? ''
}

export function getPresetKickoff(locale: WebLocale, presetId: string): string {
  const copy = presetCopy(locale, presetId)
  const title = presetTitle(locale, presetId)
  const kickoff = copy?.kickoff ?? ''
  const flowSteps = getFlowSteps(presetId)
  const stepList = flowSteps
    .map((s, i) => `${i + 1}. ${presetStepLabel(locale, presetId, s.labelKey)}`)
    .join('\n')
  return `${kickoff}\n\n**${title}** — ${flowSteps.length} steps:\n${stepList}`
}

export function buildStepsFromPreset(locale: WebLocale, presetId: string): HubStudioProcessStep[] {
  const flow = getFlowSteps(presetId)
  return flow.map((s, i) => ({
    key: s.key,
    label: presetStepLabel(locale, presetId, s.labelKey),
    status: i === 0 ? 'in_progress' : 'pending',
  }))
}

export function getStepGenerator(presetId: string | null, stepKey: string): StudioGeneratorKind | null {
  if (!presetId) return 'ui_mockup'
  const step = getFlowStep(presetId, stepKey)
  if (!step || step.phase === 'discovery') return null
  return step.generator ?? 'ui_mockup'
}

export function getStepAspectRatio(presetId: string, stepKey: string): string | undefined {
  return getFlowStep(presetId, stepKey)?.aspectRatio
}

export function getStepFormFactor(presetId: string, stepKey: string): StudioFlowStepDef['formFactor'] {
  return getFlowStep(presetId, stepKey)?.formFactor
}

export function estimatePresetCredits(presetId: string): { images: number; music: number; total: number } {
  let images = 0
  let music = 0
  for (const s of getFlowSteps(presetId)) {
    if (s.phase !== 'design') continue
    if (s.generator === 'lyria_music') music += 3
    else if (s.generator === 'dieline_pdf' || s.generator === 'barcode' || s.generator === 'bag_dieline_pdf') continue
    else if (s.generator) images += 1.5
  }
  return { images, music, total: images + music }
}

export {
  isDiscoveryStep,
  allDiscoveryDone,
  getFlowSteps,
  getFlowStep,
  getPrimaryLogoStepKey,
  isLogoDesignStep,
  isStepAfterPrimaryLogo,
  briefNotesForStepGeneration,
  primaryLogoApproved,
  hasPrimaryLogoReference,
  orderedReferenceUrls,
} from '@/lib/hub-chat/hub-studio-preset-flows'
