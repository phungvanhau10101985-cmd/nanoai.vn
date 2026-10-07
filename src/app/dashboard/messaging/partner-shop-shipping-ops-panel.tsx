'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import type { WebLocale } from '@/lib/i18n/config'
import { partnerShippingOpsCopy, type PartnerShippingOpsCopy } from '@/lib/i18n/partner-shipping-ops-copy'
import { messagingSettingsSectionHref } from '@/lib/messaging/messaging-settings-section-href'
import type { OpsBucketKey, PartnerEmsRecord, EmsImportSummary, EmsTrackingEvent } from '@/lib/messaging/shipping/ems-types'
import { Loader2 } from 'lucide-react'

type OpsStats = {
  total_ems_records: number
  total_with_cod: number
  in_transit_count: number
  delivered_count: number
  returned_count: number
  pending_status_count: number
  shop_return_received_count: number
  return_shop_received_count?: number
  total_cod_sum: number
  in_transit_cod_total: number
  delivered_cod_total: number
  returned_cod_total: number
  pending_cod_total: number
  return_shop_received_cod_total: number
  cod_in_transit_unpaid_count: number
  cod_delivered_unpaid_count: number
  cod_paid_count: number
  cod_returned_unpaid_count: number
  freight_unsettled_count: number
  shop_linked_count: number
  shop_shipping_orders: number
  cod_in_transit_unpaid_total: number
  cod_delivered_unpaid_total: number
  cod_paid_total: number
  cod_returned_unpaid_total: number
}

type TimelineItem = {
  period_key: string
  period_label: string
  period_start?: string
  period_end?: string
  total?: number
  in_transit_count?: number
  in_transit_cod_total?: number
  delivered_count?: number
  delivered_cod_total?: number
  returned_count?: number
  returned_cod_total?: number
  return_shop_received_count?: number
  return_shop_received_cod_total?: number
  pending_status_count?: number
  pending_cod_total?: number
  total_cod_sum?: number
  total_with_cod?: number
  cod_delivered_unpaid_count?: number
  cod_delivered_unpaid_total?: number
  cod_paid_count?: number
  cod_paid_total?: number
  total_cod_amount?: number
  cod_received_count?: number
  cod_received_total?: number
  return_received_count?: number
  return_received_cod_total?: number
}

type TrackingJob = {
  job_id: string
  status: string
  total: number
  processed: number
  ok: number
  message: string
}

const PAGE_SIZES = [25, 50, 100] as const
const EXCEL_ACCEPT = '.xls,.xlsx,.xlsm'

type ReturnRow = {
  input: string
  status: string
  message: string
  order_code?: string | null
  ems_tracking_code?: string | null
  ems_status?: string | null
  product_code?: string | null
  order_id?: string | null
  order_status?: string | null
}

type WarehouseInv = {
  id?: string
  sku?: string
  name?: string
  stock_qty?: number
  is_clearance?: boolean
  image_url?: string
  price_amount?: number
  colors?: string[]
  sizes?: string[]
  parsed_size?: string
  parsed_color?: string
  parsed_base?: string
  parsed_color_image_index?: number | null
  parsed_color_image_url?: string
}

type CodRow = {
  row_number?: number
  ems_reference_code?: string | null
  ems_tracking_code?: string | null
  paid_amount?: number | null
  db_cod_amount?: number | null
  amount_difference?: number | null
  reconcile_status?: string
  reconcile_message?: string | null
}

type FreightRow = {
  row_number?: number
  ems_tracking_code?: string | null
  freight_amount?: number | null
  high_fee_warning?: string | null
  reconcile_status?: string
  reconcile_message?: string | null
}

function vnd(n: number | null | undefined): string {
  return `${Math.round(Number(n || 0)).toLocaleString('vi-VN')} đ`
}

function OrderCodeLink({ partnerId, code }: { partnerId: string; code?: string | null }) {
  const value = String(code || '').trim()
  if (!value) return <>{'—'}</>
  return (
    <Link
      href={messagingSettingsSectionHref('hub-orders', partnerId, { q: value })}
      className="font-medium text-emerald-700 underline-offset-2 hover:underline"
    >
      {value}
    </Link>
  )
}

function CountBtn({
  n,
  onClick,
  className,
}: {
  n: number
  onClick: () => void
  className?: string
}) {
  const tone = className || 'text-primary'
  if (!n) return <span className={`tabular-nums text-muted-foreground ${tone}`}>0</span>
  return (
    <button
      type="button"
      className={`tabular-nums font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid ${tone}`}
      onClick={onClick}
    >
      {n.toLocaleString('vi-VN')}
    </button>
  )
}

function TimelineMoney({
  n,
  amount,
  onClick,
  countClass,
  amountClass,
}: {
  n: number
  amount: number | null | undefined
  onClick: () => void
  countClass?: string
  amountClass?: string
}) {
  const money = Number(amount || 0)
  return (
    <div className="flex flex-col items-end gap-0.5">
      <CountBtn n={n} onClick={onClick} className={countClass} />
      <span className={`whitespace-nowrap text-[10px] tabular-nums ${money > 0 ? amountClass || 'text-muted-foreground' : 'text-muted-foreground'}`}>
        {vnd(money)}
      </span>
    </div>
  )
}

function periodRangeLabel(start?: string, end?: string): string | null {
  if (!start || !end || start === end) return null
  const day = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
  return `${day(start)} – ${day(end)}/${end.slice(0, 4)}`
}

function moneyOrDash(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return vnd(n)
}
function syncLabel(t: PartnerShippingOpsCopy, status: string): string {
  switch (status) {
    case 'matched':
      return t.syncMatched
    case 'in_progress':
      return t.syncInProgress
    case 'mismatch':
      return t.syncMismatch
    case 'unlinked':
    case 'order_not_found':
      return t.syncUnlinked
    case 'ems_not_found':
      return t.syncEmsMissing
    case 'parse_error':
      return t.syncParseError
    default:
      return status || '—'
  }
}

function syncBadgeClass(status: string): string {
  if (status === 'matched') return 'border-emerald-200 bg-emerald-100 text-emerald-800'
  if (status === 'in_progress') return 'border-blue-200 bg-blue-100 text-blue-800'
  if (status === 'mismatch') return 'border-amber-200 bg-amber-100 text-amber-900'
  if (status === 'unlinked' || status === 'order_not_found') return 'border-slate-200 bg-slate-100 text-slate-800'
  if (status === 'ems_not_found') return 'border-orange-200 bg-orange-100 text-orange-900'
  if (status === 'parse_error') return 'border-gray-200 bg-gray-100 text-gray-800'
  return 'border-border bg-muted text-muted-foreground'
}

const EMS_SEARCH_PREVIEW = 5

function formatCodAmount(amount: number | null | undefined, noneLabel: string): string {
  if (amount == null || !Number.isFinite(amount)) return '—'
  if (amount === 0) return noneLabel
  return vnd(amount)
}

function formatCodPaidDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim())
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  return raw.trim()
}

function shopOrderStatusText(t: PartnerShippingOpsCopy, status: string | null | undefined): string {
  const key = (status || '').trim().toLowerCase()
  if (!key) return '—'
  const g = t.grid
  const map: Record<string, string> = {
    pending: g.stPending,
    waiting_deposit: g.stDeposit,
    deposit_paid: g.stAwaitShip,
    confirmed: g.stAwaitShip,
    processing: g.stAwaitShip,
    paid_verified: g.stAwaitShip,
    shipping: g.stShipping,
    delivered: g.stReceived,
    completed: g.stReviewed,
    returned: g.stReturned,
    cancelled: g.stCancelled,
  }
  return map[key] || status || '—'
}

function shopStatusBadgeClass(status: string | null | undefined): string {
  const key = (status || '').trim().toLowerCase()
  if (key === 'shipping') return 'border-indigo-200 bg-indigo-100 text-indigo-900'
  if (key === 'delivered' || key === 'completed') return 'border-emerald-200 bg-emerald-100 text-emerald-800'
  if (key === 'cancelled') return 'border-red-200 bg-red-100 text-red-800'
  if (key === 'waiting_deposit') return 'border-amber-200 bg-amber-100 text-amber-900'
  if (['deposit_paid', 'confirmed', 'processing', 'paid_verified'].includes(key)) return 'border-blue-200 bg-blue-100 text-blue-800'
  if (key === 'returned') return 'border-orange-200 bg-orange-100 text-orange-900'
  return 'border-gray-200 bg-gray-100 text-gray-800'
}

function emsShopStatusText(t: PartnerShippingOpsCopy, row: PartnerEmsRecord): string {
  if (row.return_to_shop_label) return row.return_to_shop_label
  const st = (row.shop_order_status || row.order_status || '').toLowerCase()
  if (!st) return row.order_code && !row.order_id ? t.grid.unlinkedOrder : '—'
  const linked = Boolean(row.order_id && (row.reference_code || row.ems_reference_code))
  if (linked && st === 'shipping') return t.searchCard.shopDelivering
  if (st === 'delivered') return t.searchCard.shopReceived
  if (st === 'completed') return t.searchCard.shopReviewed
  if (linked && ['deposit_paid', 'confirmed', 'processing', 'paid_verified'].includes(st)) return t.searchCard.shopSentEms
  return shopOrderStatusText(t, st)
}

function codReconcileLabel(t: PartnerShippingOpsCopy, status: string | null | undefined): string {
  const g = t.grid
  if (status === 'matched') return g.codMatch
  if (status === 'amount_mismatch') return g.codMismatch
  if (status === 'record_not_found') return g.codMissing
  if (status === 'parse_error') return g.codParse
  return status || '—'
}

function codReconcileBadge(status: string | null | undefined): string {
  if (status === 'matched') return 'border-emerald-200 bg-emerald-100 text-emerald-800'
  if (status === 'amount_mismatch') return 'border-amber-200 bg-amber-100 text-amber-900'
  if (status === 'record_not_found') return 'border-red-200 bg-red-100 text-red-800'
  return 'border-gray-200 bg-gray-100 text-gray-800'
}

function freightReconcileLabel(t: PartnerShippingOpsCopy, status: string | null | undefined): string {
  const g = t.grid
  if (status === 'settled') return g.freightDone
  if (status === 'already_settled') return g.freightAlready
  if (status === 'record_not_found') return g.codMissing
  if (status === 'parse_error') return g.codParse
  return status || '—'
}

function freightReconcileBadge(status: string | null | undefined): string {
  if (status === 'settled') return 'border-emerald-200 bg-emerald-100 text-emerald-800'
  if (status === 'already_settled') return 'border-orange-200 bg-orange-100 text-orange-900'
  if (status === 'record_not_found') return 'border-red-200 bg-red-100 text-red-800'
  return 'border-gray-200 bg-gray-100 text-gray-800'
}

function returnResultBadge(t: PartnerShippingOpsCopy, status: string): { label: string; badge: string } {
  const g = t.grid
  if (status === 'ready_to_confirm') return { label: g.returnReady, badge: 'border-emerald-200 bg-emerald-50 text-emerald-800' }
  if (status === 'confirmed' || status === 'already_returned') return { label: g.returnDone, badge: 'border-amber-200 bg-amber-100 text-amber-900' }
  if (status === 'duplicate') return { label: g.returnDup, badge: 'border-slate-200 bg-slate-100 text-slate-700' }
  return { label: g.returnNotReady, badge: 'border-slate-200 bg-slate-100 text-slate-800' }
}

