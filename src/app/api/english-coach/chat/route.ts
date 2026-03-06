import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { buildChatPrompts } from '@/app/hoc-tieng-anh-ai/prompt/prompt-builder'
import { getPairPromptConfig, toLanguagePairKey } from '@/app/hoc-tieng-anh-ai/i18n/pairs'

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
  languagePairKey?: string
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
  learningMode?: 'review' | 'reflex'
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
  drillType?: 'listening'
  drillSelectedWords?: string[]
  drillSpeaking?: boolean
}

type SessionPinnedFacts = {
  repeatedMistakes: string[]
  correctedSentences: string[]
  learnedPhrases: string[]
  topicFocus: string
}

type PresetReplayTurn = {
  reply: string
  expectedStudent?: string
  correctionNote?: string
  mainSentence?: string
  intentAnswer?: string
  mustKnowText?: string
  tokensJson?: string
  writingTaskJson?: string
}

type PresetReplayState = {
  sourceLessonId: string
  active: boolean
  nextTurnIndex: number
  turns: PresetReplayTurn[]
}

type ReviewDrillState = {
  speaking?: {
    targetSentence: string
    minSimilarity: number
    minPronunciationScore: number
    attempt: number
  }
  listening?: {
    prompt: string
    expectedKeywords: string[]
    options: string[]
    minMatchedKeywords: number
    attempt: number
  }
}

type ReviewDrillStats = {
  speakingPass: number
  speakingFail: number
  listeningPass: number
  listeningFail: number
  hintServed: number
  updatedAt: string
}

type ChatJsonPayload = {
  reply: string
  corrections: Correction[]
  pronunciationTips: string[]
  mainSentence: string
  correctionNote: string
  intentAnswer: string
}

const LIVE_SESSION_BASE_TURN_LIMIT = 10
const LIVE_SESSION_EXTRA_TURN_STEP = 5
const LIVE_SESSION_PRICE_CREDITS = 2.5
const LIVE_SESSION_EXTRA_STEP_PRICE_CREDITS = 1.25

type MiniStageSnapshot = {
  stage: 'idle' | 'writing' | 'speaking' | 'listening' | 'done'
  updatedAt: string
}

type ReplayCacheRow = {
  id: string
  normalized_student_text: string
  student_text: string
  teacher_gender: TeacherGender
  learner_level: number
  topic_id: string
  normalized_topic_id: string
  topic_label: string
  normalized_topic_label: string
  target_language: string
  normalized_target_language: string
  native_language: string
  normalized_native_language: string
  mode: 'chat' | 'listen_speak' | 'roleplay_short'
  learning_mode: 'review' | 'reflex'
  reply: string
  corrections_json: unknown
  pronunciation_tips_json: unknown
  correction_note: string | null
  corrected_sentence: string | null
  intent_answer: string | null
  main_sentence: string | null
  must_know_text: string | null
  updated_at: string
  last_used_at: string
  hit_count: number
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

function parsePresetReplay(raw: string): PresetReplayState | null {
  try {
    const root = JSON.parse(String(raw || '{}')) as Record<string, unknown>
    const preset = (root?.preset_replay && typeof root.preset_replay === 'object'
      ? (root.preset_replay as Record<string, unknown>)
      : null)
    if (!preset) return null
    const turnsRaw = Array.isArray(preset.turns) ? preset.turns : []
    const turns = turnsRaw
      .map((x) => {
        if (!x || typeof x !== 'object') return null
        const row = x as Record<string, unknown>
        const reply = String(row.reply || '').trim()
        if (!reply) return null
        return {
          reply,
          expectedStudent: String(row.expectedStudent || row.expected_student || '').trim() || undefined,
          correctionNote: String(row.correctionNote || '').trim() || undefined,
          mainSentence: String(row.mainSentence || '').trim() || undefined,
          intentAnswer: String(row.intentAnswer || '').trim() || undefined,
          mustKnowText: String(row.mustKnowText || '').trim() || undefined,
          tokensJson: String(row.tokensJson || (row as { tokens_json?: string }).tokens_json || '').trim() || undefined,
          writingTaskJson: String(row.writingTaskJson || (row as { writing_task_json?: string }).writing_task_json || '').trim() || undefined,
        } satisfies PresetReplayTurn
      })
      .filter((x): x is PresetReplayTurn => Boolean(x))
    if (turns.length === 0) return null
    const nextTurnIndexRaw = Number(preset.next_turn_index ?? preset.nextTurnIndex ?? 0)
    const nextTurnIndex = Number.isFinite(nextTurnIndexRaw) ? Math.max(0, Math.floor(nextTurnIndexRaw)) : 0
    const sourceLessonId = String(preset.source_lesson_id ?? preset.sourceLessonId ?? '').trim()
    const active = preset.active !== false
    return { sourceLessonId, active, nextTurnIndex, turns }
  } catch {
    return null
  }
}

function parseReviewDrill(raw: string): ReviewDrillState | null {
  try {
    const root = JSON.parse(String(raw || '{}')) as Record<string, unknown>
    const drill = root?.review_drill
    if (!drill || typeof drill !== 'object') return null
    const d = drill as Record<string, unknown>
    const speakingRaw = d.speaking && typeof d.speaking === 'object' ? (d.speaking as Record<string, unknown>) : null
    const listeningRaw = d.listening && typeof d.listening === 'object' ? (d.listening as Record<string, unknown>) : null
    const speaking = speakingRaw
      ? {
          targetSentence: String(speakingRaw.targetSentence || '').trim(),
          minSimilarity: Math.max(0.6, Math.min(0.99, Number(speakingRaw.minSimilarity || 0.85) || 0.85)),
          minPronunciationScore: Math.max(0, Math.min(100, Math.round(Number(speakingRaw.minPronunciationScore || 60) || 60))),
          attempt: Math.max(0, Math.floor(Number(speakingRaw.attempt || 0) || 0)),
        }
      : undefined
    const listening = listeningRaw
      ? {
          prompt: String(listeningRaw.prompt || '').trim(),
          expectedKeywords: Array.isArray(listeningRaw.expectedKeywords)
            ? listeningRaw.expectedKeywords.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 24)
            : [],
          options: Array.isArray(listeningRaw.options)
            ? listeningRaw.options.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 24)
            : [],
          minMatchedKeywords: Math.max(1, Math.floor(Number(listeningRaw.minMatchedKeywords || 1) || 1)),
          attempt: Math.max(0, Math.floor(Number(listeningRaw.attempt || 0) || 0)),
        }
      : undefined
    if (!speaking && !listening) return null
    if (speaking && !speaking.targetSentence) return null
    return { speaking, listening }
  } catch {
    return null
  }
}

function asUuidOrEmpty(value: string): string {
  const v = String(value || '').trim()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v) ? v : ''
}

function parseReviewDrillStats(raw: string): ReviewDrillStats {
  try {
    const root = JSON.parse(String(raw || '{}')) as Record<string, unknown>
    const s = root?.review_drill_stats
    const row = s && typeof s === 'object' ? (s as Record<string, unknown>) : {}
    return {
      speakingPass: Math.max(0, Math.floor(Number(row.speakingPass || 0) || 0)),
      speakingFail: Math.max(0, Math.floor(Number(row.speakingFail || 0) || 0)),
      listeningPass: Math.max(0, Math.floor(Number(row.listeningPass || 0) || 0)),
      listeningFail: Math.max(0, Math.floor(Number(row.listeningFail || 0) || 0)),
      hintServed: Math.max(0, Math.floor(Number(row.hintServed || 0) || 0)),
      updatedAt: String(row.updatedAt || '').trim() || new Date().toISOString(),
    }
  } catch {
    return {
      speakingPass: 0,
      speakingFail: 0,
      listeningPass: 0,
      listeningFail: 0,
      hintServed: 0,
      updatedAt: new Date().toISOString(),
    }
  }
}

function buildReviewDrillRaw(
  currentPinnedFactsRaw: string,
  next: ReviewDrillState | null,
  statsDelta?: Partial<Pick<ReviewDrillStats, 'speakingPass' | 'speakingFail' | 'listeningPass' | 'listeningFail' | 'hintServed'>>,
  stageOverride?: MiniStageSnapshot['stage']
): string {
  const derivedStage: MiniStageSnapshot['stage'] =
    stageOverride
    || (next?.listening ? 'listening' : next?.speaking ? 'speaking' : 'idle')
  try {
    const parsed = JSON.parse(String(currentPinnedFactsRaw || '{}')) as Record<string, unknown>
    const root = parsed && typeof parsed === 'object' ? { ...parsed } : {}
    if (next && (next.speaking || next.listening)) {
      root.review_drill = next
    } else {
      delete root.review_drill
    }
    if (statsDelta) {
      const prev = parseReviewDrillStats(currentPinnedFactsRaw)
      const nextStats: ReviewDrillStats = {
        speakingPass: Math.max(0, prev.speakingPass + Math.floor(Number(statsDelta.speakingPass || 0) || 0)),
        speakingFail: Math.max(0, prev.speakingFail + Math.floor(Number(statsDelta.speakingFail || 0) || 0)),
        listeningPass: Math.max(0, prev.listeningPass + Math.floor(Number(statsDelta.listeningPass || 0) || 0)),
        listeningFail: Math.max(0, prev.listeningFail + Math.floor(Number(statsDelta.listeningFail || 0) || 0)),
        hintServed: Math.max(0, prev.hintServed + Math.floor(Number(statsDelta.hintServed || 0) || 0)),
        updatedAt: new Date().toISOString(),
      }
      root.review_drill_stats = nextStats
    }
    root.mini_stage_snapshot = {
      stage: derivedStage,
      updatedAt: new Date().toISOString(),
    }
    return JSON.stringify(root)
  } catch {
    const base: Record<string, unknown> = {}
    if (next && (next.speaking || next.listening)) base.review_drill = next
    if (statsDelta) {
      const prev = parseReviewDrillStats('{}')
      base.review_drill_stats = {
        speakingPass: Math.max(0, prev.speakingPass + Math.floor(Number(statsDelta.speakingPass || 0) || 0)),
        speakingFail: Math.max(0, prev.speakingFail + Math.floor(Number(statsDelta.speakingFail || 0) || 0)),
        listeningPass: Math.max(0, prev.listeningPass + Math.floor(Number(statsDelta.listeningPass || 0) || 0)),
        listeningFail: Math.max(0, prev.listeningFail + Math.floor(Number(statsDelta.listeningFail || 0) || 0)),
        hintServed: Math.max(0, prev.hintServed + Math.floor(Number(statsDelta.hintServed || 0) || 0)),
        updatedAt: new Date().toISOString(),
      }
    }
    base.mini_stage_snapshot = {
      stage: derivedStage,
      updatedAt: new Date().toISOString(),
    }
    return JSON.stringify(base)
  }
}

function extractListeningKeywords(text: string): string[] {
  const tokens = String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 3)
  const stop = new Set(['the', 'and', 'for', 'with', 'you', 'that', 'this', 'have', 'from', 'your', 'about', 'đây', 'câu', 'với', 'của', 'bạn'])
  const out: string[] = []
  for (const t of tokens) {
    if (stop.has(t)) continue
    if (!out.includes(t)) out.push(t)
    if (out.length >= 6) break
  }
  return out
}

function extractListeningAllWords(text: string): string[] {
  const tokens = String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean)
  const out: string[] = []
  for (const t of tokens) {
    if (!out.includes(t)) out.push(t)
    if (out.length >= 24) break
  }
  return out
}

/** Token list from sentence for listening drill - words that can be picked one-by-one. */
function extractListeningTokenList(text: string, languageCode: string): string[] {
  const allowSingleChar = ['zh', 'ja', 'ko', 'th', 'hi'].includes(String(languageCode || '').toLowerCase())
  const minLen = allowSingleChar ? 1 : 2
  const tokens = extractListeningAllWords(text)
  return tokens.filter((t) => t.length >= minLen).slice(0, 24)
}

function speakingDrillThresholdByLevel(learnerLevel: number): { minSimilarity: number; minPronunciationScore: number } {
  if (learnerLevel <= 0) return { minSimilarity: 0.8, minPronunciationScore: 52 }
  if (learnerLevel === 1) return { minSimilarity: 0.83, minPronunciationScore: 56 }
  if (learnerLevel === 2) return { minSimilarity: 0.86, minPronunciationScore: 60 }
  if (learnerLevel === 3) return { minSimilarity: 0.89, minPronunciationScore: 65 }
  return { minSimilarity: 0.92, minPronunciationScore: 70 }
}

function defaultListeningDistractorsByLanguageCode(code: string): string[] {
  if (code === 'vi') return ['hôm', 'nay', 'mai', 'học', 'đi', 'nhà', 'ăn', 'uống']
  if (code === 'zh') return ['今天', '明天', '现在', '谢谢', '喜欢', '学习', '朋友', '家']
  if (code === 'ja') return ['きょう', 'あした', 'いま', 'ありがとう', 'すき', 'べんきょう', 'ともだち', 'いえ']
  if (code === 'ko') return ['오늘', '내일', '지금', '고마워요', '좋아해요', '공부', '친구', '집']
  if (code === 'th') return ['วันนี้', 'พรุ่งนี้', 'ตอนนี้', 'ขอบคุณ', 'ชอบ', 'เรียน', 'เพื่อน', 'บ้าน']
  if (code === 'hi') return ['आज', 'कल', 'अभी', 'धन्यवाद', 'पसंद', 'पढ़ाई', 'दोस्त', 'घर']
  return ['today', 'tomorrow', 'now', 'thanks', 'learn', 'friend', 'home', 'work']
}

