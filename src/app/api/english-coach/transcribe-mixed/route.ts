import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'

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
  pronunciationAccuracy: number
  pronunciationFluency: number
  pronunciationProsody: number
  wordScores: Array<{ word: string; score: number; issueType: string }>
}

function tr(input: string): 'vi' | 'en' {
  return String(input || '').toLowerCase().includes('vietnamese') ? 'vi' : 'en'
}

function msg(locale: 'vi' | 'en', vi: string, en: string): string {
  return locale === 'vi' ? vi : en
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
    const accuracyRaw = Number((parsed as { pronunciationAccuracy?: unknown }).pronunciationAccuracy)
    const fluencyRaw = Number((parsed as { pronunciationFluency?: unknown }).pronunciationFluency)
    const prosodyRaw = Number((parsed as { pronunciationProsody?: unknown }).pronunciationProsody)
    const pronunciationAccuracy = Number.isFinite(accuracyRaw)
      ? Math.min(100, Math.max(0, Math.round(accuracyRaw)))
      : (pronunciationIssues.length === 0 ? 86 : 66)
    const pronunciationFluency = Number.isFinite(fluencyRaw)
      ? Math.min(100, Math.max(0, Math.round(fluencyRaw)))
      : (pronunciationIssues.length === 0 ? 84 : 64)
    const pronunciationProsody = Number.isFinite(prosodyRaw)
      ? Math.min(100, Math.max(0, Math.round(prosodyRaw)))
      : (pronunciationIssues.length === 0 ? 82 : 62)
    const wordScoresRaw = Array.isArray((parsed as { wordScores?: unknown }).wordScores)
      ? (parsed as { wordScores: Array<{ word?: unknown; score?: unknown; issueType?: unknown }> }).wordScores
      : []
    const wordScores = wordScoresRaw
      .map((x) => ({
        word: String(x.word || '').trim(),
        score: Number.isFinite(Number(x.score)) ? Math.min(100, Math.max(0, Math.round(Number(x.score)))) : 0,
        issueType: String(x.issueType || '').trim() || 'unclear',
      }))
      .filter((x) => x.word)
      .slice(0, 12)
    if (!targetTranscript && !nativeTranscript && !mergedTranscript && !inferredMeaning) return null
    return {
      targetTranscript,
      nativeTranscript,
      mergedTranscript: mergedTranscript || targetTranscript || nativeTranscript,
      inferredMeaning,
      pronunciationIssues,
      pronunciationScore,
      weakWords,
      pronunciationAccuracy,
      pronunciationFluency,
      pronunciationProsody,
      wordScores,
    }
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Payload
    const audioBase64 = String(payload.audioBase64 || '').trim()
    const mimeType = String(payload.mimeType || 'audio/webm').trim()
    const targetLanguage = String(payload.targetLanguage || 'English').trim()
    const targetLanguageCode = String(payload.targetLanguageCode || '').trim().toLowerCase()
    const nativeLanguage = String(payload.nativeLanguage || 'Vietnamese').trim()
    const nativeLanguageCode = String(payload.nativeLanguageCode || '').trim().toLowerCase()
    const locale = tr(nativeLanguage)
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) return NextResponse.json({ error: msg(locale, 'Thiếu GOOGLE_API_KEY.', 'Missing GOOGLE_API_KEY.') }, { status: 500 })
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
      return NextResponse.json({ error: msg(locale, 'Thiếu dữ liệu âm thanh.', 'Missing audio data.') }, { status: 400 })
    }

    const ai = new GoogleGenerativeAI(apiKey)
    const model = ai.getGenerativeModel(GEMINI_25_FLASH_NO_THINKING)

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
10) pronunciationAccuracy/pronunciationFluency/pronunciationProsody: từng chỉ số 0-100.
11) wordScores: tối đa 12 token theo ngôn ngữ đang học, mỗi token gồm:
- word: token bằng target language
- score: 0-100
- issueType: one of "mispronounced" | "unclear" | "stress" | "intonation" | "linking"
12) Nếu target là non-Latin (zh/ja/ko/th/hi), ưu tiên token đúng script của target language.
13) Nếu không đủ bằng chứng audio, trả mảng rỗng thay vì bịa wordScores.
14) Cặp ngôn ngữ hợp lệ duy nhất:
 - target: ${targetLanguage} (${targetLanguageCode || 'unknown'})
 - native: ${nativeLanguage} (${nativeLanguageCode || 'unknown'})
TUYỆT ĐỐI không mặc định sang ngôn ngữ thứ ba không thuộc cặp target/native.
15) Quy tắc phiên âm theo ngôn ngữ đang học:
${transliterationGuide}

Trả về JSON hợp lệ:
{
  "targetTranscript": "...",
  "nativeTranscript": "...",
  "mergedTranscript": "...",
  "inferredMeaning": "...",
  "pronunciationIssues": ["...", "..."],
  "pronunciationScore": 78,
  "weakWords": ["...", "..."],
  "pronunciationAccuracy": 76,
  "pronunciationFluency": 72,
  "pronunciationProsody": 70,
  "wordScores": [{"word":"...","score":68,"issueType":"stress"}]
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
      return NextResponse.json({ error: msg(locale, 'Không tách được transcript mixed.', 'Failed to split mixed transcript.') }, { status: 502 })
    }

    return NextResponse.json(parsed)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