function importActionBadge(t: PartnerShippingOpsCopy, action: string): { label: string; badge: string } | null {
  if (action === 'created') return { label: t.grid.importCreated, badge: 'border-emerald-200 bg-emerald-100 text-emerald-800' }
  if (action === 'updated') return { label: t.grid.importUpdated, badge: 'border-blue-200 bg-blue-100 text-blue-800' }
  return null
}

function highFeeOn(flag: string | null | undefined): boolean {
  return flag === '1' || flag === 'yes'
}

function emsTimelineText(t: PartnerShippingOpsCopy, step: string | null | undefined): string {
  if (!step) return '—'
  const map: Record<string, string> = {
    deposit_confirmed: t.searchCard.timelineDeposit,
    confirmed: t.searchCard.timelineDeposit,
    tq_preparing: t.searchCard.timelinePreparing,
    tq_warehouse: t.searchCard.timelineTqWarehouse,
    international_shipping: t.searchCard.timelineIntl,
    at_customs: t.searchCard.timelineCustoms,
    domestic_shipping: t.searchCard.timelineDomestic,
    vn_picking: t.searchCard.timelinePicking,
    vn_packed: t.searchCard.timelinePacked,
    awaiting_confirm: t.searchCard.timelineAwaiting,
  }
  return map[step] || step
}

function codCollectedPending(row: PartnerEmsRecord): boolean {
  if ((row.cod_settlement_status || '').trim().toLowerCase() === 'matched') return false
  if (!row.cod_amount || row.cod_amount <= 0) return false
  const phase = (row.ems_phase || '').trim().toLowerCase()
  const status = (row.ems_status || '').toLowerCase()
  return (
    phase === 'cod_collected' ||
    phase === 'delivered' ||
    status.includes('phát thành công') ||
    status.includes('[cod]đã thu tiền') ||
    status.includes('đã thu tiền bưu tá')
  )
}

function SearchDetail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{children}</dd>
    </div>
  )
}

function EmsSearchResultCard({
  partnerId,
  row,
  t,
  refreshing,
  onViewStatus,
  onRefresh,
}: {
  partnerId: string
  row: PartnerEmsRecord
  t: PartnerShippingOpsCopy
  refreshing: boolean
  onViewStatus: (row: PartnerEmsRecord) => void
  onRefresh: (id: string) => void
}) {
  const c = t.searchCard
  const paidDate = (row.cod_settlement_status || '').trim().toLowerCase() === 'matched' ? formatCodPaidDate(row.cod_paid_date) : null
  const paidAmount = (row.cod_settlement_status || '').trim().toLowerCase() === 'matched' ? row.cod_paid_amount ?? row.cod_amount : null
  return (
    <article className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-mono font-semibold text-gray-900">{row.reference_code || '—'}</div>
          <div className="mt-0.5 text-sm text-gray-600">
            {row.order_code ? (
              row.order_id ? (
                <Link
                  href={messagingSettingsSectionHref('hub-orders', partnerId, { q: row.order_code })}
                  className="font-medium text-emerald-700 hover:underline"
                >
                  {row.order_code}
                </Link>
              ) : (
                <span className="font-medium">{row.order_code}</span>
              )
            ) : (
              <span className="text-gray-500">{c.noShopOrder}</span>
            )}
          </div>
        </div>
        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${syncBadgeClass(row.sync_status)}`}>
          {syncLabel(t, row.sync_status)}
        </span>
      </div>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        <SearchDetail label={c.fieldEmsCode}>{row.ems_tracking_code || '—'}</SearchDetail>
        <SearchDetail label={c.fieldSavedTracking}>{row.tracking_number_saved || '—'}</SearchDetail>
        <SearchDetail label={c.fieldCod}>{formatCodAmount(row.cod_amount, c.codNone)}</SearchDetail>
        <SearchDetail label={c.fieldCodPaid}>
          {paidAmount == null && !paidDate ? '—' : (
            <>
              <span>{paidAmount == null ? '—' : vnd(paidAmount)}</span>
              {paidDate ? <span className="mt-0.5 block text-xs font-medium text-emerald-700">{c.codPaidOn.replace('{date}', paidDate)}</span> : null}
            </>
          )}
          {codCollectedPending(row) ? (
            <span className="mt-0.5 block text-xs font-medium text-amber-800">{c.codCollectedPending}</span>
          ) : null}
        </SearchDetail>
        <SearchDetail label={c.fieldFreight}>{row.freight_amount == null ? '—' : vnd(row.freight_amount)}</SearchDetail>
        <SearchDetail label={c.fieldEmsStatus}>
          {row.ems_status || row.ems_error || '—'}
          {row.ems_phase ? ` (${row.ems_phase})` : ''}
        </SearchDetail>
        <SearchDetail label={c.fieldShopStatus}>{emsShopStatusText(t, row)}</SearchDetail>
        <SearchDetail label={c.fieldRecipient}>
          <span className="line-clamp-2">{row.recipient_label || row.shop_customer_name || '—'}</span>
        </SearchDetail>
        {row.current_step_key ? <SearchDetail label={c.fieldTimeline}>{emsTimelineText(t, row.current_step_key)}</SearchDetail> : null}
      </dl>
      {row.sync_message ? (
        <p className="rounded-lg border border-emerald-100 bg-white/70 px-3 py-2 text-xs text-gray-600">{row.sync_message}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        {row.order_code ? (
          <button type="button" className="text-sm font-medium text-emerald-700 hover:text-emerald-900 hover:underline" onClick={() => onViewStatus(row)}>
            {c.viewShopStatus}
          </button>
        ) : null}
        <button
          type="button"
          className="text-sm font-medium text-indigo-700 hover:text-indigo-900 hover:underline disabled:opacity-50"
          disabled={refreshing}
          onClick={() => onRefresh(row.id)}
        >
          {refreshing ? c.refreshing : t.trackingRefresh}
        </button>
      </div>
    </article>
  )
}

function formatEmsEventAt(raw: string | null | undefined): string {
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleString('vi-VN')
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count?: number
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
        active ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted/40'
      }`}
    >
      {label}
      {count != null ? ` (${count})` : ''}
    </button>
  )
}

