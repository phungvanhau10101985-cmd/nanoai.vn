import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'

export async function fetchSessionMemoryPinnedFactsJsonPg(
  userId: string,
  sessionId: string
): Promise<
  | { ok: true; pinned_facts_json: string }
  | { ok: false; notFound: boolean; message?: string }
> {
  if (!isPgConfigured()) return { ok: false, notFound: false, message: 'Database not configured' }
  try {
    const row = await pgQueryOne<{ pinned_facts_json: string }>(
      `select pinned_facts_json
       from public.language_coach_session_memories
       where user_id = $1::uuid and session_id = $2::uuid
       limit 1`,
      [userId, sessionId]
    )
    if (!row) return { ok: false, notFound: true }
    return { ok: true, pinned_facts_json: row.pinned_facts_json }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-session-memory-pg] fetchSessionMemoryPinnedFactsJsonPg', e)
    return { ok: false, notFound: false, message: msg }
  }
}

export async function updateSessionMemoryPinnedFactsPg(
  userId: string,
  sessionId: string,
  pinnedFactsJson: string,
  updatedAtIso: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const pool = getPgPool()
    const res = await pool.query(
      `update public.language_coach_session_memories
       set pinned_facts_json = $3, updated_at = $4::timestamptz
       where user_id = $1::uuid and session_id = $2::uuid`,
      [userId, sessionId, pinnedFactsJson, updatedAtIso]
    )
    if (!res.rowCount) {
      return { ok: false, message: 'Không tìm thấy buổi học để cập nhật.' }
    }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-session-memory-pg] updateSessionMemoryPinnedFactsPg', e)
    return { ok: false, message: msg || 'Không lưu được mini stage.' }
  }
}
