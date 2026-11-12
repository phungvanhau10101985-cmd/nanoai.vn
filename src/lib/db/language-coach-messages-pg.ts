import { shouldApplyDraftRevision } from '@/lib/english-coach/pending-speech-draft'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'

const MESSAGE_PATCH_COLS = new Set([
  'text',
  'translation',
  'main_sentence',
  'correction_note',
  'intent_answer',
  'tokens_json',
  'audio_url',
  'writing_task_json',
  'ai_payload_json',
])

function buildSetClause(updates: Record<string, string | null>): { fragment: string; values: unknown[] } | null {
  const parts: string[] = []
  const values: unknown[] = []
  let i = 1
  for (const [k, v] of Object.entries(updates)) {
    if (!MESSAGE_PATCH_COLS.has(k)) continue
    parts.push(`${k} = $${i++}`)
    values.push(v)
  }
  if (parts.length === 0) return null
  return { fragment: parts.join(', '), values }
}

export async function updateLanguageCoachMessagePartialByIdPg(
  userId: string,
  messageId: string,
  updates: Record<string, string | null>
): Promise<{ rowCount: number } | null> {
  if (!isPgConfigured()) return null
  const built = buildSetClause(updates)
  if (!built) return null
  try {
    const pool = getPgPool()
    if ('ai_payload_json' in updates) {
      const cur = await pool.query<{ ai_payload_json: string | null }>(
        `select ai_payload_json
         from public.language_coach_messages
         where id = $1::uuid and user_id = $2::uuid`,
        [messageId, userId]
      )
      if ((cur.rowCount ?? 0) > 0 && !shouldApplyDraftRevision(cur.rows[0]?.ai_payload_json, updates.ai_payload_json)) {
        return { rowCount: 1 }
      }
    }
    const n = built.values.length
    const sql = `update public.language_coach_messages
      set ${built.fragment}
      where id = $${n + 1}::uuid and user_id = $${n + 2}::uuid`
    const res = await pool.query(sql, [...built.values, messageId, userId])
    return { rowCount: res.rowCount ?? 0 }
  } catch (e) {
    console.error('[language-coach-messages-pg] updateLanguageCoachMessagePartialByIdPg', e)
    return null
  }
}

export async function updateLanguageCoachMessagePartialBySessionClientPg(
  userId: string,
  sessionId: string,
  clientMessageId: string,
  updates: Record<string, string | null>
): Promise<{ rowCount: number } | null> {
  if (!isPgConfigured()) return null
  const built = buildSetClause(updates)
  if (!built) return null
  try {
    const pool = getPgPool()
    if ('ai_payload_json' in updates) {
      const cur = await pool.query<{ ai_payload_json: string | null }>(
        `select ai_payload_json
         from public.language_coach_messages
         where session_id = $1::uuid and client_message_id = $2 and user_id = $3::uuid
         order by created_at asc
         limit 1`,
        [sessionId, clientMessageId, userId]
      )
      if ((cur.rowCount ?? 0) > 0 && !shouldApplyDraftRevision(cur.rows[0]?.ai_payload_json, updates.ai_payload_json)) {
        return { rowCount: 1 }
      }
    }
    const n = built.values.length
    const sql = `update public.language_coach_messages
      set ${built.fragment}
      where session_id = $${n + 1}::uuid
        and client_message_id = $${n + 2}
        and user_id = $${n + 3}::uuid`
    const res = await pool.query(sql, [...built.values, sessionId, clientMessageId, userId])
    return { rowCount: res.rowCount ?? 0 }
  } catch (e) {
    console.error('[language-coach-messages-pg] updateLanguageCoachMessagePartialBySessionClientPg', e)
    return null
  }
}
