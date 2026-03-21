/**
 * Tạo slide bài giảng từ nội dung giáo trình – dùng chung cho curriculum-from-image và curriculum-analyze-slides.
 */
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GoogleGenAI } from '@google/genai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'

export interface SlideBlock {
  header: string
  content: string
}

export interface AISlideData {
  title: string
  blocks: SlideBlock[]
  imageUrl?: string
  visualEmbed?: string
}

const MAX_CONTENT_PER_SLIDE = 220

const JSON_SCHEMA = `{
  "slides": [
    {
      "title": "Một ý duy nhất – VD: Bước 1: Mô hình hóa",
      "blocks": [
        { "header": "Nội dung", "content": "1 ý duy nhất, tối đa ${MAX_CONTENT_PER_SLIDE} ký tự. Không gộp nhiều ý vào 1 slide." }
      ],
      "imageQuery": "math education school",
      "plotSpec": {
        "expr": "x^2-3x+2",
        "xMin": -4,
        "xMax": 4,
        "yMin": -6,
        "yMax": 6
      }
    }
  ]
}`

function normalizeSlideText(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function splitLongSlides(
  slides: Array<{ title: string; blocks: SlideBlock[]; imageQuery?: string; visualEmbed?: string }>
): Array<{ title: string; blocks: SlideBlock[]; imageQuery?: string; visualEmbed?: string }> {
  const result: Array<{ title: string; blocks: SlideBlock[]; imageQuery?: string; visualEmbed?: string }> = []
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
        visualEmbed: i === 0 ? s.visualEmbed : undefined,
      })
    }
  }
  return result
}

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
    console.warn('[slides-from-curriculum] searchImageViaGoogle lỗi:', err)
    return undefined
  }
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

QUY TẮC BẮT BUỘC – ĐỒ THỊ/HÀM SỐ:
- Nếu slide có hàm số hoặc nội dung yêu cầu quan sát đồ thị, PHẢI trả thêm "plotSpec".
- "plotSpec.expr" luôn chuẩn hóa theo biến x (ví dụ t^3-9t^2+15t thì chuyển thành x^3-9x^2+15x).
- "plotSpec" cần có đủ xMin, xMax, yMin, yMax để dựng đồ thị.
- Nếu slide không có hàm số thì không cần "plotSpec".

LƯU Ý: KHÔNG tạo câu hỏi trắc nghiệm. Giáo viên sẽ tạo và lưu sau (mỗi slide tối đa 1 câu).

QUY TẮC KHÁC:
1. Chỉ trả về JSON hợp lệ, không markdown code block.
2. CHO HỌC SINH ĐỌC ĐƯỢC: BẮT BUỘC dùng Unicode, KHÔNG LaTeX $...$. Ví dụ: ∈, ℝ, ∫, π, ², √, ∞, ↗, ↘, ⇒, ½, y=x², f'(x), (0;+∞). Phân số: 1/2. Căn: √(x+1).
3. Ngôn ngữ: Tiếng Việt, phù hợp học sinh.`

export interface GenerateSlidesOptions {
  fetchImages?: boolean
}

/** Tạo slide bài giảng từ nội dung giáo trình – dùng Gemini. */
export async function generateSlidesFromCurriculum(
  curriculumMarkdown: string,
  topic: string,
  opts: GenerateSlidesOptions = {}
): Promise<{ slides: AISlideData[]; error?: string }> {
  const { fetchImages = true } = opts
  const googleApiKey = process.env.GOOGLE_API_KEY?.trim()
  if (!googleApiKey) {
    return { slides: [], error: 'Thiếu GOOGLE_API_KEY.' }
  }

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

  const genAI = new GoogleGenerativeAI(googleApiKey)
  const model = genAI.getGenerativeModel({
    ...GEMINI_25_FLASH_NO_THINKING,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  })

  const result = await model.generateContent(fullPrompt)
  const rawText = result.response.text()?.trim() || ''
  if (!rawText) return { slides: [], error: 'AI không trả về nội dung.' }

  let parsed: {
    slides?: Array<{
      title?: string
      blocks?: SlideBlock[]
      imageQuery?: string
      plotSpec?: { expr?: string; xMin?: number; xMax?: number; yMin?: number; yMax?: number }
    }>
  }
  try {
    const cleaned = rawText
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim()
    parsed = JSON.parse(cleaned)
  } catch {
    return { slides: [], error: 'AI trả về JSON không hợp lệ.' }
  }

  if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) {
    return { slides: [], error: 'AI không tạo được slide nào.' }
  }

  const toSplit = parsed.slides
    .map((s) => {
      const raw = String((s?.blocks as SlideBlock[])?.[0]?.content ?? '')
      const content = normalizeSlideText(raw)
      return {
        title: String(s?.title ?? 'Slide'),
        blocks: [{ header: 'Nội dung', content }],
        imageQuery: typeof s?.imageQuery === 'string' ? s.imageQuery.trim() : undefined,
        visualEmbed: undefined,
      }
    })
    .filter((s) => s.blocks[0].content.length > 0)

const afterSplit = splitLongSlides(toSplit)
  const slidesRaw = afterSplit.map((s) => ({
    title: String(s?.title ?? 'Slide'),
    blocks: Array.isArray(s?.blocks)
      ? (s.blocks as SlideBlock[]).map((b) => ({
          header: String(b?.header ?? 'Nội dung'),
          content: String(b?.content ?? ''),
        }))
      : [],
    imageQuery: typeof (s as { imageQuery?: string })?.imageQuery === 'string'
      ? (s as { imageQuery: string }).imageQuery.trim()
      : undefined,
    visualEmbed: typeof (s as { visualEmbed?: string })?.visualEmbed === 'string'
      ? (s as { visualEmbed: string }).visualEmbed.trim()
      : undefined,
  }))

  if (!fetchImages) {
    return {
      slides: slidesRaw.map((s) => ({ title: s.title, blocks: s.blocks, visualEmbed: s.visualEmbed })),
    }
  }

  const pexelsKey = process.env.PEXELS_API_KEY?.trim()
  const slides: AISlideData[] = await Promise.all(
    slidesRaw.map(async (s) => {
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
            }
          } catch {
            /* ignore */
          }
        }
        if (!imageUrl && googleApiKey) {
          imageUrl = await searchImageViaGoogle(googleApiKey, s.imageQuery)
        }
        if (!imageUrl && s.imageQuery) {
          imageUrl = `https://picsum.photos/seed/${encodeURIComponent(s.imageQuery)}/600/400`
        }
      }
      return { title: s.title, blocks: s.blocks, imageUrl, visualEmbed: s.visualEmbed }
    })
  )

  return { slides }
}
