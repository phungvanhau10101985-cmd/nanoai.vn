import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import {
  isGuestCreationAudioUrl,
  isGuestCreationImageUrl,
  type GuestCreationRefs,
} from '@/lib/guest-creations/extract-guest-creation'
import { TRY_ON_HISTORY_INPUT_PLACEHOLDER_SRC } from '@/lib/try-on-history-placeholder'
import { isValidUuidString } from '@/lib/validate-uuid'

const GUEST_EMAIL_SQL = `lower(coalesce(u.email, '')) like 'guest-trial-%@guest.nanoai.local'`

const REF_TABLES: Record<keyof GuestCreationRefs, string> = {
  threadId: 'hub_chat_threads',
  projectId: 'house_build_projects',
  cardId: 'wedding_cards',
  historyId: 'try_on_history',
  curriculumId: 'worksheet_curricula',
  jobId: 'worksheet_jobs',
}

export type GuestCreationClaimItem = {
  resultUrls: string[]
  refs: GuestCreationRefs
  feature: string
  route: string
  createdAt: number
}

export function parseGuestCreationClaimItems(raw: unknown): GuestCreationClaimItem[] {
  if (!raw || typeof raw !== 'object') return []
  const items = (raw as { items?: unknown }).items
  if (!Array.isArray(items)) return []
  const out: GuestCreationClaimItem[] = []
  for (const item of items.slice(0, 80)) {
    if (!item || typeof item !== 'object') continue
    const row = item as Partial<GuestCreationClaimItem>
    const resultUrls = Array.isArray(row.resultUrls)
      ? row.resultUrls
          .map((url) => (typeof url === 'string' ? url.trim() : ''))
          .filter(isClaimableOutputUrl)
          .slice(0, 8)
      : []
    const refs = sanitizeRefs(row.refs)
    if (!resultUrls.length && !Object.keys(refs).length) continue
    const feature = String(row.feature || row.route || 'guest')
      .replace(/[^a-z0-9_-]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'guest'
    out.push({
      resultUrls,
      refs,
      feature,
      route: String(row.route || '').slice(0, 180),
      createdAt: Number(row.createdAt) || Date.now(),
    })
  }
  return out
}

export async function claimGuestCreationsForUser(
  userId: string,
  items: GuestCreationClaimItem[]
): Promise<{ moved: number; inserted: number }> {
  if (!isPgConfigured() || !isValidUuidString(userId) || !items.length) return { moved: 0, inserted: 0 }
  const pool = getPgPool()
  const client = await pool.connect()
  let moved = 0
  let inserted = 0
  try {
    await client.query('BEGIN')
    let step = 0
    for (const item of items) {
      for (const [key, id] of Object.entries(item.refs) as [keyof GuestCreationRefs, string | undefined][]) {
        if (!id || !isValidUuidString(id)) continue
        const table = REF_TABLES[key]
        const count = await runClaimStep(client, step, async () => {
          const res = await client.query(
            `update public.${table} t
             set user_id = $1::uuid
             from auth.users u
             where t.id = $2::uuid
               and t.user_id = u.id
               and ${GUEST_EMAIL_SQL}`,
            [userId, id]
          )
          return res.rowCount ?? 0
        })
        step += 1
        if (count) moved += count
      }
      for (const url of item.resultUrls) {
        const imageMoved = await runClaimStep(client, step, () =>
          moveGuestUrl(client, 'try_on_history', 'result_image_url', userId, url)
        )
        step += 1
        const audioMoved = await runClaimStep(client, step, () =>
          moveGuestUrl(client, 'music_generations', 'audio_url', userId, url)
        )
        step += 1
        const coachMoved = await runClaimStep(client, step, () =>
          moveGuestUrl(client, 'language_coach_messages', 'audio_url', userId, url)
        )
        step += 1
        if (imageMoved == null || audioMoved == null || coachMoved == null) continue
        moved += imageMoved + audioMoved + coachMoved
        if (imageMoved + audioMoved + coachMoved > 0) continue
        const already = await runClaimStep(client, step, async () => (await outputUrlAlreadyStored(client, url) ? 1 : 0))
        step += 1
        if (already == null || already > 0) continue
        if (isGuestCreationImageUrl(url)) {
          const wrote = await runClaimStep(client, step, async () => {
            await client.query(
              `insert into public.try_on_history (
                 user_id, original_image_url, garment_image_url, result_image_url, status, feature
               ) values ($1::uuid, $2, $3, $4, 'completed', $5)`,
              [userId, TRY_ON_HISTORY_INPUT_PLACEHOLDER_SRC, TRY_ON_HISTORY_INPUT_PLACEHOLDER_SRC, url, item.feature]
            )
            return 1
          })
          step += 1
          if (wrote) inserted += wrote
        } else if (isGuestCreationAudioUrl(url)) {
          const wrote = await runClaimStep(client, step, async () => {
            await client.query(
              `insert into public.music_generations (
                 user_id, mode, title, style, duration_seconds, charged_credits, audio_url
               ) values ($1::uuid, 'lyria3', $2, '', 0, 0, $3)`,
              [userId, item.feature || 'Lyria', url]
            )
            return 1
          })
          step += 1
          if (wrote) inserted += wrote
        }
      }
    }
    await client.query('COMMIT')
    return { moved, inserted }
  } catch (e) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // noop
    }
    console.warn('[guest-creations] claim failed', e)
    throw e
  } finally {
    client.release()
  }
}

async function runClaimStep(
  client: import('pg').PoolClient,
  step: number,
  run: () => Promise<number>
): Promise<number | null> {
  const savepoint = `guest_claim_${step}`
  await client.query(`SAVEPOINT ${savepoint}`)
  try {
    const count = await run()
    await client.query(`RELEASE SAVEPOINT ${savepoint}`)
    return count
  } catch (e) {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`)
    await client.query(`RELEASE SAVEPOINT ${savepoint}`)
    console.warn('[guest-creations] skip claim step', e instanceof Error ? e.message : e)
    return null
  }
}

function sanitizeRefs(raw: unknown): GuestCreationRefs {
  const refs: GuestCreationRefs = {}
  if (!raw || typeof raw !== 'object') return refs
  const row = raw as GuestCreationRefs
  for (const key of Object.keys(REF_TABLES) as (keyof GuestCreationRefs)[]) {
    const id = String(row[key] ?? '').trim()
    if (isValidUuidString(id)) refs[key] = id
  }
  return refs
}

function isClaimableOutputUrl(url: string): boolean {
  if (!/^https:\/\//i.test(url) || url.length > 2000) return false
  try {
    const path = new URL(url).pathname
    return /\/(?:results|uploads|music-history|english-coach-history)\//.test(path)
  } catch {
    return false
  }
}

async function moveGuestUrl(
  client: import('pg').PoolClient,
  table: string,
  column: string,
  userId: string,
  url: string
): Promise<number> {
  const res = await client.query(
    `update public.${table} t
     set user_id = $1::uuid
     from auth.users u
     where t.${column} = $2
       and t.user_id = u.id
       and ${GUEST_EMAIL_SQL}`,
    [userId, url]
  )
  return res.rowCount ?? 0
}

async function outputUrlAlreadyStored(client: import('pg').PoolClient, url: string): Promise<boolean> {
  const found = await client.query(
    `select 1
     where exists (select 1 from public.try_on_history where result_image_url = $1)
        or exists (select 1 from public.music_generations where audio_url = $1)
        or exists (select 1 from public.language_coach_messages where audio_url = $1)
     limit 1`,
    [url]
  )
  return (found.rowCount ?? 0) > 0
}
