import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import {
  countsFromListingItems,
  listingImportQueueTokenOk,
  type ListingImportDraft,
  type ListingImportQueuePayload,
  type ListingImportQueueRunSummary,
} from '@/lib/messaging/listing-import/listing-import-types'

type QueueDbRow = {
  partner_id: string
  queue_token: string
  payload_json: ListingImportQueuePayload | Record<string, unknown>
  created_by: string | null
  created_at: string
  updated_at: string
}

type DraftDbRow = {
  id: string
  partner_id: string
  job_id: string
  source: string
  source_url: string
  source_offer_id: string | null
  status: string
  message: string | null
  errors: unknown
  warnings: unknown
  raw_payload: Record<string, unknown> | null
  product_data: Record<string, unknown> | null
  published_inventory_id: string | null
  created_at: string
  updated_at: string
  finished_at: string | null
  published_remarketing_id?: string | null
}

function asStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => String(x ?? '')).filter(Boolean)
}

function asPayload(raw: unknown, token: string): ListingImportQueuePayload | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const rec = raw as Record<string, unknown>
  const items = Array.isArray(rec.items) ? rec.items : []
  return {
    queue_token: String(rec.queue_token || token),
    created_at: String(rec.created_at || ''),
    updated_at: String(rec.updated_at || ''),
    created_by: rec.created_by == null ? null : String(rec.created_by),
    run_status: (String(rec.run_status || 'idle') as ListingImportQueuePayload['run_status']) || 'idle',
    pause_requested: Boolean(rec.pause_requested),
    stop_requested: Boolean(rec.stop_requested),
    current_item_id: rec.current_item_id == null ? null : String(rec.current_item_id),
    worker_error: rec.worker_error == null ? null : String(rec.worker_error),
    items: items.filter((x) => x && typeof x === 'object') as ListingImportQueuePayload['items'],
  }
}

function mapDraft(row: DraftDbRow): ListingImportDraft {
  const remarketing = String(row.published_remarketing_id || '').trim()
  return {
    id: row.id,
    job_id: row.job_id,
    source: row.source,
    source_url: row.source_url,
    source_offer_id: row.source_offer_id,
    status: row.status,
    phase: row.status,
    message: row.message,
    errors: asStringList(row.errors),
    warnings: asStringList(row.warnings),
    raw_payload: row.raw_payload,
    product_data: row.product_data,
    published_inventory_id: row.published_inventory_id,
    published_product_id: remarketing || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    finished_at: row.finished_at,
  }
}

const DRAFT_SELECT = `
  d.id::text,
  d.partner_id::text,
  d.job_id,
  d.source,
  d.source_url,
  d.source_offer_id,
  d.status,
  d.message,
  d.errors,
  d.warnings,
  d.raw_payload,
  d.product_data,
  d.published_inventory_id::text,
  d.created_at::text,
  d.updated_at::text,
  d.finished_at::text,
  coalesce(mpi.remarketing_id, '') as published_remarketing_id
`

export async function isListingImportQueueRevokedFromPg(
  partnerId: string,
  token: string
): Promise<boolean> {
  if (!isPgConfigured() || !listingImportQueueTokenOk(token)) return false
  const row = await pgQueryOne<{ ok: number }>(
    `select 1 as ok
     from public.messaging_partner_listing_import_queue_revocations
     where partner_id = $1::uuid and queue_token = $2
     limit 1`,
    [partnerId, token]
  )
  return Boolean(row)
}

export async function loadListingImportQueueFromPg(
  partnerId: string,
  token: string
): Promise<ListingImportQueuePayload | null> {
  if (!isPgConfigured() || !listingImportQueueTokenOk(token)) return null
  const row = await pgQueryOne<QueueDbRow>(
    `select partner_id::text, queue_token, payload_json, created_by::text, created_at::text, updated_at::text
     from public.messaging_partner_listing_import_queues
     where partner_id = $1::uuid and queue_token = $2
     limit 1`,
    [partnerId, token]
  )
  if (!row) return null
  return asPayload(row.payload_json, token)
}

export async function saveListingImportQueueFromPg(
  partnerId: string,
  payload: ListingImportQueuePayload,
  createdBy?: string | null
): Promise<boolean> {
  if (!isPgConfigured() || !listingImportQueueTokenOk(payload.queue_token)) return false
  if (await isListingImportQueueRevokedFromPg(partnerId, payload.queue_token)) return false
  payload.updated_at = new Date().toISOString()
  await getPgPool().query(
    `insert into public.messaging_partner_listing_import_queues
       (partner_id, queue_token, payload_json, created_by, created_at, updated_at)
     values ($1::uuid, $2, $3::jsonb, $4::uuid, coalesce($5::timestamptz, now()), now())
     on conflict (partner_id, queue_token) do update set
       payload_json = excluded.payload_json,
       updated_at = now()`,
    [partnerId, payload.queue_token, JSON.stringify(payload), createdBy || payload.created_by || null, payload.created_at]
  )
  return true
}

