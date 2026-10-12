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
    const row = await pgQueryOne<{ id: string }>(
      `insert into public.tutor_sessions (user_id, locale)
       values ($1::uuid, $2)
       on conflict (user_id) do update
         set locale = excluded.locale, updated_at = now()
       returning id::text`,
      [userId, locale]
    )
    return row?.id ?? null
  } catch (error) {
    console.warn('[ai-tutor] session', error instanceof Error ? error.message : error)
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
