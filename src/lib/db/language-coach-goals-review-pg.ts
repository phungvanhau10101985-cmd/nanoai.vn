import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type LearningGoalRowPg = Record<string, unknown>

export async function fetchActiveLearningGoalPg(userId: string): Promise<LearningGoalRowPg | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select *
       from public.language_coach_learning_goals
       where user_id = $1::uuid and is_active = true
       order by updated_at desc
       limit 1`,
      [userId]
    )
    return row ?? null
  } catch (e) {
    console.error('[language-coach-goals-review-pg] fetchActiveLearningGoalPg', e)
    return null
  }
}

export async function deactivateAllLearningGoalsPg(userId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `update public.language_coach_learning_goals
       set is_active = false, updated_at = now()
       where user_id = $1::uuid and is_active = true`,
      [userId]
    )
    return true
  } catch (e) {
    console.error('[language-coach-goals-review-pg] deactivateAllLearningGoalsPg', e)
    return false
  }
}

export async function insertLearningGoalPg(params: {
  userId: string
  goalType: string
  title: string
  targetLanguage: string
  nativeLanguage: string
  targetDays: number
  targetDailyMinutes: number
  targetWeeklySessions: number
  targetPronunciationScore: number
  startedAtIso: string
  endsAtIso: string
}): Promise<LearningGoalRowPg | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `insert into public.language_coach_learning_goals (
         user_id, goal_type, title, target_language, native_language,
         target_days, target_daily_minutes, target_weekly_sessions, target_pronunciation_score,
         is_active, started_at, ends_at, updated_at
       ) values (
         $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, true,
         $10::timestamptz, $11::timestamptz, now()
       )
       returning *`,
      [
        params.userId,
        params.goalType,
        params.title,
        params.targetLanguage,
        params.nativeLanguage,
        params.targetDays,
        params.targetDailyMinutes,
        params.targetWeeklySessions,
        params.targetPronunciationScore,
        params.startedAtIso,
        params.endsAtIso,
      ]
    )
    return row ?? null
  } catch (e) {
    console.error('[language-coach-goals-review-pg] insertLearningGoalPg', e)
    return null
  }
}

export type ReviewQueueDueRowPg = {
  id: string
  word: string
  target_language: string
  native_language: string | null
  meaning: string | null
  pronunciation: string | null
  meaning_items_json: string | null
  example_items_json: string | null
  usage_level: string | null
  importance_score: number | null
  is_context_sensitive: boolean | null
  due_at: string
  repetitions: number | null
  interval_days: number | null
}

export async function fetchDueReviewQueuePg(userId: string, limit: number): Promise<ReviewQueueDueRowPg[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<ReviewQueueDueRowPg>(
      `select id::text, word, target_language, native_language, meaning, pronunciation,
              meaning_items_json, example_items_json, usage_level, importance_score, is_context_sensitive,
              due_at::text, repetitions, interval_days
       from public.language_coach_review_queue
       where user_id = $1::uuid and due_at <= now()
       order by due_at asc
       limit $2`,
      [userId, limit]
    )
    return rows
  } catch (e) {
    console.error('[language-coach-goals-review-pg] fetchDueReviewQueuePg', e)
    return null
  }
}

export async function fetchReviewQueueSpacingPg(
  userId: string,
  reviewId: string
): Promise<{ interval_days: number | null; repetitions: number | null } | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ interval_days: number | null; repetitions: number | null }>(
      `select interval_days, repetitions
       from public.language_coach_review_queue
       where id = $1::uuid and user_id = $2::uuid
       limit 1`,
      [reviewId, userId]
    )
    return row ?? null
  } catch (e) {
    console.error('[language-coach-goals-review-pg] fetchReviewQueueSpacingPg', e)
    return null
  }
}

export async function updateReviewQueueAfterReviewPg(params: {
  userId: string
  reviewId: string
  repetitions: number
  intervalDays: number
  dueAtIso: string
  lastReviewedAtIso: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const row = await pgQueryOne<{ id: string }>(
      `update public.language_coach_review_queue
       set repetitions = $3,
           interval_days = $4,
           due_at = $5::timestamptz,
           last_reviewed_at = $6::timestamptz,
           updated_at = now()
       where id = $1::uuid and user_id = $2::uuid
       returning id::text as id`,
      [
        params.reviewId,
        params.userId,
        params.repetitions,
        params.intervalDays,
        params.dueAtIso,
        params.lastReviewedAtIso,
      ]
    )
    return row != null
  } catch (e) {
    console.error('[language-coach-goals-review-pg] updateReviewQueueAfterReviewPg', e)
    return false
  }
}