export async function listListingImportQueueSummariesFromPg(
  partnerId: string,
  opts?: { limit?: number; offset?: number }
): Promise<{ items: ListingImportQueueRunSummary[]; total: number }> {
  if (!isPgConfigured()) return { items: [], total: 0 }
  const limit = Math.max(1, Math.min(200, opts?.limit ?? 50))
  const offset = Math.max(0, opts?.offset ?? 0)
  const countRow = await pgQueryOne<{ n: string }>(
    `select count(*)::text as n
     from public.messaging_partner_listing_import_queues
     where partner_id = $1::uuid`,
    [partnerId]
  )
  const rows = await pgQuery<QueueDbRow>(
    `select partner_id::text, queue_token, payload_json, created_by::text, created_at::text, updated_at::text
     from public.messaging_partner_listing_import_queues
     where partner_id = $1::uuid
     order by updated_at desc
     limit $2 offset $3`,
    [partnerId, limit, offset]
  )
  return {
    total: Number.parseInt(countRow?.n || '0', 10) || 0,
    items: rows.map((row) => {
      const pl = asPayload(row.payload_json, row.queue_token)
      const items = pl?.items || []
      return {
        queue_token: row.queue_token,
        created_at: row.created_at || pl?.created_at,
        updated_at: row.updated_at || pl?.updated_at,
        run_status: pl?.run_status || '',
        pause_requested: Boolean(pl?.pause_requested),
        stop_requested: Boolean(pl?.stop_requested),
        worker_alive: false,
        counts: countsFromListingItems(items),
      }
    }),
  }
}

export async function listListingImportQueuesNeedingResumeFromPg(): Promise<
  Array<{ partnerId: string; queueToken: string }>
> {
  if (!isPgConfigured()) return []
  const rows = await pgQuery<{ partner_id: string; queue_token: string; payload_json: ListingImportQueuePayload }>(
    `select q.partner_id::text, q.queue_token, q.payload_json
     from public.messaging_partner_listing_import_queues q
     where not exists (
       select 1 from public.messaging_partner_listing_import_queue_revocations r
       where r.partner_id = q.partner_id and r.queue_token = q.queue_token
     )
       and coalesce(q.payload_json->>'stop_requested', 'false') not in ('true', 'True')
       and coalesce(q.payload_json->>'pause_requested', 'false') not in ('true', 'True')
       and coalesce(q.payload_json->>'run_status', '') in ('running', 'pausing', 'paused', 'idle')`
  )
  const out: Array<{ partnerId: string; queueToken: string }> = []
  for (const row of rows) {
    const pl = asPayload(row.payload_json, row.queue_token)
    if (!pl || pl.stop_requested || pl.pause_requested || pl.run_status === 'stopped') continue
    const hasPending = (pl.items || []).some((it) => it.state === 'pending' || it.state === 'running')
    if (!hasPending) continue
    if (['running', 'pausing', 'paused', 'idle'].includes(pl.run_status)) {
      out.push({ partnerId: row.partner_id, queueToken: row.queue_token })
    }
  }
  return out
}

export async function deleteListingImportQueueFromPg(partnerId: string, token: string): Promise<boolean> {
  if (!isPgConfigured() || !listingImportQueueTokenOk(token)) return false
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query(
      `insert into public.messaging_partner_listing_import_queue_revocations (partner_id, queue_token)
       values ($1::uuid, $2)
       on conflict (partner_id, queue_token) do nothing`,
      [partnerId, token]
    )
    await client.query(
      `delete from public.messaging_partner_listing_import_queues
       where partner_id = $1::uuid and queue_token = $2`,
      [partnerId, token]
    )
    await client.query('commit')
    return true
  } catch (e) {
    await client.query('rollback')
    console.warn('[deleteListingImportQueueFromPg]', e)
    return false
  } finally {
    client.release()
  }
}

export async function insertListingImportDraftFromPg(input: {
  partnerId: string
  jobId: string
  source: string
  sourceUrl: string
  sourceOfferId?: string | null
}): Promise<ListingImportDraft | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<{ id: string }>(
    `insert into public.messaging_partner_listing_import_drafts
       (partner_id, job_id, source, source_url, source_offer_id, status)
     values ($1::uuid, $2, $3, $4, $5, 'queued')
     returning id::text`,
    [input.partnerId, input.jobId, input.source, input.sourceUrl, input.sourceOfferId || null]
  )
  if (!row?.id) return null
  return fetchListingImportDraftFromPg(input.partnerId, row.id)
}

