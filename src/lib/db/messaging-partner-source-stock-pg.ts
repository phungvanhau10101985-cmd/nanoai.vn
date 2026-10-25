import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { bumpInventoryCacheLater } from '@/lib/cache/partner-shop-cache'
import {
  adminSourceBatchScanCooldownDays,
  adminSourceBatchTrafficCheckGapDays,
  adminSourceBatchTrafficViewWindowDays,
  SOURCE_STOCK_OOS_RESTORE_QTY,
  nextStockQtyAfterSourceCheck,
  sourceStockCheckClaimLeaseMinutes,
  sourceStockCheckErrorRetryMinutes,
  sourceStockCheckStaleMinutes,
} from '@/lib/messaging/source-stock-check/source-stock-config'
import {
  coerceUrlForSourceStock,
  normalizeSourceStockDomain,
  sourceStockDomainIlikePatterns,
  sourceStockLinkIlikePatterns,
} from '@/lib/messaging/source-stock-check/source-stock-urls'
import type {
  SourceStockActivityReport,
  SourceStockActivityReportSampleRow,
  SourceStockQueueStats,
} from '@/lib/messaging/source-stock-check/source-stock-types'

const LINK_ILIKE = sourceStockLinkIlikePatterns()

export class SourceStockSchemaMissingError extends Error {
  readonly code = 'SOURCE_STOCK_SCHEMA_MISSING'

  constructor(detail = 'Chưa áp dụng migration kiểm tra nguồn hàng.') {
    super(detail)
    this.name = 'SourceStockSchemaMissingError'
  }
}

let sourceStockSchemaReady = false

export async function assertSourceStockSchemaReadyFromPg(): Promise<void> {
  if (sourceStockSchemaReady) return
  const { rows } = await getPgPool().query<{
    worker_table: string | null
    inventory_columns: number
  }>(
    `select
       to_regclass('public.messaging_partner_source_stock_worker_state')::text as worker_table,
       (
         select count(*)::int
         from information_schema.columns
         where table_schema = 'public'
           and table_name = 'messaging_partner_inventory'
           and column_name = any($1::text[])
       ) as inventory_columns`,
    [[
      'source_stock_status',
      'source_stock_checked_at',
      'source_stock_next_check_at',
      'source_stock_error',
      'source_stock_check_platform',
      'admin_source_batch_scanned_at',
    ]]
  )
  if (!rows[0]?.worker_table || Number(rows[0]?.inventory_columns || 0) !== 6) {
    throw new SourceStockSchemaMissingError()
  }
  sourceStockSchemaReady = true
}

function linkSql(alias: string, startIndex: number): string {
  const col = alias ? `${alias}.product_url` : 'product_url'
  return `(${LINK_ILIKE.map((_, i) => `${col} ilike $${startIndex + i}`).join(' or ')})`
}

function domainLinkSql(alias: string, startIndex: number, domain: string): { sql: string; params: string[] } {
  const col = alias ? `${alias}.product_url` : 'product_url'
  const params = sourceStockDomainIlikePatterns(domain)
  return {
    sql: `(${params.map((_, i) => `${col} ilike $${startIndex + i}`).join(' or ')})`,
    params,
  }
}

/**
 * ID vừa xem, unnest một lần rồi hash-join.
 * EXISTS `recently_viewed_ids @> id` trên từng dòng kho làm count/claim chạy hàng chục giây và giữ khóa.
 */
function viewedInventoryCte(partnerParam: string | null, sinceSql: string): string {
  const partnerSql = partnerParam ? `and v.partner_id = ${partnerParam}::uuid` : ''
  return `viewed_ids as (
    select distinct lower(trim(elem.item)) as inventory_id
    from public.messaging_partner_visitor_personalization v
    cross join lateral jsonb_array_elements_text(
      case
        when jsonb_typeof(v.recently_viewed_ids) = 'array' then v.recently_viewed_ids
        else '[]'::jsonb
      end
    ) as elem(item)
    where v.updated_at >= (${sinceSql})
      ${partnerSql}
  )`
}

/** PDP traffic trước, rồi chưa TTL, rồi stamp cũ — khớp hàng đợi admin 188. */
function duePriorityOrderSql(alias: string): string {
  return `case when viewed_ids.inventory_id is not null then 0 else 1 end,
    case when ${alias}.admin_source_batch_scanned_at is null then 0 else 1 end,
    ${alias}.admin_source_batch_scanned_at asc nulls first,
    ${alias}.source_stock_next_check_at is not null,
    ${alias}.source_stock_next_check_at asc nulls first,
    ${alias}.id asc`
}

