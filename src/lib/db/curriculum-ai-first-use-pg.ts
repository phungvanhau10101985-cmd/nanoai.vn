import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'
import { getVietnamDateYmd, getVietnamYearMonth } from '@/lib/curriculum-vietnam-date'

export type CurriculumAiArtifactKind =
  | 'curriculum_body'
  | 'lesson_slides'
  | 'infographic_curriculum'
  | 'infographic_lesson'

function isMissingFirstUseTableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /curriculum_ai_first_use/i.test(msg) && /does not exist|relation/i.test(msg)
}

export async function hasCurriculumAiFirstUse(userId: string, artifactKey: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const row = await pgQueryOne<{ e: boolean }>(
    `select exists(
       select 1 from public.curriculum_ai_first_use
       where user_id = $1::uuid and artifact_key = $2
     ) as e`,
    [userId, artifactKey]
    )
    return Boolean(row?.e)
  } catch (err) {
    if (isMissingFirstUseTableError(err)) return false
    throw err
  }
}

export async function countDailyWaivedCurriculumBodies(userId: string, usageDate = getVietnamDateYmd()): Promise<number> {
  if (!isPgConfigured()) return 0
  try {
    const row = await pgQueryOne<{ c: string }>(
    `select count(*)::text as c
     from public.curriculum_ai_first_use
     where user_id = $1::uuid
       and artifact_kind = 'curriculum_body'
       and waived = true
       and usage_date = $2::date`,
    [userId, usageDate]
    )
    const n = Number(row?.c ?? 0)
    return Number.isFinite(n) ? n : 0
  } catch (err) {
    if (isMissingFirstUseTableError(err)) return 0
    throw err
  }
}

export async function recordCurriculumAiFirstUse(input: {
  userId: string
  artifactKey: string
  artifactKind: CurriculumAiArtifactKind
  waived: boolean
  creditsCharged?: number | null
  metadata?: Record<string, unknown>
  usageDate?: string
}): Promise<void> {
  if (!isPgConfigured()) return
  try {
    const usageDate = input.usageDate ?? getVietnamDateYmd()
    const yearMonth = getVietnamYearMonth(new Date(`${usageDate}T12:00:00+07:00`))
    const pool = (await import('@/lib/db/pool')).getPgPool()
    await pool.query(
    `insert into public.curriculum_ai_first_use (
       user_id, artifact_key, artifact_kind, usage_date, year_month, waived, credits_charged, metadata_json
     ) values ($1::uuid, $2, $3, $4::date, $5, $6, $7, $8)
     on conflict (user_id, artifact_key) do nothing`,
    [
      input.userId,
      input.artifactKey,
      input.artifactKind,
      usageDate,
      yearMonth,
      input.waived,
      input.waived ? null : (input.creditsCharged ?? null),
      input.metadata ? JSON.stringify(input.metadata) : null,
      ]
    )
  } catch (err) {
    if (isMissingFirstUseTableError(err)) return
    throw err
  }
}
