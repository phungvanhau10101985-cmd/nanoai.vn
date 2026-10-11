import { createHash } from 'node:crypto'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { isSmtpConfigured, sendSmtpMail } from '@/lib/email/smtp'
import {
  clipText,
  CUSTOMER_ERROR_LIMITS as L,
  isExpectedCustomerMessage,
  normalizeErrorForFingerprint,
  normalizePathForFingerprint,
  type CustomerErrorSource,
} from '@/lib/errors/customer-error-filter'

const DEDUPE_WINDOW_MINUTES = 10
const EMAIL_SAME_FINGERPRINT_MINUTES = 30
const EMAIL_MAX_PER_HOUR = 30

export type CustomerErrorInput = {
  source: CustomerErrorSource
  path?: string | null
  title?: string | null
  message: string
  detail?: string | null
  digest?: string | null
  userId?: string | null
  userEmail?: string | null
  ip?: string | null
  userAgent?: string | null
  meta?: Record<string, unknown>
}

export type CustomerErrorRow = {
  id: string
  fingerprint: string
  source: CustomerErrorSource
  path: string | null
  title: string | null
  message: string
  detail: string | null
  digest: string | null
  user_id: string | null
  user_email: string | null
  ip: string | null
  user_agent: string | null
  meta: Record<string, unknown>
  occurrences: number
  first_seen_at: string
  last_seen_at: string
  emailed_at: string | null
  resolved_at: string | null
}

function fingerprintOf(path: string, message: string): string {
  return createHash('sha1')
    .update(`${normalizePathForFingerprint(path)}\n${normalizeErrorForFingerprint(message)}`)
    .digest('hex')
}

function appBaseUrl(): string {
  const u = process.env.APP_URL || process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || ''
  return String(u).replace(/\/$/, '')
}

async function adminRecipientEmails(): Promise<string[]> {
  const fromEnv = (process.env.ADMIN_ERROR_NOTIFY_EMAIL || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.includes('@'))
  if (fromEnv.length) return Array.from(new Set(fromEnv))
  try {
    const rows = await pgQuery<{ email: string | null }>(
      `select u.email
       from public.profiles p
       join auth.users u on u.id = p.id
       where p.role = 'admin' and coalesce(u.email, '') <> ''`
    )
    return Array.from(new Set(rows.map((r) => String(r.email || '').trim()).filter(Boolean)))
  } catch (e) {
    console.warn('[customer-error-report] admin emails', e instanceof Error ? e.message : e)
    return []
  }
}

async function shouldEmail(fingerprint: string): Promise<boolean> {
  const row = await pgQueryOne<{ same: number; hour: number }>(
    `select
       count(*) filter (where fingerprint = $1 and emailed_at > now() - make_interval(mins => $2))::int as same,
       count(*) filter (where emailed_at > now() - interval '1 hour')::int as hour
     from public.customer_error_reports
     where emailed_at > now() - interval '1 hour' or (fingerprint = $1 and emailed_at is not null)`,
    [fingerprint, EMAIL_SAME_FINGERPRINT_MINUTES]
  )
  return (row?.same ?? 0) === 0 && (row?.hour ?? 0) < EMAIL_MAX_PER_HOUR
}

function sourceLabel(source: CustomerErrorSource): string {
  if (source === 'boundary') return 'Trang bị lỗi (error boundary)'
  if (source === 'server') return 'API server'
  return 'Thông báo lỗi trên màn hình khách'
}

async function emailAdmins(row: CustomerErrorRow): Promise<void> {
  if (!isSmtpConfigured()) return
  if (!(await shouldEmail(row.fingerprint))) return
  const to = await adminRecipientEmails()
  if (!to.length) return

  const base = appBaseUrl()
  const adminUrl = `${base}/admin/error-reports?id=${row.id}`
  const pageUrl = row.path ? `${base}${row.path.startsWith('/') ? '' : '/'}${row.path}` : ''
  const who = row.user_email || row.user_id || 'Khách chưa đăng nhập'
  const lines = [
    'Một khách vừa thao tác bị lỗi trên NanoAI.',
    '',
    `Khách: ${who}`,
    `Trang: ${pageUrl || '-'}`,
    `Nguồn: ${sourceLabel(row.source)}`,
    `Thời gian: ${new Date(row.last_seen_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`,
    row.title ? `Tiêu đề: ${row.title}` : '',
    '',
    'Lỗi:',
    row.message,
    row.detail ? `\nChi tiết:\n${row.detail.slice(0, 2000)}` : '',
    '',
    `Xem danh sách lỗi: ${adminUrl}`,
    '',
    `Cùng lỗi này sẽ không gửi lại mail trong ${EMAIL_SAME_FINGERPRINT_MINUTES} phút.`,
  ].filter((line, i, arr) => line !== '' || arr[i - 1] !== '')

  const subject = `[NanoAI] Lỗi khách: ${row.message.replace(/\s+/g, ' ').slice(0, 90)}`
  const res = await sendSmtpMail({ to: to.join(', '), subject, text: lines.join('\n') })
  if (!res.ok) {
    console.warn('[customer-error-report] email', res.error)
    return
  }
  await pgQuery(`update public.customer_error_reports set emailed_at = now() where id = $1`, [row.id])
}

const ROW_COLUMNS = `id::text, fingerprint, source, path, title, message, detail, digest,
  user_id::text, user_email, ip, user_agent, meta, occurrences,
  first_seen_at, last_seen_at, emailed_at, resolved_at`