/** queued/checking còn lease thì không claim lại; hết lease = process chết, cho lấy lại. */
function inFlightLeaseSql(alias: string): string {
  return `not (
    lower(coalesce(${alias}.source_stock_status,'')) in ('queued','checking')
    and ${alias}.source_stock_next_check_at is not null
    and ${alias}.source_stock_next_check_at > now()
  )`
}

export type SourceStockInventoryMini = {
  id: string
  partner_id: string
  sku: string | null
  remarketing_id: string
  name: string
  product_url: string
  stock_qty: number
  source_stock_status: string | null
  source_stock_checked_at: string | null
  source_stock_next_check_at: string | null
  source_stock_error: string | null
  source_stock_check_platform: string | null
  admin_source_batch_scanned_at: string | null
  previous_source_stock_status?: string | null
}

export type SourceStockWorkerStateRow = {
  partner_id: string
  paused: boolean
  updated_at: string | null
  checking_inventory_id: string | null
  checking_started_at: string | null
  last_done_inventory_id: string | null
  last_done_finished_at: string | null
  last_done_source_stock_status: string | null
  last_products_commit_ok: boolean | null
  last_products_commit_at: string | null
  last_products_commit_detail: string | null
}

export async function ensureSourceStockWorkerStateFromPg(partnerId: string): Promise<SourceStockWorkerStateRow> {
  const pool = getPgPool()
  await pool.query(
    `insert into public.messaging_partner_source_stock_worker_state (partner_id, paused, updated_at)
     values ($1::uuid, false, now())
     on conflict (partner_id) do nothing`,
    [partnerId]
  )
  const { rows } = await pool.query<SourceStockWorkerStateRow>(
    `select partner_id, paused, updated_at::text, checking_inventory_id::text,
            checking_started_at::text, last_done_inventory_id::text, last_done_finished_at::text,
            last_done_source_stock_status, last_products_commit_ok, last_products_commit_at::text,
            last_products_commit_detail
     from public.messaging_partner_source_stock_worker_state
     where partner_id = $1::uuid`,
    [partnerId]
  )
  return (
    rows[0] || {
      partner_id: partnerId,
      paused: false,
      updated_at: null,
      checking_inventory_id: null,
      checking_started_at: null,
      last_done_inventory_id: null,
      last_done_finished_at: null,
      last_done_source_stock_status: null,
      last_products_commit_ok: null,
      last_products_commit_at: null,
      last_products_commit_detail: null,
    }
  )
}

export async function setSourceStockWorkerPausedFromPg(partnerId: string, paused: boolean): Promise<SourceStockWorkerStateRow> {
  const pool = getPgPool()
  const { rows } = await pool.query<SourceStockWorkerStateRow>(
    `insert into public.messaging_partner_source_stock_worker_state (partner_id, paused, updated_at)
     values ($1::uuid, $2, now())
     on conflict (partner_id) do update set paused = excluded.paused, updated_at = now()
     returning partner_id, paused, updated_at::text, checking_inventory_id::text,
               checking_started_at::text, last_done_inventory_id::text, last_done_finished_at::text,
               last_done_source_stock_status, last_products_commit_ok, last_products_commit_at::text,
               last_products_commit_detail`,
    [partnerId, paused]
  )
  return rows[0]
}

export async function markSourceStockCheckingFromPg(partnerId: string, inventoryId: string): Promise<void> {
  const pool = getPgPool()
  await pool.query(
    `insert into public.messaging_partner_source_stock_worker_state
       (partner_id, paused, updated_at, checking_inventory_id, checking_started_at)
     values ($1::uuid, false, now(), $2::uuid, now())
     on conflict (partner_id) do update set
       checking_inventory_id = excluded.checking_inventory_id,
       checking_started_at = excluded.checking_started_at,
       updated_at = now()`,
    [partnerId, inventoryId]
  )
}

