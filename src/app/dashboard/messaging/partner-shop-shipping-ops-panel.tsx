'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import type { WebLocale } from '@/lib/i18n/config'
import { partnerShippingOpsCopy, type PartnerShippingOpsCopy } from '@/lib/i18n/partner-shipping-ops-copy'
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
  total?: number
  in_transit_count?: number
  delivered_count?: number
  returned_count?: number
  return_shop_received_count?: number
  pending_status_count?: number
  total_cod_sum?: number
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

function statusTone(status: string): string {
  if (['matched', 'settled', 'confirmed', 'ready_to_confirm', 'created', 'in_progress'].includes(status)) {
    return 'text-emerald-700'
  }
  if (['amount_mismatch', 'not_ready', 'already_settled', 'already_returned', 'updated'].includes(status)) {
    return 'text-amber-800'
  }
  if (['record_not_found', 'parse_error', 'not_found', 'error'].includes(status)) return 'text-destructive'
  return 'text-muted-foreground'
}

function CountBtn({
  n,
  onClick,
}: {
  n: number
  onClick: () => void
}) {
  if (!n) return <span className="tabular-nums text-muted-foreground">0</span>
  return (
    <button type="button" className="tabular-nums text-primary hover:underline" onClick={onClick}>
      {n.toLocaleString('vi-VN')}
    </button>
  )
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
  if (status === 'ems_not_found' || status === 'parse_error') return 'border-red-200 bg-red-100 text-red-800'
  return 'border-border bg-muted text-muted-foreground'
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
    } catch (err) {
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
    setSkip(0)
    setAppliedSearch(searchInput.trim())
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

  const refreshTracking = async (ids?: string[]) => {
    const picked = ids?.length ? ids : []
    const useFilter = !picked.length && Boolean(appliedSearch || syncStatus)
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
            : { q: appliedSearch || '', sync_status: syncStatus || undefined, source: 'manual' },
        ),
      })
      const data = (await res.json().catch(() => null)) as TrackingJob | { detail?: string; error?: string }
      if (!res.ok || !('job_id' in data)) {
        throw new Error(('detail' in data && data.detail) || ('error' in data && data.error) || t.loadError)
      }
      setJob(data)
      await pollJob(data.job_id)
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : t.loadError, variant: 'destructive' })
    } finally {
      setBusy('')
    }
  }

  const deleteSelected = async () => {
    const ids = Object.entries(selected).filter(([, v]) => v).map(([id]) => id)
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
      setSelected({})
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
    if (freightFilter === 'high_fee') return r.high_fee_warning === '1'
    return r.reconcile_status === freightFilter
  })
  const inv = warehouseLookup?.inventory
  const warehouseSizes = inv?.sizes?.length ? inv.sizes : inv?.parsed_size ? [inv.parsed_size] : []
  const warehouseColors = inv?.colors?.length ? inv.colors : inv?.parsed_color ? [inv.parsed_color] : []

  const composeWarehouseSku = (size: string, color: string) => {
    const base = inv?.parsed_base || String(warehouseLookup?.sku || warehouseCode).split('/')[0]
    return [base, size, color].filter(Boolean).join('/')
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
            <div className="flex gap-2 shrink-0">
              <Button type="submit" size="sm" disabled={listLoading}>
                {listLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.searchButton}
              </Button>
              {appliedSearch ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSearchInput('')
                    setAppliedSearch('')
                    setSkip(0)
                  }}
                >
                  {t.searchClear}
                </Button>
              ) : null}
            </div>
          </form>
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
              <option value="year">Năm</option>
              <option value="month">Tháng</option>
              <option value="week">Tuần</option>
              <option value="day">Ngày</option>
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
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-2">Kỳ</th>
                <th className="py-1 pr-2">Tổng</th>
                <th className="py-1 pr-2">Đang giao</th>
                <th className="py-1 pr-2">Giao OK</th>
                <th className="py-1 pr-2">Hoàn chưa trả</th>
                <th className="py-1 pr-2">Hoàn đã trả</th>
                <th className="py-1">COD</th>
              </tr>
            </thead>
            <tbody>
              {(timeline?.items || []).map((it) => (
                <tr key={it.period_key} className="border-t border-border/60">
                  <td className="py-1.5 pr-2">{it.period_label}</td>
                  <td className="py-1.5 pr-2">
                    <CountBtn n={it.total ?? 0} onClick={() => void openRecords({ key: 'total', label: `${it.period_label} · Tổng`, axis: 'import', periodKey: it.period_key, periodLabel: it.period_label })} />
                  </td>
                  <td className="py-1.5 pr-2">
                    <CountBtn n={it.in_transit_count ?? 0} onClick={() => void openRecords({ key: 'in_transit', label: `${it.period_label} · Đang giao`, axis: 'import', periodKey: it.period_key, periodLabel: it.period_label })} />
                  </td>
                  <td className="py-1.5 pr-2">
                    <CountBtn n={it.delivered_count ?? 0} onClick={() => void openRecords({ key: 'delivered', label: `${it.period_label} · Giao OK`, axis: 'import', periodKey: it.period_key, periodLabel: it.period_label })} />
                  </td>
                  <td className="py-1.5 pr-2">
                    <CountBtn n={it.returned_count ?? 0} onClick={() => void openRecords({ key: 'returned', label: `${it.period_label} · Hoàn chưa trả`, axis: 'import', periodKey: it.period_key, periodLabel: it.period_label })} />
                  </td>
                  <td className="py-1.5 pr-2">
                    <CountBtn n={it.return_shop_received_count ?? 0} onClick={() => void openRecords({ key: 'shop_return_received', label: `${it.period_label} · Hoàn đã trả`, axis: 'import', periodKey: it.period_key, periodLabel: it.period_label })} />
                  </td>
                  <td className="py-1.5 tabular-nums">{vnd(it.total_cod_sum)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!timeline?.items.length ? <p className="py-3 text-sm text-muted-foreground">{t.noRows}</p> : null}
          <h3 className="mt-4 text-sm font-medium">{t.receivedTitle}</h3>
          <table className="mt-1 w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-2">Kỳ</th>
                <th className="py-1 pr-2">COD nhận</th>
                <th className="py-1 pr-2">Tiền COD</th>
                <th className="py-1 pr-2">Hoàn shop nhận</th>
                <th className="py-1">COD hoàn</th>
              </tr>
            </thead>
            <tbody>
              {(received?.items || []).map((it) => (
                <tr key={`r-${it.period_key}`} className="border-t border-border/60">
                  <td className="py-1.5 pr-2">{it.period_label}</td>
                  <td className="py-1.5 pr-2">
                    <CountBtn n={it.cod_received_count ?? 0} onClick={() => void openRecords({ key: 'cod_received_in_period', label: `${it.period_label} · COD nhận`, axis: 'received', periodKey: it.period_key, periodLabel: it.period_label })} />
                  </td>
                  <td className="py-1.5 pr-2 tabular-nums">{vnd(it.cod_received_total)}</td>
                  <td className="py-1.5 pr-2">
                    <CountBtn n={it.return_received_count ?? 0} onClick={() => void openRecords({ key: 'shop_return_received', label: `${it.period_label} · Hoàn shop nhận`, axis: 'received', periodKey: it.period_key, periodLabel: it.period_label })} />
                  </td>
                  <td className="py-1.5 tabular-nums">{vnd(it.return_received_cod_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {activeBucket ? (
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between px-4 py-3 pb-2">
            <CardTitle className="text-sm font-medium">
              {activeBucket.label}
              {bucketTotal ? ` · ${bucketTotal.toLocaleString('vi-VN')}` : ''}
            </CardTitle>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setActiveBucket(null); setBucketRows([]) }}>{t.closePanel}</Button>
          </CardHeader>
          <CardContent className="overflow-x-auto px-4 pb-4 pt-0">
            {bucketLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <table className="w-full min-w-[640px] text-xs">
              <tbody>
                {bucketRows.map((r) => (
                  <tr key={r.id} className="border-t border-border/60 align-top">
                    <td className="py-1.5 pr-2 font-medium">{r.ems_tracking_code || r.reference_code}</td>
                    <td className="py-1.5 pr-2">{r.order_code || '—'}</td>
                    <td className="py-1.5 pr-2 tabular-nums">{r.cod_amount != null ? vnd(r.cod_amount) : '—'}</td>
                    <td className="py-1.5 pr-2">{r.ems_status || '—'}</td>
                    <td className="py-1.5">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${syncBadgeClass(r.sync_status)}`}>
                        {syncLabel(t, r.sync_status)}
                      </span>
                    </td>
                    <td className="py-1.5">
                      <div className="flex flex-wrap gap-1">
                        <Button type="button" size="sm" variant="outline" disabled={busy === `one-${r.id}`} onClick={() => void refreshOne(r.id)}>
                          {busy === `one-${r.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : t.refreshOne}
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => void viewStatus(r)}>{t.viewStatus}</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{bucketTotal.toLocaleString('vi-VN')} dòng</span>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" disabled={bucketSkip <= 0 || bucketLoading} onClick={() => void openRecords({ ...activeBucket, skip: Math.max(0, bucketSkip - 25) })}>{t.prevPage}</Button>
                <Button type="button" size="sm" variant="outline" disabled={bucketSkip + 25 >= bucketTotal || bucketLoading} onClick={() => void openRecords({ ...activeBucket, skip: bucketSkip + 25 })}>{t.nextPage}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
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
              <p className="px-2 py-1.5 text-[11px] font-medium">{t.importReport}</p>
              <table className="w-full min-w-[640px] text-xs">
                <thead>
                  <tr className="border-t border-border/60 text-left text-muted-foreground">
                    <th className="px-2 py-1">#</th>
                    <th className="px-2 py-1">EMS</th>
                    <th className="px-2 py-1">Đơn</th>
                    <th className="px-2 py-1">COD</th>
                    <th className="px-2 py-1">{t.importReport}</th>
                  </tr>
                </thead>
                <tbody>
                  {emsReportRows.map((row, i) => (
                    <tr key={`${String(row.reference_code || i)}-${i}`} className="border-t border-border/50">
                      <td className="px-2 py-1 tabular-nums">{String(row.row_number || i + 1)}</td>
                      <td className="px-2 py-1 font-medium">{String(row.reference_code || '')}</td>
                      <td className="px-2 py-1">{String(row.order_code || '')}</td>
                      <td className="px-2 py-1 tabular-nums">{vnd(Number(row.cod_amount || 0))}</td>
                      <td className={`px-2 py-1 ${statusTone(String(row.import_action || row.sync_status || ''))}`}>
                        {String(row.import_action || '')} · {String(row.sync_status || '')}
                        {row.sync_message ? ` — ${String(row.sync_message)}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
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
                  <table className="w-full min-w-[720px] text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="px-2 py-1">EMS</th>
                        <th className="px-2 py-1">Ref</th>
                        <th className="px-2 py-1">{t.totalPaid}</th>
                        <th className="px-2 py-1">COD DB</th>
                        <th className="px-2 py-1">{t.difference}</th>
                        <th className="px-2 py-1">{t.syncStatsTitle}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {codRows.map((row, i) => (
                        <tr key={`${row.ems_tracking_code || i}`} className="border-t border-border/50">
                          <td className="px-2 py-1 font-medium">{row.ems_tracking_code || ''}</td>
                          <td className="px-2 py-1">{row.ems_reference_code || ''}</td>
                          <td className="px-2 py-1 tabular-nums">{vnd(row.paid_amount)}</td>
                          <td className="px-2 py-1 tabular-nums">{vnd(row.db_cod_amount)}</td>
                          <td className="px-2 py-1 tabular-nums">{vnd(row.amount_difference)}</td>
                          <td className={`px-2 py-1 ${statusTone(row.reconcile_status || '')}`}>
                            {row.reconcile_status} {row.reconcile_message ? `— ${row.reconcile_message}` : ''}
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
              <table className="w-full min-w-[640px] text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="px-2 py-1">Mã nhập</th>
                    <th className="px-2 py-1">Đơn</th>
                    <th className="px-2 py-1">EMS</th>
                    <th className="px-2 py-1">Kết quả</th>
                  </tr>
                </thead>
                <tbody>
                  {returnPreview.map((row) => (
                    <tr key={row.input} className="border-t border-border/50">
                      <td className="px-2 py-1 font-medium">{row.input}</td>
                      <td className="px-2 py-1">{row.order_code || ''}</td>
                      <td className="px-2 py-1">{row.ems_tracking_code || ''}</td>
                      <td className={`px-2 py-1 ${statusTone(row.status)}`}>
                        {row.status} — {row.message}
                        {row.ems_status ? ` (${row.ems_status})` : ''}
                      </td>
                    </tr>
                  ))}
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
              {inv.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={inv.image_url} alt="" className="h-16 w-16 rounded object-cover" />
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
                  <table className="w-full min-w-[640px] text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="px-2 py-1">EMS</th>
                        <th className="px-2 py-1">Cước</th>
                        <th className="px-2 py-1">{t.highFee}</th>
                        <th className="px-2 py-1">{t.syncStatsTitle}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {freightRows.map((row, i) => (
                        <tr key={`${row.ems_tracking_code || i}`} className={`border-t border-border/50 ${row.high_fee_warning === '1' ? 'bg-amber-50/80' : ''}`}>
                          <td className="px-2 py-1 font-medium">{row.ems_tracking_code || ''}</td>
                          <td className="px-2 py-1 tabular-nums">{vnd(row.freight_amount)}</td>
                          <td className="px-2 py-1">{row.high_fee_warning === '1' ? t.highFee : ''}</td>
                          <td className={`px-2 py-1 ${statusTone(row.reconcile_status || '')}`}>
                            {row.reconcile_status} {row.reconcile_message ? `— ${row.reconcile_message}` : ''}
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium">{t.tableTitle}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" disabled={busy === 'tracking'} onClick={() => void refreshTracking(selectedIds.length ? selectedIds : undefined)}>
                {busy === 'tracking' ? <Loader2 className="h-4 w-4 animate-spin" /> : t.trackingRefresh}
              </Button>
              <Button type="button" size="sm" variant="destructive" disabled={!selectedIds.length || busy === 'delete'} onClick={() => void deleteSelected()}>
                {t.deleteSelected}
              </Button>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value) as (typeof PAGE_SIZES)[number])
                  setSkip(0)
                }}
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>{n}{t.perPage}</option>
                ))}
              </select>
            </div>
          </div>
          {listSummary ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {([
                ['', t.filterAll, listSummary.total_rows],
                ['matched', t.syncMatched, listSummary.matched],
                ['in_progress', t.syncInProgress, listSummary.in_progress],
                ['mismatch', t.syncMismatch, listSummary.mismatch],
                ['unlinked', t.syncUnlinked, listSummary.unlinked],
                ['ems_not_found', t.syncEmsMissing, listSummary.ems_not_found],
                ['parse_error', t.syncParseError, listSummary.parse_error],
              ] as const).map(([key, label, count]) => (
                <FilterChip
                  key={key || 'all'}
                  label={label}
                  count={count}
                  active={syncStatus === key}
                  onClick={() => {
                    setSyncStatus(key)
                    setSkip(0)
                  }}
                />
              ))}
            </div>
          ) : null}
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
        <CardContent className="overflow-x-auto px-4 pb-4 pt-0">
          <table className="w-full min-w-[880px] text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-2">
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
                <th className="py-1 pr-2">{t.colTracking}</th>
                <th className="py-1 pr-2">{t.colOrder}</th>
                <th className="py-1 pr-2">{t.colCustomer}</th>
                <th className="py-1 pr-2">{t.colEmsStatus}</th>
                <th className="py-1 pr-2">{t.colCod}</th>
                <th className="py-1 pr-2">{t.colFreight}</th>
                <th className="py-1 pr-2">{t.colSync}</th>
                <th className="py-1">{t.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/60 align-top">
                  <td className="py-1.5 pr-2">
                    <input type="checkbox" checked={Boolean(selected[r.id])} onChange={(e) => setSelected((s) => ({ ...s, [r.id]: e.target.checked }))} />
                  </td>
                  <td className="py-1.5 pr-2">
                    <div className="font-medium">{r.ems_tracking_code || r.reference_code}</div>
                    <div className="text-muted-foreground">{r.product_code}</div>
                  </td>
                  <td className="py-1.5 pr-2">
                    {r.order_code || '—'}
                    <div className="text-muted-foreground">{r.shop_order_status || r.order_status || ''}</div>
                  </td>
                  <td className="py-1.5 pr-2">{r.recipient_label || r.shop_customer_name || r.shop_customer_phone || '—'}</td>
                  <td className="py-1.5 pr-2 max-w-[220px]">
                    <div>{r.ems_status || '—'}</div>
                    {r.return_to_shop_label ? <div className="text-orange-700">{r.return_to_shop_label}</div> : null}
                  </td>
                  <td className="py-1.5 pr-2 tabular-nums">
                    {r.cod_amount != null ? vnd(r.cod_amount) : '—'}
                    {r.cod_settlement_status ? <div className="text-muted-foreground">{r.cod_settlement_status}</div> : null}
                  </td>
                  <td className="py-1.5 pr-2 tabular-nums">
                    {r.freight_amount != null ? vnd(r.freight_amount) : '—'}
                    {r.freight_settlement_status ? <div className="text-muted-foreground">{r.freight_settlement_status}</div> : null}
                    {r.freight_high_fee_warning === '1' || r.freight_high_fee_warning === 'yes' ? (
                      <div className="text-amber-800">{t.highFee}</div>
                    ) : null}
                  </td>
                  <td className="py-1.5 pr-2">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${syncBadgeClass(r.sync_status)}`}>
                      {syncLabel(t, r.sync_status)}
                    </span>
                    {r.sync_message ? <p className="mt-1 max-w-[180px] text-[10px] text-muted-foreground">{r.sync_message}</p> : null}
                  </td>
                  <td className="py-1.5">
                    <div className="flex flex-col items-start gap-1">
                      <Button type="button" size="sm" variant="outline" disabled={busy === `one-${r.id}`} onClick={() => void refreshOne(r.id)}>
                        {busy === `one-${r.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : t.refreshOne}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => void viewStatus(r)}>{t.viewStatus}</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && !listLoading ? <p className="py-4 text-sm text-muted-foreground">{t.noRows}</p> : null}
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{total.toLocaleString('vi-VN')}</span>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setSkip(Math.max(0, skip - pageSize))}>{t.prevPage}</Button>
              <span className="self-center">{page}/{pages}</span>
              <Button type="button" size="sm" variant="outline" disabled={page >= pages} onClick={() => setSkip(skip + pageSize)}>{t.nextPage}</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {opsStats ? (
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="px-4 py-3 pb-2">
            <CardTitle className="text-sm font-medium">{t.syncStatsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 px-4 pb-4 pt-0 text-xs lg:grid-cols-4">
            <StatCard label="Ghép đơn shop" count={opsStats.shop_linked_count} onClick={() => void openBucket('shop_linked', 'Ghép đơn shop')} />
            <StatCard label="Đơn shop đang giao" count={opsStats.shop_shipping_orders} onClick={() => void openBucket('shop_shipping', 'Đơn shop đang giao')} />
            <StatCard label="Chưa đối soát cước" count={opsStats.freight_unsettled_count} onClick={() => void openBucket('freight_unsettled', 'Chưa đối soát cước')} />
            <StatCard label="Có COD" count={opsStats.total_with_cod} onClick={() => void openBucket('has_cod', 'Có COD')} />
          </CardContent>
        </Card>
      ) : null}

      {statusModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setStatusModal(null)}>
          <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-lg border bg-background p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">{t.emsEvents}</h3>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {statusModal.row.ems_tracking_code || statusModal.row.reference_code}
                </p>
                {statusModal.current ? <p className="mt-1 text-sm">{statusModal.current}</p> : null}
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => setStatusModal(null)}>{t.closePanel}</Button>
            </div>
            {statusModal.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {statusModal.error ? <p className="text-sm text-destructive">{statusModal.error}</p> : null}
            <ul className="space-y-2 text-xs">
              {statusModal.events.map((ev, i) => (
                <li key={`${ev.traced_at || i}-${ev.description}`} className="rounded-md border border-border/70 px-3 py-2">
                  {ev.traced_at ? <div className="text-muted-foreground">{formatEmsEventAt(ev.traced_at)}</div> : null}
                  <div className="font-medium">{ev.description}</div>
                  {ev.address ? <div className="text-muted-foreground">{ev.address}</div> : null}
                </li>
              ))}
            </ul>
            {!statusModal.loading && !statusModal.events.length && !statusModal.error ? (
              <p className="text-sm text-muted-foreground">{t.noRows}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