/** Ghi lỗi khách và mail admin. Không throw. */
export async function reportCustomerError(input: CustomerErrorInput): Promise<CustomerErrorRow | null> {
  if (!isPgConfigured()) return null
  const title = clipText(input.title, L.title)
  const message = clipText(input.message, L.message)
  if (isExpectedCustomerMessage(title, message)) return null
  const path = clipText(input.path, L.path) || null
  const fingerprint = fingerprintOf(path || '/', message || title)
  const userId = input.userId && /^[0-9a-f-]{36}$/i.test(input.userId) ? input.userId : null

  try {
    const bumped = await pgQueryOne<CustomerErrorRow>(
      `update public.customer_error_reports
       set occurrences = occurrences + 1, last_seen_at = now()
       where id = (
         select id from public.customer_error_reports
         where fingerprint = $1
           and coalesce(user_id::text, ip, '') = coalesce($2::text, $3, '')
           and resolved_at is null
           and last_seen_at > now() - make_interval(mins => $4)
         order by last_seen_at desc
         limit 1
       )
       returning ${ROW_COLUMNS}`,
      [fingerprint, userId, input.ip ?? null, DEDUPE_WINDOW_MINUTES]
    )
    if (bumped) return bumped

    const row = await pgQueryOne<CustomerErrorRow>(
      `insert into public.customer_error_reports
         (fingerprint, source, path, title, message, detail, digest, user_id, user_email, ip, user_agent, meta)
       values ($1, $2, $3, $4, $5, $6, $7, $8::uuid, $9, $10, $11, $12::jsonb)
       returning ${ROW_COLUMNS}`,
      [
        fingerprint,
        input.source,
        path,
        title || null,
        message || title,
        clipText(input.detail, L.detail) || null,
        clipText(input.digest, L.digest) || null,
        userId,
        clipText(input.userEmail, 320) || null,
        clipText(input.ip, 64) || null,
        clipText(input.userAgent, L.userAgent) || null,
        JSON.stringify(input.meta ?? {}),
      ]
    )
    if (row) {
      await emailAdmins(row).catch((e) =>
        console.warn('[customer-error-report] email', e instanceof Error ? e.message : e)
      )
    }
    return row
  } catch (e) {
    console.warn('[customer-error-report] insert', e instanceof Error ? e.message : e)
    return null
  }
}

export type CustomerErrorListFilter = {
  id?: string | null
  status: 'open' | 'resolved' | 'all'
  source: CustomerErrorSource | null
  q: string
  page: number
  pageSize: number
}

export async function pgListCustomerErrorReports(filter: CustomerErrorListFilter): Promise<{
  rows: CustomerErrorRow[]
  total: number
  stats: { open: number; today: number; emailedToday: number }
  error: string | null
}> {
  const empty = { rows: [], total: 0, stats: { open: 0, today: 0, emailedToday: 0 } }
  if (!isPgConfigured()) return { ...empty, error: 'DATABASE_URL not set' }
  const where: string[] = []
  const params: unknown[] = []
  if (filter.id && /^\d+$/.test(filter.id)) {
    params.push(filter.id)
    where.push(`id = $${params.length}::bigint`)
  }
  if (filter.status === 'open') where.push('resolved_at is null')
  if (filter.status === 'resolved') where.push('resolved_at is not null')
  if (filter.source) {
    params.push(filter.source)
    where.push(`source = $${params.length}`)
  }
  const q = filter.q.trim()
  if (q) {
    params.push(`%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`)
    const i = params.length
    where.push(`(message ilike $${i} or coalesce(path, '') ilike $${i} or coalesce(user_email, '') ilike $${i})`)
  }
  const whereSql = where.length ? `where ${where.join(' and ')}` : ''
  try {
    const [countRow, rows, stats] = await Promise.all([
      pgQueryOne<{ n: number }>(`select count(*)::int as n from public.customer_error_reports ${whereSql}`, params),
      pgQuery<CustomerErrorRow>(
        `select ${ROW_COLUMNS} from public.customer_error_reports ${whereSql}
         order by last_seen_at desc
         limit $${params.length + 1} offset $${params.length + 2}`,
        [...params, filter.pageSize, (filter.page - 1) * filter.pageSize]
      ),
      pgQueryOne<{ open: number; today: number; emailed_today: number }>(
        `select
           count(*) filter (where resolved_at is null)::int as open,
           count(*) filter (where last_seen_at >= date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh')::int as today,
           count(*) filter (where emailed_at >= date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh')::int as emailed_today
         from public.customer_error_reports`
      ),
    ])
    return {
      rows,
      total: countRow?.n ?? 0,
      stats: { open: stats?.open ?? 0, today: stats?.today ?? 0, emailedToday: stats?.emailed_today ?? 0 },
      error: null,
    }
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function pgSetCustomerErrorResolved(ids: string[], resolved: boolean, adminId: string): Promise<number> {
  const clean = ids.filter((id) => /^\d+$/.test(id))
  if (!clean.length) return 0
  const rows = await pgQuery<{ id: string }>(
    resolved
      ? `update public.customer_error_reports set resolved_at = now(), resolved_by = $2::uuid
         where id = any($1::bigint[]) and resolved_at is null returning id::text`
      : `update public.customer_error_reports set resolved_at = null, resolved_by = null
         where id = any($1::bigint[]) and resolved_at is not null returning id::text`,
    resolved ? [clean, adminId] : [clean]
  )
  return rows.length
}

export async function pgDeleteResolvedCustomerErrors(): Promise<number> {
  const rows = await pgQuery<{ id: string }>(
    `delete from public.customer_error_reports where resolved_at is not null returning id::text`
  )
  return rows.length
}