export async function updateListingImportDraftFromPg(
  partnerId: string,
  draftId: string,
  patch: {
    status?: string
    message?: string | null
    errors?: string[]
    warnings?: string[]
    rawPayload?: Record<string, unknown> | null
    productData?: Record<string, unknown> | null
    publishedInventoryId?: string | null
    finished?: boolean
  }
): Promise<ListingImportDraft | null> {
  if (!isPgConfigured()) return null
  const sets: string[] = ['updated_at = now()']
  const params: unknown[] = [partnerId, draftId]
  const add = (sql: string, v: unknown) => {
    params.push(v)
    sets.push(sql.replace('$?', `$${params.length}`))
  }
  if (patch.status != null) add('status = $?', patch.status)
  if (patch.message !== undefined) add('message = $?', patch.message)
  if (patch.errors) add('errors = $?::jsonb', JSON.stringify(patch.errors))
  if (patch.warnings) add('warnings = $?::jsonb', JSON.stringify(patch.warnings))
  if (patch.rawPayload !== undefined) add('raw_payload = $?::jsonb', patch.rawPayload ? JSON.stringify(patch.rawPayload) : null)
  if (patch.productData !== undefined)
    add('product_data = $?::jsonb', patch.productData ? JSON.stringify(patch.productData) : null)
  if (patch.publishedInventoryId !== undefined) add('published_inventory_id = $?::uuid', patch.publishedInventoryId)
  if (patch.finished) sets.push('finished_at = now()')
  await getPgPool().query(
    `update public.messaging_partner_listing_import_drafts
     set ${sets.join(', ')}
     where partner_id = $1::uuid and id = $2::uuid`,
    params
  )
  return fetchListingImportDraftFromPg(partnerId, draftId)
}

export async function fetchListingImportDraftFromPg(
  partnerId: string,
  draftId: string
): Promise<ListingImportDraft | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<DraftDbRow>(
    `select ${DRAFT_SELECT}
     from public.messaging_partner_listing_import_drafts d
     left join public.messaging_partner_inventory mpi on mpi.id = d.published_inventory_id
     where d.partner_id = $1::uuid and d.id = $2::uuid
     limit 1`,
    [partnerId, draftId]
  )
  return row ? mapDraft(row) : null
}

export async function fetchListingImportDraftsByIdsFromPg(
  partnerId: string,
  ids: string[]
): Promise<Map<string, ListingImportDraft>> {
  const out = new Map<string, ListingImportDraft>()
  if (!isPgConfigured() || ids.length === 0) return out
  const rows = await pgQuery<DraftDbRow>(
    `select ${DRAFT_SELECT}
     from public.messaging_partner_listing_import_drafts d
     left join public.messaging_partner_inventory mpi on mpi.id = d.published_inventory_id
     where d.partner_id = $1::uuid and d.id = any($2::uuid[])`,
    [partnerId, ids]
  )
  for (const row of rows) out.set(row.id, mapDraft(row))
  return out
}

export async function listingParserIdsExistingInInventoryFromPg(input: {
  partnerId: string
  ids: string[]
  activeOnly?: boolean
}): Promise<Set<string>> {
  const out = new Set<string>()
  if (!isPgConfigured() || input.ids.length === 0) return out
  const { normalizeListingParserItemId } = await import('@/lib/messaging/listing-import/import-source-ids')
  const cands = [...new Set(input.ids.map((x) => normalizeListingParserItemId(x)).filter(Boolean))]
  if (!cands.length) return out
  const activeSql = input.activeOnly ? 'and coalesce(mpi.is_active, true) = true' : ''
  const exact = await pgQuery<{ remarketing_id: string }>(
    `select distinct remarketing_id
     from public.messaging_partner_inventory mpi
     where mpi.partner_id = $1::uuid
       and mpi.remarketing_id = any($2::text[])
       ${activeSql}`,
    [input.partnerId, cands]
  )
  for (const row of exact) {
    const n = normalizeListingParserItemId(row.remarketing_id || '')
    if (n) out.add(n)
  }
  const needPrefix = cands.filter((c) => /^[AT]\d+$/.test(c) && !out.has(c))
  if (!needPrefix.length) return out
  const likePatterns = needPrefix.map((c) => `${c}a188%`)
  const likes = await pgQuery<{ remarketing_id: string }>(
    `select distinct remarketing_id
     from public.messaging_partner_inventory mpi
     where mpi.partner_id = $1::uuid
       ${activeSql}
       and ${likePatterns.map((_, i) => `mpi.remarketing_id like $${i + 2}`).join(' or ')}`,
    [input.partnerId, ...likePatterns]
  )
  for (const c of needPrefix) {
    const needle = `${c}a188`
    if (likes.some((r) => (r.remarketing_id || '').startsWith(needle))) out.add(c)
  }
  return out
}

