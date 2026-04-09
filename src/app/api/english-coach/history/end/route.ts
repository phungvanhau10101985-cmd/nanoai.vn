import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import {
  deleteCompletedLessonPg,
  deletePresetTurnsForSessionPg,
  fetchMessagesForSessionEndPg,
  fetchSessionMemoryForEndPg,
  insertPresetTurnPg,
  upsertCompletedLessonFromEndPg,
  upsertEndedSessionPg,
  type CoachMessageEndRow,
} from '@/lib/db/language-coach-history-end-pg'

function isPresetCopiedSession(pinnedFactsRaw: string): boolean {
  try {
    const parsed = JSON.parse(String(pinnedFactsRaw || '{}')) as Record<string, unknown>
    const preset = parsed?.preset_replay
    if (!preset || typeof preset !== 'object') return false
    const sourceLessonId = String((preset as { source_lesson_id?: unknown; sourceLessonId?: unknown }).source_lesson_id
      ?? (preset as { sourceLessonId?: unknown }).sourceLessonId
      ?? '').trim()
    return Boolean(sourceLessonId)
  } catch {
    return false
  }
}

function parseReviewDrillStatsFromPinnedFacts(raw: string): {
  speakingPass: number
  speakingFail: number
  listeningPass: number
  listeningFail: number
  hintServed: number
} | null {
  try {
    const parsed = JSON.parse(String(raw || '{}')) as Record<string, unknown>
    const stats = parsed?.review_drill_stats
    if (!stats || typeof stats !== 'object') return null
    const row = stats as Record<string, unknown>
    return {
      speakingPass: Math.max(0, Math.floor(Number(row.speakingPass || 0) || 0)),
      speakingFail: Math.max(0, Math.floor(Number(row.speakingFail || 0) || 0)),
      listeningPass: Math.max(0, Math.floor(Number(row.listeningPass || 0) || 0)),
      listeningFail: Math.max(0, Math.floor(Number(row.listeningFail || 0) || 0)),
      hintServed: Math.max(0, Math.floor(Number(row.hintServed || 0) || 0)),
    }
  } catch {
    return null
  }
}

const MIN_STUDENT_MESSAGES_FOR_COMPLETED_SAVE = 10
const MIN_TOTAL_MESSAGES_FOR_COMPLETED_SAVE = 11

function isTimelineCompletedReason(reason: string): boolean {
  const r = String(reason || '').trim().toLowerCase()
  return r === 'timeline_completed' || r === 'timeline_completed_auto'
}