function pickListeningCorrectKeywords(prompt: string, languageCode: string): string[] {
  const all = extractListeningAllWords(prompt)
  const allowSingleChar = ['zh', 'ja', 'ko', 'th', 'hi'].includes(String(languageCode || '').toLowerCase())
  const minLen = allowSingleChar ? 1 : 2
  const out: string[] = []
  for (const token of all) {
    const t = String(token || '').trim().toLowerCase()
    if (!t || t.length < minLen) continue
    if (out.includes(t)) continue
    out.push(t)
    if (out.length >= 3) break
  }
  return out
}

function buildListeningOptionPool(expectedKeywords: string[], candidateKeywords: string[], languageCode: string): string[] {
  const correctSet = new Set(expectedKeywords.map((x) => normalizeLookup(x)).filter(Boolean))
  if (correctSet.size < 3) return []
  const correct = Array.from(correctSet).slice(0, 3)
  const allowSingleChar = ['zh', 'ja', 'ko', 'th', 'hi'].includes(String(languageCode || '').toLowerCase())
  const minLen = allowSingleChar ? 1 : 2
  const wrong: string[] = []
  for (const token of candidateKeywords) {
    const t = String(token || '').trim().toLowerCase()
    if (!t || t.length < minLen) continue
    if (correctSet.has(t)) continue
    if (wrong.includes(t)) continue
    wrong.push(t)
    if (wrong.length >= 8) break
  }
  if (wrong.length < 6) {
    for (const token of defaultListeningDistractorsByLanguageCode(languageCode)) {
      const t = String(token || '').trim().toLowerCase()
      if (!t || correctSet.has(t) || wrong.includes(t)) continue
      wrong.push(t)
      if (wrong.length >= 8) break
    }
  }
  if (wrong.length < 6) return []
  return [...correct, ...wrong.slice(0, 8)]
}

async function loadListeningDistractorsFromDailyWords(
  adminSupabase: ReturnType<typeof adminClient>,
  userId: string,
  sessionId: string,
  targetLanguageCode: string,
  expectedKeywords: string[]
): Promise<string[]> {
  const uid = String(userId || '').trim()
  const sid = String(sessionId || '').trim()
  if (!uid) return []
  const expectedSet = new Set(expectedKeywords.map((x) => normalizeLookup(x)).filter(Boolean))
  const minLen = ['zh', 'ja', 'ko', 'th', 'hi'].includes(String(targetLanguageCode || '').toLowerCase()) ? 1 : 2
  const out: string[] = []

  const collect = (rows: Array<{ word?: string }> | null | undefined) => {
    for (const row of (rows || [])) {
      const tokens = extractListeningAllWords(String(row.word || '').trim())
      for (const token of tokens) {
        const t = String(token || '').trim().toLowerCase()
        if (!t || t.length < minLen) continue
        if (expectedSet.has(t)) continue
        if (out.includes(t)) continue
        out.push(t)
        if (out.length >= 24) return
      }
    }
  }

  try {
    if (sid) {
      const { data: sessionRows } = await adminSupabase
        .from('language_coach_daily_words')
        .select('word')
        .eq('user_id', uid)
        .eq('session_id', sid)
        .order('updated_at', { ascending: false })
        .limit(180)
      collect((sessionRows || []) as Array<{ word?: string }>)
    }

    if (out.length < 4) {
      const { data: userRows } = await adminSupabase
        .from('language_coach_daily_words')
        .select('word')
        .eq('user_id', uid)
        .order('updated_at', { ascending: false })
        .limit(300)
      collect((userRows || []) as Array<{ word?: string }>)
    }

    return out
  } catch {
    return out
  }
}

function seededShuffle(words: string[], seedInput: string): string[] {
  const out = [...words]
  let seed = 0
  for (let i = 0; i < seedInput.length; i++) {
    seed = (seed * 31 + seedInput.charCodeAt(i)) >>> 0
  }
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1))
    const temp = out[i]
    out[i] = out[j]
    out[j] = temp
  }
  return out
}

function speakingCooldownHint(sentence: string, code: string): string {
  const words = String(sentence || '').trim().split(/\s+/).filter(Boolean)
  if (words.length < 4) return ''
  const mid = Math.max(1, Math.floor(words.length / 2))
  const chunkA = words.slice(0, mid).join(' ')
  const chunkB = words.slice(mid).join(' ')
  if (code === 'vi') return `Mẹo nhanh: tách câu thành 2 cụm "${chunkA}" + "${chunkB}".`
  if (code === 'zh') return `小提示：把句子分成两段 "${chunkA}" + "${chunkB}"。`
  if (code === 'ja') return `コツ：文を2つのかたまりに分けます "${chunkA}" + "${chunkB}"。`
  if (code === 'ko') return `팁: 문장을 두 덩어리로 나눠 말해 보세요 "${chunkA}" + "${chunkB}".`
  if (code === 'th') return `เคล็ดลับ: แยกประโยคเป็น 2 ช่วง "${chunkA}" + "${chunkB}".`
  if (code === 'hi') return `टिप: वाक्य को दो हिस्सों में बोलें "${chunkA}" + "${chunkB}"।`
  return `Quick tip: split into 2 chunks: "${chunkA}" + "${chunkB}".`
}

function strictReplayRetryPromptByLanguageCode(
  code: string,
  expectedStudent: string,
  targetLanguage: string,
  seed = 0
): string {
  const expected = String(expectedStudent || '').trim()
  if (!expected) return fallbackFollowUpByLanguageCode(code, targetLanguage)
  if (code === 'vi') {
    const prompts = [
      'Đến lượt em nhé. Nói câu này:',
      'Rất tốt, giờ em nói theo mẫu này:',
      'Giờ em thử nói câu sau thật rõ:',
      'Mình tiếp tục nhé, em nói câu này:',
      'Em nói đúng câu mục tiêu của lượt này:',
    ]
    const idx = Math.abs(Math.floor(seed)) % prompts.length
    return `${prompts[idx]} "${expected}".`
  }
  if (code === 'zh') return `请你再读一遍这句话： "${expected}"。`
  if (code === 'ja') return `次の文をそのまま言ってください: "${expected}"。`
  if (code === 'ko') return `다음 문장을 그대로 말해 주세요: "${expected}".`
  if (code === 'th') return `พูดประโยคนี้ให้ตรงตามต้นฉบับ: "${expected}".`
  if (code === 'hi') return `कृपया यह वाक्य बिल्कुल वैसे ही बोलें: "${expected}"।`
  return `Please repeat this sentence exactly: "${expected}".`
}

function reviewDrillSpeakingHintByLanguageCode(code: string): string {
  if (code === 'vi') return 'Mình luyện nói lại câu sửa thêm một lượt nữa nhé.'
  if (code === 'zh') return '我们再把修改后的句子说一遍。'
  if (code === 'ja') return '修正文をもう一度声に出してみましょう。'
  if (code === 'ko') return '수정한 문장을 한 번 더 말해 봐요.'
  if (code === 'th') return 'ลองพูดประโยคที่แก้ไขแล้วอีกครั้งนะ'
  if (code === 'hi') return 'सुधारे गए वाक्य को एक बार फिर बोलिए।'
  return 'Please retry the corrected sentence one more time.'
}

function reviewDrillListeningStartByLanguageCode(code: string): string {
  if (code === 'vi') return 'Tốt lắm. Giờ luyện nghe nhanh nhé: hãy chọn các từ em nghe thấy.'
  if (code === 'zh') return '很好。现在做一个听力小练习：请选择你听到的词。'
  if (code === 'ja') return 'いいですね。次はリスニング練習です。聞こえた単語を選んでください。'
  if (code === 'ko') return '좋아요. 이제 짧은 듣기 연습입니다. 들린 단어를 선택해 주세요.'
  if (code === 'th') return 'ดีมาก ต่อไปฝึกฟังสั้น ๆ เลือกคำที่คุณได้ยิน'
  if (code === 'hi') return 'बहुत अच्छा। अब एक छोटा listening अभ्यास: जो शब्द सुने, उन्हें चुनें।'
  return 'Great. Quick listening check: pick the words you heard.'
}

function reviewDrillListeningRetryByLanguageCode(code: string): string {
  if (code === 'vi') return 'Chưa khớp hết từ khóa nghe. Em thử nghe lại và chọn lại nhé.'
  if (code === 'zh') return '还没匹配到足够关键词。请再听一次并重新选择。'
  if (code === 'ja') return 'キーワードがまだ足りません。もう一度聞いて選び直しましょう。'
  if (code === 'ko') return '핵심 단어가 아직 부족해요. 다시 듣고 다시 선택해 주세요.'
  if (code === 'th') return 'ยังจับคำสำคัญไม่ครบ ลองฟังอีกครั้งแล้วเลือกใหม่'
  if (code === 'hi') return 'अभी पर्याप्त कीवर्ड मैच नहीं हुए। फिर से सुनकर दोबारा चुनें।'
  return 'Not enough matched keywords. Listen again and try once more.'
}