export async function markSourceStockFinishedFromPg(opts: {
  partnerId: string
  inventoryId: string
  status: string
  commitOk: boolean | null
  commitDetail: string | null
}): Promise<void> {
  const pool = getPgPool()
  await pool.query(
    `insert into public.messaging_partner_source_stock_worker_state
       (partner_id, paused, updated_at, checking_inventory_id, checking_started_at,
        last_done_inventory_id, last_done_finished_at, last_done_source_stock_status,
        last_products_commit_ok, last_products_commit_at, last_products_commit_detail)
     values ($1::uuid, false, now(), null, null, $2::uuid, now(), $3, $4, now(), $5)
     on conflict (partner_id) do update set
       checking_inventory_id = null,
       checking_started_at = null,
       last_done_inventory_id = excluded.last_done_inventory_id,
       last_done_finished_at = excluded.last_done_finished_at,
       last_done_source_stock_status = excluded.last_done_source_stock_status,
       last_products_commit_ok = excluded.last_products_commit_ok,
       last_products_commit_at = excluded.last_products_commit_at,
       last_products_commit_detail = excluded.last_products_commit_detail,
       updated_at = now()`,
    [opts.partnerId, opts.inventoryId, (opts.status || 'unknown').slice(0, 64), opts.commitOk, (opts.commitDetail || '').slice(0, 920)]
  )
}

export async function fetchSourceStockInventoryMiniFromPg(
  partnerId: string,
  ids: string[]
): Promise<Map<string, SourceStockInventoryMini>> {
  const out = new Map<string, SourceStockInventoryMini>()
  if (!ids.length) return out
  const { rows } = await getPgPool().query<SourceStockInventoryMini>(
    `select id::text, partner_id::text, sku, coalesce(remarketing_id,'') as remarketing_id, name,
            coalesce(product_url,'') as product_url, stock_qty,
            source_stock_status, source_stock_checked_at::text, source_stock_next_check_at::text,
            source_stock_error, source_stock_check_platform, admin_source_batch_scanned_at::text
     from public.messaging_partner_inventory
     where partner_id = $1::uuid and id = any($2::uuid[])`,
    [partnerId, ids]
  )
  for (const r of rows) out.set(r.id, r)
  return out
}

export async function fetchSourceStockInventoryByIdFromPg(
  partnerId: string,
  inventoryId: string
): Promise<SourceStockInventoryMini | null> {
  const map = await fetchSourceStockInventoryMiniFromPg(partnerId, [inventoryId])
  return map.get(inventoryId) ?? null
}

/** Xem trước «sắp tới» lúc mở trang: index hạn kiểm tra, không sort cả kho theo lượt xem. Claim nền vẫn ưu tiên PDP. */
export async function listDueSourceStockIdsFromPg(partnerId: string, limit: number): Promise<string[]> {
  const staleMin = sourceStockCheckStaleMinutes()
  const staleIdx = LINK_ILIKE.length + 2
  const limitIdx = LINK_ILIKE.length + 3
  const { rows } = await getPgPool().query<{ id: string }>(
    `select mpi.id::text as id
     from public.messaging_partner_inventory mpi
     where mpi.partner_id = $1::uuid
       and mpi.is_active = true
       and length(trim(coalesce(mpi.product_url,''))) > 8
       and ${linkSql('mpi', 2)}
       and (
         mpi.source_stock_next_check_at is null
         or mpi.source_stock_next_check_at <= now()
         or mpi.source_stock_checked_at is null
         or mpi.source_stock_checked_at <= now() - make_interval(mins => $${staleIdx}::int)
       )
       and ${inFlightLeaseSql('mpi')}
     order by mpi.source_stock_next_check_at asc nulls first, mpi.id asc
     limit $${limitIdx}`,
    [partnerId, ...LINK_ILIKE, staleMin, Math.max(1, limit)]
  )
  return rows.map((r) => r.id)
}

