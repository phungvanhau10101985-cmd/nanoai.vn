import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import type { HomeworkGuide } from '@/lib/homework-help/homework-help-guide'
import {
  homeworkImageCount,
  parseHomeworkThreadProblem,
  type HomeworkSessionSummary,
  type HomeworkThreadMessage,
} from '@/lib/homework-help/homework-help-thread'

type MessageRow = {
  id: string
  role: 'user' | 'teacher'
  body: string
  kind: 'question' | 'photo' | 'problem' | 'note'
  payload: unknown
  created_at: Date | string
}

function asIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString()
  return String(value ?? '')
}

export async function ensureHomeworkSession(userId: string, locale: string): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const current = await pgQueryOne<{ id: string }>(
      `select id::text
       from public.homework_sessions
       where user_id = $1::uuid
       order by updated_at desc
       limit 1`,
      [userId]
    )
    if (current?.id) {
      await pgQuery(`update public.homework_sessions set locale = $2 where id = $1::uuid`, [current.id, locale])
      return current.id
    }
    const created = await pgQueryOne<{ id: string }>(
      `insert into public.homework_sessions (user_id, locale)
       values ($1::uuid, $2)
       returning id::text`,
      [userId, locale]
    )
    return created?.id ?? null
  } catch (error) {
    console.warn('[homework-help] session', error instanceof Error ? error.message : error)
    return null
  }
}

/** Hội thoại trống thì dùng lại. Đã có chữ thì mở một phiên mới. */
export async function startHomeworkSession(userId: string, locale: string): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const latest = await pgQueryOne<{ id: string; n: number }>(
      `select s.id::text,
              (select count(*)::int from public.homework_messages m where m.session_id = s.id) as n
       from public.homework_sessions s
       where s.user_id = $1::uuid
       order by s.updated_at desc
       limit 1`,
      [userId]
    )
    if (latest?.id && latest.n === 0) {
      await pgQuery(
        `update public.homework_sessions set locale = $2, updated_at = now() where id = $1::uuid`,
        [latest.id, locale]
      )
      return latest.id
    }
    const created = await pgQueryOne<{ id: string }>(
      `insert into public.homework_sessions (user_id, locale)
       values ($1::uuid, $2)
       returning id::text`,
      [userId, locale]
    )
    return created?.id ?? null
  } catch (error) {
    console.warn('[homework-help] new session', error instanceof Error ? error.message : error)
    return null
  }
}

export async function listHomeworkSessions(userId: string): Promise<HomeworkSessionSummary[]> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<{
      id: string
      preview: string
      updated_at: Date | string
      message_count: number
    }>(
      `select s.id::text,
              coalesce((
                select m.body
                from public.homework_messages m
                where m.session_id = s.id and btrim(m.body) <> ''
                order by m.created_at asc
                limit 1
              ), '') as preview,
              s.updated_at,
              (select count(*)::int from public.homework_messages m where m.session_id = s.id) as message_count
       from public.homework_sessions s
       where s.user_id = $1::uuid
       order by s.updated_at desc
       limit 40`,
      [userId]
    )
    return rows
      .filter((row) => row.message_count > 0)
      .map((row) => ({
        id: row.id,
        preview: row.preview.trim(),
        updatedAt: asIso(row.updated_at),
        messageCount: row.message_count,
      }))
  } catch (error) {
    console.warn('[homework-help] session list', error instanceof Error ? error.message : error)
    return []
  }
}

/** Đưa hội thoại này lên hiện tại rồi đọc tin. Không thuộc học sinh thì trả null. */
export async function openHomeworkSession(
  userId: string,
  sessionId: string
): Promise<HomeworkThreadMessage[] | null> {
  if (!isPgConfigured() || !sessionId) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `update public.homework_sessions
       set updated_at = now()
       where id = $1::uuid and user_id = $2::uuid
       returning id::text`,
      [sessionId, userId]
    )
    if (!row?.id) return null
    return listHomeworkMessages(row.id)
  } catch (error) {
    console.warn('[homework-help] open session', error instanceof Error ? error.message : error)
    return null
  }
}

export async function listHomeworkMessages(sessionId: string): Promise<HomeworkThreadMessage[]> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<MessageRow>(
      `select id::text, role, body, kind, payload, created_at
       from (
         select id, role, body, kind, payload, created_at
         from public.homework_messages
         where session_id = $1::uuid
         order by created_at desc
         limit 80
       ) recent
       order by created_at asc`,
      [sessionId]
    )
    return rows.map((row) => ({
      id: row.id,
      role: row.role,
      body: row.body,
      kind: row.kind,
      imageCount: row.role === 'user' ? homeworkImageCount(row.payload) : 0,
      problem: row.kind === 'problem' ? parseHomeworkThreadProblem(row.payload) : null,
      createdAt: asIso(row.created_at),
    }))
  } catch (error) {
    console.warn('[homework-help] message read', error instanceof Error ? error.message : error)
    return []
  }
}

export async function appendHomeworkExchange(input: {
  sessionId: string
  userId: string
  text: string
  imageCount: number
  guide: HomeworkGuide
}): Promise<void> {
  try {
    const imageCount = Math.min(3, Math.max(0, Math.floor(input.imageCount)))
    await pgQuery(
      `insert into public.homework_messages (session_id, user_id, role, body, kind, payload)
       values ($1::uuid, $2::uuid, 'user', $3, $4, $5::jsonb)`,
      [
        input.sessionId,
        input.userId,
        input.text,
        imageCount > 0 ? 'photo' : 'question',
        JSON.stringify(imageCount > 0 ? { imageCount } : {}),
      ]
    )
    if (input.guide.problems.length === 0) {
      await pgQuery(
        `insert into public.homework_messages (session_id, user_id, role, body, kind, payload)
         values ($1::uuid, $2::uuid, 'teacher', $3, 'note', '{}'::jsonb)`,
        [input.sessionId, input.userId, input.guide.note]
      )
    } else {
      for (const problem of input.guide.problems) {
        await pgQuery(
          `insert into public.homework_messages (session_id, user_id, role, body, kind, payload)
           values ($1::uuid, $2::uuid, 'teacher', $3, 'problem', $4::jsonb)`,
          [input.sessionId, input.userId, problem.statement, JSON.stringify(problem)]
        )
      }
    }
    await pgQuery(`update public.homework_sessions set updated_at = now() where id = $1::uuid`, [input.sessionId])
  } catch (error) {
    console.warn('[homework-help] message write', error instanceof Error ? error.message : error)
  }
}
