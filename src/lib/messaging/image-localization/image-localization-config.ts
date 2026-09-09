export function imageLocAiJobsAllowed(): boolean {
  const v = (process.env.IMAGE_LOCALIZATION_AI_IMAGE_JOBS_ALLOWED || '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

export function imageLocAiExplicitOnly(): boolean {
  const v = (process.env.IMAGE_LOCALIZATION_AI_IMAGE_EXPLICIT_ONLY || '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

export function imageLocEnabled(): boolean {
  const v = (process.env.IMAGE_LOCALIZATION_ENABLED || 'true').trim().toLowerCase()
  return v !== '0' && v !== 'false' && v !== 'no' && v !== 'off'
}

export function imageLocDefaultGeminiMode(): 'api' | 'openai' {
  const m = (process.env.IMAGE_LOCALIZATION_GEMINI_MODE || 'api').trim().toLowerCase()
  return m === 'openai' ? 'openai' : 'api'
}

export function imageLocGeminiImageModel(): string {
  return (process.env.IMAGE_LOCALIZATION_GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview').trim() || 'gemini-3-pro-image-preview'
}

export function imageLocGeminiDefaultImageSize(): string {
  const s = (process.env.IMAGE_LOCALIZATION_GEMINI_API_DEFAULT_IMAGE_SIZE || '2K').trim().toUpperCase().replace(/\s+/g, '')
  return s === '4K' ? '4K' : '2K'
}

export function imageLocOpenaiImageModel(): string {
  return (process.env.IMAGE_LOCALIZATION_OPENAI_IMAGE_MODEL || 'gpt-image-2').trim() || 'gpt-image-2'
}

export function imageLocOpenaiDefaultQuality(): string {
  const q = (process.env.IMAGE_LOCALIZATION_OPENAI_DEFAULT_IMAGE_QUALITY || 'high').trim().toLowerCase()
  return q === 'auto' ? 'auto' : 'high'
}

export function imageLocMaxImagesPerProduct(): number {
  const n = Number(process.env.IMAGE_LOCALIZATION_MAX_IMAGES_PER_PRODUCT || '80')
  return Number.isFinite(n) && n > 0 ? Math.min(200, Math.floor(n)) : 80
}

export function imageLocBatchLimit(): number {
  const n = Number(process.env.IMAGE_LOCALIZATION_BATCH_LIMIT || '0')
  return Number.isFinite(n) && n > 0 ? Math.min(10000, Math.floor(n)) : 0
}

export function imageLocMaxConsecutiveProductFailures(): number {
  return 3
}

export function imageLocJobQueueIdsMax(): number {
  return 400
}

export function imageLocGeminiApiTimeoutMs(): number {
  const n = Number(process.env.IMAGE_LOCALIZATION_GEMINI_API_TIMEOUT_SEC || '300')
  return Math.max(30, Number.isFinite(n) ? n : 300) * 1000
}

export function imageLocOpenaiTimeoutMs(): number {
  const n = Number(process.env.IMAGE_LOCALIZATION_OPENAI_IMAGE_TIMEOUT_SEC || '300')
  return Math.max(60, Number.isFinite(n) ? n : 300) * 1000
}

export function imageLocJpegQuality(): number {
  const n = Number(process.env.IMAGE_LOCALIZATION_OUTPUT_JPEG_QUALITY || '95')
  if (!Number.isFinite(n)) return 95
  return Math.max(70, Math.min(100, Math.floor(n)))
}

export function imageLocMaxAutoResumeCount(): number {
  const n = Number(process.env.IMAGE_LOCALIZATION_MAX_AUTO_RESUME_COUNT || '6')
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 6
}

export function sanitizeModelId(raw: string | null | undefined, fallback: string): string {
  const s = String(raw || '').trim()
  if (!s || s.length > 120) return fallback
  if (!/^[a-zA-Z0-9_.\-]+$/.test(s)) return fallback
  return s
}

export function normalizeGeminiImageSize(raw: string | null | undefined): string | null {
  if (!raw || !String(raw).trim()) return null
  const k = String(raw).trim().toUpperCase().replace(/\s+/g, '')
  if (k === '512' || k === '0.5K' || k === '1K' || k === '2K') return '2K'
  if (k === '4K') return '4K'
  return null
}

export function normalizeOpenaiImageQuality(raw: string | null | undefined): string | null {
  const s = String(raw || '').trim().toLowerCase()
  if (!s) return null
  if (s === 'low' || s === 'medium') return 'high'
  if (s === 'high' || s === 'auto') return s
  return null
}

export function normalizeOpenaiImageSize(raw: string | null | undefined, model: string): string | null {
  const s = String(raw || '').trim().toLowerCase()
  if (!s) return null
  const allowed = new Set(['auto', '1024x1792', '1792x1024', '1536x1024', '1024x1536'])
  if (allowed.has(s)) return s
  if (model.toLowerCase().includes('gpt-image-2') && /^\d+x\d+$/.test(s)) {
    const [wp, hp] = s.split('x')
    const wi = Number(wp)
    const hi = Number(hp)
    if (wi <= 1024 && hi <= 1024) return null
    return s
  }
  return null
}

export const LANGUAGE_LABELS: Record<string, string> = {
  vi: 'Vietnamese',
  en: 'English',
  th: 'Thai',
  id: 'Indonesian',
}

export function languagePrompt(language: string): string {
  const target = LANGUAGE_LABELS[language] || language || 'Vietnamese'
  return `ROLE: E-commerce Image Localization Agent

Translate every Chinese text element in the attached product image into ${target}. Preserve product details, layout, dimensions, aspect ratio, text placement, original colors, and image quality. Remove website URLs and domains from the image. Convert Chinese weight units to metric during translation. Return only the processed image file, with no explanation.`
}

export function mimeForImageFilename(filename: string): string {
  const ext = (filename.split('.').pop() || 'jpg').toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  return 'image/jpeg'
}

export function normalizeImageUrl(url: string): string {
  const s = (url || '').trim()
  if (s.startsWith('//')) return `https:${s}`
  return s
}

export function isOwnCdnUrl(url: string): boolean {
  const n = normalizeImageUrl(url)
  try {
    const host = new URL(n).hostname.toLowerCase()
    const publicBase = (process.env.BUNNY_STORAGE_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_BUNNY_STORAGE_PUBLIC_BASE_URL || '').trim()
    if (publicBase) {
      try {
        const pubHost = new URL(publicBase).hostname.toLowerCase()
        if (host && pubHost && host === pubHost) return true
      } catch {
        /* ignore */
      }
    }
    return host.endsWith('.b-cdn.net') || host.includes('nanoai.')
  } catch {
    return false
  }
}
