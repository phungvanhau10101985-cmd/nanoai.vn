import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import sharp from 'sharp'
import { getUserForCreditAction } from '@/lib/auth'
import { GEMINI_25_FLASH_NO_THINKING, GEMINI_3_PRO_IMAGE } from '@/lib/gemini-config'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { bunnyStorageConfigured, uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { ensureBunnyWritableBeforeImageModel } from '@/lib/storage/partner-bunny-cdn'
import { randomUUID } from 'crypto'
import { CURRICULUM_AI_CHARGE_TYPES } from '@/lib/curriculum-ai-credits'
import {
  applyCurriculumAiCharge,
  buildInfographicArtifactKey,
  estimateCurriculumAiPrecheckAmount,
} from '@/lib/curriculum-ai-charge-policy'
import { readUserCreditBalance } from '@/lib/curriculum-ai-credits'
import { imageEngineCredit, parseGptImageQuality, parseImageEngine } from '@/lib/ai/image-engine'
import { produceImageBytes } from '@/lib/ai/gpt-image'

const COST_2K = 1.5
const MAX_SLIDE_TEXT = 28000
const INFOGRAPHIC_TARGET_BYTES = 820 * 1024
const INFOGRAPHIC_MAX_DIMENSION = 2048
const toTenths = (value: number) => Math.round(value * 10)
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const OUTPUT_LOCALES = new Set(['vi', 'en', 'zh', 'ja', 'ko'])

const OUTPUT_LANGUAGE_NAME = {
  vi: 'Vietnamese',
  en: 'English',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
} as const

const FLASH_INSTRUCTION = `You are an assistant for teachers. Given the full lesson / curriculum text (all slides combined), output ONLY valid JSON (no markdown fences) with keys:
- "summary": string, 3–6 short bullet lines separated by newline, teaching-friendly, in the OUTPUT_LANGUAGE specified by the user. Capture the big picture of the whole lesson. Do not translate into English when OUTPUT_LANGUAGE is not English.
- "mermaid": string, valid Mermaid diagram code (prefer flowchart TD or mindmap). Max ~1200 characters. No HTML. Every word in node labels must be in the same OUTPUT_LANGUAGE as the summary. Do not use English headings when OUTPUT_LANGUAGE is Vietnamese.

The diagram should reflect the main concepts and relationships across the entire lesson (not one slide only). Keep mathematical notation as symbols.`

const IMAGE_INSTRUCTION_PREFIX = `Create ONE high-quality educational infographic image for classroom projection (16:9). Clean modern layout, readable typography, clear visual hierarchy, harmonious colors, professional look. Interpret the diagram structure conceptually—do not render raw code or syntax as text. No watermark.`

function imageTextLanguageLock(locale: keyof typeof OUTPUT_LANGUAGE_NAME): string {
  const name = OUTPUT_LANGUAGE_NAME[locale]
  return `TEXT ON THE IMAGE (mandatory): Every readable word — title, headings, labels, captions, objectives, callouts — must be written in ${name}. Do not translate those words into English or any other language. Keep mathematical notation as symbols (variables, coordinates, formulas, arrows). Do not print Mermaid syntax, code, or English section names such as "Vector addition" or "Objectives" when the required language is not English.`
}

function parseFlashJson(text: string): { summary: string; mermaid: string } {
  const trimmed = text.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = (fence ? fence[1] : trimmed).trim()
  let parsed: { summary?: string; mermaid?: string }
  try {
    parsed = JSON.parse(raw) as { summary?: string; mermaid?: string }
  } catch {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start < 0 || end <= start) throw new Error('invalid json')
    parsed = JSON.parse(raw.slice(start, end + 1)) as { summary?: string; mermaid?: string }
  }
  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : ''
  const mermaid = typeof parsed.mermaid === 'string' ? parsed.mermaid.trim() : ''
  if (!summary || !mermaid) throw new Error('Thiếu summary hoặc mermaid trong phản hồi AI.')
  if (mermaid.length > 2000) throw new Error('Mermaid quá dài.')
  return { summary, mermaid }
}

const SHARP_READ = { sequentialRead: true, limitInputPixels: 32_000_000 } as const
const WEBP_QUALITIES = [84, 78, 72, 66, 60, 54] as const
const RESIZE_SCALES = [1, 0.92, 0.84, 0.76, 0.68] as const

