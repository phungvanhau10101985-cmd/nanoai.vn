import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getInternalBaseUrl } from '@/lib/internal-url'

type ActionPayload = {
  action?: 'create_from_session' | 'publish' | 'purchase' | 'match_turn' | 'assist_word' | 'validate_publish' | 'pick_random'
  sessionId?: string
  lessonId?: string
  title?: string
  topicId?: string
  topicLabel?: string
  targetLanguage?: string
  nativeLanguage?: string
  learnerLevel?: number
  goalType?: string
  estimatedMinutes?: number
  durationBucket?: 'short' | 'medium' | 'long'
  priceCredits?: number
  turnIndex?: number
  answerText?: string
  matchMode?: 'strict' | 'soft'
  teacherGender?: 'male' | 'female' | 'unknown'
  teacherVoice?: string
  word?: string
  contextSentence?: string
}

const MIN_TURNS_TO_SELL = 8
const MIN_QUALITY_SCORE_TO_PUBLISH = 75
const MIN_QUALITY_SCORE_TO_KEEP = 60
const MIN_AUDIO_COVERAGE_TO_PUBLISH = 0.8
const MIN_AUDIO_COVERAGE_HARD_REJECT = 0.5
const MAX_MISSING_CORE_RATE = 0.1

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function normalizeText(input: string): string {
  return String(input || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeLookup(input: string): string {
  return String(input || '').trim().toLowerCase()
}

function normalizeLearnerLevel(input: unknown): number | null {
  const n = Number(input)
  if (!Number.isFinite(n)) return null
  return Math.min(4, Math.max(0, Math.round(n)))
}

function computeDurationBucket(minutes: number): 'short' | 'medium' | 'long' {
  if (minutes <= 10) return 'short'
  if (minutes <= 20) return 'medium'
  return 'long'
}

function toCatalogKey(input: {
  targetLanguage?: string | null
  nativeLanguage?: string | null
  learnerLevel?: number | null
  topicId?: string | null
  goalType?: string | null
  durationBucket?: string | null
}): string {
  return [
    normalizeLookup(String(input.targetLanguage || 'na')),
    normalizeLookup(String(input.nativeLanguage || 'na')),
    input.learnerLevel == null ? 'lvl-na' : `lvl-${input.learnerLevel}`,
    normalizeLookup(String(input.topicId || 'topic-na')),
    normalizeLookup(String(input.goalType || 'goal-na')),
    normalizeLookup(String(input.durationBucket || 'dur-na')),
  ].join('__')
}

function inferTeacherGender(label: string): 'male' | 'female' | 'unknown' {
  const normalized = normalizeLookup(label)
  if (!normalized) return 'unknown'
  if (/(female|woman|cô|co giao|nu|nữ)/i.test(normalized)) return 'female'
  if (/(male|man|thầy|thay giao|nam)/i.test(normalized)) return 'male'
  return 'unknown'
}

function normalizeGender(input: unknown): 'male' | 'female' | 'unknown' {
  const raw = normalizeLookup(String(input || ''))
  if (raw === 'male') return 'male'
  if (raw === 'female') return 'female'
  return 'unknown'
}

function toWords(input: string): string[] {
  const normalized = normalizeText(input)
  return normalized ? normalized.split(' ') : []
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function softSimilarity(a: string, b: string): number {
  const aa = new Set(toWords(a))
  const bb = new Set(toWords(b))
  if (aa.size === 0 && bb.size === 0) return 1
  if (aa.size === 0 || bb.size === 0) return 0
  let overlap = 0
  aa.forEach((word) => {
    if (bb.has(word)) overlap += 1
  })
  return (2 * overlap) / (aa.size + bb.size)
}

type TurnDiagnosticsSnapshot = {
  inputSource: 'text' | 'mic'
  speakingMode: 'auto' | 'target' | 'native' | 'mixed'
  hadCorrections: boolean
  pronunciationScore: number | null
  pronunciationAccuracy: number | null
  pronunciationFluency: number | null
  pronunciationProsody: number | null
  weakWords: string[]
  wordScores: Array<{ word: string; score: number; issueType: string }>
  inferredMeaning: string | null
  targetTranscript: string | null
  nativeTranscript: string | null
  mergedTranscript: string | null
  createdAt: string | null
}

type RawTurnDiagnosticsRow = {
  input_source?: string | null
  speaking_mode?: string | null
  had_corrections?: boolean | null
  pronunciation_score?: number | null
  pronunciation_accuracy?: number | null
  pronunciation_fluency?: number | null
  pronunciation_prosody?: number | null
  weak_words_json?: string | null
  word_scores_json?: string | null
  inferred_meaning?: string | null
  target_transcript?: string | null
  native_transcript?: string | null
  merged_transcript?: string | null
  created_at?: string | null
}

function parseJsonArraySafe<T>(input: string | null | undefined): T[] {
  const raw = String(input || '').trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function normalizeDiagnosticsRow(row: RawTurnDiagnosticsRow): TurnDiagnosticsSnapshot {
  const weakWords = parseJsonArraySafe<unknown>(row.weak_words_json)
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .slice(0, 24)
  const wordScores = parseJsonArraySafe<{ word?: unknown; score?: unknown; issueType?: unknown }>(row.word_scores_json)
    .map((x) => ({
      word: String(x?.word || '').trim(),
      score: Number.isFinite(Number(x?.score)) ? Math.min(100, Math.max(0, Math.round(Number(x?.score)))) : 0,
      issueType: String(x?.issueType || '').trim() || 'unclear',
    }))
    .filter((x) => x.word)
    .slice(0, 24)
  const toScore = (value: unknown) =>
    Number.isFinite(Number(value)) ? Math.min(100, Math.max(0, Math.round(Number(value)))) : null
  return {
    inputSource: String(row.input_source || '').trim() === 'mic' ? 'mic' : 'text',
    speakingMode: (() => {
      const mode = String(row.speaking_mode || '').trim().toLowerCase()
      return mode === 'target' || mode === 'native' || mode === 'mixed' ? mode : 'auto'
    })(),
    hadCorrections: Boolean(row.had_corrections),
    pronunciationScore: toScore(row.pronunciation_score),
    pronunciationAccuracy: toScore(row.pronunciation_accuracy),
    pronunciationFluency: toScore(row.pronunciation_fluency),
    pronunciationProsody: toScore(row.pronunciation_prosody),
    weakWords,
    wordScores,
    inferredMeaning: String(row.inferred_meaning || '').trim() || null,
    targetTranscript: String(row.target_transcript || '').trim() || null,
    nativeTranscript: String(row.native_transcript || '').trim() || null,
    mergedTranscript: String(row.merged_transcript || '').trim() || null,
    createdAt: String(row.created_at || '').trim() || null,
  }
}

function mapDiagnosticsToStudentMessages(
  rows: Array<{ id: string; role: string; text: string | null }>,
  diagnosticsRows: RawTurnDiagnosticsRow[]
): Map<string, TurnDiagnosticsSnapshot> {
  const snapshots = diagnosticsRows.map((r) => normalizeDiagnosticsRow(r))
  const used = new Set<number>()
  const mapped = new Map<string, TurnDiagnosticsSnapshot>()

  const candidatesByIndex = snapshots.map((s) => {
    const rawCandidates = [s.mergedTranscript, s.targetTranscript, s.nativeTranscript]
    const normalized = rawCandidates
      .map((x) => normalizeText(String(x || '')))
      .filter(Boolean)
    return Array.from(new Set(normalized))
  })

  for (const row of rows) {
    if (row.role !== 'student') continue
    const rowText = normalizeText(String(row.text || ''))
    if (!rowText) continue

    let pickedIndex = -1
    let pickedScore = 0

    for (let i = 0; i < snapshots.length; i += 1) {
      if (used.has(i)) continue
      const candidates = candidatesByIndex[i]
      if (candidates.length === 0) continue
      for (const candidate of candidates) {
        const sim = softSimilarity(rowText, candidate)
        if (sim > pickedScore) {
          pickedScore = sim
          pickedIndex = i
        }
      }
    }

    if (pickedIndex >= 0 && pickedScore >= 0.72) {
      used.add(pickedIndex)
      mapped.set(row.id, snapshots[pickedIndex])
    }
  }

  return mapped
}

function parseWritingTaskRaw(input: string | null | undefined): {
  messageId?: string
  requiredSentences?: string[]
  currentIndex?: number
  completed?: boolean
  teacherText?: string
  instruction?: string
  referenceSentence?: string
  taskType?: 'copy_exact'
} | null {
  const raw = String(input || '').trim()
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const requiredSentences = Array.isArray(parsed.requiredSentences)
      ? parsed.requiredSentences.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 6)
      : []
    return {
      messageId: String(parsed.messageId || '').trim() || undefined,
      requiredSentences: requiredSentences.length > 0 ? requiredSentences : undefined,
      currentIndex: Number.isFinite(Number(parsed.currentIndex)) ? Math.max(0, Math.floor(Number(parsed.currentIndex))) : undefined,
      completed: typeof parsed.completed === 'boolean' ? parsed.completed : undefined,
      teacherText: String(parsed.teacherText || '').trim() || undefined,
      instruction: String(parsed.instruction || '').trim() || undefined,
      referenceSentence: String(parsed.referenceSentence || '').trim() || undefined,
      taskType: String(parsed.taskType || '').trim() === 'copy_exact' ? 'copy_exact' : undefined,
    }
  } catch {
    return null
  }
}

function buildTurns(
  rows: Array<{
    id: string
    client_message_id: string | null
    role: string
    text: string | null
    audio_url: string | null
    translation: string | null
    main_sentence: string | null
    correction_note: string | null
    intent_answer: string | null
    tokens_json: string | null
    writing_task_json: string | null
    ai_payload_json: string | null
    teacher_label: string | null
    teacher_locale: string | null
  }>,
  studentDiagnosticsByMessageId?: Map<string, TurnDiagnosticsSnapshot>
) {
  const turns: Array<{
    sourceStudentDbMessageId: string
    sourceStudentClientMessageId: string | null
    sourceStudentText: string
    sourceStudentNorm: string
    sourceStudentAudioUrl: string | null
    standardizedStudentText: string
    standardizedStudentNorm: string
    teacherDbMessageId: string
    teacherReplyText: string
    teacherAudioUrl: string | null
    teacherLabel: string | null
    teacherLocale: string | null
    teacherGender: 'male' | 'female' | 'unknown'
    teacherTranslation: string | null
    teacherTokensJson: string | null
    teacherWritingTaskJson: string | null
    teacherAiPayloadJson: string | null
    teacherMainSentence: string | null
    teacherCorrectionNote: string | null
    teacherIntentAnswer: string | null
    studentDiagnostics: TurnDiagnosticsSnapshot | null
    replayPayloadJson: string
  }> = []

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    if (row.role !== 'student') continue
    const expected = String(row.text || '').trim()
    if (!expected) continue
    let teacher: (typeof rows)[number] | null = null
    for (let j = i + 1; j < rows.length; j += 1) {
      if (rows[j].role === 'teacher') {
        teacher = rows[j]
        break
      }
    }
    if (!teacher) continue
    const teacherReply = String(teacher.text || '').trim()
    if (!teacherReply) continue
    const standardizedStudentText = String(teacher.main_sentence || '').trim() || expected
    const studentDiagnostics = studentDiagnosticsByMessageId?.get(row.id) || null
    const writingTask = parseWritingTaskRaw(teacher.writing_task_json)
    const speakingTarget =
      String(teacher.main_sentence || '').trim()
      || String(writingTask?.requiredSentences?.[0] || '').trim()
      || null
    const listeningPrompt =
      String(teacher.intent_answer || '').trim()
      || teacherReply
      || null
    const replayPayloadJson = JSON.stringify({
      sourceStudentText: expected,
      standardizedStudentText,
      student: {
        dbMessageId: row.id,
        clientMessageId: row.client_message_id || null,
        audioUrl: row.audio_url || null,
        diagnostics: studentDiagnostics,
      },
      teacher: {
        dbMessageId: teacher.id,
        label: teacher.teacher_label || null,
        locale: teacher.teacher_locale || null,
        gender: inferTeacherGender(String(teacher.teacher_label || '')),
        fullReply: teacherReply,
        translation: teacher.translation || null,
        mainSentence: teacher.main_sentence || null,
        correctionNote: teacher.correction_note || null,
        intentAnswer: teacher.intent_answer || null,
        tokensJson: teacher.tokens_json || null,
        writingTaskJson: teacher.writing_task_json || null,
        aiPayloadJson: teacher.ai_payload_json || null,
      },
      miniDrillBundle: {
        writingTask,
        speakingTarget,
        listeningPrompt,
      },
    })
    turns.push({
      sourceStudentDbMessageId: row.id,
      sourceStudentClientMessageId: row.client_message_id || null,
      sourceStudentText: expected,
      sourceStudentNorm: normalizeText(expected),
      sourceStudentAudioUrl: row.audio_url || null,
      standardizedStudentText,
      standardizedStudentNorm: normalizeText(standardizedStudentText),
      teacherDbMessageId: teacher.id,
      teacherReplyText: teacherReply,
      teacherAudioUrl: teacher.audio_url || null,
      teacherLabel: teacher.teacher_label || null,
      teacherLocale: teacher.teacher_locale || null,
      teacherGender: inferTeacherGender(String(teacher.teacher_label || '')),
      teacherTranslation: teacher.translation || null,
      teacherTokensJson: teacher.tokens_json || null,
      teacherWritingTaskJson: teacher.writing_task_json || null,
      teacherAiPayloadJson: teacher.ai_payload_json || null,
      teacherMainSentence: teacher.main_sentence || null,
      teacherCorrectionNote: teacher.correction_note || null,
      teacherIntentAnswer: teacher.intent_answer || null,
      studentDiagnostics,
      replayPayloadJson,
    })
  }
  return turns
}

function scoreLesson(turns: ReturnType<typeof buildTurns>) {
  const turnCount = turns.length
  const avgStudentLen =
    turnCount > 0
      ? turns.reduce((sum, t) => sum + toWords(t.standardizedStudentText).length, 0) / turnCount
      : 0
  const avgTeacherLen =
    turnCount > 0
      ? turns.reduce((sum, t) => sum + toWords(t.teacherReplyText).length, 0) / turnCount
      : 0
  const withAudioRate =
    turnCount > 0 ? turns.filter((t) => Boolean(String(t.teacherAudioUrl || '').trim())).length / turnCount : 0

  const scoreTurns = Math.min(40, turnCount * 8)
  const scoreStudentLen = Math.min(25, Math.max(0, (avgStudentLen - 3) * 4))
  const scoreTeacherLen = Math.min(20, Math.max(0, (avgTeacherLen - 5) * 1.6))
  const scoreAudio = Math.round(withAudioRate * 15)
  const qualityScore = Math.round(scoreTurns + scoreStudentLen + scoreTeacherLen + scoreAudio)

  return {
    qualityScore: Math.min(100, Math.max(0, qualityScore)),
    qualityMeta: {
      turnCount,
      avgStudentLen: Number(avgStudentLen.toFixed(2)),
      avgTeacherLen: Number(avgTeacherLen.toFixed(2)),
      withAudioRate: Number(withAudioRate.toFixed(2)),
    },
  }
}

type LessonQualityTurn = {
  sourceStudentText: string
  standardizedStudentText: string
  teacherReplyText: string
  sourceStudentAudioUrl: string | null
  teacherAudioUrl: string | null
  teacherMainSentence: string | null
  teacherCorrectionNote: string | null
  teacherIntentAnswer: string | null
  replayPayloadJson: string | null
}

function evaluateLessonQuality(turns: LessonQualityTurn[]) {
  const turnCount = turns.length
  const missingCore = turns.filter(
    (t) =>
      !String(t.sourceStudentText || '').trim() ||
      !String(t.standardizedStudentText || '').trim() ||
      !String(t.teacherReplyText || '').trim()
  ).length
  const missingCoreRate = turnCount > 0 ? missingCore / turnCount : 1
  const withAudio = turns.filter((t) => Boolean(String(t.teacherAudioUrl || '').trim())).length
  const audioCoverage = turnCount > 0 ? withAudio / turnCount : 0
  const withStudentAudio = turns.filter((t) => Boolean(String(t.sourceStudentAudioUrl || '').trim())).length
  const studentAudioCoverage = turnCount > 0 ? withStudentAudio / turnCount : 0
  const withStructuredTeacher = turns.filter(
    (t) =>
      Boolean(String(t.teacherMainSentence || '').trim()) ||
      Boolean(String(t.teacherCorrectionNote || '').trim()) ||
      Boolean(String(t.teacherIntentAnswer || '').trim())
  ).length
  const structuredTeacherRate = turnCount > 0 ? withStructuredTeacher / turnCount : 0

  const studentWordLens = turns.map((t) => toWords(t.standardizedStudentText).length)
  const teacherWordLens = turns.map((t) => toWords(t.teacherReplyText).length)
  const shortStudentTurns = studentWordLens.filter((n) => n < 3).length
  const shortStudentRate = turnCount > 0 ? shortStudentTurns / turnCount : 1
  const avgStudentLen = turnCount > 0 ? studentWordLens.reduce((a, b) => a + b, 0) / turnCount : 0
  const avgTeacherLen = turnCount > 0 ? teacherWordLens.reduce((a, b) => a + b, 0) / turnCount : 0

  const normalizedPairs = turns.map((t) => ({
    source: normalizeText(t.sourceStudentText),
    standardized: normalizeText(t.standardizedStudentText),
  }))
  const standardizedChanged = normalizedPairs.filter((x) => x.source && x.standardized && x.source !== x.standardized).length
  const standardizedChangedRate = turnCount > 0 ? standardizedChanged / turnCount : 0

  const uniqueStudentSet = new Set(normalizedPairs.map((x) => x.standardized).filter(Boolean))
  const repetitionRate = turnCount > 0 ? 1 - uniqueStudentSet.size / turnCount : 1

  const allStudentWords = turns.flatMap((t) => toWords(t.standardizedStudentText))
  const uniqueWordCount = new Set(allStudentWords).size
  const vocabDiversity = allStudentWords.length > 0 ? uniqueWordCount / allStudentWords.length : 0

  const completenessScore = 30 * clamp(1 - missingCoreRate, 0, 1)
  const audioScore = 20 * clamp(audioCoverage / MIN_AUDIO_COVERAGE_TO_PUBLISH, 0, 1)
  const progressionScore = 20 * clamp(turnCount / 12, 0, 1)
  const studentQualityScore = 15 * clamp(1 - shortStudentRate, 0, 1)
  const standardizationScore =
    standardizedChangedRate < 0.05
      ? 4
      : standardizedChangedRate <= 0.8
        ? 10
        : 6
  const vocabScore = 5 * clamp(vocabDiversity / 0.45, 0, 1)
  const repetitionPenalty = repetitionRate > 0.45 ? Math.round((repetitionRate - 0.45) * 20) : 0

  const qualityScore = Math.round(
    clamp(
      completenessScore +
        audioScore +
        progressionScore +
        studentQualityScore +
        standardizationScore +
        vocabScore -
        repetitionPenalty,
      0,
      100
    )
  )

  const hardRejectReasons: string[] = []
  if (turnCount < MIN_TURNS_TO_SELL) hardRejectReasons.push(`Số turn hợp lệ < ${MIN_TURNS_TO_SELL}.`)
  if (missingCoreRate > MAX_MISSING_CORE_RATE) {
    hardRejectReasons.push(`Thiếu dữ liệu lõi vượt ${Math.round(MAX_MISSING_CORE_RATE * 100)}%.`)
  }
  if (audioCoverage < MIN_AUDIO_COVERAGE_HARD_REJECT) {
    hardRejectReasons.push(`Tỷ lệ audio teacher < ${Math.round(MIN_AUDIO_COVERAGE_HARD_REJECT * 100)}%.`)
  }
  if (qualityScore < MIN_QUALITY_SCORE_TO_KEEP) {
    hardRejectReasons.push(`Điểm chất lượng < ${MIN_QUALITY_SCORE_TO_KEEP}.`)
  }

  const publishIssues: string[] = []
  if (qualityScore < MIN_QUALITY_SCORE_TO_PUBLISH) {
    publishIssues.push(`Điểm chất lượng phải >= ${MIN_QUALITY_SCORE_TO_PUBLISH}.`)
  }
  if (audioCoverage < MIN_AUDIO_COVERAGE_TO_PUBLISH) {
    publishIssues.push(`Tỷ lệ audio teacher phải >= ${Math.round(MIN_AUDIO_COVERAGE_TO_PUBLISH * 100)}%.`)
  }
  if (structuredTeacherRate < 0.5) {
    publishIssues.push('Payload teacher có cấu trúc còn thấp (<50% turn).')
  }

  return {
    qualityScore,
    keepable: hardRejectReasons.length === 0,
    publishable: hardRejectReasons.length === 0 && publishIssues.length === 0,
    hardRejectReasons,
    publishIssues,
    metrics: {
      turnCount,
      missingCore,
      missingCoreRate: Number(missingCoreRate.toFixed(3)),
      withAudio,
      audioCoverage: Number(audioCoverage.toFixed(3)),
      withStructuredTeacher,
      structuredTeacherRate: Number(structuredTeacherRate.toFixed(3)),
      withStudentAudio,
      studentAudioCoverage: Number(studentAudioCoverage.toFixed(3)),
      shortStudentRate: Number(shortStudentRate.toFixed(3)),
      avgStudentLen: Number(avgStudentLen.toFixed(2)),
      avgTeacherLen: Number(avgTeacherLen.toFixed(2)),
      standardizedChangedRate: Number(standardizedChangedRate.toFixed(3)),
      repetitionRate: Number(repetitionRate.toFixed(3)),
      vocabDiversity: Number(vocabDiversity.toFixed(3)),
    },
  }
}

type PersistedLessonTurn = {
  turn_index: number
  source_student_text: string | null
  source_student_audio_url: string | null
  standardized_student_text: string | null
  teacher_reply_text: string | null
  teacher_audio_url: string | null
  teacher_main_sentence: string | null
  teacher_correction_note: string | null
  teacher_intent_answer: string | null
  replay_payload_json: string | null
}

function validateLessonForPublish(
  lesson: { quality_score: number | null; turns_count: number | null },
  turns: PersistedLessonTurn[]
) {
  const expectedTurns = Math.max(0, Number(lesson.turns_count || 0))
  const actualTurns = turns.length
  const mappedTurns: LessonQualityTurn[] = turns.map((t) => ({
    sourceStudentText: String(t.source_student_text || ''),
    standardizedStudentText: String(t.standardized_student_text || ''),
    teacherReplyText: String(t.teacher_reply_text || ''),
    sourceStudentAudioUrl: t.source_student_audio_url || null,
    teacherAudioUrl: t.teacher_audio_url || null,
    teacherMainSentence: t.teacher_main_sentence || null,
    teacherCorrectionNote: t.teacher_correction_note || null,
    teacherIntentAnswer: t.teacher_intent_answer || null,
    replayPayloadJson: t.replay_payload_json || null,
  }))
  const evalResult = evaluateLessonQuality(mappedTurns)
  const issues: string[] = []
  if (expectedTurns > 0 && actualTurns !== expectedTurns) {
    issues.push(`Số turn lưu metadata (${expectedTurns}) khác số turn thực tế (${actualTurns}).`)
  }
  issues.push(...evalResult.hardRejectReasons, ...evalResult.publishIssues)
  return {
    ok: issues.length === 0,
    issues,
    stats: {
      expectedTurns,
      actualTurns,
      qualityScore: evalResult.qualityScore,
      ...evalResult.metrics,
      storedQualityScore: Number(lesson.quality_score || 0),
    },
  }
}

async function getAuthedUser() {
  const supabase = createClient()
  const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để sử dụng Live lesson.')
  return auth
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthedUser()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    const adminSupabase = adminClient()

    const lessonId = String(request.nextUrl.searchParams.get('lessonId') || '').trim()
    const mine = String(request.nextUrl.searchParams.get('mine') || '').trim() === '1'
    const topicId = String(request.nextUrl.searchParams.get('topicId') || '').trim()
    const targetLanguage = String(request.nextUrl.searchParams.get('targetLanguage') || '').trim()
    const nativeLanguage = String(request.nextUrl.searchParams.get('nativeLanguage') || '').trim()
    const goalType = String(request.nextUrl.searchParams.get('goalType') || '').trim()
    const durationBucket = String(request.nextUrl.searchParams.get('durationBucket') || '').trim()
    const learnerLevel = normalizeLearnerLevel(request.nextUrl.searchParams.get('learnerLevel') || '')
    const limitRaw = Number(request.nextUrl.searchParams.get('limit') || 20)
    const limit = Number.isFinite(limitRaw) ? Math.min(60, Math.max(1, Math.floor(limitRaw))) : 20

    if (lessonId) {
      const { data: lesson, error: lessonError } = await adminSupabase
        .from('language_coach_live_lessons')
        .select(
          'id, source_user_id, title, topic_id, topic_label, target_language, native_language, learner_level, goal_type, estimated_minutes, duration_bucket, catalog_key, teacher_gender, teacher_label, teacher_locale, language_pair_key, quality_score, quality_meta_json, price_credits, turns_count, status, approved, sales_count, published_at, created_at, turn_ids'
        )
        .eq('id', lessonId)
        .limit(1)
        .maybeSingle()

      if (lessonError) return NextResponse.json({ error: lessonError.message }, { status: 500 })
      if (!lesson) return NextResponse.json({ error: 'Không tìm thấy bài Live.' }, { status: 404 })

      const isOwner = lesson.source_user_id === user.id
      const isPublished = String(lesson.status || '') === 'published'
      const isPaid = Number(lesson.price_credits || 0) > 0
      let purchased = false

      if (!isOwner && isPaid) {
        const { data: owned } = await adminSupabase
          .from('language_coach_live_lesson_purchases')
          .select('id')
          .eq('lesson_id', lesson.id)
          .eq('user_id', user.id)
          .limit(1)
        purchased = Array.isArray(owned) && owned.length > 0
      }

      const canAccessTurns = isOwner || (isPublished && (!isPaid || purchased))
      if (!canAccessTurns) {
        return NextResponse.json({
          lesson: {
            id: lesson.id,
            title: lesson.title,
            topicId: lesson.topic_id,
            topicLabel: lesson.topic_label,
            targetLanguage: lesson.target_language,
            nativeLanguage: lesson.native_language,
            learnerLevel: lesson.learner_level,
            goalType: lesson.goal_type,
            estimatedMinutes: lesson.estimated_minutes,
            durationBucket: lesson.duration_bucket,
            catalogKey: lesson.catalog_key,
            teacherGender: lesson.teacher_gender,
            teacherLabel: lesson.teacher_label,
            teacherLocale: lesson.teacher_locale,
            languagePairKey: lesson.language_pair_key,
            qualityScore: lesson.quality_score,
            priceCredits: Number(lesson.price_credits || 0),
            turnsCount: lesson.turns_count,
            status: lesson.status,
            approved: lesson.approved,
            salesCount: lesson.sales_count,
            publishedAt: lesson.published_at,
            createdAt: lesson.created_at,
            purchased,
            isOwner,
            locked: true,
          },
          turns: [],
        })
      }

      const turnIdsRaw = (lesson as { turn_ids?: string[] }).turn_ids
      const turnIds = Array.isArray(turnIdsRaw) ? turnIdsRaw.filter((id): id is string => typeof id === 'string') : []
      let turns: Array<{
        turn_index?: number
        source_student_text?: string
        source_student_audio_url?: string
        source_student_client_message_id?: string
        source_student_db_message_id?: string
        standardized_student_text?: string
        teacher_reply_text?: string
        teacher_audio_url?: string
        teacher_translation?: string
        teacher_tokens_json?: string
        teacher_writing_task_json?: string
        teacher_main_sentence?: string
        teacher_correction_note?: string
        teacher_intent_answer?: string
        teacher_db_message_id?: string
        replay_payload_json?: string
      }> = []

      if (turnIds.length > 0) {
        const { data: turnRows, error: turnsErr } = await adminSupabase
          .from('language_coach_live_lesson_turns')
          .select(
            'id, turn_index, source_student_text, source_student_audio_url, source_student_client_message_id, source_student_db_message_id, standardized_student_text, teacher_reply_text, teacher_audio_url, teacher_translation, teacher_tokens_json, teacher_writing_task_json, teacher_main_sentence, teacher_correction_note, teacher_intent_answer, teacher_db_message_id, replay_payload_json'
          )
          .in('id', turnIds)
        if (turnsErr) return NextResponse.json({ error: turnsErr.message }, { status: 500 })
        turns = (turnRows || []).sort((a, b) => turnIds.indexOf(a.id) - turnIds.indexOf(b.id))
      } else {
        const { data: turnRows, error: turnsErr } = await adminSupabase
          .from('language_coach_live_lesson_turns')
          .select(
            'turn_index, source_student_text, source_student_audio_url, source_student_client_message_id, source_student_db_message_id, standardized_student_text, teacher_reply_text, teacher_audio_url, teacher_translation, teacher_tokens_json, teacher_writing_task_json, teacher_main_sentence, teacher_correction_note, teacher_intent_answer, teacher_db_message_id, replay_payload_json'
          )
          .eq('lesson_id', lesson.id)
          .order('turn_index', { ascending: true })
        if (turnsErr) return NextResponse.json({ error: turnsErr.message }, { status: 500 })
        turns = turnRows || []
      }

      return NextResponse.json({
        lesson: {
          id: lesson.id,
          title: lesson.title,
          topicId: lesson.topic_id,
          topicLabel: lesson.topic_label,
          targetLanguage: lesson.target_language,
          nativeLanguage: lesson.native_language,
          learnerLevel: lesson.learner_level,
          goalType: lesson.goal_type,
          estimatedMinutes: lesson.estimated_minutes,
          durationBucket: lesson.duration_bucket,
          catalogKey: lesson.catalog_key,
          teacherGender: lesson.teacher_gender,
          teacherLabel: lesson.teacher_label,
          teacherLocale: lesson.teacher_locale,
          languagePairKey: lesson.language_pair_key,
          qualityScore: lesson.quality_score,
          qualityMeta: JSON.parse(String(lesson.quality_meta_json || '{}')),
          priceCredits: Number(lesson.price_credits || 0),
          turnsCount: lesson.turns_count,
          status: lesson.status,
          approved: lesson.approved,
          salesCount: lesson.sales_count,
          publishedAt: lesson.published_at,
          createdAt: lesson.created_at,
          purchased,
          isOwner,
          locked: false,
        },
        turns: (turns || []).map((t) => ({
          turnIndex: t.turn_index,
          sourceStudentDbMessageId: t.source_student_db_message_id,
          sourceStudentClientMessageId: t.source_student_client_message_id,
          sourceStudentText: t.source_student_text,
          sourceStudentAudioUrl: t.source_student_audio_url,
          expectedStudentText: t.standardized_student_text,
          teacherDbMessageId: t.teacher_db_message_id,
          teacherReplyText: t.teacher_reply_text,
          teacherAudioUrl: t.teacher_audio_url,
          teacherTranslation: t.teacher_translation,
          teacherTokensJson: t.teacher_tokens_json,
          teacherWritingTaskJson: t.teacher_writing_task_json,
          teacherMainSentence: t.teacher_main_sentence,
          teacherCorrectionNote: t.teacher_correction_note,
          teacherIntentAnswer: t.teacher_intent_answer,
          replayPayload: JSON.parse(String(t.replay_payload_json || '{}')),
        })),
      })
    }

    let query = adminSupabase
      .from('language_coach_live_lessons')
      .select(
        'id, source_user_id, title, topic_id, topic_label, target_language, native_language, learner_level, goal_type, estimated_minutes, duration_bucket, catalog_key, teacher_gender, teacher_label, teacher_locale, language_pair_key, quality_score, price_credits, turns_count, status, approved, sales_count, published_at, created_at'
      )
      .order('published_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (mine) {
      query = query.eq('source_user_id', user.id)
    } else {
      query = query.eq('status', 'published')
      if (topicId) query = query.eq('topic_id', topicId)
      if (targetLanguage) query = query.eq('target_language', targetLanguage)
      if (nativeLanguage) query = query.eq('native_language', nativeLanguage)
      if (goalType) query = query.eq('goal_type', goalType)
      if (durationBucket === 'short' || durationBucket === 'medium' || durationBucket === 'long') {
        query = query.eq('duration_bucket', durationBucket)
      }
      if (learnerLevel != null) query = query.eq('learner_level', learnerLevel)
    }

    const { data: lessons, error: listError } = await query
    if (listError) return NextResponse.json({ error: listError.message }, { status: 500 })

    const lessonIds = (lessons || []).map((x) => String(x.id || '')).filter(Boolean)
    let purchasedSet = new Set<string>()
    if (lessonIds.length > 0) {
      const { data: purchasedRows } = await adminSupabase
        .from('language_coach_live_lesson_purchases')
        .select('lesson_id')
        .eq('user_id', user.id)
        .in('lesson_id', lessonIds)
      purchasedSet = new Set((purchasedRows || []).map((x) => String(x.lesson_id || '')))
    }

    return NextResponse.json({
      items: (lessons || []).map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        topicId: lesson.topic_id,
        topicLabel: lesson.topic_label,
        targetLanguage: lesson.target_language,
        nativeLanguage: lesson.native_language,
        learnerLevel: lesson.learner_level,
        goalType: lesson.goal_type,
        estimatedMinutes: lesson.estimated_minutes,
        durationBucket: lesson.duration_bucket,
        catalogKey: lesson.catalog_key,
        teacherGender: lesson.teacher_gender,
        teacherLabel: lesson.teacher_label,
        teacherLocale: lesson.teacher_locale,
        languagePairKey: lesson.language_pair_key,
        qualityScore: lesson.quality_score,
        priceCredits: Number(lesson.price_credits || 0),
        turnsCount: lesson.turns_count,
        status: lesson.status,
        approved: lesson.approved,
        salesCount: lesson.sales_count,
        publishedAt: lesson.published_at,
        createdAt: lesson.created_at,
        purchased: purchasedSet.has(String(lesson.id)),
        isOwner: lesson.source_user_id === user.id,
      })),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthedUser()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    const payload = (await request.json()) as ActionPayload
    const action = payload.action
    const adminSupabase = adminClient()

    if (action === 'create_from_session') {
      const sessionId = String(payload.sessionId || '').trim()
      if (!sessionId) return NextResponse.json({ error: 'Thiếu sessionId.' }, { status: 400 })

      const [rowsResult, diagnosticsResult] = await Promise.all([
        adminSupabase
          .from('language_coach_messages')
          .select('id, client_message_id, role, text, audio_url, translation, main_sentence, correction_note, intent_answer, tokens_json, writing_task_json, ai_payload_json, teacher_label, teacher_locale, target_language')
          .eq('user_id', user.id)
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true })
          .limit(500),
        adminSupabase
          .from('language_coach_turn_diagnostics')
          .select(
            'input_source, speaking_mode, had_corrections, pronunciation_score, pronunciation_accuracy, pronunciation_fluency, pronunciation_prosody, weak_words_json, word_scores_json, inferred_meaning, target_transcript, native_transcript, merged_transcript, created_at'
          )
          .eq('user_id', user.id)
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true })
          .limit(1200),
      ])

      if (rowsResult.error) return NextResponse.json({ error: rowsResult.error.message }, { status: 500 })
      if (diagnosticsResult.error) return NextResponse.json({ error: diagnosticsResult.error.message }, { status: 500 })

      const rows = rowsResult.data || []
      const studentDiagnosticsByMessageId = mapDiagnosticsToStudentMessages(
        rows as Array<{ id: string; role: string; text: string | null }>,
        (diagnosticsResult.data || []) as RawTurnDiagnosticsRow[]
      )
      const turns = buildTurns(rows, studentDiagnosticsByMessageId)
      if (turns.length < MIN_TURNS_TO_SELL) {
        return NextResponse.json(
          { error: `Session cần tối thiểu ${MIN_TURNS_TO_SELL} lượt student->teacher rõ ràng để tạo Live lesson.` },
          { status: 400 }
        )
      }

      const scoring = scoreLesson(turns)
      const qualityEvaluation = evaluateLessonQuality(
        turns.map((t) => ({
          sourceStudentText: t.sourceStudentText,
          standardizedStudentText: t.standardizedStudentText,
          teacherReplyText: t.teacherReplyText,
          teacherAudioUrl: t.teacherAudioUrl,
          teacherMainSentence: t.teacherMainSentence,
          teacherCorrectionNote: t.teacherCorrectionNote,
          teacherIntentAnswer: t.teacherIntentAnswer,
          replayPayloadJson: t.replayPayloadJson,
        }))
      )
      if (!qualityEvaluation.keepable) {
        return NextResponse.json(
          {
            error: 'Bài mẫu không đạt tiêu chí chất lượng, đã bị loại tự động.',
            qualityScore: qualityEvaluation.qualityScore,
            reasons: qualityEvaluation.hardRejectReasons,
            metrics: qualityEvaluation.metrics,
          },
          { status: 400 }
        )
      }
      const title =
        String(payload.title || '').trim() ||
        `Live lesson ${new Date().toISOString().slice(0, 10)} • ${String(payload.targetLanguage || 'Language').trim()}`
      const topicId = String(payload.topicId || '').trim() || null
      const topicLabel = String(payload.topicLabel || '').trim() || null
      const targetLanguage =
        String(payload.targetLanguage || '').trim() || String(rows?.find((r) => r.target_language)?.target_language || '').trim() || null
      const nativeLanguage = String(payload.nativeLanguage || '').trim() || null
      const learnerLevel = normalizeLearnerLevel(payload.learnerLevel)
      const goalType = String(payload.goalType || '').trim() || null
      const estimatedMinutesInput = Number(payload.estimatedMinutes)
      const estimatedMinutes =
        Number.isFinite(estimatedMinutesInput) && estimatedMinutesInput > 0
          ? Math.round(estimatedMinutesInput)
          : Math.max(6, Math.round(turns.length * 1.5))
      const durationBucket =
        payload.durationBucket === 'short' || payload.durationBucket === 'medium' || payload.durationBucket === 'long'
          ? payload.durationBucket
          : computeDurationBucket(estimatedMinutes)
      const catalogKey = toCatalogKey({
        targetLanguage,
        nativeLanguage,
        learnerLevel,
        topicId,
        goalType,
        durationBucket,
      })
      const teacherSample = turns.find((t) => t.teacherLabel || t.teacherLocale) || null
      const teacherLabel = teacherSample?.teacherLabel || null
      const teacherLocale = teacherSample?.teacherLocale || null
      const teacherGender = teacherSample?.teacherGender || 'unknown'
      const languagePairKey = `${normalizeLookup(String(targetLanguage || 'na'))}__${normalizeLookup(String(nativeLanguage || 'na'))}`
      const priceCreditsRaw = Number(payload.priceCredits)
      const priceCredits =
        Number.isFinite(priceCreditsRaw) && priceCreditsRaw >= 0
          ? Math.round(priceCreditsRaw * 10) / 10
          : 1

      const { data: lesson, error: upsertError } = await adminSupabase
        .from('language_coach_live_lessons')
        .upsert(
          {
            source_user_id: user.id,
            source_session_id: sessionId,
            title,
            topic_id: topicId,
            topic_label: topicLabel,
            target_language: targetLanguage,
            native_language: nativeLanguage,
            learner_level: learnerLevel,
            goal_type: goalType,
            estimated_minutes: estimatedMinutes,
            duration_bucket: durationBucket,
            catalog_key: catalogKey,
            teacher_gender: teacherGender,
            teacher_label: teacherLabel,
            teacher_locale: teacherLocale,
            language_pair_key: languagePairKey,
            quality_score: qualityEvaluation.qualityScore,
            quality_meta_json: JSON.stringify({
              ...scoring.qualityMeta,
              qualityMetrics: qualityEvaluation.metrics,
              hardRejectReasons: qualityEvaluation.hardRejectReasons,
              publishIssues: qualityEvaluation.publishIssues,
            }),
            price_credits: priceCredits,
            turns_count: turns.length,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'source_user_id,source_session_id' }
        )
        .select('id, status, approved')
        .single()

      if (upsertError || !lesson) {
        return NextResponse.json({ error: upsertError?.message || 'Không lưu được bài Live.' }, { status: 500 })
      }

      await adminSupabase.from('language_coach_live_lesson_turns').delete().eq('lesson_id', lesson.id)

      const { data: insertedTurns, error: insertTurnsError } = await adminSupabase
        .from('language_coach_live_lesson_turns')
        .insert(
          turns.map((t, index) => ({
            lesson_id: lesson.id,
            turn_index: index,
            source_student_db_message_id: t.sourceStudentDbMessageId,
            source_student_client_message_id: t.sourceStudentClientMessageId,
            source_student_text: t.sourceStudentText,
            source_student_norm: t.sourceStudentNorm,
            source_student_audio_url: t.sourceStudentAudioUrl,
            standardized_student_text: t.standardizedStudentText,
            standardized_student_norm: t.standardizedStudentNorm,
            teacher_db_message_id: t.teacherDbMessageId,
            teacher_reply_text: t.teacherReplyText,
            teacher_audio_url: t.teacherAudioUrl,
            teacher_translation: t.teacherTranslation,
            teacher_tokens_json: t.teacherTokensJson,
            teacher_writing_task_json: t.teacherWritingTaskJson,
            teacher_main_sentence: t.teacherMainSentence,
            teacher_correction_note: t.teacherCorrectionNote,
            teacher_intent_answer: t.teacherIntentAnswer,
            replay_payload_json: t.replayPayloadJson,
          }))
        )
        .select('id')

      if (insertTurnsError) return NextResponse.json({ error: insertTurnsError.message }, { status: 500 })

      const turnIds = (insertedTurns || []).map((r) => String(r.id || '')).filter(Boolean)
      if (turnIds.length > 0) {
        await adminSupabase
          .from('language_coach_live_lessons')
          .update({ turn_ids: turnIds, updated_at: new Date().toISOString() })
          .eq('id', lesson.id)
      }

      const qa = validateLessonForPublish(
        { quality_score: qualityEvaluation.qualityScore, turns_count: turns.length },
        turns.map((t, idx) => ({
          turn_index: idx,
          source_student_text: t.sourceStudentText,
          standardized_student_text: t.standardizedStudentText,
          teacher_reply_text: t.teacherReplyText,
          teacher_audio_url: t.teacherAudioUrl,
          replay_payload_json: t.replayPayloadJson,
        }))
      )

      return NextResponse.json({
        lessonId: lesson.id,
        turnsCount: turns.length,
        qualityScore: qualityEvaluation.qualityScore,
        qualityMeta: {
          ...scoring.qualityMeta,
          qualityMetrics: qualityEvaluation.metrics,
        },
        canPublish: qa.ok,
        publishValidation: qa,
      })
    }

    if (action === 'validate_publish') {
      const lessonId = String(payload.lessonId || '').trim()
      if (!lessonId) return NextResponse.json({ error: 'Thiếu lessonId.' }, { status: 400 })

      const { data: lesson, error: lessonError } = await adminSupabase
        .from('language_coach_live_lessons')
        .select('id, source_user_id, quality_score, turns_count, status')
        .eq('id', lessonId)
        .limit(1)
        .maybeSingle()
      if (lessonError) return NextResponse.json({ error: lessonError.message }, { status: 500 })
      if (!lesson) return NextResponse.json({ error: 'Không tìm thấy bài Live.' }, { status: 404 })
      if (lesson.source_user_id !== user.id) return NextResponse.json({ error: 'Bạn không có quyền kiểm tra bài này.' }, { status: 403 })

      const { data: turns, error: turnsError } = await adminSupabase
        .from('language_coach_live_lesson_turns')
        .select('turn_index, source_student_text, source_student_audio_url, standardized_student_text, teacher_reply_text, teacher_audio_url, teacher_main_sentence, teacher_correction_note, teacher_intent_answer, replay_payload_json')
        .eq('lesson_id', lesson.id)
        .order('turn_index', { ascending: true })
      if (turnsError) return NextResponse.json({ error: turnsError.message }, { status: 500 })

      const qa = validateLessonForPublish(lesson, (turns || []) as PersistedLessonTurn[])
      return NextResponse.json({
        lessonId: lesson.id,
        ok: qa.ok,
        issues: qa.issues,
        stats: qa.stats,
        status: lesson.status,
      })
    }

    if (action === 'pick_random') {
      const targetLanguage = String(payload.targetLanguage || '').trim()
      const nativeLanguage = String(payload.nativeLanguage || '').trim()
      const topicId = String(payload.topicId || '').trim()
      const goalType = String(payload.goalType || '').trim()
      const learnerLevel = normalizeLearnerLevel(payload.learnerLevel)
      const durationBucket =
        payload.durationBucket === 'short' || payload.durationBucket === 'medium' || payload.durationBucket === 'long'
          ? payload.durationBucket
          : null
      if (!targetLanguage || !nativeLanguage || !topicId || learnerLevel == null) {
        return NextResponse.json(
          { error: 'Thiếu tiêu chí chọn bài mẫu (targetLanguage, nativeLanguage, topicId, learnerLevel).' },
          { status: 400 }
        )
      }

      let query = adminSupabase
        .from('language_coach_live_lessons')
        .select(
          'id, title, topic_id, topic_label, target_language, native_language, learner_level, goal_type, estimated_minutes, duration_bucket, catalog_key, quality_score, price_credits, turns_count, sales_count'
        )
        .eq('status', 'published')
        .eq('target_language', targetLanguage)
        .eq('native_language', nativeLanguage)
        .eq('topic_id', topicId)
        .eq('learner_level', learnerLevel)
        .gte('quality_score', MIN_QUALITY_SCORE_TO_PUBLISH)
        .order('quality_score', { ascending: false })
        .order('sales_count', { ascending: false })
        .limit(60)

      if (goalType) query = query.eq('goal_type', goalType)
      if (durationBucket) query = query.eq('duration_bucket', durationBucket)

      const { data: candidates, error: candidatesError } = await query
      if (candidatesError) return NextResponse.json({ error: candidatesError.message }, { status: 500 })
      if (!Array.isArray(candidates) || candidates.length === 0) {
        return NextResponse.json({
          found: false,
          fallback: 'ai_live',
          message: 'Không có bài mẫu phù hợp. Gợi ý chuyển sang học với AI live.',
        })
      }

      const candidateIds = candidates.map((c) => String(c.id))
      const { data: recentStarts } = await adminSupabase
        .from('language_coach_live_lesson_starts')
        .select('lesson_id')
        .eq('user_id', user.id)
        .in('lesson_id', candidateIds)
        .order('started_at', { ascending: false })
        .limit(8)
      const recentlyStartedSet = new Set((recentStarts || []).map((x) => String(x.lesson_id || '')))

      let pool = candidates.filter((c) => !recentlyStartedSet.has(String(c.id)))
      if (pool.length === 0) pool = candidates
      const topPool = pool.slice(0, Math.min(30, pool.length))
      const selected = topPool[Math.floor(Math.random() * topPool.length)]

      await adminSupabase.from('language_coach_live_lesson_starts').insert({
        lesson_id: selected.id,
        user_id: user.id,
      })

      return NextResponse.json({
        found: true,
        lesson: {
          id: selected.id,
          title: selected.title,
          topicId: selected.topic_id,
          topicLabel: selected.topic_label,
          targetLanguage: selected.target_language,
          nativeLanguage: selected.native_language,
          learnerLevel: selected.learner_level,
          goalType: selected.goal_type,
          estimatedMinutes: selected.estimated_minutes,
          durationBucket: selected.duration_bucket,
          catalogKey: selected.catalog_key,
          qualityScore: selected.quality_score,
          priceCredits: Number(selected.price_credits || 0),
          turnsCount: selected.turns_count,
          salesCount: selected.sales_count,
        },
        poolSize: topPool.length,
      })
    }

    if (action === 'publish') {
      const lessonId = String(payload.lessonId || '').trim()
      if (!lessonId) return NextResponse.json({ error: 'Thiếu lessonId.' }, { status: 400 })

      const { data: lesson, error: lessonError } = await adminSupabase
        .from('language_coach_live_lessons')
        .select('id, source_user_id, quality_score, turns_count, status')
        .eq('id', lessonId)
        .limit(1)
        .maybeSingle()
      if (lessonError) return NextResponse.json({ error: lessonError.message }, { status: 500 })
      if (!lesson) return NextResponse.json({ error: 'Không tìm thấy bài Live.' }, { status: 404 })
      if (lesson.source_user_id !== user.id) return NextResponse.json({ error: 'Bạn không có quyền duyệt bài này.' }, { status: 403 })
      const { data: turns, error: turnsError } = await adminSupabase
        .from('language_coach_live_lesson_turns')
        .select('turn_index, source_student_text, source_student_audio_url, standardized_student_text, teacher_reply_text, teacher_audio_url, teacher_main_sentence, teacher_correction_note, teacher_intent_answer, replay_payload_json')
        .eq('lesson_id', lesson.id)
        .order('turn_index', { ascending: true })
      if (turnsError) return NextResponse.json({ error: turnsError.message }, { status: 500 })

      const qa = validateLessonForPublish(lesson, (turns || []) as PersistedLessonTurn[])
      if (!qa.ok) {
        return NextResponse.json(
          {
            error: 'Bài Live chưa đạt điều kiện publish.',
            issues: qa.issues,
            stats: qa.stats,
          },
          { status: 400 }
        )
      }

      const nowIso = new Date().toISOString()
      const { error: publishError } = await adminSupabase
        .from('language_coach_live_lessons')
        .update({
          status: 'published',
          approved: true,
          published_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', lesson.id)
      if (publishError) return NextResponse.json({ error: publishError.message }, { status: 500 })

      return NextResponse.json({ ok: true, lessonId: lesson.id, status: 'published' })
    }

    if (action === 'purchase') {
      const lessonId = String(payload.lessonId || '').trim()
      if (!lessonId) return NextResponse.json({ error: 'Thiếu lessonId.' }, { status: 400 })

      const { data: lesson, error: lessonError } = await adminSupabase
        .from('language_coach_live_lessons')
        .select('id, source_user_id, title, price_credits, status, sales_count')
        .eq('id', lessonId)
        .eq('status', 'published')
        .limit(1)
        .maybeSingle()
      if (lessonError) return NextResponse.json({ error: lessonError.message }, { status: 500 })
      if (!lesson) return NextResponse.json({ error: 'Bài Live chưa được mở bán.' }, { status: 404 })

      const isOwner = lesson.source_user_id === user.id
      if (isOwner) return NextResponse.json({ ok: true, purchased: true, ownerAccess: true })

      const { data: existing } = await adminSupabase
        .from('language_coach_live_lesson_purchases')
        .select('id')
        .eq('lesson_id', lesson.id)
        .eq('user_id', user.id)
        .limit(1)
      if (Array.isArray(existing) && existing.length > 0) {
        return NextResponse.json({ ok: true, purchased: true, alreadyOwned: true })
      }

      const priceCredits = Math.max(0, Number(lesson.price_credits || 0))
      if (priceCredits > 0) {
        const { data: creditData, error: creditError } = await adminSupabase
          .from('credits')
          .select('balance')
          .eq('user_id', user.id)
          .single()
        if (creditError || !creditData) return NextResponse.json({ error: 'Không đọc được số dư credits.' }, { status: 500 })
        if (Number(creditData.balance) < priceCredits) {
          return NextResponse.json(
            {
              error: `Không đủ credits. Cần ${priceCredits}, hiện có ${Number(creditData.balance).toFixed(1)}.`,
            },
            { status: 400 }
          )
        }
        const newBalance = Math.round((Number(creditData.balance) - priceCredits) * 10) / 10
        const { error: updateCreditError } = await adminSupabase.from('credits').update({ balance: newBalance }).eq('user_id', user.id)
        if (updateCreditError) return NextResponse.json({ error: 'Trừ credits thất bại.' }, { status: 500 })
      }

      const { error: purchaseError } = await adminSupabase.from('language_coach_live_lesson_purchases').insert({
        lesson_id: lesson.id,
        user_id: user.id,
        paid_credits: priceCredits,
      })
      if (purchaseError) return NextResponse.json({ error: purchaseError.message }, { status: 500 })

      const nowIso = new Date().toISOString()
      await adminSupabase
        .from('language_coach_live_lessons')
        .update({
          sales_count: Number(lesson.sales_count || 0) + 1,
          last_sold_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', lesson.id)

      return NextResponse.json({ ok: true, purchased: true, lessonId: lesson.id, paidCredits: priceCredits })
    }

    if (action === 'match_turn') {
      const lessonId = String(payload.lessonId || '').trim()
      const answerText = String(payload.answerText || '').trim()
      const turnIndex = Number(payload.turnIndex)
      if (!lessonId || !answerText || !Number.isInteger(turnIndex) || turnIndex < 0) {
        return NextResponse.json({ error: 'Thiếu dữ liệu so khớp lượt học.' }, { status: 400 })
      }
      const selectedTargetLanguage = String(payload.targetLanguage || '').trim()
      const selectedNativeLanguage = String(payload.nativeLanguage || '').trim()
      const selectedTopicId = String(payload.topicId || '').trim()
      const selectedTeacherGender = normalizeGender(payload.teacherGender)
      const selectedTeacherVoice = String(payload.teacherVoice || '').trim()
      if (!selectedTargetLanguage || !selectedNativeLanguage || !selectedTopicId || (!selectedTeacherVoice && selectedTeacherGender === 'unknown')) {
        return NextResponse.json(
          {
            error: 'Thiếu metadata bắt buộc để quyết định replay (target_language, native_language, topic_id, teacher gender/voice).',
          },
          { status: 400 }
        )
      }

      const { data: lesson, error: lessonError } = await adminSupabase
        .from('language_coach_live_lessons')
        .select('id, source_user_id, topic_id, target_language, native_language, teacher_gender, teacher_label, teacher_locale, price_credits, turns_count, status, turn_ids')
        .eq('id', lessonId)
        .limit(1)
        .maybeSingle()
      if (lessonError) return NextResponse.json({ error: lessonError.message }, { status: 500 })
      if (!lesson || String(lesson.status) !== 'published') return NextResponse.json({ error: 'Bài Live chưa sẵn sàng.' }, { status: 404 })

      const isOwner = lesson.source_user_id === user.id
      const isPaid = Number(lesson.price_credits || 0) > 0
      let purchased = false
      if (!isOwner && isPaid) {
        const { data: owned } = await adminSupabase
          .from('language_coach_live_lesson_purchases')
          .select('id')
          .eq('lesson_id', lesson.id)
          .eq('user_id', user.id)
          .limit(1)
        purchased = Array.isArray(owned) && owned.length > 0
      }
      if (!isOwner && isPaid && !purchased) {
        return NextResponse.json({ error: 'Bạn cần mua bài Live trước khi học.' }, { status: 403 })
      }

      const metaChecks = {
        targetLanguageMatch: normalizeLookup(selectedTargetLanguage) === normalizeLookup(String(lesson.target_language || '')),
        nativeLanguageMatch: normalizeLookup(selectedNativeLanguage) === normalizeLookup(String(lesson.native_language || '')),
        topicMatch: normalizeLookup(selectedTopicId) === normalizeLookup(String(lesson.topic_id || '')),
        teacherGenderMatch:
          selectedTeacherGender !== 'unknown'
            ? selectedTeacherGender === normalizeGender(lesson.teacher_gender)
            : false,
        teacherVoiceMatch: selectedTeacherVoice
          ? [
              normalizeLookup(selectedTeacherVoice),
              normalizeLookup(String(lesson.teacher_label || '')),
              normalizeLookup(String(lesson.teacher_locale || '')),
            ].filter(Boolean).length > 0 &&
            (normalizeLookup(selectedTeacherVoice) === normalizeLookup(String(lesson.teacher_label || '')) ||
              normalizeLookup(selectedTeacherVoice) === normalizeLookup(String(lesson.teacher_locale || '')))
          : false,
      }
      const teacherMatch = metaChecks.teacherGenderMatch || metaChecks.teacherVoiceMatch
      if (!metaChecks.targetLanguageMatch || !metaChecks.nativeLanguageMatch || !metaChecks.topicMatch || !teacherMatch) {
        return NextResponse.json({
          lessonId: lesson.id,
          turnIndex,
          matched: false,
          useAiDirect: true,
          reason: 'metadata_mismatch',
          metaChecks: {
            ...metaChecks,
            teacherMatch,
          },
        })
      }

      const matchTurnIds = Array.isArray((lesson as { turn_ids?: string[] }).turn_ids)
        ? ((lesson as { turn_ids?: string[] }).turn_ids || []).filter((id): id is string => typeof id === 'string')
        : []
      const turnId = matchTurnIds.length > turnIndex ? matchTurnIds[turnIndex] : null

      let turn: {
        turn_index?: number
        source_student_text?: string
        standardized_student_text?: string
        standardized_student_norm?: string
        teacher_reply_text?: string
        teacher_audio_url?: string
        teacher_translation?: string
        teacher_tokens_json?: string
        teacher_writing_task_json?: string
        teacher_main_sentence?: string
        teacher_correction_note?: string
        teacher_intent_answer?: string
        replay_payload_json?: string
      } | null = null

      if (turnId) {
        const { data: t, error: turnErr } = await adminSupabase
          .from('language_coach_live_lesson_turns')
          .select(
            'turn_index, source_student_text, standardized_student_text, standardized_student_norm, teacher_reply_text, teacher_audio_url, teacher_translation, teacher_tokens_json, teacher_writing_task_json, teacher_main_sentence, teacher_correction_note, teacher_intent_answer, replay_payload_json'
          )
          .eq('id', turnId)
          .limit(1)
          .maybeSingle()
        if (!turnErr) turn = t
      }
      if (!turn) {
        const { data: t, error: turnErr } = await adminSupabase
          .from('language_coach_live_lesson_turns')
          .select(
            'turn_index, source_student_text, standardized_student_text, standardized_student_norm, teacher_reply_text, teacher_audio_url, teacher_translation, teacher_tokens_json, teacher_writing_task_json, teacher_main_sentence, teacher_correction_note, teacher_intent_answer, replay_payload_json'
          )
          .eq('lesson_id', lesson.id)
          .eq('turn_index', turnIndex)
          .limit(1)
          .maybeSingle()
        if (turnErr) return NextResponse.json({ error: turnErr.message }, { status: 500 })
        turn = t
      }
      if (!turn) return NextResponse.json({ error: 'Không tìm thấy lượt học.' }, { status: 404 })

      const normalizedAnswer = normalizeText(answerText)
      const normalizedExpected = String(turn.standardized_student_norm || '').trim()
      const strictMatch = normalizedAnswer === normalizedExpected
      const similarity = softSimilarity(answerText, String(turn.standardized_student_text || ''))
      const matched = strictMatch || similarity >= 0.95

      if (!matched) {
        return NextResponse.json({
          lessonId: lesson.id,
          turnIndex,
          matched: false,
          strictMatch,
          similarity: Number(similarity.toFixed(3)),
          threshold: 0.95,
          useAiDirect: true,
          reason: 'similarity_below_threshold',
        })
      }

      return NextResponse.json({
        lessonId: lesson.id,
        turnIndex,
        matched,
        strictMatch,
        similarity: Number(similarity.toFixed(3)),
        expectedStudentText: turn.standardized_student_text,
        sourceStudentText: turn.source_student_text,
        teacherReplyText: matched ? turn.teacher_reply_text : null,
        teacherAudioUrl: matched ? turn.teacher_audio_url : null,
        teacherTranslation: matched ? turn.teacher_translation : null,
        teacherTokensJson: matched ? turn.teacher_tokens_json : null,
        teacherWritingTaskJson: matched ? turn.teacher_writing_task_json : null,
        teacherMainSentence: matched ? turn.teacher_main_sentence : null,
        teacherCorrectionNote: matched ? turn.teacher_correction_note : null,
        teacherIntentAnswer: matched ? turn.teacher_intent_answer : null,
        replayPayload: matched ? JSON.parse(String(turn.replay_payload_json || '{}')) : null,
        nextTurnIndex: matched ? Math.min(turnIndex + 1, Math.max(0, Number(lesson.turns_count || 1) - 1)) : turnIndex,
        isLastTurn: turnIndex >= Math.max(0, Number(lesson.turns_count || 1) - 1),
        useAiDirect: false,
      })
    }

    if (action === 'assist_word') {
      const lessonId = String(payload.lessonId || '').trim()
      const word = String(payload.word || '').trim()
      const contextSentence = String(payload.contextSentence || '').trim()
      if (!lessonId || !word) {
        return NextResponse.json({ error: 'Thiếu lessonId hoặc word.' }, { status: 400 })
      }

      const { data: lesson, error: lessonError } = await adminSupabase
        .from('language_coach_live_lessons')
        .select('id, source_user_id, target_language, native_language, price_credits, status')
        .eq('id', lessonId)
        .limit(1)
        .maybeSingle()
      if (lessonError) return NextResponse.json({ error: lessonError.message }, { status: 500 })
      if (!lesson || String(lesson.status) !== 'published') {
        return NextResponse.json({ error: 'Bài Live chưa sẵn sàng để tra từ.' }, { status: 404 })
      }

      const isOwner = lesson.source_user_id === user.id
      const isPaid = Number(lesson.price_credits || 0) > 0
      let purchased = false
      if (!isOwner && isPaid) {
        const { data: owned } = await adminSupabase
          .from('language_coach_live_lesson_purchases')
          .select('id')
          .eq('lesson_id', lesson.id)
          .eq('user_id', user.id)
          .limit(1)
        purchased = Array.isArray(owned) && owned.length > 0
      }
      if (!isOwner && isPaid && !purchased) {
        return NextResponse.json({ error: 'Bạn cần mua bài Live trước khi dùng trợ lý từ mới.' }, { status: 403 })
      }

      const normalizedWord = normalizeLookup(word)
      const targetLanguage = String(lesson.target_language || '').trim() || 'English'
      const nativeLanguage = String(lesson.native_language || '').trim() || 'Vietnamese'
      const normalizedTarget = normalizeLookup(targetLanguage)

      const { data: dailyRows } = await adminSupabase
        .from('language_coach_daily_words')
        .select(
          'word, meaning, pronunciation, example_target, example_native, meaning_items_json, example_items_json, usage_level, importance_score, is_context_sensitive, target_language'
        )
        .eq('user_id', user.id)
        .eq('word', word)
        .eq('target_language', targetLanguage)
        .order('updated_at', { ascending: false })
        .limit(1)

      const daily = Array.isArray(dailyRows) && dailyRows.length > 0 ? dailyRows[0] : null
      if (daily && String(daily.meaning || '').trim()) {
        return NextResponse.json({
          source: 'daily_words',
          word: daily.word,
          meaning: daily.meaning,
          pronunciation: daily.pronunciation || '',
          exampleTarget: daily.example_target || '',
          exampleNative: daily.example_native || '',
          meaningItems: (() => {
            try {
              const parsed = JSON.parse(String(daily.meaning_items_json || '[]'))
              return Array.isArray(parsed) ? parsed : []
            } catch {
              return []
            }
          })(),
          exampleItems: (() => {
            try {
              const parsed = JSON.parse(String(daily.example_items_json || '[]'))
              return Array.isArray(parsed) ? parsed : []
            } catch {
              return []
            }
          })(),
          usageLevel: daily.usage_level || 'medium',
          importanceScore: Number(daily.importance_score || 50),
          contextSensitive: Boolean(daily.is_context_sensitive),
        })
      }

      const { data: vocabRows } = await adminSupabase
        .from('language_coach_vocab_cache')
        .select(
          'word, meaning, pronunciation, example_target, example_native, meaning_items_json, example_items_json, usage_level, importance_score, is_context_sensitive'
        )
        .eq('normalized_word', normalizedWord)
        .eq('normalized_target_language', normalizedTarget)
        .limit(1)
      const vocab = Array.isArray(vocabRows) && vocabRows.length > 0 ? vocabRows[0] : null
      if (vocab && String(vocab.meaning || '').trim()) {
        return NextResponse.json({
          source: 'vocab_cache',
          word: vocab.word || word,
          meaning: vocab.meaning,
          pronunciation: vocab.pronunciation || '',
          exampleTarget: vocab.example_target || '',
          exampleNative: vocab.example_native || '',
          meaningItems: (() => {
            try {
              const parsed = JSON.parse(String(vocab.meaning_items_json || '[]'))
              return Array.isArray(parsed) ? parsed : []
            } catch {
              return []
            }
          })(),
          exampleItems: (() => {
            try {
              const parsed = JSON.parse(String(vocab.example_items_json || '[]'))
              return Array.isArray(parsed) ? parsed : []
            } catch {
              return []
            }
          })(),
          usageLevel: vocab.usage_level || 'medium',
          importanceScore: Number(vocab.importance_score || 50),
          contextSensitive: Boolean(vocab.is_context_sensitive),
        })
      }

      const baseUrl = getInternalBaseUrl()
      const aiRes = await fetch(`${baseUrl}/api/english-coach/word`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word,
          contextSentence,
          targetLanguage,
          nativeLanguage,
        }),
      })
      const aiData = (await aiRes.json().catch(() => ({}))) as Record<string, unknown> & { error?: string }
      if (!aiRes.ok) {
        return NextResponse.json({ error: aiData.error || 'Không tra được từ bằng AI.' }, { status: aiRes.status || 500 })
      }

      const lessonSessionId = lesson.id
      const turnIdx =
        payload.turnIndex !== undefined && Number.isInteger(payload.turnIndex) && payload.turnIndex >= 0
          ? payload.turnIndex
          : -1
      await adminSupabase.from('language_coach_daily_words').upsert(
        {
          user_id: user.id,
          session_id: lessonSessionId,
          learned_date: new Date().toISOString().slice(0, 10),
          word: String(aiData.word || word).slice(0, 120),
          target_language: targetLanguage,
          native_language: nativeLanguage,
          meaning: String(aiData.meaning || '').trim() || null,
          pronunciation: String(aiData.pronunciation || '').trim() || null,
          example_target: String(aiData.exampleTarget || '').trim() || null,
          example_native: String(aiData.exampleNative || '').trim() || null,
          meaning_items_json: Array.isArray(aiData.meaningItems) ? JSON.stringify(aiData.meaningItems) : null,
          example_items_json: Array.isArray(aiData.exampleItems) ? JSON.stringify(aiData.exampleItems) : null,
          usage_level: String(aiData.usageLevel || 'medium'),
          importance_score: Number(aiData.importanceScore || 50),
          is_context_sensitive: Boolean(aiData.contextSensitive),
          turn_index: turnIdx,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,session_id,word,target_language,turn_index' }
      )

      return NextResponse.json({
        ...aiData,
        source: 'ai_fallback',
      })
    }

    return NextResponse.json({ error: 'Action không hợp lệ.' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
