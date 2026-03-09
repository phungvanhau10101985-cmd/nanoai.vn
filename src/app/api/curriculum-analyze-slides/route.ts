import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GoogleGenAI } from '@google/genai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'

/** Tìm ảnh qua Google Search grounding – fallback khi không có Pexels */
async function searchImageViaGoogle(apiKey: string, query: string): Promise<string | undefined> {
  try {
    const ai = new GoogleGenAI({ apiKey })
    const res = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
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

const JSON_SCHEMA = `{
  "slides": [
    {
      "title": "Ý chính duy nhất của slide",
      "blocks": [
        { "header": "Nội dung", "content": "Một ý chính – giải thích rõ, ví dụ ngắn gọn..." }
      ],
      "imageQuery": "math education school",
      "quizzes": [
        { "question": "Câu hỏi trắc nghiệm về nội dung slide?", "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"], "correctIndex": 0 }
      ]
    }
  ]
}`

/** Chuyển quiz thành marker [quiz:...] */
function quizToMarker(q: { question: string; options: string[]; correctIndex: number }): string {
  const opts = (q.options || []).slice(0, 6).join('|')
  const idx = Math.max(0, Math.min(q.correctIndex ?? 0, (q.options?.length ?? 1) - 1))
  return `[quiz:${q.question}|${opts}|${idx}]`
}

const SYSTEM_PROMPT = `Bạn là giáo viên chuyên nghiệp. Nhiệm vụ: RÚT GỌN giáo trình thành SLIDE BÀI GIẢNG – CHỈ NỘI DUNG HỌC TẬP cho học sinh.

QUY TẮC BẮT BUỘC – CHỈ NỘI DUNG BÀI GIẢNG:
- Slide bài giảng CHỈ bao gồm nội dung kiến thức học sinh cần học. KHÔNG nhắc đến: giáo trình, mục tiêu bài học, thời lượng tiết, công văn, bộ sách, loại bài học, hoạt động khởi động/luyện tập/vận dụng (chỉ lấy nội dung kiến thức bên trong).
- Bỏ hết phần "dành cho giáo viên" – học sinh sẽ bị phân tâm nếu thấy thông tin không liên quan đến bài học.
- Mỗi slide = MỘT ý chính kiến thức. "title" = ý chính đó; "blocks" = giải thích, ví dụ, ngôn ngữ dễ hiểu cho học sinh.

QUY TẮC BẮT BUỘC – TỪ KHÓA TÌM ẢNH:
- Mỗi slide PHẢI có "imageQuery": chuỗi từ khóa TIẾNG ANH (2-4 từ) để tìm ảnh minh họa nội dung bài học.
- Ví dụ: "math education", "function graph", "chemistry lab", "history ancient"...

QUY TẮC TRẮC NGHIỆM (BẮT BUỘC):
- Mỗi slide PHẢI có "quizzes": mảng 1–2 câu hỏi trắc nghiệm (tối đa 2).
- Mỗi quiz: "question" (câu hỏi ngắn gọn), "options" (đúng 4 đáp án A/B/C/D), "correctIndex" (0–3).
- Đáp án đúng PHẢI chính xác về mặt nội dung (công thức, định nghĩa, quy tắc). Không đoán mò.
- Mỗi đáp án phải là câu/ý hoàn chỉnh, không rời rạc (ví dụ: không tạo "f(x)", "dx" riêng lẻ).
- Nếu có công thức toán: đáp án đúng phải dùng đúng ký hiệu (ví dụ |f(x)| cho trị tuyệt đối, [f(x)]² cho bình phương).
- Thể tích khối tròn xoay quanh Ox: V = π ∫ [f(x)]² dx (bắt buộc có BÌNH PHƯƠNG).
- Diện tích hình phẳng: S = ∫ |f(x)| dx (bắt buộc có trị tuyệt đối).
- BẮT BUỘC đúng 4 đáp án. Ngôn ngữ: Tiếng Việt.

QUY TẮC KHÁC:
1. Chỉ trả về JSON hợp lệ, không markdown code block.
2. Dùng Unicode thay vì LaTeX (∈, ℝ, ½, ⇒, ...).
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

    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      console.error('[curriculum-analyze-slides] Thiếu GOOGLE_API_KEY')
      return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })
    }

    console.log('[curriculum-analyze-slides] Bắt đầu, topic:', topic, 'length:', curriculumMarkdown.length)

    const userPrompt = `Rút gọn nội dung sau thành SLIDE BÀI GIẢNG – CHỈ kiến thức học sinh cần học. Bỏ mọi thứ không phải nội dung bài giảng (mục tiêu, thời lượng, hoạt động giáo viên...). MỖI SLIDE CHỈ 1 Ý CHÍNH.

${topic ? `Chủ đề: ${topic}\n\n` : ''}NỘI DUNG THAM KHẢO:
---
${curriculumMarkdown}
---

Schema JSON (chỉ JSON, không markdown):
${JSON_SCHEMA}`

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      ...GEMINI_25_FLASH_NO_THINKING,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    })

    const fullPrompt = SYSTEM_PROMPT + '\n\n' + userPrompt
    console.log('[curriculum-analyze-slides] Gọi Gemini...')
    const geminiStart = Date.now()
    const result = await model.generateContent(fullPrompt)
    console.log('[curriculum-analyze-slides] Gemini xong sau', Date.now() - geminiStart, 'ms')

    const rawText = result.response.text()?.trim() || ''
    if (!rawText) {
      console.error('[curriculum-analyze-slides] Gemini không trả về text. response:', JSON.stringify(result.response).slice(0, 500))
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

    console.log('[curriculum-analyze-slides] Có', parsed.slides.length, 'slides, bắt đầu tìm ảnh...')

    const slidesRaw = parsed.slides.map((s) => {
      const blocks = Array.isArray(s?.blocks)
        ? (s.blocks as SlideBlock[]).map((b) => ({
            header: String(b?.header ?? 'Nội dung'),
            content: String(b?.content ?? ''),
          }))
        : []
      const quizzes = Array.isArray((s as { quizzes?: Array<{ question?: string; options?: string[]; correctIndex?: number }> })?.quizzes)
        ? ((s as { quizzes: Array<{ question?: string; options?: string[]; correctIndex?: number }> }).quizzes)
            .slice(0, 2)
            .filter((q) => q?.question && Array.isArray(q?.options) && q.options.length >= 4)
            .map((q) => ({
              question: q.question,
              options: (q.options ?? []).slice(0, 4).map(String),
              correctIndex: Math.max(0, Math.min(q.correctIndex ?? 0, 3)),
            }))
        : []
      for (const q of quizzes) {
        const opts = (q.options ?? []).slice(0, 4)
        const marker = quizToMarker({
          question: String(q?.question ?? ''),
          options: opts,
          correctIndex: Math.max(0, Math.min(q.correctIndex ?? 0, opts.length - 1)),
        })
        const lastBlock = blocks[blocks.length - 1]
        if (lastBlock) {
          lastBlock.content = lastBlock.content ? lastBlock.content + '\n\n' + marker : marker
        } else {
          blocks.push({ header: 'Trắc nghiệm', content: marker })
        }
      }
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
          if (!imageUrl && apiKey) {
            try {
              imageUrl = await searchImageViaGoogle(apiKey, s.imageQuery)
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
