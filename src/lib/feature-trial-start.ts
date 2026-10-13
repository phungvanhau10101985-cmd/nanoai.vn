import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

/** curriculum = gói giáo trình giáo viên. student = gói chữa bài + gia sư. */
export type FeatureTrialFeature = 'curriculum' | 'student'

function asIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null
  if (value instanceof Date) {
    const t = value.getTime()
    return Number.isNaN(t) ? null : value.toISOString()
  }
  const t = Date.parse(String(value))
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

function isMissingRelation(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /does not exist|relation/i.test(msg)
}

async function minTimestamp(sql: string, userId: string): Promise<number | null> {
  try {
    const row = await pgQueryOne<{ ts: Date | string | null }>(sql, [userId])
    const iso = asIso(row?.ts)
    if (!iso) return null
    return Date.parse(iso)
  } catch (err) {
    if (isMissingRelation(err)) return null
    throw err
  }
}

/** Lần dùng thật sớm nhất đã có trong dữ liệu, trước khi có dòng mốc. */
async function earliestRealUseMs(userId: string, feature: FeatureTrialFeature): Promise<number | null> {
  const queries =
    feature === 'curriculum'
      ? [
          `select min(created_at) as ts from public.worksheet_curricula where user_id = $1::uuid`,
          `select min(created_at) as ts from public.worksheet_worksheets where user_id = $1::uuid`,
          `select min(created_at) as ts from public.curriculum_ai_first_use where user_id = $1::uuid`,
          `select min(created_at) as ts from public.exam_sessions where teacher_id = $1::uuid`,
        ]
      : [
          `select min(created_at) as ts from public.homework_messages where user_id = $1::uuid and role = 'user'`,
          `select min(created_at) as ts from public.tutor_messages where user_id = $1::uuid and role = 'user'`,
        ]
  const stamps = await Promise.all(queries.map((sql) => minTimestamp(sql, userId)))
  const finite = stamps.filter((t): t is number => t != null && Number.isFinite(t))
  if (!finite.length) return null
  return Math.min(...finite)
}

async function readStoredStart(userId: string, feature: FeatureTrialFeature): Promise<string | null> {
  try {
    const row = await pgQueryOne<{ started_at: Date | string }>(
      `select started_at
       from public.feature_trial_starts
       where user_id = $1::uuid and feature = $2
       limit 1`,
      [userId, feature]
    )
    return asIso(row?.started_at)
  } catch (err) {
    if (isMissingRelation(err)) return null
    throw err
  }
}

async function insertStart(userId: string, feature: FeatureTrialFeature, startedAt: Date): Promise<string | null> {
  try {
    await pgQuery(
      `insert into public.feature_trial_starts (user_id, feature, started_at)
       values ($1::uuid, $2, $3::timestamptz)
       on conflict (user_id, feature) do nothing`,
      [userId, feature, startedAt.toISOString()]
    )
  } catch (err) {
    if (isMissingRelation(err)) return null
    throw err
  }
  return readStoredStart(userId, feature)
}

/**
 * Đọc mốc đã ghi. Nếu chưa có dòng nhưng đã dùng tính năng, ghi mốc bằng lần dùng sớm nhất.
 * Chưa dùng thì trả null — đồng hồ chưa chạy.
 */
export async function readFeatureTrialStartedAt(
  userId: string,
  feature: FeatureTrialFeature
): Promise<string | null> {
  if (!isPgConfigured() || !userId) return null
  const stored = await readStoredStart(userId, feature)
  if (stored) return stored
  const historical = await earliestRealUseMs(userId, feature)
  if (historical == null) return null
  return insertStart(userId, feature, new Date(historical))
}

/** Ghi mốc lúc bắt đầu dùng tính năng. Lần sau giữ mốc cũ. */
export async function beginFeatureTrial(
  userId: string,
  feature: FeatureTrialFeature,
  now = new Date()
): Promise<string | null> {
  if (!isPgConfigured() || !userId) return null
  const stored = await readStoredStart(userId, feature)
  if (stored) return stored
  const historical = await earliestRealUseMs(userId, feature)
  const started = historical != null ? new Date(Math.min(historical, now.getTime())) : now
  return insertStart(userId, feature, started)
}
