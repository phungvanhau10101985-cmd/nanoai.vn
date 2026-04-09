import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchVocabCacheRowByWordTargetPg } from '@/lib/db/language-coach-vocab-cache-pg'
import {
  bumpLiveLessonSalesPg,
  deleteLiveLessonTurnsByLessonIdPg,
  fetchDailyWordForAssistPg,
  fetchLessonForAssistWordPg,
  fetchLessonForMatchTurnPg,
  fetchLessonForPublishValidatePg,
  fetchLessonForPurchasePg,
  fetchLiveLessonByIdPg,
  fetchLiveLessonPickRandomCandidatesPg,
  fetchLiveLessonTurnsByIdsPg,
  fetchLiveLessonTurnsByLessonIdOrderedPg,
  fetchMatchTurnByIdPg,
  fetchMatchTurnByLessonIndexPg,
  fetchMessagesForLiveLessonCreatePg,
  fetchPurchasedLessonIdsForUserPg,
  fetchRecentLessonStartsPg,
  fetchTurnDiagnosticsForSessionPg,
  hasLiveLessonPurchasePg,
  insertLiveLessonPurchasePg,
  insertLiveLessonStartPg,
  insertLiveLessonTurnsBatchPg,
  listLiveLessonsPg,
  type LiveLessonDetailRowPg,
  type LiveLessonTurnInsertPg,
  type LiveLessonTurnRowPg,
  updateLiveLessonPublishedPg,
  updateLiveLessonTurnIdsPg,
  upsertDailyWordFromLiveAssistPg,
  upsertLiveLessonDraftPg,
} from '@/lib/db/language-coach-live-lesson-pg'
import { getInternalBaseUrl } from '@/lib/internal-url'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import { deductUserCredits } from '@/lib/music/deduct-user-credits'

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

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function liveLessonRowToPublishMeta(lesson: LiveLessonDetailRowPg): {
  quality_score: number | null
  turns_count: number | null
} {
  return {
    quality_score: numOrNull(lesson.quality_score),
    turns_count: numOrNull(lesson.turns_count),
  }
}

