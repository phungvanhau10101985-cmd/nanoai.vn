import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { createClient } from '@/lib/supabase/server'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import { normalizeToEnglish } from '@/lib/ai-normalize'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'

const COST_2K = 1.5
const MAX_SLIDE_TEXT = 28000
const INFOGRAPHIC_TARGET_BYTES = 820 * 1024
const INFOGRAPHIC_MAX_DIMENSION = 2048
const toTenths = (value: number) => Math.round(value * 10)
const fromTenths = (value: number) => value / 10
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const OUTPUT_LOCALES = new Set(['vi', 'en', 'zh', 'ja', 'ko'])

const FLASH_INSTRUCTION = `You are an assistant for teachers. Given the full lesson / curriculum text (all slides combined), output ONLY valid JSON (no markdown fences) with keys:
- "summary": string, 3–6 short bullet lines separated by newline, teaching-friendly, in the OUTPUT_LANGUAGE specified by the user. Capture the big picture of the whole lesson.
- "mermaid": string, valid Mermaid diagram code (prefer flowchart TD or mindmap). Max ~1200 characters. No HTML. Use simple node labels (ASCII or the same language as summary).

The diagram should reflect the main concepts and relationships across the entire lesson (not one slide only).`

const IMAGE_INSTRUCTION_PREFIX = `Create ONE high-quality educational infographic image for classroom projection (16:9). Clean modern layout, readable typography, clear visual hierarchy, harmonious colors, professional look. Interpret the diagram structure conceptually—do not render raw code or syntax as text. No watermark.`

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

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Thiếu cấu hình Supabase (upload/lưu).' }, { status: 500 })
    }

    let body: {
      curriculumId?: string
      topic?: string
      /** Toàn bộ nội dung giáo trình (mọi slide) — tạo một infographic cho cả bài */
      lessonText?: string
      outputLocale?: string
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

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Vui lòng đăng nhập.' }, { status: 401 })
    }

    const adminSupabase = createSupabaseClient(supabaseUrl, serviceKey)

    const { data: creditData, error: creditError } = await supabase
      .from('credits')
      .select('balance')
      .eq('user_id', user.id)
      .single()
    if (creditError || !creditData || toTenths(creditData.balance) < toTenths(COST_2K)) {
      return NextResponse.json(
        {
          error: `Không đủ credits. Cần ${formatCredits(COST_2K)} credits, hiện có ${formatCredits(creditData?.balance || 0)}.`,
        },
        { status: 402 }
      )
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
    let imageResult: Awaited<ReturnType<typeof imageModel.generateContent>>
    try {
      imageResult = await imageModel.generateContent(imagePrompt, {
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        ],
      } as never)
    } catch {
      return NextResponse.json({ error: 'Không tạo được ảnh infographic. Thử lại sau.' }, { status: 502 })
    }
    const imageResponse = imageResult.response
    void trackFromUsageMetadata(
      imageResponse.usageMetadata,
      'gemini-3-pro-image-preview',
      'curriculum-slide-infographic',
      user.id,
      '2K'
    )
    const imagePart = imageResponse.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePart || !('inlineData' in imagePart)) {
      return NextResponse.json({ error: 'AI không trả về ảnh infographic hợp lệ.' }, { status: 502 })
    }
    const rawPng = Buffer.from((imagePart as { inlineData: { data: string } }).inlineData.data, 'base64')
    let resultBuffer = rawPng
    let resultExt: 'png' | 'webp' = 'png'
    let resultContentType: 'image/png' | 'image/webp' = 'image/png'
    try {
      const optimized = await compressInfographicForProjection(rawPng)
      resultBuffer = Buffer.from(optimized.buffer)
      resultExt = optimized.ext
      resultContentType = optimized.contentType
    } catch (e) {
      console.warn('[curriculum-slide-infographic] projection compress skipped, fallback png:', e)
      resultBuffer = rawPng
    }
    const resultPath = `results/${user.id}/curriculum_infographic_${curriculumId}_${Date.now()}.${resultExt}`
    let infographicPublicUrl: string
    try {
      const { publicUrl } = await uploadTryOnImagePublic(adminSupabase, resultPath, resultBuffer, {
        contentType: resultContentType,
        upsert: true,
      })
      infographicPublicUrl = publicUrl
    } catch (uploadErr) {
      console.error('[curriculum-slide-infographic] upload:', uploadErr)
      return NextResponse.json({ error: 'Không upload được ảnh. Thử lại sau.' }, { status: 502 })
    }

    const { data: latestCredit } = await adminSupabase.from('credits').select('balance').eq('user_id', user.id).single()
    if (!latestCredit || toTenths(latestCredit.balance) < toTenths(COST_2K)) {
      return NextResponse.json({ error: 'Không đủ credits để hoàn tất.' }, { status: 402 })
    }
    const newBalance = fromTenths(toTenths(latestCredit.balance) - toTenths(COST_2K))
    await adminSupabase.from('credits').update({ balance: newBalance }).eq('user_id', user.id)

    const generatedAt = new Date().toISOString()
    return NextResponse.json({
      success: true,
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
