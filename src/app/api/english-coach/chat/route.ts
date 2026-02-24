import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'

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
  sessionId?: string
  studentText?: string
  history?: ChatMessage[]
  accent?: TeacherAccent
  gender?: TeacherGender
  mode?: 'chat' | 'listen_speak' | 'roleplay_short'
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
  responseStyle?: 'detailed' | 'concise'
  learnerLevel?: 0 | 1 | 2 | 3 | 4
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
    pronunciationAccuracy?: number
    pronunciationFluency?: number
    pronunciationProsody?: number
    wordScores?: Array<{
      word?: string
      score?: number
      issueType?: string
    }>
  }
}

type SessionPinnedFacts = {
  repeatedMistakes: string[]
  correctedSentences: string[]
  learnedPhrases: string[]
  topicFocus: string
}

function parsePinnedFacts(raw: string): SessionPinnedFacts {
  try {
    const parsed = JSON.parse(String(raw || '{}')) as Partial<SessionPinnedFacts>
    return {
      repeatedMistakes: Array.isArray(parsed.repeatedMistakes)
        ? parsed.repeatedMistakes.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 12)
        : [],
      correctedSentences: Array.isArray(parsed.correctedSentences)
        ? parsed.correctedSentences.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 12)
        : [],
      learnedPhrases: Array.isArray(parsed.learnedPhrases)
        ? parsed.learnedPhrases.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 16)
        : [],
      topicFocus: String(parsed.topicFocus || '').trim(),
    }
  } catch {
    return { repeatedMistakes: [], correctedSentences: [], learnedPhrases: [], topicFocus: '' }
  }
}

function mergeUniqueLimited(base: string[], add: string[], limit: number): string[] {
  const out: string[] = []
  for (const item of [...base, ...add]) {
    const text = String(item || '').trim()
    if (!text) continue
    if (!out.includes(text)) out.push(text)
    if (out.length >= limit) break
  }
  return out
}

function updateRunningSummary(previous: string, studentText: string, teacherReply: string): string {
  const parts = [
    String(previous || '').trim(),
    `Student: ${String(studentText || '').trim()}`,
    `Teacher: ${String(teacherReply || '').trim()}`,
  ]
  return parts
    .filter(Boolean)
    .join('\n')
    .slice(-2400)
}

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function normalizeLookup(input: string): string {
  return String(input || '').trim().toLowerCase()
}