function hasPersonalizationSignals(text: string): boolean {
  const s = String(text || '').trim()
  if (!s) return false
  const patterns: RegExp[] = [
    /\bmy\s+name\b/i,
    /\bmy\s+name(?:\s+is|\s*'s)?\s+[A-ZÀ-Ỹ][\wÀ-ỹ'.-]{1,}(?:\s+[A-ZÀ-Ỹ][\wÀ-ỹ'.-]{1,}){0,3}\b/u,
    /\bmy\s+name\s+[A-ZÀ-Ỹ][\wÀ-ỹ'.-]{1,}(?:\s+[A-ZÀ-Ỹ][\wÀ-ỹ'.-]{1,}){0,3}\b/u,
    /(?:tên\s+(?:tôi|em|mình|anh|chị)\s+là)\s+[^\n,.!?;:]{1,80}/iu,
    /我叫[^\n。！？!?，,]{1,40}/u,
    /(?:私の名前は|僕の名前は|俺の名前は)[^\n。！？!?，,]{1,40}(?:です|だ)?/u,
    /(?:제\s*이름은|내\s*이름은)\s*[^\n.!?]{1,40}/u,
    /मेरा\s+नाम\s+[^\n।.!?]{1,40}/u,
    /\bhttps?:\/\//i,
    /\bwww\./i,
    /\b[a-z0-9-]+\s*(?:\.|\s+dot\s+|\s+chấm\s+)\s*(?:com|vn|net|org|io)\b/i,
    /\b\d{2,}\s*com\s*vn\b/i,
  ]
  return patterns.some((re) => re.test(s))
}

function transcriptHasPersonalizationSignals(rows: Array<{
  text?: string | null
  main_sentence?: string | null
  correction_note?: string | null
  intent_answer?: string | null
}>): boolean {
  return rows.some((row) => {
    const fields = [
      String(row.text || '').trim(),
      String(row.main_sentence || '').trim(),
      String(row.correction_note || '').trim(),
      String(row.intent_answer || '').trim(),
    ]
    return fields.some((field) => hasPersonalizationSignals(field))
  })
}

function rowHasPersonalizationSignals(row: {
  text?: string | null
  main_sentence?: string | null
  correction_note?: string | null
  intent_answer?: string | null
}): boolean {
  return transcriptHasPersonalizationSignals([row])
}

function rowFromCoachMessage(r: CoachMessageEndRow) {
  return {
    text: String(r.text || ''),
    main_sentence: String(r.main_sentence || ''),
    correction_note: String(r.correction_note || ''),
    intent_answer: String(r.intent_answer || ''),
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as {
      sessionId?: string
      markEnded?: boolean
      completionReason?: string
      qualityPassed?: boolean
    }
    const sessionId = String(payload.sessionId || '').trim()
    const markEnded = payload.markEnded !== false
    const qualityPassed = payload.qualityPassed === true
    const completionReasonRaw = String(payload.completionReason || '').trim()
    const completionReason = completionReasonRaw || (markEnded ? 'user_ended' : 'timeline_completed_auto')
    if (!sessionId) {
      return NextResponse.json({ error: 'Thiếu sessionId.' }, { status: 400 })
    }
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
    }

    const [messagesResult, memoryResult] = await Promise.all([
      fetchMessagesForSessionEndPg(user.id, sessionId),
      fetchSessionMemoryForEndPg(user.id, sessionId),
    ])

    if (!messagesResult.ok) {
      return NextResponse.json(
        { error: messagesResult.message || 'Không tải được dữ liệu buổi học để kết thúc.' },
        { status: 500 }
      )
    }
    if (!memoryResult.ok) {
      return NextResponse.json(
        { error: memoryResult.message || 'Không tải được memory buổi học để kết thúc.' },
        { status: 500 }
      )
    }

    const rows = messagesResult.rows
    const first = rows[0]
    const last = rows.length > 0 ? rows[rows.length - 1] : null
    const studentMessages = rows.filter((r) => r.role === 'student').length
    const startedAt = String(first?.created_at || '').trim() || null
    const endedAt = String(last?.created_at || '').trim() || new Date().toISOString()
    const durationSeconds =
      startedAt && endedAt
        ? Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000))
        : 0
    const memory = memoryResult.row
    const isPresetSession = isPresetCopiedSession(String(memory?.pinned_facts_json || '{}'))
    const reviewDrillStats = parseReviewDrillStatsFromPinnedFacts(String(memory?.pinned_facts_json || '{}'))
    const rowsWithoutPersonalization = rows.filter((r) => !rowHasPersonalizationSignals(rowFromCoachMessage(r)))
    const replayRows = rowsWithoutPersonalization
    const summary = {
      runningSummary: String(memory?.running_summary || '').trim(),
      pinnedFactsJson: String(memory?.pinned_facts_json || '{}').trim(),
      reviewDrillStats: reviewDrillStats || undefined,
      latestStudentText: String([...replayRows].reverse().find((r) => r.role === 'student')?.text || '').trim(),
      latestTeacherText: String([...replayRows].reverse().find((r) => r.role === 'teacher')?.text || '').trim(),
    }
    const transcript = replayRows.map((r) => ({
      id: r.id,
      role: r.role,
      text: r.text,
      audioUrl: r.audio_url,
      translation: r.translation || null,
      languageCode: r.language_code,
      targetLanguage: r.target_language,
      teacherLabel: r.teacher_label,
      teacherLocale: r.teacher_locale,
      mode: r.mode,
      mainSentence: r.main_sentence || null,
      correctionNote: r.correction_note || null,
      intentAnswer: r.intent_answer || null,
      tokensJson: r.tokens_json || null,
      writingTaskJson: r.writing_task_json || null,
      aiPayloadJson: r.ai_payload_json || null,
      createdAt: r.created_at,
    }))

    const meetsDepthGate =
      studentMessages >= MIN_STUDENT_MESSAGES_FOR_COMPLETED_SAVE
      && rows.length >= MIN_TOTAL_MESSAGES_FOR_COMPLETED_SAVE
    const timelineCompleted = isTimelineCompletedReason(completionReason)
    const allowCompletedSave =
      qualityPassed && timelineCompleted && meetsDepthGate && !isPresetSession && transcript.length > 0

    if (allowCompletedSave) {
      const delTurns = await deletePresetTurnsForSessionPg(user.id, sessionId)
      if (!delTurns.ok) {
        return NextResponse.json({ error: delTurns.message || 'Không xóa được preset turns cũ.' }, { status: 500 })
      }

      const turnIds: string[] = []
      let turnIndex = 0
      let seenFirstTeacher = false
      for (const r of replayRows) {
        if (r.role !== 'teacher') continue
        const reply = String(r.text || '').trim().slice(0, 4000)
        if (!reply) continue
        if (!seenFirstTeacher) {
          seenFirstTeacher = true
          continue
        }
        const mainSentence = String(r.main_sentence || '').trim()
        const intentAnswer = String(r.intent_answer || '').trim()
        const expectedStudent = mainSentence || intentAnswer || ''
        const inserted = await insertPresetTurnPg({
          turnIndex,
          sourceUserId: user.id,
          sourceSessionId: sessionId,
          reply,
          expectedStudentText: expectedStudent || null,
          mainSentence: mainSentence || null,
          correctionNote: String(r.correction_note || '').trim() || null,
          intentAnswer: intentAnswer || null,
          mustKnowText: (mainSentence || intentAnswer || reply).trim() || null,
          teacherLabel: String(r.teacher_label || '').trim() || null,
          teacherLocale: String(r.teacher_locale || '').trim() || null,
          languageCode: String(r.language_code || '').trim() || null,
          targetLanguage: String(r.target_language || '').trim() || null,
          tokensJson: String(r.tokens_json || '').trim() || null,
          writingTaskJson: String(r.writing_task_json || '').trim() || null,
        })
        if (!inserted.ok) {
          return NextResponse.json(
            { error: inserted.message || 'Không lưu được preset turn.' },
            { status: 500 }
          )
        }
        turnIds.push(inserted.id)
        turnIndex += 1
      }

      const completedUpsert = await upsertCompletedLessonFromEndPg({
        userId: user.id,
        sessionId,
        targetLanguage: String(memory?.target_language || first?.target_language || '').trim() || null,
        nativeLanguage: String(memory?.native_language || '').trim() || null,
        learnerLevel: Number.isFinite(Number(memory?.learner_level))
          ? Math.max(0, Math.round(Number(memory?.learner_level)))
          : 0,
        languageCode: String(first?.language_code || '').trim() || null,
        mode: String(first?.mode || '').trim() || null,
        learningMode: String(memory?.learning_mode || 'review').trim() || 'review',
        topicId: String(memory?.topic_id || '').trim() || null,
        topicLabel: String(memory?.topic_label || '').trim() || null,
        teacherLabel: String(first?.teacher_label || '').trim() || null,
        teacherLocale: String(first?.teacher_locale || '').trim() || null,
        totalMessages: replayRows.length,
        studentMessages: replayRows.filter((r) => r.role === 'student').length,
        teacherMessages: replayRows.filter((r) => r.role === 'teacher').length,
        startedAt,
        endedAt,
        durationSeconds,
        completionReason,
        summaryJson: JSON.stringify(summary),
        transcriptJson: JSON.stringify(transcript),
        turnIds: turnIds.length > 0 ? turnIds : null,
        updatedAtIso: new Date().toISOString(),
      })
      if (!completedUpsert.ok) {
        return NextResponse.json(
          { error: completedUpsert.message || 'Không lưu được dữ liệu buổi học hoàn thành.' },
          { status: 500 }
        )
      }
    } else {
      const delCompleted = await deleteCompletedLessonPg(user.id, sessionId)
      if (!delCompleted.ok) {
        return NextResponse.json({ error: delCompleted.message || 'Không xóa được bản ghi completed.' }, { status: 500 })
      }
    }

    if (markEnded) {
      const ended = await upsertEndedSessionPg(user.id, sessionId)
      if (!ended.ok) {
        return NextResponse.json({ error: ended.message || 'Không đánh dấu kết thúc được.' }, { status: 500 })
      }
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