function mapPgTurnRowsToPersisted(turns: LiveLessonTurnRowPg[]): PersistedLessonTurn[] {
  return turns.map((t, idx) => ({
    turn_index: Number.isFinite(Number(t.turn_index)) ? Number(t.turn_index) : idx,
    source_student_text: t.source_student_text != null ? String(t.source_student_text) : null,
    source_student_audio_url: t.source_student_audio_url != null ? String(t.source_student_audio_url) : null,
    standardized_student_text: t.standardized_student_text != null ? String(t.standardized_student_text) : null,
    teacher_reply_text: t.teacher_reply_text != null ? String(t.teacher_reply_text) : null,
    teacher_audio_url: t.teacher_audio_url != null ? String(t.teacher_audio_url) : null,
    teacher_main_sentence: t.teacher_main_sentence != null ? String(t.teacher_main_sentence) : null,
    teacher_correction_note: t.teacher_correction_note != null ? String(t.teacher_correction_note) : null,
    teacher_intent_answer: t.teacher_intent_answer != null ? String(t.teacher_intent_answer) : null,
    replay_payload_json: t.replay_payload_json != null ? String(t.replay_payload_json) : null,
  }))
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
  return getUserForAction()
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthedUser()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
    }

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
      const lessonFetch = await fetchLiveLessonByIdPg(lessonId)
      if (!lessonFetch.ok) return NextResponse.json({ error: lessonFetch.message }, { status: 500 })
      const lesson = lessonFetch.row
      if (!lesson) return NextResponse.json({ error: 'Không tìm thấy bài Live.' }, { status: 404 })

      const isOwner = String(lesson.source_user_id) === user.id
      const isPublished = String(lesson.status || '') === 'published'
      const isPaid = Number(lesson.price_credits || 0) > 0
      let purchased = false

      if (!isOwner && isPaid) {
        purchased = await hasLiveLessonPurchasePg(user.id, String(lesson.id))
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

      const turnIdsRaw = lesson.turn_ids as string[] | null | undefined
      const turnIds = Array.isArray(turnIdsRaw) ? turnIdsRaw.map((id) => String(id)).filter(Boolean) : []
      let turns: Array<{
        id?: string
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
        const turnRes = await fetchLiveLessonTurnsByIdsPg(turnIds)
        if (!turnRes.ok) return NextResponse.json({ error: turnRes.message }, { status: 500 })
        turns = turnRes.rows.sort((a, b) => turnIds.indexOf(String(a.id)) - turnIds.indexOf(String(b.id))) as typeof turns
      } else {
        const turnRes = await fetchLiveLessonTurnsByLessonIdOrderedPg(String(lesson.id))
        if (!turnRes.ok) return NextResponse.json({ error: turnRes.message }, { status: 500 })
        turns = turnRes.rows as typeof turns
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

    const listRes = await listLiveLessonsPg({
      limit,
      userId: user.id,
      mine,
      topicId: topicId || undefined,
      targetLanguage: targetLanguage || undefined,
      nativeLanguage: nativeLanguage || undefined,
      goalType: goalType || undefined,
      durationBucket:
        durationBucket === 'short' || durationBucket === 'medium' || durationBucket === 'long'
          ? durationBucket
          : undefined,
      learnerLevel,
    })
    if (!listRes.ok) return NextResponse.json({ error: listRes.message }, { status: 500 })
    const lessons = listRes.rows

    const lessonIds = (lessons || []).map((x) => String(x.id || '')).filter(Boolean)
    let purchasedSet = new Set<string>()
    if (lessonIds.length > 0) {
      const pur = await fetchPurchasedLessonIdsForUserPg(user.id, lessonIds)
      if (!pur.ok) return NextResponse.json({ error: pur.message }, { status: 500 })
      purchasedSet = pur.ids
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
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
    }
    const payload = (await request.json()) as ActionPayload
    const action = payload.action

    if (action === 'create_from_session') {
      const sessionId = String(payload.sessionId || '').trim()
      if (!sessionId) return NextResponse.json({ error: 'Thiếu sessionId.' }, { status: 400 })

      const [rowsResult, diagnosticsResult] = await Promise.all([
        fetchMessagesForLiveLessonCreatePg(user.id, sessionId),
        fetchTurnDiagnosticsForSessionPg(user.id, sessionId),
      ])

      if (!rowsResult.ok) return NextResponse.json({ error: rowsResult.message }, { status: 500 })
      if (!diagnosticsResult.ok) return NextResponse.json({ error: diagnosticsResult.message }, { status: 500 })

      const rows = rowsResult.rows
      const studentDiagnosticsByMessageId = mapDiagnosticsToStudentMessages(
        rows as Array<{ id: string; role: string; text: string | null }>,
        diagnosticsResult.rows as RawTurnDiagnosticsRow[]
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
          sourceStudentAudioUrl: t.sourceStudentAudioUrl,
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

      const nowUpsert = new Date().toISOString()
      const lessonUpsert = await upsertLiveLessonDraftPg({
        sourceUserId: user.id,
        sourceSessionId: sessionId,
        title,
        topicId,
        topicLabel,
        targetLanguage,
        nativeLanguage,
        learnerLevel,
        goalType,
        estimatedMinutes,
        durationBucket,
        catalogKey,
        teacherGender,
        teacherLabel,
        teacherLocale,
        languagePairKey,
        qualityScore: qualityEvaluation.qualityScore,
        qualityMetaJson: JSON.stringify({
          ...scoring.qualityMeta,
          qualityMetrics: qualityEvaluation.metrics,
          hardRejectReasons: qualityEvaluation.hardRejectReasons,
          publishIssues: qualityEvaluation.publishIssues,
        }),
        priceCredits,
        turnsCount: turns.length,
        updatedAtIso: nowUpsert,
      })

      if (!lessonUpsert.ok) {
        return NextResponse.json({ error: 'Không lưu được bài Live.' }, { status: 500 })
      }
      const lesson = { id: lessonUpsert.id, status: lessonUpsert.status, approved: lessonUpsert.approved }

      const delTurns = await deleteLiveLessonTurnsByLessonIdPg(lesson.id)
      if (!delTurns.ok) return NextResponse.json({ error: delTurns.message }, { status: 500 })

      const turnPayload: LiveLessonTurnInsertPg[] = turns.map((t, index) => ({
        turnIndex: index,
        sourceStudentDbMessageId: t.sourceStudentDbMessageId,
        sourceStudentClientMessageId: t.sourceStudentClientMessageId,
        sourceStudentText: t.sourceStudentText,
        sourceStudentNorm: t.sourceStudentNorm,
        sourceStudentAudioUrl: t.sourceStudentAudioUrl,
        standardizedStudentText: t.standardizedStudentText,
        standardizedStudentNorm: t.standardizedStudentNorm,
        teacherDbMessageId: t.teacherDbMessageId,
        teacherReplyText: t.teacherReplyText,
        teacherAudioUrl: t.teacherAudioUrl,
        teacherTranslation: t.teacherTranslation,
        teacherTokensJson: t.teacherTokensJson,
        teacherWritingTaskJson: t.teacherWritingTaskJson,
        teacherMainSentence: t.teacherMainSentence,
        teacherCorrectionNote: t.teacherCorrectionNote,
        teacherIntentAnswer: t.teacherIntentAnswer,
        replayPayloadJson: t.replayPayloadJson,
      }))

      const insertedBatch = await insertLiveLessonTurnsBatchPg(lesson.id, turnPayload)
      if (!insertedBatch.ok) return NextResponse.json({ error: insertedBatch.message }, { status: 500 })

      const turnIds = insertedBatch.ids
      if (turnIds.length > 0) {
        const updIds = await updateLiveLessonTurnIdsPg(lesson.id, turnIds, new Date().toISOString())
        if (!updIds.ok) return NextResponse.json({ error: updIds.message }, { status: 500 })
      }

      const qa = validateLessonForPublish(
        { quality_score: qualityEvaluation.qualityScore, turns_count: turns.length },
        turns.map((t, idx) => ({
          turn_index: idx,
          source_student_text: t.sourceStudentText,
          source_student_audio_url: t.sourceStudentAudioUrl,
          standardized_student_text: t.standardizedStudentText,
          teacher_reply_text: t.teacherReplyText,
          teacher_audio_url: t.teacherAudioUrl,
          teacher_main_sentence: t.teacherMainSentence,
          teacher_correction_note: t.teacherCorrectionNote,
          teacher_intent_answer: t.teacherIntentAnswer,
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

      const lessonFetch = await fetchLessonForPublishValidatePg(lessonId)
      if (!lessonFetch.ok) return NextResponse.json({ error: lessonFetch.message }, { status: 500 })
      const lesson = lessonFetch.row
      if (!lesson) return NextResponse.json({ error: 'Không tìm thấy bài Live.' }, { status: 404 })
      if (String(lesson.source_user_id) !== user.id) return NextResponse.json({ error: 'Bạn không có quyền kiểm tra bài này.' }, { status: 403 })

      const turnsFetch = await fetchLiveLessonTurnsByLessonIdOrderedPg(String(lesson.id))
      if (!turnsFetch.ok) return NextResponse.json({ error: turnsFetch.message }, { status: 500 })
      const turns = turnsFetch.rows

      const qa = validateLessonForPublish(liveLessonRowToPublishMeta(lesson), mapPgTurnRowsToPersisted(turns || []))
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

      const candRes = await fetchLiveLessonPickRandomCandidatesPg({
        targetLanguage,
        nativeLanguage,
        topicId,
        learnerLevel,
        goalType: goalType || undefined,
        durationBucket: durationBucket || undefined,
      })
      if (!candRes.ok) return NextResponse.json({ error: candRes.message }, { status: 500 })
      const candidates = candRes.rows
      if (!Array.isArray(candidates) || candidates.length === 0) {
        return NextResponse.json({
          found: false,
          fallback: 'ai_live',
          message: 'Không có bài mẫu phù hợp. Gợi ý chuyển sang học với AI live.',
        })
      }

      const candidateIds = candidates.map((c) => String(c.id))
      const recentRes = await fetchRecentLessonStartsPg(user.id, candidateIds)
      if (!recentRes.ok) return NextResponse.json({ error: recentRes.message }, { status: 500 })
      const recentlyStartedSet = new Set(recentRes.lessonIds)

      let pool = candidates.filter((c) => !recentlyStartedSet.has(String(c.id)))
      if (pool.length === 0) pool = candidates
      const topPool = pool.slice(0, Math.min(30, pool.length))
      const selected = topPool[Math.floor(Math.random() * topPool.length)]

      const startIns = await insertLiveLessonStartPg(String(selected.id), user.id)
      if (!startIns.ok) return NextResponse.json({ error: startIns.message }, { status: 500 })

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

      const lessonFetch = await fetchLessonForPublishValidatePg(lessonId)
      if (!lessonFetch.ok) return NextResponse.json({ error: lessonFetch.message }, { status: 500 })
      const lesson = lessonFetch.row
      if (!lesson) return NextResponse.json({ error: 'Không tìm thấy bài Live.' }, { status: 404 })
      if (String(lesson.source_user_id) !== user.id) return NextResponse.json({ error: 'Bạn không có quyền duyệt bài này.' }, { status: 403 })
      const turnsFetch = await fetchLiveLessonTurnsByLessonIdOrderedPg(String(lesson.id))
      if (!turnsFetch.ok) return NextResponse.json({ error: turnsFetch.message }, { status: 500 })
      const turns = turnsFetch.rows

      const qa = validateLessonForPublish(liveLessonRowToPublishMeta(lesson), mapPgTurnRowsToPersisted(turns || []))
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
      const pub = await updateLiveLessonPublishedPg(String(lesson.id), nowIso)
      if (!pub.ok) return NextResponse.json({ error: pub.message }, { status: 500 })

      return NextResponse.json({ ok: true, lessonId: lesson.id, status: 'published' })
    }

    if (action === 'purchase') {
      const lessonId = String(payload.lessonId || '').trim()
      if (!lessonId) return NextResponse.json({ error: 'Thiếu lessonId.' }, { status: 400 })

      const lessonFetch = await fetchLessonForPurchasePg(lessonId)
      if (!lessonFetch.ok) return NextResponse.json({ error: lessonFetch.message }, { status: 500 })
      const lesson = lessonFetch.row
      if (!lesson) return NextResponse.json({ error: 'Bài Live chưa được mở bán.' }, { status: 404 })

      const isOwner = String(lesson.source_user_id) === user.id
      if (isOwner) return NextResponse.json({ ok: true, purchased: true, ownerAccess: true })

      const already = await hasLiveLessonPurchasePg(user.id, String(lesson.id))
      if (already) {
        return NextResponse.json({ ok: true, purchased: true, alreadyOwned: true })
      }

      const priceCredits = Math.max(0, Number(lesson.price_credits || 0))
      if (priceCredits > 0) {
        const d = await deductUserCredits(user.id, priceCredits)
        if (!d.ok) {
          if (d.code === 'INSUFFICIENT_CREDITS') {
            let bal = 0
            try {
              bal = await getCreditBalanceByUserId(user.id)
            } catch {
              /* ignore */
            }
            return NextResponse.json(
              {
                error: `Không đủ credits. Cần ${priceCredits}, hiện có ${bal.toFixed(1)}.`,
              },
              { status: 400 }
            )
          }
          return NextResponse.json({ error: d.error || 'Trừ credits thất bại.' }, { status: 500 })
        }
      }

      const purchaseIns = await insertLiveLessonPurchasePg(String(lesson.id), user.id, priceCredits)
      if (!purchaseIns.ok) return NextResponse.json({ error: purchaseIns.message }, { status: 500 })

      const nowIso = new Date().toISOString()
      const bump = await bumpLiveLessonSalesPg(String(lesson.id), Number(lesson.sales_count || 0) + 1, nowIso)
      if (!bump.ok) return NextResponse.json({ error: bump.message }, { status: 500 })

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

      const lessonFetch = await fetchLessonForMatchTurnPg(lessonId)
      if (!lessonFetch.ok) return NextResponse.json({ error: lessonFetch.message }, { status: 500 })
      const lesson = lessonFetch.row
      if (!lesson || String(lesson.status) !== 'published') return NextResponse.json({ error: 'Bài Live chưa sẵn sàng.' }, { status: 404 })

      const isOwner = String(lesson.source_user_id) === user.id
      const isPaid = Number(lesson.price_credits || 0) > 0
      let purchased = false
      if (!isOwner && isPaid) {
        purchased = await hasLiveLessonPurchasePg(user.id, String(lesson.id))
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

      type MatchTurnRow = {
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
      }

      let turn: MatchTurnRow | null = null

      if (turnId) {
        const tRes = await fetchMatchTurnByIdPg(turnId)
        if (tRes.ok && tRes.row) turn = tRes.row as MatchTurnRow
      }
      if (!turn) {
        const tRes = await fetchMatchTurnByLessonIndexPg(String(lesson.id), turnIndex)
        if (!tRes.ok) return NextResponse.json({ error: tRes.message }, { status: 500 })
        turn = tRes.row ? (tRes.row as MatchTurnRow) : null
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

      const assistLesson = await fetchLessonForAssistWordPg(lessonId)
      if (!assistLesson.ok) return NextResponse.json({ error: assistLesson.message }, { status: 500 })
      const lesson = assistLesson.row
      if (!lesson || String(lesson.status) !== 'published') {
        return NextResponse.json({ error: 'Bài Live chưa sẵn sàng để tra từ.' }, { status: 404 })
      }

      const isOwner = String(lesson.source_user_id) === user.id
      const isPaid = Number(lesson.price_credits || 0) > 0
      let purchased = false
      if (!isOwner && isPaid) {
        purchased = await hasLiveLessonPurchasePg(user.id, String(lesson.id))
      }
      if (!isOwner && isPaid && !purchased) {
        return NextResponse.json({ error: 'Bạn cần mua bài Live trước khi dùng trợ lý từ mới.' }, { status: 403 })
      }

      const normalizedWord = normalizeLookup(word)
      const targetLanguage = String(lesson.target_language || '').trim() || 'English'
      const nativeLanguage = String(lesson.native_language || '').trim() || 'Vietnamese'
      const normalizedTarget = normalizeLookup(targetLanguage)

      const dailyFetch = await fetchDailyWordForAssistPg(user.id, word, targetLanguage)
      if (!dailyFetch.ok) return NextResponse.json({ error: dailyFetch.message }, { status: 500 })
      const daily = dailyFetch.row
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

      const vocab = await fetchVocabCacheRowByWordTargetPg(normalizedWord, normalizedTarget)
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

      const lessonSessionId = String(lesson.id)
      const turnIdx =
        payload.turnIndex !== undefined && Number.isInteger(payload.turnIndex) && payload.turnIndex >= 0
          ? payload.turnIndex
          : -1
      const dailyUpsert = await upsertDailyWordFromLiveAssistPg({
        userId: user.id,
        sessionId: lessonSessionId,
        learnedDate: new Date().toISOString().slice(0, 10),
        word: String(aiData.word || word).slice(0, 120),
        targetLanguage,
        nativeLanguage,
        meaning: String(aiData.meaning || '').trim() || null,
        pronunciation: String(aiData.pronunciation || '').trim() || null,
        exampleTarget: String(aiData.exampleTarget || '').trim() || null,
        exampleNative: String(aiData.exampleNative || '').trim() || null,
        meaningItemsJson: Array.isArray(aiData.meaningItems) ? JSON.stringify(aiData.meaningItems) : null,
        exampleItemsJson: Array.isArray(aiData.exampleItems) ? JSON.stringify(aiData.exampleItems) : null,
        usageLevel: String(aiData.usageLevel || 'medium'),
        importanceScore: Number(aiData.importanceScore || 50),
        isContextSensitive: Boolean(aiData.contextSensitive),
        turnIndex: turnIdx,
        updatedAtIso: new Date().toISOString(),
      })
      if (!dailyUpsert.ok) return NextResponse.json({ error: dailyUpsert.message }, { status: 500 })

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
