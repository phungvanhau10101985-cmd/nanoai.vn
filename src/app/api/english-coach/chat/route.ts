import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

type TeacherAccent = 'uk' | 'us'
type TeacherGender = 'female' | 'male'

type ChatMessage = {
  role: 'teacher' | 'student'
  text: string
}

type Correction = {
  original: string
  fixed: string
  explanationVi: string
}

type MixedAnalyzeResult = {
  learnerIntent: string
  targetKnownFragments: string[]
  nativeUnknownFragments: string[]
  mappedPairs: Array<{ native: string; target: string }>
  reconstructedTargetSentence: string
}

type ChatPayload = {
  studentText?: string
  history?: ChatMessage[]
  accent?: TeacherAccent
  gender?: TeacherGender
  mode?: 'chat' | 'story'
  targetLanguage?: string
  teacherLabel?: string
  teacherLocale?: string
  targetLanguageCode?: string
  learnerType?: 'vn_learner' | 'foreign_learner'
  supportLanguage?: string
  nativeLanguage?: string
  nativeLanguageCode?: string
  inputSource?: 'text' | 'mic'
  studentInputLanguage?: string
  speakingMode?: 'auto' | 'target' | 'native' | 'mixed'
  learnerLevel?: 0 | 1 | 2
  topicId?: string
  topicLabel?: string
  topicDifficulty?: 'basic' | 'intermediate' | 'advanced'
  topicRole?: string
  topicObjective?: string
  topicKeywords?: string[]
  topicStarterSentences?: string[]
  micAnalysis?: {
    targetTranscript?: string
    nativeTranscript?: string
    mergedTranscript?: string
    inferredMeaning?: string
    pronunciationIssues?: string[]
    pronunciationScore?: number
    weakWords?: string[]
  }
}

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function normalizeLookup(input: string): string {
  return String(input || '').trim().toLowerCase()
}

function extractPhraseTargetSentence(reply: string): string {
  const patterns = [
    /Câu chuẩn\s*\([^)]+\)\s*[:：]?\s*([^\n]+)/i,
    /Câu tự nhiên\s*\([^)]+\)\s*[:：]?\s*([^\n]+)/i,
    /Câu hoàn chỉnh\s*\([^)]+\)\s*[:：]?\s*([^\n]+)/i,
    /Câu (chuẩn|tự nhiên|hoàn chỉnh)\s*(là)?\s*[:：]\s*([^\n]+)/i,
  ]
  for (const pattern of patterns) {
    const match = reply.match(pattern)
    const sentence = String(match?.[3] || match?.[1] || '')
      .replace(/^\*+|\*+$/g, '')
      .trim()
    if (sentence) return sentence
  }
  return ''
}

function extractPhraseNativeMeaning(reply: string, nativeLanguage: string): string {
  const re = new RegExp(`Dịch nhanh\\s*\\(${nativeLanguage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)\\s*[:：]?\\s*([^\\n]+)`, 'i')
  const match = reply.match(re) || reply.match(/Dịch nhanh\s*\([^)]+\)\s*[:：]?\s*([^\n]+)/i)
  return String(match?.[1] || '').trim()
}

function extractPhrasePinyin(reply: string): string {
  const match = reply.match(/Pinyin\s*[:：]\s*([^\n]+)/i)
  return String(match?.[1] || '').trim()
}

function extractChineseSentences(text: string): string[] {
  const source = String(text || '')
  if (!source) return []
  const matches = source.match(/[\u4E00-\u9FFF][^\n。！？!?]*[。！？!?]?/gu) || []
  const unique: string[] = []
  for (const raw of matches) {
    const sentence = raw.trim()
    if (!sentence) continue
    if (sentence.length < 2) continue
    if (!unique.includes(sentence)) unique.push(sentence)
    if (unique.length >= 8) break
  }
  return unique
}

function fallbackFollowUpByLanguageCode(code: string, targetLanguage: string): string {
  if (code === 'zh') return 'Câu hỏi tiếp theo: 你可以再用一句话说说你今天的计划吗？'
  if (code === 'ja') return 'Câu hỏi tiếp theo: 次は、今日の予定を一文で言ってみましょうか？'
  if (code === 'ko') return 'Câu hỏi tiếp theo: 다음으로 오늘 계획을 한 문장으로 말해 볼까요?'
  if (code === 'th') return 'Câu hỏi tiếp theo: ต่อไปลองพูดแผนวันนี้ของคุณหนึ่งประโยคได้ไหม?'
  if (code === 'hi') return 'Câu hỏi tiếp theo: अगला सवाल: क्या आप आज की अपनी योजना एक वाक्य में बता सकते हैं?'
  if (code === 'vi') return 'Câu hỏi tiếp theo: Bạn có thể nói thêm một câu về kế hoạch hôm nay không?'
  return `Câu hỏi tiếp theo: Can you say one more sentence in ${targetLanguage} to continue this conversation?`
}

function hasFollowUpPrompt(reply: string): boolean {
  const text = String(reply || '').trim()
  if (!text) return false
  const followupPatterns = [
    /Câu hỏi tiếp theo/i,
    /Em thử/i,
    /Bạn có thể/i,
    /Bạn có .* không\?/i,
    /Can you/i,
    /Could you/i,
    /What about/i,
    /\?\s*$/,
    /吗？|嗎？|でしょうか？|까요\?|ได้ไหม\?|क्या .* ?\?/u,
  ]
  return followupPatterns.some((p) => p.test(text))
}

async function generatePinyinForSentence(
  model: { generateContent: (input: string) => Promise<{ response: { text?: () => string | undefined } }> },
  sentence: string
): Promise<string> {
  const source = String(sentence || '').trim()
  if (!source) return ''
  const prompt = `Chuyển câu tiếng Trung sau thành pinyin có dấu thanh.
Chỉ trả về đúng 1 dòng pinyin, không thêm giải thích:
${source}`
  const result = await model.generateContent(prompt)
  return String(result.response.text?.() || '').replace(/^```|```$/g, '').trim()
}

