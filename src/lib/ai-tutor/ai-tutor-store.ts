import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { foldTutorTitle } from '@/lib/ai-tutor/ai-tutor-match'
import { parseStoredTutorAnswer, parseTutorLabels } from '@/lib/ai-tutor/ai-tutor-parse'
import type { TutorAnswer, TutorLabel, TutorThreadMessage } from '@/lib/ai-tutor/ai-tutor-types'

type TopicRow = {
  topic_key: string
  title: string
  explanation: string
  practice: string
  labels: unknown
}

type MessageRow = {
  id: string
  role: 'user' | 'tutor'
  body: string
  topic_key: string
  kind: 'question' | 'label' | 'answer'
  payload: unknown
  created_at: Date | string
}

function asIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString()
  return String(value ?? '')
}

function asAnswer(row: TopicRow, share: TutorAnswer['share']): TutorAnswer {
  return {
    topicKey: row.topic_key,
    title: row.title,
    explanation: row.explanation,
    practice: row.practice,
    labels: parseTutorLabels(row.labels),
    share,
  }
}

export async function ensureTutorSession(userId: string, locale: string): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const current = await pgQueryOne<{ id: string }>(
      `select id::text
       from public.tutor_sessions
       where user_id = $1::uuid
       order by updated_at desc
       limit 1`,
      [userId]
    )
    if (current?.id) {
      await pgQuery(`update public.tutor_sessions set locale = $2 where id = $1::uuid`, [current.id, locale])
      return current.id
    }
    const created = await pgQueryOne<{ id: string }>(
      `insert into public.tutor_sessions (user_id, locale)
       values ($1::uuid, $2)
       returning id::text`,
      [userId, locale]
    )
    return created?.id ?? null
  } catch (error) {
    console.warn('[ai-tutor] session', error instanceof Error ? error.message : error)
    return null
  }
}

/** Hội thoại trống thì dùng lại. Đã có chữ thì mở một phiên mới. */
export async function startTutorSession(userId: string, locale: string): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const latest = await pgQueryOne<{ id: string; n: number }>(
      `select s.id::text,
              (select count(*)::int from public.tutor_messages m where m.session_id = s.id) as n
       from public.tutor_sessions s
       where s.user_id = $1::uuid
       order by s.updated_at desc
       limit 1`,
      [userId]
    )
    if (latest?.id && latest.n === 0) {
      await pgQuery(
        `update public.tutor_sessions set locale = $2, updated_at = now() where id = $1::uuid`,
        [latest.id, locale]
      )
      return latest.id
    }
    const created = await pgQueryOne<{ id: string }>(
      `insert into public.tutor_sessions (user_id, locale)
       values ($1::uuid, $2)
       returning id::text`,
      [userId, locale]
    )
    return created?.id ?? null
  } catch (error) {
    console.warn('[ai-tutor] new session', error instanceof Error ? error.message : error)
    return null
  }
}

export async function listTutorSessions(userId: string): Promise<
  Array<{ id: string; preview: string; updatedAt: string; messageCount: number }>
> {
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
                from public.tutor_messages m
                where m.session_id = s.id and m.role = 'user'
                order by m.created_at asc
                limit 1
              ), '') as preview,
              s.updated_at,
              (select count(*)::int from public.tutor_messages m where m.session_id = s.id) as message_count
       from public.tutor_sessions s
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
    console.warn('[ai-tutor] session list', error instanceof Error ? error.message : error)
    return []
  }
}

/** Đưa hội thoại này lên hiện tại rồi đọc tin. Không thuộc học sinh thì trả null. */
export async function openTutorSession(userId: string, sessionId: string): Promise<TutorThreadMessage[] | null> {
  if (!isPgConfigured() || !sessionId) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `update public.tutor_sessions
       set updated_at = now()
       where id = $1::uuid and user_id = $2::uuid
       returning id::text`,
      [sessionId, userId]
    )
    if (!row?.id) return null
    return listTutorMessages(row.id)
  } catch (error) {
    console.warn('[ai-tutor] open session', error instanceof Error ? error.message : error)
    return null
  }
}

export async function listTutorTopicCatalog(
  locale: string
): Promise<Array<{ topicKey: string; title: string }>> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<{ topic_key: string; title: string }>(
      `select topic_key, title
       from public.tutor_topics
       where locale = $1
       order by usage_count desc, last_used_at desc
       limit 40`,
      [locale]
    )
    return rows.map((row) => ({ topicKey: row.topic_key, title: row.title }))
  } catch (error) {
    console.warn('[ai-tutor] catalog', error instanceof Error ? error.message : error)
    return []
  }
}

