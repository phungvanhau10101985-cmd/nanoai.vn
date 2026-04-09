import { getPgPool, isPgConfigured } from '@/lib/db/pool'

const MESSAGE_PATCH_COLS = new Set([
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
