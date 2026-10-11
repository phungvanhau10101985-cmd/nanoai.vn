import { WEB_LOCALES, type WebLocale } from '@/lib/i18n/config'
import { getStudioPresetCopy } from '@/lib/i18n/studio-preset-copy'
import type { HubStudioProcessStep, HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
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
      'tạo web',
      'tao web',
      'tạo website',
      'tao website',
      'tạo giao diện web',
      'tao giao dien web',
      'giao diện web',
      'giao dien web',
      'thiết kế web',
      'thiet ke web',
      'thiết kế web app',
      'thiet ke web app',
      'thiết kế website',
      'thiet ke website',
      'web app',
      'create website',
      'design website',
      'design web app',
      'create web app',
      '购物app',
      'モバイルアプリ',
      'モバイルアプリ ui',
      '모바일 앱',
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
    id: 'packaging_kit',
    labelKey: 'packaging_kit',
    intents: [
      'bộ đóng gói',
      'bao bì',
      'design package',
      'packaging',
      'hộp sản phẩm',
      'hộp giấy',
      'thiết kế hộp giấy',
      'paper box',
      'nhãn sản phẩm',
      'tem niêm phong',
      '包装设计',
      'パッケージ',
      '패키징',
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
    id: 'catalog_photo_pack',
    labelKey: 'catalog_photo_pack',
    needsUpload: true,
    uploadHintKey: 'catalog_photo_pack',
    intents: [
      'ảnh tự chụp',
      'anh tu chup',
      'chụp nghiệp dư',
      'chup nghiep du',
      'bộ ảnh bán hàng',
      'bo anh ban',
      'đăng facebook',
      'dang facebook',
      'không có web',
      'khong co web',
      'amateur product photo',
      'sell photos from',
      '自拍照卖货',
      '自分で撮った',
      '직접 찍은 사진',
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

const RETIRED_STUDIO_PRESET_IDS = new Set([
  'lookbook',
  'social_media_kit',
  'brand_kit',
  'profile_photo_pack',
  'infographic_series',
  'fashion_campaign',
  'story_with_images',
  'sale_banner',
  'ad_music',
  'interior_design',
  'landing_page',
  'design_recreate',
])

export function isRetiredStudioPreset(presetId: string | null | undefined): boolean {
  return Boolean(presetId && RETIRED_STUDIO_PRESET_IDS.has(presetId))
}

/** Removed hub flows. Drop them from saved threads so they stop generating. */
export function detachRetiredStudioPreset(session: HubStudioSession): HubStudioSession {
  if (!isRetiredStudioPreset(session.presetId)) return session
  return {
    ...session,
    presetId: null,
    discoveryComplete: false,
    processSteps: [],
    currentStepKey: null,
    pendingPreview: null,
    lastGenerationPrompt: null,
  }
}

function foldHubIntentText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Tên tính năng khách nói: bỏ chú thích trong ngoặc và hậu tố «AI». */
export function featureNameCore(text: string): string {
  const withoutNotes = text.replace(/\([^)]*\)/g, ' ')
  return foldHubIntentText(withoutNotes).replace(/\s+ai$/g, '').trim()
}

/**
 * "tạo lại / dựng lại / làm lại … thiết kế" (có cả "lại" + "thiết kế") → design_recreate.
 * Ví dụ: "tạo lại bản thiết kế", "dựng lại thiết kế", "thiết kế lại từ mẫu".
 */
/** Explicit landing / ladipage only — generic «tạo web» must NOT match. */
export function matchesLandingPageIntent(message: string): boolean {
  const folded = foldHubIntentText(message)
  if (!folded) return false
  return (
    /\blanding(?:\s*page)?\b/.test(folded) ||
    /\blandingpage\b/.test(folded) ||
    /\bladi\s*page\b/.test(folded) ||
    /\bladipage\b/.test(folded) ||
    /\bladipge\b/.test(folded) ||
    folded.includes('trang dich') ||
    folded.includes('落地页') ||
    folded.includes('ランディング') ||
    folded.includes('랜딩')
  )
}

/**
 * Studio web-app design (`mobile_shop`): tạo web, giao diện web, thiết kế web app.
 * Loses to `matchesLandingPageIntent` when the user also names landing/ladipage.
 */
export function matchesWebAppDesignIntent(message: string): boolean {
  const folded = foldHubIntentText(message)
  if (!folded) return false
  if (matchesLandingPageIntent(message)) return false
  return (
    /(?:^|[^a-z])(?:tao|thiet ke|lam|design|create|make)\s+(?:giao dien\s+)?web(?:site| app)?(?:[^a-z]|$)/.test(
      folded
    ) ||
    folded.includes('giao dien web') ||
    folded.includes('thiet ke web') ||
    folded.includes('web app') ||
    folded.includes('studio flow tao web') ||
    folded.includes('studio tao web') ||
    /\b(?:create|design|make)\s+(?:a\s+)?(?:website|web app)\b/.test(folded) ||
    folded.includes('设计网站') ||
    folded.includes('做网站') ||
    folded.includes('网站设计') ||
    folded.includes('ウェブサイト') ||
    folded.includes('웹사이트') ||
    folded.includes('웹앱')
  )
}

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
  if (matchesLandingPageIntent(message)) return 0
  if (matchesDesignRecreateAgainIntent(message)) return 0
  const lower = message.toLowerCase()
  const messageCore = featureNameCore(message)
  let score = 0
  for (const intent of preset.intents) {
    if (lower.includes(intent.toLowerCase())) score += intent.length
    const intentCore = featureNameCore(intent)
    if (intentCore.length >= 4 && messageCore.includes(intentCore) && !lower.includes(intent.toLowerCase())) {
      score += intentCore.length
    }
  }
  for (const locale of WEB_LOCALES) {
    const titleCore = featureNameCore(presetTitle(locale, preset.id))
    if (titleCore.length < 4 || !messageCore) continue
    if (messageCore === titleCore) score += titleCore.length * 2
    else if (messageCore.includes(titleCore)) score += titleCore.length
  }
  if (preset.id === 'design_recreate' && matchesDesignRecreateAgainIntent(message)) {
    // Strong enough to win over weak standalone / other studio keyword hits.
    score = Math.max(score, 48)
  }
  if (preset.id === 'landing_page' && matchesLandingPageIntent(message)) {
    score = Math.max(score, 56)
  }
  if (preset.id === 'mobile_shop' && matchesWebAppDesignIntent(message)) {
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
