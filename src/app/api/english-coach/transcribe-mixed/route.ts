import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

type Payload = {
  audioBase64?: string
  mimeType?: string
  targetLanguage?: string
  targetLanguageCode?: string
  nativeLanguage?: string
  nativeLanguageCode?: string
  speakingMode?: 'auto' | 'target' | 'native' | 'mixed'
}

type TranscribeResult = {
  targetTranscript: string
  nativeTranscript: string
  mergedTranscript: string
  inferredMeaning: string
  pronunciationIssues: string[]
  pronunciationScore: number
  weakWords: string[]
}

function safeParse(text: string): TranscribeResult | null {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```/i, '')
    .replace(/```$/i, '')
    .trim()
  try {
    const parsed = JSON.parse(cleaned) as Partial<TranscribeResult>
    const targetTranscript = String(parsed.targetTranscript || '').trim()
    const nativeTranscript = String(parsed.nativeTranscript || '').trim()
    const mergedTranscript = String(parsed.mergedTranscript || '').trim()
    const inferredMeaning = String((parsed as { inferredMeaning?: unknown }).inferredMeaning || '').trim()
    const pronunciationIssuesRaw = Array.isArray((parsed as { pronunciationIssues?: unknown }).pronunciationIssues)
      ? (parsed as { pronunciationIssues: unknown[] }).pronunciationIssues
      : []
    const pronunciationIssues = pronunciationIssuesRaw
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .slice(0, 6)
    const weakWordsRaw = Array.isArray((parsed as { weakWords?: unknown }).weakWords)
      ? (parsed as { weakWords: unknown[] }).weakWords
      : []
    const weakWords = weakWordsRaw
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .slice(0, 8)
    const scoreRaw = Number((parsed as { pronunciationScore?: unknown }).pronunciationScore)
    const pronunciationScore = Number.isFinite(scoreRaw)
      ? Math.min(100, Math.max(0, Math.round(scoreRaw)))
      : (pronunciationIssues.length === 0 ? 85 : 65)
    if (!targetTranscript && !nativeTranscript && !mergedTranscript && !inferredMeaning) return null
    return {
      targetTranscript,
      nativeTranscript,
      mergedTranscript: mergedTranscript || targetTranscript || nativeTranscript,
      inferredMeaning,
      pronunciationIssues,
      pronunciationScore,
      weakWords,
    }
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })

    const payload = (await request.json()) as Payload
    const audioBase64 = String(payload.audioBase64 || '').trim()
    const mimeType = String(payload.mimeType || 'audio/webm').trim()
    const targetLanguage = String(payload.targetLanguage || 'English').trim()
    const targetLanguageCode = String(payload.targetLanguageCode || '').trim().toLowerCase()
    const nativeLanguage = String(payload.nativeLanguage || 'Vietnamese').trim()
    const nativeLanguageCode = String(payload.nativeLanguageCode || '').trim().toLowerCase()
    const speakingMode = payload.speakingMode === 'target'
      ? 'target'
      : payload.speakingMode === 'native'
        ? 'native'
        : payload.speakingMode === 'mixed'
          ? 'mixed'
          : 'auto'
    const transliterationGuide =
      targetLanguageCode === 'zh'
        ? `Nếu học sinh nói kiểu phiên âm Latin gần pinyin, ưu tiên map về chữ Hán cho transcript chính.`
        : targetLanguageCode === 'ja'
          ? `Nếu học sinh nói kiểu romanization (romaji), ưu tiên map về tiếng Nhật (kana/kanji) cho transcript chính.`
          : targetLanguageCode === 'ko'
            ? `Nếu học sinh nói kiểu romanization, ưu tiên map về Hangul cho transcript chính.`
            : targetLanguageCode === 'th'
              ? `Nếu học sinh nói kiểu phiên âm Latin, ưu tiên map về chữ Thái cho transcript chính.`
              : targetLanguageCode === 'hi'
                ? `Nếu học sinh nói kiểu phiên âm Latin, ưu tiên map về chữ Devanagari cho transcript chính.`
                : `Nếu có phiên âm Latin của ${targetLanguage}, ưu tiên map về đúng chữ viết của ${targetLanguage} trong transcript chính.`

    if (!audioBase64) {
      return NextResponse.json({ error: 'Thiếu dữ liệu âm thanh.' }, { status: 400 })
    }

    const ai = new GoogleGenerativeAI(apiKey)
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `Bạn là bộ nhận dạng lời nói cho người học ngoại ngữ.
Nhiệm vụ:
1) Tách transcript theo ngôn ngữ đang học: ${targetLanguage}.
2) Tách transcript theo ngôn ngữ mẹ đẻ: ${nativeLanguage}.
3) Hợp nhất lại thành câu mixed đầy đủ, giữ ý nghĩa tự nhiên.
4) Không bịa thêm nội dung không nghe được.
5) Nếu phát âm mơ hồ/sai gần đúng, ghi chú ngắn vào pronunciationIssues để giáo viên sửa.
6) inferredMeaning: diễn giải ý học sinh muốn nói bằng ngôn ngữ mẹ đẻ ${nativeLanguage} (1 câu ngắn).
7) Chế độ học sinh chọn: ${speakingMode}. Dùng mode này như tín hiệu ưu tiên khi tách transcript:
- target: ưu tiên nghe/giữ phần ${targetLanguage}.
- native: ưu tiên nghe/giữ phần ${nativeLanguage}.
- mixed/auto: nhận diện cả hai ngôn ngữ cân bằng.
8) pronunciationScore: chấm 0-100 cho độ rõ phát âm tổng thể của câu (ước lượng thực tế, không quá rộng tay).
9) weakWords: danh sách 1-8 từ/cụm nghe chưa rõ hoặc phát âm chưa tốt.
10) Cặp ngôn ngữ hợp lệ duy nhất:
 - target: ${targetLanguage} (${targetLanguageCode || 'unknown'})
 - native: ${nativeLanguage} (${nativeLanguageCode || 'unknown'})
TUYỆT ĐỐI không mặc định sang ngôn ngữ thứ ba không thuộc cặp target/native.
11) Quy tắc phiên âm theo ngôn ngữ đang học:
${transliterationGuide}

Trả về JSON hợp lệ:
{
  "targetTranscript": "...",
  "nativeTranscript": "...",
  "mergedTranscript": "...",
  "inferredMeaning": "...",
  "pronunciationIssues": ["...", "..."],
  "pronunciationScore": 78,
  "weakWords": ["...", "..."]
}`

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
          data: audioBase64,
        },
      },
    ])
    const text = result.response.text()?.trim() || ''
    const parsed = safeParse(text)
    if (!parsed) {
      return NextResponse.json({ error: 'Không tách được transcript mixed.' }, { status: 502 })
    }

    return NextResponse.json(parsed)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

