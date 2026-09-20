import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { bunnyStorageConfigured, deleteBunnyStorageObject } from '@/lib/storage/try-on-public-upload'

export type PendingBunnyDeleteEnqueueItem = {
  storagePath: string
  sourceUrl: string
  partnerId?: string | null
  inventoryId?: string | null
}

export type ProcessPendingBunnyDeletesResult = {
  claimed: number
  deleted: number
  failed: number
  skippedConfig: boolean
  remainingPending: number
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function bunnyDeleteCronBatchSize(): number {
  const n = Number(process.env.BUNNY_DELETE_CRON_BATCH_SIZE || '80')
  if (!Number.isFinite(n)) return 80
  return Math.max(1, Math.min(500, Math.floor(n)))
}

function bunnyDeleteMaxAttempts(): number {
  const n = Number(process.env.BUNNY_DELETE_MAX_ATTEMPTS || '8')
  if (!Number.isFinite(n)) return 8
  return Math.max(1, Math.min(50, Math.floor(n)))
}

/** Ghi path unique. Pending đã có → bỏ qua. Failed → xếp lại. */
export async function enqueuePendingBunnyDeletesFromPg(
  items: PendingBunnyDeleteEnqueueItem[]
): Promise<number> {
  if (!isPgConfigured() || items.length === 0) return 0
  const uniq = new Map<string, PendingBunnyDeleteEnqueueItem>()
  for (const item of items) {
    const storagePath = item.storagePath.trim()
    if (!storagePath || storagePath.includes('..')) continue
    if (!uniq.has(storagePath)) uniq.set(storagePath, { ...item, storagePath })
  }
  if (!uniq.size) return 0

  const rows = [...uniq.values()]
  const params: unknown[] = []
  const values: string[] = []
  let p = 1
  for (const row of rows) {
    const partnerId = row.partnerId?.trim() && UUID_RE.test(row.partnerId.trim()) ? row.partnerId.trim() : null
    const inventoryId =
      row.inventoryId?.trim() && UUID_RE.test(row.inventoryId.trim()) ? row.inventoryId.trim() : null
    values.push(
      `($${p++}::text, $${p++}::text, $${p++}::uuid, $${p++}::uuid, 'pending', 0, now())`
    )
    params.push(row.storagePath, row.sourceUrl.slice(0, 4000), partnerId, inventoryId)
  }

  const result = await getPgPool().query(
    `insert into public.messaging_partner_pending_bunny_deletes
       (storage_path, source_url, partner_id, inventory_id, status, attempts, next_attempt_at)
     values ${values.join(', ')}
     on conflict (storage_path) do update set
       status = 'pending',
       next_attempt_at = now(),
       last_error = null,
       partner_id = coalesce(public.messaging_partner_pending_bunny_deletes.partner_id, excluded.partner_id),
       inventory_id = coalesce(public.messaging_partner_pending_bunny_deletes.inventory_id, excluded.inventory_id),
       source_url = coalesce(excluded.source_url, public.messaging_partner_pending_bunny_deletes.source_url),
       updated_at = now()
     where public.messaging_partner_pending_bunny_deletes.status = 'failed'`,
    params
  )
  return result.rowCount ?? 0
}

type ClaimedRow = { id: string; storage_path: string; attempts: number }

export async function processPendingBunnyDeletesFromPg(
  limit?: number
): Promise<ProcessPendingBunnyDeletesResult> {
  const skipped: ProcessPendingBunnyDeletesResult = {
    claimed: 0,
    deleted: 0,
    failed: 0,
    skippedConfig: true,
    remainingPending: 0,
  }
  if (!isPgConfigured()) return skipped
  if (!bunnyStorageConfigured()) {
    const remaining = await countPendingBunnyDeletesFromPg()
    return { ...skipped, remainingPending: remaining }
  }

  const batch = Math.max(1, Math.min(500, Math.floor(limit ?? bunnyDeleteCronBatchSize())))
  const maxAttempts = bunnyDeleteMaxAttempts()

  const claimed = await pgQuery<ClaimedRow>(
    `with due as (
       select id
       from public.messaging_partner_pending_bunny_deletes
       where status = 'pending'
         and next_attempt_at <= now()
         and attempts < $2::int
       order by id
       for update skip locked
       limit $1::int
     )
     update public.messaging_partner_pending_bunny_deletes t
        set attempts = t.attempts + 1,
            updated_at = now()
       from due
      where t.id = due.id
      returning t.id::text as id, t.storage_path, t.attempts`,
    [batch, maxAttempts]
  )

  let deleted = 0
  let failed = 0
  for (const row of claimed) {
    const path = String(row.storage_path || '').trim()
    if (!path || path.includes('..')) {
      await markBunnyDeleteFailedFromPg(row.id, 'invalid storage_path')
      failed += 1
      continue
    }
    try {
      const ok = await deleteBunnyStorageObject(path)
      if (ok) {
        await pgQuery(`delete from public.messaging_partner_pending_bunny_deletes where id = $1::uuid`, [row.id])
        deleted += 1
      } else {
        await markBunnyDeleteRetryOrFailedFromPg(
          row.id,
          Number(row.attempts) || 1,
          'Bunny DELETE không thành công (HTTP không 200/204/404)',
          maxAttempts
        )
        failed += 1
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await markBunnyDeleteRetryOrFailedFromPg(row.id, Number(row.attempts) || 1, msg.slice(0, 1000), maxAttempts)
      failed += 1
    }
  }

  const remainingPending = await countPendingBunnyDeletesFromPg()
  if (deleted || failed) {
    console.info('[pending-bunny-deletes]', { claimed: claimed.length, deleted, failed, remainingPending })
  }
  return {
    claimed: claimed.length,
    deleted,
    failed,
    skippedConfig: false,
    remainingPending,
  }
}

async function countPendingBunnyDeletesFromPg(): Promise<number> {
  const row = await pgQueryOne<{ n: string | number }>(
    `select count(*)::int as n from public.messaging_partner_pending_bunny_deletes where status = 'pending'`
  )
  return Math.max(0, Number(row?.n) || 0)
}

async function markBunnyDeleteFailedFromPg(id: string, error: string): Promise<void> {
  await pgQuery(
    `update public.messaging_partner_pending_bunny_deletes
     set status = 'failed', last_error = $2, next_attempt_at = now(), updated_at = now()
     where id = $1::uuid`,
    [id, error]
  )
}

async function markBunnyDeleteRetryOrFailedFromPg(
  id: string,
  attempts: number,
  error: string,
  maxAttempts: number
): Promise<void> {
  if (attempts >= maxAttempts) {
    await markBunnyDeleteFailedFromPg(id, error)
    return
  }
  const delaySec = Math.min(3600, 60 * 2 ** Math.max(0, attempts - 1))
  await pgQuery(
    `update public.messaging_partner_pending_bunny_deletes
     set status = 'pending',
         last_error = $2,
         next_attempt_at = now() + ($3::int * interval '1 second'),
         updated_at = now()
     where id = $1::uuid`,
    [id, error, delaySec]
  )
}
