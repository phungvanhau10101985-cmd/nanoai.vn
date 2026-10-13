import type { WebLocale } from '@/lib/i18n/config'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { isSmtpConfigured, sendSmtpMail } from '@/lib/email/smtp'
import { homeworkStatementFingerprint } from '@/lib/homework-help/homework-help-fingerprint'

const ROW_COLUMNS = `id::text, fingerprint, locale, statement, draft_answer, check_answer, gemini_answer, gpt_answer,
  user_id::text, occurrences, first_seen_at, last_seen_at, emailed_at, resolved_at`

export type HomeworkUnsolvedRow = {
  id: string
  fingerprint: string
  locale: string
  statement: string
  draft_answer: string
  check_answer: string
  gemini_answer: string
  gpt_answer: string
  user_id: string | null
  occurrences: number
  first_seen_at: string
  last_seen_at: string
  emailed_at: string | null
  resolved_at: string | null
}

function clip(value: string, max: number): string {
  return value.replace(/\r/g, '').trim().slice(0, max)
}

function appBaseUrl(): string {
  const raw = process.env.APP_URL || process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || ''
  return String(raw).replace(/\/$/, '')
}

async function adminRecipientEmails(): Promise<string[]> {
  const fromEnv = (process.env.ADMIN_ERROR_NOTIFY_EMAIL || '')
    .split(/[,;\s]+/)
    .map((item) => item.trim())
    .filter((item) => item.includes('@'))
  if (fromEnv.length) return Array.from(new Set(fromEnv))
  try {
    const rows = await pgQuery<{ email: string | null }>(
      `select u.email
       from public.profiles p
       join auth.users u on u.id = p.id
       where p.role = 'admin' and coalesce(u.email, '') <> ''`
    )
    return Array.from(new Set(rows.map((row) => String(row.email || '').trim()).filter(Boolean)))
  } catch (error) {
    console.warn('[homework-unsolved] admin emails', error instanceof Error ? error.message : error)
    return []
  }
}

/** Ghi bài không hiện đáp án. Cùng đề đang mở thì cộng số lần, không tạo dòng mới. */
export async function rememberHomeworkUnsolved(input: {
  userId: string
  locale: WebLocale
  rows: Array<{ statement: string; draftAnswer: string; geminiAnswer: string; gptAnswer: string }>
}): Promise<void> {
  if (!isPgConfigured() || input.rows.length === 0) return
  const userId = /^[0-9a-f-]{36}$/i.test(input.userId) ? input.userId : null
  for (const row of input.rows) {
    const statement = clip(row.statement, 8000)
    if (!statement) continue
    const fingerprint = homeworkStatementFingerprint(statement)
    try {
      await pgQuery(
        `insert into public.homework_help_unsolved
           (fingerprint, locale, statement, draft_answer, gemini_answer, gpt_answer, user_id)
         values ($1, $2, $3, $4, $5, $6, $7::uuid)
         on conflict (fingerprint) where resolved_at is null
         do update set
           occurrences = homework_help_unsolved.occurrences + 1,
           last_seen_at = now(),
           locale = excluded.locale,
           statement = excluded.statement,
           draft_answer = excluded.draft_answer,
           gemini_answer = excluded.gemini_answer,
           gpt_answer = excluded.gpt_answer,
           user_id = coalesce(excluded.user_id, homework_help_unsolved.user_id)`,
        [
          fingerprint,
          input.locale,
          statement,
          clip(row.draftAnswer, 2000),
          clip(row.geminiAnswer, 2000),
          clip(row.gptAnswer, 2000),
          userId,
        ]
      )
    } catch (error) {
      console.warn('[homework-unsolved] save', error instanceof Error ? error.message : error)
    }
  }
}

