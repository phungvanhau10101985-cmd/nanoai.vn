import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import { createClient } from '@/lib/supabase/server'
import { CurriculumApiFeature, trackCurriculumGeminiResult } from '@/lib/curriculum-api-usage'
import { isValidBookIsbn, normalizeBookIsbn } from '@/app/tao-giao-trinh/lib/book-isbn'

const MAX_BYTES = 8 * 1024 * 1024

/** Đọc ISBN từ ảnh mã vạch / dòng ISBN trên sách (Gemini 2.5 Flash). */
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Vui lòng đăng nhập.' }, { status: 401 })
    }

    const apiKey = process.env.GOOGLE_API_KEY?.trim()
    if (!apiKey) {
      return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 503 })
    }

    const formData = await req.formData()
    const file = formData.get('image') as File | null
    if (!file || typeof file !== 'object' || file.size <= 0) {
      return NextResponse.json({ error: 'Vui lòng gửi ảnh mã ISBN/barcode.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Ảnh quá lớn (tối đa 8MB).' }, { status: 400 })
    }

    const mimeType = file.type || 'image/jpeg'
    if (!mimeType.startsWith('image/')) {
      return NextResponse.json({ error: 'Chỉ chấp nhận file ảnh.' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString('base64')

    const prompt = `The image may show: (1) a book ISBN barcode (often EAN-13 on back cover or spine), (2) printed text "ISBN" followed by digits on copyright/imprint or back cover, or (3) a QR code on the cover that encodes or links to the book ISBN — decode the ISBN from the QR if visible.
Return ONLY valid JSON, no markdown: {"isbn":"<string>"}
Rules:
- Extract exactly one ISBN. Prefer the 13-digit barcode value if both 10-digit and 13-digit appear.
- The string must be ISBN-10 or ISBN-13 with only digits, except ISBN-10 may end with X.
- Remove hyphens/spaces from the value.
- If unreadable or no ISBN visible: {"isbn":""}
- No extra keys, no explanation.`

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      ...GEMINI_25_FLASH_NO_THINKING,
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
    })

    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType, data: base64 } },
    ])
    trackCurriculumGeminiResult(
      result,
      GEMINI_25_FLASH_NO_THINKING.model,
      CurriculumApiFeature.isbnFromImage,
      user.id
    )

    const text = result.response.text()?.trim() || ''
    let parsed: { isbn?: string }
    try {
      parsed = JSON.parse(text) as { isbn?: string }
    } catch {
      const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
      try {
        parsed = JSON.parse(cleaned) as { isbn?: string }
      } catch {
        return NextResponse.json({ error: 'Không đọc được phản hồi từ AI.' }, { status: 502 })
      }
    }

    const normalized = normalizeBookIsbn(parsed?.isbn)
    if (!normalized || !isValidBookIsbn(normalized)) {
      return NextResponse.json(
        {
          error:
            'Không nhận diện được ISBN hợp lệ. Vui lòng chụp rõ mã vạch hoặc dòng ISBN trên sách.',
        },
        { status: 422 }
      )
    }

    return NextResponse.json({ isbn: normalized })
  } catch (e) {
    console.error('[textbook-isbn-from-image]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Lỗi máy chủ.' },
      { status: 500 }
    )
  }
}