type RawFrame = { data: Buffer; width: number; height: number; channels: 1 | 2 | 3 | 4 }

async function decodeFittedFrame(source: Buffer | RawFrame, width: number, height: number): Promise<RawFrame> {
  const pipeline = Buffer.isBuffer(source)
    ? sharp(source, SHARP_READ).rotate()
    : sharp(source.data, { raw: { width: source.width, height: source.height, channels: source.channels } })
  const decoded = await pipeline
    .resize({ width, height, fit: 'inside', withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true })
  const channels = decoded.info.channels
  if (channels !== 1 && channels !== 2 && channels !== 3 && channels !== 4) {
    throw new Error('Ảnh infographic có số kênh không hỗ trợ.')
  }
  return { data: decoded.data, width: decoded.info.width, height: decoded.info.height, channels }
}

async function encodeFrameWebp(frame: RawFrame, quality: number): Promise<Buffer> {
  return sharp(frame.data, { raw: { width: frame.width, height: frame.height, channels: frame.channels } })
    .webp({ quality, effort: 6, smartSubsample: true })
    .toBuffer()
}

/** Một lần giải nén, rồi nén WebP từ pixel đã resize. Cùng trần 2048px và cùng mốc ≤ 820KB. */
async function compressInfographicForProjection(rawPng: Buffer): Promise<{ buffer: Buffer; ext: 'webp'; contentType: 'image/webp' }> {
  const meta = await sharp(rawPng, SHARP_READ).metadata().catch(() => null)
  const srcW = Math.max(1, Number(meta?.width || INFOGRAPHIC_MAX_DIMENSION))
  const srcH = Math.max(1, Number(meta?.height || Math.round(INFOGRAPHIC_MAX_DIMENSION * 9 / 16)))
  let frame: RawFrame | null = null
  let best: Buffer | null = null

  for (const scale of RESIZE_SCALES) {
    const targetW = Math.max(640, Math.min(INFOGRAPHIC_MAX_DIMENSION, Math.round(srcW * scale)))
    const targetH = Math.max(360, Math.min(INFOGRAPHIC_MAX_DIMENSION, Math.round(srcH * scale)))
    frame = await decodeFittedFrame(frame ?? rawPng, targetW, targetH)
    for (const quality of WEBP_QUALITIES) {
      const out = await encodeFrameWebp(frame, quality)
      if (!best || out.length < best.length) best = out
      if (out.length <= INFOGRAPHIC_TARGET_BYTES) {
        return { buffer: out, ext: 'webp', contentType: 'image/webp' }
      }
    }
  }

  if (!best) throw new Error('Không nén được ảnh infographic.')
  return { buffer: best, ext: 'webp', contentType: 'image/webp' }
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })
    }
    if (!bunnyStorageConfigured()) {
      return NextResponse.json(
        { error: 'Thiếu cấu hình lưu ảnh (Bunny Storage: BUNNY_STORAGE_ZONE, BUNNY_STORAGE_API_KEY, BUNNY_STORAGE_PUBLIC_BASE_URL).' },
        { status: 503 }
      )
    }

    let body: {
      curriculumId?: string
      topic?: string
      /** Toàn bộ nội dung giáo trình (mọi slide) — tạo một infographic cho cả bài */
      lessonText?: string
      outputLocale?: string
      scope?: 'curriculum' | 'lesson'
      lessonNo?: number
      regenerate?: boolean
      imageEngine?: string | null
      gptQuality?: string | null
    }
    try {
      body = (await req.json()) as typeof body
    } catch {
      return NextResponse.json({ error: 'Body JSON không hợp lệ.' }, { status: 400 })
    }

    const curriculumId = typeof body.curriculumId === 'string' ? body.curriculumId.trim() : ''
    const topic = typeof body.topic === 'string' ? body.topic.trim() : ''
    let lessonText = typeof body.lessonText === 'string' ? body.lessonText.trim() : ''
    const outputLocale = OUTPUT_LOCALES.has(String(body.outputLocale || '').toLowerCase())
      ? (String(body.outputLocale).toLowerCase() as 'vi' | 'en' | 'zh' | 'ja' | 'ko')
      : 'vi'

    if (!curriculumId) {
      return NextResponse.json({ error: 'Thiếu curriculumId.' }, { status: 400 })
    }
    if (lessonText.length < 40) {
      return NextResponse.json({ error: 'Nội dung giáo trình quá ngắn để tạo infographic.' }, { status: 400 })
    }
    if (lessonText.length > MAX_SLIDE_TEXT) {
      lessonText = lessonText.slice(0, MAX_SLIDE_TEXT)
    }

    const auth = await getUserForCreditAction('Vui lòng đăng nhập.')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }
    const user = auth.user
    const scope = body.scope === 'lesson' ? 'lesson' : 'curriculum'
    const lessonNo = scope === 'lesson' ? Math.max(1, Math.floor(Number(body.lessonNo) || 1)) : undefined
    const isRegenerate = body.regenerate === true
    const engine = parseImageEngine(body.imageEngine)
    const gptQuality = parseGptImageQuality(body.gptQuality)
    if (engine === 'gpt' && !gptQuality) {
      return NextResponse.json({ error: 'Chọn chất lượng GPT: low, medium hoặc high.' }, { status: 400 })
    }
    const listPrice = imageEngineCredit({ engine, gptQuality, geminiCost: COST_2K })
    const infographicArtifactKey = buildInfographicArtifactKey(curriculumId, scope, lessonNo)
    const infographicKind = scope === 'lesson' ? 'infographic_lesson' : 'infographic_curriculum'

    const requiredPrecheck = await estimateCurriculumAiPrecheckAmount({
      userId: user.id,
      kind: infographicKind,
      artifactKey: infographicArtifactKey,
      listPrice,
      isRegenerate,
    })
    if (requiredPrecheck > 0) {
      let openBal = 0
      try {
        openBal = await readUserCreditBalance(user.id)
      } catch {
        return NextResponse.json({ error: 'Không đọc được số dư credits.' }, { status: 500 })
      }
      if (toTenths(openBal) < toTenths(requiredPrecheck)) {
        return NextResponse.json(
          {
            error: `Không đủ credits. Cần ${formatCredits(requiredPrecheck)} credits, hiện có ${formatCredits(openBal)}.`,
            code: 'INSUFFICIENT_CREDITS',
            balance: openBal,
            required: requiredPrecheck,
          },
          { status: 402 }
        )
      }
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const flashModel = genAI.getGenerativeModel({
      ...GEMINI_25_FLASH_NO_THINKING,
      generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
    })
    const flashUser = `OUTPUT_LANGUAGE code: ${outputLocale} (vi=Vietnamese, en=English, zh=Chinese, ja=Japanese, ko=Korean).

Topic / lesson title: ${topic || '(none)'}

FULL LESSON CONTENT (all slides / sections combined):
${lessonText}

${FLASH_INSTRUCTION}`

    let flashResult: Awaited<ReturnType<typeof flashModel.generateContent>>
    try {
      flashResult = await flashModel.generateContent(flashUser, {
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        ],
      })
    } catch {
      return NextResponse.json({ error: 'Không lấy được phản hồi tóm tắt từ AI. Thử lại sau.' }, { status: 502 })
    }
    const flashResponse = flashResult.response
    void trackFromUsageMetadata(flashResponse.usageMetadata, 'gemini-2.5-flash', 'curriculum-slide-infographic', user.id, null)
    let flashText: string
    try {
      flashText = flashResponse.text()?.trim() ?? ''
    } catch {
      return NextResponse.json(
        { error: 'Nội dung slide có thể bị chặn an toàn hoặc AI không trả về văn bản. Thử đổi nội dung hoặc thử lại.' },
        { status: 502 }
      )
    }
    if (!flashText) {
      return NextResponse.json({ error: 'AI không trả về tóm tắt (văn bản rỗng). Thử lại.' }, { status: 502 })
    }
    let summary: string
    let mermaid: string
    try {
      ;({ summary, mermaid } = parseFlashJson(flashText))
    } catch {
      return NextResponse.json({ error: 'AI không trả về cấu trúc infographic hợp lệ. Thử lại.' }, { status: 502 })
    }

    const languageName = OUTPUT_LANGUAGE_NAME[outputLocale]
    const imagePrompt =
      `${IMAGE_INSTRUCTION_PREFIX}\n${imageTextLanguageLock(outputLocale)}\n\nLESSON CONTEXT (print these ideas in ${languageName}):\n${summary}\n\nSTRUCTURE / RELATIONSHIPS (node labels stay in ${languageName}; do not print the diagram code):\n${mermaid}`

    const imageModel =
      engine === 'gpt'
        ? null
        : genAI.getGenerativeModel({
            model: GEMINI_3_PRO_IMAGE.model,
            generationConfig: {
              responseModalities: ['TEXT', 'IMAGE'],
              imageConfig: { imageSize: '2K', aspectRatio: '16:9' },
            },
          })
    const bunnyReady = await ensureBunnyWritableBeforeImageModel()
    if (!bunnyReady.ok) {
      return NextResponse.json({ error: bunnyReady.error }, { status: 503 })
    }
    const imageSafety = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    ] as const
    let rawPng: Buffer
    try {
      if (engine === 'gpt') {
        rawPng = await produceImageBytes({
          engine,
          gptQuality,
          prompt: imagePrompt,
          aspectRatio: '16:9',
          gemini: async () => {
            throw new Error('Thiếu model ảnh.')
          },
        })
      } else {
        if (!imageModel) throw new Error('Thiếu model ảnh.')
        const imageResult = await imageModel.generateContent(imagePrompt, { safetySettings: imageSafety } as never)
        void trackFromUsageMetadata(
          imageResult.response.usageMetadata,
          GEMINI_3_PRO_IMAGE.model,
          'curriculum-slide-infographic',
          user.id,
          '2K'
        )
        const imagePart = imageResult.response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
        const inline = imagePart && 'inlineData' in imagePart
          ? (imagePart as { inlineData: { data: string } }).inlineData
          : null
        if (!inline?.data) {
          return NextResponse.json({ error: 'AI không trả về ảnh infographic hợp lệ.' }, { status: 502 })
        }
        rawPng = Buffer.from(inline.data, 'base64')
        inline.data = ''
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không tạo được ảnh infographic. Thử lại sau.'
      return NextResponse.json({ error: msg }, { status: 502 })
    }
    if (!rawPng.length) {
      return NextResponse.json({ error: 'AI không trả về ảnh infographic hợp lệ.' }, { status: 502 })
    }
    let resultBuffer = rawPng
    let resultExt: 'png' | 'webp' = 'png'
    let resultContentType: 'image/png' | 'image/webp' = 'image/png'
    try {
      const optimized = await compressInfographicForProjection(rawPng)
      resultBuffer = optimized.buffer
      resultExt = optimized.ext
      resultContentType = optimized.contentType
      rawPng = Buffer.alloc(0)
    } catch (e) {
      console.warn('[curriculum-slide-infographic] projection compress skipped, fallback png:', e)
      resultBuffer = rawPng
    }
    const resultPath = `results/${user.id}/curriculum_infographic_${curriculumId}_${Date.now()}.${resultExt}`
    let infographicPublicUrl: string
    try {
      const { publicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
        contentType: resultContentType,
        upsert: true,
      })
      infographicPublicUrl = publicUrl
    } catch (uploadErr) {
      console.error('[curriculum-slide-infographic] upload:', uploadErr)
      return NextResponse.json({ error: 'Không upload được ảnh. Thử lại sau.' }, { status: 502 })
    }

    const charge = await applyCurriculumAiCharge({
      userId: user.id,
      kind: infographicKind,
      artifactKey: infographicArtifactKey,
      listPrice,
      chargeType: CURRICULUM_AI_CHARGE_TYPES.slideInfographic,
      isRegenerate,
      eventKey: `curriculum_infographic:${user.id}:${randomUUID()}`,
      metadata: {
        curriculumId,
        scope,
        lessonNo: lessonNo ?? null,
      },
    })
    if (!charge.ok) {
      return NextResponse.json(
        {
          error:
            charge.code === 'INSUFFICIENT_CREDITS'
              ? 'Không đủ credits để hoàn tất.'
              : charge.error,
          code: charge.code,
          balance: charge.balance,
          required: charge.required,
          dailyQuota: charge.dailyQuota,
        },
        { status: 402 }
      )
    }

    const generatedAt = new Date().toISOString()
    return NextResponse.json({
      success: true,
      creditsCharged: charge.creditsCharged,
      chargeReason: charge.chargeReason,
      dailyQuota: charge.dailyQuota,
      infographic: {
        summary,
        mermaid,
        imageUrl: infographicPublicUrl,
        generatedAt,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return NextResponse.json(
        { error: 'Hệ thống quá tải. Thử lại sau ít phút hoặc chọn 2K.' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: msg || 'Lỗi tạo infographic.' }, { status: 500 })
  }
}