function reviewDrillListeningDoneByLanguageCode(code: string): string {
  if (code === 'vi') return 'Tốt rồi, mình quay lại hội thoại chính nhé.'
  if (code === 'zh') return '很好，我们回到主对话吧。'
  if (code === 'ja') return 'よくできました。メイン会話に戻りましょう。'
  if (code === 'ko') return '좋아요. 이제 메인 대화로 돌아가요.'
  if (code === 'th') return 'ดีมาก กลับไปที่บทสนทนาหลักกัน'
  if (code === 'hi') return 'बहुत बढ़िया, अब मुख्य बातचीत पर लौटते हैं।'
  return 'Great. Back to the main conversation now.'
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

function extractPresetIdea3Line(reply: string): string {
  const source = String(reply || '').trim()
  if (!source) return ''
  const patterns = [
    /Ý\s*3\s*[-:–—]\s*[^:\n]*:\s*([^\n]+)/i,
    /Idea\s*3\s*[-:–—]\s*[^:\n]*:\s*([^\n]+)/i,
  ]
  for (const re of patterns) {
    const m = source.match(re)
    const line = String(m?.[1] || '').trim()
    if (line) return line
  }
  return ''
}

function clampReplyBySentence(input: string, maxChars: number): string {
  const source = String(input || '').trim()
  if (!source || source.length <= maxChars) return source
  const slice = source.slice(0, maxChars + 1)
  let boundary = -1
  for (const mark of ['.', '!', '?', '。', '！', '？', '\n']) {
    boundary = Math.max(boundary, slice.lastIndexOf(mark))
  }
  if (boundary >= Math.min(180, Math.floor(maxChars * 0.45))) {
    return slice.slice(0, boundary + 1).trim()
  }
  const lastSpace = slice.lastIndexOf(' ')
  if (lastSpace > 120) return `${slice.slice(0, lastSpace).trim()}...`
  return `${slice.slice(0, maxChars).trim()}...`
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
  if (words.length < 3) return false
  // English fragment like "to eat fish" is not a complete corrected sentence.
  if (targetLanguageCode === 'en' && /^to\s+[a-z]/i.test(t)) return false
  return true
}

function isTooShortStudentSentence(text: string, targetLanguageCode: string): boolean {
  const t = String(text || '').trim()
  if (!t) return true
  if (targetLanguageCode === 'zh') return t.length < 3
  if (targetLanguageCode === 'ja') return t.length < 3
  if (targetLanguageCode === 'ko') return t.length < 3
  if (targetLanguageCode === 'th') return t.length < 4
  if (targetLanguageCode === 'hi') return t.length < 4
  const words = t.split(/\s+/).filter(Boolean)
  return words.length < 3
}

function minSentenceRuleByLanguageCode(code: string): string {
  if (code === 'zh' || code === 'ja' || code === 'ko') return 'ít nhất khoảng 3 ký tự/từ có nghĩa'
  if (code === 'th' || code === 'hi') return 'ít nhất khoảng 4 ký tự/từ có nghĩa'
  return 'ít nhất 3 từ'
}

function normalizeVietnameseLearnerAddressing(text: string): string {
  const input = String(text || '')
  if (!input) return ''
  return input
    .replace(/\bCon\b/g, 'Em')
    .replace(/\bcon\b/g, 'em')
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
      askReplyAgain: 'Em dùng mẫu này để trả lời một ý mới nhé?',
      howToSayExplain: 'Đây là câu hỏi cách nói rất thông dụng.',
      howToSayPrompt: 'Giờ em dùng câu chuẩn này để nói thêm một ý mới nhé?',
      howToSayExplainDynamic: (targetLanguage: string) => `Em đang hỏi cách nói câu này bằng ${targetLanguage}.`,
      fullSentence: 'Câu hoàn chỉnh',
      standardSentence: 'Câu chuẩn',
    },
    en: {
      explain: 'Explanation',
      quickTranslation: 'Quick translation',
      teacherSaid: 'Teacher just said',
      repeatSlowly: 'No worries. I will repeat the previous sentence more slowly.',
      askReplyAgain: 'Use this pattern to answer a new question.',
      howToSayExplain: 'This is a common “how to say it” question.',
      howToSayPrompt: 'Now use this correct sentence pattern for a new idea.',
      howToSayExplainDynamic: (targetLanguage: string) => `You are asking how to say this sentence in ${targetLanguage}.`,
      fullSentence: 'Complete sentence',
      standardSentence: 'Correct sentence',
    },
    th: {
      explain: 'คำอธิบาย',
      quickTranslation: 'แปลเร็ว',
      teacherSaid: 'ประโยคที่ครูเพิ่งพูด',
      repeatSlowly: 'ไม่เป็นไร เดี๋ยวครูพูดประโยคเมื่อกี้ช้า ๆ อีกครั้งนะ',
      askReplyAgain: 'ลองใช้ประโยคนี้ตอบคำถามใหม่ดูนะ',
      howToSayExplain: 'นี่เป็นคำถาม “พูดแบบนี้ว่าอย่างไร” ที่ใช้บ่อยมาก',
      howToSayPrompt: 'ตอนนี้ลองใช้รูปประโยคนี้พูดไอเดียใหม่ดูนะ',
      howToSayExplainDynamic: (targetLanguage: string) => `คุณกำลังถามว่า ประโยคนี้พูดเป็น ${targetLanguage} อย่างไร`,
      fullSentence: 'ประโยคสมบูรณ์',
      standardSentence: 'ประโยคมาตรฐาน',
    },
    ja: {
      explain: '説明',
      quickTranslation: 'クイック訳',
      teacherSaid: '先生がさっき言った文',
      repeatSlowly: '大丈夫です。今の文をゆっくりもう一度言いますね。',
      askReplyAgain: 'この文型を使って、別の内容で答えてみましょう。',
      howToSayExplain: 'これはよく使う「どう言うの？」の質問です。',
      howToSayPrompt: 'この自然な文型を使って、新しい内容を一文で言ってみましょう。',
      howToSayExplainDynamic: (targetLanguage: string) => `この文を${targetLanguage}でどう言うかを聞いています。`,
      fullSentence: '完成文',
      standardSentence: '自然な文',
    },
    ko: {
      explain: '설명',
      quickTranslation: '빠른 번역',
      teacherSaid: '방금 선생님이 말한 문장',
      repeatSlowly: '괜찮아요. 방금 문장을 천천히 다시 말해 줄게요.',
      askReplyAgain: '이 문장 패턴으로 새로운 내용을 답해 볼까요?',
      howToSayExplain: '이건 자주 쓰는 “이걸 어떻게 말해요?” 질문이에요.',
      howToSayPrompt: '이 자연스러운 문장 패턴으로 새 내용을 말해 보세요.',
      howToSayExplainDynamic: (targetLanguage: string) => `이 문장을 ${targetLanguage}로 어떻게 말하는지 묻고 있어요.`,
      fullSentence: '완성 문장',
      standardSentence: '표준 문장',
    },
    zh: {
      explain: '解释',
      quickTranslation: '快速翻译',
      teacherSaid: '老师刚才说的句子',
      repeatSlowly: '没关系，我把刚才那句话慢慢再说一遍。',
      askReplyAgain: '你用这个句型回答一个新问题吧。',
      howToSayExplain: '这是很常见的“这句话怎么说”提问。',
      howToSayPrompt: '现在请用这个标准句型说一个新意思。',
      howToSayExplainDynamic: (targetLanguage: string) => `你在问这句话用${targetLanguage}怎么说。`,
      fullSentence: '完整句子',
      standardSentence: '标准句子',
    },
    hi: {
      explain: 'व्याख्या',
      quickTranslation: 'त्वरित अनुवाद',
      teacherSaid: 'शिक्षक ने अभी कहा',
      repeatSlowly: 'कोई बात नहीं, मैं वही वाक्य धीरे से फिर बोलता/बोलती हूँ।',
      askReplyAgain: 'कृपया इसी पैटर्न से एक नया जवाब दें।',
      howToSayExplain: 'यह बहुत सामान्य “इसे कैसे कहें” वाला प्रश्न है।',
      howToSayPrompt: 'अब इसी सही पैटर्न से एक नया वाक्य बोलें।',
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

function hasQuestionSentence(text: string): boolean {
  const source = String(text || '').trim()
  if (!source) return false
  return /[?？]$/.test(source) || /[?？]/.test(source)
}

function defaultIdea3LeadByLanguageCode(code: string): string {
  if (code === 'zh') return '好的，我们继续。'
  if (code === 'ja') return 'いいですね、続けましょう。'
  if (code === 'ko') return '좋아요, 계속해 볼게요.'
  if (code === 'th') return 'ดีมาก เรามาต่อกันนะ'
  if (code === 'hi') return 'बहुत अच्छा, चलिए आगे बढ़ते हैं।'
  if (code === 'vi') return 'Tốt lắm, mình tiếp tục nhé.'
  return "Great, let's continue."
}

function detailFollowUpByLanguageCode(code: string, targetLanguage: string): string {
  if (code === 'zh') return '你可以在刚才那句话里再加一个细节吗？'
  if (code === 'ja') return '今の文に、もう一つ具体的な情報を足して言えますか？'
  if (code === 'ko') return '방금 문장에 구체적인 정보 하나를 더해서 말해 볼까요?'
  if (code === 'th') return 'คุณช่วยเพิ่มรายละเอียดอีกหนึ่งอย่างจากประโยคเมื่อกี้ได้ไหม?'
  if (code === 'hi') return 'क्या आप अभी वाले वाक्य में एक और विवरण जोड़कर बोल सकते हैं?'
  if (code === 'vi') return 'Em có thể thêm một chi tiết nữa vào câu vừa rồi không?'
  return `Can you add one more detail to your last sentence in ${targetLanguage}?`
}

function normalizeForSimilarity(input: string): string {
  return normalizeLookup(input).replace(/[\s.,!?;:()[\]{}'"`~@#$%^&*+=<>|\\/_-]+/g, '')
}

function parseCorrectionList(input: unknown): Correction[] {
  const source = (() => {
    if (Array.isArray(input)) return input
    const raw = String(input || '').trim()
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw) as unknown
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })()
  return source
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const item = row as { original?: unknown; fixed?: unknown; explanationVi?: unknown }
      const original = String(item.original || '').trim()
      const fixed = String(item.fixed || '').trim()
      const explanationVi = String(item.explanationVi || '').trim()
      if (!original && !fixed && !explanationVi) return null
      return { original, fixed, explanationVi }
    })
    .filter((x): x is Correction => Boolean(x))
    .slice(0, 5)
}

function parseStringList(input: unknown): string[] {
  const source = (() => {
    if (Array.isArray(input)) return input
    const raw = String(input || '').trim()
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw) as unknown
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })()
  return source
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .slice(0, 5)
}

function levenshteinDistance(a: string, b: string): number {
  const left = String(a || '')
  const right = String(b || '')
  if (!left) return right.length
  if (!right) return left.length
  const prev = new Array<number>(right.length + 1)
  const curr = new Array<number>(right.length + 1)
  for (let j = 0; j <= right.length; j += 1) prev[j] = j
  for (let i = 1; i <= left.length; i += 1) {
    curr[0] = i
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      )
    }
    for (let j = 0; j <= right.length; j += 1) prev[j] = curr[j]
  }
  return prev[right.length]
}

function similarityScore(a: string, b: string): number {
  const left = normalizeForSimilarity(a)
  const right = normalizeForSimilarity(b)
  if (!left || !right) return 0
  if (left === right) return 1
  const maxLen = Math.max(left.length, right.length)
  if (maxLen === 0) return 1
  const distance = levenshteinDistance(left, right)
  return Math.max(0, 1 - distance / maxLen)
}

