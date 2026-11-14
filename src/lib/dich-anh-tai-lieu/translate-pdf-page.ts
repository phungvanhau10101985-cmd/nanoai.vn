import type { GoogleGenerativeAI } from '@google/generative-ai'
import type { GptImageQuality, ImageEngine } from '@/lib/ai/image-engine'
import { translateOneImage } from '@/lib/translate-document-image'
import type { PdfPageMeta } from '@/lib/dich-anh-tai-lieu/pdf-job-files'
import { readVisibleLines } from '@/lib/dich-anh-tai-lieu/translate-pdf-lines'

export type TranslatedPdfPage = {
  png: Buffer
  vectorPdf?: Buffer
  lines: string[]
  error?: string
}

/** Mọi trang PDF gửi ảnh cho model đã chọn vẽ lại, kể cả trang có lớp chữ. */
export async function translatePdfPageFromParts(input: {
  genAI: GoogleGenerativeAI
  userId: string
  sourceLang: string
  targetLang: string
  sourceLang2?: string | null
  imageQuality: '2K' | '4K'
  engine?: ImageEngine
  gptQuality?: GptImageQuality | null
  retryRound?: number
  logPrefix?: string
  png: Buffer
  meta: PdfPageMeta
}): Promise<TranslatedPdfPage> {
  const image = await translateOneImage(
    input.genAI,
    input.png,
    'image/png',
    input.sourceLang,
    input.targetLang,
    input.imageQuality,
    input.userId,
    input.sourceLang2,
    {
      retryRound: input.retryRound,
      logPrefix: input.logPrefix,
      engine: input.engine,
      gptQuality: input.gptQuality,
      keepTerms: input.meta.keepTerms,
      captureLines: true,
    }
  )
  if (image.error || !image.buffer.length) {
    return { png: Buffer.alloc(0), lines: [], error: image.error || 'AI không trả về ảnh.' }
  }
  let lines = image.lines ?? []
  if (lines.length === 0) {
    try {
      lines = await readVisibleLines({ genAI: input.genAI, userId: input.userId, png: image.buffer })
    } catch (error) {
      console.warn('[translatePdfPageFromParts] Không đọc được lớp chữ:', error instanceof Error ? error.message : error)
    }
  }
  return { png: image.buffer, lines }
}
