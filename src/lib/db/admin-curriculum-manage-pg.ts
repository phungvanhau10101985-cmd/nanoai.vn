import {
  CURRICULUM_API_COST_BUCKET_SQL,
  CURRICULUM_RELATED_API_FEATURE_SQL,
  curriculumApiGroupedCostVnd,
  type CurriculumApiCostBucket,
} from '@/lib/curriculum/curriculum-api-cost'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'

export const ADMIN_CURRICULUM_MANAGE_LIMIT = 200

export type AdminCurriculumManageCost = {
  calls: number
  totalVnd: number
  curriculumVnd: number
  questionVnd: number
  slideVnd: number
  imageVnd: number
}

export type AdminCurriculumManageRow = {
  id: string
  createdAt: string
  topic: string
  subjectId: string
  gradeLevelId: string
  textbookSetId: string
  textbookVolume: string | null
  textbookIsbn: string | null
  lessonNumber: number | null
  lessonTypeId: string
  numLessons: number
  lessonDurationMinutes: number
  goals: string
  fullName: string | null
  email: string | null
  createdSource: string
  createdSourceDetail: string
  lessonSavedCount: number
  questionCount: number
  slideSetCount: number
  cost: AdminCurriculumManageCost
}

export type AdminCurriculumManageSummary = {
  curricula: number
  calls: number
  totalVnd: number
}

type CurriculumQueryRow = {
  id: string
  created_at: Date | string
  topic: string
  subject_id: string
  grade_level_id: string
  textbook_set_id: string
  textbook_volume: string | null
  textbook_isbn: string | null
  lesson_number: number | string | null
  lesson_type_id: string
  num_lessons: number | string
  lesson_duration_minutes: number | string
  goals: string | null
  full_name: string | null
  email: string | null
  created_source: string | null
  created_source_detail: string | null
  lesson_saved_count: number | string
  question_count: number | string
  slide_set_count: number | string
}

type UsageQueryRow = {
  curriculum_id: string
  model: string
  image_size: string | null
  bucket: string
  calls: number | string
  prompt_tokens: number | string
  output_tokens: number | string
}

const EMPTY_COST = (): AdminCurriculumManageCost => ({
  calls: 0,
  totalVnd: 0,
  curriculumVnd: 0,
  questionVnd: 0,
  slideVnd: 0,
  imageVnd: 0,
})

function asInt(value: number | string | null | undefined): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? Math.round(n) : 0
}

function asIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString()
  return String(value ?? '')
}

function asBucket(value: string): CurriculumApiCostBucket {
  if (value === 'question' || value === 'slide' || value === 'image') return value
  return 'curriculum'
}

function searchClause(query: string): { sql: string; param: string | null } {
  const trimmed = query.trim().slice(0, 80)
  if (!trimmed) return { sql: '', param: null }
  return {
    sql: `and (
      c.topic ilike $3
      or coalesce(au.email, '') ilike $3
      or coalesce(p.full_name, '') ilike $3
      or c.subject_id ilike $3
      or c.grade_level_id ilike $3
    )`,
    param: `%${trimmed.replace(/[%_\\]/g, '')}%`,
  }
}