function isIntentAnswerTooCloseToStudent(
  intentAnswer: string,
  studentText: string,
  correctedSentence: string
): boolean {
  const firstLine = String(intentAnswer || '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)[0] || ''
  if (!firstLine) return false
  const intentLead = firstLine
    .split(/(?<=[.!?。！？])\s+/u)
    .map((x) => x.trim())
    .find((x) => x && !/[?？]$/.test(x)) || firstLine
  const normalizedIntent = normalizeForSimilarity(intentLead)
  if (!normalizedIntent || normalizedIntent.length < 8) return false
  const bases = [studentText, correctedSentence].map(normalizeForSimilarity).filter((x) => x.length >= 8)
  return bases.some((base) => normalizedIntent === base || normalizedIntent.includes(base) || base.includes(normalizedIntent))
}

function hasMeaningfulSentenceCorrection(
  corrections: Correction[],
  studentText: string,
  targetLanguageCode: string
): boolean {
  const student = String(studentText || '').trim()
  for (const row of corrections || []) {
    const fixed = String(row?.fixed || '').trim()
    if (!fixed) continue
    if (!isLikelyFullSentence(fixed, targetLanguageCode)) continue
    if (!student) return true
    if (similarityScore(student, fixed) < 0.985) return true
  }
  return false
}

function isLikelyTargetLanguageSentence(
  text: string,
  targetLanguageCode: string,
  targetScriptRe: RegExp | null
): boolean {
  const t = String(text || '').trim()
  if (!t) return false
  if (targetLanguageCode === 'en') {
    if (!/[a-z]/i.test(t)) return false
    if (hasVietnameseDiacritics(t)) return false
    if (/[\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\u0E00-\u0E7F\u0900-\u097F]/u.test(t)) return false
    return true
  }
  if (targetLanguageCode === 'vi') {
    if (!/[a-zA-ZăâđêôơưĂÂĐÊÔƠƯ]/u.test(t)) return false
    if (/[\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\u0E00-\u0E7F\u0900-\u097F]/u.test(t)) return false
    return true
  }
  if (targetScriptRe) return targetScriptRe.test(t)
  return true
}

function correctionHintByNativeLanguageCode(code: string): string {
  if (code === 'zh') return '你原句意思很清楚。这里给你一个更自然的目标语言表达。'
  if (code === 'ja') return '元の文の意味は伝わっています。こちらはより自然な目標言語の言い方です。'
  if (code === 'ko') return '원래 문장 의미는 잘 전달됐어요. 아래는 목표 언어에서 더 자연스러운 표현입니다.'
  if (code === 'th') return 'ความหมายเดิมชัดเจนแล้ว ประโยคด้านล่างเป็นรูปแบบที่เป็นธรรมชาติกว่าในภาษาเป้าหมาย'
  if (code === 'hi') return 'आपका मूल अर्थ स्पष्ट है। नीचे लक्ष्य भाषा में अधिक स्वाभाविक अभिव्यक्ति दी गई है।'
  if (code === 'en') return 'Your meaning is clear. Here is a more natural sentence in the target language.'
  return 'Ý của em rõ rồi. Câu dưới đây là cách nói tự nhiên hơn bằng ngôn ngữ đang học.'
}

function stripVietnameseDiacritics(text: string): string {
  return String(text || '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}

function toSimpleTitleCase(text: string): string {
  return String(text || '')
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function extractSongTitleCandidateFromVietnamese(input: string): string {
  const source = String(input || '').trim()
  if (!source) return ''
  const patterns = [
    /là\s+bài\s+(.+)$/iu,
    /la\s+bai\s+(.+)$/iu,
    /bài\s+(.+)$/iu,
    /bai\s+(.+)$/iu,
  ]
  for (const re of patterns) {
    const m = source.match(re)
    const captured = String(m?.[1] || '').trim()
    if (!captured) continue
    const cleaned = captured
      .replace(/[“”"']/g, ' ')
      .replace(/[.,!?;:]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!cleaned) continue
    const words = cleaned.split(/\s+/).filter(Boolean)
    if (words.length >= 2 && words.length <= 8) return cleaned
  }
  return ''
}

function enrichEnglishSongMainSentence(mainSentence: string, studentText: string): string {
  const base = String(mainSentence || '').trim()
  if (!base) return base
  if (!/\bsong\b/i.test(base)) return base
  const titleCandidate = extractSongTitleCandidateFromVietnamese(studentText)
  if (!titleCandidate) return base
  const asciiTitle = stripVietnameseDiacritics(titleCandidate)
    .replace(/[^A-Za-z0-9' -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!asciiTitle) return base
  const normalizedBase = normalizeForSimilarity(base)
  const normalizedTitle = normalizeForSimilarity(asciiTitle)
  if (normalizedTitle && normalizedBase.includes(normalizedTitle)) return base
  const title = toSimpleTitleCase(asciiTitle)
  const baseNoPunct = base.replace(/[.!?]+$/g, '').trim()
  if (!baseNoPunct) return base
  if (/\bis\b/i.test(baseNoPunct)) return `${baseNoPunct} "${title}".`
  return `${baseNoPunct} is "${title}".`
}

function hasEnglishMainVerb(sentence: string): boolean {
  const s = String(sentence || '').trim()
  if (!s) return false
  if (/\b(am|is|are|was|were|be|been|being|have|has|had|do|does|did|can|could|will|would|should|may|might|must)\b/i.test(s)) {
    return true
  }
  return /\b\w+'s\b/i.test(s)
}

const EN_MEANING_STOPWORDS = new Set([
  'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'a', 'an', 'the', 'to', 'of', 'for', 'in', 'on', 'at', 'with', 'and', 'or',
  'do', 'does', 'did', 'have', 'has', 'had',
  'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'our', 'their',
])

function tokenizeEnglishContentWords(text: string): string[] {
  const normalized = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!normalized) return []
  return normalized
    .split(' ')
    .map((x) => x.trim())
    .filter((x) => x.length >= 2 && !EN_MEANING_STOPWORDS.has(x))
}

function shouldRepairMainSentenceForMissingMeaning(
  mainSentence: string,
  referencePhrases: string[],
  targetLanguageCode: string
): boolean {
  if (targetLanguageCode !== 'en') return false
  const mainWords = new Set(tokenizeEnglishContentWords(mainSentence))
  if (mainWords.size === 0) return true
  const refs = referencePhrases
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .slice(0, 8)
  if (refs.length === 0) return false
  for (const ref of refs) {
    const refWords = Array.from(new Set(tokenizeEnglishContentWords(ref)))
    if (refWords.length === 0) continue
    let overlap = 0
    for (const w of refWords) {
      if (mainWords.has(w)) overlap += 1
    }
    const ratio = overlap / refWords.length
    const passed = refWords.length <= 2 ? overlap >= 1 : ratio >= 0.5
    if (!passed) return true
  }
  return false
}

function isBareEnglishPredicate(sentence: string): boolean {
  const s = String(sentence || '').trim().replace(/[.!?]+$/g, '').trim()
  if (!s) return true
  // Incomplete clauses that end at the predicate without object/complement.
  if (/\b(i|you|we|they|he|she|it)\s+(also\s+)?(have|has|had|need|needs|needed|want|wants|wanted|like|likes|liked|love|loves|loved|prefer|prefers|preferred)$/i.test(s)) {
    return true
  }
  if (/\b(i|you|we|they|he|she|it)\s+(am|is|are|was|were)$/i.test(s)) {
    return true
  }
  return false
}

function shouldRepairEnglishMainSentence(mainSentence: string, studentText: string): boolean {
  const base = String(mainSentence || '').trim()
  if (!base) return true
  if (!isLikelyTargetLanguageSentence(base, 'en', null)) return true
  if (!isLikelyFullSentence(base, 'en')) return true
  if (/^to\s+[a-z]/i.test(base)) return true
  if (isBareEnglishPredicate(base)) return true
  const titleCandidate = extractSongTitleCandidateFromVietnamese(studentText)
  if (titleCandidate) {
    const asciiTitle = stripVietnameseDiacritics(titleCandidate)
      .replace(/[^A-Za-z0-9' -]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (asciiTitle) {
      const normalizedBase = normalizeForSimilarity(base)
      const normalizedTitle = normalizeForSimilarity(asciiTitle)
      if (!normalizedBase.includes(normalizedTitle)) return true
    }
  }
  if (/\bsong\b/i.test(base) && !hasEnglishMainVerb(base)) return true
  return false
}

function ensureIntentAnswerTwoPart(
  intentAnswer: string,
  targetLanguageCode: string,
  targetLanguage: string
): string {
  const text = String(intentAnswer || '').trim()
  const fallbackQuestion = fallbackFollowUpByLanguageCode(targetLanguageCode, targetLanguage)
  if (!text) {
    return `${defaultIdea3LeadByLanguageCode(targetLanguageCode)} ${fallbackQuestion}`.trim()
  }

  const hasQuestion = hasQuestionSentence(text)
  if (hasQuestion) {
    // If only a question is provided, prepend a short contextual statement.
    const chunks = text
      .split(/(?<=[.!?。！？])\s+/u)
      .map((x) => x.trim())
      .filter(Boolean)
    const hasNonQuestion = chunks.some((x) => !/[?？]$/.test(x))
    if (hasNonQuestion) return text
    return `${defaultIdea3LeadByLanguageCode(targetLanguageCode)} ${text}`.trim()
  }

  // If no question in intentAnswer, append a follow-up question.
  return `${text} ${fallbackQuestion}`.trim()
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
  correctionNote: string
  intentAnswer: string
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
      correctionNote?: string
      intentAnswer?: string
    }
    const correctionNote = String(parsed.correctionNote || '').trim()
    const mainSentence = String(parsed.mainSentence || '').trim()
    const intentAnswer = String(parsed.intentAnswer || '').trim()
    if (!correctionNote && !mainSentence && !intentAnswer) return null
    return {
      reply: String(parsed.reply || '').trim() || composeTeacherReply(correctionNote, mainSentence, intentAnswer),
      corrections: Array.isArray(parsed.corrections) ? parsed.corrections.slice(0, 5) : [],
      pronunciationTips: Array.isArray(parsed.pronunciationTips) ? parsed.pronunciationTips.slice(0, 5) : [],
      mainSentence,
      correctionNote,
      intentAnswer,
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

function hasCoreChatFields(input: {
  mainSentence?: string
  correctionNote?: string
  intentAnswer?: string
}): boolean {
  const mainSentence = String(input.mainSentence || '').trim()
  const correctionNote = String(input.correctionNote || '').trim()
  const intentAnswer = String(input.intentAnswer || '').trim()
  return Boolean(mainSentence && correctionNote && intentAnswer)
}

async function generateDeepSeekChatJson(params: {
  systemPrompt: string
  userPrompt: string
  apiKey: string
}): Promise<ChatJsonPayload | null> {
  const model = String(process.env.DEEPSEEK_MODEL || 'deepseek-chat').trim() || 'deepseek-chat'
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt },
      ],
      response_format: { type: 'json_object' },
    }),
  })
  if (!res.ok) return null
  const data = (await res.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const text = String(data?.choices?.[0]?.message?.content || '').trim()
  if (!text) return null
  return safeJsonParse(text)
}

async function generateOpenAiFallbackChatJson(params: {
  systemPrompt: string
  userPrompt: string
  apiKey: string
}): Promise<ChatJsonPayload | null> {
  const model = String(process.env.OPENAI_FALLBACK_MODEL || 'gpt-5-mini').trim() || 'gpt-5-mini'
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt },
      ],
    }),
  })
  if (!res.ok) return null
  const data = (await res.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const text = String(data?.choices?.[0]?.message?.content || '').trim()
  if (!text) return null
  return safeJsonParse(text)
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

function composeTeacherReply(correctionNote: string, mainSentence: string, intentAnswer: string): string {
  return [correctionNote, mainSentence, intentAnswer]
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .join('\n\n')
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
    const languagePairKey = String(payload.languagePairKey || toLanguagePairKey(nativeLanguageCode, targetLanguageCode)).trim().toLowerCase()
    const pairConfig = getPairPromptConfig(nativeLanguageCode, targetLanguageCode)
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
    const normalizedTopicId = normalizeLookup(topicId)
    const normalizedTopicLabel = normalizeLookup(topicLabel)
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
    const learningMode: 'review' | 'reflex' = payload.learningMode === 'reflex' ? 'reflex' : 'review'
    const drillType = payload.drillType === 'listening' ? 'listening' : ''
    const drillSpeaking = Boolean(payload.drillSpeaking)
    const isFromDrill = drillType === 'listening' || drillSpeaking
    const drillSelectedWords = Array.isArray(payload.drillSelectedWords)
      ? payload.drillSelectedWords.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean).slice(0, 12)
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
    const replayRequestId = `replay_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

    const tryLoadReplayFlow = async (): Promise<ReplayCacheRow | null> => {
      const { data } = await adminSupabase
        .from('language_coach_dialogue_replay_cache')
        .select(
          'id, normalized_student_text, student_text, teacher_gender, learner_level, topic_id, normalized_topic_id, topic_label, normalized_topic_label, target_language, normalized_target_language, native_language, normalized_native_language, mode, learning_mode, reply, corrections_json, pronunciation_tips_json, correction_note, corrected_sentence, intent_answer, main_sentence, must_know_text, updated_at, last_used_at, hit_count'
        )
        .eq('teacher_gender', gender)
        .eq('learner_level', learnerLevel)
        .eq('normalized_topic_id', normalizedTopicId)
        .eq('normalized_topic_label', normalizedTopicLabel)
        .eq('normalized_target_language', normalizedTargetLanguage)
        .eq('normalized_native_language', normalizedNativeLanguage)
        .eq('mode', mode)
        .eq('learning_mode', learningMode)
        .order('updated_at', { ascending: false })
        .limit(40)
      const rows = Array.isArray(data) ? (data as ReplayCacheRow[]) : []
      if (rows.length === 0) {
        console.info(
          `[REPLAY][${replayRequestId}] miss reason=no-candidate gender=${gender} mode=${mode} learningMode=${learningMode} pair=${normalizedTargetLanguage}/${normalizedNativeLanguage}`
        )
        return null
      }
      let best: ReplayCacheRow | null = null
      let bestScore = 0
      for (const row of rows) {
        const score = similarityScore(studentText, String(row.student_text || row.normalized_student_text || ''))
        if (score > bestScore) {
          bestScore = score
          best = row
        }
      }
      if (!best || bestScore < 0.95) {
        console.info(
          `[REPLAY][${replayRequestId}] miss reason=score-below-threshold bestScore=${bestScore.toFixed(3)} threshold=0.950 gender=${gender} mode=${mode} learningMode=${learningMode}`
        )
        return null
      }
      console.info(
        `[REPLAY][${replayRequestId}] hit score=${bestScore.toFixed(3)} cacheId=${best.id} gender=${gender} mode=${mode} learningMode=${learningMode}`
      )
      void adminSupabase
        .from('language_coach_dialogue_replay_cache')
        .update({ last_used_at: new Date().toISOString(), hit_count: Math.max(0, Number(best.hit_count || 0)) + 1 })
        .eq('id', best.id)
      return best
    }

    const saveReplayFlow = async (input: {
      reply: string
      corrections: Correction[]
      pronunciationTips: string[]
      correctionNote: string
      correctedSentence: string
      intentAnswer: string
      mainSentence: string
      mustKnowText: string
    }) => {
      const mainSentenceRaw = String(input.mainSentence || '').trim()
      const mainSentenceValid = isLikelyTargetLanguageSentence(
        mainSentenceRaw,
        targetLanguageCode,
        targetScriptRegexByCode(targetLanguageCode)
      )
      if (!mainSentenceRaw || !mainSentenceValid) {
        console.info(
          `[REPLAY][${replayRequestId}] skip-save reason=invalid-main-sentence lang=${targetLanguageCode} main="${mainSentenceRaw.slice(0, 80)}"`
        )
        return
      }
      const payloadToSave = {
        student_text: studentText,
        normalized_student_text: normalizedStudentText,
        teacher_gender: gender,
        learner_level: learnerLevel,
        topic_id: topicId,
        normalized_topic_id: normalizedTopicId,
        topic_label: topicLabel,
        normalized_topic_label: normalizedTopicLabel,
        target_language: targetLanguage,
        normalized_target_language: normalizedTargetLanguage,
        native_language: nativeLanguage,
        normalized_native_language: normalizedNativeLanguage,
        mode,
        learning_mode: learningMode,
        reply: String(input.reply || '').trim(),
        corrections_json: JSON.stringify(input.corrections || []),
        pronunciation_tips_json: JSON.stringify(input.pronunciationTips || []),
        correction_note: String(input.correctionNote || '').trim() || null,
        corrected_sentence: String(input.correctedSentence || '').trim() || null,
        intent_answer: String(input.intentAnswer || '').trim() || null,
        main_sentence: mainSentenceRaw || null,
        must_know_text: String(input.mustKnowText || '').trim() || null,
        updated_at: new Date().toISOString(),
        last_used_at: new Date().toISOString(),
      }
      await adminSupabase
        .from('language_coach_dialogue_replay_cache')
        .upsert(payloadToSave, {
          onConflict: 'normalized_student_text,normalized_target_language,normalized_native_language,teacher_gender,mode,learning_mode,learner_level,normalized_topic_id,normalized_topic_label',
        })
      console.info(
        `[REPLAY][${replayRequestId}] save gender=${gender} mode=${mode} learningMode=${learningMode} pair=${normalizedTargetLanguage}/${normalizedNativeLanguage}`
      )
    }

    let userId = ''
    let sessionPinnedFactsRaw = '{}'
    let sessionMemory: { runningSummary: string; pinnedFacts: SessionPinnedFacts } = {
      runningSummary: '',
      pinnedFacts: { repeatedMistakes: [], correctedSentences: [], learnedPhrases: [], topicFocus: '' },
    }
    let presetReplay: PresetReplayState | null = null
    let reviewDrill: ReviewDrillState | null = null
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
      sessionPinnedFactsRaw = String(memory?.pinned_facts_json || '{}')
      presetReplay = parsePresetReplay(sessionPinnedFactsRaw)
      reviewDrill = parseReviewDrill(sessionPinnedFactsRaw)
      sessionMemory = {
        runningSummary: String(memory?.running_summary || '').trim(),
        pinnedFacts: parsePinnedFacts(sessionPinnedFactsRaw),
      }
    }
    const isPresetSession = Boolean(presetReplay && presetReplay.turns.length > 0)
    if (userId && sessionId && !isFromDrill && !isPresetSession) {
      const sessionUuid = asUuidOrEmpty(sessionId)
      if (!sessionUuid) {
        return NextResponse.json({ error: 'sessionId không hợp lệ.' }, { status: 400 })
      }
      const [{ count: liveStartCount, error: liveStartError }, { count: liveUnlockCountRaw, error: liveUnlockError }] = await Promise.all([
        adminSupabase
          .from('language_coach_credit_events')
          .select('id', { head: true, count: 'exact' })
          .eq('user_id', userId)
          .eq('session_id', sessionUuid)
          .eq('charge_type', 'english_coach_live_start'),
        adminSupabase
          .from('language_coach_credit_events')
          .select('id', { head: true, count: 'exact' })
          .eq('user_id', userId)
          .eq('session_id', sessionUuid)
          .eq('charge_type', 'english_coach_live_unlock'),
      ])
      if (liveStartError || liveUnlockError) {
        return NextResponse.json({ error: 'Không đọc được trạng thái credit của buổi học.' }, { status: 500 })
      }
      const liveStartCharged = (liveStartCount || 0) > 0
      if (!liveStartCharged) {
        return NextResponse.json(
          {
            error: `Buổi live chưa được mở khóa. Cần ${LIVE_SESSION_PRICE_CREDITS} credit cho gói ${LIVE_SESSION_BASE_TURN_LIMIT} lượt.`,
            requiredAction: 'charge_live_start',
            requiredCredits: LIVE_SESSION_PRICE_CREDITS,
          },
          { status: 402 }
        )
      }
      const liveUnlockCount = Math.max(0, Math.floor(Number(liveUnlockCountRaw || 0) || 0))
      const turnLimit = LIVE_SESSION_BASE_TURN_LIMIT + liveUnlockCount * LIVE_SESSION_EXTRA_TURN_STEP
      const root = (() => {
        try {
          const parsed = JSON.parse(String(sessionPinnedFactsRaw || '{}')) as Record<string, unknown>
          return parsed && typeof parsed === 'object' ? { ...parsed } : {}
        } catch {
          return {} as Record<string, unknown>
        }
      })()
      const billingRaw = (root.lesson_credit_billing && typeof root.lesson_credit_billing === 'object')
        ? (root.lesson_credit_billing as Record<string, unknown>)
        : {}
      const turnsUsed = Math.max(0, Math.floor(Number(billingRaw.turnsUsed || 0) || 0))
      const attemptedTurns = turnsUsed + 1
      if (attemptedTurns > turnLimit) {
        return NextResponse.json(
          {
            error: `Đã chạm giới hạn ${turnLimit} lượt của buổi live hiện tại.`,
            requiredAction: 'charge_live_unlock',
            requiredCredits: LIVE_SESSION_EXTRA_STEP_PRICE_CREDITS,
            turnLimit,
            turnsUsed,
          },
          { status: 402 }
        )
      }
      root.lesson_credit_billing = {
        ...billingRaw,
        plan: 'live',
        liveStartCharged: true,
        baseTurnLimit: LIVE_SESSION_BASE_TURN_LIMIT,
        extraTurnStep: LIVE_SESSION_EXTRA_TURN_STEP,
        extraUnlockCount: liveUnlockCount,
        turnsUsed: attemptedTurns,
        updatedAt: new Date().toISOString(),
      }
      sessionPinnedFactsRaw = JSON.stringify(root)
      sessionMemory.pinnedFacts = parsePinnedFacts(sessionPinnedFactsRaw)
    }
    if (userId && sessionId && isFromDrill && presetReplay?.active && !reviewDrill) {
      const turnIdx = Math.max(0, Math.floor(Number(presetReplay.nextTurnIndex || 0)))
      const turn = presetReplay.turns[turnIdx]
      if (turn) {
        const expectedStudent = String(turn.expectedStudent || '').trim()
        if (expectedStudent) {
          const score = similarityScore(studentText, expectedStudent)
          if (score < 0.95) {
            const retry = strictReplayRetryPromptByLanguageCode(targetLanguageCode, expectedStudent, targetLanguage, turnIdx)
            const retryIntent = ensureIntentAnswerTwoPart(retry, targetLanguageCode, targetLanguage)
            return NextResponse.json({
              reply: retry,
              corrections: [],
              pronunciationTips: [pronunciationTipByNativeLanguageCode(nativeLanguageCode)],
              correctionNote: nativeLanguageCode === 'vi'
                ? 'Bạn chưa nói khớp câu mục tiêu của bài học lưu sẵn.'
                : 'Your sentence does not match the expected line yet.',
              intentAnswer: retryIntent,
              correctedSentence: expectedStudent,
              mainSentence: expectedStudent,
              mustKnowText: expectedStudent,
              replayedFromPreset: true,
              strictReplayLocked: true,
              presetReplayNextExpectedStudentText: expectedStudent,
            })
          }
        }
        const rawTurnReply = String(turn.reply || '').trim()
        const extractedIdea3FromReply = extractPresetIdea3Line(rawTurnReply)
        const turnMainSentence =
          String(turn.mainSentence || '').trim()
          || extractPhraseTargetSentence(rawTurnReply)
          || ''
        const turnMustKnowText =
          String(turn.mustKnowText || '').trim()
          || turnMainSentence
          || rawTurnReply
        // Preset lessons: keep idea 3 exactly as stored in DB.
        const turnIntentAnswer =
          String(turn.intentAnswer || '').trim()
          || extractedIdea3FromReply
          || rawTurnReply
        const turnReply = turnIntentAnswer
        // Preset mini-drill policy:
        // - speaking: learner repeats the saved learner line (expectedStudent)
        // - listening: learner listens to teacher line (idea 3 / teacher reply)
        const presetSpeakingTarget = String(expectedStudent || turnMainSentence || turnMustKnowText || '').trim()
        const listeningPrompt = String(turnIntentAnswer || turnReply || '').trim()
        const presetTokenList = extractListeningTokenList(listeningPrompt, targetLanguageCode)
        const presetSpeakingThreshold = speakingDrillThresholdByLevel(learnerLevel)
        const presetTurnDrill: ReviewDrillState | null =
          learningMode === 'review' && presetSpeakingTarget
            ? {
                speaking: {
                  targetSentence: presetSpeakingTarget,
                  minSimilarity: presetSpeakingThreshold.minSimilarity,
                  minPronunciationScore: presetSpeakingThreshold.minPronunciationScore,
                  attempt: 0,
                },
                listening: presetTokenList.length >= 3
                  ? {
                      prompt: listeningPrompt,
                      expectedKeywords: presetTokenList,
                      options: [],
                      minMatchedKeywords: 3,
                      attempt: 0,
                    }
                  : undefined,
              }
            : null
        const nextPinnedRaw = (() => {
          try {
            const parsed = JSON.parse(sessionPinnedFactsRaw || '{}') as Record<string, unknown>
            const root = parsed && typeof parsed === 'object' ? { ...parsed } : {}
            root.preset_replay = {
              source_lesson_id: presetReplay.sourceLessonId || '',
              active: turnIdx + 1 < presetReplay.turns.length,
              next_turn_index: turnIdx + 1,
              turns: presetReplay.turns,
            }
            if (presetTurnDrill && (presetTurnDrill.speaking || presetTurnDrill.listening)) {
              root.review_drill = presetTurnDrill
            } else {
              delete root.review_drill
            }
            root.mini_stage_snapshot = {
              // Preset lessons follow strict timeline: writing -> speaking -> listening.
              stage: presetTurnDrill?.speaking
                ? 'writing'
                : 'idle',
              updatedAt: new Date().toISOString(),
            }
            return JSON.stringify(root)
          } catch {
            return JSON.stringify({
              preset_replay: {
                source_lesson_id: presetReplay.sourceLessonId || '',
                active: turnIdx + 1 < presetReplay.turns.length,
                next_turn_index: turnIdx + 1,
                turns: presetReplay.turns,
              },
              ...(presetTurnDrill && (presetTurnDrill.speaking || presetTurnDrill.listening)
                ? { review_drill: presetTurnDrill }
                : {}),
              mini_stage_snapshot: {
                stage: presetTurnDrill?.speaking
                  ? 'writing'
                  : 'idle',
                updatedAt: new Date().toISOString(),
              },
            })
          }
        })()
        const nextSummary = updateRunningSummary(sessionMemory.runningSummary, studentText, turnReply)
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
            pinned_facts_json: nextPinnedRaw,
            learning_mode: learningMode,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,session_id' }
        )
        const nextExpectedStudentText = String(presetReplay.turns[turnIdx + 1]?.expectedStudent || '').trim()
        const turnTokensJson = String(turn.tokensJson || '').trim() || undefined
        return NextResponse.json({
          reply: turnReply,
          corrections: [],
          pronunciationTips: [],
          correctionNote: String(turn.correctionNote || '').trim(),
          intentAnswer: turnIntentAnswer,
          correctedSentence: turnMainSentence,
          mainSentence: turnMainSentence,
          mustKnowText: turnMustKnowText,
          tokensJson: turnTokensJson,
          reviewDrill: presetTurnDrill?.speaking
            ? {
                type: 'speaking',
                targetSentence: presetTurnDrill.speaking.targetSentence,
                minSimilarity: presetTurnDrill.speaking.minSimilarity,
                minPronunciationScore: presetTurnDrill.speaking.minPronunciationScore,
              }
            : undefined,
          startMiniPack: learningMode === 'review',
          replayedFromPreset: true,
          presetReplayNextExpectedStudentText: nextExpectedStudentText,
        })
      }
    }
    if (userId && sessionId && isFromDrill && learningMode === 'review' && reviewDrill) {
      if (reviewDrill.speaking) {
        const speaking = reviewDrill.speaking
        const sim = similarityScore(studentText, speaking.targetSentence)
        const pronunciationScore = micPronunciationScore ?? 0
        const passBySimilarity = sim >= speaking.minSimilarity
        const passByPronunciation = pronunciationScore >= speaking.minPronunciationScore || inputSource !== 'mic'
        if (!passBySimilarity || !passByPronunciation) {
          const nextAttempt = speaking.attempt + 1
          const showCooldownHint = nextAttempt >= 3 && nextAttempt % 3 === 0
          const nextState: ReviewDrillState = {
            speaking: { ...speaking, attempt: nextAttempt },
            listening: reviewDrill.listening,
          }
          const pinned = buildReviewDrillRaw(sessionPinnedFactsRaw, nextState, {
            speakingFail: 1,
            hintServed: showCooldownHint ? 1 : 0,
          })
          await adminSupabase.from('language_coach_session_memories').upsert(
            {
              user_id: userId,
              session_id: sessionId,
              target_language: targetLanguage,
              native_language: nativeLanguage,
              learner_level: learnerLevel,
              topic_id: topicId || null,
              topic_label: topicLabel || null,
              running_summary: sessionMemory.runningSummary,
              pinned_facts_json: pinned,
              learning_mode: learningMode,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,session_id' }
          )
          const retry = strictReplayRetryPromptByLanguageCode(targetLanguageCode, speaking.targetSentence, targetLanguage, speaking.attempt)
          const cooldownHint = showCooldownHint ? speakingCooldownHint(speaking.targetSentence, nativeLanguageCode) : ''
          const correctionNote = [reviewDrillSpeakingHintByLanguageCode(nativeLanguageCode), cooldownHint].filter(Boolean).join(' ')
          return NextResponse.json({
            reply: retry,
            corrections: [],
            pronunciationTips: [pronunciationTipByNativeLanguageCode(nativeLanguageCode)],
            correctionNote,
            intentAnswer: ensureIntentAnswerTwoPart(retry, targetLanguageCode, targetLanguage),
            correctedSentence: speaking.targetSentence,
            mainSentence: speaking.targetSentence,
            mustKnowText: speaking.targetSentence,
            reviewDrill: { type: 'speaking', targetSentence: speaking.targetSentence, minSimilarity: speaking.minSimilarity },
          })
        }
        const afterSpeaking: ReviewDrillState | null = reviewDrill.listening
          ? { listening: { ...reviewDrill.listening, attempt: reviewDrill.listening.attempt || 0 } }
          : null
        const pinnedAfterSpeaking = buildReviewDrillRaw(
          sessionPinnedFactsRaw,
          afterSpeaking,
          { speakingPass: 1 },
          afterSpeaking?.listening ? 'listening' : 'done'
        )
        await adminSupabase.from('language_coach_session_memories').upsert(
          {
            user_id: userId,
            session_id: sessionId,
            target_language: targetLanguage,
            native_language: nativeLanguage,
            learner_level: learnerLevel,
            topic_id: topicId || null,
            topic_label: topicLabel || null,
            running_summary: sessionMemory.runningSummary,
            pinned_facts_json: pinnedAfterSpeaking,
            learning_mode: learningMode,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,session_id' }
        )
        if (reviewDrill.listening) {
          const listening = reviewDrill.listening
          return NextResponse.json({
            reply: reviewDrillListeningStartByLanguageCode(nativeLanguageCode),
            corrections: [],
            pronunciationTips: [],
            correctionNote: '',
            intentAnswer: ensureIntentAnswerTwoPart(
              fallbackFollowUpByLanguageCode(targetLanguageCode, targetLanguage),
              targetLanguageCode,
              targetLanguage
            ),
            correctedSentence: speaking.targetSentence,
            mainSentence: speaking.targetSentence,
            mustKnowText: speaking.targetSentence,
            reviewDrill: {
              type: 'listening',
              prompt: listening.prompt,
              options: seededShuffle(listening.options, `${sessionId}:${listening.attempt}`),
              expectedKeywords: listening.expectedKeywords,
              minMatchedKeywords: listening.minMatchedKeywords,
            },
          })
        }
        const pinnedCleared = buildReviewDrillRaw(sessionPinnedFactsRaw, null, { speakingPass: 1 }, 'done')
        await adminSupabase.from('language_coach_session_memories').upsert(
          {
            user_id: userId,
            session_id: sessionId,
            target_language: targetLanguage,
            native_language: nativeLanguage,
            learner_level: learnerLevel,
            topic_id: topicId || null,
            topic_label: topicLabel || null,
            running_summary: sessionMemory.runningSummary,
            pinned_facts_json: pinnedCleared,
            learning_mode: learningMode,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,session_id' }
        )
        return NextResponse.json({
          reply: reviewDrillListeningDoneByLanguageCode(nativeLanguageCode),
          corrections: [],
          pronunciationTips: [],
          correctionNote: '',
          intentAnswer: ensureIntentAnswerTwoPart(
            fallbackFollowUpByLanguageCode(targetLanguageCode, targetLanguage),
            targetLanguageCode,
            targetLanguage
          ),
          correctedSentence: speaking.targetSentence,
          mainSentence: speaking.targetSentence,
          mustKnowText: speaking.targetSentence,
          reviewDrill: { type: 'done' },
        })
      } else if (reviewDrill.listening) {
        const listening = reviewDrill.listening
        const selectedRaw = drillType === 'listening'
          ? drillSelectedWords
          : String(studentText || '')
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .split(/\s+/)
            .map((x) => x.trim())
            .filter(Boolean)
        const selected = Array.from(
          new Set(
            selectedRaw
              .map((x) => normalizeLookup(String(x || '')))
              .filter(Boolean)
          )
        )
        const expectedCount = Math.max(1, listening.minMatchedKeywords || 1)
        const selectedCountInvalid = drillType === 'listening' && selected.length !== expectedCount
        const matched = listening.expectedKeywords.filter((kw) => selected.includes(normalizeLookup(String(kw || ''))))
        if (selectedCountInvalid || matched.length < expectedCount) {
          const nextAttempt = listening.attempt + 1
          const showCooldownHint = nextAttempt >= 3 && nextAttempt % 3 === 0
          const nextState: ReviewDrillState = { listening: { ...listening, attempt: nextAttempt } }
          const pinned = buildReviewDrillRaw(sessionPinnedFactsRaw, nextState, {
            listeningFail: 1,
            hintServed: showCooldownHint ? 1 : 0,
          })
          await adminSupabase.from('language_coach_session_memories').upsert(
            {
              user_id: userId,
              session_id: sessionId,
              target_language: targetLanguage,
              native_language: nativeLanguage,
              learner_level: learnerLevel,
              topic_id: topicId || null,
              topic_label: topicLabel || null,
              running_summary: sessionMemory.runningSummary,
              pinned_facts_json: pinned,
              learning_mode: learningMode,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,session_id' }
          )
          const sampleKeyword = String(listening.expectedKeywords?.[Math.min(nextAttempt - 1, Math.max(0, listening.expectedKeywords.length - 1))] || '').trim()
          const hintBase = nativeLanguageCode === 'vi'
            ? `Gợi ý: em cần chọn đúng ${expectedCount} từ nghe được rõ nhất.`
            : nativeLanguageCode === 'zh'
              ? `提示：请选择你最清楚听到的 ${expectedCount} 个词。`
              : nativeLanguageCode === 'ja'
                ? `ヒント：はっきり聞こえた ${expectedCount} 語を選んでください。`
                : nativeLanguageCode === 'ko'
                  ? `힌트: 또렷하게 들린 단어 ${expectedCount}개를 선택하세요.`
                  : nativeLanguageCode === 'th'
                    ? `คำใบ้: เลือกคำที่ได้ยินชัดเจน ${expectedCount} คำ`
                    : nativeLanguageCode === 'hi'
                      ? `संकेत: जो शब्द स्पष्ट सुनाई दिए हों, उनमें से ${expectedCount} चुनें।`
                      : `Hint: pick exactly ${expectedCount} words you hear clearly.`
          const hintKeyword = sampleKeyword
            ? (nativeLanguageCode === 'vi'
              ? ` Từ gợi ý: ${sampleKeyword}.`
              : nativeLanguageCode === 'zh'
                ? ` 提示词：${sampleKeyword}。`
                : nativeLanguageCode === 'ja'
                  ? ` ヒント語：${sampleKeyword}。`
                  : nativeLanguageCode === 'ko'
                    ? ` 힌트 단어: ${sampleKeyword}.`
                    : nativeLanguageCode === 'th'
                      ? ` คำใบ้: ${sampleKeyword}`
                      : nativeLanguageCode === 'hi'
                        ? ` संकेत शब्द: ${sampleKeyword}।`
                        : ` Hint word: ${sampleKeyword}.`)
            : ''
          const hintCooldown = showCooldownHint
            ? (nativeLanguageCode === 'vi'
              ? ` Mẹo thêm: nghe theo cụm, rồi chọn ${expectedCount} từ chắc chắn nhất.`
              : nativeLanguageCode === 'zh'
                ? ` 额外提示：先按词组听，再选最确定的 ${expectedCount} 个词。`
                : nativeLanguageCode === 'ja'
                  ? ` 追加ヒント：語句単位で聞き取り、確実な ${expectedCount} 語を選びましょう。`
                  : nativeLanguageCode === 'ko'
                    ? ` 추가 팁: 구 단위로 듣고 확실한 ${expectedCount}개를 고르세요.`
                    : nativeLanguageCode === 'th'
                      ? ` เคล็ดลับเพิ่ม: ฟังเป็นวลีแล้วเลือก ${expectedCount} คำที่มั่นใจที่สุด`
                      : nativeLanguageCode === 'hi'
                        ? ` अतिरिक्त सुझाव: वाक्यांश के रूप में सुनें और सबसे पक्के ${expectedCount} शब्द चुनें।`
                        : ` Extra tip: listen by chunks, then pick the most certain ${expectedCount} words.`)
            : ''
          const hint = `${hintBase}${hintKeyword}${hintCooldown}`.trim()
          return NextResponse.json({
            reply: reviewDrillListeningRetryByLanguageCode(nativeLanguageCode),
            corrections: [],
            pronunciationTips: [],
            correctionNote: hint,
            intentAnswer: ensureIntentAnswerTwoPart(
              fallbackFollowUpByLanguageCode(targetLanguageCode, targetLanguage),
              targetLanguageCode,
              targetLanguage
            ),
            correctedSentence: '',
            mainSentence: '',
            mustKnowText: '',
            reviewDrill: {
              type: 'listening',
              prompt: listening.prompt,
              options: seededShuffle(listening.options, `${sessionId}:${listening.attempt + 1}`),
              expectedKeywords: listening.expectedKeywords,
              minMatchedKeywords: listening.minMatchedKeywords,
            },
          })
        }
        const pinnedCleared = buildReviewDrillRaw(sessionPinnedFactsRaw, null, { listeningPass: 1 }, 'done')
        await adminSupabase.from('language_coach_session_memories').upsert(
          {
            user_id: userId,
            session_id: sessionId,
            target_language: targetLanguage,
            native_language: nativeLanguage,
            learner_level: learnerLevel,
            topic_id: topicId || null,
            topic_label: topicLabel || null,
            running_summary: sessionMemory.runningSummary,
            pinned_facts_json: pinnedCleared,
            learning_mode: learningMode,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,session_id' }
        )
        return NextResponse.json({
          reply: reviewDrillListeningDoneByLanguageCode(nativeLanguageCode),
          corrections: [],
          pronunciationTips: [],
          correctionNote: '',
          intentAnswer: ensureIntentAnswerTwoPart(
            fallbackFollowUpByLanguageCode(targetLanguageCode, targetLanguage),
            targetLanguageCode,
            targetLanguage
          ),
          correctedSentence: '',
          mainSentence: '',
          mustKnowText: '',
          reviewDrill: { type: 'done' },
        })
      }
    }
    const asksReviewFar =
      /(ôn lại|ôn tập|review|recap|nhắc lại phần trước|phần trước|earlier lesson|previous lesson|lúc nãy|hồi nãy)/i.test(studentText)
    const isShortUtterance = isTooShortStudentSentence(studentText, targetLanguageCode)
    if (isShortUtterance) {
      const retryPromptByCode: Record<string, string> = {
        en: `Please say it again as a meaningful sentence with ${minSentenceRuleByLanguageCode(targetLanguageCode)}.`,
        zh: `请再说一遍，并用一个有意义的完整句子（${minSentenceRuleByLanguageCode(targetLanguageCode)}）。`,
        ja: `もう一度、意味が通る文で言ってみましょう（${minSentenceRuleByLanguageCode(targetLanguageCode)}）。`,
        ko: `다시 한 번, 의미가 통하는 문장으로 말해 보세요 (${minSentenceRuleByLanguageCode(targetLanguageCode)}).`,
        th: `ลองพูดอีกครั้งเป็นประโยคที่มีความหมาย (${minSentenceRuleByLanguageCode(targetLanguageCode)}).`,
        hi: `कृपया दोबारा एक अर्थपूर्ण वाक्य में बोलें (${minSentenceRuleByLanguageCode(targetLanguageCode)}).`,
        vi: `Bạn nói lại giúp mình thành một câu có nghĩa (${minSentenceRuleByLanguageCode(targetLanguageCode)}).`,
      }
      const retry = retryPromptByCode[targetLanguageCode] || retryPromptByCode.en
      const retryIdea3 = ensureIntentAnswerTwoPart(retry, targetLanguageCode, targetLanguage)
      return NextResponse.json({
        reply: retry,
        corrections: [],
        pronunciationTips: [pronunciationTipByNativeLanguageCode(nativeLanguageCode)],
        correctionNote: nativeLanguageCode === 'vi'
          ? `Câu vừa rồi hơi ngắn, chưa đủ để thành câu có nghĩa (${minSentenceRuleByLanguageCode(targetLanguageCode)}).`
          : 'Your sentence is too short to evaluate meaning clearly.',
        correctedSentence: '',
        intentAnswer: retryIdea3,
        mainSentence: retry,
        mustKnowText: retry,
      })
    }

    const replayFlow = await tryLoadReplayFlow()
    if (replayFlow) {
      const replayReply = String(replayFlow.reply || '').trim()
      const replayCorrections = parseCorrectionList(replayFlow.corrections_json)
      const replayPronunciationTips = parseStringList(replayFlow.pronunciation_tips_json)
      const replayCorrectionNote = String(replayFlow.correction_note || '').trim()
      const replayMainSentence =
        String(replayFlow.main_sentence || '').trim()
        || String(replayFlow.corrected_sentence || '').trim()
        || replayReply
      const replayMainSentenceValid = isLikelyTargetLanguageSentence(
        replayMainSentence,
        targetLanguageCode,
        targetScriptRegexByCode(targetLanguageCode)
      )
      if (!replayMainSentenceValid) {
        console.info(
          `[REPLAY][${replayRequestId}] skip-cache reason=invalid-main-sentence cacheId=${replayFlow.id} lang=${targetLanguageCode} main="${replayMainSentence.slice(0, 80)}"`
        )
      } else {
      const replayIntentAnswer = ensureIntentAnswerTwoPart(
        String(replayFlow.intent_answer || '').trim() || replayReply,
        targetLanguageCode,
        targetLanguage
      )
      let replayResponseReviewDrill:
        | { type: 'speaking'; targetSentence: string; minSimilarity: number; minPronunciationScore: number }
        | undefined
      if (learningMode === 'review' && replayMainSentence) {
        const speakingTargetSentence = String(replayMainSentence || '').trim()
        const listeningSource =
          String(replayIntentAnswer || '').trim()
          || String(speakingTargetSentence || '').trim()
        const listeningTokenList = extractListeningTokenList(listeningSource, targetLanguageCode)
        const listeningExpectedKeywords = listeningTokenList
        const speakingThreshold = speakingDrillThresholdByLevel(learnerLevel)
        const nextReviewDrill: ReviewDrillState | null =
          speakingTargetSentence
            ? {
                speaking: {
                  targetSentence: speakingTargetSentence,
                  minSimilarity: speakingThreshold.minSimilarity,
                  minPronunciationScore: speakingThreshold.minPronunciationScore,
                  attempt: 0,
                },
                listening: listeningExpectedKeywords.length >= 3
                  ? {
                      prompt: listeningSource || speakingTargetSentence,
                      expectedKeywords: listeningExpectedKeywords,
                      options: [],
                      minMatchedKeywords: 3,
                      attempt: 0,
                    }
                  : undefined,
              }
            : null
        if (nextReviewDrill?.speaking) {
          replayResponseReviewDrill = {
            type: 'speaking',
            targetSentence: nextReviewDrill.speaking.targetSentence,
            minSimilarity: nextReviewDrill.speaking.minSimilarity,
            minPronunciationScore: nextReviewDrill.speaking.minPronunciationScore,
          }
          if (userId && sessionId) {
            const nextPinnedRoot = (() => {
              try {
                const parsedPinned = JSON.parse(sessionPinnedFactsRaw || '{}') as Record<string, unknown>
                const base = parsedPinned && typeof parsedPinned === 'object' ? { ...parsedPinned } : {}
                base.review_drill = nextReviewDrill
                base.mini_stage_snapshot = {
                  stage: 'writing',
                  updatedAt: new Date().toISOString(),
                }
                return base
              } catch {
                return {
                  review_drill: nextReviewDrill,
                  mini_stage_snapshot: {
                    stage: 'writing',
                    updatedAt: new Date().toISOString(),
                  },
                }
              }
            })()
            await adminSupabase.from('language_coach_session_memories').upsert(
              {
                user_id: userId,
                session_id: sessionId,
                target_language: targetLanguage,
                native_language: nativeLanguage,
                learner_level: learnerLevel,
                topic_id: topicId || null,
                topic_label: topicLabel || null,
                running_summary: sessionMemory.runningSummary,
                pinned_facts_json: JSON.stringify(nextPinnedRoot),
                learning_mode: 'review',
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id,session_id' }
            )
          }
        }
      }
      const replayMustKnowText =
        String(replayFlow.must_know_text || '').trim()
        || replayMainSentence
        || replayReply
      return NextResponse.json({
        reply: replayReply,
        corrections: replayCorrections,
        pronunciationTips: replayPronunciationTips,
        correctionNote: replayCorrectionNote,
        intentAnswer: replayIntentAnswer,
        correctedSentence: replayMainSentence,
        mainSentence: replayMainSentence,
        mustKnowText: replayMustKnowText,
        reviewDrill: replayResponseReviewDrill,
        startMiniPack: learningMode === 'review',
        replayedFromCache: true,
      })
      }
    }

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
        const repeatModel = repeatGenAI.getGenerativeModel(GEMINI_25_FLASH_NO_THINKING)
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
      const repeatIdea3 = ensureIntentAnswerTwoPart(latestQuestion, targetLanguageCode, targetLanguage)
      return NextResponse.json({
        reply: replyLines.join('\n'),
        corrections: [],
        pronunciationTips: [pronunciationTipByNativeLanguageCode(nativeLanguageCode)],
        mainSentence: latestQuestion,
        mustKnowText: latestQuestion,
        correctionNote: '',
        intentAnswer: repeatIdea3,
        correctedSentence: latestQuestion,
      })
    }

    if (learningMode === 'reflex') {
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel(GEMINI_25_FLASH_NO_THINKING)
      const transcript = history
        .map((m) => `${m.role === 'teacher' ? 'Teacher' : 'Student'}: ${m.text}`)
        .join('\n')
      const reflexPrompt = `Bạn là giáo viên ${targetLanguage} đang luyện PHẢN XẠ NGHE NÓI với học sinh.
Ngôn ngữ mẹ đẻ: ${nativeLanguage}. Ngôn ngữ đang học: ${targetLanguage}.

QUY TẮC BẮT BUỘC – CHỈ TRẢ VỀ NỘI DUNG BẰNG ${targetLanguage}:

1) CÂU SỬA (bắt buộc có): câu đúng/câu sửa bằng ${targetLanguage} – KHÔNG thêm nhãn "Câu của bạn nói đúng là:", "tiếng Anh nói là:", v.v. UI sẽ tự thêm.
   - Học sinh nói ${nativeLanguage}: trả [câu ${targetLanguage} đúng].
   - Học sinh nói SAI ${targetLanguage}: trả [câu ${targetLanguage} đã sửa].

