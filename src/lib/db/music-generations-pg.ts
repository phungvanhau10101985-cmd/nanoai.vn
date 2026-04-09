import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'

function iso(v: unknown): string {
  if (v instanceof Date) return v.toISOString()
  return String(v ?? '')
}

export type MusicGenerationHistoryRowPg = {
  id: string
  mode: string
  title: string
  style: string
  duration_seconds: number
  charged_credits: number
  audio_url: string | null
  created_at: string
}

export async function insertMusicGenerationPg(input: {
  userId: string
  mode: string
  title: string
  style: string
  durationSeconds: number
  chargedCredits: number
  audioUrl: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const pool = getPgPool()
    const res = await pool.query(
      `insert into public.music_generations (
         user_id, mode, title, style, duration_seconds, charged_credits, audio_url
       ) values ($1::uuid, $2::text, $3::text, $4::text, $5::int, $6::numeric, $7::text)`,
      [
        input.userId,
        input.mode,
        input.title,
        input.style,
        input.durationSeconds,
        input.chargedCredits,
        input.audioUrl,
      ]
    )
    return (res.rowCount ?? 0) > 0
  } catch (e) {
    console.error('[music-generations-pg] insertMusicGenerationPg', e)
    return false
  }
}

export async function fetchMusicGenerationsForUserFromPg(
  userId: string,
  opts: { limit: number; mode?: string }
): Promise<MusicGenerationHistoryRowPg[] | null> {
  if (!isPgConfigured()) return null
  try {
    const mode = opts.mode?.trim()
    let sql = `select id::text, mode::text, title::text, style::text, duration_seconds,
                      charged_credits, audio_url::text, created_at
               from public.music_generations
               where user_id = $1::uuid`
    const params: unknown[] = mode ? [userId, mode, opts.limit] : [userId, opts.limit]
    if (mode) {
      sql += ` and mode = $2::text`
    }
    sql += ` order by created_at desc limit $${mode ? 3 : 2}`
    const rows = await pgQuery<{
      id: string
      mode: string
      title: string
      style: string
      duration_seconds: number
      charged_credits: string | number
      audio_url: string | null
      created_at: unknown
    }>(sql, params)
    return rows.map((r) => ({
      id: r.id,
      mode: r.mode,
      title: r.title,
      style: r.style,
      duration_seconds: Number(r.duration_seconds),
      charged_credits: Number(r.charged_credits),
      audio_url: r.audio_url,
      created_at: iso(r.created_at),
    }))
  } catch (e) {
    console.error('[music-generations-pg] fetchMusicGenerationsForUserFromPg', e)
    return null
  }
}
