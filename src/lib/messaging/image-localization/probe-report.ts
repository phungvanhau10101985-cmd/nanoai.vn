import { resolveDeepSeekChatModel } from '@/lib/deepseek-api'
import { imageLocInkBleedModel, imageLocOpenaiImageModel } from './image-localization-config'

export const IMAGE_LOC_PROBE_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const IMAGE_LOC_PROBE_MAX_BYTES = 8 * 1024 * 1024
export const IMAGE_LOC_PROBE_STALE_MS = 20 * 60 * 1000

export function probeExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + IMAGE_LOC_PROBE_TTL_MS)
}

export function probeDaysLeft(expiresAt: string | Date, now = new Date()): number {
  const end = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime()
  if (!Number.isFinite(end)) return 0
  return Math.max(0, Math.ceil((end - now.getTime()) / (24 * 60 * 60 * 1000)))
}

export function probeModelLabel(engine: 'local' | 'ai' | 'keep' | 'delete'): string {
  if (engine === 'ai') {
    return `GPT Image ${imageLocOpenaiImageModel()} · quality medium · hậu kiểm ${imageLocInkBleedModel()} + Vision`
  }
  if (engine === 'local') {
    return `DeepSeek ${resolveDeepSeekChatModel()} · Vision OCR`
  }
  return 'Vision OCR'
}