2) CÂU TRẢ LỜI + CÂU HỎI (nói liền mạch): trả lời câu hỏi/câu nói của học viên, rồi hỏi thêm 1 câu gợi ý.

ĐẦY ĐỦ: [câu sửa]. [câu trả lời]. [câu hỏi gợi ý] – tất cả CHỈ bằng ${targetLanguage}, nói liền mạch.
Ví dụ: "What dishes do you have? We have pasta, salad and grilled fish. What would you like to try?"
Ví dụ khác: "Yes, my name is Phung Van Hao. I am an engineer. Nice to meet you, Hao! An engineer, that's interesting. What kind of engineering do you specialize in?"

CẤM: Không thêm nhãn tiếng mẹ đẻ, không giải thích ngữ pháp, không dài dòng.

Trả về JSON (chỉ 1 trường, không dịch – dịch gọi sau khi học viên bấm nút):
{
  "reply": "[câu sửa]. [câu trả lời]. [câu hỏi gợi ý] – CHỈ bằng ${targetLanguage}"
}

Lịch sử:
${transcript}

Học sinh vừa nói:
${studentText}`

      try {
        const reflexResult = await model.generateContent(reflexPrompt)
        const reflexText = reflexResult.response.text()?.trim() || ''
        const reflexParsed = (() => {
          try {
            const cleaned = reflexText.replace(/^```\w*\n?|\n?```$/g, '').trim()
            return JSON.parse(cleaned) as { reply?: string }
          } catch {
            return null
          }
        })()
        const reply = String(reflexParsed?.reply || reflexText || '').trim()
        if (!reply) {
          const fallback = fallbackFollowUpByLanguageCode(targetLanguageCode, targetLanguage)
          const mainSentence = fallback
          return NextResponse.json({ mainSentence, learningMode: 'reflex' })
        }
        let pinyin = ''
        const nonLatinCodes = ['zh', 'ja', 'ko', 'th', 'hi'] as const
        if (reply && nonLatinCodes.includes(targetLanguageCode as (typeof nonLatinCodes)[number])) {
          try {
            if (targetLanguageCode === 'zh') {
              pinyin = await generatePinyinForSentence(
                { generateContent: (input: string) => model.generateContent(input) },
                reply
              )
            } else {
              const romanizePrompts: Record<string, string> = {
                ja: `Convert to Latin romaji (Hepburn). One line only, no explanation:\n${reply}`,
                ko: `Convert to Latin romanization (Revised). One line only, no explanation:\n${reply}`,
                th: `Convert to Latin romanization (RTGS). One line only, no explanation:\n${reply}`,
                hi: `Convert Devanagari to Latin (IAST). One line only, no explanation:\n${reply}`,
              }
              const prompt = romanizePrompts[targetLanguageCode] || ''
              if (prompt) {
                const res = await model.generateContent(prompt)
                pinyin = String(res.response.text?.() || '').replace(/^```|```$/g, '').trim()
              }
            }
          } catch {
            // keep without pinyin
          }
        }
        const mainSentence = pinyin ? `${reply}\n\nPinyin: ${pinyin}` : reply
        if (userId && sessionId) {
          const nextSummary = updateRunningSummary(sessionMemory.runningSummary, studentText, mainSentence)
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
              pinned_facts_json: JSON.stringify(sessionMemory.pinnedFacts),
              learning_mode: 'reflex',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,session_id' }
          )
        }
        try {
          await saveReplayFlow({
            reply: mainSentence,
            corrections: [],
            pronunciationTips: [],
            correctionNote: '',
            correctedSentence: reply,
            intentAnswer: reply,
            mainSentence,
            mustKnowText: reply,
          })
        } catch {
          // Keep reflex response path resilient even if replay cache write fails.
        }
        return NextResponse.json({ mainSentence, learningMode: 'reflex' })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Reflex mode error'
        return NextResponse.json({ error: msg }, { status: 500 })
      }
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
            const pinyinModel = genAIForPinyin.getGenerativeModel(GEMINI_25_FLASH_NO_THINKING)
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
        const cachedIdea3 = ensureIntentAnswerTwoPart(
          String(phraseCached.target_sentence || '').trim(),
          targetLanguageCode,
          targetLanguage
        )
        return NextResponse.json({
          reply: replyLines.join('\n'),
          corrections: [],
          pronunciationTips: [pronunciationTipByNativeLanguageCode(nativeLanguageCode)],
          cachedPhrase: true,
          mainSentence: String(phraseCached.target_sentence || '').trim(),
          mustKnowText: String(phraseCached.target_sentence || '').trim(),
          correctionNote: '',
          intentAnswer: cachedIdea3,
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
  5) KHÔNG yêu cầu học sinh lặp lại nguyên văn câu vừa nói/vừa sửa; hãy đưa 1 câu hỏi mới hoặc nhiệm vụ biến đổi câu để tránh vòng lặp.
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
- Vẫn tránh lặp ý và vẫn chỉ giữ 1 câu hỏi tiếp theo để không gây rối.
- Tổng reply không quá 9 dòng ngắn hoặc khoảng 700 ký tự.`
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
- languagePairKey: ${languagePairKey || 'unknown'}
- pairTone: ${pairConfig.uiTone}
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
- Cách phản hồi: khen ngắn + sửa 1 lỗi lớn nhất + yêu cầu tạo 1 câu mới theo mẫu (không lặp nguyên văn).`
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
    const model = genAI.getGenerativeModel(GEMINI_25_FLASH_NO_THINKING)

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

    const { systemPrompt, userPrompt } = buildChatPrompts({
      teacherIdentity,
      nativeLanguage,
      targetLanguage,
      nativeLanguageCode,
      targetLanguageCode,
      teacherLocale,
      learnerContext,
      genderLabel,
      modePrompt,
      responseStyleGuide,
      explanationLanguage,
      bilingualGuide,
      nativeLanguageGuide,
      micGuide,
      speakingModeGuide,
      strictLanguagePairGuide,
      howToSayGuide,
      contextualReplyGuide,
      mixedAnalysisGuide,
      levelPromptIndependent,
      micAnalysisGuide,
      pinyinGuide,
      topicGuide,
      retrievalGuide,
      transcript,
      studentText,
      mixedNormalizedStudentText,
      speakingMode,
      sessionMemory,
      pairConfig,
    })

    const result = await model.generateContent([systemPrompt, userPrompt])
    const text = result.response.text()?.trim() || ''
    let parsed = safeJsonParse(text)

    if (!parsed) {
      const repairPrompt = `Chuyển nội dung sau thành JSON hợp lệ đúng schema, KHÔNG thêm markdown, KHÔNG thêm giải thích:
{
  "corrections": [
    { "original": "string", "fixed": "string", "explanationVi": "string" }
  ],
  "pronunciationTips": ["string"],
  "correctionNote": "string",
  "intentAnswer": "string",
  "mainSentence": "string"
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

    const deepSeekApiKey = String(process.env.DEEPSEEK_API_KEY || '').trim()
    const openAiApiKey = String(process.env.OPENAI_API_KEY || '').trim()

    if (!parsed || !hasCoreChatFields(parsed)) {
      const strictRetryPrompt = `Bạn là giáo viên ${targetLanguage}. Học sinh vừa nói:
${studentText}

Hãy trả JSON hợp lệ (không markdown, không text thừa) đúng schema:
{
  "corrections": [{"original":"...","fixed":"...","explanationVi":"..."}],
  "pronunciationTips": ["..."],
  "correctionNote": "...",
  "intentAnswer": "...",
  "mainSentence": "..."
}

Ràng buộc bắt buộc:
- mainSentence phải là câu sửa hoàn chỉnh, đầy đủ ý câu học sinh, chỉ bằng ${targetLanguage}.
- Không dùng fragment ngắn kiểu "to eat fish" làm mainSentence.
- Không lấy nội dung mainSentence từ intentAnswer.
- intentAnswer gồm 2 câu: (1) trả lời câu/câu hỏi của học sinh (nếu có hỏi phải đáp), (2) câu hỏi mới mở rộng hội thoại.`
      try {
        const strictRetry = await model.generateContent(strictRetryPrompt)
        parsed = safeJsonParse(strictRetry.response.text()?.trim() || '')
      } catch {
        // keep parsed null and return explicit error below
      }
    }

    if ((!parsed || !hasCoreChatFields(parsed)) && deepSeekApiKey) {
      try {
        const deepSeekParsed = await generateDeepSeekChatJson({
          systemPrompt,
          userPrompt,
          apiKey: deepSeekApiKey,
        })
        if (deepSeekParsed && hasCoreChatFields(deepSeekParsed)) {
          parsed = deepSeekParsed
        }
      } catch {
        // keep existing parsed/fallback path
      }
    }

    if ((!parsed || !hasCoreChatFields(parsed)) && openAiApiKey) {
      try {
        const openAiParsed = await generateOpenAiFallbackChatJson({
          systemPrompt,
          userPrompt,
          apiKey: openAiApiKey,
        })
        if (openAiParsed && hasCoreChatFields(openAiParsed)) {
          parsed = openAiParsed
        }
      } catch {
        // keep existing parsed/fallback path
      }
    }

    if (!parsed || !hasCoreChatFields(parsed)) {
      return NextResponse.json(
        {
          error: nativeLanguageCode === 'vi'
            ? 'AI trả dữ liệu sai định dạng nhiều lần. Vui lòng gửi lại.'
            : 'Model returned invalid JSON repeatedly. Please retry.',
          code: 'MODEL_JSON_INVALID',
          retryable: true,
        },
        { status: 502 }
      )
    }

    if (nativeLanguageCode === 'vi') {
      parsed.reply = normalizeVietnameseLearnerAddressing(parsed.reply)
      parsed.correctionNote = normalizeVietnameseLearnerAddressing(parsed.correctionNote)
      parsed.corrections = (parsed.corrections || []).map((c) => ({
        ...c,
        explanationVi: normalizeVietnameseLearnerAddressing(String(c.explanationVi || '')),
      }))
      parsed.pronunciationTips = (parsed.pronunciationTips || []).map((tip) =>
        normalizeVietnameseLearnerAddressing(String(tip || ''))
      )
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

    let correctionNote =
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
    if (isIntentAnswerTooCloseToStudent(intentAnswer, studentText, String(parsed.mainSentence || ''))) {
      intentAnswer = detailFollowUpByLanguageCode(targetLanguageCode, targetLanguage)
    }
    intentAnswer = ensureIntentAnswerTwoPart(intentAnswer, targetLanguageCode, targetLanguage)
    const aiMainSentence = String(parsed.mainSentence || '').trim()
    const extractedMainSentence = extractPhraseTargetSentence(parsed.reply)
    const correctedSentence = (parsed.corrections || [])
      .map((row) => String(row?.fixed || '').trim())
      .find((fixed) => (
        Boolean(fixed)
        && isLikelyTargetLanguageSentence(fixed, targetLanguageCode, targetScriptRe)
        && isLikelyFullSentence(fixed, targetLanguageCode)
        && !isTooShortStudentSentence(fixed, targetLanguageCode)
      )) || ''
    const studentMainSentenceCandidate = String(studentText || '').trim()
    const hasMeaningfulCorrection = hasMeaningfulSentenceCorrection(
      parsed.corrections || [],
      studentMainSentenceCandidate,
      targetLanguageCode
    )
    const shouldKeepStudentSentenceAsMain =
      isLikelyFullSentence(studentMainSentenceCandidate, targetLanguageCode)
      && isLikelyTargetLanguageSentence(studentMainSentenceCandidate, targetLanguageCode, targetScriptRe)
      && !hasMeaningfulCorrection
    const intentLead = String(intentAnswer || '')
      .split(/(?<=[.!?。！？])\s+/u)
      .map((x) => x.trim())
      .find(Boolean) || ''
    const shouldPreferCorrectionForMainSentence =
      hasMeaningfulCorrection && Boolean(correctedSentence)
    const aiMainLooksLikeIntentLead =
      Boolean(aiMainSentence)
      && Boolean(intentLead)
      && similarityScore(aiMainSentence, intentLead) >= 0.9
    const targetMainCandidates = [
      correctedSentence,
      aiMainLooksLikeIntentLead && shouldPreferCorrectionForMainSentence ? '' : aiMainSentence,
      extractedMainSentence,
      studentMainSentenceCandidate,
    ]
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .filter((x) => isLikelyTargetLanguageSentence(x, targetLanguageCode, targetScriptRe))
    const mainSentence =
      shouldKeepStudentSentenceAsMain
        ? studentMainSentenceCandidate
        : (targetMainCandidates[0] || '')
    let mainSentenceFinal = mainSentence
    const meaningReferencePhrases = (
      [
        speakingMode === 'mixed' || speakingMode === 'auto' ? mixedNormalizedStudentText : '',
        correctedSentence,
        ...(parsed.corrections || []).map((row) => String(row?.fixed || '').trim()),
      ]
    )
      .map((x) => String(x || '').trim())
      .filter((x) => Boolean(x) && isLikelyTargetLanguageSentence(x, targetLanguageCode, targetScriptRe))
      .slice(0, 8)
    const missingMeaningNeedsRepair = shouldRepairMainSentenceForMissingMeaning(
      mainSentenceFinal,
      meaningReferencePhrases,
      targetLanguageCode
    )
    if (
      targetLanguageCode === 'en'
      && (
        isTooShortStudentSentence(mainSentenceFinal, targetLanguageCode)
        || missingMeaningNeedsRepair
        || shouldRepairEnglishMainSentence(mainSentenceFinal, studentText)
      )
    ) {
      try {
        const repairMainSentencePrompt = `Sửa lại trường mainSentence thành 1 câu tiếng Anh hoàn chỉnh, tự nhiên, giữ đủ ý từ câu học sinh.
Ưu tiên giữ thực thể quan trọng như tên bài hát/tên riêng (có thể dùng transliteration Latin).
Không thêm giải thích, chỉ trả JSON:
{"mainSentence":"..."}

Câu học sinh:
${studentText}

mainSentence hiện tại:
${mainSentenceFinal}

corrections:
${JSON.stringify(parsed.corrections || [])}

intentAnswer:
${intentAnswer}`
        const repairedMain = await model.generateContent(repairMainSentencePrompt)
        const repairedObj = safeJsonObject(repairedMain.response.text()?.trim() || '')
        const repairedSentence = String(repairedObj?.mainSentence || '').trim()
        if (repairedSentence && isLikelyTargetLanguageSentence(repairedSentence, 'en', null)) {
          mainSentenceFinal = repairedSentence
        }
      } catch {
        // keep fallback below
      }
    }
    if (targetLanguageCode === 'en') {
      mainSentenceFinal = enrichEnglishSongMainSentence(mainSentenceFinal, studentText)
    }
    try {
      const mainSentenceGatePrompt = `câu "${mainSentenceFinal}" có đủ ý với câu "${studentText}" không?
Nếu đủ ý, trả JSON:
{"status":"ok"}
Nếu không đủ ý, hãy viết lại câu "${studentText}" bằng tiếng "${targetLanguage}" đầy đủ ý và chỉ trả JSON:
{"status":"rewrite","complete_sentence":"..."}
Không phân tích gì thêm.`
      const gateResult = await model.generateContent(mainSentenceGatePrompt)
      const gateObj = safeJsonObject(gateResult.response.text()?.trim() || '')
      const gateStatus = String(gateObj?.status || '').trim().toLowerCase()
      if (gateStatus !== 'ok') {
        const rewritten = String(
          gateObj?.complete_sentence
          || gateObj?.corrected_sentence
          || gateObj?.mainSentence
          || ''
        ).trim()
        if (
          rewritten
          && isLikelyTargetLanguageSentence(rewritten, targetLanguageCode, targetScriptRe)
          && isLikelyFullSentence(rewritten, targetLanguageCode)
        ) {
          mainSentenceFinal = rewritten
        }
      }
    } catch {
      // keep original mainSentenceFinal when gate prompt fails
    }
    if ((parsed.corrections || []).length === 0 && studentMainSentenceCandidate && mainSentenceFinal) {
      const score = similarityScore(studentMainSentenceCandidate, mainSentenceFinal)
      if (score < 0.985) {
        parsed.corrections = [{
          original: studentMainSentenceCandidate,
          fixed: mainSentenceFinal,
          explanationVi: correctionHintByNativeLanguageCode(nativeLanguageCode),
        }]
        if (!correctionNote) correctionNote = String(parsed.corrections[0]?.explanationVi || '').trim()
      }
    }
    const mustKnowText = String(mainSentenceFinal || '').trim()
    parsed.reply = composeTeacherReply(correctionNote, mainSentenceFinal, intentAnswer) || parsed.reply
    const replyMaxChars = responseStyle === 'concise' ? 520 : 760
    parsed.reply = clampReplyBySentence(parsed.reply, replyMaxChars)
    let responseReviewDrill:
      | { type: 'speaking'; targetSentence: string; minSimilarity: number; minPronunciationScore: number }
      | undefined
    if (userId && sessionId) {
      const previousFacts = sessionMemory.pinnedFacts
      const correctionFacts = (parsed.corrections || []).map((c) => String(c.fixed || '').trim()).filter(Boolean).slice(0, 5)
      const newRepeatedMistakes = (parsed.corrections || []).map((c) => String(c.original || '').trim()).filter(Boolean).slice(0, 5)
      const nextFacts: SessionPinnedFacts = {
        repeatedMistakes: mergeUniqueLimited(previousFacts.repeatedMistakes, newRepeatedMistakes, 12),
        correctedSentences: mergeUniqueLimited(previousFacts.correctedSentences, correctionFacts, 12),
        learnedPhrases: mergeUniqueLimited(
          previousFacts.learnedPhrases,
          [mainSentenceFinal, mustKnowText].filter(Boolean),
          16
        ),
        topicFocus: topicLabel || previousFacts.topicFocus || '',
      }
      const speakingTargetCandidate = String(mainSentenceFinal || mustKnowText || '').trim()
      const speakingTargetSentence = isLikelyTargetLanguageSentence(
        speakingTargetCandidate,
        targetLanguageCode,
        targetScriptRe
      )
        ? speakingTargetCandidate
        : ''
      const listeningSource =
        String(intentAnswer || '').trim()
        || String(mainSentenceFinal || '').trim()
        || String(speakingTargetSentence || '').trim()
      const listeningTokenList = extractListeningTokenList(listeningSource, targetLanguageCode)
      const listeningExpectedKeywords = listeningTokenList
      const speakingThreshold = speakingDrillThresholdByLevel(learnerLevel)
      const nextReviewDrill: ReviewDrillState | null =
        learningMode === 'review' && speakingTargetSentence
          ? {
              speaking: {
                targetSentence: speakingTargetSentence,
                minSimilarity: speakingThreshold.minSimilarity,
                minPronunciationScore: speakingThreshold.minPronunciationScore,
                attempt: 0,
              },
              listening: listeningExpectedKeywords.length >= 3
                ? {
                    prompt: listeningSource || speakingTargetSentence,
                    expectedKeywords: listeningExpectedKeywords,
                    options: [],
                    minMatchedKeywords: 3,
                    attempt: 0,
                  }
                : undefined,
            }
          : null
      if (nextReviewDrill?.speaking) {
        responseReviewDrill = {
          type: 'speaking',
          targetSentence: nextReviewDrill.speaking.targetSentence,
          minSimilarity: nextReviewDrill.speaking.minSimilarity,
          minPronunciationScore: nextReviewDrill.speaking.minPronunciationScore,
        }
      }
      const nextPinnedRoot = (() => {
        try {
          const parsedPinned = JSON.parse(sessionPinnedFactsRaw || '{}') as Record<string, unknown>
          const base = parsedPinned && typeof parsedPinned === 'object' ? { ...parsedPinned } : {}
          base.repeatedMistakes = nextFacts.repeatedMistakes
          base.correctedSentences = nextFacts.correctedSentences
          base.learnedPhrases = nextFacts.learnedPhrases
          base.topicFocus = nextFacts.topicFocus
          if (nextReviewDrill && (nextReviewDrill.speaking || nextReviewDrill.listening)) {
            base.review_drill = nextReviewDrill
          } else {
            delete base.review_drill
          }
          base.mini_stage_snapshot = {
            stage: nextReviewDrill && (nextReviewDrill.speaking || nextReviewDrill.listening) ? 'writing' : 'idle',
            updatedAt: new Date().toISOString(),
          }
          return base
        } catch {
          return {
            ...nextFacts,
            ...(nextReviewDrill && (nextReviewDrill.speaking || nextReviewDrill.listening)
              ? { review_drill: nextReviewDrill }
              : {}),
            mini_stage_snapshot: {
              stage: nextReviewDrill && (nextReviewDrill.speaking || nextReviewDrill.listening) ? 'writing' : 'idle',
              updatedAt: new Date().toISOString(),
            },
          }
        }
      })()
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
          pinned_facts_json: JSON.stringify(nextPinnedRoot),
          learning_mode: 'review',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,session_id' }
      )
    }
    try {
      await saveReplayFlow({
        reply: parsed.reply,
        corrections: parsed.corrections || [],
        pronunciationTips: parsed.pronunciationTips || [],
        correctionNote,
        correctedSentence: mainSentenceFinal,
        intentAnswer,
        mainSentence: mainSentenceFinal,
        mustKnowText,
      })
    } catch {
      // Keep chat response path resilient even if replay cache write fails.
    }
    return NextResponse.json({
      corrections: parsed.corrections || [],
      pronunciationTips: parsed.pronunciationTips || [],
      correctionNote,
      intentAnswer,
      mainSentence: mainSentenceFinal,
      reviewDrill: responseReviewDrill,
      startMiniPack: learningMode === 'review',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

