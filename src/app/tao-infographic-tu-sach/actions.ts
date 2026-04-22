'use server'
import { deleteTryOnHistoryRowAndStorage } from '@/lib/storage/try-on-history-cleanup'

import { getUserForCreditAction } from '@/lib/auth'
import { insertTryOnHistoryProcessingPg, updateTryOnHistoryCompletedPg } from '@/lib/db/try-on-history-pg'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import sharp from 'sharp'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import { normalizeToEnglish } from '@/lib/ai-normalize'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { MAX_BOOK_PAGE_IMAGES } from './infographic-limits'
import { uploadTryOnImagePublic, getTryOnPublicUrlFromPath } from '@/lib/storage/try-on-public-upload'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import { deductUserCredits } from '@/lib/music/deduct-user-credits'

const COST_2K = 1.5
const MAX_CONTENT_TEXT = 28000
const MAX_TEACHER_NOTES = 12000
const MAX_TOPIC_LEN = 500
const MAX_BOOK_FILES = MAX_BOOK_PAGE_IMAGES
const MAX_FILE_BYTES = 8 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const INFOGRAPHIC_TARGET_BYTES = 820 * 1024
const INFOGRAPHIC_MAX_DIMENSION = 2048

const toTenths = (value: number) => Math.round(value * 10)
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const OUTPUT_LOCALES = new Set(['vi', 'en', 'zh', 'ja', 'ko'])

const FLASH_TEXT_ONLY = `You are an assistant for educators. From the TEXT CONTENT below, output ONLY valid JSON (no markdown fences) with keys:
- "summary": string, 3–6 short bullet lines separated by newline, teaching-friendly, in the OUTPUT_LANGUAGE specified by the user.
- "mermaid": string, valid Mermaid diagram code (prefer flowchart TD or mindmap). Max ~1200 characters. No HTML. Use simple node labels.

The diagram should reflect main concepts and relationships in the material.`

const FLASH_WITH_IMAGES = `You are an assistant for educators. The user attached photos of textbook or document pages — read all visible text, headings, formulas, and diagrams.

Combine images with TEXT CONTENT and TEACHER NOTES below. Output ONLY valid JSON (no markdown fences) with keys:
- "summary": string, 3–6 short bullet lines separated by newline, teaching-friendly, in the OUTPUT_LANGUAGE specified by the user.
- "mermaid": string, valid Mermaid diagram code (prefer flowchart TD or mindmap). Max ~1200 characters. No HTML. Use simple node labels.

The mind map should reflect the merged understanding from images and text.

CRITICAL for valid JSON: escape any double quotes inside string values as \\". In mermaid, use simple node IDs like A[Label] without raw " characters inside brackets; use ASCII or apostrophe if needed.`

const IMAGE_INSTRUCTION_PREFIX = `Create ONE high-quality educational infographic image for classroom projection (16:9). Clean modern layout, readable typography, clear visual hierarchy, harmonious colors, professional look. Interpret the diagram structure conceptually—do not render raw code or syntax as text. No watermark.`

/** Tách object JSON đầu tiên có ngoặc cân bằng (tránh cắt nhầm khi mermaid có } trong chuỗi). */
function extractBalancedJsonObject(s: string): string | null {
  const start = s.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < s.length; i += 1) {
    const c = s[i]
    if (escape) {
      escape = false
      continue
    }
    if (inString) {
      if (c === '\\') {
        escape = true
        continue
      }
      if (c === '"') inString = false
      continue
    }
    if (c === '"') {
      inString = true
      continue
    }
    if (c === '{') depth += 1
    else if (c === '}') {
      depth -= 1
      if (depth === 0) return s.slice(start, i + 1)
    }
  }
  return null
}

function parseFlashJson(text: string): { summary: string; mermaid: string } {
  const trimmed = text.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const inner = (fence ? fence[1] : trimmed).trim()
  const jsonStr = extractBalancedJsonObject(inner) ?? extractBalancedJsonObject(trimmed)
  if (!jsonStr) throw new Error('invalid json')
  const parsed = JSON.parse(jsonStr) as { summary?: string; mermaid?: string }
  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : ''
  const mermaid = typeof parsed.mermaid === 'string' ? parsed.mermaid.trim() : ''
  if (!summary || !mermaid) throw new Error('Thiếu summary hoặc mermaid trong phản hồi AI.')
  if (mermaid.length > 2000) throw new Error('Mermaid quá dài.')
  return { summary, mermaid }
}

