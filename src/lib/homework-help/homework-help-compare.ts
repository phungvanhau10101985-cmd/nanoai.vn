import type { WebLocale } from '@/lib/i18n/config'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'

export const HOMEWORK_ANSWER_OUTCOMES = ['agree', 'gpt_deepseek', 'gpt_gemini', 'unmatched'] as const
export const HOMEWORK_KNOWLEDGE_OUTCOMES = ['ok', 'not_ok'] as const

export type HomeworkAnswerOutcome = (typeof HOMEWORK_ANSWER_OUTCOMES)[number]
export type HomeworkKnowledgeOutcome = (typeof HOMEWORK_KNOWLEDGE_OUTCOMES)[number]
export type HomeworkCompareCheckpoint = 'answer' | 'knowledge'

export type HomeworkCompareEvent = {
  checkpoint: HomeworkCompareCheckpoint
  outcome: HomeworkAnswerOutcome | HomeworkKnowledgeOutcome
  fingerprint: string
}

/** Kết quả một lần đối chiếu đáp án. Khớp ngay thì không gọi GPT. */
export function homeworkAnswerCompareOutcome(input: {
  agreed: boolean
  side: '' | 'draft' | 'check'
}): HomeworkAnswerOutcome {
  if (input.agreed) return 'agree'
  if (input.side === 'draft') return 'gpt_deepseek'
  if (input.side === 'check') return 'gpt_gemini'
  return 'unmatched'
}

function allowed(event: HomeworkCompareEvent): boolean {
  if (event.checkpoint === 'answer') return (HOMEWORK_ANSWER_OUTCOMES as readonly string[]).includes(event.outcome)
  return (HOMEWORK_KNOWLEDGE_OUTCOMES as readonly string[]).includes(event.outcome)
}

/** Ghi thống kê đối chiếu. Lỗi bảng không chặn bài học sinh đang xem. */
export async function rememberHomeworkCompareEvents(input: {
  userId: string
  locale: WebLocale
  events: HomeworkCompareEvent[]
}): Promise<void> {
  const events = input.events.filter(allowed)
  if (!isPgConfigured() || events.length === 0) return
  const userId = /^[0-9a-f-]{36}$/i.test(input.userId) ? input.userId : null
  try {
    await pgQuery(
      `insert into public.homework_help_compare_events (locale, checkpoint, outcome, fingerprint, user_id)
       select $1, checkpoint, outcome, fingerprint, $2::uuid
       from unnest($3::text[], $4::text[], $5::text[]) as t(checkpoint, outcome, fingerprint)`,
      [
        input.locale,
        userId,
        events.map((event) => event.checkpoint),
        events.map((event) => event.outcome),
        events.map((event) => event.fingerprint.slice(0, 80)),
      ]
    )
  } catch (error) {
    console.warn('[homework-compare] write', error instanceof Error ? error.message : error)
  }
}

export type HomeworkCompareDay = {
  day: string
  agree: number
  gptDeepseek: number
  gptGemini: number
  unmatched: number
  knowledgeOk: number
  knowledgeNot: number
}

export type HomeworkCompareLocale = {
  locale: string
  answers: number
  knowledge: number
}

export type HomeworkCompareStats = {
  days: HomeworkCompareDay[]
  locales: HomeworkCompareLocale[]
  error: string | null
}

type CountRow = { day: string; checkpoint: string; outcome: string; n: number }
type LocaleRow = { locale: string; checkpoint: string; n: number }

function emptyDay(day: string): HomeworkCompareDay {
  return { day, agree: 0, gptDeepseek: 0, gptGemini: 0, unmatched: 0, knowledgeOk: 0, knowledgeNot: 0 }
}

function addCount(day: HomeworkCompareDay, checkpoint: string, outcome: string, n: number) {
  if (checkpoint === 'answer' && outcome === 'agree') day.agree += n
  else if (checkpoint === 'answer' && outcome === 'gpt_deepseek') day.gptDeepseek += n
  else if (checkpoint === 'answer' && outcome === 'gpt_gemini') day.gptGemini += n
  else if (checkpoint === 'answer' && outcome === 'unmatched') day.unmatched += n
  else if (checkpoint === 'knowledge' && outcome === 'ok') day.knowledgeOk += n
  else if (checkpoint === 'knowledge' && outcome === 'not_ok') day.knowledgeNot += n
}

/** Điền ngày trống trong khoảng ICT để biểu đồ không đứt. */
export function fillHomeworkCompareDays(fromDay: string, toDay: string, rows: CountRow[]): HomeworkCompareDay[] {
  const byDay = new Map<string, HomeworkCompareDay>()
  const cursor = new Date(`${fromDay}T12:00:00+07:00`)
  const end = new Date(`${toDay}T12:00:00+07:00`)
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || cursor > end) return []
  while (cursor <= end && byDay.size < 370) {
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(cursor)
    byDay.set(day, emptyDay(day))
    cursor.setTime(cursor.getTime() + 24 * 60 * 60 * 1000)
  }
  for (const row of rows) {
    const day = byDay.get(row.day) ?? emptyDay(row.day)
    addCount(day, row.checkpoint, row.outcome, Number(row.n) || 0)
    byDay.set(row.day, day)
  }
  return [...byDay.values()].sort((left, right) => left.day.localeCompare(right.day))
}

export async function pgHomeworkCompareStats(fromIso: string, toIso: string, fromDay: string, toDay: string): Promise<HomeworkCompareStats> {
  if (!isPgConfigured()) return { days: [], locales: [], error: 'DATABASE_URL not set' }
  try {
    const [counts, locales] = await Promise.all([
      pgQuery<CountRow>(
        `select to_char(created_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') as day,
                checkpoint, outcome, count(*)::int as n
         from public.homework_help_compare_events
         where created_at >= $1::timestamptz and created_at <= $2::timestamptz
         group by 1, 2, 3
         order by 1`,
        [fromIso, toIso]
      ),
      pgQuery<LocaleRow>(
        `select locale, checkpoint, count(*)::int as n
         from public.homework_help_compare_events
         where created_at >= $1::timestamptz and created_at <= $2::timestamptz
         group by 1, 2
         order by 3 desc`,
        [fromIso, toIso]
      ),
    ])
    const localeMap = new Map<string, HomeworkCompareLocale>()
    for (const row of locales) {
      const current = localeMap.get(row.locale) ?? { locale: row.locale, answers: 0, knowledge: 0 }
      if (row.checkpoint === 'answer') current.answers += Number(row.n) || 0
      if (row.checkpoint === 'knowledge') current.knowledge += Number(row.n) || 0
      localeMap.set(row.locale, current)
    }
    return {
      days: fillHomeworkCompareDays(fromDay, toDay, counts),
      locales: [...localeMap.values()],
      error: null,
    }
  } catch (error) {
    return {
      days: [],
      locales: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