export async function claimDueSourceStockFromPg(): Promise<{
  partnerId: string
  inventoryId: string
  previousStatus: string
} | null> {
  if (!isPgConfigured()) return null
  const staleMin = sourceStockCheckStaleMinutes()
  const viewDays = adminSourceBatchTrafficViewWindowDays()
  const staleIdx = LINK_ILIKE.length + 1
  const viewIdx = LINK_ILIKE.length + 2
  const client = await getPgPool().connect()
  try {
    await client.query('begin')
    const { rows } = await client.query<{ partner_id: string; id: string; previous_status: string }>(
      `with ${viewedInventoryCte(null, `now() - make_interval(days => $${viewIdx}::int)`)},
       candidate as materialized (
         select mpi.id
         from public.messaging_partner_inventory mpi
         left join viewed_ids on viewed_ids.inventory_id = lower(mpi.id::text)
         left join public.messaging_partner_source_stock_worker_state w
           on w.partner_id = mpi.partner_id
         where mpi.is_active = true
           and coalesce(w.paused, false) = false
           and length(trim(coalesce(mpi.product_url,''))) > 8
           and ${linkSql('mpi', 1)}
           and (
             mpi.source_stock_next_check_at is null
             or mpi.source_stock_next_check_at <= now()
             or mpi.source_stock_checked_at is null
             or mpi.source_stock_checked_at <= now() - make_interval(mins => $${staleIdx}::int)
           )
           and ${inFlightLeaseSql('mpi')}
         order by ${duePriorityOrderSql('mpi')}
         limit 1
       )
       select mpi.partner_id::text as partner_id, mpi.id::text as id,
              lower(coalesce(mpi.source_stock_status, '')) as previous_status
       from public.messaging_partner_inventory mpi
       join candidate c on c.id = mpi.id
       for update of mpi skip locked`,
      [...LINK_ILIKE, staleMin, viewDays]
    )
    const hit = rows[0]
    if (!hit) {
      await client.query('commit')
      return null
    }
    await client.query(
      `update public.messaging_partner_inventory
       set source_stock_status = 'queued',
           source_stock_next_check_at = now() + make_interval(mins => $2::int),
           source_stock_check_platform = null
       where id = $1::uuid`,
      [hit.id, sourceStockCheckClaimLeaseMinutes()]
    )
    await client.query('commit')
    return { partnerId: hit.partner_id, inventoryId: hit.id, previousStatus: hit.previous_status }
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {
      /* ignore */
    }
    console.warn('[source-stock claim]', e instanceof Error ? e.message : e)
    return null
  } finally {
    client.release()
  }
}

export async function markInventoryCheckingFromPg(partnerId: string, inventoryId: string): Promise<SourceStockInventoryMini | null> {
  const leaseMin = sourceStockCheckClaimLeaseMinutes()
  const { rows } = await getPgPool().query<SourceStockInventoryMini>(
    `update public.messaging_partner_inventory as mpi
     set source_stock_status = 'checking',
         source_stock_error = null,
         source_stock_next_check_at = now() + make_interval(mins => $3::int),
         source_stock_check_platform = null,
         updated_at = now()
     from (
       select id, source_stock_status as previous_status
       from public.messaging_partner_inventory
       where partner_id = $1::uuid and id = $2::uuid
     ) old
     where mpi.id = old.id and mpi.partner_id = $1::uuid
     returning mpi.id::text, mpi.partner_id::text, mpi.sku, coalesce(mpi.remarketing_id,'') as remarketing_id, mpi.name,
               coalesce(mpi.product_url,'') as product_url, mpi.stock_qty,
               mpi.source_stock_status, mpi.source_stock_checked_at::text, mpi.source_stock_next_check_at::text,
               mpi.source_stock_error, mpi.source_stock_check_platform, mpi.admin_source_batch_scanned_at::text,
               old.previous_status as previous_source_stock_status`,
    [partnerId, inventoryId, leaseMin]
  )
  return rows[0] ?? null
}

export async function commitSourceStockResultFromPg(opts: {
  partnerId: string
  inventoryId: string
  previousStatus: string
  status: string
  error: string | null
  checkedVia: string | null
}): Promise<boolean> {
  const retryMin =
    ['error', 'unknown', 'blocked'].includes((opts.status || '').toLowerCase())
      ? sourceStockCheckErrorRetryMinutes()
      : sourceStockCheckStaleMinutes()
  const stampTtl = !['error', 'unknown', 'blocked', 'fetch_error'].includes((opts.status || '').toLowerCase())
  const { rows } = await getPgPool().query<{ stock_qty: number }>(
    `select stock_qty from public.messaging_partner_inventory where partner_id = $1::uuid and id = $2::uuid`,
    [opts.partnerId, opts.inventoryId]
  )
  if (!rows[0]) return false
  const stockQty = nextStockQtyAfterSourceCheck({
    status: opts.status,
    stockQty: Number(rows[0].stock_qty || 0),
    previousStatus: opts.previousStatus,
  })
  await getPgPool().query(
    `update public.messaging_partner_inventory
     set source_stock_status = $3,
         source_stock_checked_at = now(),
         source_stock_error = $4,
         source_stock_check_platform = $5,
         source_stock_next_check_at = now() + make_interval(mins => $6::int),
         admin_source_batch_scanned_at = case when $7 then now() else admin_source_batch_scanned_at end,
         stock_qty = $8,
         updated_at = now()
     where partner_id = $1::uuid and id = $2::uuid`,
    [
      opts.partnerId,
      opts.inventoryId,
      opts.status.slice(0, 50),
      opts.error ? opts.error.slice(0, 2000) : null,
      opts.checkedVia ? opts.checkedVia.slice(0, 80) : null,
      retryMin,
      stampTtl,
      stockQty,
    ]
  )
  bumpInventoryCacheLater(opts.partnerId)
  return true
}

