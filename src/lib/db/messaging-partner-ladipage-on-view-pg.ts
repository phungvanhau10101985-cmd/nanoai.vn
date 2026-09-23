import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type LadipageOnViewJob = {
  id: string
  partnerId: string
  inventoryId: string
  attempts: number
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim())
}

/** True when this inventory already has a 1-product landing (draft or published). */
export async function partnerHasSingleProductLandingPg(
  partnerId: string,
  inventoryId: string
): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pid = partnerId.trim()
  const iid = inventoryId.trim()
  if (!isUuid(pid) || !isUuid(iid)) return false
  const row = await pgQueryOne<{ id: string }>(
    `select id::text
     from public.messaging_partner_landing_pages
     where partner_id = $1::uuid
       and source_type = 'products'
       and inventory_ids = array[$2::uuid]::uuid[]
     limit 1`,
    [pid, iid]
  )
  return Boolean(row?.id)
}

/**
 * Queue generation after a product view. Skips inactive rows and products that
 * already have a 1-product landing. Does not throw on a duplicate pending job.
 */
export async function enqueueLadipageOnViewJobPg(input: {
  partnerId: string
  inventoryId: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pid = input.partnerId.trim()
  const iid = input.inventoryId.trim()
  if (!isUuid(pid) || !isUuid(iid)) return false
  const product = await pgQueryOne<{ is_active: boolean | null }>(
    `select is_active
     from public.messaging_partner_inventory
     where partner_id = $1::uuid and id = $2::uuid
     limit 1`,
    [pid, iid]
  )
  if (!product?.is_active) return false
  if (await partnerHasSingleProductLandingPg(pid, iid)) return false
  try {
    const inserted = await pgQuery<{ id: string }>(
      `insert into public.messaging_partner_ladipage_on_view_jobs (partner_id, inventory_id, status)
       select $1::uuid, $2::uuid, 'pending'
       where not exists (
         select 1 from public.messaging_partner_ladipage_on_view_jobs
         where partner_id = $1::uuid
           and inventory_id = $2::uuid
           and status in ('pending', 'running')
       )
       returning id::text`,
      [pid, iid]
    )
    return inserted.length > 0
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === '23505') return false
    console.warn('[enqueueLadipageOnViewJobPg]', e)
    return false
  }
}

export async function claimLadipageOnViewJobsPg(limit: number): Promise<LadipageOnViewJob[]> {
  if (!isPgConfigured()) return []
  const n = Math.max(1, Math.min(4, Math.round(limit) || 1))
  const client = await getPgPool().connect()
  try {
    await client.query('begin')
    await client.query(
      `update public.messaging_partner_ladipage_on_view_jobs
       set status = case when attempts >= 3 then 'error' else 'pending' end,
           last_error = case when attempts >= 3 then coalesce(last_error, 'stale running') else last_error end,
           updated_at = timezone('utc', now())
       where status = 'running'
         and claimed_at < timezone('utc', now()) - interval '15 minutes'`
    )
    const claimed = await client.query<{
      id: string
      partner_id: string
      inventory_id: string
      attempts: number
    }>(
      `with next as (
         select id
         from public.messaging_partner_ladipage_on_view_jobs
         where status = 'pending'
         order by created_at asc
         for update skip locked
         limit $1
       )
       update public.messaging_partner_ladipage_on_view_jobs j
       set status = 'running',
           claimed_at = timezone('utc', now()),
           attempts = j.attempts + 1,
           updated_at = timezone('utc', now())
       from next
       where j.id = next.id
       returning j.id::text, j.partner_id::text, j.inventory_id::text, j.attempts`,
      [n]
    )
    await client.query('commit')
    return claimed.rows.map((row) => ({
      id: row.id,
      partnerId: row.partner_id,
      inventoryId: row.inventory_id,
      attempts: Number(row.attempts) || 1,
    }))
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {
      /* ignore */
    }
    console.warn('[claimLadipageOnViewJobsPg]', e)
    return []
  } finally {
    client.release()
  }
}

export async function finishLadipageOnViewJobPg(input: {
  id: string
  status: 'done' | 'error' | 'skipped' | 'pending'
  lastError?: string | null
}): Promise<void> {
  if (!isPgConfigured() || !isUuid(input.id)) return
  await pgQuery(
    `update public.messaging_partner_ladipage_on_view_jobs
     set status = $2,
         last_error = $3,
         updated_at = timezone('utc', now())
     where id = $1::uuid`,
    [input.id.trim(), input.status, input.lastError?.slice(0, 2000) || null]
  )
}

export async function fetchActiveInventoryNamePg(
  partnerId: string,
  inventoryId: string
): Promise<string | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<{ name: string | null; is_active: boolean | null }>(
    `select name, is_active
     from public.messaging_partner_inventory
     where partner_id = $1::uuid and id = $2::uuid
     limit 1`,
    [partnerId.trim(), inventoryId.trim()]
  )
  if (!row?.is_active) return null
  const name = String(row.name || '').trim()
  return name || 'Sản phẩm'
}

/** Drop the 1-product landing and any queued job when the inventory row is deleted. */
export async function deleteSingleProductLandingsForInventoryFromPg(
  partnerId: string,
  inventoryIds: string[]
): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pid = partnerId.trim()
  const ids = inventoryIds.map((id) => id.trim()).filter(isUuid)
  if (!isUuid(pid) || ids.length === 0) return true
  try {
    await pgQuery(
      `delete from public.messaging_partner_landing_pages
       where partner_id = $1::uuid
         and source_type = 'products'
         and cardinality(inventory_ids) = 1
         and inventory_ids[1] = any($2::uuid[])`,
      [pid, ids]
    )
    await pgQuery(
      `delete from public.messaging_partner_ladipage_on_view_jobs
       where partner_id = $1::uuid and inventory_id = any($2::uuid[])`,
      [pid, ids]
    )
    return true
  } catch (e) {
    console.warn('[deleteSingleProductLandingsForInventoryFromPg]', e)
    return false
  }
}
