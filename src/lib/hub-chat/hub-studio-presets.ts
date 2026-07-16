import type { WebLocale } from '@/lib/i18n/config'
import { getStudioPresetCopy } from '@/lib/i18n/studio-preset-copy'
import type { HubStudioProcessStep } from '@/lib/hub-chat/hub-studio-types'
import {
  getFlowStep,
  getFlowSteps,
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
      'bán hàng',
      'ecommerce app',
      '购物app',
      'モバイルアプリ',
      '모바일 앱',
    ],
  },
  {
    id: 'sale_banner',
    labelKey: 'sale_banner',
    intents: [
      'banner sale',
      'banner khuyến mãi',
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
      'landing page',
      'trang đích',
      'website giới thiệu',
      'saas landing',
      '落地页',
      'ランディング',
      '랜딩 페이지',
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
    id: 'wedding_invite',
    labelKey: 'wedding_invite',
    intents: [
      'thiệp cưới',
      'thiệp mời',
      'wedding invitation',
      'sinh nhật',
      'event invite',
      '婚礼请柬',
      '招待状',
      '청첩장',
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

export function matchStudioPreset(message: string): StudioPresetDef | null {
  const lower = message.toLowerCase()
  let best: { preset: StudioPresetDef; score: number } | null = null
  for (const preset of STUDIO_PRESETS) {
    let score = 0
    for (const intent of preset.intents) {
      if (lower.includes(intent.toLowerCase())) score += intent.length
    }
    if (score > 0 && (!best || score > best.score)) best = { preset, score }
  }
  return best?.preset ?? null
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
    else if (s.generator === 'dieline_pdf' || s.generator === 'barcode') continue
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
  primaryLogoApproved,
  hasPrimaryLogoReference,
  orderedReferenceUrls,
} from '@/lib/hub-chat/hub-studio-preset-flows'