function extractPhraseTargetSentence(reply: string): string {
  const patterns = [
    /câu đúng\s*(sẽ)?\s*là\s*[:：]?\s*([^\n]+)/i,
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

function isLikelyFullSentence(text: string, targetLanguageCode: string): boolean {
  const t = String(text || '').trim()
  if (!t) return false
  if (targetLanguageCode === 'zh') return /[\u4E00-\u9FFF]/u.test(t) && t.length >= 4
  if (targetLanguageCode === 'ja') return /[\u3040-\u30FF\u4E00-\u9FFF]/u.test(t) && t.length >= 4
  if (targetLanguageCode === 'ko') return /[\uAC00-\uD7AF]/u.test(t) && t.length >= 3
  if (targetLanguageCode === 'th') return /[\u0E00-\u0E7F]/u.test(t) && t.length >= 4
  if (targetLanguageCode === 'hi') return /[\u0900-\u097F]/u.test(t) && t.length >= 4
  const words = t.split(/\s+/).filter(Boolean)
  return words.length >= 4
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
  if (code === 'zh') return '你可以再用一句话说说你今天的计划吗？'
  if (code === 'ja') return '次は、今日の予定を一文で言ってみましょうか？'
  if (code === 'ko') return '다음으로 오늘 계획을 한 문장으로 말해 볼까요?'
  if (code === 'th') return 'ต่อไปลองพูดแผนวันนี้ของคุณหนึ่งประโยคได้ไหม?'
  if (code === 'hi') return 'क्या आप आज की अपनी योजना एक वाक्य में बता सकते हैं?'
  if (code === 'vi') return 'Bạn có thể nói thêm một câu về kế hoạch hôm nay không?'
  return `Can you say one more sentence in ${targetLanguage} to continue this conversation?`
}

function repeatMeaningFallbackByLanguageCode(code: string): string {
  if (code === 'zh') return '这是老师刚刚说的句子，帮助你继续这段对话。'
  if (code === 'ja') return 'これは先生がさっき言った文で、会話を続けるためのヒントです。'
  if (code === 'ko') return '이 문장은 선생님이 방금 말한 문장으로, 대화를 이어가기 위한 힌트예요.'
  if (code === 'th') return 'นี่คือประโยคที่ครูเพิ่งพูด เพื่อช่วยให้คุณคุยต่อได้'
  if (code === 'hi') return 'यह वही वाक्य है जो शिक्षक ने अभी कहा, ताकि आप बातचीत जारी रख सकें।'
  if (code === 'vi') return 'Đây là câu thầy/cô vừa nói để bạn trả lời tiếp trong hội thoại.'
  return 'This is the sentence the teacher just said to help you continue the conversation.'
}

function pronunciationTipByNativeLanguageCode(code: string): string {
  if (code === 'zh') return '先放慢一点语速，再把关键词说清楚。'
  if (code === 'ja') return '少しゆっくり話して、キーワードをはっきり発音しましょう。'
  if (code === 'ko') return '조금 천천히 말하고 핵심 단어를 또렷하게 발음해 보세요.'
  if (code === 'th') return 'พูดช้าลงเล็กน้อยและเน้นคำสำคัญให้ชัดเจน'
  if (code === 'hi') return 'थोड़ा धीरे बोलें और मुख्य शब्द साफ़ बोलें।'
  if (code === 'vi') return 'Nói chậm hơn một chút và nhấn rõ từ khóa.'
  return 'Speak a little slower and stress key words clearly.'
}

function targetScriptRegexByCode(code: string): RegExp | null {
  if (code === 'zh') return /[\u4E00-\u9FFF]/u
  if (code === 'ja') return /[\u3040-\u30FF\u4E00-\u9FFF]/u
  if (code === 'ko') return /[\uAC00-\uD7AF]/u
  if (code === 'th') return /[\u0E00-\u0E7F]/u
  if (code === 'hi') return /[\u0900-\u097F]/u
  return null
}

function hasVietnameseDiacritics(text: string): boolean {
  return /[ăâđêôơưĂÂĐÊÔƠƯáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/u.test(text)
}

function shouldRepairIntentAnswerToTargetLanguage(intentAnswer: string, targetLanguageCode: string, targetScriptRe: RegExp | null): boolean {
  const text = String(intentAnswer || '').trim()
  if (!text) return true
  if (targetLanguageCode === 'en') {
    if (hasVietnameseDiacritics(text)) return true
    if (/[\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\u0E00-\u0E7F\u0900-\u097F]/u.test(text)) return true
    return false
  }
  if (targetScriptRe) return !targetScriptRe.test(text)
  return false
}

function localizedCoachLabels(nativeLanguageCode: string) {
  const code = String(nativeLanguageCode || '').toLowerCase()
  const byCode: Record<string, {
    explain: string
    quickTranslation: string
    teacherSaid: string
    repeatSlowly: string
    askReplyAgain: string
    howToSayExplain: string
    howToSayPrompt: string
    howToSayExplainDynamic: (targetLanguage: string) => string
    fullSentence: string
    standardSentence: string
  }> = {
    vi: {
      explain: 'Giải thích',
      quickTranslation: 'Dịch nhanh',
      teacherSaid: 'Câu thầy/cô vừa nói',
      repeatSlowly: 'Không sao, thầy/cô nhắc lại câu vừa rồi thật chậm nhé.',
      askReplyAgain: 'Em thử trả lời lại theo câu này nhé?',
      howToSayExplain: 'Đây là câu hỏi cách nói rất thông dụng.',
      howToSayPrompt: 'Em thử đọc lại câu chuẩn này một lần nhé?',
      howToSayExplainDynamic: (targetLanguage: string) => `Em đang hỏi cách nói câu này bằng ${targetLanguage}.`,
      fullSentence: 'Câu hoàn chỉnh',
      standardSentence: 'Câu chuẩn',
    },
    en: {
      explain: 'Explanation',
      quickTranslation: 'Quick translation',
      teacherSaid: 'Teacher just said',
      repeatSlowly: 'No worries. I will repeat the previous sentence more slowly.',
      askReplyAgain: 'Please try answering again using this sentence.',
      howToSayExplain: 'This is a common “how to say it” question.',
      howToSayPrompt: 'Please repeat this correct sentence once.',
      howToSayExplainDynamic: (targetLanguage: string) => `You are asking how to say this sentence in ${targetLanguage}.`,
      fullSentence: 'Complete sentence',
      standardSentence: 'Correct sentence',
    },
    th: {
      explain: 'คำอธิบาย',
      quickTranslation: 'แปลเร็ว',
      teacherSaid: 'ประโยคที่ครูเพิ่งพูด',
      repeatSlowly: 'ไม่เป็นไร เดี๋ยวครูพูดประโยคเมื่อกี้ช้า ๆ อีกครั้งนะ',
      askReplyAgain: 'ลองตอบอีกครั้งด้วยประโยคนี้นะ',
      howToSayExplain: 'นี่เป็นคำถาม “พูดแบบนี้ว่าอย่างไร” ที่ใช้บ่อยมาก',
      howToSayPrompt: 'ลองพูดประโยคมาตรฐานนี้อีกหนึ่งครั้งนะ',
      howToSayExplainDynamic: (targetLanguage: string) => `คุณกำลังถามว่า ประโยคนี้พูดเป็น ${targetLanguage} อย่างไร`,
      fullSentence: 'ประโยคสมบูรณ์',
      standardSentence: 'ประโยคมาตรฐาน',
    },
    ja: {
      explain: '説明',
      quickTranslation: 'クイック訳',
      teacherSaid: '先生がさっき言った文',
      repeatSlowly: '大丈夫です。今の文をゆっくりもう一度言いますね。',
      askReplyAgain: 'この文でもう一度答えてみましょう。',
      howToSayExplain: 'これはよく使う「どう言うの？」の質問です。',
      howToSayPrompt: 'この自然な文を一度読んでみましょう。',
      howToSayExplainDynamic: (targetLanguage: string) => `この文を${targetLanguage}でどう言うかを聞いています。`,
      fullSentence: '完成文',
      standardSentence: '自然な文',
    },
    ko: {
      explain: '설명',
      quickTranslation: '빠른 번역',
      teacherSaid: '방금 선생님이 말한 문장',
      repeatSlowly: '괜찮아요. 방금 문장을 천천히 다시 말해 줄게요.',
      askReplyAgain: '이 문장으로 다시 대답해 볼까요?',
      howToSayExplain: '이건 자주 쓰는 “이걸 어떻게 말해요?” 질문이에요.',
      howToSayPrompt: '이 자연스러운 문장을 한 번 따라 말해 보세요.',
      howToSayExplainDynamic: (targetLanguage: string) => `이 문장을 ${targetLanguage}로 어떻게 말하는지 묻고 있어요.`,
      fullSentence: '완성 문장',
      standardSentence: '표준 문장',
    },
    zh: {
      explain: '解释',
      quickTranslation: '快速翻译',
      teacherSaid: '老师刚才说的句子',
      repeatSlowly: '没关系，我把刚才那句话慢慢再说一遍。',
      askReplyAgain: '你再用这句话回答一次吧。',
      howToSayExplain: '这是很常见的“这句话怎么说”提问。',
      howToSayPrompt: '请把这句标准句再读一遍。',
      howToSayExplainDynamic: (targetLanguage: string) => `你在问这句话用${targetLanguage}怎么说。`,
      fullSentence: '完整句子',
      standardSentence: '标准句子',
    },
    hi: {
      explain: 'व्याख्या',
      quickTranslation: 'त्वरित अनुवाद',
      teacherSaid: 'शिक्षक ने अभी कहा',
      repeatSlowly: 'कोई बात नहीं, मैं वही वाक्य धीरे से फिर बोलता/बोलती हूँ।',
      askReplyAgain: 'कृपया इसी वाक्य से फिर उत्तर दें।',
      howToSayExplain: 'यह बहुत सामान्य “इसे कैसे कहें” वाला प्रश्न है।',
      howToSayPrompt: 'कृपया इस सही वाक्य को एक बार दोहराएँ।',
      howToSayExplainDynamic: (targetLanguage: string) => `आप पूछ रहे हैं कि यह वाक्य ${targetLanguage} में कैसे कहें।`,
      fullSentence: 'पूरा वाक्य',
      standardSentence: 'मानक वाक्य',
    },
  }
  return byCode[code] || byCode.en
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

function extractLatestTeacherQuestion(history: ChatMessage[], targetLanguageCode: string, targetLanguage: string): string {
  const normalizeQuestionLine = (line: string): string => {
    return String(line || '')
      .replace(/^Câu hỏi vừa rồi\s*\([^)]+\)\s*:\s*/i, '')
      .replace(/^Câu hỏi tiếp theo\s*:\s*/i, '')
      .replace(/^Next question\s*:\s*/i, '')
      .trim()
  }
  const isGenericFollowup = (line: string): boolean => {
    const t = normalizeLookup(normalizeQuestionLine(line))
    return (
      t.includes('can you say one more sentence in') && t.includes('to continue this conversation')
    ) || t.includes('bạn có thể nói thêm một câu về kế hoạch hôm nay')
  }

  const teachers = history.filter((m) => m.role === 'teacher').map((m) => String(m.text || '').trim()).filter(Boolean)
  if (teachers.length === 0) return fallbackFollowUpByLanguageCode(targetLanguageCode, targetLanguage)
  const latestTeacher = teachers[teachers.length - 1]
  const lines = latestTeacher
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
  const explicitFollowup = lines
    .filter((line) => /Câu hỏi tiếp theo|next question|Câu hỏi vừa rồi/i.test(line))
    .map(normalizeQuestionLine)
    .find((line) => line && !isGenericFollowup(line))
  if (explicitFollowup) return explicitFollowup

  const questionLike = lines
    .slice()
    .reverse()
    .map(normalizeQuestionLine)
    .find((line) => line && !isGenericFollowup(line) && (/[?？]$/.test(line) || /Can you|Could you|What|How|Why|Bạn có thể|Em thử/i.test(line)))
  return questionLike || normalizeQuestionLine(fallbackFollowUpByLanguageCode(targetLanguageCode, targetLanguage))
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
  mainSentence: string
  mustKnowText: string
  correctionNote: string
  intentAnswer: string
  correctedSentence: string
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
      mainSentence?: string
      mustKnowText?: string
      correctionNote?: string
      intentAnswer?: string
      correctedSentence?: string
    }
    if (!parsed.reply || typeof parsed.reply !== 'string') return null
    return {
      reply: parsed.reply,
      corrections: Array.isArray(parsed.corrections) ? parsed.corrections.slice(0, 5) : [],
      pronunciationTips: Array.isArray(parsed.pronunciationTips) ? parsed.pronunciationTips.slice(0, 5) : [],
      mainSentence: String(parsed.mainSentence || '').trim(),
      mustKnowText: String(parsed.mustKnowText || '').trim(),
      correctionNote: String(parsed.correctionNote || '').trim(),
      intentAnswer: String(parsed.intentAnswer || '').trim(),
      correctedSentence: String(parsed.correctedSentence || '').trim(),
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
    const sessionId = String(payload.sessionId || '').trim()
    const studentText = String(payload.studentText || '').trim()
    const history = Array.isArray(payload.history) ? payload.history.slice(-10) : []
    const accent: TeacherAccent = payload.accent === 'uk' ? 'uk' : 'us'
    const gender: TeacherGender = payload.gender === 'male' ? 'male' : 'female'
    const mode: 'chat' | 'listen_speak' | 'roleplay_short' =
      payload.mode === 'listen_speak'
        ? 'listen_speak'
        : payload.mode === 'roleplay_short'
          ? 'roleplay_short'
          : 'chat'
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
    const responseStyle = payload.responseStyle === 'concise' ? 'concise' : 'detailed'
    const learnerLevelRaw = Number(payload.learnerLevel)
    const learnerLevel: 0 | 1 | 2 | 3 | 4 =
      learnerLevelRaw === 4 ? 4 : learnerLevelRaw === 3 ? 3 : learnerLevelRaw === 2 ? 2 : learnerLevelRaw === 1 ? 1 : 0
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
    const micPronunciationAccuracy = Number.isFinite(Number(micAnalysis?.pronunciationAccuracy))
      ? Math.min(100, Math.max(0, Math.round(Number(micAnalysis?.pronunciationAccuracy))))
      : null
    const micPronunciationFluency = Number.isFinite(Number(micAnalysis?.pronunciationFluency))
      ? Math.min(100, Math.max(0, Math.round(Number(micAnalysis?.pronunciationFluency))))
      : null
    const micPronunciationProsody = Number.isFinite(Number(micAnalysis?.pronunciationProsody))
      ? Math.min(100, Math.max(0, Math.round(Number(micAnalysis?.pronunciationProsody))))
      : null
    const micWordScores = Array.isArray(micAnalysis?.wordScores)
      ? micAnalysis.wordScores
        .map((x) => ({
          word: String(x?.word || '').trim(),
          score: Number.isFinite(Number(x?.score)) ? Math.min(100, Math.max(0, Math.round(Number(x?.score)))) : 0,
          issueType: String(x?.issueType || '').trim() || 'unclear',
        }))
        .filter((x) => x.word)
        .slice(0, 12)
      : []
    const asksHowToSay = /(nói.*thế nào|nói.*sao|how to say|怎么说|怎麼說)/i.test(studentText)
    const asksContextualTargetSentence =
      /(i want to say|i want to ask|mình muốn nói|tôi muốn nói|muốn hỏi|cửa hàng|shop|store|sell|bán)/i.test(studentText)
    const labels = localizedCoachLabels(nativeLanguageCode)
    const asksRepeatPrevious =
      /^(what did you say|could you repeat|can you repeat|sorry\?|pardon\?|huh\?|bạn nói gì|nhắc lại|nói lại|em chưa hiểu)/i.test(
        studentText.toLowerCase()
      )

    if (!studentText) {
      return NextResponse.json({ error: 'Thiếu nội dung học sinh.' }, { status: 400 })
    }

    const normalizedStudentText = normalizeLookup(studentText)
    const normalizedTargetLanguage = normalizeLookup(targetLanguage)
    const normalizedNativeLanguage = normalizeLookup(nativeLanguage)
    const adminSupabase = adminClient()
    let userId = ''
    let sessionMemory: { runningSummary: string; pinnedFacts: SessionPinnedFacts } = {
      runningSummary: '',
      pinnedFacts: { repeatedMistakes: [], correctedSentences: [], learnedPhrases: [], topicFocus: '' },
    }
    if (sessionId) {
      const supabase = createClient()
      const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để học cùng AI.')
      if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
      userId = auth.user.id
      const { data: memoryRows } = await adminSupabase
        .from('language_coach_session_memories')
        .select('running_summary, pinned_facts_json')
        .eq('user_id', userId)
        .eq('session_id', sessionId)
        .limit(1)
      const memory = Array.isArray(memoryRows) && memoryRows.length > 0 ? memoryRows[0] : null
      sessionMemory = {
        runningSummary: String(memory?.running_summary || '').trim(),
        pinnedFacts: parsePinnedFacts(String(memory?.pinned_facts_json || '{}')),
      }
    }
    const asksReviewFar =
      /(ôn lại|ôn tập|review|recap|nhắc lại phần trước|phần trước|earlier lesson|previous lesson|lúc nãy|hồi nãy)/i.test(studentText)
    let retrievalGuide = 'Không yêu cầu truy xuất ngữ cảnh xa.'
    if (asksReviewFar && userId) {
      const recallQuery = adminSupabase
        .from('language_coach_messages')
        .select('role, text, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(40)
      if (sessionId) recallQuery.neq('session_id', sessionId)
      const { data: recallRows } = await recallQuery
      const recalled = (recallRows || [])
        .map((row) => `${row.role === 'teacher' ? 'Teacher' : 'Student'}: ${String(row.text || '').slice(0, 220)}`)
        .slice(0, 12)
      retrievalGuide =
        recalled.length > 0
          ? `Học sinh đang yêu cầu ôn lại phần cũ. Dữ liệu gốc truy xuất từ các buổi trước:\n${recalled.join('\n')}`
          : 'Học sinh yêu cầu ôn lại nhưng chưa có dữ liệu buổi cũ rõ ràng.'
    }
    if (asksRepeatPrevious) {
      const latestQuestion = extractLatestTeacherQuestion(history, targetLanguageCode, targetLanguage)
      let nativeMeaning = repeatMeaningFallbackByLanguageCode(nativeLanguageCode)
      try {
        const repeatGenAI = new GoogleGenerativeAI(apiKey)
        const repeatModel = repeatGenAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
        const meaningPrompt = `Dịch và giải thích rất ngắn câu sau sang ${nativeLanguage}.
Yêu cầu:
- Chỉ trả về đúng 1-2 câu ngắn bằng ${nativeLanguage}.
- Không thêm markdown, không thêm tiêu đề.
- Giữ đúng nghĩa thực tế trong ngữ cảnh hội thoại học ngoại ngữ.

Câu cần giải thích (${targetLanguage}):
${latestQuestion}`
        const meaningRes = await repeatModel.generateContent(meaningPrompt)
        const meaningText = String(meaningRes.response.text?.() || '').replace(/^```|```$/g, '').trim()
        if (meaningText) nativeMeaning = meaningText
      } catch {
        // keep fallback meaning when quick translation fails
      }
      const replyLines = [
        `${labels.explain} (${nativeLanguage}): ${labels.repeatSlowly}`,
        `${labels.teacherSaid} (${targetLanguage}): ${latestQuestion}`,
        `${labels.quickTranslation} (${nativeLanguage}): ${nativeMeaning}`,
        labels.askReplyAgain,
      ]
      return NextResponse.json({
        reply: replyLines.join('\n'),
        corrections: [],
        pronunciationTips: [pronunciationTipByNativeLanguageCode(nativeLanguageCode)],
        mainSentence: latestQuestion,
        mustKnowText: latestQuestion,
        correctionNote: '',
        intentAnswer: latestQuestion,
        correctedSentence: latestQuestion,
      })
    }
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
          `${labels.explain} (${nativeLanguage}): ${labels.howToSayExplain}`,
          `${labels.standardSentence} (${targetLanguage}): ${String(phraseCached.target_sentence || '').trim()}`,
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
          replyLines.push(`${labels.quickTranslation} (${nativeLanguage}): ${nativeMeaning}`)
        }
        replyLines.push(labels.howToSayPrompt)
        return NextResponse.json({
          reply: replyLines.join('\n'),
          corrections: [],
          pronunciationTips: [pronunciationTipByNativeLanguageCode(nativeLanguageCode)],
          cachedPhrase: true,
          mainSentence: String(phraseCached.target_sentence || '').trim(),
          mustKnowText: String(phraseCached.target_sentence || '').trim(),
          correctionNote: '',
          intentAnswer: '',
          correctedSentence: String(phraseCached.target_sentence || '').trim(),
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
    const modePrompt = (() => {
      if (mode === 'listen_speak') {
        return `PROMPT MODE LISTEN_SPEAK (độc lập):
- Mục tiêu: luyện phản xạ nghe-nói nhanh.
- Nguyên tắc chính:
  1) Ưu tiên nhắc lại câu học sinh theo phiên bản tự nhiên hơn bằng ${targetLanguage}.
  2) KHÔNG sửa nhiều; tối đa 1 lỗi trọng tâm nếu lỗi làm sai nghĩa.
  3) corrections chỉ trả tối đa 1 item, pronunciationTips tối đa 1 item.
  4) Giữ phản hồi thật ngắn, thiên về mẫu câu để học sinh nhại lại.
  5) Mỗi lượt đều có lời mời học sinh nói lại 1 câu mới để duy trì nhịp phản xạ.
- Tránh giải thích dài dòng ngữ pháp trong mode này.`
      }
      if (mode === 'roleplay_short') {
        return `PROMPT MODE ROLEPLAY_SHORT (độc lập):
- Mục tiêu: luyện phản xạ giao tiếp theo tình huống thực tế ngắn.
- Cách vận hành:
  1) Đóng vai theo topicRole/tình huống hiện tại.
  2) Mỗi lượt chỉ đẩy 1 bước hội thoại ngắn (1 nhiệm vụ hoặc 1 câu hỏi).
  3) Ưu tiên câu trả lời mẫu tự nhiên, dùng được ngay.
  4) Chỉ sửa 1 lỗi trọng tâm ảnh hưởng rõ nghĩa; tránh phân tích dài.
  5) Kết thúc mỗi lượt bằng câu hỏi nhập vai tiếp theo để giữ nhịp.
- Giữ ngữ cảnh thực chiến (lễ tân, phỏng vấn, gọi món, chăm sóc khách...) thay vì nói chung chung.`
      }
      return `PROMPT MODE CHAT (độc lập):
- Mục tiêu: hội thoại đời thường thực tế.
- Phong cách: thân thiện, tự nhiên, câu ngắn rõ ý.
- Mỗi lượt:
  1) Trả lời đúng ý học sinh.
  2) Sửa lỗi trọng tâm (nếu có) bằng giải thích ngắn.
  3) Đưa 1 câu hỏi mở tiếp theo để giữ nhịp hội thoại.`
    })()
    const responseStyleGuide =
      responseStyle === 'concise'
        ? `Phong cách trả lời: NGẮN GỌN.
- Mỗi lượt ưu tiên 3 phần: (1) sửa lỗi trọng tâm ngắn, (2) 1 câu mẫu chuẩn bằng ${targetLanguage}, (3) đúng 1 câu hỏi tiếp theo.
- Tránh lặp ý, tránh thêm nhiều đoạn phụ như "Dịch nhanh" khi không cần.
- Tổng phản hồi cố gắng trong 3-5 dòng ngắn.`
        : `Phong cách trả lời: CHI TIẾT.
- Có thể giải thích đầy đủ hơn cho người mới học.
- Vẫn tránh lặp ý và vẫn chỉ giữ 1 câu hỏi tiếp theo để không gây rối.`
    const explanationLanguage = `Dùng ${nativeLanguage} đơn giản`
    const bilingualGuide = `Nếu học sinh dùng ngôn ngữ mẹ đẻ ${nativeLanguage} hoặc trộn ngôn ngữ, hãy:
- Giải thích nhanh ý nghĩa bằng ${nativeLanguage}.
- Tách các từ/cụm từ khó trong câu (nếu có) và giải thích ngắn bằng ${nativeLanguage}.
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
- pronunciationAccuracy: ${micPronunciationAccuracy == null ? '(không có)' : `${micPronunciationAccuracy}/100`}
- pronunciationFluency: ${micPronunciationFluency == null ? '(không có)' : `${micPronunciationFluency}/100`}
- pronunciationProsody: ${micPronunciationProsody == null ? '(không có)' : `${micPronunciationProsody}/100`}
- weakWords: ${micWeakWords.join(' | ') || '(không có)'}
- wordScores: ${micWordScores.map((x) => `${x.word}:${x.score}(${x.issueType})`).join(' | ') || '(không có)'}
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
    const contextualReplyGuide = asksContextualTargetSentence
      ? `Học sinh có ý định hỏi/diễn đạt theo ngữ cảnh hội thoại thực tế (ví dụ hỏi cửa hàng bán gì).
BẮT BUỘC phản hồi theo thứ tự tự nhiên:
1) Sửa câu học sinh thành 1 câu chuẩn dùng được ngay trong ${targetLanguage}.
2) Trả lời trực tiếp theo đúng vai hội thoại hiện tại (ví dụ nếu đang vai chủ cửa hàng thì nêu 2-4 món cụ thể đang bán).
3) Đặt 1 câu hỏi tiếp nối bám sát ngữ cảnh đó (không hỏi chung chung).
4) Tránh nói meta dài dòng kiểu "em muốn nói..." khi đã hiểu ý; ưu tiên nói như hội thoại thật.`
      : 'Không có yêu cầu bắt buộc trả lời theo vai ngữ cảnh đặc biệt.'
    const levelPromptIndependent =
      learnerLevel === 0
        ? `PROMPT LEVEL 0 (độc lập):
- Mục tiêu: absolute beginner, xây nền từ số 0.
- Tỷ lệ ngôn ngữ: ~90% ${nativeLanguage}, ~10% ${targetLanguage}.
- Câu mẫu ${targetLanguage}: siêu ngắn, 3-6 từ; tối đa 1 câu chính + 1 câu hỏi đóng.
- Từ vựng: cực cơ bản, lặp lại có kiểm soát.
- Cách phản hồi: khen ngắn + sửa 1 lỗi lớn nhất + yêu cầu lặp lại đúng đúng 1 câu.`
        : learnerLevel === 1
          ? `PROMPT LEVEL 1 (độc lập):
- Mục tiêu: beginner vững căn bản và bắt đầu tự nói.
- Tỷ lệ ngôn ngữ: ~75% ${nativeLanguage}, ~25% ${targetLanguage}.
- Câu mẫu ${targetLanguage}: 1-2 câu ngắn, cấu trúc lặp dễ bắt chước.
- Từ vựng: cơ bản theo chủ đề.
- Cách phản hồi: sửa 1 lỗi chính + thêm 1 biến thể ngắn để luyện.`
          : learnerLevel === 2
            ? `PROMPT LEVEL 2 (độc lập):
- Mục tiêu: elementary, cân bằng hiểu nghĩa và phản xạ.
- Tỷ lệ ngôn ngữ: ~55% ${nativeLanguage}, ~45% ${targetLanguage}.
- Câu mẫu ${targetLanguage}: 2 câu ngắn, có thay từ theo ngữ cảnh.
- Từ vựng: cơ bản + trung bình thấp.
- Cách phản hồi: sửa lỗi ngắn gọn, giải thích đủ hiểu, kết thúc bằng 1 câu hỏi mở đơn giản.`
            : learnerLevel === 3
              ? `PROMPT LEVEL 3 (độc lập):
- Mục tiêu: intermediate, tăng tốc hội thoại tự nhiên.
- Tỷ lệ ngôn ngữ: ~35% ${nativeLanguage}, ~65% ${targetLanguage}.
- Câu mẫu ${targetLanguage}: 2-3 câu ngắn, tự nhiên, có liên kết ý.
- Từ vựng: trung bình, giàu ngữ cảnh thực tế.
- Cách phản hồi: ưu tiên target language, chỉ giải thích native khi cần làm rõ lỗi khó.`
              : `PROMPT LEVEL 4 (độc lập):
- Mục tiêu: ưu tiên giao tiếp thực chiến bằng ${targetLanguage}.
- Tỷ lệ ngôn ngữ: ~90% ${targetLanguage}, ~10% ${nativeLanguage} (chỉ khi làm rõ lỗi khó).
- Câu mẫu ${targetLanguage}: tự nhiên, mạch hội thoại dài vừa phải.
- Từ vựng: trung-cao đến nâng cao theo chủ đề.
- Cách phản hồi: hạn chế dịch, tập trung sắc thái, độ chính xác và mở rộng hội thoại.`
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
4) Áp dụng mode prompt độc lập sau:
${modePrompt}
4.1) ${responseStyleGuide}
5) Phần giải thích trọng tâm phải dùng ${nativeLanguage} để học sinh hiểu nhanh; phần ${targetLanguage} dùng để làm câu mẫu luyện nói.
6) Ưu tiên cách nói bản địa đúng theo locale: ${teacherLocale || 'auto'}.
7) ${learnerContext}
8) explanationVi (nhãn giữ nguyên vì tương thích schema cũ) phải là: ${explanationLanguage}.
9) Bạn là giáo viên song ngữ: CHỈ dùng đúng cặp ${targetLanguage} + ${nativeLanguage} để truyền đạt khi học sinh hỏi nghĩa/cách nói.
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
24) ${contextualReplyGuide}
25) Nếu speakingMode là mixed hoặc auto, bắt buộc dùng kết quả phân tích 2 ngôn ngữ sau để lọc từ/cụm học sinh còn thiếu trước khi trả lời:
${mixedAnalysisGuide}
26) Áp dụng DUY NHẤT prompt level sau (không trộn level khác):
${levelPromptIndependent}
27) ${micAnalysisGuide}
28) ${pinyinGuide}
29) ${topicGuide}
30) KHÓA GIỚI GIÁO VIÊN: luôn giữ đúng persona ${genderLabel}. Không đổi sang giọng/vai nữ nếu đang là nam, và ngược lại.
31) KHÓA NGÔN NGỮ CẶP ĐÔI: Trong phần reply cho học sinh, CHỈ dùng đúng 2 ngôn ngữ của cặp đã chọn (${targetLanguage} + ${nativeLanguage}). Không dùng nhãn/cụm của ngôn ngữ thứ ba.
32) TRƯỜNG intentAnswer (Ý 3 - trả lời ngữ cảnh) PHẢI viết CHỈ bằng ${targetLanguage}, 1-2 câu ngắn, không trộn ${nativeLanguage}.
33) MEMORY NGẮN HẠN (hỗ trợ, không thay thế dữ liệu gốc):
- Running summary: ${sessionMemory.runningSummary || '(chưa có)'}
- Pinned repeatedMistakes: ${sessionMemory.pinnedFacts.repeatedMistakes.join(' | ') || '(trống)'}
- Pinned correctedSentences: ${sessionMemory.pinnedFacts.correctedSentences.join(' | ') || '(trống)'}
- Pinned learnedPhrases: ${sessionMemory.pinnedFacts.learnedPhrases.join(' | ') || '(trống)'}
- Pinned topicFocus: ${sessionMemory.pinnedFacts.topicFocus || '(trống)'}
34) RETRIEVAL KHI ÔN XA:
${retrievalGuide}
35) Khi retrieval có dữ liệu, ưu tiên trả đúng kiến thức cũ theo dữ liệu gốc, sau đó mới mở rộng.

Đầu ra BẮT BUỘC là JSON hợp lệ, không markdown:
{
  "reply": "câu trả lời của giáo viên bằng ngôn ngữ mục tiêu",
  "corrections": [
    { "original": "...", "fixed": "...", "explanationVi": "giải thích ngắn bằng ngôn ngữ mẹ đẻ" }
  ],
  "pronunciationTips": ["mẹo phát âm ngắn bằng ngôn ngữ mẹ đẻ", "..."],
  "correctionNote": "Ý 1: sửa lỗi ngắn gọn cho câu học sinh",
  "correctedSentence": "Ý 2: câu sửa hoàn chỉnh cuối cùng của học sinh",
  "intentAnswer": "Ý 3: trả lời đúng ý hỏi của học sinh theo ngữ cảnh hội thoại tự nhiên, CHỈ bằng ngôn ngữ đang học",
  "mainSentence": "1 câu chính để nút Nghe câu chính đọc đúng",
  "mustKnowText": "1 câu/cụm quan trọng nhất cần học viên nghe rõ (để nút Nghe phần cần biết đọc riêng)"
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
  "pronunciationTips": ["string"],
  "correctionNote": "string",
  "intentAnswer": "string",
  "correctedSentence": "string",
  "mainSentence": "string",
  "mustKnowText": "string"
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
        mainSentence: fallback.reply,
        mustKnowText: fallback.reply,
        correctionNote: '',
        intentAnswer: fallback.reply,
        correctedSentence: fallback.reply,
      })
    }

    if (mode === 'listen_speak') {
      parsed.corrections = parsed.corrections.slice(0, 1)
      parsed.pronunciationTips = parsed.pronunciationTips.slice(0, 1)
    }

    if (speakingMode === 'mixed' || speakingMode === 'auto') {
      // Keep learner-facing reply concise: avoid internal mixed-analysis blocks.
      if (!/Câu hoàn chỉnh\s*\(|Complete sentence\s*\(/i.test(parsed.reply)) {
        const finalSentence =
          (mixedReconstructedTargetSentence && !mixedReconstructedTargetSentence.startsWith('Chưa dựng được')
            ? mixedReconstructedTargetSentence
            : mixedNormalizedStudentText) || studentText
        parsed.reply = `${parsed.reply}\n\n${labels.fullSentence} (${targetLanguage}): ${finalSentence}`
      }
    }

    // Guardrail: avoid drifting outside selected language pair for non-Latin target scripts.
    const targetScriptRe = targetScriptRegexByCode(targetLanguageCode)
    if (targetScriptRe) {
      const hasTargetScript = targetScriptRe.test(parsed.reply)
      const hasLatinDefaultPattern = /(Câu hoàn chỉnh|Complete sentence)\s*\([^)]*\)\s*:\s*[A-Za-z][A-Za-z\s'"?!.,-]{5,}/i.test(parsed.reply)
      if (!hasTargetScript && hasLatinDefaultPattern) {
        try {
          const repairPrompt = `Sửa phản hồi sau để đúng ngôn ngữ đang học là ${targetLanguage}, không dùng ngôn ngữ ngoài cặp ${targetLanguage} + ${nativeLanguage} làm câu chính.
Giữ cấu trúc ngắn gọn, thêm:
- ${labels.fullSentence} (${targetLanguage}): ...
- Pinyin: ...
- Dịch nhanh (${nativeLanguage}): ...
Trả về JSON hợp lệ:
{"reply":"...","corrections":[],"pronunciationTips":[],"mainSentence":"..."}
{"reply":"...","corrections":[],"pronunciationTips":[],"mainSentence":"...","mustKnowText":"..."}

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
          additions.push(`${labels.explain} (${nativeLanguage}): ${labels.howToSayExplainDynamic(targetLanguage)}`)
          if (targetSentence) additions.push(`${labels.standardSentence} (${targetLanguage}): ${targetSentence}`)
          if (targetLanguageCode === 'zh' && targetSentence) additions.push('Pinyin: (Thầy/cô sẽ đọc mẫu để em bắt chước phát âm)')
          if (nativeMeaning) additions.push(`${labels.quickTranslation} (${nativeLanguage}): ${nativeMeaning}`)
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

    const correctionNote =
      String(parsed.correctionNote || '').trim()
      || String(parsed.corrections?.[0]?.explanationVi || '').trim()
      || ''
    let intentAnswer = String(parsed.intentAnswer || '').trim()
    if (shouldRepairIntentAnswerToTargetLanguage(intentAnswer, targetLanguageCode, targetScriptRe)) {
      try {
        const repairIntentPrompt = `Viết lại câu trả lời hội thoại sau thành 1 câu ngắn CHỈ bằng ${targetLanguage}.
Không dùng ${nativeLanguage}. Không giải thích ngữ pháp.
Giữ đúng ý hội thoại tự nhiên, giọng giáo viên thân thiện.
Trả về JSON hợp lệ:
{"intentAnswer":"..."}

Nội dung:
${intentAnswer || parsed.reply}`
        const repaired = await model.generateContent(repairIntentPrompt)
        const repairedObj = safeJsonObject(repaired.response.text()?.trim() || '')
        const repairedIntent = String(repairedObj?.intentAnswer || '').trim()
        if (repairedIntent) intentAnswer = repairedIntent
      } catch {
        // keep fallback below
      }
    }
    if (!intentAnswer || shouldRepairIntentAnswerToTargetLanguage(intentAnswer, targetLanguageCode, targetScriptRe)) {
      intentAnswer = fallbackFollowUpByLanguageCode(targetLanguageCode, targetLanguage)
    }
    const correctedSentenceJson = String(parsed.correctedSentence || '').trim()
    const aiMainSentence = String(parsed.mainSentence || '').trim()
    const extractedMainSentence = extractPhraseTargetSentence(parsed.reply)
    const correctedSentence = String(parsed.corrections?.[0]?.fixed || '').trim()
    const mainSentence =
      (isLikelyFullSentence(correctedSentenceJson, targetLanguageCode) ? correctedSentenceJson : '')
      ||
      (isLikelyFullSentence(aiMainSentence, targetLanguageCode) ? aiMainSentence : '')
      || (isLikelyFullSentence(extractedMainSentence, targetLanguageCode) ? extractedMainSentence : '')
      || (isLikelyFullSentence(correctedSentence, targetLanguageCode) ? correctedSentence : '')
      || correctedSentenceJson
      || aiMainSentence
      || extractedMainSentence
      || correctedSentence
      || ''
    const mustKnowText =
      String(parsed.mustKnowText || '').trim()
      || String(parsed.corrections?.[0]?.fixed || '').trim()
      || mainSentence
      || ''
    if (userId && sessionId) {
      const previousFacts = sessionMemory.pinnedFacts
      const correctionFacts = (parsed.corrections || []).map((c) => String(c.fixed || '').trim()).filter(Boolean).slice(0, 5)
      const newRepeatedMistakes = (parsed.corrections || []).map((c) => String(c.original || '').trim()).filter(Boolean).slice(0, 5)
      const nextFacts: SessionPinnedFacts = {
        repeatedMistakes: mergeUniqueLimited(previousFacts.repeatedMistakes, newRepeatedMistakes, 12),
        correctedSentences: mergeUniqueLimited(previousFacts.correctedSentences, correctionFacts, 12),
        learnedPhrases: mergeUniqueLimited(
          previousFacts.learnedPhrases,
          [mainSentence, mustKnowText].filter(Boolean),
          16
        ),
        topicFocus: topicLabel || previousFacts.topicFocus || '',
      }
      const nextSummary = updateRunningSummary(sessionMemory.runningSummary, studentText, parsed.reply)
      await adminSupabase.from('language_coach_session_memories').upsert(
        {
          user_id: userId,
          session_id: sessionId,
          target_language: targetLanguage,
          native_language: nativeLanguage,
          learner_level: learnerLevel,
          topic_id: topicId || null,
          topic_label: topicLabel || null,
          running_summary: nextSummary,
          pinned_facts_json: JSON.stringify(nextFacts),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,session_id' }
      )
    }
    return NextResponse.json({
      ...parsed,
      correctionNote,
      intentAnswer,
      correctedSentence: mainSentence,
      mainSentence,
      mustKnowText,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