export async function fetchAdminCurriculumManage(input: {
  fromIso: string
  toIso: string
  query?: string
}): Promise<{
  summary: AdminCurriculumManageSummary
  rows: AdminCurriculumManageRow[]
  truncated: boolean
  error?: string
}> {
  const empty = { summary: { curricula: 0, calls: 0, totalVnd: 0 }, rows: [], truncated: false }
  if (!isPgConfigured()) return { ...empty, error: 'DATABASE_URL is not set' }

  const search = searchClause(input.query ?? '')
  const params: unknown[] = [input.fromIso, input.toIso]
  if (search.param) params.push(search.param)
  const limitParam = params.length + 1
  params.push(ADMIN_CURRICULUM_MANAGE_LIMIT + 1)

  try {
    const listed = await pgQuery<CurriculumQueryRow>(
      `select c.id::text as id,
              c.created_at,
              c.topic,
              c.subject_id,
              c.grade_level_id,
              c.textbook_set_id,
              c.textbook_volume,
              c.textbook_isbn,
              c.lesson_number,
              c.lesson_type_id,
              c.num_lessons,
              c.lesson_duration_minutes,
              left(coalesce(c.goals, ''), 160) as goals,
              p.full_name,
              au.email,
              c.created_source,
              c.created_source_detail,
              (select count(*)::int from public.worksheet_curriculum_lessons lesson where lesson.curriculum_id = c.id) as lesson_saved_count,
              (select count(*)::int from public.worksheet_questions question where question.curriculum_id = c.id) as question_count,
              (select count(*)::int from public.worksheet_curriculum_lesson_slides slide where slide.curriculum_id = c.id) as slide_set_count
       from public.worksheet_curricula c
       left join public.profiles p on p.id = c.user_id
       left join auth.users au on au.id = c.user_id
       where c.created_at >= $1::timestamptz
         and c.created_at <= $2::timestamptz
         ${search.sql}
       order by c.created_at desc
       limit $${limitParam}`,
      params,
    )

    const truncated = listed.length > ADMIN_CURRICULUM_MANAGE_LIMIT
    const page = truncated ? listed.slice(0, ADMIN_CURRICULUM_MANAGE_LIMIT) : listed
    const costs = new Map<string, AdminCurriculumManageCost>()
    for (const row of page) costs.set(row.id, EMPTY_COST())

    if (page.length > 0) {
      const usage = await pgQuery<UsageQueryRow>(
        `with bounds as (
           select id,
                  user_id,
                  created_at,
                  lag(created_at) over (partition by user_id order by created_at, id) as prev_at,
                  lead(created_at) over (partition by user_id order by created_at, id) as next_at
           from public.worksheet_curricula
           where user_id is not null
         ),
         targets as (
           select c.id,
                  c.user_id,
                  case
                    when b.prev_at is null then c.created_at - interval '3 hours'
                    else b.prev_at + ((c.created_at - b.prev_at) / 2)
                  end as win_start,
                  case
                    when b.next_at is null then now() + interval '1 day'
                    else c.created_at + ((b.next_at - c.created_at) / 2)
                  end as win_end
           from public.worksheet_curricula c
           left join bounds b on b.id = c.id
           where c.id = any($1::uuid[])
         )
         select t.id::text as curriculum_id,
                l.model,
                l.image_size,
                ${CURRICULUM_API_COST_BUCKET_SQL} as bucket,
                count(*)::int as calls,
                coalesce(sum(l.prompt_token_count), 0)::bigint as prompt_tokens,
                coalesce(sum(l.candidates_token_count), 0)::bigint as output_tokens
         from targets t
         join public.api_usage_log l
           on ${CURRICULUM_RELATED_API_FEATURE_SQL}
          and (
            l.curriculum_id = t.id
            or (
              l.curriculum_id is null
              and t.user_id is not null
              and l.user_id = t.user_id
              and l.created_at >= t.win_start
              and l.created_at < t.win_end
            )
          )
         group by t.id, l.model, l.image_size, bucket`,
        [page.map((row) => row.id)],
      )

      for (const log of usage) {
        const cost = costs.get(log.curriculum_id)
        if (!cost) continue
        const vnd = curriculumApiGroupedCostVnd({
          model: log.model,
          imageSize: log.image_size,
          calls: asInt(log.calls),
          promptTokens: asInt(log.prompt_tokens),
          outputTokens: asInt(log.output_tokens),
        })
        const bucket = asBucket(log.bucket)
        cost.calls += asInt(log.calls)
        cost.totalVnd += vnd
        if (bucket === 'question') cost.questionVnd += vnd
        else if (bucket === 'slide') cost.slideVnd += vnd
        else if (bucket === 'image') cost.imageVnd += vnd
        else cost.curriculumVnd += vnd
      }
    }

    const rows: AdminCurriculumManageRow[] = page.map((row) => ({
      id: row.id,
      createdAt: asIso(row.created_at),
      topic: row.topic,
      subjectId: row.subject_id,
      gradeLevelId: row.grade_level_id,
      textbookSetId: row.textbook_set_id,
      textbookVolume: row.textbook_volume,
      textbookIsbn: row.textbook_isbn,
      lessonNumber: row.lesson_number == null ? null : Number(row.lesson_number),
      lessonTypeId: row.lesson_type_id,
      numLessons: asInt(row.num_lessons),
      lessonDurationMinutes: asInt(row.lesson_duration_minutes),
      goals: row.goals ?? '',
      fullName: row.full_name,
      email: row.email,
      createdSource: row.created_source ?? '',
      createdSourceDetail: row.created_source_detail ?? '',
      lessonSavedCount: asInt(row.lesson_saved_count),
      questionCount: asInt(row.question_count),
      slideSetCount: asInt(row.slide_set_count),
      cost: costs.get(row.id) ?? EMPTY_COST(),
    }))

    const summary = rows.reduce<AdminCurriculumManageSummary>(
      (acc, row) => {
        acc.curricula += 1
        acc.calls += row.cost.calls
        acc.totalVnd += row.cost.totalVnd
        return acc
      },
      { curricula: 0, calls: 0, totalVnd: 0 },
    )

    return { summary, rows, truncated }
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : String(e) }
  }
}