export async function enqueueSourceStockQueuedFromPg(partnerId: string, inventoryId: string): Promise<boolean> {
  const { rowCount } = await getPgPool().query(
    `update public.messaging_partner_inventory
     set source_stock_status = 'queued',
         source_stock_error = null,
         source_stock_next_check_at = now() + make_interval(mins => $3::int),
         source_stock_check_platform = null,
         updated_at = now()
     where partner_id = $1::uuid and id = $2::uuid
       and (
         lower(coalesce(source_stock_status,'')) not in ('queued','checking')
         or source_stock_next_check_at is null
         or source_stock_next_check_at <= now()
       )`,
    [partnerId, inventoryId, sourceStockCheckClaimLeaseMinutes()]
  )
  return (rowCount ?? 0) > 0
}

export async function listPausedPartnerIdsFromPg(): Promise<Set<string>> {
  const { rows } = await getPgPool().query<{ partner_id: string }>(
    `select partner_id::text from public.messaging_partner_source_stock_worker_state where paused = true`
  )
  return new Set(rows.map((r) => r.partner_id))
}

const queueStatsCache = new Map<string, { at: number; data: SourceStockQueueStats }>()
const QUEUE_STATS_CACHE_MS = 12_000

export function invalidateSourceStockQueueStatsCache(partnerId?: string): void {
  if (!partnerId) {
    queueStatsCache.clear()
    return
  }
  for (const key of queueStatsCache.keys()) {
    if (key.startsWith(`${partnerId}:`)) queueStatsCache.delete(key)
  }
}

export async function sourceStockQueueStatsFromPg(
  partnerId: string,
  domain: string,
  activeOnly: boolean
): Promise<SourceStockQueueStats> {
  const normalizedDomain = normalizeSourceStockDomain(domain)
  const cacheKey = `${partnerId}:${normalizedDomain}:${activeOnly ? '1' : '0'}`
  const cached = queueStatsCache.get(cacheKey)
  if (cached && Date.now() - cached.at < QUEUE_STATS_CACHE_MS) return cached.data
  const ttlDays = adminSourceBatchScanCooldownDays()
  const viewDays = adminSourceBatchTrafficViewWindowDays()
  const gapDays = adminSourceBatchTrafficCheckGapDays()
  const pool = getPgPool()
  const activeSql = activeOnly ? 'and mpi.is_active = true' : ''
  const domainScope = domainLinkSql('mpi', 2, normalizedDomain)
  const viewIdx = 2 + domainScope.params.length
  const ttlIdx = viewIdx + 1
  const gapIdx = viewIdx + 2
  const inScope = `length(trim(coalesce(mpi.product_url,''))) > 8 and ${domainScope.sql}`
  const seen = 'viewed_ids.inventory_id is not null'
  const ttlOk = `((not (${seen}) and (mpi.admin_source_batch_scanned_at is null or mpi.admin_source_batch_scanned_at <= now() - make_interval(days => $${ttlIdx}::int)))
    or (${seen} and (mpi.admin_source_batch_scanned_at is null or mpi.admin_source_batch_scanned_at <= now() - make_interval(days => $${gapIdx}::int))))`
  const { rows } = await pool.query<{
    total_in_scope: number
    eligible_now: number
    eligible_traffic: number
    never_scanned: number
  }>(
    `with ${viewedInventoryCte('$1', `now() - make_interval(days => $${viewIdx}::int)`)}
     select
       count(*) filter (where ${inScope})::int as total_in_scope,
       count(*) filter (where ${inScope} and ${ttlOk})::int as eligible_now,
       count(*) filter (where ${inScope} and ${ttlOk} and ${seen})::int as eligible_traffic,
       count(*) filter (where ${inScope} and ${ttlOk} and mpi.admin_source_batch_scanned_at is null)::int as never_scanned
     from public.messaging_partner_inventory mpi
     left join viewed_ids on viewed_ids.inventory_id = lower(mpi.id::text)
     where mpi.partner_id = $1::uuid ${activeSql}`,
    [partnerId, ...domainScope.params, viewDays, ttlDays, gapDays]
  )
  const total = Number(rows[0]?.total_in_scope || 0)
  const eligibleNow = Number(rows[0]?.eligible_now || 0)
  const eligibleTraffic = Number(rows[0]?.eligible_traffic || 0)
  const neverScanned = Number(rows[0]?.never_scanned || 0)
  const data: SourceStockQueueStats = {
    ok: true,
    domain: normalizedDomain,
    active_only: activeOnly,
    admin_batch_scan_cooldown_days: ttlDays,
    admin_batch_traffic_view_window_days: viewDays,
    admin_batch_traffic_check_gap_days: gapDays,
    cooldown_cutoff_utc_iso: new Date(Date.now() - ttlDays * 86400000).toISOString(),
    traffic_recent_check_cutoff_utc_iso: new Date(Date.now() - gapDays * 86400000).toISOString(),
    traffic_view_since_utc_iso: new Date(Date.now() - viewDays * 86400000).toISOString(),
    total_in_scope: total,
    eligible_now: eligibleNow,
    eligible_never_scanned: neverScanned,
    eligible_rescan_after_ttl: Math.max(0, eligibleNow - neverScanned),
    eligible_with_recent_customer_view: eligibleTraffic,
    eligible_without_recent_customer_view: Math.max(0, eligibleNow - eligibleTraffic),
    in_cooldown: Math.max(0, total - eligibleNow),
  }
  queueStatsCache.set(cacheKey, { at: Date.now(), data })
  return data
}

