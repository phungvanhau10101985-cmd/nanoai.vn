import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchTransliterationCacheByKeysPg } from '@/lib/db/language-coach-transliteration-tokenize-pg'
import {
  fetchEndedSessionIdsForUserPg,
  fetchHiddenSessionIdsForUserPg,
  fetchMessagesForHistoryListPg,
  fetchMessagesForHistorySessionPg,
  fetchSessionMemoriesForHistoryListPg,
  fetchSessionMemoryBriefForHistoryPg,
  insertHistoryMessagePg,
  insertSessionMemoryMetadataPg,
  updateSessionMemoryMetadataPg,
  upsertHiddenSessionPg,
  type HistoryListMessagePg,
  type HistorySessionMessagePg,
} from '@/lib/db/language-coach-history-pg'
function toTransliterationCacheKey(text: string, languageCode: string): string {
  const normalized = String(text || '').trim()
  const hash = createHash('sha256').update(normalized).digest('hex')
  return `${languageCode}:${hash}`
}

const TRANSLITERATION_LANGS = ['zh', 'ja', 'ko', 'th', 'hi'] as const
function needsTransliteration(lang: string): lang is (typeof TRANSLITERATION_LANGS)[number] {
  return TRANSLITERATION_LANGS.includes(lang as (typeof TRANSLITERATION_LANGS)[number])
}

type MessageRole = 'teacher' | 'student'
type LearnMode = 'chat' | 'story'
type LanguageCode = 'en' | 'zh' | 'hi' | 'th' | 'ja' | 'ko' | 'vi'

type HistoryPayload = {
  sessionId?: string
  clientMessageId?: string
  role?: MessageRole
  text?: string
  audioUrl?: string
  languageCode?: LanguageCode
  targetLanguage?: string
  teacherLabel?: string
  teacherLocale?: string
  mode?: LearnMode
  mainSentence?: string
  correctionNote?: string
  intentAnswer?: string
  tokensJson?: string
  aiPayloadJson?: string
  nativeLanguage?: string
  learningMode?: 'review' | 'reflex'
  topicId?: string
  topicLabel?: string
}

type ReviewDrillStats = {
  speakingPass: number
  speakingFail: number
  listeningPass: number
  listeningFail: number
  hintServed: number
  updatedAt?: string
}

