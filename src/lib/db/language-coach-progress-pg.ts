import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type ProgressDailyRowPg = Record<string, unknown>

export async function countDueReviewItemsPg(userId: string): Promise<number | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ c: string }>(
      `select count(*)::text as c
       from public.language_coach_review_queue
       where user_id = $1::uuid and due_at <= now()`,
      [userId]
    )
    if (!row?.c) return 0
    const n = Number(row.c)
    return Number.isFinite(n) ? n : 0
  } catch (e) {
    console.error('[language-coach-progress-pg] countDueReviewItemsPg', e)
    return null
  }
}

/** Một dòng tiến độ trong ngày: nếu `targetLanguage` rỗng thì lấy bản cập nhật mới nhất (mọi ngôn ngữ). */
export async function fetchTodayProgressRowPg(
  userId: string,
  progressDate: string,
  targetLanguage?: string
): Promise<ProgressDailyRowPg | null> {
  if (!isPgConfigured()) return null
  const tl = String(targetLanguage || '').trim()
  try {
    if (tl) {
      return await pgQueryOne(
        `select *
         from public.language_coach_progress_daily
         where user_id = $1::uuid and progress_date = $2::date and target_language = $3
         order by updated_at desc
         limit 1`,
        [userId, progressDate, tl]
      )
    }
    return await pgQueryOne(
      `select *
       from public.language_coach_progress_daily
       where user_id = $1::uuid and progress_date = $2::date
       order by updated_at desc
       limit 1`,
      [userId, progressDate]
    )
  } catch (e) {
    console.error('[language-coach-progress-pg] fetchTodayProgressRowPg', e)
    return null
  }
}

export async function fetchWeeklyProgressRowsPg(
  userId: string,
  fromDate: string,
  toDate: string
): Promise<ProgressDailyRowPg[] | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQuery(
      `select turns_count, sessions_count, corrected_turns, avg_pronunciation_score, progress_date
       from public.language_coach_progress_daily
       where user_id = $1::uuid
         and progress_date >= $2::date and progress_date <= $3::date
       order by progress_date desc`,
      [userId, fromDate, toDate]
    )
  } catch (e) {
    console.error('[language-coach-progress-pg] fetchWeeklyProgressRowsPg', e)
    return null
  }
}

export async function fetchDiagnosticsSamplePg(
  userId: string,
  targetLanguageEffective: string,
  limit: number
): Promise<Array<{ weak_words_json: string | null; word_scores_json: string | null }> | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQuery(
      `select weak_words_json, word_scores_json
       from public.language_coach_turn_diagnostics
       where user_id = $1::uuid and target_language = $2
       order by created_at desc
       limit $3`,
      [userId, targetLanguageEffective, limit]
    )
  } catch (e) {
    console.error('[language-coach-progress-pg] fetchDiagnosticsSamplePg', e)
    return null
  }
}

export type AssessmentSummaryPg = {
  cefr_level: string
  learner_level: number
  overall_score: number
  confidence: number
  taken_at: string
  summary: string
}

export async function fetchBaselineAssessmentPg(
  userId: string,
  targetLanguage: string
): Promise<AssessmentSummaryPg | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQueryOne(
      `select cefr_level, learner_level, overall_score, confidence, taken_at::text, summary
       from public.language_coach_assessments
       where user_id = $1::uuid and assessment_type = 'baseline' and target_language = $2
       order by taken_at desc
       limit 1`,
      [userId, targetLanguage]
    )
  } catch (e) {
    console.error('[language-coach-progress-pg] fetchBaselineAssessmentPg', e)
    return null
  }
}

export async function fetchLatestCheckpointAssessmentPg(
  userId: string,
  targetLanguage: string
): Promise<AssessmentSummaryPg | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQueryOne(
      `select cefr_level, learner_level, overall_score, confidence, taken_at::text, summary
       from public.language_coach_assessments
       where user_id = $1::uuid and assessment_type = 'checkpoint' and target_language = $2
       order by taken_at desc
       limit 1`,
      [userId, targetLanguage]
    )
  } catch (e) {
    console.error('[language-coach-progress-pg] fetchLatestCheckpointAssessmentPg', e)
    return null
  }
}

export async function fetchRecentCheckpointScoresPg(
  userId: string,
  targetLanguage: string,
  limit: number
): Promise<Array<{ learner_level: number; overall_score: number; taken_at: string }> | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQuery(
      `select learner_level, overall_score, taken_at::text
       from public.language_coach_assessments
       where user_id = $1::uuid and assessment_type = 'checkpoint' and target_language = $2
       order by taken_at desc
       limit $3`,
      [userId, targetLanguage, limit]
    )
  } catch (e) {
    console.error('[language-coach-progress-pg] fetchRecentCheckpointScoresPg', e)
    return null
  }
}