/** Giảm dung lượng ảnh gửi Flash — nhiều ảnh gốc dễ vượt giới hạn request / làm model lỗi. */
async function shrinkImageForFlash(input: Buffer, mimeHint: string): Promise<{ mimeType: string; data: string }> {
  const MAX_EDGE = 1280
  try {
    let pipeline = sharp(input).rotate()
    const meta = await pipeline.metadata()
    const w = meta.width ?? 0
    const h = meta.height ?? 0
    if (w > MAX_EDGE || h > MAX_EDGE) {
      pipeline = pipeline.resize({
        width: w >= h ? MAX_EDGE : undefined,
        height: h > w ? MAX_EDGE : undefined,
        fit: 'inside',
        withoutEnlargement: true,
      })
    }
    const buf = await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer()
    return { mimeType: 'image/jpeg', data: buf.toString('base64') }
  } catch {
    const mt = ALLOWED_MIME.has(mimeHint) ? mimeHint : 'image/jpeg'
    return { mimeType: mt, data: input.toString('base64') }
  }
}

async function compressInfographicForProjection(rawPng: Buffer): Promise<{ buffer: Buffer; ext: 'webp'; contentType: 'image/webp' }> {
  const meta = await sharp(rawPng).metadata().catch(() => null)
  const srcW = Math.max(1, Number(meta?.width || INFOGRAPHIC_MAX_DIMENSION))
  const srcH = Math.max(1, Number(meta?.height || Math.round(INFOGRAPHIC_MAX_DIMENSION * 9 / 16)))
  const resizeScales = [1, 0.92, 0.84, 0.76, 0.68]
  const qualityLevels = [84, 78, 72, 66, 60, 54]

  let best = await sharp(rawPng).webp({ quality: 84, effort: 6 }).toBuffer()

  for (const scale of resizeScales) {
    const targetW = Math.max(640, Math.min(INFOGRAPHIC_MAX_DIMENSION, Math.round(srcW * scale)))
    const targetH = Math.max(360, Math.min(INFOGRAPHIC_MAX_DIMENSION, Math.round(srcH * scale)))
    for (const q of qualityLevels) {
      const out = await sharp(rawPng)
        .rotate()
        .resize({ width: targetW, height: targetH, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: q, effort: 6, smartSubsample: true })
        .toBuffer()
      if (out.length < best.length) best = out
      if (out.length <= INFOGRAPHIC_TARGET_BYTES) {
        return { buffer: out, ext: 'webp', contentType: 'image/webp' }
      }
    }
  }

  return { buffer: best, ext: 'webp', contentType: 'image/webp' }
}

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
] as const

