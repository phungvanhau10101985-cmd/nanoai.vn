export const IMAGE_LOC_LANGUAGES = ['vi', 'en', 'th', 'id'] as const
export type ImageLocLanguage = (typeof IMAGE_LOC_LANGUAGES)[number]

export const IMAGE_LOC_GEMINI_MODES = ['local_only', 'api', 'openai'] as const
export type ImageLocGeminiMode = (typeof IMAGE_LOC_GEMINI_MODES)[number]

export const IMAGE_LOC_JOB_STATUSES = ['queued', 'running', 'done', 'error', 'cancelled'] as const
export type ImageLocJobStatus = (typeof IMAGE_LOC_JOB_STATUSES)[number]

export const IMAGE_LOC_PRODUCT_STATUSES = ['pending', 'processing', 'localized', 'failed', 'skipped'] as const
export type ImageLocProductStatus = (typeof IMAGE_LOC_PRODUCT_STATUSES)[number]

export const IMAGE_LOC_TERMINAL_JOB_STATUSES = new Set<string>(['done', 'error', 'cancelled'])
export const IMAGE_LOC_RESUMABLE_JOB_STATUSES = new Set<string>(['queued', 'running'])

export const IMAGE_LOC_GEMINI_MODEL_PRESETS = [
  { id: 'pro-image', label: 'Gemini 3 Pro Image', model: 'gemini-3-pro-image-preview' },
  { id: 'flash-image', label: 'Gemini 2.0 Flash Image', model: 'gemini-2.0-flash-preview-image-generation' },
] as const

export const IMAGE_LOC_OPENAI_MODEL_PRESETS = [
  { id: 'gpt-image-2', label: 'GPT Image 2', model: 'gpt-image-2' },
  { id: 'gpt-image-1', label: 'GPT Image 1', model: 'gpt-image-1' },
] as const

export const IMAGE_LOC_OPENAI_OUTPUT_PRESETS = [
  { id: '', label: 'Theo backend (.env)', quality: '', size: '' },
  { id: 'high-auto', label: 'High · auto', quality: 'high', size: 'auto' },
  { id: 'high-portrait', label: 'High · 1024×1792', quality: 'high', size: '1024x1792' },
  { id: 'high-landscape', label: 'High · 1792×1024', quality: 'high', size: '1792x1024' },
] as const

export type ImageLocClassifyType = 'delete' | 'keep' | 'local' | 'gemini'

export type ImageLocOcrBlock = {
  text: string
  bbox: [number, number, number, number]
}

export type ImageRef = {
  bucket: 'colors' | 'gallery' | 'detail' | 'main_image' | 'material'
  index: number | null
  url: string
}

export type ImageProcessResult = {
  original_url: string
  final_url: string | null
  status: 'processed' | 'kept' | 'deleted' | 'error'
  message: string
  detail?: Record<string, unknown>
}

export type ImageLocStartPayload = {
  language: ImageLocLanguage
  force: boolean
  dry_run: boolean
  product_ids?: string[] | null
  limit?: number | null
  gemini_mode?: 'api' | 'openai' | null
  gemini_image_model?: string | null
  gemini_image_size?: string | null
  openai_image_model?: string | null
  openai_image_quality?: string | null
  openai_image_size?: string | null
  allow_ai_image_models?: boolean | null
}

export type ImageLocSkippedReport = {
  product_id: string
  message: string
}

export type ImageLocRecentResult = {
  product_id: string
  status: string
  message: string
  processed_images?: number
  failed_images?: number
}

export type ImageLocJob = {
  job_id: string
  partner_id: string
  status: string
  phase: string | null
  message: string | null
  payload: ImageLocStartPayload | Record<string, unknown> | null
  current: number
  total: number | null
  done: number
  failed: number
  skipped: number
  percent: number | null
  current_product_id: string | null
  cancel_requested: boolean
  queue_product_ids: string[]
  processed_product_ids: string[]
  job_queue_product_ids?: string[]
  job_queue_truncated: boolean
  recent_results: ImageLocRecentResult[]
  skipped_product_reports: ImageLocSkippedReport[]
  language: string | null
  force: boolean
  dry_run: boolean
  gemini_mode: string | null
  local_image_only: boolean
  resume_count: number
  created_at: string | null
  updated_at: string | null
  started_at: string | null
  finished_at: string | null
}

export type ImageLocJobList = {
  jobs: ImageLocJob[]
  total: number
}

export type ImageLocSummary = {
  pending: number
  localized: number
  failed: number
  processing: number
  skipped: number
}

export type ImageLocAuthStatus = {
  ai_image_jobs_allowed: boolean
  default_gemini_mode: 'api' | 'openai'
  image_model: string
  gemini_api_default_image_size: string
  openai_image_model: string
  openai_default_image_quality: string
  ai_image_explicit_only: boolean
  gemini_api_image_sizes: string[]
  openai_image_qualities: string[]
  openai_image_sizes: string[]
  api: { ready: boolean; key_configured: boolean; model: string }
  openai: { ready: boolean; key_configured: boolean; model: string }
  deepseek_pricing: ImageLocDeepseekPricing
}

export type ImageLocDeepseekPricing = {
  peak_now: boolean
  off_peak_only_enabled: boolean
  off_peak_only_env_default: boolean
  seconds_until_off_peak: number
  banner_variant: 'wait' | 'peak' | null
  banner_message_vi: string | null
}

export type ImageLocProductReport = {
  product_id: string
  status: string | null
  language: string | null
  localized_at: string | null
  error: string | null
  image_localization: Record<string, unknown> | null
}

export function isTerminalImageLocalizationJobStatus(status: string | null | undefined): boolean {
  return IMAGE_LOC_TERMINAL_JOB_STATUSES.has(String(status || '').trim().toLowerCase())
}

export function imageLocalizationJobProgress(job: Pick<ImageLocJob, 'percent' | 'done' | 'failed' | 'skipped' | 'total'>): number {
  if (job.percent != null && Number.isFinite(job.percent)) return Math.max(0, Math.min(100, job.percent))
  const total = Number(job.total || 0)
  if (!total) return 0
  const completed = Number(job.done || 0) + Number(job.failed || 0) + Number(job.skipped || 0)
  return Math.max(0, Math.min(100, Math.round((1000 * completed) / total) / 10))
}