/** Mọi chủ đề của một ngôn ngữ, bản ghi trước đứng trước để trùng tên lấy bản đầu. */
export async function listTutorTopicNames(
  locale: string
): Promise<Array<{ topicKey: string; title: string }>> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<{ topic_key: string; title: string }>(
      `select topic_key, title
       from public.tutor_topics
       where locale = $1
       order by created_at asc`,
      [locale]
    )
    return rows.map((row) => ({ topicKey: row.topic_key, title: row.title }))
  } catch (error) {
    console.warn('[ai-tutor] topic names', error instanceof Error ? error.message : error)
    return []
  }
}

export async function fetchTutorTopic(topicKey: string, locale: string): Promise<TutorAnswer | null> {
  if (!isPgConfigured() || !topicKey) return null
  try {
    const row = await pgQueryOne<TopicRow>(
      `select topic_key, title, explanation, practice, labels
       from public.tutor_topics
       where topic_key = $1 and locale = $2
       limit 1`,
      [topicKey, locale]
    )
    return row ? asAnswer(row, 'reused') : null
  } catch (error) {
    console.warn('[ai-tutor] topic read', error instanceof Error ? error.message : error)
    return null
  }
}

export async function touchTutorTopic(topicKey: string, locale: string): Promise<void> {
  if (!isPgConfigured()) return
  try {
    await pgQuery(
      `update public.tutor_topics
       set usage_count = usage_count + 1, last_used_at = now(), updated_at = now()
       where topic_key = $1 and locale = $2`,
      [topicKey, locale]
    )
  } catch (error) {
    console.warn('[ai-tutor] topic touch', error instanceof Error ? error.message : error)
  }
}

/** Bản đầu đã kiểm tra thì giữ. Lần sau không ghi đè. */
export async function rememberTutorTopic(input: {
  topicKey: string
  locale: string
  title: string
  explanation: string
  practice: string
  labels: TutorLabel[]
  draftModel: string
  checkModel: string
}): Promise<TutorAnswer | null> {
  if (!isPgConfigured()) return null
  try {
    const named = await listTutorTopicNames(input.locale)
    const sameTitle = named.find((row) => foldTutorTitle(row.title) === foldTutorTitle(input.title))
    if (sameTitle) {
      await touchTutorTopic(sameTitle.topicKey, input.locale)
      return fetchTutorTopic(sameTitle.topicKey, input.locale)
    }
    const inserted = await pgQuery<{ topic_key: string }>(
      `insert into public.tutor_topics (
         topic_key, locale, title, explanation, practice, labels, draft_model, check_model
       ) values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
       on conflict (topic_key, locale) do nothing
       returning topic_key`,
      [
        input.topicKey,
        input.locale,
        input.title,
        input.explanation,
        input.practice,
        JSON.stringify(input.labels),
        input.draftModel,
        input.checkModel,
      ]
    )
    if (inserted.length > 0) {
      return {
        topicKey: input.topicKey,
        title: input.title,
        explanation: input.explanation,
        practice: input.practice,
        labels: input.labels,
        share: 'saved',
      }
    }
    const existing = await fetchTutorTopic(input.topicKey, input.locale)
    if (existing) await touchTutorTopic(input.topicKey, input.locale)
    return existing
  } catch (error) {
    console.warn('[ai-tutor] topic write', error instanceof Error ? error.message : error)
    return null
  }
}

export async function appendTutorMessage(input: {
  sessionId: string
  userId: string
  role: 'user' | 'tutor'
  body: string
  topicKey: string
  kind: 'question' | 'label' | 'answer'
  payload: TutorAnswer | Record<string, never>
}): Promise<void> {
  try {
    await pgQuery(
      `insert into public.tutor_messages (session_id, user_id, role, body, topic_key, kind, payload)
       values ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::jsonb)`,
      [
        input.sessionId,
        input.userId,
        input.role,
        input.body,
        input.topicKey,
        input.kind,
        JSON.stringify(input.payload),
      ]
    )
    await pgQuery(`update public.tutor_sessions set updated_at = now() where id = $1::uuid`, [input.sessionId])
  } catch (error) {
    console.warn('[ai-tutor] message write', error instanceof Error ? error.message : error)
  }
}

export async function listTutorMessages(sessionId: string): Promise<TutorThreadMessage[]> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<MessageRow>(
      `select id::text, role, body, topic_key, kind, payload, created_at
       from (
         select id, role, body, topic_key, kind, payload, created_at
         from public.tutor_messages
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
      topicKey: row.topic_key,
      kind: row.kind,
      answer: row.role === 'tutor' ? parseStoredTutorAnswer(row.payload, row.topic_key) : null,
      createdAt: asIso(row.created_at),
    }))
  } catch (error) {
    console.warn('[ai-tutor] message read', error instanceof Error ? error.message : error)
    return []
  }
}