/** Infographic độc lập: Gemini 2.5 Flash (ảnh + chữ) → tóm tắt + Mermaid → ảnh 2K. 1,5 credit. */
export async function createInfographicFromBook(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }

  const rawTopic = ((formData.get('topic') as string) || '').trim().slice(0, MAX_TOPIC_LEN)
  let contentText = ((formData.get('contentText') as string) || '').trim().slice(0, MAX_CONTENT_TEXT)
  const teacherNotes = ((formData.get('teacherNotes') as string) || '').trim().slice(0, MAX_TEACHER_NOTES)
  const outputLocaleRaw = ((formData.get('outputLocale') as string) || 'vi').trim().toLowerCase()
  const outputLocale = OUTPUT_LOCALES.has(outputLocaleRaw)
    ? (outputLocaleRaw as 'vi' | 'en' | 'zh' | 'ja' | 'ko')
    : 'vi'

  const rawFiles = formData.getAll('bookPage').filter((x): x is File => x instanceof File && x.size > 0)
  const bookFiles = rawFiles.slice(0, MAX_BOOK_FILES)

  for (const f of bookFiles) {
    if (!f.type.startsWith('image/') || !ALLOWED_MIME.has(f.type)) {
      return { error: 'Mỗi file phải là ảnh JPEG, PNG, WebP hoặc GIF.' }
    }
    if (f.size > MAX_FILE_BYTES) {
      return { error: `Ảnh quá lớn (tối đa ${Math.round(MAX_FILE_BYTES / (1024 * 1024))}MB mỗi file).` }
    }
  }

  const hasImages = bookFiles.length > 0
  const textOk = contentText.length >= 40
  if (!textOk && !hasImages) {
    return { error: 'Cần ít nhất ~40 ký tự nội dung chữ, hoặc ít nhất một ảnh trang sách/tài liệu.' }
  }

  if (!contentText.length && hasImages) {
    contentText = '(Không có nội dung chữ — chỉ dựa vào ảnh và ghi chú.)'
  }

  const apiKey = process.env.GOOGLE_API_KEY?.trim()
  if (!apiKey) {
    return { error: 'Thiếu cấu hình GOOGLE_API_KEY.' }
  }

  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  let openBalance = 0
  try {
    openBalance = await getCreditBalanceByUserId(user.id)
  } catch {
    return { error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(openBalance) < toTenths(COST_2K)) {
    return { error: `Không đủ credits. Cần ${formatCredits(COST_2K)} credits, hiện có ${formatCredits(openBalance)}.` }
  }

  const timestamp = Date.now()
  const pendingPath = `uploads/${user.id}/book_infographic_pending_${timestamp}`
  const pendingPublicUrl = getTryOnPublicUrlFromPath(pendingPath)
  const historyItem = await insertTryOnHistoryProcessingPg({
    userId: user.id,
    originalImageUrl: pendingPublicUrl,
    garmentImageUrl: pendingPublicUrl,
    feature: 'tao-infographic-tu-sach',
  })
  if (!historyItem) return { error: 'Không thể khởi tạo phiên xử lý.' }

  const inlineParts: { inlineData: { mimeType: string; data: string } }[] = []
  try {
    for (const f of bookFiles) {
      const buf = Buffer.from(await f.arrayBuffer())
      const shrunk = await shrinkImageForFlash(buf, f.type || 'image/jpeg')
      inlineParts.push({
        inlineData: { mimeType: shrunk.mimeType, data: shrunk.data },
      })
    }
  } catch {
    await deleteTryOnHistoryRowAndStorage( historyItem.id)
    return { error: 'Không đọc được file ảnh đính kèm.' }
  }

  const flashInstruction = hasImages ? FLASH_WITH_IMAGES : FLASH_TEXT_ONLY
  const notesBlock = teacherNotes.length > 0 ? teacherNotes : '(none)'
  const flashUser = `OUTPUT_LANGUAGE code: ${outputLocale} (vi=Vietnamese, en=English, zh=Chinese, ja=Japanese, ko=Korean).

Topic / title (optional): ${rawTopic || '(none)'}

TEACHER NOTES / CONTEXT (optional):
${notesBlock}

TEXT CONTENT:
${contentText}

${hasImages ? `The ${bookFiles.length} image(s) sent before this text are document/book page photos in order.` : ''}

${flashInstruction}`

  const genAI = new GoogleGenerativeAI(apiKey)
  const flashModel = genAI.getGenerativeModel({
    ...GEMINI_25_FLASH_NO_THINKING,
    generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
  })

  let summary: string
  let mermaid: string
  try {
    let flashResult: Awaited<ReturnType<typeof flashModel.generateContent>>
    if (hasImages) {
      flashResult = await flashModel.generateContent(
        [...inlineParts, { text: flashUser }],
        { safetySettings: [...safetySettings] }
      )
    } else {
      flashResult = await flashModel.generateContent(flashUser, { safetySettings: [...safetySettings] })
    }
    const flashResponse = flashResult.response
    void trackFromUsageMetadata(flashResponse.usageMetadata, 'gemini-2.5-flash', 'tao-infographic-tu-sach', user.id, null)

    const cand = flashResponse.candidates?.[0]
    if (!cand) {
      await deleteTryOnHistoryRowAndStorage( historyItem.id)
      return { error: 'AI không trả về kết quả (hết quota hoặc lỗi mạng). Thử lại sau.' }
    }
    if (cand.finishReason === 'SAFETY') {
      await deleteTryOnHistoryRowAndStorage( historyItem.id)
      return {
        error:
          'Phản hồi bị chặn bộ lọc an toàn. Thử ảnh/nội dung khác hoặc giảm số trang.',
      }
    }

    let flashText: string
    try {
      flashText = flashResponse.text()?.trim() ?? ''
    } catch (textErr) {
      console.error('[tao-infographic-tu-sach] flash text():', textErr)
      await deleteTryOnHistoryRowAndStorage( historyItem.id)
      return {
        error:
          'Không đọc được văn bản từ AI (có thể bị chặn an toàn). Thử giảm số ảnh hoặc thêm vài dòng nội dung chữ.',
      }
    }
    if (!flashText) {
      await deleteTryOnHistoryRowAndStorage( historyItem.id)
      return { error: 'AI không trả về tóm tắt. Thử lại hoặc đổi nội dung.' }
    }
    try {
      ;({ summary, mermaid } = parseFlashJson(flashText))
    } catch (parseErr) {
      console.error('[tao-infographic-tu-sach] parseFlashJson:', parseErr, flashText.slice(0, 500))
      await deleteTryOnHistoryRowAndStorage( historyItem.id)
      return {
        error:
          'AI trả về định dạng chưa đọc được. Hãy bấm thử lại, hoặc giảm số ảnh, hoặc thêm đoạn chữ tóm tắt vào ô nội dung.',
      }
    }
  } catch (e) {
    console.error('[tao-infographic-tu-sach] flash:', e)
    await deleteTryOnHistoryRowAndStorage( historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/429|resource_exhausted|quota/i.test(msg)) {
      return { error: 'API tạm quá tải hoặc hết hạn mức. Thử lại sau vài phút.' }
    }
    if (/payload|too large|request.*size|400/i.test(msg)) {
      return { error: 'Gói dữ liệu quá lớn. Hãy giảm số ảnh (thử 2–3 trang) hoặc chọn ảnh nhỏ hơn.' }
    }
    return { error: 'Không lấy được sơ đồ tư duy từ AI. Thử giảm số ảnh hoặc thử lại sau.' }
  }

  const summaryForImage = (await normalizeToEnglish(summary).catch(() => summary)) || summary
  const mermaidForImage = (await normalizeToEnglish(mermaid).catch(() => mermaid)) || mermaid
  const imagePrompt =
    `${IMAGE_INSTRUCTION_PREFIX}\n\nLESSON CONTEXT:\n${summaryForImage}\n\nSTRUCTURE / RELATIONSHIPS (from diagram):\n${mermaidForImage}`

  const imageModel = genAI.getGenerativeModel({
    model: 'gemini-3-pro-image-preview',
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize: '2K', aspectRatio: '16:9' },
    },
  })

  try {
    const imageResult = await imageModel.generateContent(imagePrompt, { safetySettings: [...safetySettings] } as never)
    const imageResponse = imageResult.response
    void trackFromUsageMetadata(imageResponse.usageMetadata, 'gemini-3-pro-image-preview', 'tao-infographic-tu-sach', user.id, '2K')
    const imagePart = imageResponse.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePart || !('inlineData' in imagePart)) {
      await deleteTryOnHistoryRowAndStorage( historyItem.id)
      return { error: 'AI không trả về ảnh infographic hợp lệ.' }
    }
    const rawPng = Buffer.from((imagePart as { inlineData: { data: string } }).inlineData.data, 'base64')
    let resultBuffer: Buffer = rawPng
    let resultExt: 'png' | 'webp' = 'png'
    let resultContentType: 'image/png' | 'image/webp' = 'image/png'
    try {
      const optimized = await compressInfographicForProjection(rawPng)
      resultBuffer = Buffer.from(optimized.buffer)
      resultExt = optimized.ext
      resultContentType = optimized.contentType
    } catch (e) {
      console.warn('[tao-infographic-tu-sach] compress skipped:', e)
    }

    const resultPath = `results/${user.id}/book_infographic_${Date.now()}.${resultExt}`
    const { publicUrl: infographicResultPublicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: resultContentType,
      upsert: true,
    })

    const d = await deductUserCredits(user.id, COST_2K)
    if (!d.ok) {
      await deleteTryOnHistoryRowAndStorage( historyItem.id)
      return { error: d.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits để hoàn tất.' : d.error }
    }
    await updateTryOnHistoryCompletedPg(historyItem.id, infographicResultPublicUrl, {
      feature: 'tao-infographic-tu-sach',
      aspect_ratio: '16:9',
    })

    revalidatePath('/tao-infographic-tu-sach')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: infographicResultPublicUrl, summary, mermaid }
  } catch (e) {
    await deleteTryOnHistoryRowAndStorage( historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Thử lại sau ít phút.' }
    }
    return { error: `Tạo ảnh thất bại: ${msg}` }
  }
}