function mapSample(r: Record<string, unknown>): SourceStockActivityReportSampleRow {
  const url = String(r.product_url || '')
  const css = coerceUrlForSourceStock(url, 'cssbuy')
  const vm = coerceUrlForSourceStock(url, 'vipomall')
  return {
    id: String(r.id),
    product_id: String(r.remarketing_id || r.sku || ''),
    name: String(r.name || ''),
    slug: String(r.sku || ''),
    link_default: url,
    link_convert_cssbuy: css.url,
    link_convert_cssbuy_err: css.error || undefined,
    link_convert_vipomall: vm.url,
    link_convert_vipomall_err: vm.error || undefined,
    source_stock_status: (r.source_stock_status as string) || null,
    source_stock_checked_at: (r.source_stock_checked_at as string) || null,
    source_stock_check_platform: (r.source_stock_check_platform as string) || null,
    admin_source_batch_scanned_at: (r.admin_source_batch_scanned_at as string) || null,
    available: Number(r.stock_qty || 0),
  }
}

export async function sourceStockActivityReportFromPg(opts: {
  partnerId: string
  domain: string
  activeOnly: boolean
  windowDays: number
  samplesOosPage: number
  samplesInStockPage: number
  samplesBatchTtlPage: number
  samplePageSize: number
  /** Bỏ qua = cả ba bảng. Mở trang chỉ xin `oos`, hai bảng còn lại tải sau. */
  sampleSets?: Array<'oos' | 'in_stock' | 'batch_ttl'>
  includeQueue?: boolean
}): Promise<SourceStockActivityReport> {
  const normalizedDomain = normalizeSourceStockDomain(opts.domain)
  const wd = Math.max(1, Math.min(opts.windowDays, 366))
  const pageSize = Math.max(1, Math.min(opts.samplePageSize, 500))
  const since = new Date(Date.now() - wd * 86400000).toISOString()
  const pool = getPgPool()
  const activeSql = opts.activeOnly ? 'and mpi.is_active = true' : ''
  const domainScope = domainLinkSql('mpi', 2, normalizedDomain)
  const sinceParam = domainScope.params.length + 2
  const params: unknown[] = [opts.partnerId, ...domainScope.params, since]
  const base = `mpi.partner_id = $1::uuid ${activeSql}
    and length(trim(coalesce(mpi.product_url,''))) > 8
    and ${domainScope.sql}`
  const checkedWin = `mpi.source_stock_checked_at is not null and mpi.source_stock_checked_at >= $${sinceParam}::timestamptz`
  const batchTtlSql = `mpi.admin_source_batch_scanned_at is not null and mpi.admin_source_batch_scanned_at >= $${sinceParam}::timestamptz`

  const [aggResult, statusResult, queueFromDb] = await Promise.all([
    pool.query<{
      batch_ttl: number
      checked_any: number
      oos: number
      in_stock: number
      avail_pos: number
      avail_zero: number
    }>(
      `select
         count(*) filter (where ${batchTtlSql})::int as batch_ttl,
         count(*) filter (where ${checkedWin})::int as checked_any,
         count(*) filter (where ${checkedWin} and mpi.source_stock_status = 'out_of_stock')::int as oos,
         count(*) filter (where ${checkedWin} and mpi.source_stock_status = 'in_stock')::int as in_stock,
         count(*) filter (where ${checkedWin} and coalesce(mpi.stock_qty,0) > 0)::int as avail_pos,
         count(*) filter (where ${checkedWin} and coalesce(mpi.stock_qty,0) <= 0)::int as avail_zero
       from public.messaging_partner_inventory mpi
       where ${base}`,
      params
    ),
    pool.query<{ k: string; n: string }>(
      `select lower(coalesce(nullif(trim(mpi.source_stock_status),''),'unknown')) as k, count(*)::text as n
       from public.messaging_partner_inventory mpi
       where ${base} and ${checkedWin}
       group by 1`,
      params
    ),
    opts.includeQueue === false
      ? Promise.resolve(null)
      : sourceStockQueueStatsFromPg(opts.partnerId, opts.domain, opts.activeOnly),
  ])
  const agg = aggResult.rows[0]
  const batchTtl = Number(agg?.batch_ttl || 0)
  const checkedAny = Number(agg?.checked_any || 0)
  const oos = Number(agg?.oos || 0)
  const inStock = Number(agg?.in_stock || 0)
  const availPos = Number(agg?.avail_pos || 0)
  const availZero = Number(agg?.avail_zero || 0)
  const byStatus: Record<string, number> = {}
  for (const r of statusResult.rows) byStatus[r.k] = Number(r.n || 0)

  async function samplePage(
    extra: string,
    orderCol: string,
    page: number,
    total: number
  ): Promise<{ rows: SourceStockActivityReportSampleRow[]; total: number; page: number; total_pages: number }> {
    const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1)
    const p = Math.max(1, Math.min(page, totalPages))
    const offset = (p - 1) * pageSize
    const { rows } = await pool.query(
      `select mpi.id::text, mpi.sku, coalesce(mpi.remarketing_id,'') as remarketing_id, mpi.name,
              coalesce(mpi.product_url,'') as product_url, mpi.stock_qty,
              mpi.source_stock_status, mpi.source_stock_checked_at::text,
              mpi.source_stock_check_platform, mpi.admin_source_batch_scanned_at::text
       from public.messaging_partner_inventory mpi
       where ${base} and ${extra}
       order by ${orderCol} desc nulls last, mpi.id desc
       limit ${pageSize} offset ${offset}`,
      params
    )
    return {
      rows: rows.map((r) => mapSample(r as Record<string, unknown>)),
      total,
      page: p,
      total_pages: totalPages,
    }
  }

  const want = (name: 'oos' | 'in_stock' | 'batch_ttl') => !opts.sampleSets || opts.sampleSets.includes(name)
  const blankSample = (total: number, page: number) => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1)
    const p = Math.max(1, Math.min(page, totalPages))
    return {
      rows: [] as SourceStockActivityReportSampleRow[],
      total,
      page: p,
      total_pages: totalPages,
    }
  }
  const [oosS, inS, ttlS] = await Promise.all([
    want('oos')
      ? samplePage(`${checkedWin} and mpi.source_stock_status = 'out_of_stock'`, 'mpi.source_stock_checked_at', opts.samplesOosPage, oos)
      : Promise.resolve(blankSample(oos, opts.samplesOosPage)),
    want('in_stock')
      ? samplePage(`${checkedWin} and mpi.source_stock_status = 'in_stock'`, 'mpi.source_stock_checked_at', opts.samplesInStockPage, inStock)
      : Promise.resolve(blankSample(inStock, opts.samplesInStockPage)),
    want('batch_ttl')
      ? samplePage(batchTtlSql, 'mpi.admin_source_batch_scanned_at', opts.samplesBatchTtlPage, batchTtl)
      : Promise.resolve(blankSample(batchTtl, opts.samplesBatchTtlPage)),
  ])
  const queue =
    queueFromDb ??
    ({
      ok: true,
      domain: normalizedDomain,
      active_only: opts.activeOnly,
      admin_batch_scan_cooldown_days: 0,
      admin_batch_traffic_view_window_days: 0,
      admin_batch_traffic_check_gap_days: 0,
      cooldown_cutoff_utc_iso: since,
      traffic_recent_check_cutoff_utc_iso: since,
      traffic_view_since_utc_iso: since,
      total_in_scope: 0,
      eligible_now: 0,
      eligible_never_scanned: 0,
      eligible_rescan_after_ttl: 0,
      eligible_with_recent_customer_view: 0,
      eligible_without_recent_customer_view: 0,
      in_cooldown: 0,
    } satisfies SourceStockQueueStats)

  return {
    ok: true,
    domain: normalizedDomain,
    active_only: opts.activeOnly,
    window_days: wd,
    window_since_utc_iso: since,
    samples_pagination: {
      page_size: pageSize,
      oos: { page: oosS.page, total: oosS.total, total_pages: oosS.total_pages },
      in_stock: { page: inS.page, total: inS.total, total_pages: inS.total_pages },
      batch_ttl_recent: { page: ttlS.page, total: ttlS.total, total_pages: ttlS.total_pages },
    },
    queue,
    counts: {
      batch_ttl_stamped_in_window: batchTtl,
      source_stock_checked_any_in_window: checkedAny,
      source_stock_oos_signal_in_window: oos,
      source_stock_in_stock_signal_in_window: inStock,
      checked_available_positive_in_window: availPos,
      checked_available_zero_or_negative_in_window: availZero,
    },
    checked_in_window_by_source_stock_status: byStatus,
    samples: { oos: oosS.rows, in_stock: inS.rows, batch_ttl_recent: ttlS.rows },
  }
}

