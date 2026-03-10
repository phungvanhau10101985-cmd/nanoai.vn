import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GoogleGenAI } from '@google/genai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'

/** Tìm ảnh qua Google Search grounding – fallback khi không có Pexels */
const SEARCH_IMAGE_MODEL = 'gemini-2.0-flash'

async function searchImageViaGoogle(apiKey: string, query: string): Promise<string | undefined> {
  try {
    console.log('[curriculum-analyze-slides] Gọi AI model=' + SEARCH_IMAGE_MODEL + ' (tìm ảnh) query:', query.slice(0, 50))
    const ai = new GoogleGenAI({ apiKey })
    const res = await ai.models.generateContent({
      model: SEARCH_IMAGE_MODEL,
      contents: `Tìm một link ảnh trực tiếp (URL) của ảnh minh họa giáo dục/học tập về "${query}". Chỉ trả về đúng một URL ảnh (bắt đầu https://, kết thúc .jpg .png .webp hoặc tương tự). Không giải thích, không markdown.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    })
    const resAny = res as { text?: string; candidates?: Array<{ groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string } }> } }> }
    const text = resAny?.text?.trim() || ''
    const urlMatch = text.match(/https:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?/i)
    if (urlMatch) return urlMatch[0]
    const anyUrl = text.match(/https:\/\/images\.(?:pexels|unsplash|pixabay)[^\s"'<>]+/i)
    if (anyUrl) return anyUrl[0]
    const anyHttps = text.match(/https:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s"'<>]*)?/i)
    if (anyHttps) return anyHttps[0]
    const candidate = resAny?.candidates?.[0]
    const chunks = candidate?.groundingMetadata?.groundingChunks
    for (const chunk of chunks || []) {
      const uri = chunk?.web?.uri
      if (uri && /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(uri)) return uri
      if (uri && /images\.(pexels|unsplash|pixabay)/i.test(uri)) return uri
    }
    return undefined
  } catch (err) {
    console.warn('[curriculum-analyze-slides] searchImageViaGoogle lỗi:', err)
    return undefined
  }
}

export interface SlideBlock {
  header: string
  content: string
}

export interface AISlideData {
  title: string
  blocks: SlideBlock[]
  /** URL ảnh minh họa phù hợp nội dung slide (Unsplash, Pexels...) */
  imageUrl?: string
}

export interface AnalyzeSlidesResponse {
  slides: AISlideData[]
}

const MAX_CONTENT_PER_SLIDE = 220

const JSON_SCHEMA = `{
  "slides": [
    {
      "title": "Một ý duy nhất – VD: Bước 1: Mô hình hóa",
      "blocks": [
        { "header": "Nội dung", "content": "1 ý duy nhất, tối đa ${MAX_CONTENT_PER_SLIDE} ký tự. Không gộp nhiều ý vào 1 slide." }
      ],
      "imageQuery": "math education school"
    }
  ]
}`

/** Chuẩn hóa text slide, không làm mất ý sư phạm của giáo trình */
function normalizeSlideText(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Tách slide có nội dung quá dài thành nhiều slide ngắn */
function splitLongSlides(
  slides: Array<{ title: string; blocks: SlideBlock[]; imageQuery?: string }>
): Array<{ title: string; blocks: SlideBlock[]; imageQuery?: string }> {
  const result: Array<{ title: string; blocks: SlideBlock[]; imageQuery?: string }> = []
  for (const s of slides) {
    const text = (s.blocks?.[0]?.content ?? '').trim()
    if (text.length <= MAX_CONTENT_PER_SLIDE) {
      result.push(s)
      continue
    }
    const parts: string[] = []
    const byBullet = text.split(/(?:\n\s*[-*•]\s*|\n\n+)/)
    const chunks = byBullet.length > 1 ? byBullet : text.split(/\.\s+(?=[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ])/)
    for (const chunk of chunks) {
      const t = chunk.trim()
      if (!t || t.length < 15) continue
      if (t.length <= MAX_CONTENT_PER_SLIDE) {
        parts.push(t)
      } else {
        const lines = t.split(/\n/)
        let buf = ''
        for (const line of lines) {
          const L = line.trim()
          if (!L) continue
          if (buf.length + L.length + 1 <= MAX_CONTENT_PER_SLIDE) {
            buf = buf ? buf + '\n' + L : L
          } else {
            if (buf) parts.push(buf)
            buf = L.length <= MAX_CONTENT_PER_SLIDE ? L : L.slice(0, MAX_CONTENT_PER_SLIDE) + '…'
          }
        }
        if (buf) parts.push(buf)
      }
    }
    if (parts.length <= 1) {
      result.push(s)
      continue
    }
    for (let i = 0; i < parts.length; i++) {
      result.push({
        title: parts.length > 1 ? `${s.title} (${i + 1}/${parts.length})` : s.title,
        blocks: [{ header: s.blocks?.[0]?.header ?? 'Nội dung', content: parts[i] }],
        imageQuery: i === 0 ? s.imageQuery : s.imageQuery,
      })
    }
  }
  return result
}

const SYSTEM_PROMPT = `Bạn là chuyên gia thiết kế slide giảng dạy THPT. Nhiệm vụ: PHÂN TÍCH giáo trình đã có và tạo slide giảng dạy bám sát giáo trình, không tóm tắt sơ sài.

=== NGUYÊN TẮC BÁM SÁT GIÁO TRÌNH ===
- Giữ đầy đủ mạch dạy học theo TIẾT và HOẠT ĐỘNG trong giáo trình.
- KHÔNG bỏ các phần sư phạm quan trọng: Mục tiêu, khởi động, hình thành kiến thức, ví dụ, luyện tập, vận dụng, dặn dò.
- Mỗi ý dạy học chính (định nghĩa/công thức/ví dụ/bài tập/câu hỏi) nên là 1 slide riêng.
- Khi gặp danh sách nhiều mục (a,b,c hoặc lỗi 1,2,3), tách thành nhiều slide.
- Nội dung mỗi slide tối đa ${MAX_CONTENT_PER_SLIDE} ký tự.
- Ưu tiên ngôn ngữ tự nhiên, dễ giảng trên lớp; không viết kiểu ghi chú thô.

QUY TẮC BẮT BUỘC – TỪ KHÓA TÌM ẢNH:
- Mỗi slide PHẢI có "imageQuery": chuỗi từ khóa TIẾNG ANH (2-4 từ) để tìm ảnh minh họa nội dung bài học.
- Ví dụ: "math education", "function graph", "chemistry lab", "history ancient"...

LƯU Ý: KHÔNG tạo câu hỏi trắc nghiệm. Giáo viên sẽ tạo và lưu sau (mỗi slide tối đa 1 câu).

QUY TẮC KHÁC:
1. Chỉ trả về JSON hợp lệ, không markdown code block.
2. CHO HỌC SINH ĐỌC ĐƯỢC: BẮT BUỘC dùng Unicode, KHÔNG LaTeX $...$. Ví dụ: ∈, ℝ, ∫, π, ², √, ∞, ↗, ↘, ⇒, ½, y=x², f'(x), (0;+∞). Phân số: 1/2. Căn: √(x+1).
3. Ngôn ngữ: Tiếng Việt, phù hợp học sinh.`

export async function POST(req: NextRequest) {
  const start = Date.now()
  try {
    const body = await req.json().catch((e) => {
      console.error('[curriculum-analyze-slides] JSON parse error:', e)
      return {}
    })
    const curriculumMarkdown = String(body?.curriculumMarkdown ?? body?.markdown ?? '').trim()
    const topic = String(body?.topic ?? '').trim()

    if (!curriculumMarkdown) {
      return NextResponse.json({ error: 'Thiếu nội dung giáo trình.' }, { status: 400 })
    }

    const useOpenAI =
      process.env.SLIDE_USE_OPENAI === 'true' ||
      process.env.SLIDE_USE_OPENAI === '1' ||
      process.env.SLIDE_OPENAI_MODEL?.trim()
    const openAiKey = process.env.OPENAI_API_KEY?.trim()
    const openAiModel =
      process.env.SLIDE_OPENAI_MODEL?.trim() ||
      process.env.OPENAI_FALLBACK_MODEL?.trim() ||
      'gpt-5-mini'

    const googleApiKey = process.env.GOOGLE_API_KEY
    if (!useOpenAI && !googleApiKey) {
      console.error('[curriculum-analyze-slides] Thiếu GOOGLE_API_KEY')
      return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })
    }
    if (useOpenAI && !openAiKey) {
      console.error('[curriculum-analyze-slides] SLIDE_USE_OPENAI=true nhưng thiếu OPENAI_API_KEY')
      return NextResponse.json({ error: 'Thiếu OPENAI_API_KEY.' }, { status: 500 })
    }

    console.log('[curriculum-analyze-slides] Bắt đầu, topic:', topic, 'length:', curriculumMarkdown.length)

    const estimatedMinSlides = Math.max(24, Math.min(80, Math.ceil(curriculumMarkdown.length / 320)))
    const userPrompt = `Chuyển giáo trình sau thành slide giảng dạy bám sát nội dung.

YÊU CẦU:
- Tạo ÍT NHẤT ${estimatedMinSlides} slide (có thể nhiều hơn nếu cần để bám sát).
- Bám theo cấu trúc tiết/hđ trong giáo trình; không được gộp nhiều hoạt động lớn vào 1 slide.
- Mỗi ví dụ, mỗi bài tập, mỗi câu hỏi trọng tâm nên có slide riêng.
- Mỗi slide chỉ 1 trọng tâm; tối đa ${MAX_CONTENT_PER_SLIDE} ký tự.
- Không trả lời lan man ngoài JSON schema.

${topic ? `Chủ đề: ${topic}\n\n` : ''}NỘI DUNG THAM KHẢO:
---
${curriculumMarkdown}
---

Schema JSON (chỉ JSON, không markdown):
${JSON_SCHEMA}`

    const fullPrompt = SYSTEM_PROMPT + '\n\n' + userPrompt
    let rawText = ''

    if (useOpenAI && openAiKey) {
      console.log('[curriculum-analyze-slides] Gọi AI model=' + openAiModel + ' (tạo slide)')
      const gptStart = Date.now()
      const OPENAI_FETCH_TIMEOUT_MS = 600000 // 10 phút – giáo trình dài có thể mất 5+ phút
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), OPENAI_FETCH_TIMEOUT_MS)
      let gptRes: Response
      try {
        gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openAiKey}`,
          },
          body: JSON.stringify({
            model: openAiModel,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: 'Trả về đúng JSON theo schema. Không markdown.' },
              { role: 'user', content: fullPrompt },
            ],
          }),
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeoutId)
      }
      if (!gptRes.ok) {
        const errBody = await gptRes.text().catch(() => '')
        console.error('[curriculum-analyze-slides] OpenAI lỗi:', gptRes.status, errBody.slice(0, 300))
        return NextResponse.json(
          { error: `OpenAI lỗi ${gptRes.status}: ${errBody.slice(0, 300)}` },
          { status: 500 }
        )
      }
      const gptData = (await gptRes.json().catch(() => ({}))) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      rawText = String(gptData?.choices?.[0]?.message?.content ?? '').trim()
      console.log('[curriculum-analyze-slides] AI model=' + openAiModel + ' xong sau', Date.now() - gptStart, 'ms')
    } else {
      if (!googleApiKey) {
        return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })
      }
      const genAI = new GoogleGenerativeAI(googleApiKey)
      const model = genAI.getGenerativeModel({
        ...GEMINI_25_FLASH_NO_THINKING,
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      })
      console.log('[curriculum-analyze-slides] Gọi AI model=' + GEMINI_25_FLASH_NO_THINKING.model + ' (tạo slide)')
      const geminiStart = Date.now()
      const result = await model.generateContent(fullPrompt)
      console.log('[curriculum-analyze-slides] AI model=' + GEMINI_25_FLASH_NO_THINKING.model + ' xong sau', Date.now() - geminiStart, 'ms')
      rawText = result.response.text()?.trim() || ''
    }
    if (!rawText) {
      console.error('[curriculum-analyze-slides] AI không trả về text')
      return NextResponse.json({ error: 'AI không trả về nội dung.' }, { status: 500 })
    }

    let parsed: AnalyzeSlidesResponse
    try {
      const cleaned = rawText
        .replace(/^```(?:json)?\s*\n?/i, '')
        .replace(/\n?```\s*$/i, '')
        .trim()
      parsed = JSON.parse(cleaned) as AnalyzeSlidesResponse
    } catch (parseErr) {
      console.error('[curriculum-analyze-slides] JSON parse lỗi:', parseErr)
      console.error('[curriculum-analyze-slides] rawText (500 ký tự đầu):', rawText.slice(0, 500))
      return NextResponse.json({ error: 'AI trả về JSON không hợp lệ.', rawPreview: rawText.slice(0, 200) }, { status: 500 })
    }

    if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) {
      console.error('[curriculum-analyze-slides] parsed.slides rỗng:', parsed)
      return NextResponse.json({ error: 'AI không tạo được slide nào.' }, { status: 500 })
    }

    const toSplit = parsed.slides
      .map((s) => {
        const raw = String((s?.blocks as SlideBlock[])?.[0]?.content ?? '')
        const content = normalizeSlideText(raw)
        return {
          title: String(s?.title ?? 'Slide'),
          blocks: [{ header: 'Nội dung', content }],
          imageQuery: typeof (s as { imageQuery?: string })?.imageQuery === 'string' ? (s as { imageQuery: string }).imageQuery.trim() : undefined,
        }
      })
      .filter((s) => s.blocks[0].content.length > 0)
    const afterSplit = splitLongSlides(toSplit)

    console.log('[curriculum-analyze-slides] Có', afterSplit.length, 'slides (sau tách), bắt đầu tìm ảnh...')

    const slidesRaw = afterSplit.map((s) => {
      const blocks = Array.isArray(s?.blocks)
        ? (s.blocks as SlideBlock[]).map((b) => ({
            header: String(b?.header ?? 'Nội dung'),
            content: String(b?.content ?? ''),
          }))
        : []
      return {
        title: String(s?.title ?? 'Slide'),
        blocks,
        imageQuery: typeof (s as { imageQuery?: string })?.imageQuery === 'string'
          ? (s as { imageQuery: string }).imageQuery.trim()
          : undefined,
      }
    })

    // Tìm ảnh: ưu tiên Pexels, fallback Google Search grounding
    const pexelsKey = process.env.PEXELS_API_KEY?.trim()
    console.log('[curriculum-analyze-slides] Pexels key:', pexelsKey ? 'có' : 'không')
    const imgStart = Date.now()
    const slides: AISlideData[] = await Promise.all(
      slidesRaw.map(async (s, i) => {
        let imageUrl: string | undefined
        if (s.imageQuery) {
          if (pexelsKey) {
            try {
              const res = await fetch(
                `https://api.pexels.com/v1/search?query=${encodeURIComponent(s.imageQuery)}&per_page=3&orientation=landscape`,
                { headers: { Authorization: pexelsKey } }
              )
              const data = (await res.json()) as {
                photos?: Array<{ src?: { medium?: string; large?: string } }>
                error?: string
              }
              if (res.ok && data?.photos?.length) {
                const photo = data.photos[0]
                imageUrl = photo?.src?.large ?? photo?.src?.medium
              } else if (!res.ok) {
                console.warn('[curriculum-analyze-slides] Pexels slide', i, 'status:', res.status, data?.error || '')
              }
            } catch (pexErr) {
              console.warn('[curriculum-analyze-slides] Pexels slide', i, 'lỗi:', pexErr)
            }
          }
          if (!imageUrl && googleApiKey) {
            try {
              imageUrl = await searchImageViaGoogle(googleApiKey, s.imageQuery)
              if (!imageUrl) console.warn('[curriculum-analyze-slides] Google Search slide', i, 'không tìm thấy ảnh')
            } catch (googleErr) {
              console.warn('[curriculum-analyze-slides] Google Search slide', i, 'lỗi:', googleErr)
            }
          }
        } else {
          console.warn('[curriculum-analyze-slides] Slide', i, 'không có imageQuery')
        }
        if (!imageUrl && s.imageQuery) {
          imageUrl = `https://picsum.photos/seed/${encodeURIComponent(s.imageQuery)}/600/400`
        }
        return {
          title: s.title,
          blocks: s.blocks,
          imageUrl,
        }
      })
    )
    const withImg = slides.filter((s) => s.imageUrl).length
    console.log('[curriculum-analyze-slides] Tìm ảnh xong:', withImg, '/', slides.length, 'có ảnh. Thời gian:', Date.now() - imgStart, 'ms')

    return NextResponse.json({ slides })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const stack = e instanceof Error ? e.stack : undefined
    console.error('[curriculum-analyze-slides] LỖI:', msg)
    console.error('[curriculum-analyze-slides] Stack:', stack)
    return NextResponse.json({ error: `Lỗi: ${msg}` }, { status: 500 })
  }
}