type ActiveReviewDrill = {
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

type MiniStageSnapshot = {
  stage: 'idle' | 'writing' | 'speaking' | 'listening' | 'done'
  updatedAt?: string
}

type PresetReplayPreview = {
  active: boolean
  sourceLessonId?: string
  nextTurnIndex: number
  totalTurns: number
  expectedStudentText?: string
}

function sanitizePresetSentence(text: string): string {
  return String(text || '')
    .replace(/^\[[^\]]+\]\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isUnsafePresetSentence(text: string): boolean {
  const s = sanitizePresetSentence(text)
  if (!s) return true
  const patterns: RegExp[] = [
    /\bmy\s+name\b/i,
    /\btên\s+(?:tôi|em|mình|anh|chị)\s+là\b/iu,
    /\bhttps?:\/\//i,
    /\bwww\./i,
    /\b[a-z0-9-]+\s*(?:\.|\s+dot\s+|\s+chấm\s+)\s*(?:com|vn|net|org|io)\b/i,
    /\b\d{2,}\s*com\s*vn\b/i,
  ]
  if (patterns.some((re) => re.test(s))) return true
  const noisyTokenCount = (s.match(/\d+/g) || []).length + (s.match(/[./\\|_@#]/g) || []).length
  return noisyTokenCount >= 3
}

function parseReviewDrillStatsFromPinnedFacts(raw: string): ReviewDrillStats | null {
  try {
    const root = JSON.parse(String(raw || '{}')) as Record<string, unknown>
    const src = root?.review_drill_stats
    if (!src || typeof src !== 'object') return null
    const row = src as Record<string, unknown>
    return {
      speakingPass: Math.max(0, Math.floor(Number(row.speakingPass || 0) || 0)),
      speakingFail: Math.max(0, Math.floor(Number(row.speakingFail || 0) || 0)),
      listeningPass: Math.max(0, Math.floor(Number(row.listeningPass || 0) || 0)),
      listeningFail: Math.max(0, Math.floor(Number(row.listeningFail || 0) || 0)),
      hintServed: Math.max(0, Math.floor(Number(row.hintServed || 0) || 0)),
      updatedAt: String(row.updatedAt || '').trim() || undefined,
    }
  } catch {
    return null
  }
}

function parseActiveReviewDrillFromPinnedFacts(raw: string): ActiveReviewDrill | null {
  try {
    const root = JSON.parse(String(raw || '{}')) as Record<string, unknown>
    const src = root?.review_drill
    if (!src || typeof src !== 'object') return null
    const row = src as Record<string, unknown>
    const speakingRaw = row.speaking
    const listeningRaw = row.listening
    const speaking = speakingRaw && typeof speakingRaw === 'object'
      ? {
          targetSentence: String((speakingRaw as { targetSentence?: unknown }).targetSentence || '').trim(),
          minSimilarity: Number.isFinite(Number((speakingRaw as { minSimilarity?: unknown }).minSimilarity))
            ? Number((speakingRaw as { minSimilarity?: unknown }).minSimilarity)
            : 0.82,
          minPronunciationScore: Number.isFinite(Number((speakingRaw as { minPronunciationScore?: unknown }).minPronunciationScore))
            ? Number((speakingRaw as { minPronunciationScore?: unknown }).minPronunciationScore)
            : 65,
          attempt: Math.max(0, Math.floor(Number((speakingRaw as { attempt?: unknown }).attempt || 0) || 0)),
        }
      : undefined
    const listening = listeningRaw && typeof listeningRaw === 'object'
      ? {
          prompt: String((listeningRaw as { prompt?: unknown }).prompt || '').trim(),
          expectedKeywords: Array.isArray((listeningRaw as { expectedKeywords?: unknown }).expectedKeywords)
            ? (listeningRaw as { expectedKeywords: unknown[] }).expectedKeywords.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 12)
            : [],
          options: Array.isArray((listeningRaw as { options?: unknown }).options)
            ? (listeningRaw as { options: unknown[] }).options.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 24)
            : [],
          minMatchedKeywords: Math.max(1, Math.min(3, Math.floor(Number((listeningRaw as { minMatchedKeywords?: unknown }).minMatchedKeywords || 1) || 1))),
          attempt: Math.max(0, Math.floor(Number((listeningRaw as { attempt?: unknown }).attempt || 0) || 0)),
        }
      : undefined
    if (!speaking && !listening) return null
    return { ...(speaking ? { speaking } : {}), ...(listening ? { listening } : {}) }
  } catch {
    return null
  }
}

function parseMiniStageSnapshotFromPinnedFacts(raw: string): MiniStageSnapshot | null {
  try {
    const root = JSON.parse(String(raw || '{}')) as Record<string, unknown>
    const src = root?.mini_stage_snapshot
    if (!src || typeof src !== 'object') return null
    const row = src as Record<string, unknown>
    const stageRaw = String(row.stage || '').trim().toLowerCase()
    const stage =
      stageRaw === 'writing' || stageRaw === 'speaking' || stageRaw === 'listening' || stageRaw === 'done'
        ? stageRaw
        : 'idle'
    return {
      stage,
      updatedAt: String(row.updatedAt || row.updated_at || '').trim() || undefined,
    }
  } catch {
    return null
  }
}

function parsePresetReplayPreviewFromPinnedFacts(raw: string): PresetReplayPreview | null {
  try {
    const root = JSON.parse(String(raw || '{}')) as Record<string, unknown>
    const preset = root?.preset_replay
    if (!preset || typeof preset !== 'object') return null
    const row = preset as Record<string, unknown>
    const turns = Array.isArray(row.turns) ? row.turns : []
    const totalTurns = turns.length
    if (totalTurns <= 0) return null
    const nextTurnIndexRaw = Number(row.next_turn_index ?? row.nextTurnIndex ?? 0)
    const nextTurnIndex = Number.isFinite(nextTurnIndexRaw)
      ? Math.max(0, Math.min(totalTurns - 1, Math.floor(nextTurnIndexRaw)))
      : 0
    let expectedStudentText: string | undefined
    for (let i = nextTurnIndex; i < turns.length; i += 1) {
      const turn = turns[i]
      if (!turn || typeof turn !== 'object') continue
      const candidate = sanitizePresetSentence(
        String(
          (turn as { expectedStudent?: unknown; expected_student?: unknown }).expectedStudent
          ?? (turn as { expected_student?: unknown }).expected_student
          ?? ''
        ).trim()
      )
      if (!candidate || isUnsafePresetSentence(candidate)) continue
      expectedStudentText = candidate
      break
    }
    return {
      active: Boolean(row.active),
      sourceLessonId: String(row.source_lesson_id ?? row.sourceLessonId ?? '').trim() || undefined,
      nextTurnIndex,
      totalTurns,
      expectedStudentText,
    }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
    }

    const sessionId = String(request.nextUrl.searchParams.get('sessionId') || '').trim()
    const scope = String(request.nextUrl.searchParams.get('scope') || 'active').trim().toLowerCase()
    const limitRaw = Number(request.nextUrl.searchParams.get('limit') || 20)
    const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.floor(limitRaw))) : 20
    if (sessionId) {
      const [messagesResult, memoryResult] = await Promise.all([
        fetchMessagesForHistorySessionPg(user.id, sessionId),
        fetchSessionMemoryBriefForHistoryPg(user.id, sessionId),
      ])

      if (!messagesResult.ok) {
        return NextResponse.json({ error: messagesResult.message || 'Không tải được buổi học.' }, { status: 500 })
      }
      if (!memoryResult.ok) {
        return NextResponse.json({ error: memoryResult.message || 'Không tải được memory buổi học.' }, { status: 500 })
      }

      const data = messagesResult.rows
      const memory = memoryResult.row as {
        learning_mode?: string | null
        topic_id?: string | null
        topic_label?: string | null
        pinned_facts_json?: string | null
      } | null
      const learningMode = memory?.learning_mode
      const safeLearningMode = learningMode === 'reflex' ? 'reflex' : 'review'
      const sessionTopicId = String(memory?.topic_id || '').trim()
      const sessionTopicLabel = String(memory?.topic_label || '').trim()
      const presetReplaySourceLessonId = (() => {
        try {
          const parsed = JSON.parse(String(memory?.pinned_facts_json || '{}')) as Record<string, unknown>
          const preset = parsed?.preset_replay
          if (!preset || typeof preset !== 'object') return ''
          return String((preset as { source_lesson_id?: unknown; sourceLessonId?: unknown }).source_lesson_id
            ?? (preset as { sourceLessonId?: unknown }).sourceLessonId
            ?? '').trim()
        } catch {
          return ''
        }
      })()
      const reviewDrillStats = parseReviewDrillStatsFromPinnedFacts(String(memory?.pinned_facts_json || '{}'))
      const reviewDrill = parseActiveReviewDrillFromPinnedFacts(String(memory?.pinned_facts_json || '{}'))
      const miniStageSnapshot = parseMiniStageSnapshotFromPinnedFacts(String(memory?.pinned_facts_json || '{}'))
      const presetReplayPreview = parsePresetReplayPreviewFromPinnedFacts(String(memory?.pinned_facts_json || '{}'))

      const rows: HistorySessionMessagePg[] = data ?? []
      const cacheKeysToFetch: string[] = []
      for (const row of rows) {
        if (row.role !== 'teacher') continue
        const lang = String(row.language_code || '').trim().toLowerCase()
        if (!needsTransliteration(lang)) continue
        for (const field of ['main_sentence', 'correction_note', 'intent_answer'] as const) {
          const text = String(row[field] || '').trim()
          if (!text) continue
          cacheKeysToFetch.push(toTransliterationCacheKey(text, lang))
        }
        const wtj = String(row.writing_task_json || '').trim()
        if (wtj) {
          try {
            const parsed = JSON.parse(wtj) as { requiredSentences?: string[] }
            for (const s of parsed.requiredSentences ?? []) {
              const t = String(s || '').trim()
              if (t) cacheKeysToFetch.push(toTransliterationCacheKey(t, lang))
            }
          } catch {
            /* ignore */
          }
        }
      }
      const transliterationByKey = new Map<string, string>()
      if (cacheKeysToFetch.length > 0) {
        const uniqueKeys = [...new Set(cacheKeysToFetch)]
        const cacheRows = await fetchTransliterationCacheByKeysPg(uniqueKeys)
        for (const r of cacheRows) {
          const ck = String(r.cache_key || '')
          const t = String(r.transliteration || '').trim()
          if (ck && t) transliterationByKey.set(ck, t)
        }
      }

      const lastTeacher = [...rows].reverse().find((r) => r.role === 'teacher')
      const writingTaskTransliterations: Record<string, string> = {}
      if (lastTeacher) {
        const wtj = String(lastTeacher.writing_task_json || '').trim()
        if (wtj) {
          try {
            const parsed = JSON.parse(wtj) as { requiredSentences?: string[] }
            const lang = String(lastTeacher.language_code || '').trim().toLowerCase()
            if (needsTransliteration(lang)) {
              for (const s of parsed.requiredSentences ?? []) {
                const t = String(s || '').trim()
                if (t) {
                  const tr = transliterationByKey.get(toTransliterationCacheKey(t, lang))
                  if (tr) writingTaskTransliterations[t] = tr
                }
              }
            }
          } catch {
            /* ignore */
          }
        }
      }

      return NextResponse.json({
        learningMode: safeLearningMode,
        topicId: sessionTopicId || undefined,
        topicLabel: sessionTopicLabel || undefined,
        presetReplaySession: Boolean(presetReplaySourceLessonId),
        presetReplaySourceLessonId: presetReplaySourceLessonId || undefined,
        reviewDrillStats: reviewDrillStats || undefined,
        reviewDrill: reviewDrill || undefined,
        miniStageSnapshot: miniStageSnapshot || undefined,
        presetReplay: presetReplayPreview || undefined,
        writingTaskTransliterations,
        items: rows.map((row: HistorySessionMessagePg) => {
          const lang = String(row.language_code || '').trim().toLowerCase()
          const mainSentence = row.main_sentence ?? null
          const correctionNote = row.correction_note ?? null
          const intentAnswer = row.intent_answer ?? null
          const ms = String(mainSentence || '').trim()
          const cn = String(correctionNote || '').trim()
          const ia = String(intentAnswer || '').trim()
          const mainSentenceTransliteration =
            ms && needsTransliteration(lang) ? transliterationByKey.get(toTransliterationCacheKey(ms, lang)) ?? null : null
          const correctionNoteTransliteration =
            cn && needsTransliteration(lang) ? transliterationByKey.get(toTransliterationCacheKey(cn, lang)) ?? null : null
          const intentAnswerTransliteration =
            ia && needsTransliteration(lang) ? transliterationByKey.get(toTransliterationCacheKey(ia, lang)) ?? null : null
          return {
            id: row.id,
            sessionId: row.session_id,
            role: row.role,
            text: row.text,
            audioUrl: row.audio_url,
            translation: row.translation ?? null,
            languageCode: row.language_code,
            targetLanguage: row.target_language,
            teacherLabel: row.teacher_label,
            teacherLocale: row.teacher_locale,
            mode: row.mode,
            mainSentence,
            correctionNote,
            intentAnswer,
            mainSentenceTransliteration,
            correctionNoteTransliteration,
            intentAnswerTransliteration,
            tokensJson: row.tokens_json ?? null,
            writingTaskJson: row.writing_task_json ?? null,
            aiPayloadJson: row.ai_payload_json ?? null,
            createdAt: row.created_at,
          }
        }),
      })
    }

    const [messagesResult, memoriesResult, hiddenResult, endedResult] = await Promise.all([
      fetchMessagesForHistoryListPg(user.id),
      fetchSessionMemoriesForHistoryListPg(user.id),
      fetchHiddenSessionIdsForUserPg(user.id),
      fetchEndedSessionIdsForUserPg(user.id),
    ])

    if (!messagesResult.ok) {
      return NextResponse.json({ error: messagesResult.message || 'Không tải được danh sách buổi học.' }, { status: 500 })
    }
    if (!memoriesResult.ok) {
      return NextResponse.json({ error: memoriesResult.message || 'Không tải được danh sách buổi học.' }, { status: 500 })
    }
    if (!hiddenResult.ok) {
      return NextResponse.json({ error: hiddenResult.message || 'Không tải được danh sách buổi học.' }, { status: 500 })
    }
    if (!endedResult.ok) {
      return NextResponse.json({ error: endedResult.message || 'Không tải được danh sách buổi học.' }, { status: 500 })
    }

    const data = messagesResult.rows

    const learningModeBySession = new Map<string, string>()
    const topicIdBySession = new Map<string, string>()
    const topicLabelBySession = new Map<string, string>()
    const targetLanguageBySession = new Map<string, string>()
    const nativeLanguageBySession = new Map<string, string>()
    const reviewDrillStatsBySession = new Map<string, ReviewDrillStats>()
    const presetReplayBySession = new Map<string, boolean>()
    for (const row of memoriesResult.rows) {
      const sid = String(row.session_id || '')
      if (sid) {
        if (row.learning_mode) learningModeBySession.set(sid, row.learning_mode)
        if (row.topic_id) topicIdBySession.set(sid, String(row.topic_id).trim())
        if (row.topic_label) topicLabelBySession.set(sid, String(row.topic_label).trim())
        if (row.target_language) targetLanguageBySession.set(sid, String(row.target_language).trim())
        if (row.native_language) nativeLanguageBySession.set(sid, String(row.native_language).trim())
        const pinnedFactsRaw = String(row.pinned_facts_json || '{}')
        const stats = parseReviewDrillStatsFromPinnedFacts(pinnedFactsRaw)
        if (stats) reviewDrillStatsBySession.set(sid, stats)
        const presetReplay = parsePresetReplayPreviewFromPinnedFacts(pinnedFactsRaw)
        presetReplayBySession.set(sid, Boolean(presetReplay))
      }
    }

    const hiddenSessionIds = new Set(hiddenResult.sessionIds)
    const endedSessionIds = new Set(endedResult.sessionIds)

    const bySession = new Map<
      string,
      {
        sessionId: string
        languageCode: string
        targetLanguage: string
        nativeLanguage: string
        teacherLabel: string
        teacherLocale: string
        mode: string
        lastMessageAt: string
        lastTeacherText: string
        messageCount: number
        learningMode: 'review' | 'reflex'
        topicId: string
        topicLabel: string
        reviewDrillStats?: ReviewDrillStats
        isPresetReplaySession: boolean
      }
    >()

    for (const row of data as HistoryListMessagePg[]) {
      const sid = String(row.session_id || '')
      if (!sid) continue
      const isLearnedSession = hiddenSessionIds.has(sid) || endedSessionIds.has(sid)
      if (scope === 'learned') {
        if (!isLearnedSession) continue
      } else {
        if (isLearnedSession) continue
      }
      const existing = bySession.get(sid)
      const lm = learningModeBySession.get(sid)
      const safeLm = lm === 'reflex' ? 'reflex' : 'review'
      const topicId = topicIdBySession.get(sid) || ''
      const topicLabel = topicLabelBySession.get(sid) || ''
      const targetLanguageFromMemory = targetLanguageBySession.get(sid) || ''
      const nativeLanguage = nativeLanguageBySession.get(sid) || ''
      if (!existing) {
        bySession.set(sid, {
          sessionId: sid,
          languageCode: String(row.language_code || ''),
          targetLanguage: targetLanguageFromMemory || String(row.target_language || ''),
          nativeLanguage,
          teacherLabel: String(row.teacher_label || ''),
          teacherLocale: String(row.teacher_locale || ''),
          mode: String(row.mode || ''),
          lastMessageAt: String(row.created_at || ''),
          lastTeacherText: row.role === 'teacher' ? String(row.text || '') : '',
          messageCount: 1,
          learningMode: safeLm,
          topicId,
          topicLabel,
          reviewDrillStats: reviewDrillStatsBySession.get(sid),
          isPresetReplaySession: Boolean(presetReplayBySession.get(sid)),
        })
        continue
      }
      existing.messageCount += 1
      if (!existing.lastTeacherText && row.role === 'teacher') {
        existing.lastTeacherText = String(row.text || '')
      }
    }

    const sessions = Array.from(bySession.values())
      .sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1))
      .slice(0, limit)

    return NextResponse.json({ sessions })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sessionId = String(request.nextUrl.searchParams.get('sessionId') || '').trim()
    if (!sessionId) {
      return NextResponse.json({ error: 'Thiếu sessionId.' }, { status: 400 })
    }
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
    }

    const hidden = await upsertHiddenSessionPg(user.id, sessionId)
    if (!hidden.ok) {
      return NextResponse.json({ error: hidden.message || 'Không ẩn được buổi học.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as HistoryPayload
    const sessionId = String(payload.sessionId || '').trim()
    const clientMessageId = String(payload.clientMessageId || '').trim()
    const role: MessageRole = payload.role === 'teacher' ? 'teacher' : 'student'
    const text = String(payload.text || '').trim()
    const audioUrl = String(payload.audioUrl || '').trim()
    const languageCode = String(payload.languageCode || '').trim()
    const targetLanguage = String(payload.targetLanguage || '').trim()
    const nativeLanguage = String(payload.nativeLanguage || '').trim()
    const teacherLabel = String(payload.teacherLabel || '').trim()
    const teacherLocale = String(payload.teacherLocale || '').trim()
    const mode: LearnMode = payload.mode === 'story' ? 'story' : 'chat'
    const mainSentence = String(payload.mainSentence || '').trim().slice(0, 2000) || null
    const correctionNote = String(payload.correctionNote || '').trim().slice(0, 2000) || null
    const intentAnswer = String(payload.intentAnswer || '').trim().slice(0, 2000) || null
    const tokensJson = String(payload.tokensJson || '').trim().slice(0, 4000) || null
    const aiPayloadJson = String(payload.aiPayloadJson || '').trim().slice(0, 32000) || null
    const learningMode: 'review' | 'reflex' = payload.learningMode === 'reflex' ? 'reflex' : 'review'
    const topicId = String(payload.topicId || '').trim() || null
    const topicLabel = String(payload.topicLabel || '').trim() || null

    if (!sessionId || !text) {
      return NextResponse.json({ error: 'Thiếu dữ liệu lưu lịch sử.' }, { status: 400 })
    }

    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
    }

    const inserted = await insertHistoryMessagePg({
      userId: user.id,
      sessionId,
      clientMessageId: clientMessageId || null,
      role,
      text: text.slice(0, 4000),
      audioUrl: audioUrl || null,
      languageCode: languageCode || null,
      targetLanguage: targetLanguage || null,
      teacherLabel: teacherLabel || null,
      teacherLocale: teacherLocale || null,
      mode,
      mainSentence,
      correctionNote,
      intentAnswer,
      tokensJson,
      aiPayloadJson,
    })

    if (!inserted.ok) {
      return NextResponse.json({ error: inserted.message || 'Không lưu được lịch sử học.' }, { status: 500 })
    }

    if (targetLanguage && nativeLanguage) {
      const nowIso = new Date().toISOString()
      const memUp = await updateSessionMemoryMetadataPg({
        userId: user.id,
        sessionId,
        targetLanguage,
        nativeLanguage,
        topicId,
        topicLabel,
        learningMode,
        updatedAtIso: nowIso,
      })
      if (!memUp.ok) {
        return NextResponse.json({ error: memUp.message || 'Không cập nhật được metadata buổi học.' }, { status: 500 })
      }

      if (!memUp.updated) {
        const memIn = await insertSessionMemoryMetadataPg({
          userId: user.id,
          sessionId,
          targetLanguage,
          nativeLanguage,
          topicId,
          topicLabel,
          learningMode,
        })
        if (!memIn.ok) {
          return NextResponse.json({ error: memIn.message || 'Không tạo được metadata buổi học.' }, { status: 500 })
        }
      }
    }

    return NextResponse.json({ id: inserted.id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