export async function resetSourceStockPdpCycleFromPg(
  partnerId: string,
  domain: string,
  activeOnly: boolean
): Promise<number> {
  const activeSql = activeOnly ? 'and is_active = true' : ''
  const domainScope = domainLinkSql('', 2, normalizeSourceStockDomain(domain))
  const { rowCount } = await getPgPool().query(
    `update public.messaging_partner_inventory
     set source_stock_status = 'unknown',
         source_stock_checked_at = null,
         source_stock_next_check_at = null,
         source_stock_error = null,
         source_stock_check_platform = null,
         updated_at = now()
     where partner_id = $1::uuid ${activeSql}
       and length(trim(coalesce(product_url,''))) > 8
       and ${domainScope.sql}
       and coalesce(source_stock_status,'') not in ('queued','checking')`,
    [partnerId, ...domainScope.params]
  )
  return rowCount ?? 0
}

export async function listOosIdsInWindowFromPg(
  partnerId: string,
  domain: string,
  windowDays: number,
  activeOnly: boolean
): Promise<string[]> {
  const wd = Math.max(1, Math.min(windowDays, 366))
  const since = new Date(Date.now() - wd * 86400000).toISOString()
  const activeSql = activeOnly ? 'and mpi.is_active = true' : ''
  const domainScope = domainLinkSql('mpi', 2, normalizeSourceStockDomain(domain))
  const sinceParam = domainScope.params.length + 2
  const { rows } = await getPgPool().query<{ id: string }>(
    `select mpi.id::text as id
     from public.messaging_partner_inventory mpi
     where mpi.partner_id = $1::uuid ${activeSql}
       and length(trim(coalesce(mpi.product_url,''))) > 8
       and ${domainScope.sql}
       and mpi.source_stock_checked_at is not null
       and mpi.source_stock_checked_at >= $${sinceParam}::timestamptz
       and mpi.source_stock_status = 'out_of_stock'`,
    [partnerId, ...domainScope.params, since]
  )
  return rows.map((r) => r.id)
}

export async function clearOosFlagsFromPg(partnerId: string, ids: string[]): Promise<{ cleared: number; restored: number }> {
  if (!ids.length) return { cleared: 0, restored: 0 }
  const pool = getPgPool()
  const rest = await pool.query(
    `update public.messaging_partner_inventory
     set stock_qty = $3
     where partner_id = $1::uuid and id = any($2::uuid[])
       and source_stock_status = 'out_of_stock'
       and coalesce(stock_qty,0) <= 0`,
    [partnerId, ids, SOURCE_STOCK_OOS_RESTORE_QTY]
  )
  const clr = await pool.query(
    `update public.messaging_partner_inventory
     set source_stock_status = 'unknown',
         source_stock_error = null,
         source_stock_checked_at = null,
         source_stock_next_check_at = null,
         source_stock_check_platform = null,
         updated_at = now()
     where partner_id = $1::uuid and id = any($2::uuid[])
       and source_stock_status = 'out_of_stock'`,
    [partnerId, ids]
  )
  bumpInventoryCacheLater(partnerId)
  return { cleared: clr.rowCount ?? 0, restored: rest.rowCount ?? 0 }
}