function StatCard({
  label,
  count,
  amount,
  active,
  onClick,
}: {
  label: string
  count: number
  amount?: number
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-left transition ${
        active ? 'border-primary bg-primary/5' : 'border-border/70 bg-background hover:bg-muted/40'
      }`}
    >
      <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{count.toLocaleString('vi-VN')}</p>
      {amount != null ? <p className="text-[11px] tabular-nums text-muted-foreground">{vnd(amount)}</p> : null}
    </button>
  )
}

export function PartnerShopShippingOpsPanel({
  partnerId,
  locale,
}: {
  partnerId: string
  locale: WebLocale
}) {
  const t = partnerShippingOpsCopy(locale)
  const { toast } = useToast()
  const api = useMemo(() => `/api/messaging/partners/${encodeURIComponent(partnerId)}/shipping`, [partnerId])

  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [loadedQuery, setLoadedQuery] = useState('')
  const [rows, setRows] = useState<PartnerEmsRecord[]>([])
  const [total, setTotal] = useState(0)
  const [skip, setSkip] = useState(0)
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(50)
  const [listLoading, setListLoading] = useState(false)
  const [opsStats, setOpsStats] = useState<OpsStats | null>(null)
  const [opsLoading, setOpsLoading] = useState(false)
  const [timeline, setTimeline] = useState<{ items: TimelineItem[]; granularity: string; available_years?: number[] } | null>(null)
  const [received, setReceived] = useState<{ items: TimelineItem[]; granularity: string } | null>(null)
  const [granularity, setGranularity] = useState<'year' | 'month' | 'week' | 'day'>('month')
  const [timelinePreset, setTimelinePreset] = useState<string>('')
  const [timelineYear, setTimelineYear] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [activeBucket, setActiveBucket] = useState<{
    key: OpsBucketKey
    label: string
    axis: 'ops' | 'import' | 'received'
    periodKey?: string
    periodLabel?: string
  } | null>(null)
  const [bucketRows, setBucketRows] = useState<PartnerEmsRecord[]>([])
  const [bucketSkip, setBucketSkip] = useState(0)
  const [bucketTotal, setBucketTotal] = useState(0)
  const [bucketLoading, setBucketLoading] = useState(false)
  const [listSummary, setListSummary] = useState<EmsImportSummary | null>(null)
  const [statusModal, setStatusModal] = useState<{
    row: PartnerEmsRecord
    events: EmsTrackingEvent[]
    loading: boolean
    error?: string | null
    current?: string | null
  } | null>(null)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [job, setJob] = useState<TrackingJob | null>(null)
  const [busy, setBusy] = useState('')
  const [returnText, setReturnText] = useState('')
  const [returnPreview, setReturnPreview] = useState<ReturnRow[]>([])
  const [warehouseCode, setWarehouseCode] = useState('')
  const [warehouseQty, setWarehouseQty] = useState('1')
  const [warehouseClearance, setWarehouseClearance] = useState(true)
  const emsFileRef = useRef<HTMLInputElement>(null)
  const jobResumeRef = useRef(false)
  const codFileRef = useRef<HTMLInputElement>(null)
  const freightFileRef = useRef<HTMLInputElement>(null)
  const returnFileRef = useRef<HTMLInputElement>(null)
  const [emsFile, setEmsFile] = useState<File | null>(null)
  const [codFile, setCodFile] = useState<File | null>(null)
  const [freightFile, setFreightFile] = useState<File | null>(null)
  const [importBatches, setImportBatches] = useState<Array<Record<string, unknown>>>([])
  const [codBatches, setCodBatches] = useState<Array<Record<string, unknown>>>([])
  const [freightBatches, setFreightBatches] = useState<Array<Record<string, unknown>>>([])
  const [selectedEmsBatchId, setSelectedEmsBatchId] = useState('')
  const [selectedCodBatchId, setSelectedCodBatchId] = useState('')
  const [selectedFreightBatchId, setSelectedFreightBatchId] = useState('')
  const [codFilter, setCodFilter] = useState('')
  const [freightFilter, setFreightFilter] = useState('')
  const [syncStatus, setSyncStatus] = useState('')
  const [emsTableExpanded, setEmsTableExpanded] = useState(false)
  const [returnCounts, setReturnCounts] = useState<{ confirmable: number; already: number; error: number } | null>(null)
  const [warehouseLookup, setWarehouseLookup] = useState<{ sku: string | null; error?: string | null; inventory?: WarehouseInv | null } | null>(null)
  const [warehouseSize, setWarehouseSize] = useState('')
  const [warehouseColor, setWarehouseColor] = useState('')
  const [warehouseAfter, setWarehouseAfter] = useState<string>('')

  const timelineQs = useMemo(() => {
    const q = new URLSearchParams({ granularity })
    if (timelinePreset) q.set('preset', timelinePreset)
    if (timelineYear) q.set('year', timelineYear)
    if (dateFrom) q.set('date_from', dateFrom)
    if (dateTo) q.set('date_to', dateTo)
    return q.toString()
  }, [dateFrom, dateTo, granularity, timelinePreset, timelineYear])

  const jsonGet = useCallback(
    async (path: string) => {
      const res = await fetch(`${api}/${path}`)
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
      if (!res.ok) throw new Error(String(data?.detail || data?.error || t.loadError))
      return data || {}
    },
    [api, t.loadError],
  )

  const loadList = useCallback(async () => {
    setListLoading(true)
    try {
      const q = new URLSearchParams({ skip: String(skip), limit: String(pageSize) })
      if (appliedSearch) q.set('q', appliedSearch)
      if (syncStatus) q.set('sync_status', syncStatus)
      const data = await jsonGet(`ems-records?${q.toString()}`)
      setRows((data.rows as PartnerEmsRecord[]) || [])
      setTotal(Number((data.pagination as { total?: number } | undefined)?.total || 0))
      setListSummary((data.summary as EmsImportSummary) || null)
      setLoadedQuery(appliedSearch)
    } catch (err) {
      setRows([])
      setTotal(0)
      setLoadedQuery(appliedSearch)
      toast({ title: err instanceof Error ? err.message : t.loadError, variant: 'destructive' })
    } finally {
      setListLoading(false)
    }
  }, [appliedSearch, jsonGet, pageSize, skip, syncStatus, t.loadError, toast])

  const loadOps = useCallback(async () => {
    setOpsLoading(true)
    try {
      const [stats, tl, recv, batches, cod, freight] = await Promise.all([
        jsonGet('operations-stats'),
        jsonGet(`operations-stats/timeline?${timelineQs}`),
        jsonGet(`operations-stats/received-timeline?${timelineQs}`),
        jsonGet('ems-import-batches?limit=12'),
        jsonGet('cod-settlement-batches'),
        jsonGet('freight-settlement-batches'),
      ])
      setOpsStats(stats as unknown as OpsStats)
      setTimeline({ items: (tl.items as TimelineItem[]) || [], granularity: String(tl.granularity || granularity), available_years: (tl.available_years as number[]) || [] })
      setReceived({ items: (recv.items as TimelineItem[]) || [], granularity: String(recv.granularity || granularity) })
      setAvailableYears((tl.available_years as number[]) || [])
      const emsList = (batches.batches as Array<Record<string, unknown>>) || []
      const codList = (cod.batches as Array<Record<string, unknown>>) || []
      const freightList = (freight.batches as Array<Record<string, unknown>>) || []
      setImportBatches(emsList)
      setCodBatches(codList)
      setFreightBatches(freightList)
      setSelectedEmsBatchId((prev) => (prev && emsList.some((b) => String(b.id) === prev) ? prev : String(emsList[0]?.id || '')))
      setSelectedCodBatchId((prev) => (prev && codList.some((b) => String(b.id) === prev) ? prev : String(codList[0]?.id || '')))
      setSelectedFreightBatchId((prev) =>
        prev && freightList.some((b) => String(b.id) === prev) ? prev : String(freightList[0]?.id || ''),
      )
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : t.loadError, variant: 'destructive' })
    } finally {
      setOpsLoading(false)
    }
  }, [jsonGet, t.loadError, timelineQs, toast])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    void loadOps()
  }, [loadOps])

  const pollJob = useCallback(
    async (jobId: string) => {
      try {
        sessionStorage.setItem(`pw-ems-tracking-job:${partnerId}`, jobId)
      } catch {
        /* ignore */
      }
      for (let i = 0; i < 200; i += 1) {
        const data = (await jsonGet(`ems-tracking-refresh/job/${encodeURIComponent(jobId)}`)) as TrackingJob
        setJob(data)
        if (data.status === 'done' || data.status === 'error') {
          try {
            sessionStorage.removeItem(`pw-ems-tracking-job:${partnerId}`)
          } catch {
            /* ignore */
          }
          break
        }
        await new Promise((r) => setTimeout(r, 800))
      }
      await loadList()
      await loadOps()
    },
    [jsonGet, loadList, loadOps, partnerId],
  )

  useEffect(() => {
    if (jobResumeRef.current) return
    jobResumeRef.current = true
    void (async () => {
      try {
        const data = await jsonGet('ems-tracking-refresh/active')
        const active = data.job as TrackingJob | null
        if (active?.job_id && active.status !== 'done' && active.status !== 'error') {
          setJob(active)
          await pollJob(active.job_id)
          return
        }
      } catch {
        /* no active job */
      }
      try {
        const stored = sessionStorage.getItem(`pw-ems-tracking-job:${partnerId}`)
        if (stored) await pollJob(stored)
      } catch {
        /* ignore */
      }
    })()
  }, [jsonGet, partnerId, pollJob])

  const submitSearch = (e: FormEvent) => {
    e.preventDefault()
    const next = searchInput.trim()
    setSkip(0)
    setAppliedSearch(next)
    if (next) void refreshTracking(undefined, { q: next, nonTerminalOnly: true, quietEmpty: true })
  }

  const openRecords = async (opts: {
    key: OpsBucketKey
    label: string
    axis?: 'ops' | 'import' | 'received'
    periodKey?: string
    periodLabel?: string
    skip?: number
  }) => {
    const axis = opts.axis || 'ops'
    const skip = opts.skip ?? 0
    setActiveBucket({ key: opts.key, label: opts.label, axis, periodKey: opts.periodKey, periodLabel: opts.periodLabel })
    setBucketSkip(skip)
    setBucketLoading(true)
    try {
      const q = new URLSearchParams({ bucket: opts.key, skip: String(skip), limit: '25' })
      let path = `operations-stats/records?${q.toString()}`
      if (axis === 'import') {
        q.set('period_key', opts.periodKey || '')
        path = `operations-stats/timeline/records?${timelineQs}&${q.toString()}`
      } else if (axis === 'received') {
        q.set('period_key', opts.periodKey || '')
        path = `operations-stats/received-timeline/records?${timelineQs}&${q.toString()}`
      }
      const data = await jsonGet(path)
      setBucketRows((data.rows as PartnerEmsRecord[]) || [])
      setBucketTotal(Number((data.pagination as { total?: number } | undefined)?.total || 0))
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : t.loadError, variant: 'destructive' })
    } finally {
      setBucketLoading(false)
    }
  }

  const openBucket = async (key: OpsBucketKey, label: string) => {
    await openRecords({ key, label, axis: 'ops' })
  }

  const refreshOne = async (id: string) => {
    setBusy(`one-${id}`)
    try {
      const res = await fetch(`${api}/refresh-one`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record_id: id }),
      })
      const data = (await res.json().catch(() => null)) as { row?: PartnerEmsRecord; detail?: string }
      if (!res.ok) throw new Error(data?.detail || t.loadError)
      if (data.row) {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...data.row } : r)))
        setBucketRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...data.row } : r)))
      }
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : t.loadError, variant: 'destructive' })
    } finally {
      setBusy('')
    }
  }

  const viewStatus = async (row: PartnerEmsRecord) => {
    setStatusModal({ row, events: [], loading: true, current: row.ems_status })
    try {
      const data = await jsonGet(`ems-live-tracking?record_id=${encodeURIComponent(row.id)}`)
      const tracking = (data.tracking || {}) as { events?: EmsTrackingEvent[]; error?: string | null; current_status_description?: string | null }
      setStatusModal({
        row,
        events: tracking.events || [],
        loading: false,
        error: tracking.error,
        current: tracking.current_status_description || row.ems_status,
      })
    } catch (err) {
      setStatusModal({
        row,
        events: [],
        loading: false,
        error: err instanceof Error ? err.message : t.loadError,
        current: row.ems_status,
      })
    }
  }

  const downloadSample = async (path: string) => {
    const res = await fetch(`${api}/${path}`)
    if (!res.ok) {
      toast({ title: t.loadError, variant: 'destructive' })
      return
    }
    const blob = await res.blob()
    const cd = res.headers.get('Content-Disposition') || ''
    const match = /filename="([^"]+)"/.exec(cd)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = match?.[1] || 'sample.xlsx'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const applyReturnRows = (
    data: {
      rows?: ReturnRow[]
      confirmable_count?: number
      already_returned_count?: number
      error_count?: number
      confirmed?: number
      confirmed_count?: number
    },
    opts?: { fillWarehouse?: boolean },
  ) => {
    setReturnPreview(data.rows || [])
    setReturnCounts({
      confirmable: Number(data.confirmable_count ?? data.confirmed_count ?? data.confirmed ?? 0),
      already: Number(data.already_returned_count || 0),
      error: Number(data.error_count || 0),
    })
    if (!opts?.fillWarehouse) return
    const last = [...(data.rows || [])].reverse().find((r) => r.status === 'confirmed' || r.status === 'ready_to_confirm')
    if (last?.product_code || last?.input) setWarehouseCode(String(last.product_code || last.input))
  }

  useEffect(() => {
    const text = returnText.trim()
    if (!text) {
      setReturnPreview([])
      setReturnCounts(null)
      return
    }
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`${api}/shop-return-preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: returnText }),
          })
          const data = (await res.json()) as {
            rows?: ReturnRow[]
            confirmable_count?: number
            already_returned_count?: number
            error_count?: number
          }
          applyReturnRows(data)
        } catch {
          /* keep last preview */
        }
      })()
    }, 400)
    return () => window.clearTimeout(timer)
  }, [api, returnText])

  useEffect(() => {
    const code = warehouseCode.trim()
    if (code.length < 2) {
      setWarehouseLookup(null)
      return
    }
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const data = await jsonGet(`return-warehouse-lookup?sku=${encodeURIComponent(code)}`)
          const inv = (data.inventory as WarehouseInv | null) || null
          setWarehouseLookup({ sku: (data.sku as string | null) || null, error: (data.error as string | null) || null, inventory: inv })
          if (inv?.parsed_size) setWarehouseSize(inv.parsed_size)
          if (inv?.parsed_color) setWarehouseColor(inv.parsed_color)
        } catch (err) {
          setWarehouseLookup({ sku: null, error: err instanceof Error ? err.message : t.loadError, inventory: null })
        }
      })()
    }, 400)
    return () => window.clearTimeout(timer)
  }, [jsonGet, t.loadError, warehouseCode])

  const postFile = async (path: string, file: File | null) => {
    if (!file) return
    setBusy(path)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${api}/${path}`, { method: 'POST', body: form })
      const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
      if (!res.ok) throw new Error(String(data?.detail || data?.error || t.loadError))
      toast({ title: String((data?.warnings as string[] | undefined)?.[0] || t.importRun) })
      if (path === 'ems-import') {
        const jobId = String(data?.tracking_refresh_job_id || (data?.tracking_job as TrackingJob | undefined)?.job_id || '')
        const report = data?.import_report as { rows?: PartnerEmsRecord[] } | undefined
        if (report?.rows?.length) {
          setImportBatches((prev) => [
            { id: String((data?.import_batch as { id?: string } | undefined)?.id || 'latest'), import_report: report, created_count: data?.created, updated_count: data?.updated, source_filename: file.name },
            ...prev,
          ])
          setSelectedEmsBatchId(String((data?.import_batch as { id?: string } | undefined)?.id || 'latest'))
        }
        if (jobId) void pollJob(jobId)
      }
      if (path === 'cod-settlement-import' && data?.import_batch) {
        const batch = data.import_batch as Record<string, unknown>
        setCodBatches((prev) => [batch, ...prev.filter((b) => String(b.id) !== String(batch.id))])
        setSelectedCodBatchId(String(batch.id || ''))
        setCodFilter('')
      }
      if (path === 'freight-settlement-import' && data?.import_batch) {
        const batch = data.import_batch as Record<string, unknown>
        setFreightBatches((prev) => [batch, ...prev.filter((b) => String(b.id) !== String(batch.id))])
        setSelectedFreightBatchId(String(batch.id || ''))
        setFreightFilter('')
      }
      if (path === 'shop-return-confirm-import') {
        applyReturnRows(
          data as {
            rows?: ReturnRow[]
            confirmable_count?: number
            already_returned_count?: number
            error_count?: number
            confirmed?: number
            confirmed_count?: number
          },
          { fillWarehouse: true },
        )
      }
      await loadList()
      await loadOps()
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : t.loadError, variant: 'destructive' })
    } finally {
      setBusy('')
    }
  }

  const refreshTracking = async (
    ids?: string[],
    extra?: { q?: string; nonTerminalOnly?: boolean; quietEmpty?: boolean },
  ) => {
    const picked = ids?.length ? ids : []
    const query = extra?.q ?? appliedSearch
    const useFilter = !picked.length && Boolean(query || syncStatus)
    if (!picked.length && !useFilter) {
      toast({ title: t.selectRowsToTrack, variant: 'destructive' })
      return
    }
    setBusy('tracking')
    try {
      const res = await fetch(`${api}/ems-tracking-refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          picked.length
            ? { record_ids: picked, source: 'manual' }
            : {
                q: query || '',
                sync_status: extra?.q ? undefined : syncStatus || undefined,
                non_terminal_only: extra?.nonTerminalOnly ? true : undefined,
                source: extra?.nonTerminalOnly ? 'search' : 'manual',
              },
        ),
      })
      const data = (await res.json().catch(() => null)) as
        | (TrackingJob & { queued?: number })
        | { detail?: string; error?: string; job_id?: string | null; queued?: number }
        | null
      const jobId = data && 'job_id' in data ? data.job_id : null
      if (!res.ok || !jobId) {
        if (extra?.quietEmpty && res.ok) return
        const detail = data && 'detail' in data ? data.detail : undefined
        const errText = data && 'error' in data ? data.error : undefined
        throw new Error(detail || errText || t.loadError)
      }
      setJob(data as TrackingJob)
      await pollJob(jobId)
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : t.loadError, variant: 'destructive' })
    } finally {
      setBusy('')
    }
  }

  const deleteIds = async (ids: string[]) => {
    if (!ids.length) return
    if (!window.confirm(t.confirmDelete)) return
    setBusy('delete')
    try {
      const res = await fetch(`${api}/ems-records`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const data = (await res.json().catch(() => null)) as { deleted?: number; detail?: string }
      if (!res.ok) throw new Error(data?.detail || t.loadError)
      setSelected((prev) => {
        const next = { ...prev }
        for (const id of ids) delete next[id]
        return next
      })
      toast({ title: t.deletedCount.replace('{n}', String(data.deleted || 0)) })
      await loadList()
      await loadOps()
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : t.loadError, variant: 'destructive' })
    } finally {
      setBusy('')
    }
  }

  const selectedIds = Object.entries(selected).filter(([, v]) => v).map(([id]) => id)
  const page = Math.floor(skip / pageSize) + 1
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const emsBatch = importBatches.find((b) => String(b.id) === selectedEmsBatchId) || importBatches[0]
  const emsReportRows = ((emsBatch?.import_report as { rows?: PartnerEmsRecord[] } | undefined)?.rows || []) as Array<Record<string, unknown>>
  const codBatch = codBatches.find((b) => String(b.id) === selectedCodBatchId) || codBatches[0]
  const freightBatch = freightBatches.find((b) => String(b.id) === selectedFreightBatchId) || freightBatches[0]
  const codRows = ((codBatch?.rows as CodRow[]) || []).filter((r) => !codFilter || r.reconcile_status === codFilter)
  const freightRows = ((freightBatch?.rows as FreightRow[]) || []).filter((r) => {
    if (!freightFilter) return true
    if (freightFilter === 'high_fee') return highFeeOn(r.high_fee_warning)
    return r.reconcile_status === freightFilter
  })
  const inv = warehouseLookup?.inventory
  const warehouseSizes = inv?.sizes?.length ? inv.sizes : inv?.parsed_size ? [inv.parsed_size] : []
  const warehouseColors = inv?.colors?.length ? inv.colors : inv?.parsed_color ? [inv.parsed_color] : []
  const searchPending = Boolean(appliedSearch) && (listLoading || loadedQuery !== appliedSearch)
  const searchReady = Boolean(appliedSearch) && loadedQuery === appliedSearch && !listLoading
  const previewRows = searchReady && skip === 0 ? rows.slice(0, EMS_SEARCH_PREVIEW) : []
  const applySyncFilter = (key: string) => {
    setSyncStatus(key === 'order_not_found' ? 'unlinked' : key)
    setSkip(0)
    setEmsTableExpanded(true)
  }
  const granLabel = {
    year: t.grid.granYear,
    month: t.grid.granMonth,
    week: t.grid.granWeek,
    day: t.grid.granDay,
  }[granularity]
  const displayFrom = total ? skip + 1 : 0
  const displayTo = Math.min(skip + rows.length, total)

  const composeWarehouseSku = (size: string, color: string) => {
    const raw = String(warehouseLookup?.sku || warehouseCode).trim()
    const isSource = /^[AT]/i.test(raw)
    const prefix = isSource ? raw[0].toUpperCase() : ''
    const base = inv?.parsed_base || raw.replace(/^[AT]/i, '').split('/')[0]
    let colorPart = color
    if (isSource && inv?.colors?.length) {
      const idx = inv.colors.indexOf(color)
      if (idx >= 0) colorPart = String(idx + 1)
    }
    return `${prefix}${[base, size, colorPart].filter(Boolean).join('/')}`
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="px-4 py-3 pb-2">
          <CardTitle className="text-sm font-medium">{t.emsTitle}</CardTitle>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{t.emsHint}</p>
        </CardHeader>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="px-4 py-3 pb-2">
          <CardTitle className="text-sm font-medium">{t.searchTitle}</CardTitle>
          <p className="text-[11px] text-muted-foreground">{t.searchHint}</p>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <form onSubmit={submitSearch} className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="h-9 text-sm"
            />
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button
                type="submit"
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={listLoading || busy === 'tracking'}
              >
                {busy === 'tracking' && appliedSearch === searchInput.trim()
                  ? t.searchCard.refreshing
                  : listLoading
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : t.searchButton}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!appliedSearch || busy === 'tracking'}
                onClick={() => void refreshTracking(undefined, { q: appliedSearch })}
              >
                {t.trackingRefresh}
              </Button>
              {appliedSearch ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSearchInput('')
                    setAppliedSearch('')
                    setLoadedQuery('')
                    setSkip(0)
                  }}
                >
                  {t.searchClear}
                </Button>
              ) : null}
            </div>
          </form>
          {appliedSearch ? (
            <div className="mt-4 space-y-3">
              {searchPending ? (
                <p className="text-sm text-muted-foreground">
                  {t.searchCard.loading.replace('{q}', appliedSearch)}
                  {busy === 'tracking' ? t.searchCard.checkingEms : '…'}
                </p>
              ) : searchReady && total === 0 ? (
                <p className="text-sm text-muted-foreground">{t.searchCard.empty}</p>
              ) : searchReady ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {t.searchCard.resultCount.replace('{n}', String(total))}
                    </span>{' '}
                    <span className="font-mono">{appliedSearch}</span>
                    {total > EMS_SEARCH_PREVIEW ? t.searchCard.previewNote.replace('{n}', String(EMS_SEARCH_PREVIEW)) : ''}
                  </p>
                  {previewRows.map((row) => (
                    <EmsSearchResultCard
                      key={row.id}
                      partnerId={partnerId}
                      row={row}
                      t={t}
                      refreshing={busy === 'tracking'}
                      onViewStatus={(item) => void viewStatus(item)}
                      onRefresh={(id) => void refreshOne(id)}
                    />
                  ))}
                  {total > EMS_SEARCH_PREVIEW || skip > 0 ? (
                    <a href="#pw-ems-shipping-table" className="text-sm font-medium text-emerald-700 hover:underline">
                      {t.searchCard.moreBelow.replace('{n}', String(Math.max(0, total - (skip === 0 ? EMS_SEARCH_PREVIEW : 0))))}
                    </a>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between px-4 py-3 pb-2">
          <CardTitle className="text-sm font-medium">{t.opsTitle}</CardTitle>
          <Button type="button" variant="ghost" size="sm" onClick={() => void loadOps()} disabled={opsLoading}>
            {opsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.opsRefresh}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4 pt-0">
          {opsStats ? (
            <>
              <p className="text-xs text-muted-foreground">
                {opsStats.total_ems_records.toLocaleString('vi-VN')} vận đơn · {opsStats.total_with_cod.toLocaleString('vi-VN')} có COD
              </p>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
                <StatCard label="Tổng vận đơn" count={opsStats.total_ems_records} amount={opsStats.total_cod_sum} onClick={() => void openBucket('total', 'Tổng vận đơn')} />
                <StatCard label="Đang giao" count={opsStats.in_transit_count} amount={opsStats.in_transit_cod_total} onClick={() => void openBucket('in_transit', 'Đang giao')} />
                <StatCard label="Giao thành công" count={opsStats.delivered_count} amount={opsStats.delivered_cod_total} onClick={() => void openBucket('delivered', 'Giao OK')} />
                <StatCard label="Đơn hoàn chưa trả shop" count={opsStats.returned_count} amount={opsStats.returned_cod_total} onClick={() => void openBucket('returned', 'Đơn hoàn chưa trả shop')} />
                <StatCard
                  label="Đơn hoàn đã trả shop"
                  count={opsStats.return_shop_received_count ?? opsStats.shop_return_received_count}
                  amount={opsStats.return_shop_received_cod_total}
                  onClick={() => void openBucket('shop_return_received', 'Đơn hoàn đã trả shop')}
                />
                <StatCard label="Chưa rõ EMS" count={opsStats.pending_status_count} amount={opsStats.pending_cod_total} onClick={() => void openBucket('pending', 'Chưa rõ EMS')} />
              </div>
              <p className="text-[11px] font-medium text-muted-foreground">COD</p>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <StatCard label="COD đang giao · chưa trả" count={opsStats.cod_in_transit_unpaid_count} amount={opsStats.cod_in_transit_unpaid_total} onClick={() => void openBucket('cod_in_transit_unpaid', 'COD đang giao')} />
                <StatCard label="Giao OK · EMS chưa trả COD" count={opsStats.cod_delivered_unpaid_count} amount={opsStats.cod_delivered_unpaid_total} onClick={() => void openBucket('cod_delivered_unpaid', 'COD giao OK chưa trả')} />
                <StatCard label="COD EMS trả shop" count={opsStats.cod_paid_count} amount={opsStats.cod_paid_total} onClick={() => void openBucket('cod_paid', 'COD EMS trả shop')} />
                <StatCard label="COD hoàn · chưa trả" count={opsStats.cod_returned_unpaid_count} amount={opsStats.cod_returned_unpaid_total} onClick={() => void openBucket('cod_returned_unpaid', 'COD hoàn chưa trả')} />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{opsLoading ? t.loadingStats : t.noRows}</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="px-4 py-3 pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium">{t.timelineTitle}</CardTitle>
            <div className="flex flex-wrap gap-2">
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as typeof granularity)}
            >
              <option value="year">{t.grid.granYear}</option>
              <option value="month">{t.grid.granMonth}</option>
              <option value="week">{t.grid.granWeek}</option>
              <option value="day">{t.grid.granDay}</option>
            </select>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={timelinePreset}
              onChange={(e) => {
                setTimelinePreset(e.target.value)
                setTimelineYear('')
                setDateFrom('')
                setDateTo('')
              }}
            >
              <option value="">Mọi kỳ</option>
              <option value="this_week">Tuần này</option>
              <option value="last_week">Tuần trước</option>
              <option value="this_month">Tháng này</option>
              <option value="last_month">Tháng trước</option>
            </select>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={timelineYear}
              onChange={(e) => {
                setTimelineYear(e.target.value)
                setTimelinePreset('')
              }}
            >
              <option value="">{t.yearLabel}</option>
              {availableYears.map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
            <Input type="date" className="h-8 w-[138px] text-xs" value={dateFrom} title={t.dateFrom} onChange={(e) => { setDateFrom(e.target.value); setTimelinePreset('') }} />
            <Input type="date" className="h-8 w-[138px] text-xs" value={dateTo} title={t.dateTo} onChange={(e) => { setDateTo(e.target.value); setTimelinePreset('') }} />
            {timelinePreset || timelineYear || dateFrom || dateTo ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => { setTimelinePreset(''); setTimelineYear(''); setDateFrom(''); setDateTo('') }}>{t.clearFilter}</Button>
            ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto px-4 pb-4 pt-0">
          <table className="w-full min-w-[1100px] text-xs">
            <thead>
              <tr className="text-right text-muted-foreground">
                <th className="py-1 pr-2 text-left">{granLabel}</th>
                <th className="py-1 pr-2">{t.grid.tlTotal}</th>
                <th className="py-1 pr-2">{t.grid.tlInTransit}</th>
                <th className="py-1 pr-2">{t.grid.tlDelivered}</th>
                <th className="py-1 pr-2">{t.grid.tlReturnPending}</th>
                <th className="py-1 pr-2">{t.grid.tlReturnDone}</th>
                <th className="py-1 pr-2">{t.grid.tlPending}</th>
                <th className="py-1 pr-2">{t.grid.tlHasCod}</th>
                <th className="py-1 pr-2">{t.grid.tlDeliveredUnpaid}</th>
                <th className="py-1">{t.grid.tlCodPaid}</th>
              </tr>
            </thead>
            <tbody>
              {(timeline?.items || []).map((it) => {
                const range = periodRangeLabel(it.period_start, it.period_end)
                const open = (key: OpsBucketKey, label: string) => void openRecords({ key, label: `${it.period_label} · ${label}`, axis: 'import', periodKey: it.period_key, periodLabel: it.period_label })
                return (
                  <tr key={it.period_key} className="border-t border-border/60">
                    <td className="py-1.5 pr-2 text-left">
                      <div className="font-medium">{it.period_label}</div>
                      {range ? <div className="text-[10px] text-muted-foreground">{range}</div> : null}
                    </td>
                    <td className="py-1.5 pr-2"><TimelineMoney n={it.total ?? 0} amount={it.total_cod_sum} onClick={() => open('total', t.grid.tlTotal)} /></td>
                    <td className="py-1.5 pr-2"><TimelineMoney n={it.in_transit_count ?? 0} amount={it.in_transit_cod_total} countClass="text-blue-800" amountClass="text-blue-700/90" onClick={() => open('in_transit', t.grid.tlInTransit)} /></td>
                    <td className="py-1.5 pr-2"><TimelineMoney n={it.delivered_count ?? 0} amount={it.delivered_cod_total} countClass="text-emerald-800" amountClass="text-emerald-700/90" onClick={() => open('delivered', t.grid.tlDelivered)} /></td>
                    <td className="py-1.5 pr-2"><TimelineMoney n={it.returned_count ?? 0} amount={it.returned_cod_total} countClass="text-orange-800" amountClass="text-orange-700/90" onClick={() => open('returned', t.grid.tlReturnPending)} /></td>
                    <td className="py-1.5 pr-2"><TimelineMoney n={it.return_shop_received_count ?? 0} amount={it.return_shop_received_cod_total} countClass="text-orange-900" amountClass="text-orange-800/90" onClick={() => open('shop_return_received', t.grid.tlReturnDone)} /></td>
                    <td className="py-1.5 pr-2"><TimelineMoney n={it.pending_status_count ?? 0} amount={it.pending_cod_total} countClass="text-slate-600" amountClass="text-slate-500" onClick={() => open('pending', t.grid.tlPending)} /></td>
                    <td className="py-1.5 pr-2"><TimelineMoney n={it.total_with_cod ?? 0} amount={it.total_cod_amount} onClick={() => open('has_cod', t.grid.tlHasCod)} /></td>
                    <td className="py-1.5 pr-2"><TimelineMoney n={it.cod_delivered_unpaid_count ?? 0} amount={it.cod_delivered_unpaid_total} countClass="text-amber-800" amountClass="text-amber-700/90" onClick={() => open('cod_delivered_unpaid', t.grid.tlDeliveredUnpaid)} /></td>
                    <td className="py-1.5"><TimelineMoney n={it.cod_paid_count ?? 0} amount={it.cod_paid_total} countClass="text-emerald-800" amountClass="text-emerald-700/90" onClick={() => open('cod_paid', t.grid.tlCodPaid)} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!timeline?.items.length ? <p className="py-3 text-sm text-muted-foreground">{t.noRows}</p> : null}
          <h3 className="mt-4 text-sm font-medium">{t.receivedTitle}</h3>
          <table className="mt-1 w-full text-xs">
            <thead className="bg-teal-50/80 text-teal-900">
              <tr>
                <th className="py-1 pr-2 text-left font-medium">{granLabel}</th>
                <th className="py-1 pr-2 text-right font-medium">{t.grid.receivedCod}</th>
                <th className="py-1 text-right font-medium">{t.grid.receivedReturn}</th>
              </tr>
            </thead>
            <tbody>
              {(received?.items || []).map((it) => {
                const range = periodRangeLabel(it.period_start, it.period_end)
                return (
                  <tr key={`r-${it.period_key}`} className="border-t border-border/60">
                    <td className="py-1.5 pr-2">
                      <div className="font-medium">{it.period_label}</div>
                      {range ? <div className="text-[10px] text-muted-foreground">{range}</div> : null}
                    </td>
                    <td className="py-1.5 pr-2">
                      <TimelineMoney n={it.cod_received_count ?? 0} amount={it.cod_received_total} countClass="text-teal-800" amountClass="text-teal-700/90" onClick={() => void openRecords({ key: 'cod_received_in_period', label: `${it.period_label} · ${t.grid.receivedCod}`, axis: 'received', periodKey: it.period_key, periodLabel: it.period_label })} />
                    </td>
                    <td className="py-1.5">
                      <TimelineMoney n={it.return_received_count ?? 0} amount={it.return_received_cod_total} countClass="text-orange-900" amountClass="text-orange-800/90" onClick={() => void openRecords({ key: 'shop_return_received', label: `${it.period_label} · ${t.grid.receivedReturn}`, axis: 'received', periodKey: it.period_key, periodLabel: it.period_label })} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {activeBucket ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { setActiveBucket(null); setBucketRows([]) }}>
          <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-xl border bg-background p-4 shadow-lg" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">{activeBucket.label}{bucketTotal ? ` · ${bucketTotal.toLocaleString('vi-VN')}` : ''}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t.grid.bucketCodes.replace('{n}', String(bucketRows.length)).replace('{total}', String(bucketTotal))}
                </p>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => { setActiveBucket(null); setBucketRows([]) }}>{t.closePanel}</Button>
            </div>
            {bucketLoading ? <Loader2 className="mb-2 h-4 w-4 animate-spin" /> : null}
            <ul className="mb-3 space-y-0.5 text-xs text-muted-foreground">
              {bucketRows.map((r) => (
                <li key={`code-${r.id}`}>{[r.order_code, r.ems_tracking_code, r.reference_code].filter(Boolean).join(' · ') || '—'}</li>
              ))}
            </ul>
            <div className="space-y-3">
              {bucketRows.map((r) => (
                <EmsSearchResultCard
                  key={r.id}
                  partnerId={partnerId}
                  row={r}
                  t={t}
                  refreshing={busy === `one-${r.id}`}
                  onViewStatus={(row) => void viewStatus(row)}
                  onRefresh={(id) => void refreshOne(id)}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{bucketTotal.toLocaleString('vi-VN')}</span>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" disabled={bucketSkip <= 0 || bucketLoading} onClick={() => void openRecords({ ...activeBucket, skip: Math.max(0, bucketSkip - 25) })}>{t.prevPage}</Button>
                <Button type="button" size="sm" variant="outline" disabled={bucketSkip + 25 >= bucketTotal || bucketLoading} onClick={() => void openRecords({ ...activeBucket, skip: bucketSkip + 25 })}>{t.nextPage}</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="px-4 py-3 pb-2">
          <CardTitle className="text-sm font-medium">{t.importEmsTitle}</CardTitle>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{t.importEmsHint}</p>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4 pt-0">
          <p className="text-[11px] text-muted-foreground">{t.xlsHint}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input ref={emsFileRef} type="file" accept={EXCEL_ACCEPT} className="h-9 text-sm" onChange={(e) => setEmsFile(e.target.files?.[0] || null)} />
            <Button type="button" size="sm" variant="outline" onClick={() => void downloadSample('ems-import/sample')}>{t.downloadSample}</Button>
            <Button type="button" size="sm" disabled={!emsFile || busy === 'ems-import'} onClick={() => void postFile('ems-import', emsFile)}>
              {busy === 'ems-import' ? <Loader2 className="h-4 w-4 animate-spin" /> : t.importRun}
            </Button>
          </div>
          {importBatches.length ? (
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-[11px] text-muted-foreground">{t.batchHistory}</Label>
              <select
                className="h-8 max-w-full rounded-md border border-input bg-background px-2 text-xs"
                value={selectedEmsBatchId}
                onChange={(e) => setSelectedEmsBatchId(e.target.value)}
              >
                {importBatches.map((b) => (
                  <option key={String(b.id)} value={String(b.id)}>
                    {String(b.source_filename || b.id)} · {String(b.created_count || 0)} {t.createdCount} / {String(b.updated_count || 0)} {t.updatedCount}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {emsReportRows.length ? (
            <div className="overflow-x-auto rounded-md border border-border/60">
              <p className="px-2 py-1.5 text-[11px] font-medium">{t.grid.importListTitle}</p>
              <table className="w-full min-w-[760px] text-xs">
                <thead>
                  <tr className="border-t border-border/60 text-left text-muted-foreground">
                    <th className="px-2 py-1">{t.grid.colIndex}</th>
                    <th className="px-2 py-1">{t.grid.colReference}</th>
                    <th className="px-2 py-1">{t.grid.colShopOrder}</th>
                    <th className="px-2 py-1">{t.grid.colCustomer}</th>
                    <th className="px-2 py-1 text-right">{t.colCod}</th>
                    <th className="px-2 py-1">{t.grid.colActions}</th>
                    <th className="px-2 py-1">{t.grid.colSync}</th>
                  </tr>
                </thead>
                <tbody>
                  {emsReportRows.map((row, i) => {
                    const action = importActionBadge(t, String(row.import_action || ''))
                    const cod = row.cod_amount == null || row.cod_amount === '' ? null : Number(row.cod_amount)
                    return (
                      <tr key={`${String(row.reference_code || i)}-${i}`} className="border-t border-border/50">
                        <td className="px-2 py-1 tabular-nums text-muted-foreground">{String(row.row_number || i + 1)}</td>
                        <td className="px-2 py-1 font-medium">{String(row.reference_code || '—')}</td>
                        <td className="px-2 py-1">
                          {row.order_id ? (
                            <OrderCodeLink partnerId={partnerId} code={String(row.order_code || '')} />
                          ) : (
                            <span>{String(row.order_code || '—')}</span>
                          )}
                        </td>
                        <td className="px-2 py-1">{String(row.recipient_label || '—')}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{moneyOrDash(Number.isFinite(cod) ? cod : null)}</td>
                        <td className="px-2 py-1">
                          {action ? (
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${action.badge}`}>{action.label}</span>
                          ) : '—'}
                        </td>
                        <td className="px-2 py-1">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${syncBadgeClass(String(row.sync_status || ''))}`}>
                            {syncLabel(t, String(row.sync_status || ''))}
                          </span>
                          {row.sync_message ? <p className="mt-1 text-[10px] text-muted-foreground">{String(row.sync_message)}</p> : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-muted/40 font-medium">
                    <td className="px-2 py-1.5" colSpan={4}>{t.grid.breakdownGrand}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {vnd(emsReportRows.reduce((sum, row) => sum + (Number(row.cod_amount) || 0), 0))}
                    </td>
                    <td className="px-2 py-1.5" colSpan={2}>{emsReportRows.length}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="px-4 py-3 pb-2">
          <CardTitle className="text-sm font-medium">{t.importCodTitle}</CardTitle>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{t.importCodHint}</p>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4 pt-0">
          <p className="text-[11px] text-muted-foreground">{t.xlsHint}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input ref={codFileRef} type="file" accept={EXCEL_ACCEPT} className="h-9 text-sm" onChange={(e) => setCodFile(e.target.files?.[0] || null)} />
            <Button type="button" size="sm" variant="outline" onClick={() => void downloadSample('cod-settlement-import/sample')}>{t.downloadSample}</Button>
            <Button type="button" size="sm" disabled={!codFile || busy === 'cod-settlement-import'} onClick={() => void postFile('cod-settlement-import', codFile)}>
              {busy === 'cod-settlement-import' ? <Loader2 className="h-4 w-4 animate-spin" /> : t.importRun}
            </Button>
          </div>
          {codBatch ? (
            <>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <StatCard label={t.matched} count={Number(codBatch.matched_count || 0)} />
                <StatCard label={t.mismatch} count={Number(codBatch.amount_mismatch_count || 0)} />
                <StatCard label={t.notInDb} count={Number(codBatch.record_not_found_count || 0)} />
                <StatCard label={t.totalPaid} count={Number(codBatch.total_rows || 0)} amount={Number(codBatch.total_paid_amount || 0)} />
              </div>
              <p className="text-[11px] tabular-nums text-muted-foreground">
                {t.difference}: {vnd(Number(codBatch.total_amount_difference || 0))}
                {codBatch.payment_date ? ` · ${String(codBatch.payment_date)}` : ''}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-8 max-w-full rounded-md border border-input bg-background px-2 text-xs"
                  value={selectedCodBatchId}
                  onChange={(e) => setSelectedCodBatchId(e.target.value)}
                >
                  {codBatches.map((b) => (
                    <option key={String(b.id)} value={String(b.id)}>
                      {String(b.payment_date || b.source_filename || b.id)} · {String(b.matched_count || 0)}/{String(b.total_rows || 0)}
                    </option>
                  ))}
                </select>
                <FilterChip label={t.filterAll} count={Number(codBatch.total_rows || 0)} active={!codFilter} onClick={() => setCodFilter('')} />
                <FilterChip label={t.matched} count={Number(codBatch.matched_count || 0)} active={codFilter === 'matched'} onClick={() => setCodFilter('matched')} />
                <FilterChip label={t.mismatch} count={Number(codBatch.amount_mismatch_count || 0)} active={codFilter === 'amount_mismatch'} onClick={() => setCodFilter('amount_mismatch')} />
                <FilterChip label={t.notInDb} count={Number(codBatch.record_not_found_count || 0)} active={codFilter === 'record_not_found'} onClick={() => setCodFilter('record_not_found')} />
              </div>
              {codRows.length ? (
                <div className="overflow-x-auto rounded-md border border-border/60">
                  <p className="px-2 py-1.5 text-[11px] font-medium">{t.grid.codTableTitle}</p>
                  <table className="w-full min-w-[760px] text-xs">
                    <thead>
                      <tr className="border-t border-border/60 text-left text-muted-foreground">
                        <th className="px-2 py-1">{t.grid.colIndex}</th>
                        <th className="px-2 py-1">{t.grid.colEmsCode}</th>
                        <th className="px-2 py-1">{t.grid.colReference}</th>
                        <th className="px-2 py-1 text-right">{t.grid.colPaidFile}</th>
                        <th className="px-2 py-1 text-right">{t.grid.colDbCod}</th>
                        <th className="px-2 py-1 text-right">{t.grid.colDiff}</th>
                        <th className="px-2 py-1">{t.grid.colResult}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {codRows.map((row, i) => (
                        <tr key={`${row.ems_tracking_code || i}-${i}`} className="border-t border-border/50">
                          <td className="px-2 py-1 tabular-nums text-muted-foreground">{row.row_number || i + 1}</td>
                          <td className="px-2 py-1 font-medium">{row.ems_tracking_code || '—'}</td>
                          <td className="px-2 py-1">{row.ems_reference_code || '—'}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{moneyOrDash(row.paid_amount)}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{moneyOrDash(row.db_cod_amount)}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{moneyOrDash(row.amount_difference)}</td>
                          <td className="px-2 py-1">
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${codReconcileBadge(row.reconcile_status)}`}>
                              {codReconcileLabel(t, row.reconcile_status)}
                            </span>
                            {row.reconcile_message ? <p className="mt-1 text-[10px] text-muted-foreground">{row.reconcile_message}</p> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="px-4 py-3 pb-2">
          <CardTitle className="text-sm font-medium">{t.returnTitle}</CardTitle>
          <p className="text-[11px] text-muted-foreground">{t.returnHint}</p>
        </CardHeader>
        <CardContent className="space-y-2 px-4 pb-4 pt-0">
          <p className="text-[11px] text-muted-foreground">{t.previewAuto}</p>
          <Textarea rows={4} value={returnText} onChange={(e) => setReturnText(e.target.value)} placeholder="DH131&#10;EE123456789VN" />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={async () => {
                setBusy('return')
                try {
                  const res = await fetch(`${api}/shop-return-confirm`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: returnText }),
                  })
                  const data = (await res.json()) as {
                    confirmed?: number
                    confirmed_count?: number
                    detail?: string
                    rows?: ReturnRow[]
                    already_returned_count?: number
                    error_count?: number
                  }
                  if (!res.ok) throw new Error(data.detail || t.loadError)
                  applyReturnRows(data, { fillWarehouse: true })
                  toast({ title: `Đã xác nhận ${data.confirmed_count ?? data.confirmed ?? 0} đơn hoàn.` })
                  await loadList()
                  await loadOps()
                } catch (err) {
                  toast({ title: err instanceof Error ? err.message : t.loadError, variant: 'destructive' })
                } finally {
                  setBusy('')
                }
              }}
              disabled={busy === 'return' || (returnCounts != null && !returnCounts.confirmable)}
            >
              {busy === 'return' ? <Loader2 className="h-4 w-4 animate-spin" /> : t.confirmReturn}
            </Button>
            <Input ref={returnFileRef} type="file" accept={EXCEL_ACCEPT} className="h-9 max-w-[220px] text-sm" onChange={(e) => void postFile('shop-return-confirm-import', e.target.files?.[0] || null)} />
            <Button type="button" size="sm" variant="ghost" onClick={() => void downloadSample('shop-return-confirm-import/sample')}>{t.downloadSample}</Button>
          </div>
          {returnCounts ? (
            <div className="flex flex-wrap gap-2">
              <FilterChip label={t.confirmable} count={returnCounts.confirmable} active onClick={() => undefined} />
              <FilterChip label={t.alreadyReturned} count={returnCounts.already} onClick={() => undefined} />
              <FilterChip label={t.notReady} count={returnCounts.error} onClick={() => undefined} />
            </div>
          ) : null}
          {returnPreview.length ? (
            <div className="overflow-x-auto rounded-md border border-border/60">
              <table className="w-full min-w-[860px] text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="px-2 py-1">{t.grid.colIndex}</th>
                    <th className="px-2 py-1">{t.grid.colInputCode}</th>
                    <th className="px-2 py-1">{t.grid.colViewOrder}</th>
                    <th className="px-2 py-1">{t.grid.colEmsStatus}</th>
                    <th className="px-2 py-1">{t.grid.colShopStatus}</th>
                    <th className="px-2 py-1">{t.grid.colResult}</th>
                    <th className="px-2 py-1">{t.grid.colNote}</th>
                  </tr>
                </thead>
                <tbody>
                  {returnPreview.map((row, i) => {
                    const result = returnResultBadge(t, row.status)
                    return (
                      <tr key={`${row.input}-${i}`} className="border-t border-border/50">
                        <td className="px-2 py-1 tabular-nums text-muted-foreground">{i + 1}</td>
                        <td className="px-2 py-1 font-medium">{row.input}</td>
                        <td className="px-2 py-1">
                          {row.order_id ? (
                            <OrderCodeLink partnerId={partnerId} code={row.order_code || ''} />
                          ) : (
                            <span>{row.order_code || '—'}</span>
                          )}
                        </td>
                        <td className="px-2 py-1">{row.ems_status || row.ems_tracking_code || '—'}</td>
                        <td className="px-2 py-1">{row.order_status ? shopOrderStatusText(t, row.order_status) : '—'}</td>
                        <td className="px-2 py-1">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${result.badge}`}>{result.label}</span>
                        </td>
                        <td className="px-2 py-1 text-muted-foreground">{row.message || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="px-4 py-3 pb-2">
          <CardTitle className="text-sm font-medium">{t.warehouseTitle}</CardTitle>
          <p className="text-[11px] text-muted-foreground">{t.warehouseHint}</p>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4 pt-0">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Mã EMS / SKU</Label>
              <Input className="h-9 text-sm" value={warehouseCode} onChange={(e) => setWarehouseCode(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Số lượng</Label>
              <Input className="h-9 text-sm" value={warehouseQty} onChange={(e) => setWarehouseQty(e.target.value.replace(/[^\d]/g, ''))} />
            </div>
            <label className="flex items-end gap-2 pb-2 text-xs">
              <input type="checkbox" checked={warehouseClearance} onChange={(e) => setWarehouseClearance(e.target.checked)} />
              {t.warehouseClearanceBadge}
            </label>
          </div>
          {warehouseSizes.length || warehouseColors.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {warehouseSizes.length ? (
                <div className="space-y-1">
                  <Label className="text-xs">{t.sizeLabel}</Label>
                  <select
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                    value={warehouseSize}
                    onChange={(e) => {
                      setWarehouseSize(e.target.value)
                      setWarehouseCode(composeWarehouseSku(e.target.value, warehouseColor))
                    }}
                  >
                    {warehouseSizes.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              ) : null}
              {warehouseColors.length ? (
                <div className="space-y-1">
                  <Label className="text-xs">{t.colorLabel}</Label>
                  <select
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                    value={warehouseColor}
                    onChange={(e) => {
                      setWarehouseColor(e.target.value)
                      setWarehouseCode(composeWarehouseSku(warehouseSize, e.target.value))
                    }}
                  >
                    {warehouseColors.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          ) : null}
          {inv ? (
            <div className="flex gap-3 rounded-md border border-border/70 p-2">
              {inv.parsed_color_image_url || inv.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={inv.parsed_color_image_url || inv.image_url}
                  alt=""
                  className="h-16 w-16 rounded object-cover"
                />
              ) : (
                <div className="h-16 w-16 rounded bg-muted" />
              )}
              <div className="min-w-0 text-xs">
                <p className="font-medium leading-snug">{inv.name || inv.sku}</p>
                <p className="tabular-nums text-muted-foreground">SKU {inv.sku || warehouseLookup?.sku}</p>
                <p className="tabular-nums">
                  {t.warehouseStock}: {Number(inv.stock_qty || 0).toLocaleString('vi-VN')}
                  {inv.is_clearance ? ` · ${t.warehouseClearanceBadge}` : ''}
                </p>
                {inv.price_amount != null ? <p className="tabular-nums">{vnd(Number(inv.price_amount))}</p> : null}
              </div>
            </div>
          ) : warehouseLookup?.error ? (
            <p className="text-xs text-destructive">{warehouseLookup.error}</p>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={!inv}
            onClick={async () => {
              const res = await fetch(`${api}/return-warehouse-intake`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  code: warehouseCode,
                  qty: Number(warehouseQty) || 1,
                  markClearance: warehouseClearance,
                }),
              })
              const data = (await res.json()) as {
                ok?: boolean
                error?: string
                sku?: string
                added?: number
                available_before?: number
                available_after?: number
                message?: string
              }
              if (!res.ok || !data.ok) {
                toast({ title: data.error || t.loadError, variant: 'destructive' })
                return
              }
              setWarehouseAfter(data.message || `${t.warehouseIntakeOk}: ${data.available_before} → ${data.available_after}`)
              toast({ title: data.message || `${t.warehouseIntakeOk} ${data.sku}` })
              setWarehouseLookup((prev) =>
                prev?.inventory
                  ? { ...prev, inventory: { ...prev.inventory, stock_qty: data.available_after, is_clearance: warehouseClearance || prev.inventory.is_clearance } }
                  : prev,
              )
            }}
          >
            {t.warehouseTitle}
          </Button>
          {warehouseAfter ? <p className="text-xs text-muted-foreground">{warehouseAfter}</p> : null}
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="px-4 py-3 pb-2">
          <CardTitle className="text-sm font-medium">{t.freightTitle}</CardTitle>
          <p className="text-[11px] text-muted-foreground">{t.freightHint}</p>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4 pt-0">
          <p className="text-[11px] text-muted-foreground">{t.xlsHint}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input ref={freightFileRef} type="file" accept={EXCEL_ACCEPT} className="h-9 text-sm" onChange={(e) => setFreightFile(e.target.files?.[0] || null)} />
            <Button type="button" size="sm" variant="outline" onClick={() => void downloadSample('freight-settlement-import/sample')}>{t.downloadSample}</Button>
            <Button type="button" size="sm" disabled={!freightFile || busy === 'freight-settlement-import'} onClick={() => void postFile('freight-settlement-import', freightFile)}>
              {busy === 'freight-settlement-import' ? <Loader2 className="h-4 w-4 animate-spin" /> : t.importRun}
            </Button>
          </div>
          {freightBatch ? (
            <>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <StatCard label={t.settled} count={Number(freightBatch.settled_count || 0)} amount={Number(freightBatch.total_freight_amount || 0)} />
                <StatCard label={t.alreadySettled} count={Number(freightBatch.already_settled_count || 0)} />
                <StatCard label={t.notInDb} count={Number(freightBatch.record_not_found_count || 0)} />
                <StatCard label={t.highFee} count={Number(freightBatch.high_fee_warning_count || 0)} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-8 max-w-full rounded-md border border-input bg-background px-2 text-xs"
                  value={selectedFreightBatchId}
                  onChange={(e) => setSelectedFreightBatchId(e.target.value)}
                >
                  {freightBatches.map((b) => (
                    <option key={String(b.id)} value={String(b.id)}>
                      {String(b.settlement_date || b.source_filename || b.id)} · {String(b.settled_count || 0)}/{String(b.total_rows || 0)}
                    </option>
                  ))}
                </select>
                <FilterChip label={t.filterAll} count={Number(freightBatch.total_rows || 0)} active={!freightFilter} onClick={() => setFreightFilter('')} />
                <FilterChip label={t.settled} count={Number(freightBatch.settled_count || 0)} active={freightFilter === 'settled'} onClick={() => setFreightFilter('settled')} />
                <FilterChip label={t.alreadySettled} count={Number(freightBatch.already_settled_count || 0)} active={freightFilter === 'already_settled'} onClick={() => setFreightFilter('already_settled')} />
                <FilterChip label={t.notInDb} count={Number(freightBatch.record_not_found_count || 0)} active={freightFilter === 'record_not_found'} onClick={() => setFreightFilter('record_not_found')} />
                <FilterChip label={t.highFee} count={Number(freightBatch.high_fee_warning_count || 0)} active={freightFilter === 'high_fee'} onClick={() => setFreightFilter('high_fee')} />
              </div>
              {freightRows.length ? (
                <div className="overflow-x-auto rounded-md border border-border/60">
                  <p className="px-2 py-1.5 text-[11px] font-medium">{t.grid.freightTableTitle}</p>
                  <table className="w-full min-w-[640px] text-xs">
                    <thead>
                      <tr className="border-t border-border/60 text-left text-muted-foreground">
                        <th className="px-2 py-1">{t.grid.colIndex}</th>
                        <th className="px-2 py-1">{t.grid.colEmsCode}</th>
                        <th className="px-2 py-1 text-right">{t.grid.colFreightFee}</th>
                        <th className="px-2 py-1">{t.grid.colWarning}</th>
                        <th className="px-2 py-1">{t.grid.colResult}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {freightRows.map((row, i) => (
                        <tr key={`${row.ems_tracking_code || i}-${i}`} className={`border-t border-border/50 ${highFeeOn(row.high_fee_warning) ? 'bg-amber-50/80' : ''}`}>
                          <td className="px-2 py-1 tabular-nums text-muted-foreground">{row.row_number || i + 1}</td>
                          <td className="px-2 py-1 font-medium">{row.ems_tracking_code || '—'}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{moneyOrDash(row.freight_amount)}</td>
                          <td className="px-2 py-1">
                            {highFeeOn(row.high_fee_warning) ? (
                              <span className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">{t.grid.highFeeLong}</span>
                            ) : '—'}
                          </td>
                          <td className="px-2 py-1">
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${freightReconcileBadge(row.reconcile_status)}`}>
                              {freightReconcileLabel(t, row.reconcile_status)}
                            </span>
                            {row.reconcile_message ? <p className="mt-1 text-[10px] text-muted-foreground">{row.reconcile_message}</p> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>

      {listSummary ? (
        <>
          <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {([
              ['', t.filterAll, listSummary.total_rows],
              ['matched', t.syncMatched, listSummary.matched],
              ['in_progress', t.syncInProgress, listSummary.in_progress],
              ['mismatch', t.syncMismatch, listSummary.mismatch],
              ['unlinked', t.syncUnlinked, listSummary.unlinked],
              ['ems_not_found', t.syncEmsMissing, listSummary.ems_not_found],
              ['parse_error', t.syncParseError, listSummary.parse_error],
            ] as const).map(([key, label, count]) => (
              <button
                key={key || 'all'}
                type="button"
                onClick={() => applySyncFilter(key)}
                className={`rounded-xl border px-3 py-3 text-left ${syncStatus === key ? 'border-emerald-500 bg-white ring-2 ring-emerald-100' : 'border-border bg-white'}`}
              >
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="text-xl font-semibold tabular-nums">{Number(count || 0).toLocaleString('vi-VN')}</div>
              </button>
            ))}
          </section>
          {listSummary.breakdown?.length ? (
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="px-4 py-3 pb-2">
                <CardTitle className="text-sm font-medium">{t.grid.breakdownTitle}</CardTitle>
                <p className="text-[11px] text-muted-foreground">{t.grid.breakdownHint}</p>
              </CardHeader>
              <CardContent className="overflow-x-auto px-0 pb-0 pt-0">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">{t.grid.breakdownStatus}</th>
                      <th className="px-4 py-2 text-right font-medium">{t.grid.breakdownCount}</th>
                      <th className="px-4 py-2 text-right font-medium">{t.grid.breakdownCod}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listSummary.breakdown.map((item) => {
                      const active = syncStatus === item.key || (item.key === 'order_not_found' && syncStatus === 'unlinked')
                      return (
                        <tr
                          key={item.key}
                          className={`cursor-pointer border-t border-border/60 hover:bg-muted/40 ${active ? 'bg-emerald-50/50' : ''}`}
                          onClick={() => applySyncFilter(item.key)}
                        >
                          <td className="px-4 py-2">
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${syncBadgeClass(item.key)}`}>
                              {syncLabel(t, item.key)}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right font-medium tabular-nums">{item.count.toLocaleString('vi-VN')}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{vnd(item.cod_total)}</td>
                        </tr>
                      )
                    })}
                    <tr className="border-t border-border bg-muted/40 font-semibold">
                      <td className="px-4 py-2.5">{t.grid.breakdownGrand}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{listSummary.total_rows.toLocaleString('vi-VN')}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-emerald-800">{vnd(listSummary.total_cod_amount)}</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}

      <Card id="pw-ems-shipping-table" className="border-border/70 shadow-sm">
        <CardHeader className="px-4 py-3 pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" className="flex min-w-0 items-start gap-2 text-left" aria-expanded={emsTableExpanded} onClick={() => setEmsTableExpanded((v) => !v)}>
              <span className={`mt-0.5 inline-flex text-muted-foreground transition-transform ${emsTableExpanded ? 'rotate-90' : ''}`} aria-hidden>▶</span>
              <span>
                <span className="block text-sm font-medium">{t.tableTitle}</span>
                <span className="text-xs text-muted-foreground">
                  {appliedSearch
                    ? `${t.grid.searchNote.replace('{q}', appliedSearch).replace('{n}', String(total))}${syncStatus ? t.grid.filteredNote : ''}`
                    : syncStatus
                      ? `${total.toLocaleString('vi-VN')} / ${(listSummary?.total_rows ?? total).toLocaleString('vi-VN')}`
                      : total.toLocaleString('vi-VN')}
                  {emsTableExpanded && total > 0 ? t.grid.showingNote.replace('{from}', String(displayFrom)).replace('{to}', String(displayTo)) : ''}
                  {selectedIds.length ? t.grid.selectedNote.replace('{n}', String(selectedIds.length)) : ''}
                </span>
              </span>
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="text-sm font-medium text-emerald-700 hover:underline" onClick={() => setEmsTableExpanded((v) => !v)}>
                {emsTableExpanded ? t.grid.collapse : t.grid.expand}
              </button>
              {emsTableExpanded ? (
                <>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="whitespace-nowrap">{t.grid.rowsPerPage}</span>
                    <select
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value) as (typeof PAGE_SIZES)[number])
                        setSkip(0)
                        setSelected({})
                      }}
                    >
                      {PAGE_SIZES.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                  <Button type="button" size="sm" variant="outline" disabled={busy === 'tracking'} onClick={() => void refreshTracking(selectedIds.length ? selectedIds : undefined)}>
                    {busy === 'tracking' ? <Loader2 className="h-4 w-4 animate-spin" /> : t.trackingRefresh}
                  </Button>
                  {selectedIds.length ? (
                    <Button type="button" size="sm" variant="destructive" disabled={busy === 'delete'} onClick={() => void deleteIds(selectedIds)}>
                      {t.deleteSelected}
                    </Button>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
          {job ? (
            <div className="mt-2 space-y-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full transition-[width] ${
                    job.status === 'error' ? 'bg-destructive' : job.status === 'done' ? 'bg-emerald-600' : 'bg-primary'
                  }`}
                  style={{ width: `${job.total > 0 ? Math.min(100, Math.round((job.processed / job.total) * 100)) : 0}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t.trackingProgress.replace('{processed}', String(job.processed)).replace('{total}', String(job.total))}
                {job.message ? ` · ${job.message}` : ''}
              </p>
            </div>
          ) : null}
        </CardHeader>
        {emsTableExpanded ? null : (
          <p className="border-t border-border/60 px-4 py-3 text-sm text-muted-foreground">{t.grid.collapsedHint}</p>
        )}
        {emsTableExpanded ? (
        <CardContent className="px-0 pb-0 pt-0">
          <div className="max-h-[min(70vh,720px)] overflow-auto">
          <table className="w-full min-w-[1280px] text-xs">
            <thead className="sticky top-0 z-10 bg-muted/80 text-muted-foreground shadow-[0_1px_0_0_hsl(var(--border))]">
              <tr>
                <th className="bg-muted/80 px-2 py-2">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && rows.every((r) => selected[r.id])}
                    onChange={(e) => {
                      const next: Record<string, boolean> = {}
                      if (e.target.checked) for (const r of rows) next[r.id] = true
                      setSelected(next)
                    }}
                  />
                </th>
                <th className="bg-muted/80 px-2 py-2 text-left font-medium">{t.grid.colIndex}</th>
                <th className="bg-muted/80 px-2 py-2 text-left font-medium">{t.grid.colReference}</th>
                <th className="bg-muted/80 px-2 py-2 text-left font-medium">{t.grid.colShopOrder}</th>
                <th className="bg-muted/80 px-2 py-2 text-right font-medium">{t.grid.colCodCollect}</th>
                <th className="bg-muted/80 px-2 py-2 text-right font-medium">{t.grid.colCodPaid}</th>
                <th className="bg-muted/80 px-2 py-2 text-right font-medium">{t.grid.colFreight}</th>
                <th className="bg-muted/80 px-2 py-2 text-left font-medium">{t.grid.colEmsCode}</th>
                <th className="bg-muted/80 px-2 py-2 text-left font-medium">{t.grid.colEmsStatus}</th>
                <th className="bg-muted/80 px-2 py-2 text-left font-medium">{t.grid.colShopStatus}</th>
                <th className="bg-muted/80 px-2 py-2 text-left font-medium">{t.grid.colSync}</th>
                <th className="bg-muted/80 px-2 py-2 text-right font-medium">{t.grid.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-muted-foreground">
                    {listLoading
                      ? t.loadingStats
                      : !appliedSearch && !syncStatus && (listSummary?.total_rows ?? 0) === 0
                        ? t.grid.emptyUpload
                        : appliedSearch
                          ? t.searchCard.empty
                          : t.grid.noFilterMatch}
                  </td>
                </tr>
              ) : rows.map((r) => {
                const paidMatched = (r.cod_settlement_status || '').trim().toLowerCase() === 'matched'
                const paidDate = paidMatched ? formatCodPaidDate(r.cod_paid_date) : null
                const paidAmount = paidMatched ? r.cod_paid_amount ?? r.cod_amount : null
                const rawShop = r.shop_order_status || r.order_status
                const freightSettled = r.freight_settlement_status === 'settled' || r.freight_settlement_status === 'already_settled'
                return (
                  <tr key={r.id} className={`border-t border-border/60 align-top ${selected[r.id] ? 'bg-emerald-50/40' : ''}`}>
                    <td className="px-2 py-2">
                      <input type="checkbox" checked={Boolean(selected[r.id])} onChange={(e) => setSelected((s) => ({ ...s, [r.id]: e.target.checked }))} />
                    </td>
                    <td className="px-2 py-2 tabular-nums text-muted-foreground">{r.excel_row_number ?? '—'}</td>
                    <td className="px-2 py-2">
                      <div className="font-medium">{r.reference_code || '—'}</div>
                      {r.recipient_label ? <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{r.recipient_label}</div> : null}
                    </td>
                    <td className="px-2 py-2">
                      {r.order_code ? (
                        r.order_id ? <OrderCodeLink partnerId={partnerId} code={r.order_code} /> : <span className="font-medium">{r.order_code}</span>
                      ) : '—'}
                      {r.tracking_number_saved ? (
                        <div className="mt-0.5 text-[11px] text-muted-foreground">{t.grid.savedTracking.replace('{code}', r.tracking_number_saved)}</div>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">{formatCodAmount(r.cod_amount, t.searchCard.codNone)}</td>
                    <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                      {paidAmount == null && !paidDate ? '—' : (
                        <>
                          <div>{moneyOrDash(paidAmount)}</div>
                          {paidDate ? <div className="mt-0.5 text-[11px] font-medium text-emerald-700">{t.searchCard.codPaidOn.replace('{date}', paidDate)}</div> : null}
                        </>
                      )}
                      {codCollectedPending(r) ? <div className="mt-0.5 max-w-[180px] text-[11px] font-medium text-amber-800">{t.searchCard.codCollectedPending}</div> : null}
                      {r.cod_settlement_status ? (
                        <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${codReconcileBadge(r.cod_settlement_status)}`}>
                          {codReconcileLabel(t, r.cod_settlement_status)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                      <div>{moneyOrDash(r.freight_amount)}</div>
                      {highFeeOn(r.freight_high_fee_warning) ? (
                        <span className="mt-1 inline-flex rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">{t.grid.highFeeShort}</span>
                      ) : null}
                      {freightSettled ? (
                        <span className="mt-1 inline-flex rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-800">{t.grid.freightSettled}</span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">{r.ems_tracking_code || '—'}</td>
                    <td className="max-w-[220px] px-2 py-2">
                      <div>{r.ems_status || r.ems_error || '—'}</div>
                      {r.ems_phase ? <div className="mt-0.5 text-[11px] text-muted-foreground">{r.ems_phase}</div> : null}
                    </td>
                    <td className="px-2 py-2">
                      {rawShop || r.return_to_shop_label ? (
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${shopStatusBadgeClass(rawShop)}`}>
                          {emsShopStatusText(t, r)}
                        </span>
                      ) : r.order_code ? (
                        <span className="text-[11px] text-amber-700">{t.grid.unlinkedOrder}</span>
                      ) : '—'}
                      {r.current_step_key ? <div className="mt-1 text-[11px] text-muted-foreground">{emsTimelineText(t, r.current_step_key)}</div> : null}
                    </td>
                    <td className="px-2 py-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${syncBadgeClass(r.sync_status)}`}>
                        {syncLabel(t, r.sync_status)}
                      </span>
                      {r.sync_message ? <p className="mt-1 max-w-[180px] text-[11px] text-muted-foreground">{r.sync_message}</p> : null}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <button type="button" className="text-[11px] font-medium text-indigo-700 hover:underline disabled:opacity-50" disabled={busy === `one-${r.id}`} onClick={() => void refreshOne(r.id)}>
                          {busy === `one-${r.id}` ? t.searchCard.refreshing : t.trackingRefresh}
                        </button>
                        <button type="button" className="text-[11px] font-medium text-emerald-700 hover:underline" onClick={() => void viewStatus(r)}>{t.viewStatus}</button>
                        <button type="button" className="text-[11px] font-medium text-red-600 hover:underline disabled:opacity-50" disabled={busy === 'delete'} onClick={() => void deleteIds([r.id])}>{t.grid.deleteOne}</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
          {total > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
              <span>
                {t.grid.pageSummary.replace('{page}', String(page)).replace('{pages}', String(pages)).replace('{n}', total.toLocaleString('vi-VN'))}
                {syncStatus ? t.grid.filteredNote : ''}
                {appliedSearch ? ` · ${appliedSearch}` : ''}
              </span>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setSkip(0)}>{t.grid.pageFirst}</Button>
                <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setSkip(Math.max(0, skip - pageSize))}>{t.prevPage}</Button>
                <Button type="button" size="sm" variant="outline" disabled={page >= pages} onClick={() => setSkip(skip + pageSize)}>{t.nextPage}</Button>
                <Button type="button" size="sm" variant="outline" disabled={page >= pages} onClick={() => setSkip((pages - 1) * pageSize)}>{t.grid.pageLast}</Button>
              </div>
            </div>
          ) : null}
        </CardContent>
        ) : null}
      </Card>

      {statusModal ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setStatusModal(null)} role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-auto rounded-xl border bg-background p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">{t.grid.statusTitle}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {statusModal.row.order_code || '—'} · {statusModal.row.reference_code || '—'}
                </p>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => setStatusModal(null)}>{t.closePanel}</Button>
            </div>
            {statusModal.row.order_code && !statusModal.row.order_id ? (
              <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <p className="font-medium">{t.grid.statusUnlinked}</p>
                {statusModal.row.ems_status || statusModal.row.ems_error ? (
                  <p className="border-t border-amber-200 pt-1 text-xs">EMS: {statusModal.row.ems_status || statusModal.row.ems_error}</p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2 rounded-lg border bg-muted/40 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{t.grid.statusCurrent}</span>
                  <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${shopStatusBadgeClass(statusModal.row.shop_order_status || statusModal.row.order_status)}`}>
                    {emsShopStatusText(t, statusModal.row)}
                  </span>
                </div>
                {statusModal.row.current_step_key ? (
                  <p className="text-sm">
                    {t.grid.statusStep}: <strong>{emsTimelineText(t, statusModal.row.current_step_key)}</strong>
                  </p>
                ) : null}
              </div>
            )}
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4">
              <h4 className="mb-2 text-sm font-semibold text-indigo-950">{t.grid.emsJourney}</h4>
              {statusModal.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {statusModal.error ? <p className="text-sm text-destructive">{statusModal.error}</p> : null}
              {statusModal.current ? (
                <p className="mb-2 text-xs text-indigo-800">{t.grid.emsLatest}: <strong>{statusModal.current}</strong></p>
              ) : null}
              <ul className="space-y-2 text-sm">
                {statusModal.events.map((ev, i) => (
                  <li key={`${ev.traced_at || i}-${ev.description}`} className="flex items-start gap-2">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${i === 0 ? 'bg-indigo-600' : 'bg-indigo-300'}`} />
                    <span className={i === 0 ? 'font-medium text-indigo-900' : ''}>
                      {ev.description}
                      {ev.traced_at ? <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{formatEmsEventAt(ev.traced_at)}</span> : null}
                      {ev.address ? <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{ev.address}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
              {!statusModal.loading && !statusModal.events.length && !statusModal.error ? (
                <p className="text-sm text-muted-foreground">{statusModal.row.ems_status || t.noRows}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
