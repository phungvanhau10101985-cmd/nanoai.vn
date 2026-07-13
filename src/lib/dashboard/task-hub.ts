import { AI_TOOLS } from '@/lib/nav-config'
import type { ToolKey } from '@/lib/i18n/dictionaries'

export type TryOnHistoryTaskRow = {
  id: string
  feature: string | null
  status: string
  batch_id: string | null
  batch_type?: string | null
  created_at: string
  error_message?: string | null
}

export function tryOnFeatureToToolKey(feature: string | null | undefined): ToolKey {
  const f = (feature || '').trim()
  switch (f) {
    case 'translate':
      return 'translate_document_image'
    case 'phuc-dung-anh':
      return 'restore_image'
    case 'sharpen':
      return 'enhance_image'
    case 'lam-dep-anh':
      return 'beautify_image'
    case 'merge':
      return 'merge_image'
    case 'tao-banner':
      return 'create_banner'
    case 'tao-anh-the':
      return 'create_id_photo'
    case 'che-anh':
      return 'meme_maker'
    case 'eraser':
      return 'remove_object'
    case 'xoa-nen-png':
      return 'remove_bg_png'
    case 'product_background':
      return 'replace_product_bg'
    case 'sua-anh-theo-yeu-cau':
      return 'edit_image_by_request'
    case 'tao-anh-3d':
      return 'product_3d_sample'
    case 'tao-mo-hinh-3d-tu-anh':
      return 'model_3d_from_image'
    case 'thiet-ke-noi-ngoai-that':
    case 'thiet-ke-noi-ngoai-that-process':
      return 'interior_exterior'
    case 'headshot':
      return 'portrait_photo'
    case 'outpaint':
      return 'expand_frame'
    case 'hoan-doi-khuon-mat':
      return 'face_swap'
    case 'veo-music-video-8s':
    case 'tao-video-veo-music-8s':
    case 'veo-music-video-merged':
      return 'flow_music_veo_video'
    case 'veo-video-extended':
    case 'tao-video-veo-extend':
      return 'create_video_from_image'
    case 'tao-infographic-tu-sach':
      return 'infographic_from_book'
    case 'du-anh-tu-phac-thao':
      return 'sketch_to_image'
    case 'tao-anh-tu-chu':
      return 'text_to_image'
    case 'thiet-ke-con-dau':
      return 'design_stamp'
    case 'thiet-ke-logo':
      return 'design_logo'
    case 'thiet-ke-bao-bi':
      return 'design_package'
    case 'sticker':
    case 'tao-nhan-gian':
      return 'create_sticker'
    case 'tao-nhan-gioi-thieu-san-pham':
    case 'tao-nhan-gioi-thieu-san-pham-mockup':
      return 'create_product_label'
    case 'tao-tem-niem-phong-bao-hanh':
      return 'create_seal_warranty_label'
    case 'tao-banner':
      return 'create_banner'
    case 'xoa-nen-png':
      return 'remove_bg_png'
    case 'lam-dep-anh':
      return 'beautify_image'
    case 'story':
      return 'story_with_images'
    case 'curriculum-slide-deepseek-verify':
      return 'create_curriculum'
    case 'try_on':
    default:
      return 'try_on'
  }
}

/** Công cụ đã ẩn khỏi menu nhưng vẫn cần href từ trung tâm tác vụ / lịch sử. */
const TOOL_KEY_HREF_OVERRIDES: Partial<Record<ToolKey, string>> = {
  create_video_from_image: '/tao-video-tu-anh',
  flow_music_veo_video: '/flow-nhac-video-veo',
}

export function toolKeyToHref(key: ToolKey): string {
  const override = TOOL_KEY_HREF_OVERRIDES[key]
  if (override) return override
  const hit = AI_TOOLS.find((t) => t.labelKey === key)
  return hit?.href ?? '/dashboard/history'
}

export type TryOnGroupAgg = {
  key: string
  isBatch: boolean
  batchId: string | null
  feature: string | null
  rows: TryOnHistoryTaskRow[]
  maxCreatedAt: string
  counts: Record<string, number>
  anyProcessing: boolean
}

export function groupTryOnHistoryForTaskHub(rows: TryOnHistoryTaskRow[]): TryOnGroupAgg[] {
  const map = new Map<string, TryOnHistoryTaskRow[]>()
  for (const r of rows) {
    const key = r.batch_id ? `b:${r.batch_id}` : `s:${r.id}`
    const list = map.get(key)
    if (list) list.push(r)
    else map.set(key, [r])
  }
  const out: TryOnGroupAgg[] = []
  for (const [key, groupRows] of map) {
    const isBatch = key.startsWith('b:')
    const batchId = isBatch ? key.slice(2) : null
    const feature = groupRows[0]?.feature ?? null
    const maxCreated = groupRows.reduce(
      (a, r) => (r.created_at > a ? r.created_at : a),
      groupRows[0]!.created_at
    )
    const counts: Record<string, number> = {}
    for (const r of groupRows) {
      counts[r.status] = (counts[r.status] ?? 0) + 1
    }
    const anyProcessing = groupRows.some((r) => r.status === 'processing')
    out.push({
      key,
      isBatch,
      batchId,
      feature,
      rows: groupRows,
      maxCreatedAt: maxCreated,
      counts,
      anyProcessing,
    })
  }
  out.sort((a, b) => b.maxCreatedAt.localeCompare(a.maxCreatedAt))
  return out
}

export function openHrefForTryOnGroup(g: TryOnGroupAgg): string {
  if (g.feature === 'translate' && g.batchId) {
    return `/dich-anh-tai-lieu?batchId=${encodeURIComponent(g.batchId)}`
  }
  const toolKey = tryOnFeatureToToolKey(g.feature)
  return toolKeyToHref(toolKey)
}

function isTerminalStatus(status: string) {
  return status === 'completed' || status === 'failed' || status === 'cancelled'
}

export function tryOnGroupIsFullyTerminal(g: TryOnGroupAgg): boolean {
  return g.rows.every((r) => isTerminalStatus(r.status))
}

export type AggregatedStatus = 'processing' | 'completed' | 'failed' | 'cancelled' | 'mixed'

export function aggregateTryOnGroupStatus(g: TryOnGroupAgg): AggregatedStatus {
  if (g.anyProcessing) return 'processing'
  const total = g.rows.length
  const completed = g.counts.completed ?? 0
  const failed = g.counts.failed ?? 0
  const cancelled = g.counts.cancelled ?? 0
  if (completed === total) return 'completed'
  if (cancelled === total) return 'cancelled'
  if (failed === total) return 'failed'
  return 'mixed'
}

export type WorksheetJobRow = {
  id: string
  type: string
  status: string
  created_at: string
  updated_at: string
  error_message?: string | null
}

export type WorksheetTaskHubLabel =
  | 'worksheetParseSgk'
  | 'worksheetQuiz'
  | 'worksheetEssay'
  | 'worksheetUnknownType'

export function worksheetTypeToTaskHubLabel(type: string): WorksheetTaskHubLabel {
  if (type === 'parse_sgk') return 'worksheetParseSgk'
  if (type === 'step_by_step_quiz') return 'worksheetQuiz'
  if (type === 'step_by_step_essay') return 'worksheetEssay'
  return 'worksheetUnknownType'
}

export const TASK_HUB_RECENT_DAYS = 7

export function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString()
}