/** POST: một dòng đúng (user, ngày, ngôn ngữ đích) — `targetLanguage` rỗng → null trong DB. */
export async function fetchProgressRowForDatePg(
  userId: string,
  progressDate: string,
  targetLanguage: string | null
): Promise<ProgressDailyRowPg | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQueryOne(
      `select *
       from public.language_coach_progress_daily
       where user_id = $1::uuid and progress_date = $2::date
         and target_language is not distinct from $3::text
       limit 1`,
      [userId, progressDate, targetLanguage]
    )
  } catch (e) {
    console.error('[language-coach-progress-pg] fetchProgressRowForDatePg', e)
    return null
  }
}

export async function fetchYesterdayStreakRowPg(
  userId: string,
  yesterday: string,
  targetLanguage: string | null
): Promise<{ streak_days: number; turns_count: number } | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQueryOne(
      `select streak_days, turns_count
       from public.language_coach_progress_daily
       where user_id = $1::uuid and progress_date = $2::date
         and target_language is not distinct from $3::text
       limit 1`,
      [userId, yesterday, targetLanguage]
    )
  } catch (e) {
    console.error('[language-coach-progress-pg] fetchYesterdayStreakRowPg', e)
    return null
  }
}

export async function upsertProgressDailyPg(params: {
  userId: string
  progressDate: string
  targetLanguage: string | null
  turnsCount: number
  sessionsCount: number
  correctedTurns: number
  pronunciationSamples: number
  avgPronunciationScore: number
  streakDays: number
  updatedAtIso: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    await pgQuery(
      `insert into public.language_coach_progress_daily (
         user_id, progress_date, target_language,
         turns_count, sessions_count, corrected_turns,
         pronunciation_samples, avg_pronunciation_score, streak_days, updated_at
       ) values (
         $1::uuid, $2::date, $3,
         $4, $5, $6, $7, $8, $9, $10::timestamptz
       )
       on conflict (user_id, progress_date, target_language)
       do update set
         turns_count = excluded.turns_count,
         sessions_count = excluded.sessions_count,
         corrected_turns = excluded.corrected_turns,
         pronunciation_samples = excluded.pronunciation_samples,
         avg_pronunciation_score = excluded.avg_pronunciation_score,
         streak_days = excluded.streak_days,
         updated_at = excluded.updated_at`,
      [
        params.userId,
        params.progressDate,
        params.targetLanguage,
        params.turnsCount,
        params.sessionsCount,
        params.correctedTurns,
        params.pronunciationSamples,
        params.avgPronunciationScore,
        params.streakDays,
        params.updatedAtIso,
      ]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-progress-pg] upsertProgressDailyPg', e)
    return { ok: false, message: msg || 'Không lưu được tiến độ học.' }
  }
}

export async function insertTurnDiagnosticPg(params: {
  userId: string
  sessionId: string
  progressDate: string
  targetLanguage: string
  nativeLanguage: string | null
  speakingMode: string
  inputSource: string
  hadCorrections: boolean
  pronunciationScore: number | null
  pronunciationAccuracy: number | null
  pronunciationFluency: number | null
  pronunciationProsody: number | null
  weakWordsJson: string
  wordScoresJson: string
  inferredMeaning: string | null
  targetTranscript: string | null
  nativeTranscript: string | null
  mergedTranscript: string | null
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    await pgQuery(
      `insert into public.language_coach_turn_diagnostics (
         user_id, session_id, progress_date, target_language, native_language,
         speaking_mode, input_source, had_corrections,
         pronunciation_score, pronunciation_accuracy, pronunciation_fluency, pronunciation_prosody,
         weak_words_json, word_scores_json, inferred_meaning,
         target_transcript, native_transcript, merged_transcript
       ) values (
         $1::uuid, $2, $3::date, $4, $5,
         $6, $7, $8,
         $9, $10, $11, $12,
         $13, $14, $15,
         $16, $17, $18
       )`,
      [
        params.userId,
        params.sessionId,
        params.progressDate,
        params.targetLanguage,
        params.nativeLanguage,
        params.speakingMode,
        params.inputSource,
        params.hadCorrections,
        params.pronunciationScore,
        params.pronunciationAccuracy,
        params.pronunciationFluency,
        params.pronunciationProsody,
        params.weakWordsJson,
        params.wordScoresJson,
        params.inferredMeaning,
        params.targetTranscript,
        params.nativeTranscript,
        params.mergedTranscript,
      ]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-progress-pg] insertTurnDiagnosticPg', e)
    return { ok: false, message: msg }
  }
}

/** Tăng new_words_count trong progress ngày (RPC cũ `increment_language_coach_progress_new_words`). */
export async function incrementLanguageCoachProgressNewWordsPg(params: {
  userId: string
  progressDate: string
  targetLanguage: string
  inc?: number
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    await pgQuery(
      `select public.increment_language_coach_progress_new_words($1::uuid, $2::date, $3::text, $4::int)`,
      [params.userId, params.progressDate, params.targetLanguage, Math.max(0, params.inc ?? 1)]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-progress-pg] incrementLanguageCoachProgressNewWordsPg', e)
    return { ok: false, message: msg }
  }
}