/** Một mail cho mọi bài chưa gửi. Không có bài mới thì không gửi. */
export async function emailUnsolvedHomeworkDigest(): Promise<{ sent: boolean; count: number }> {
  if (!isPgConfigured()) return { sent: false, count: 0 }
  const rows = await pgQuery<HomeworkUnsolvedRow>(
    `select ${ROW_COLUMNS}
     from public.homework_help_unsolved
     where emailed_at is null and resolved_at is null
     order by first_seen_at asc
     limit 50`
  )
  if (!rows.length) return { sent: false, count: 0 }
  if (!isSmtpConfigured()) {
    console.warn('[homework-unsolved] smtp missing, skip digest', rows.length)
    return { sent: false, count: rows.length }
  }
  const to = await adminRecipientEmails()
  if (!to.length) {
    console.warn('[homework-unsolved] no admin email', rows.length)
    return { sent: false, count: rows.length }
  }

  const base = appBaseUrl()
  const adminUrl = `${base}/admin/homework-unsolved`
  const shown = rows.slice(0, 15)
  const blocks = shown.map((row, index) => {
    const when = new Date(row.last_seen_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
    return [
      `${index + 1}. ${when} · ${row.occurrences} lần`,
      clip(row.statement, 500),
      `DeepSeek: ${clip(row.draft_answer, 300) || '-'}`,
      `Gemini Pro: ${clip(row.gemini_answer, 300) || '-'}`,
      `GPT: ${clip(row.gpt_answer, 300) || '-'}`,
    ].join('\n')
  })
  const extra = rows.length > shown.length ? `\nVà ${rows.length - shown.length} bài nữa trên trang admin.\n` : ''
  const text = [
    `Có ${rows.length} bài hỗ trợ làm bài chưa hiện đáp án.`,
    'GPT không khớp DeepSeek và cũng không khớp Gemini Pro.',
    '',
    ...blocks,
    extra,
    `Danh sách: ${adminUrl}`,
    '',
    'Mail này gửi một lần mỗi ngày, chỉ khi có bài chưa gửi.',
  ].join('\n')
  const sent = await sendSmtpMail({
    to: to.join(', '),
    subject: `[NanoAI] ${rows.length} bài chưa có đáp án`,
    text,
  })
  if (!sent.ok) {
    console.warn('[homework-unsolved] email', sent.error)
    return { sent: false, count: rows.length }
  }
  await pgQuery(
    `update public.homework_help_unsolved
     set emailed_at = now()
     where id = any($1::bigint[]) and emailed_at is null`,
    [rows.map((row) => row.id)]
  )
  return { sent: true, count: rows.length }
}

export async function pgListHomeworkUnsolved(filter: {
  status: 'open' | 'resolved' | 'all'
  q: string
  page: number
  pageSize: number
}): Promise<{
  rows: HomeworkUnsolvedRow[]
  total: number
  stats: { open: number; unmailed: number }
  error: string | null
}> {
  const empty = { rows: [], total: 0, stats: { open: 0, unmailed: 0 }, error: null }
  if (!isPgConfigured()) return { ...empty, error: 'DATABASE_URL not set' }
  const where: string[] = []
  const params: unknown[] = []
  if (filter.status === 'open') where.push('resolved_at is null')
  if (filter.status === 'resolved') where.push('resolved_at is not null')
  const q = filter.q.trim()
  if (q) {
    params.push(`%${q.replace(/[%_\\]/g, (char) => `\\${char}`)}%`)
    where.push(`statement ilike $${params.length}`)
  }
  const whereSql = where.length ? `where ${where.join(' and ')}` : ''
  try {
    const [countRow, rows, stats] = await Promise.all([
      pgQueryOne<{ n: number }>(`select count(*)::int as n from public.homework_help_unsolved ${whereSql}`, params),
      pgQuery<HomeworkUnsolvedRow>(
        `select ${ROW_COLUMNS} from public.homework_help_unsolved ${whereSql}
         order by last_seen_at desc
         limit $${params.length + 1} offset $${params.length + 2}`,
        [...params, filter.pageSize, (filter.page - 1) * filter.pageSize]
      ),
      pgQueryOne<{ open: number; unmailed: number }>(
        `select
           count(*) filter (where resolved_at is null)::int as open,
           count(*) filter (where resolved_at is null and emailed_at is null)::int as unmailed
         from public.homework_help_unsolved`
      ),
    ])
    return {
      rows,
      total: countRow?.n ?? 0,
      stats: { open: stats?.open ?? 0, unmailed: stats?.unmailed ?? 0 },
      error: null,
    }
  } catch (error) {
    return { ...empty, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function pgSetHomeworkUnsolvedResolved(ids: string[], resolved: boolean, adminId: string): Promise<number> {
  const clean = ids.filter((id) => /^\d+$/.test(id))
  if (!clean.length) return 0
  const rows = await pgQuery<{ id: string }>(
    resolved
      ? `update public.homework_help_unsolved
         set resolved_at = now(), resolved_by = $2::uuid
         where id = any($1::bigint[]) and resolved_at is null
         returning id::text`
      : `update public.homework_help_unsolved
         set resolved_at = null, resolved_by = null
         where id = any($1::bigint[]) and resolved_at is not null
         returning id::text`,
    resolved ? [clean, adminId] : [clean]
  )
  return rows.length
}