function safeJsonParse(text: string): {
  reply: string
  corrections: Correction[]
  pronunciationTips: string[]
} | null {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```/i, '')
    .replace(/```$/i, '')
    .trim()
  const parseCandidate = (candidate: string) => {
    const parsed = JSON.parse(candidate) as {
      reply?: string
      corrections?: Correction[]
      pronunciationTips?: string[]
    }
    if (!parsed.reply || typeof parsed.reply !== 'string') return null
    return {
      reply: parsed.reply,
      corrections: Array.isArray(parsed.corrections) ? parsed.corrections.slice(0, 5) : [],
      pronunciationTips: Array.isArray(parsed.pronunciationTips) ? parsed.pronunciationTips.slice(0, 5) : [],
    }
  }

  try {
    return parseCandidate(cleaned)
  } catch {
    // fall through
  }

  // Some model outputs include extra leading/trailing text around JSON.
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const extracted = cleaned.slice(firstBrace, lastBrace + 1).trim()
    try {
      return parseCandidate(extracted)
    } catch {
      return null
    }
  }
  return null
}

function safeJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```/i, '')
    .replace(/```$/i, '')
    .trim()
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function toMixedAnalyzeResult(input: Record<string, unknown> | null): MixedAnalyzeResult | null {
  if (!input) return null
  const learnerIntent = String(input.learnerIntent || '').trim()
  const reconstructedTargetSentence = String(input.reconstructedTargetSentence || '').trim()
  const targetKnownFragmentsRaw = Array.isArray(input.targetKnownFragments) ? input.targetKnownFragments : []
  const nativeUnknownFragmentsRaw = Array.isArray(input.nativeUnknownFragments) ? input.nativeUnknownFragments : []
  const mappedPairsRaw = Array.isArray(input.mappedPairs) ? input.mappedPairs : []

  const targetKnownFragments = targetKnownFragmentsRaw
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .slice(0, 12)
  const nativeUnknownFragments = nativeUnknownFragmentsRaw
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .slice(0, 12)
  const mappedPairs = mappedPairsRaw
    .map((x) => {
      if (!x || typeof x !== 'object') return null
      const pair = x as { native?: unknown; target?: unknown }
      const native = String(pair.native || '').trim()
      const target = String(pair.target || '').trim()
      if (!native || !target) return null
      return { native, target }
    })
    .filter((x): x is { native: string; target: string } => Boolean(x))
    .slice(0, 12)

  if (!learnerIntent && !reconstructedTargetSentence && mappedPairs.length === 0) return null
  return {
    learnerIntent,
    targetKnownFragments,
    nativeUnknownFragments,
    mappedPairs,
    reconstructedTargetSentence,
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })
    }

    const payload = (await request.json()) as ChatPayload
    const studentText = String(payload.studentText || '').trim()
    const history = Array.isArray(payload.history) ? payload.history.slice(-10) : []
    const accent: TeacherAccent = payload.accent === 'uk' ? 'uk' : 'us'
    const gender: TeacherGender = payload.gender === 'male' ? 'male' : 'female'
    const mode = payload.mode === 'story' ? 'story' : 'chat'
    const targetLanguage = String(payload.targetLanguage || 'English').trim()
    const targetLanguageCode = String(payload.targetLanguageCode || '').trim().toLowerCase()
    const teacherLabel = String(payload.teacherLabel || '').trim()
    const teacherLocale = String(payload.teacherLocale || '').trim()
    const learnerType = payload.learnerType === 'foreign_learner' ? 'foreign_learner' : 'vn_learner'
    const supportLanguage = String(payload.supportLanguage || 'Vietnamese').trim()
    const nativeLanguage = String(payload.nativeLanguage || supportLanguage || 'Vietnamese').trim()
    const nativeLanguageCode = String(payload.nativeLanguageCode || '').trim().toLowerCase()
    const inputSource = payload.inputSource === 'mic' ? 'mic' : 'text'
    const studentInputLanguage = String(payload.studentInputLanguage || nativeLanguage || '').trim()
    const speakingMode =
      payload.speakingMode === 'auto'
        ? 'auto'
        : payload.speakingMode === 'native'
        ? 'native'
        : payload.speakingMode === 'mixed'
          ? 'mixed'
          : 'target'
    const learnerLevelRaw = Number(payload.learnerLevel)
    const learnerLevel: 0 | 1 | 2 = learnerLevelRaw === 2 ? 2 : learnerLevelRaw === 1 ? 1 : 0
    const topicId = String(payload.topicId || 'solo-teacher').trim()
    const topicLabel = String(payload.topicLabel || 'Solo hội thoại với thầy/cô').trim()
    const topicDifficulty =
      payload.topicDifficulty === 'advanced'
        ? 'advanced'
        : payload.topicDifficulty === 'intermediate'
          ? 'intermediate'
          : 'basic'
    const topicRole = String(payload.topicRole || '').trim()
    const topicObjective = String(payload.topicObjective || '').trim()
    const topicKeywords = Array.isArray(payload.topicKeywords)
      ? payload.topicKeywords.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 8)
      : []
    const topicStarterSentences = Array.isArray(payload.topicStarterSentences)
      ? payload.topicStarterSentences.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 4)
      : []
    const micAnalysis = payload.micAnalysis && typeof payload.micAnalysis === 'object'
      ? payload.micAnalysis
      : null
    const micTargetTranscript = String(micAnalysis?.targetTranscript || '').trim()
    const micNativeTranscript = String(micAnalysis?.nativeTranscript || '').trim()
    const micMergedTranscript = String(micAnalysis?.mergedTranscript || '').trim()
    const micInferredMeaning = String(micAnalysis?.inferredMeaning || '').trim()
    const micPronunciationIssues = Array.isArray(micAnalysis?.pronunciationIssues)
      ? micAnalysis!.pronunciationIssues!.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 6)
      : []
    const micPronunciationScore = Number.isFinite(Number(micAnalysis?.pronunciationScore))
      ? Math.min(100, Math.max(0, Math.round(Number(micAnalysis?.pronunciationScore))))
      : null
    const micWeakWords = Array.isArray(micAnalysis?.weakWords)
      ? micAnalysis!.weakWords!.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 8)
      : []
    const asksHowToSay = /(nói.*thế nào|nói.*sao|how to say|怎么说|怎麼說)/i.test(studentText)

    if (!studentText) {
      return NextResponse.json({ error: 'Thiếu nội dung học sinh.' }, { status: 400 })
    }

    const normalizedStudentText = normalizeLookup(studentText)
    const normalizedTargetLanguage = normalizeLookup(targetLanguage)
    const normalizedNativeLanguage = normalizeLookup(nativeLanguage)
    const adminSupabase = adminClient()
    if (asksHowToSay) {
      const { data: phraseCachedRows } = await adminSupabase
        .from('language_coach_phrase_cache')
        .select('id, target_sentence, native_meaning, pinyin')
        .eq('normalized_source_text', normalizedStudentText)
        .eq('normalized_target_language', normalizedTargetLanguage)
        .eq('normalized_native_language', normalizedNativeLanguage)
        .order('updated_at', { ascending: false })
        .limit(1)
      const phraseCached = Array.isArray(phraseCachedRows) && phraseCachedRows.length > 0 ? phraseCachedRows[0] : null
      if (phraseCached) {
        void adminSupabase
          .from('language_coach_phrase_cache')
          .update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', phraseCached.id)
        const replyLines = [
          `Giải thích (${nativeLanguage}): Đây là câu hỏi cách nói rất thông dụng.`,
          `Câu chuẩn (${targetLanguage}): ${String(phraseCached.target_sentence || '').trim()}`,
        ]
        const nativeMeaning = String(phraseCached.native_meaning || '').trim()
        let cachedPinyin = String(phraseCached.pinyin || '').trim()
        if (targetLanguageCode === 'zh' && !cachedPinyin) {
          try {
            const genAIForPinyin = new GoogleGenerativeAI(apiKey)
            const pinyinModel = genAIForPinyin.getGenerativeModel({ model: 'gemini-2.5-flash' })
            cachedPinyin = await generatePinyinForSentence(
              { generateContent: (input: string) => pinyinModel.generateContent(input) },
              String(phraseCached.target_sentence || '').trim()
            )
          } catch {
            // keep without pinyin if helper fails
          }
        }
        if (targetLanguageCode === 'zh' && cachedPinyin) {
          replyLines.push(`Pinyin: ${cachedPinyin}`)
          if (!String(phraseCached.pinyin || '').trim()) {
            void adminSupabase
              .from('language_coach_phrase_cache')
              .update({ pinyin: cachedPinyin, updated_at: new Date().toISOString() })
              .eq('id', phraseCached.id)
          }
        }
        if (nativeMeaning) {
          replyLines.push(`Dịch nhanh (${nativeLanguage}): ${nativeMeaning}`)
        }
        replyLines.push(`Em thử đọc lại câu chuẩn này một lần nhé?`)
        return NextResponse.json({
          reply: replyLines.join('\n'),
          corrections: [],
          pronunciationTips: ['Đọc chậm, rõ nhịp từng cụm rồi tăng tốc dần.'],
          cachedPhrase: true,
        })
      }
    }

    const accentLabel = accent === 'uk' ? 'Anh - UK' : 'Mỹ - US'
    const genderLabel = gender === 'male' ? 'thầy giáo' : 'cô giáo'
    const teacherIdentity = teacherLabel || `${genderLabel} bản địa (${accentLabel})`
    const learnerContext =
      learnerType === 'foreign_learner'
        ? 'Học sinh là người nước ngoài đang học tiếng Việt.'
        : 'Học sinh là người Việt đang học ngoại ngữ.'
    const modeGuide =
      mode === 'story'
        ? `Ưu tiên kể chuyện ngắn bằng ${targetLanguage} nhẹ nhàng, thân thiện như trò chuyện đời thường, nhưng vẫn cần giải thích bằng ${nativeLanguage} trước nếu học sinh chưa hiểu.`
        : `Ưu tiên hội thoại đời thường bằng ${targetLanguage}, câu ngắn dễ hiểu và thân thiện, kèm giải thích bằng ${nativeLanguage}.`
    const explanationLanguage =
      learnerType === 'foreign_learner'
        ? 'Dùng tiếng Anh đơn giản'
        : 'Dùng tiếng Việt'
    const bilingualGuide = `Nếu học sinh hỏi bằng ${supportLanguage} hoặc trộn ngôn ngữ, hãy:
- Giải thích nhanh ý nghĩa bằng ${supportLanguage}.
- Tách các từ/cụm từ khó trong câu (nếu có) và giải thích ngắn.
- Sau đó đưa 1 câu chuẩn bằng ${targetLanguage}.
- Cuối cùng thêm 1 câu phiên bản dễ nhớ/ngắn gọn nếu phù hợp.`
    const nativeLanguageGuide = `Ngôn ngữ mẹ đẻ của học sinh là ${nativeLanguage}. Mặc định coi học sinh còn yếu ở ${targetLanguage}, nên luôn ưu tiên giải thích bằng ${nativeLanguage} trước, sau đó mới đưa mẫu chuẩn bằng ${targetLanguage}. Nếu học sinh nhập bằng ngôn ngữ mẹ đẻ hoặc trộn ngôn ngữ, bạn phải hiểu đầy đủ ý của học sinh trước khi trả lời.`
    const micGuide =
      inputSource === 'mic'
        ? `Đầu vào hiện tại đến từ microphone. Giả định học sinh vừa nói trong cặp ngôn ngữ ${targetLanguage} + ${nativeLanguage} (input hint: ${studentInputLanguage}). Bạn cần phân tích đúng ý theo cặp này và TUYỆT ĐỐI không mặc định sang English nếu target/native không phải English.`
        : 'Đầu vào hiện tại là văn bản gõ.'
    const micAnalysisGuide =
      inputSource === 'mic'
        ? `Kết quả phân tích audio (ưu tiên dùng để sửa lỗi phát âm/ngữ nghĩa, không được bịa thêm):
- targetTranscript: ${micTargetTranscript || '(trống)'}
- nativeTranscript: ${micNativeTranscript || '(trống)'}
- mergedTranscript: ${micMergedTranscript || '(trống)'}
- inferredMeaning (${nativeLanguage}): ${micInferredMeaning || '(trống)'}
- pronunciationIssues: ${micPronunciationIssues.join(' | ') || '(không phát hiện rõ)'}
- pronunciationScore: ${micPronunciationScore == null ? '(không có)' : `${micPronunciationScore}/100`}
- weakWords: ${micWeakWords.join(' | ') || '(không có)'}
Khi có pronunciationIssues, corrections và pronunciationTips phải chỉ ra học sinh sai ở đâu + cách sửa cụ thể.`
        : 'Không có phân tích audio.'
    const speakingModeGuide =
      speakingMode === 'auto'
        ? `Học sinh đang bật auto-detect. Hãy dùng transcript audio (target/native/merged) để tự nhận diện ngôn ngữ các đoạn học sinh nói rồi phản hồi phù hợp.`
        : speakingMode === 'target'
        ? `Học sinh đã chọn chế độ "đang nói bằng ngôn ngữ đang học". Vì vậy hãy ưu tiên hiểu câu của học sinh là tiếng ${targetLanguage}, không tự động suy diễn đó là tiếng mẹ đẻ.`
        : speakingMode === 'native'
          ? `Học sinh đã chọn chế độ "đang nói bằng tiếng mẹ đẻ". Vì vậy hãy hiểu câu theo ${nativeLanguage} trước rồi hướng dẫn sang ${targetLanguage}.`
          : `Học sinh đã chọn chế độ "nói trộn ${targetLanguage} + ${nativeLanguage}". Hãy coi các đoạn ${nativeLanguage} trong câu là phần học sinh chưa biết từ ở ${targetLanguage}. Bạn phải:
- Nhận diện rõ từng từ/cụm ${nativeLanguage} đó nghĩa là gì.
- Đưa từ/cụm tương ứng bằng ${targetLanguage}.
- Viết lại cả câu hoàn chỉnh, tự nhiên bằng ${targetLanguage}.
- Giải thích ngắn vì sao dùng từ đó (bằng ${nativeLanguage}).`
    const strictLanguagePairGuide = `Cặp ngôn ngữ buổi học này là:
- Ngôn ngữ đang học: ${targetLanguage} (${targetLanguageCode || 'unknown'})
- Ngôn ngữ mẹ đẻ: ${nativeLanguage} (${nativeLanguageCode || 'unknown'})
Bạn PHẢI bám đúng cặp này. Không mặc định chuyển sang English nếu ngôn ngữ đang học không phải English.`
    const howToSayGuide = asksHowToSay
      ? `Học sinh đang hỏi dạng "nói câu này thế nào". BẮT BUỘC trả đủ nội dung, không được thiếu:
1) Giải thích rất ngắn bằng ${nativeLanguage}.
2) "Câu chuẩn (${targetLanguage}): ..." (bắt buộc có câu đầy đủ).
3) Nếu ${targetLanguage} là Chinese/Mandarin thì thêm "Pinyin: ...".
4) "Dịch nhanh (${nativeLanguage}): ...".`
      : 'Không có yêu cầu đặc biệt dạng "nói câu này thế nào".'
    const levelPromptIndependent =
      learnerLevel === 0
        ? `PROMPT LEVEL 0 (độc lập):
- Mục tiêu: xây nền tảng, giúp học sinh hiểu chắc nghĩa trước.
- Tỷ lệ ngôn ngữ: ~80% ${nativeLanguage}, ~20% ${targetLanguage}.
- Câu mẫu ${targetLanguage}: rất ngắn, tối đa 1-2 câu mỗi lượt.
- Từ vựng: chỉ mức cơ bản, dễ nhớ, dễ phát âm.
- Cách phản hồi: khen ngắn + sửa 1 lỗi trọng tâm + 1 câu gợi mở rất đơn giản.`
        : learnerLevel === 1
          ? `PROMPT LEVEL 1 (độc lập):
- Mục tiêu: tăng phản xạ hội thoại và độ tự nhiên.
- Tỷ lệ ngôn ngữ: ~50% ${nativeLanguage}, ~50% ${targetLanguage}.
- Câu mẫu ${targetLanguage}: 2-3 câu ngắn, có biến thể giao tiếp.
- Từ vựng: trung bình, gắn ngữ cảnh thực tế.
- Cách phản hồi: sửa lỗi ngắn gọn, giải thích nhanh, rồi đẩy sang câu hỏi mở tiếp theo.`
          : `PROMPT LEVEL 2 (độc lập):
- Mục tiêu: ưu tiên giao tiếp thực chiến bằng ${targetLanguage}.
- Tỷ lệ ngôn ngữ: ~80% ${targetLanguage}, ~20% ${nativeLanguage} (chỉ khi làm rõ lỗi khó).
- Câu mẫu ${targetLanguage}: tự nhiên như người bản xứ, dài vừa phải.
- Từ vựng: nâng cao dần theo chủ đề.
- Cách phản hồi: ít dịch, tập trung sắc thái, độ tự nhiên và phản hồi mở rộng hội thoại.`
    const pairTransliterationGuide =
      targetLanguageCode === 'zh'
        ? `Nếu học sinh nói kiểu phiên âm Latin gần pinyin, phải map về chữ Hán trong câu chuẩn.`
        : targetLanguageCode === 'ja'
          ? `Nếu học sinh nói kiểu romaji, phải map về kana/kanji trong câu chuẩn.`
          : targetLanguageCode === 'ko'
            ? `Nếu học sinh nói kiểu romanization, phải map về Hangul trong câu chuẩn.`
            : targetLanguageCode === 'th'
              ? `Nếu học sinh nói kiểu phiên âm Latin, phải map về chữ Thái trong câu chuẩn.`
              : targetLanguageCode === 'hi'
                ? `Nếu học sinh nói kiểu phiên âm Latin, phải map về Devanagari trong câu chuẩn.`
                : `Nếu học sinh nói phiên âm không chuẩn của ${targetLanguage}, vẫn phải map về đúng ngôn ngữ đang học trong câu chuẩn.`
    const pinyinGuide =
      targetLanguageCode === 'zh'
        ? `BẮT BUỘC khi xuất hiện câu tiếng Trung (chữ Hán) thì phải kèm phiên âm Latin pinyin ngay sau đó, dạng:
- Câu hoàn chỉnh (${targetLanguage}): 你好。
- Pinyin: Nǐ hǎo.`
        : 'Không bắt buộc pinyin.'
    const topicGuide = `Chủ đề buổi học hiện tại:
- topicId: ${topicId}
- topicLabel: ${topicLabel}
- topicDifficulty: ${topicDifficulty}
- roleplayRole: ${topicRole || 'Facilitator/Coach'}
- objective: ${topicObjective || 'Luyện giao tiếp tự nhiên theo chủ đề'}
- keywords: ${topicKeywords.join(', ') || '(chưa có)'}
- starterSentences: ${topicStarterSentences.join(' | ') || '(chưa có)'}

Yêu cầu triển khai theo chủ đề:
1) Đóng vai đúng roleplayRole để dẫn dắt tự nhiên (ví dụ phỏng vấn viên, nhân viên cửa hàng...).
2) Giữ mỗi lượt phản hồi súc tích, ưu tiên dưới 50 từ cho phần chính bằng ngôn ngữ đang học.
3) Lồng ghép tối thiểu 1 từ khóa chủ đề nếu phù hợp.
4) Sau mỗi lượt, đưa 1 câu hỏi mở tiếp theo để câu chuyện không bị đứt.`

    const transcript = history
      .map((m) => `${m.role === 'teacher' ? 'Teacher' : 'Student'}: ${m.text}`)
      .join('\n')

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    let mixedAnalysisGuide = 'Không có phân tích tách ngôn ngữ độc lập.'
    let mixedNormalizedStudentText = studentText
    let mixedReconstructedTargetSentence = ''
    if (speakingMode === 'mixed' || speakingMode === 'auto') {
      const mixedAnalysisPrompt = `Phân tích câu học viên nói trộn 2 ngôn ngữ:
- Ngôn ngữ đang học: ${targetLanguage}
- Ngôn ngữ mẹ đẻ: ${nativeLanguage}

Nhiệm vụ trong MỘT lần phân tích:
1) Hiểu ý định học sinh đang muốn nói gì.
2) Tách rõ phần ${targetLanguage} mà học sinh đã nói đúng.
3) Tách rõ phần ${nativeLanguage} là chỗ học sinh chưa biết từ ${targetLanguage}.
4) Tạo mapping native -> target cho các chỗ còn thiếu.
5) Dựng lại 1 câu hoàn chỉnh, tự nhiên bằng ${targetLanguage}.
6) TUYỆT ĐỐI không tự chuyển sang ngôn ngữ thứ ba ngoài cặp target/native.
7) mappedPairs.target phải là từ/cụm của ${targetLanguage}, không được đổi sang ngôn ngữ khác.
8) ${pairTransliterationGuide}

Trả về JSON hợp lệ, không markdown:
{
  "learnerIntent": "ý định học sinh đang muốn nói gì (ngắn)",
  "targetKnownFragments": ["các cụm ${targetLanguage} học sinh đã nói đúng/đủ nghĩa"],
  "nativeUnknownFragments": ["các cụm ${nativeLanguage} cần đổi sang ${targetLanguage}"],
  "mappedPairs": [{"native":"...","target":"..."}],
  "reconstructedTargetSentence": "câu hoàn chỉnh tự nhiên bằng ${targetLanguage}"
}

Câu học sinh:
${studentText}`

      try {
        const analysisResult = await model.generateContent(mixedAnalysisPrompt)
        const parsed = toMixedAnalyzeResult(safeJsonObject(analysisResult.response.text()?.trim() || ''))

        const merged = (parsed?.mappedPairs || []).slice(0, 12)
        const mergedIntent =
          parsed?.learnerIntent || 'Học sinh đang hỏi cách nói đúng trong ngôn ngữ đang học.'
        const reconstructed =
          parsed?.reconstructedTargetSentence ||
          'Chưa dựng được câu hoàn chỉnh, cần giáo viên tự dựng câu đúng.'
        mixedReconstructedTargetSentence = reconstructed
        const targetFragments = (parsed?.targetKnownFragments || []).slice(0, 12)
        const nativeFragments = (parsed?.nativeUnknownFragments || []).slice(0, 12)
        const mappedTargets = merged.map((x) => x.target).filter(Boolean)
        const mergedSentenceCandidate = Array.from(new Set([...targetFragments, ...mappedTargets])).join(' ').trim()
        mixedNormalizedStudentText =
          reconstructed && !reconstructed.startsWith('Chưa dựng được')
            ? reconstructed
            : mergedSentenceCandidate || studentText

        mixedAnalysisGuide = `Kết quả phân tích độc lập 2 ngôn ngữ (ưu tiên dùng để phản hồi chính xác):
- Ý định học sinh: ${mergedIntent}
- Cụm ${targetLanguage} đã nói: ${targetFragments.join(', ') || '(không rõ)'}
- Cụm ${nativeLanguage} cần đổi: ${nativeFragments.join(', ') || '(không rõ)'}
- Bản đồ đổi từ/cụm: ${merged.map((x) => `${x.native} -> ${x.target}`).join(' | ') || '(không có)'}
- Câu hoàn chỉnh gợi ý (${targetLanguage}): ${reconstructed}
- Câu chuẩn hóa để gửi giáo viên: ${mixedNormalizedStudentText}`
      } catch {
        mixedAnalysisGuide = `Không phân tích được 2 luồng độc lập, nhưng vẫn phải xử lý mixed theo quy tắc: nhận diện cụm ${nativeLanguage} cần đổi sang ${targetLanguage}, rồi viết câu hoàn chỉnh.`
        mixedNormalizedStudentText = studentText
        mixedReconstructedTargetSentence = ''
      }
    }

    const systemPrompt = `Bạn là ${teacherIdentity} đang dạy học sinh.
Mục tiêu:
1) Mặc định trả lời theo dạng song ngữ "giải thích bằng ${nativeLanguage} trước, sau đó mới đến ${targetLanguage}".
2) Nếu học sinh sai ngữ pháp/từ vựng/phát âm (suy ra từ câu), hãy sửa NGAY nhưng lịch sự.
3) Giữ hội thoại tương tác như nói chuyện thật.
4) ${modeGuide}
5) Phần giải thích trọng tâm phải dùng ${nativeLanguage} để học sinh hiểu nhanh; phần ${targetLanguage} dùng để làm câu mẫu luyện nói.
6) Ưu tiên cách nói bản địa đúng theo locale: ${teacherLocale || 'auto'}.
7) ${learnerContext}
8) explanationVi trong JSON phải là: ${explanationLanguage}.
9) Bạn là giáo viên song ngữ: dùng ${targetLanguage} + ${supportLanguage} để truyền đạt khi học sinh cần hỏi nghĩa/cách nói.
10) ${bilingualGuide}
11) Khi học sinh hỏi kiểu "câu này nói ${targetLanguage} thế nào", reply nên theo cấu trúc:
- Dòng 1: "Giải thích (${nativeLanguage}):" + giải thích ngắn, dễ hiểu.
- Dòng 2: "Từ/cụm cần biết:" và liệt kê ngắn (bằng ${nativeLanguage}).
- Dòng 3: "Câu tự nhiên (${targetLanguage}):" + câu chuẩn bằng ${targetLanguage}.
- Dòng 4 (nếu cần): "Dịch nhanh (${nativeLanguage}):" + nghĩa của câu chuẩn.
12) ${nativeLanguageGuide}
13) ${micGuide}
14) Bắt buộc suy luận "học sinh muốn hỏi gì" trước khi trả lời; không trả lời chung chung.
15) Nếu câu hỏi đến từ ngôn ngữ mẹ đẻ, phải trả lời đúng ý bằng ${nativeLanguage} và đồng thời đưa mẫu câu chuẩn bằng ${targetLanguage}.
16) Không thuyết trình dài hoàn toàn bằng ${targetLanguage} khi chưa có giải thích bằng ${nativeLanguage}.
17) corrections[].explanationVi và pronunciationTips[] phải viết bằng ${nativeLanguage} (ngắn, dễ hiểu cho người mới học).
18) ${speakingModeGuide}
19) Nếu speakingMode là mixed hoặc auto (và câu có trộn), reply phải có thêm đoạn:
- "Phần bạn chưa biết (${nativeLanguage}) -> ${targetLanguage}: ..."
- "Câu hoàn chỉnh (${targetLanguage}): ..."
20) ${strictLanguagePairGuide}
21) Sau mỗi phản hồi, luôn kết thúc bằng 1 câu gợi ý tiếp theo để học sinh trả lời (câu hỏi ngắn hoặc nhiệm vụ ngắn).
22) Nếu học sinh vừa nói đúng/ổn, hãy khen ngắn gọn rồi đưa ngay câu gợi ý tiếp theo.
23) ${howToSayGuide}
24) Nếu speakingMode là mixed hoặc auto, bắt buộc dùng kết quả phân tích 2 ngôn ngữ sau để lọc từ/cụm học sinh còn thiếu trước khi trả lời:
${mixedAnalysisGuide}
25) Áp dụng DUY NHẤT prompt level sau (không trộn level khác):
${levelPromptIndependent}
26) ${micAnalysisGuide}
27) ${pinyinGuide}
28) ${topicGuide}

Đầu ra BẮT BUỘC là JSON hợp lệ, không markdown:
{
  "reply": "câu trả lời của giáo viên bằng ngôn ngữ mục tiêu",
  "corrections": [
    { "original": "...", "fixed": "...", "explanationVi": "giải thích tiếng Việt ngắn gọn" }
  ],
  "pronunciationTips": ["mẹo phát âm ngắn bằng tiếng Việt", "..."]
}`

    const userPrompt = `Lịch sử gần đây:
${transcript || '(trống)'}

Học sinh vừa nói (raw):
${studentText}

Học sinh sau chuẩn hóa mixed (ưu tiên dùng để sửa câu):
${speakingMode === 'mixed' || speakingMode === 'auto' ? mixedNormalizedStudentText : studentText}

Hãy trả về đúng JSON theo format đã yêu cầu.`

    const result = await model.generateContent([systemPrompt, userPrompt])
    const text = result.response.text()?.trim() || ''
    let parsed = safeJsonParse(text)

    if (!parsed) {
      const repairPrompt = `Chuyển nội dung sau thành JSON hợp lệ đúng schema, KHÔNG thêm markdown, KHÔNG thêm giải thích:
{
  "reply": "string",
  "corrections": [
    { "original": "string", "fixed": "string", "explanationVi": "string" }
  ],
  "pronunciationTips": ["string"]
}

Nội dung cần chuyển:
${text}`
      try {
        const repaired = await model.generateContent(repairPrompt)
        const repairedText = repaired.response.text()?.trim() || ''
        parsed = safeJsonParse(repairedText)
      } catch {
        // continue to fallback below
      }
    }

    if (!parsed) {
      const fallbackByCode: Record<string, { reply: string; tip: string }> = {
        en: {
          reply: "Nice try! Please say it again in one short sentence.",
          tip: 'Speak a little slower and stress key words clearly.',
        },
        zh: {
          reply: '很好！请再用一句更短、更清楚的话说一遍。',
          tip: '先放慢语速，再把关键词说清楚。',
        },
        hi: {
          reply: 'बहुत बढ़िया कोशिश! कृपया इसे एक छोटे, स्पष्ट वाक्य में फिर से कहें।',
          tip: 'थोड़ा धीरे बोलें और मुख्य शब्द साफ़ बोलें।',
        },
        th: {
          reply: 'ดีมากครับ/ค่ะ ลองพูดอีกครั้งด้วยประโยคสั้น ๆ ที่ชัดเจนนะ',
          tip: 'พูดช้าลงเล็กน้อยและเน้นคำสำคัญให้ชัดเจน',
        },
        ja: {
          reply: 'いいですね。短くて分かりやすい一文でもう一度言ってみましょう。',
          tip: '少しゆっくり話して、キーワードをはっきり発音しましょう。',
        },
        ko: {
          reply: '좋아요! 짧고 분명한 한 문장으로 다시 말해 볼까요?',
          tip: '조금 천천히 말하고 핵심 단어를 또렷하게 발음해 보세요.',
        },
        vi: {
          reply: 'Tốt lắm! Em thử nói lại bằng một câu ngắn, rõ ý nhé.',
          tip: 'Nói chậm hơn một chút và nhấn rõ từ khóa.',
        },
      }
      const fallback = fallbackByCode[targetLanguageCode] || fallbackByCode.en
      return NextResponse.json({
        reply: fallback.reply,
        corrections: [],
        pronunciationTips: [fallback.tip],
      })
    }

    if (speakingMode === 'mixed' || speakingMode === 'auto') {
      // Keep learner-facing reply concise: avoid internal mixed-analysis blocks.
      if (!/Câu hoàn chỉnh\s*\(/i.test(parsed.reply)) {
        const finalSentence =
          (mixedReconstructedTargetSentence && !mixedReconstructedTargetSentence.startsWith('Chưa dựng được')
            ? mixedReconstructedTargetSentence
            : mixedNormalizedStudentText) || studentText
        parsed.reply = `${parsed.reply}\n\nCâu hoàn chỉnh (${targetLanguage}): ${finalSentence}`
      }
    }

    if (targetLanguageCode === 'zh') {
      // Guardrail: avoid drifting outside selected language pair.
      const hasChinese = /[\u4E00-\u9FFF]/u.test(parsed.reply)
      const hasForeignDefaultPattern = /Câu hoàn chỉnh\s*\([^)]*\)\s*:\s*[A-Za-z][A-Za-z\s'"?!.,-]{5,}/i.test(parsed.reply)
      if (!hasChinese && hasForeignDefaultPattern) {
        try {
          const repairPrompt = `Sửa phản hồi sau để đúng ngôn ngữ đang học là ${targetLanguage}, không dùng ngôn ngữ ngoài cặp ${targetLanguage} + ${nativeLanguage} làm câu chính.
Giữ cấu trúc ngắn gọn, thêm:
- Câu hoàn chỉnh (${targetLanguage}): ...
- Pinyin: ...
- Dịch nhanh (${nativeLanguage}): ...
Trả về JSON hợp lệ:
{"reply":"...","corrections":[],"pronunciationTips":[]}

Nội dung cần sửa:
${parsed.reply}`
          const repaired = await model.generateContent(repairPrompt)
          const repairedParsed = safeJsonParse(repaired.response.text()?.trim() || '')
          if (repairedParsed?.reply) parsed.reply = repairedParsed.reply
        } catch {
          // keep original reply if repair fails
        }
      }
    }

    if (targetLanguageCode === 'zh') {
      const hasChinese = /[\u4E00-\u9FFF]/u.test(parsed.reply)
      const hasPinyin = /Pinyin\s*[:：]/i.test(parsed.reply)
      if (hasChinese && !hasPinyin) {
        const targetSentence = extractPhraseTargetSentence(parsed.reply)
        const sentenceForPinyin = targetSentence || (parsed.reply.match(/[\u4E00-\u9FFF][^\n。！？!?]*[。！？!?]?/u)?.[0] || '')
        if (sentenceForPinyin) {
          try {
            const pinyin = await generatePinyinForSentence(model, sentenceForPinyin)
            if (pinyin) {
              parsed.reply = `${parsed.reply}\nPinyin: ${pinyin}`
            }
          } catch {
            // keep reply if pinyin helper fails
          }
        }
      }
    }

    if (!hasFollowUpPrompt(parsed.reply)) {
      parsed.reply = `${parsed.reply}\n${fallbackFollowUpByLanguageCode(targetLanguageCode, targetLanguage)}`
    }

    if (asksHowToSay) {
      const hasTargetSentence =
        /Câu (chuẩn|tự nhiên|hoàn chỉnh)\s*\(/i.test(parsed.reply) ||
        /Câu (chuẩn|tự nhiên|hoàn chỉnh)\s*(là)?\s*[:：]/i.test(parsed.reply)
      if (!hasTargetSentence) {
        try {
          const forcePrompt = `Học sinh hỏi cách nói câu sau từ ${nativeLanguage} sang ${targetLanguage}:
${studentText}

Trả về JSON hợp lệ, không markdown:
{
  "targetSentence": "một câu tự nhiên bằng ${targetLanguage}",
  "nativeMeaning": "dịch ngắn bằng ${nativeLanguage}"
}`
          const forced = await model.generateContent(forcePrompt)
          const obj = safeJsonObject(forced.response.text()?.trim() || '')
          const targetSentence = String(obj?.targetSentence || '').trim()
          const nativeMeaning = String(obj?.nativeMeaning || '').trim()
          const additions: string[] = []
          additions.push(`Giải thích (${nativeLanguage}): Em đang hỏi cách nói câu này bằng ${targetLanguage}.`)
          if (targetSentence) additions.push(`Câu chuẩn (${targetLanguage}): ${targetSentence}`)
          if (targetLanguageCode === 'zh' && targetSentence) additions.push('Pinyin: (Thầy/cô sẽ đọc mẫu để em bắt chước phát âm)')
          if (nativeMeaning) additions.push(`Dịch nhanh (${nativeLanguage}): ${nativeMeaning}`)
          if (additions.length > 0) parsed.reply = `${parsed.reply}\n\n${additions.join('\n')}`
        } catch {
          // keep original parsed reply if forced enhancement fails
        }
      }
    }

    if (asksHowToSay) {
      const targetSentence = extractPhraseTargetSentence(parsed.reply)
      if (targetSentence) {
        const nativeMeaning = extractPhraseNativeMeaning(parsed.reply, nativeLanguage)
        let pinyin = extractPhrasePinyin(parsed.reply)
        if (targetLanguageCode === 'zh' && !pinyin) {
          try {
            pinyin = await generatePinyinForSentence(model, targetSentence)
            if (pinyin) parsed.reply = `${parsed.reply}\nPinyin: ${pinyin}`
          } catch {
            // ignore pinyin enrichment failure
          }
        }
        await adminSupabase.from('language_coach_phrase_cache').upsert(
          {
            source_text: studentText,
            normalized_source_text: normalizedStudentText,
            target_language: targetLanguage,
            normalized_target_language: normalizedTargetLanguage,
            native_language: nativeLanguage,
            normalized_native_language: normalizedNativeLanguage,
            target_sentence: targetSentence,
            native_meaning: nativeMeaning || null,
            pinyin: pinyin || null,
            source_model: 'gemini-2.5-flash',
            last_used_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'normalized_source_text,normalized_target_language,normalized_native_language' }
        )
      }
    }

    if (targetLanguageCode === 'zh') {
      const replyNativeMeaning = extractPhraseNativeMeaning(parsed.reply, nativeLanguage)
      const replyPinyin = extractPhrasePinyin(parsed.reply)
      const targetSentence = extractPhraseTargetSentence(parsed.reply)
      const chineseSentences = extractChineseSentences(parsed.reply)
      const sentencesToSeed = Array.from(
        new Set([targetSentence, ...chineseSentences].map((x) => String(x || '').trim()).filter(Boolean))
      ).slice(0, 8)
      const normalizedSentences = sentencesToSeed.map((s) => normalizeLookup(s))
      const existingRows = normalizedSentences.length > 0
        ? await adminSupabase
          .from('language_coach_phrase_cache')
          .select('normalized_source_text, pinyin, native_meaning')
          .eq('normalized_target_language', normalizedTargetLanguage)
          .eq('normalized_native_language', normalizedNativeLanguage)
          .in('normalized_source_text', normalizedSentences)
        : { data: null as Array<{ normalized_source_text: string; pinyin: string | null; native_meaning: string | null }> | null }
      const existingByNorm = new Map<string, { pinyin: string; nativeMeaning: string }>()
      for (const row of (existingRows.data || [])) {
        const key = String(row.normalized_source_text || '').trim()
        if (!key) continue
        existingByNorm.set(key, {
          pinyin: String(row.pinyin || '').trim(),
          nativeMeaning: String(row.native_meaning || '').trim(),
        })
      }

      for (const sentence of sentencesToSeed) {
        const normalizedSentence = normalizeLookup(sentence)
        const existing = existingByNorm.get(normalizedSentence)
        let pinyinForSentence = ''
        if (existing?.pinyin) {
          pinyinForSentence = existing.pinyin
        } else if (replyPinyin && targetSentence && sentence === targetSentence) {
          pinyinForSentence = replyPinyin
        } else {
          try {
            pinyinForSentence = await generatePinyinForSentence(model, sentence)
          } catch {
            pinyinForSentence = ''
          }
        }
        const nativeMeaningForSentence =
          sentence === targetSentence
            ? (replyNativeMeaning || existing?.nativeMeaning || null)
            : (existing?.nativeMeaning || null)
        await adminSupabase.from('language_coach_phrase_cache').upsert(
          {
            source_text: sentence,
            normalized_source_text: normalizedSentence,
            target_language: targetLanguage,
            normalized_target_language: normalizedTargetLanguage,
            native_language: nativeLanguage,
            normalized_native_language: normalizedNativeLanguage,
            target_sentence: sentence,
            native_meaning: nativeMeaningForSentence,
            pinyin: pinyinForSentence || null,
            source_model: 'zh-reply-seed',
            last_used_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'normalized_source_text,normalized_target_language,normalized_native_language' }
        )
      }
    }

    return NextResponse.json(parsed)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