export async function listingParserIdsWithDoneDraftsFromPg(
  partnerId: string,
  ids: string[]
): Promise<Set<string>> {
  const out = new Set<string>()
  if (!isPgConfigured() || ids.length === 0) return out
  const { normalizeListingParserItemId } = await import('@/lib/messaging/listing-import/import-source-ids')
  const cands = [...new Set(ids.map((x) => normalizeListingParserItemId(x)).filter(Boolean))]
  if (!cands.length) return out
  const rows = await pgQuery<{ product_id: string | null }>(
    `select coalesce(product_data->>'product_id', '') as product_id
     from public.messaging_partner_listing_import_drafts
     where partner_id = $1::uuid
       and status = 'done'
       and product_data is not null
       and coalesce(product_data->>'product_id', '') = any($2::text[])`,
    [partnerId, cands]
  )
  for (const row of rows) {
    const n = normalizeListingParserItemId(row.product_id || '')
    if (n) out.add(n)
  }
  return out
}

export type ListingImportSettingsRow = {
  partner_id: string
  cookie_json: unknown[]
  pandamall_username: string
  pandamall_password: string
  updated_at: string
}

export async function fetchListingImportSettingsFromPg(partnerId: string): Promise<ListingImportSettingsRow | null> {
  if (!isPgConfigured() || !partnerId) return null
  try {
    const row = await pgQueryOne<ListingImportSettingsRow>(
      `select partner_id::text, cookie_json, pandamall_username, pandamall_password, updated_at::text
       from public.messaging_partner_listing_import_settings
       where partner_id = $1::uuid
       limit 1`,
      [partnerId]
    )
    if (!row) return null
    return {
      ...row,
      cookie_json: Array.isArray(row.cookie_json) ? row.cookie_json : [],
      pandamall_username: String(row.pandamall_username || ''),
      pandamall_password: String(row.pandamall_password || ''),
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/listing_import_settings|does not exist/i.test(msg)) return null
    throw e
  }
}

export async function upsertListingImportSettingsFromPg(input: {
  partnerId: string
  cookieJson?: unknown[] | null
  pandamallUsername?: string | null
  pandamallPassword?: string | null
}): Promise<ListingImportSettingsRow | null> {
  if (!isPgConfigured()) return null
  const existing = await fetchListingImportSettingsFromPg(input.partnerId)
  const cookieJson = input.cookieJson !== undefined && input.cookieJson !== null ? input.cookieJson : existing?.cookie_json || []
  const username =
    input.pandamallUsername !== undefined && input.pandamallUsername !== null
      ? input.pandamallUsername.trim()
      : existing?.pandamall_username || ''
  const password =
    input.pandamallPassword !== undefined && input.pandamallPassword !== null && input.pandamallPassword !== ''
      ? input.pandamallPassword
      : existing?.pandamall_password || ''
  const row = await pgQueryOne<ListingImportSettingsRow>(
    `insert into public.messaging_partner_listing_import_settings
       (partner_id, cookie_json, pandamall_username, pandamall_password, updated_at)
     values ($1::uuid, $2::jsonb, $3, $4, now())
     on conflict (partner_id) do update set
       cookie_json = excluded.cookie_json,
       pandamall_username = excluded.pandamall_username,
       pandamall_password = excluded.pandamall_password,
       updated_at = now()
     returning partner_id::text, cookie_json, pandamall_username, pandamall_password, updated_at::text`,
    [input.partnerId, JSON.stringify(cookieJson), username, password]
  )
  return row
}

export async function fetchInventoryIdByRemarketingFromPg(
  partnerId: string,
  remarketingId: string
): Promise<string | null> {
  if (!isPgConfigured()) return null
  const id = String(remarketingId || '').trim()
  if (!id) return null
  const row = await pgQueryOne<{ id: string }>(
    `select id::text
     from public.messaging_partner_inventory
     where partner_id = $1::uuid and remarketing_id = $2
     order by updated_at desc nulls last
     limit 1`,
    [partnerId, id]
  )
  return row?.id || null
}
