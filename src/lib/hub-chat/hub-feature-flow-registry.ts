import { buildHubToolCatalog } from '@/lib/hub-chat/hub-chat-catalog'
import { hubStudioLaunchHref } from '@/lib/hub-chat/hub-studio-launch'
import { STUDIO_PRESETS, matchStudioPresetWithScore, presetTitle } from '@/lib/hub-chat/hub-studio-presets'
import type { ToolKey } from '@/lib/i18n/dictionaries'
import type { WebLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'

/** Standalone tool pages superseded by inline Hub Studio presets — hide from studio catalog & routing. */
export const STANDALONE_REPLACED_BY_STUDIO: Record<string, string> = {
  '/tao-banner': 'sale_banner',
}

export function isStandaloneReplacedByStudio(href: string): boolean {
  return Object.prototype.hasOwnProperty.call(STANDALONE_REPLACED_BY_STUDIO, href)
}

export type HubFeatureFlowKind = 'studio' | 'standalone'

export type HubFeatureFlowMatch =
  | {
      kind: 'studio'
      presetId: string
      score: number
    }
  | {
      kind: 'standalone'
      href: string
      labelKey: ToolKey
      label: string
      score: number
    }

/** Standalone tool pages not listed in NAV_GROUPS but available in advisory. */
export const HUB_ADVISORY_EXTRA_TOOLS: {
  href: string
  labelKey: ToolKey
  intents: string[]
}[] = [
  {
    href: '/thiet-ke-bao-bi',
    labelKey: 'design_package',
    intents: ['thiết kế bao bì', 'design packaging', 'hộp giấy', 'box packaging'],
  },
  {
    href: '/thiet-ke-tui-dung',
    labelKey: 'design_package',
    intents: ['túi đựng', 'túi giấy', 'paper bag', 'shopping bag design'],
  },
  {
    href: '/tao-video-tu-anh',
    labelKey: 'text_to_image',
    intents: ['tạo video từ ảnh', 'video from image', 'ảnh thành video'],
  },
  {
    href: '/flow-nhac-video-veo',
    labelKey: 'lyria3_instrumental_song',
    intents: ['video veo', 'nhạc video', 'music video veo', 'veo flow'],
  },
  {
    href: '/hoc-bai-hoc-co-san',
    labelKey: 'ai_language_learning',
    intents: ['bài học có sẵn', 'preset lesson', 'completed lesson'],
  },
  {
    href: '/mockup-cylinder-wrap',
    labelKey: 'design_package',
    intents: ['mockup trụ', 'cylinder wrap', 'bao trụ'],
  },
  {
    href: '/thu-do-online',
    labelKey: 'try_on',
    intents: ['thử đồ online', 'virtual try on', 'thu do online'],
  },
]

const STANDALONE_EXTRA_INTENTS: Partial<Record<string, string[]>> = {
  '/phuc-dung-anh': ['phục hồi ảnh', 'restore photo', 'old photo restore'],
  '/lam-net-anh': ['làm nét', 'sharpen', 'enhance sharpness'],
  '/lam-dep-anh': ['làm đẹp ảnh', 'beautify', 'retouch'],
  '/ghep-anh': ['ghép ảnh', 'merge photo', 'combine images'],
  '/xoa-vat-the': ['xóa vật thể', 'remove object'],
  '/xoa-nen-png': ['xóa nền', 'remove background', 'png transparent'],
  '/thay-nen-san-pham': ['thay nền sản phẩm', 'product background', 'white background product'],
  '/sua-anh-theo-yeu-cau': ['sửa ảnh', 'edit image', 'photo edit ai'],
  '/mo-rong-khung-hinh': ['mở rộng khung', 'outpaint', 'expand image'],
  '/hoan-doi-khuon-mat': ['hoán đổi mặt', 'face swap'],
  '/tao-anh-tu-chu': ['text to image', 'ảnh từ chữ', 'prompt to image'],
  '/du-anh-tu-phac-thao': ['phác thảo', 'sketch to image'],
  '/tao-anh-the': ['ảnh thẻ', 'id photo', 'passport photo'],
  '/thiet-ke-logo': ['logo', 'thiết kế logo', 'design logo'],
  '/tao-nhan-gian': ['sticker', 'nhãn dán', 'decal'],
  '/tao-nhan-gioi-thieu-san-pham': ['nhãn sản phẩm', 'product label'],
  '/tao-tem-niem-phong-bao-hanh': ['tem niêm phong', 'seal sticker', 'warranty seal'],
  '/thiet-ke-con-dau': ['con dấu', 'stamp design', 'company stamp'],
  '/tao-ma-vach': ['mã vạch', 'barcode', 'qr code label'],
  '/che-anh': ['chế ảnh', 'meme'],
  '/tao-anh-3d': ['ảnh 3d', 'product 3d'],
  '/tao-mo-hinh-3d-tu-anh': ['mô hình 3d', '3d model from image'],
  '/thiet-ke-noi-ngoai-that': ['nội thất', 'interior design'],
  '/xay-nha-tu-dat-nen': ['xây nhà', 'my house', 'home design plot'],
  '/tao-anh-chain-dung': ['ảnh chân dung', 'portrait photo'],
  '/tao-giao-trinh': [
    'tạo giáo trình',
    'tao giao trinh',
    'tạo giáo trình mới',
    'giáo trình',
    'curriculum',
    'lesson plan',
  ],
  '/giao-trinh': ['mở giáo trình', 'mo giao trinh', 'xem giáo trình', 'giáo trình của tôi', 'my curricula'],
  '/tao-bai-thi': ['bài thi', 'online exam', 'quiz'],
  '/tao-bai-tap-ve-nha': ['bài tập về nhà', 'homework'],
  '/lop': ['lớp học', 'classroom'],
  '/hoc-tieng-anh-ai': ['học tiếng anh', 'english coach', 'language learning'],
  '/ghi-am-bao-cao-cuoc-hop': ['ghi âm cuộc họp', 'meeting report'],
  '/dich-anh-tai-lieu': ['dịch ảnh', 'translate document image'],
  '/tao-bai-hat-lyria-3': ['tạo nhạc', 'lyria', 'jingle', 'advertising music'],
  '/thu-do-online/1-nguoi': ['thử đồ 1 người', 'try on single'],
  '/thu-do-online/2-nguoi': ['thử đồ 2 người', 'try on couple'],
  '/thu-do-online/3-nguoi': ['thử đồ 3 người'],
  '/thu-do-online/4-nguoi': ['thử đồ 4 người'],
  '/thu-do-online/5-nguoi': ['thử đồ 5 người'],
  [hubStudioLaunchHref('packaging_kit')]: ['bao bì', 'packaging', 'hộp sản phẩm', 'design package'],
}

type StandaloneFeatureEntry = {
  href: string
  labelKey: ToolKey
  label: string
  intents: string[]
  flowKind: 'standalone'
}

function slugIntents(href: string): string[] {
  const path = href.replace(/^\/?\?/, '').replace(/^\//, '')
  if (!path) return []
  if (path.startsWith('hubStudio=')) return [path.replace('hubStudio=', '').replace(/_/g, ' ')]
  return path.split('/').filter(Boolean).join(' ').replace(/-/g, ' ').split(' ').filter((p) => p.length > 2)
}

export function buildStandaloneFeatureEntries(locale: WebLocale): StandaloneFeatureEntry[] {
  const t = getDictionary(locale)
  const catalog = buildHubToolCatalog(t.tool, t.navGroup)
  const byHref = new Map<string, StandaloneFeatureEntry>()

  for (const row of catalog) {
    if (isStandaloneReplacedByStudio(row.href)) continue
    byHref.set(row.href, {
      href: row.href,
      labelKey: row.labelKey,
      label: row.label,
      intents: [
        row.label.toLowerCase(),
        row.labelKey.replace(/_/g, ' '),
        ...slugIntents(row.href),
        ...(STANDALONE_EXTRA_INTENTS[row.href] ?? []),
      ],
      flowKind: 'standalone',
    })
  }

  for (const extra of HUB_ADVISORY_EXTRA_TOOLS) {
    if (byHref.has(extra.href)) continue
    byHref.set(extra.href, {
      href: extra.href,
      labelKey: extra.labelKey,
      label: t.tool[extra.labelKey] ?? extra.labelKey,
      intents: [
        ...(t.tool[extra.labelKey] ? [t.tool[extra.labelKey].toLowerCase()] : []),
        ...extra.intents,
        ...slugIntents(extra.href),
        ...(STANDALONE_EXTRA_INTENTS[extra.href] ?? []),
      ],
      flowKind: 'standalone',
    })
  }

  return [...byHref.values()]
}

export function getStandaloneFeatureByHref(
  locale: WebLocale,
  href: string
): StandaloneFeatureEntry | undefined {
  return buildStandaloneFeatureEntries(locale).find((e) => e.href === href)
}

const MIN_STUDIO_MATCH_SCORE = 10
const MIN_STANDALONE_MATCH_SCORE = 8

const CREATE_VERBS = /(?:^|\s)(?:tạo|tao|làm|lam|create|make|新建|创建|作成|만들)(?:\s|$)/i
const OPEN_VERBS = /(?:^|\s)(?:mở|mo|xem|open|view|vào|打开|開く|열)(?:\s|$)/i

const STANDALONE_VERB_HINTS: Partial<
  Record<string, { create?: boolean; open?: boolean }>
> = {
  '/tao-giao-trinh': { create: true },
  '/giao-trinh': { open: true },
  '/tao-bai-thi': { create: true },
  '/tao-bai-tap-ve-nha': { create: true },
}

/** Teaching / curriculum topics — standalone «Tạo giáo trình» must match one of these (not bare «tạo …»). */
const CURRICULUM_TOPIC_MARKERS =
  /giáo trình|giao trinh|giảng dạy|giang day|dạy học|day hoc|bài giảng|bai giang|lesson plan|curriculum|sgk|sách giáo khoa|sach giao khoa|môn học|mon hoc|tiết học|tiet hoc|phiếu bài tập|phieu bai tap|bài tập về nhà|bai tap ve nha|lớp học|lop hoc|worksheet|slide bài|slide bai/i

function scoreStandaloneMatch(message: string, entry: StandaloneFeatureEntry): number {
  const lower = message.toLowerCase().trim()
  let score = 0
  for (const intent of entry.intents) {
    const token = intent.toLowerCase().trim()
    if (!token) continue
    if (lower === token) score += token.length * 2
    else if (lower.includes(token)) score += token.length
  }

  if (entry.href === '/tao-giao-trinh' && !CURRICULUM_TOPIC_MARKERS.test(lower)) {
    return 0
  }

  const hints = STANDALONE_VERB_HINTS[entry.href]
  // Verb boost only when message already matches feature intents — avoid «tạo banner» → giáo trình.
  if (hints?.create && CREATE_VERBS.test(message) && score > 0) score += 24
  if (hints?.open && OPEN_VERBS.test(message) && score > 0) score += 24
  if (hints?.open && CREATE_VERBS.test(message) && !OPEN_VERBS.test(message)) score -= 20
  if (hints?.create && OPEN_VERBS.test(message) && !CREATE_VERBS.test(message)) score -= 12

  return Math.max(0, score)
}

/** Prefer complete studio preset; otherwise match standalone tool page. */
export function matchFeatureFlowByMessage(
  message: string,
  locale: WebLocale
): HubFeatureFlowMatch | null {
  const trimmed = message.trim()
  if (!trimmed) return null

  const studio = matchStudioPresetWithScore(trimmed)
  let bestStandalone: { entry: StandaloneFeatureEntry; score: number } | null = null
  for (const entry of buildStandaloneFeatureEntries(locale)) {
    const score = scoreStandaloneMatch(trimmed, entry)
    if (score > 0 && (!bestStandalone || score > bestStandalone.score)) {
      bestStandalone = { entry, score }
    }
  }

  const studioScore = studio?.score ?? 0
  const standaloneScore = bestStandalone?.score ?? 0

  if (
    bestStandalone &&
    standaloneScore >= MIN_STANDALONE_MATCH_SCORE &&
    standaloneScore >= studioScore + 4
  ) {
    return {
      kind: 'standalone',
      href: bestStandalone.entry.href,
      labelKey: bestStandalone.entry.labelKey,
      label: bestStandalone.entry.label,
      score: standaloneScore,
    }
  }

  if (studio && studioScore >= MIN_STUDIO_MATCH_SCORE) {
    return { kind: 'studio', presetId: studio.preset.id, score: studioScore }
  }

  if (bestStandalone && standaloneScore >= MIN_STANDALONE_MATCH_SCORE) {
    return {
      kind: 'standalone',
      href: bestStandalone.entry.href,
      labelKey: bestStandalone.entry.labelKey,
      label: bestStandalone.entry.label,
      score: standaloneScore,
    }
  }

  return null
}

export function buildFeatureFlowCatalogForBrain(locale: WebLocale): string {
  const studioLines = STUDIO_PRESETS.map((p) => {
    const title = presetTitle(locale, p.id)
    return `${p.id}: ${title} | flow=studio_complete`
  })
  const standaloneLines = buildStandaloneFeatureEntries(locale).map(
    (e) => `${e.href}: ${e.label} | flow=standalone_open_tool`
  )
  return [...studioLines, ...standaloneLines].join('\n')
}

export function workflowRequiresOpenConfirm(href: string, locale: WebLocale): boolean {
  const entry = getStandaloneFeatureByHref(locale, href)
  return Boolean(entry)
}

export function buildStandaloneWorkflowSuggestion(
  match: Extract<HubFeatureFlowMatch, { kind: 'standalone' }>,
  message: string
): {
  href: string
  labelKey: string
  label: string
  reason: string
  prefillPrompt: string
  confidence: number
  flowKind: 'standalone'
  requiresOpenConfirm: true
} {
  return {
    href: match.href,
    labelKey: match.labelKey,
    label: match.label,
    reason: match.label,
    prefillPrompt: message.trim(),
    confidence: Math.min(1, match.score / 40),
    flowKind: 'standalone',
    requiresOpenConfirm: true,
  }
}
