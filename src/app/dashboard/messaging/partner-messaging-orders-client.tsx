'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Banknote, ClipboardList, Download, ExternalLink, Layers, Loader2, PiggyBank, Receipt, RefreshCw, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import type { WebLocale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { isSepayStyleOrderPayment } from '@/lib/messaging/sepay-order-ui'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database.types'
import {
  confirmMyMessagingOrderDeposit,
  exportMyMessagingOrdersExcel,
  listMyMessagingOrderEvents,
  listMyMessagingOrders,
  updateMyMessagingOrderShipping,
  updateMyMessagingOrderStatus,
  type PartnerOrderOwnerStats,
} from '@/app/dashboard/messaging/actions'

const LS_CONSULT_FLAG = 'nano_messaging_orders_consult_v1'
const LS_REVIEW_FLAG = 'nano_messaging_orders_review_v1'

type PartnerRow = Database['public']['Tables']['messaging_partners']['Row']
type OrderStatus = 'awaiting_payment' | 'payment_checking' | 'paid_verified' | 'pending_manual_review' | 'cancelled'

function messagingOrderShopTemplate(template: string, partnerDisplayName: string): string {
  const name = (partnerDisplayName ?? '').trim() || 'Shop'
  return template.replace(/\{shop\}/g, name)
}

type OrderRow = {
  id: string
  partner_id: string
  conversation_id: string
  partner_display_name: string
  status: OrderStatus
  customer_name: string
  customer_email: string
  customer_phone: string
  shipping_address: string
  product_name: string
  order_item_count?: number
  order_items_summary?: string
  product_image_url: string
  product_url: string
  quantity: number
  subtotal_amount: number
  required_amount: number
  paid_amount: number
  variant_color: string
  variant_size: string
  product_inventory_id: string | null
  note: string
  payment_reference: string
  payment_qr_url: string
  verified_note: string
  shipping_status: 'pending' | 'confirmed' | 'packing' | 'shipping' | 'delivered' | 'returned' | 'cancelled'
  locked_at: string | null
  created_at: string
  latest_proof_image_url: string | null
  latest_proof_status: 'pending' | 'verified' | 'failed' | 'manual_review' | null
  latest_proof_reason: string | null
}

type OrderEventRow = {
  id: string
  order_id: string
  event_type: string
  title: string
  detail: string
  source: string
  created_by: string
  created_at: string
}

type OrdersT = Dictionary['partnerMessagingOrders']

type LifecycleTab = 'all' | 'await_deposit' | 'await_ship' | 'await_receive' | 'received' | 'reviewed' | 'cancelled'

function loadBoolMap(key: string): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    const p = JSON.parse(raw) as unknown
    if (!p || typeof p !== 'object') return {}
    return p as Record<string, boolean>
  } catch {
    return {}
  }
}

function saveBoolMap(key: string, m: Record<string, boolean>) {
  try {
    localStorage.setItem(key, JSON.stringify(m))
  } catch {
    /* ignore quota */
  }
}

function intlLocaleTag(locale: WebLocale): string {
  if (locale === 'en') return 'en-US'
  if (locale === 'zh') return 'zh-CN'
  if (locale === 'ja') return 'ja-JP'
  if (locale === 'ko') return 'ko-KR'
  return 'vi-VN'
}

function money(v: number, locale: WebLocale): string {
  return `${new Intl.NumberFormat(intlLocaleTag(locale)).format(Math.max(0, Math.round(v || 0)))}đ`
}

function statusLabel(t: OrdersT, s: OrderStatus): string {
  if (s === 'awaiting_payment') return t.statusAwaitingPayment
  if (s === 'payment_checking') return t.statusPaymentChecking
  if (s === 'paid_verified') return t.statusPaidVerified
  if (s === 'pending_manual_review') return t.statusPendingManualReview
  return t.statusCancelled
}

function shippingLabel(t: OrdersT, s: OrderRow['shipping_status']): string {
  if (s === 'pending') return t.shippingPending
  if (s === 'confirmed') return t.shippingConfirmed
  if (s === 'packing') return t.shippingPacking
  if (s === 'shipping') return t.shippingShipping
  if (s === 'delivered') return t.shippingDelivered
  if (s === 'returned') return t.shippingReturned
  return t.shippingCancelled
}

type DepositKind = 'none' | 'partial' | 'full'

function depositKind(r: OrderRow): DepositKind {
  const req = Math.max(0, Math.round(r.required_amount || 0))
  const paid = Math.max(0, Math.round(r.paid_amount || 0))
  if (req <= 0) return 'full'
  if (paid >= req) return 'full'
  if (paid > 0) return 'partial'
  return 'none'
}

function depositLabelText(t: OrdersT, k: DepositKind): string {
  if (k === 'full') return t.depositFull
  if (k === 'partial') return t.depositPartial
  return t.depositNone
}

function proofReceiptShort(t: OrdersT, s: OrderRow['latest_proof_status']): string {
  if (s === 'verified') return t.proofReceiptShortVerified
  if (s === 'manual_review') return t.proofReceiptShortManual
  if (s === 'failed') return t.proofReceiptShortFailed
  if (s === 'pending') return t.proofReceiptShortPending
  return t.proofReceiptShortNone
}

function isOrderCancelled(r: OrderRow): boolean {
  return r.status === 'cancelled' || r.shipping_status === 'cancelled' || r.shipping_status === 'returned'
}

function needsDepositStage(r: OrderRow): boolean {
  if (isOrderCancelled(r)) return false
  const req = Math.max(0, Math.round(r.required_amount || 0))
  const paid = Math.max(0, Math.round(r.paid_amount || 0))
  if (req > 0 && paid >= req) {
    return r.status !== 'paid_verified'
  }
  if (depositKind(r) !== 'full') return true
  if (r.status === 'awaiting_payment' || r.status === 'payment_checking' || r.status === 'pending_manual_review') return true
  return false
}

function matchesLifecycleTab(r: OrderRow, tab: LifecycleTab, reviewed: Record<string, boolean>): boolean {
  if (tab === 'all') return true
  if (tab === 'cancelled') return isOrderCancelled(r)
  if (tab === 'reviewed') return Boolean(reviewed[r.id])
  if (isOrderCancelled(r)) return false
  if (tab === 'received') return r.shipping_status === 'delivered' && !reviewed[r.id]
  if (tab === 'await_receive') return r.shipping_status === 'shipping'
  if (tab === 'await_ship') {
    if (r.shipping_status === 'shipping' || r.shipping_status === 'delivered') return false
    return !needsDepositStage(r)
  }
  if (tab === 'await_deposit') {
    if (r.shipping_status === 'shipping' || r.shipping_status === 'delivered') return false
    return needsDepositStage(r)
  }
  return true
}

function primaryStageBadgeLabel(t: OrdersT, r: OrderRow): string {
  if (isOrderCancelled(r)) return t.statusCancelled
  if (r.shipping_status === 'delivered') return t.shippingDelivered
  if (r.shipping_status === 'shipping') return t.shippingShipping
  const req = Math.max(0, Math.round(r.required_amount || 0))
  const paid = Math.max(0, Math.round(r.paid_amount || 0))
  if (req > 0 && paid >= req && r.status !== 'paid_verified') return t.statusPaymentChecking
  if (needsDepositStage(r)) return t.tabAwaitDeposit
  return t.tabAwaitShip
}

function payBadgeLabel(t: OrdersT, r: OrderRow): string {
  if (isOrderCancelled(r)) return t.statusCancelled
  const dk = depositKind(r)
  if (dk === 'none') return t.badgePayAwaiting
  if (dk === 'partial') return t.badgePayPartial
  if (r.status === 'awaiting_payment' || r.status === 'payment_checking' || r.status === 'pending_manual_review')
    return t.badgePayAwaiting
  return t.badgePayDone
}

function orderCodeDisplay(r: OrderRow): string {
  const ref = (r.payment_reference ?? '').trim()
  if (ref) return ref
  return `#${r.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`
}

function codRemainder(r: OrderRow): number {
  const sub = Math.max(0, Math.round(r.subtotal_amount || 0))
  const paid = Math.max(0, Math.round(r.paid_amount || 0))
  return Math.max(0, sub - paid)
}

const LIFECYCLE_TABS: { id: LifecycleTab }[] = [
  { id: 'all' },
  { id: 'await_deposit' },
  { id: 'await_ship' },
  { id: 'await_receive' },
  { id: 'received' },
  { id: 'reviewed' },
  { id: 'cancelled' },
]

function tabTitle(t: OrdersT, id: LifecycleTab): string {
  switch (id) {
    case 'all':
      return t.tabAll
    case 'await_deposit':
      return t.tabAwaitDeposit
    case 'await_ship':
      return t.tabAwaitShip
    case 'await_receive':
      return t.tabAwaitReceive
    case 'received':
      return t.tabReceived
    case 'reviewed':
      return t.tabReviewed
    case 'cancelled':
      return t.tabCancelled
    default:
      return t.tabAll
  }
}

export function PartnerMessagingOrdersClient({
  initialPartners,
  ordersT,
  locale,
}: {
  initialPartners: PartnerRow[]
  ordersT: OrdersT
  locale: WebLocale
}) {
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const [rows, setRows] = useState<OrderRow[]>([])
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('all')
  const /** YYYY-MM-DD */ [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [query, setQuery] = useState('')
  const [lifecycleTab, setLifecycleTab] = useState<LifecycleTab>('all')
  const [filterShipping, setFilterShipping] = useState<'all' | OrderRow['shipping_status']>('all')
  const [filterPayment, setFilterPayment] = useState<'all' | OrderStatus>('all')
  const [consultedMap, setConsultedMap] = useState<Record<string, boolean>>({})
  const [reviewedMap, setReviewedMap] = useState<Record<string, boolean>>({})

  const [noteByOrder, setNoteByOrder] = useState<Record<string, string>>({})
  const [detailModalOrderId, setDetailModalOrderId] = useState<string | null>(null)
  const [eventsByOrder, setEventsByOrder] = useState<Record<string, OrderEventRow[]>>({})
  const [stats, setStats] = useState<PartnerOrderOwnerStats | null>(null)

  const tag = intlLocaleTag(locale)
  const t = ordersT

  useEffect(() => {
    setConsultedMap(loadBoolMap(LS_CONSULT_FLAG))
    setReviewedMap(loadBoolMap(LS_REVIEW_FLAG))
  }, [])

  const toggleConsulted = useCallback((orderId: string, next: boolean) => {
    setConsultedMap((prev) => {
      const n = { ...prev, [orderId]: next }
      saveBoolMap(LS_CONSULT_FLAG, n)
      return n
    })
  }, [])

  const toggleReviewed = useCallback((orderId: string, next: boolean) => {
    setReviewedMap((prev) => {
      const n = { ...prev, [orderId]: next }
      saveBoolMap(LS_REVIEW_FLAG, n)
      return n
    })
  }, [])

  const loadOrders = () => {
    startTransition(async () => {
      const res = await listMyMessagingOrders({
        partnerId: selectedPartnerId === 'all' ? '' : selectedPartnerId,
        status: '',
        createdFrom: dateFrom.trim() || undefined,
        createdTo: dateTo.trim() || undefined,
        limit: 200,
      })
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      if ('rows' in res && 'stats' in res) {
        setRows((res.rows ?? []) as unknown as OrderRow[])
        setStats(res.stats)
      }
    })
  }

  const exportExcel = () => {
    startTransition(async () => {
      const res = await exportMyMessagingOrdersExcel({
        partnerId: selectedPartnerId === 'all' ? '' : selectedPartnerId,
        status: filterPayment === 'all' ? '' : filterPayment,
        createdFrom: dateFrom.trim() || undefined,
        createdTo: dateTo.trim() || undefined,
      })
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      if (!('ok' in res) || !res.ok) return
      const bin = atob(res.base64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
      const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.filename
      a.click()
      URL.revokeObjectURL(url)
      toast({
        title: t.toastExportDone
          .replace('{count}', res.count.toLocaleString(tag))
          .replace('{filename}', res.filename),
      })
    })
  }

  useEffect(() => {
    loadOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPartnerId, dateFrom, dateTo])

  const baseFiltered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (filterShipping !== 'all' && r.shipping_status !== filterShipping) return false
      if (filterPayment !== 'all' && r.status !== filterPayment) return false
      if (!q) return true
      return (
        (r.payment_reference || '').toLowerCase().includes(q) ||
        r.product_name.toLowerCase().includes(q) ||
        (r.order_items_summary || '').toLowerCase().includes(q) ||
        (r.customer_name || '').toLowerCase().includes(q) ||
        (r.customer_phone || '').toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      )
    })
  }, [rows, query, filterShipping, filterPayment])

  const tabCounts = useMemo(() => {
    const m: Record<LifecycleTab, number> = {
      all: baseFiltered.length,
      await_deposit: 0,
      await_ship: 0,
      await_receive: 0,
      received: 0,
      reviewed: 0,
      cancelled: 0,
    }
    for (const r of baseFiltered) {
      for (const x of LIFECYCLE_TABS) {
        if (x.id === 'all') continue
        if (matchesLifecycleTab(r, x.id, reviewedMap)) m[x.id] += 1
      }
    }
    return m
  }, [baseFiltered, reviewedMap])

  const displayRows = useMemo(() => {
    if (lifecycleTab === 'all') return baseFiltered
    return baseFiltered.filter((r) => matchesLifecycleTab(r, lifecycleTab, reviewedMap))
  }, [baseFiltered, lifecycleTab, reviewedMap])

  const clearTableFilters = () => {
    setQuery('')
    setFilterShipping('all')
    setFilterPayment('all')
    setLifecycleTab('all')
  }

  const setStatus = (orderId: string, status: OrderStatus) => {
    startTransition(async () => {
      const note = (noteByOrder[orderId] ?? '').trim()
      const res = await updateMyMessagingOrderStatus({ orderId, status, verifiedNote: note })
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      toast({ title: t.toastStatusUpdated })
      setEventsByOrder((prev) => {
        if (prev[orderId] === undefined) return prev
        const n = { ...prev }
        delete n[orderId]
        return n
      })
      loadOrders()
    })
  }

  const confirmDepositManual = (orderId: string) => {
    startTransition(async () => {
      const note = (noteByOrder[orderId] ?? '').trim()
      const res = await confirmMyMessagingOrderDeposit({ orderId, verifiedNote: note })
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      toast({ title: t.toastStatusUpdated })
      setEventsByOrder((prev) => {
        if (prev[orderId] === undefined) return prev
        const n = { ...prev }
        delete n[orderId]
        return n
      })
      loadOrders()
    })
  }

  const setShipping = (orderId: string, shippingStatus: OrderRow['shipping_status']) => {
    startTransition(async () => {
      const note = (noteByOrder[orderId] ?? '').trim()
      const res = await updateMyMessagingOrderShipping({
        orderId,
        shippingStatus,
        note,
      })
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      toast({ title: t.toastShippingUpdated })
      loadOrders()
      if (detailModalOrderId === orderId) {
        const evt = await listMyMessagingOrderEvents({ orderId, limit: 60 })
        if ('rows' in evt) {
          setEventsByOrder((prev) => ({ ...prev, [orderId]: (evt.rows ?? []) as unknown as OrderEventRow[] }))
        }
      }
    })
  }

  useEffect(() => {
    const oid = detailModalOrderId
    if (!oid || eventsByOrder[oid] !== undefined) return
    startTransition(async () => {
      const res = await listMyMessagingOrderEvents({ orderId: oid, limit: 60 })
      if ('rows' in res) {
        setEventsByOrder((prev) => ({ ...prev, [oid]: (res.rows ?? []) as unknown as OrderEventRow[] }))
      } else {
        setEventsByOrder((prev) => ({ ...prev, [oid]: [] }))
      }
    })
  }, [eventsByOrder, detailModalOrderId])

  const detailOrder = useMemo(
    () => (detailModalOrderId ? rows.find((x) => x.id === detailModalOrderId) ?? null : null),
    [rows, detailModalOrderId]
  )

  return (
    <div className="space-y-3 md:space-y-4">
      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardContent className="space-y-3 p-3 sm:p-4">
          <div className="flex flex-wrap items-end gap-2 sm:gap-3">
            <div className="flex min-w-[180px] flex-1 flex-col gap-1">
              <Label className="text-[11px] font-medium text-muted-foreground">{t.allWorkspaces}</Label>
              <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
                <SelectTrigger className="h-9 w-full sm:max-w-[280px]">
                  <SelectValue placeholder={t.allWorkspaces} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.allWorkspaces}</SelectItem>
                  {initialPartners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="messaging-orders-date-from" className="text-[11px] font-medium text-muted-foreground">
                  {t.filterCreatedFrom}
                </Label>
                <Input
                  id="messaging-orders-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9 w-[140px] sm:w-[150px]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="messaging-orders-date-to" className="text-[11px] font-medium text-muted-foreground">
                  {t.filterCreatedTo}
                </Label>
                <Input
                  id="messaging-orders-date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-9 w-[140px] sm:w-[150px]"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-9 px-3"
                onClick={() => exportExcel()}
                disabled={pending}
                title={t.exportExcelTitle}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                {t.exportExcel}
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-9 px-3" onClick={loadOrders} disabled={pending}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                {t.reload}
              </Button>
            </div>
          </div>

          {stats ? (
            <div className="border-t border-border/60 pt-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Layers className="h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
                {t.summaryTitle}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-lg border border-border/70 bg-muted/15 px-2.5 py-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                    <ClipboardList className="h-3 w-3 shrink-0" aria-hidden />
                    {t.statOrders}
                  </div>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight">{stats.orderCount.toLocaleString(tag)}</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/15 px-2.5 py-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                    <Receipt className="h-3 w-3 shrink-0" aria-hidden />
                    {t.statSubtotal}
                  </div>
                  <p className="mt-0.5 text-base font-semibold tabular-nums leading-snug">{money(stats.sumSubtotalVnd, locale)}</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/15 px-2.5 py-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                    <PiggyBank className="h-3 w-3 shrink-0" aria-hidden />
                    {t.statRequired}
                  </div>
                  <p className="mt-0.5 text-base font-semibold tabular-nums leading-snug">{money(stats.sumRequiredVnd, locale)}</p>
                </div>
                <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] px-2.5 py-2 dark:bg-emerald-500/10">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-300">
                    <Wallet className="h-3 w-3 shrink-0" aria-hidden />
                    {t.statPaid}
                  </div>
                  <p className="mt-0.5 text-base font-semibold tabular-nums text-emerald-900 dark:text-emerald-100">{money(stats.sumPaidVnd, locale)}</p>
                </div>
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-2.5 py-2 dark:bg-amber-500/10 sm:col-span-2 lg:col-span-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-amber-900 dark:text-amber-200">
                    <Banknote className="h-3 w-3 shrink-0" aria-hidden />
                    {t.statOutstanding}
                  </div>
                  <p className="mt-0.5 text-base font-semibold tabular-nums">{money(stats.sumOutstandingVnd, locale)}</p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="border-t border-border/60 pt-3">
            <div className="rounded-lg bg-muted/40 p-1 dark:bg-muted/25">
              <div className="-mx-0.5 flex gap-0.5 overflow-x-auto px-0.5 [scrollbar-width:thin]">
                {LIFECYCLE_TABS.map(({ id }) => {
                  const active = lifecycleTab === id
                  const count = tabCounts[id]
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setLifecycleTab(id)}
                      className={cn(
                        'shrink-0 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1 sm:text-sm',
                        active
                          ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/20'
                          : 'border border-transparent text-muted-foreground hover:bg-background hover:text-foreground'
                      )}
                    >
                      <span className="whitespace-nowrap">
                        {tabTitle(t, id)}{' '}
                        <span className={cn('tabular-nums', active ? 'text-white/90' : 'text-muted-foreground')}>
                          ({count.toLocaleString(tag)})
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="h-9 min-w-0 flex-1 sm:min-w-[200px]"
            />
            <div className="flex flex-wrap gap-2">
              <Select value={filterShipping} onValueChange={(v) => setFilterShipping(v as typeof filterShipping)}>
                <SelectTrigger className="h-9 w-full min-w-[160px] sm:w-[180px]">
                  <SelectValue placeholder={t.filterShippingLabel} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.filterShippingLabel}</SelectItem>
                  <SelectItem value="pending">{t.shippingPending}</SelectItem>
                  <SelectItem value="confirmed">{t.shippingConfirmed}</SelectItem>
                  <SelectItem value="packing">{t.shippingPacking}</SelectItem>
                  <SelectItem value="shipping">{t.shippingShipping}</SelectItem>
                  <SelectItem value="delivered">{t.shippingDelivered}</SelectItem>
                  <SelectItem value="returned">{t.shippingReturned}</SelectItem>
                  <SelectItem value="cancelled">{t.shippingCancelled}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPayment} onValueChange={(v) => setFilterPayment(v as typeof filterPayment)}>
                <SelectTrigger className="h-9 w-full min-w-[160px] sm:w-[180px]">
                  <SelectValue placeholder={t.filterPaymentShort} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.allStatuses}</SelectItem>
                  <SelectItem value="awaiting_payment">{t.statusAwaitingPayment}</SelectItem>
                  <SelectItem value="payment_checking">{t.statusPaymentChecking}</SelectItem>
                  <SelectItem value="pending_manual_review">{t.statusPendingManualReview}</SelectItem>
                  <SelectItem value="paid_verified">{t.statusPaidVerified}</SelectItem>
                  <SelectItem value="cancelled">{t.statusCancelled}</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={clearTableFilters}>
                {t.clearTableFilters}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="min-w-0 space-y-2">
          {rows.length >= 200 ? (
            <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">{t.listCapNote}</p>
          ) : null}
          {displayRows.length === 0 ? (
            <Card className="border-dashed border-border/80 bg-muted/20 shadow-none">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                {rows.length === 0 ? t.emptyList : t.emptyFiltered}
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
              <div className="max-h-[min(72vh,820px)] overflow-auto [scrollbar-gutter:stable]">
                <table className="w-full caption-bottom text-sm">
                  <TableHeader className="sticky top-0 z-10 border-b border-border bg-muted/95 backdrop-blur-sm dark:bg-muted/90">
                    <TableRow className="border-b-0 hover:bg-transparent">
                      <TableHead className="whitespace-nowrap bg-muted/95 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:bg-muted/90">
                        {t.tableColOrderCode}
                      </TableHead>
                      <TableHead
                        className="w-14 bg-muted/95 py-3 text-center text-[10px] font-semibold uppercase leading-tight text-muted-foreground dark:bg-muted/90 sm:w-16 sm:text-xs"
                        title={t.consultLocalHint}
                      >
                        {t.tableColConsulted}
                      </TableHead>
                      <TableHead className="min-w-[128px] bg-muted/95 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:bg-muted/90">
                        {t.tableColCustomer}
                      </TableHead>
                      <TableHead className="whitespace-nowrap bg-muted/95 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:bg-muted/90">
                        {t.tableColSubtotal}
                      </TableHead>
                      <TableHead className="hidden whitespace-nowrap bg-muted/95 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:table-cell dark:bg-muted/90">
                        {t.tableColDepositRequired}
                      </TableHead>
                      <TableHead className="hidden whitespace-nowrap bg-muted/95 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:table-cell dark:bg-muted/90">
                        {t.tableColPaidAmount}
                      </TableHead>
                      <TableHead className="hidden min-w-[118px] bg-muted/95 py-3 text-right text-xs font-semibold uppercase leading-snug tracking-wide text-muted-foreground sm:table-cell dark:bg-muted/90">
                        {t.tableColDueOnDelivery}
                      </TableHead>
                      <TableHead className="min-w-[140px] bg-muted/95 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:bg-muted/90">
                        {t.tableColStatus}
                      </TableHead>
                      <TableHead className="whitespace-nowrap bg-muted/95 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:bg-muted/90">
                        {t.tableColOrderDate}
                      </TableHead>
                      <TableHead className="min-w-[120px] bg-muted/95 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:bg-muted/90">
                        {t.tableColActions}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {displayRows.map((r) => {
                    const needDeposit = needsDepositStage(r)
                    const rowActive = detailModalOrderId === r.id
                    return (
                      <TableRow
                        key={r.id}
                        className={cn(
                          'group border-border/60 transition-colors',
                          rowActive ? 'bg-violet-500/[0.08] dark:bg-violet-500/10' : 'even:bg-muted/25 hover:bg-muted/40'
                        )}
                      >
                          <TableCell className="align-top font-mono text-xs font-semibold text-foreground">{orderCodeDisplay(r)}</TableCell>
                          <TableCell className="align-top text-center">
                            <input
                              type="checkbox"
                              checked={Boolean(consultedMap[r.id])}
                              onChange={(e) => toggleConsulted(r.id, e.target.checked)}
                              className="h-4 w-4 cursor-pointer rounded border-input accent-violet-600"
                              aria-label={t.consultedAria}
                            />
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="max-w-[200px] font-medium leading-snug [overflow-wrap:anywhere]">{r.customer_name || '—'}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">{r.customer_phone || '—'}</div>
                          </TableCell>
                          <TableCell className="align-top text-right text-sm font-semibold tabular-nums text-foreground">{money(r.subtotal_amount, locale)}</TableCell>
                          <TableCell className="hidden align-top text-right text-sm tabular-nums text-foreground sm:table-cell">
                            {money(r.required_amount, locale)}
                          </TableCell>
                          <TableCell className="hidden align-top text-right text-sm tabular-nums text-foreground sm:table-cell">
                            {money(r.paid_amount, locale)}
                          </TableCell>
                          <TableCell className="hidden align-top text-right text-sm font-medium tabular-nums text-foreground sm:table-cell">
                            {money(codRemainder(r), locale)}
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="flex max-w-[220px] flex-wrap gap-1">
                              <Badge variant="secondary" className="whitespace-normal border-transparent px-2 py-0.5 text-[11px] font-medium leading-snug">
                                {primaryStageBadgeLabel(t, r)}
                              </Badge>
                              <Badge
                                variant="outline"
                                className="whitespace-normal border-orange-200/80 bg-orange-50 px-2 py-0.5 text-[11px] font-medium leading-snug text-orange-900 dark:border-orange-900/50 dark:bg-orange-950/50 dark:text-orange-100"
                              >
                                {payBadgeLabel(t, r)}
                              </Badge>
                            </div>
                            <div className="mt-1.5 space-y-1 text-[11px] text-muted-foreground sm:hidden">
                              <div className="flex justify-between gap-3 tabular-nums">
                                <span className="shrink-0 text-[10px] uppercase tracking-wide">{t.tableColDepositRequired}</span>
                                <span className="text-right font-medium text-foreground">{money(r.required_amount, locale)}</span>
                              </div>
                              <div className="flex justify-between gap-3 tabular-nums">
                                <span className="shrink-0 text-[10px] uppercase tracking-wide">{t.tableColPaidAmount}</span>
                                <span className="text-right font-medium text-foreground">{money(r.paid_amount, locale)}</span>
                              </div>
                              <div className="flex justify-between gap-3 tabular-nums">
                                <span className="shrink-0 leading-tight text-[10px] uppercase tracking-wide">{t.tableColDueOnDelivery}</span>
                                <span className="text-right font-medium text-foreground">{money(codRemainder(r), locale)}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="align-top text-xs tabular-nums text-muted-foreground">
                            {new Date(r.created_at).toLocaleString(tag, { dateStyle: 'short', timeStyle: 'short' })}
                          </TableCell>
                          <TableCell className="align-top text-right">
                            <div className="flex flex-col items-end gap-2">
                              <button
                                type="button"
                                className="text-sm font-medium text-violet-600 hover:text-violet-700 hover:underline dark:text-violet-400 dark:hover:text-violet-300"
                                onClick={() => setDetailModalOrderId(r.id)}
                              >
                                {t.tableDetails}
                              </button>
                              {needDeposit && !isOrderCancelled(r) ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-8 min-w-[7rem] bg-orange-500 text-white shadow-sm hover:bg-orange-600"
                                  disabled={pending}
                                  onClick={() => confirmDepositManual(r.id)}
                                >
                                  {t.btnConfirmDeposit}
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                    )
                  })}
                </TableBody>
                </table>
              </div>
            </div>
          )}
      </div>

      <Dialog
        open={detailModalOrderId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailModalOrderId(null)
        }}
      >
        <DialogContent className="flex max-h-[92vh] max-w-[min(42rem,calc(100vw-1.25rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2.5 sm:px-4 sm:py-3">
            <DialogHeader className="space-y-0 pb-1 pr-9 text-left">
              <DialogTitle className="text-base font-semibold leading-snug">{t.modalTitle}</DialogTitle>
            </DialogHeader>
            {detailModalOrderId && !detailOrder ? (
              <p className="mt-2 text-sm text-muted-foreground">{t.modalOrderUnavailable}</p>
            ) : null}
            {detailOrder
              ? (() => {
                  const d = detailOrder
                  const dk = depositKind(d)
                  const sepay = isSepayStyleOrderPayment(d)
                  const needDep = needsDepositStage(d)
                  const addr = (d.shipping_address ?? '').trim()
                  return (
                    <div className="mt-2 space-y-2 text-sm sm:space-y-2.5">
                      <div className="space-y-1 border-b border-border/60 pb-2">
                        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0">
                              <span className="break-words text-base font-bold tabular-nums tracking-tight text-foreground sm:text-lg">
                                {orderCodeDisplay(d)}
                              </span>
                              <span className="text-[11px] tabular-nums text-muted-foreground">
                                {new Date(d.created_at).toLocaleString(tag, { dateStyle: 'short', timeStyle: 'short' })}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-1.5 text-[10px] leading-tight text-muted-foreground">
                              <span>
                                {t.labelWorkspace}:{' '}
                                <span className="font-medium text-foreground">{d.partner_display_name || d.partner_id}</span>
                              </span>
                            </div>
                            <p className="break-all font-mono text-[10px] leading-snug text-muted-foreground">
                              {t.modalInternalIdLine.replace('{id}', d.id)}
                            </p>
                          </div>
                          <div className="flex max-w-full flex-wrap gap-1 sm:max-w-[min(100%,22rem)] sm:justify-end">
                            <Badge variant="secondary" className="h-auto min-h-0 whitespace-normal px-1.5 py-0 text-[10px] font-medium leading-tight">
                              {primaryStageBadgeLabel(t, d)}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="h-auto min-h-0 whitespace-normal border-orange-200/80 bg-orange-50 px-1.5 py-0 text-[10px] font-medium leading-tight text-orange-900 dark:border-orange-900/50 dark:bg-orange-950/50 dark:text-orange-100"
                            >
                              {payBadgeLabel(t, d)}
                            </Badge>
                            <Badge variant="secondary" className="h-auto min-h-0 whitespace-normal px-1.5 py-0 text-[10px] font-medium leading-tight">
                              {statusLabel(t, d.status)}
                            </Badge>
                            <Badge variant="outline" className="h-auto min-h-0 whitespace-normal px-1.5 py-0 text-[10px] font-medium leading-tight">
                              {shippingLabel(t, d.shipping_status)}
                            </Badge>
                            {d.locked_at ? (
                              <Badge className="h-auto min-h-0 whitespace-normal bg-emerald-600 px-1.5 py-0 text-[10px] hover:bg-emerald-600">
                                {t.orderLocked}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border border-amber-200/55 bg-gradient-to-b from-amber-500/[0.08] to-muted/5 p-1.5 dark:border-amber-900/45 dark:from-amber-950/35 dark:to-transparent sm:p-2">
                        <div className="flex flex-col gap-2">
                          <div className="rounded-lg border border-violet-200/80 bg-violet-50/60 p-2 dark:border-violet-900/45 dark:bg-violet-950/25 sm:p-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-950 dark:text-violet-200">
                                {t.modalShippingAddressHeading}
                              </p>
                              {addr ? (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="h-7 shrink-0 px-2 text-[11px]"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(d.shipping_address)
                                      toast({ title: t.toastAddressCopied })
                                    } catch {
                                      toast({ title: t.toastAddressCopyFailed, variant: 'destructive' })
                                    }
                                  }}
                                >
                                  {t.modalCopyAddress}
                                </Button>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm font-medium leading-snug text-foreground [overflow-wrap:anywhere]">{addr || '—'}</p>
                          </div>

                          <div className="rounded-lg border border-border/75 bg-muted/15 p-2 dark:bg-muted/10 sm:p-2.5">
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t.modalProductsHeading}</p>
                            <div className="flex gap-2 sm:gap-2.5">
                              <div className="shrink-0">
                                {d.product_image_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={d.product_image_url}
                                    alt=""
                                    className="h-14 w-14 rounded-md border border-border/60 object-cover sm:h-16 sm:w-16"
                                  />
                                ) : (
                                  <div className="h-14 w-14 rounded-md border border-dashed border-border/70 bg-muted/30 sm:h-16 sm:w-16" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <p className="text-sm font-semibold leading-snug text-orange-800 dark:text-orange-200 [overflow-wrap:anywhere]">
                                  {(d.order_item_count ?? 1) > 1
                                    ? `${d.order_item_count} sản phẩm`
                                    : d.product_name}
                                </p>
                                {(d.order_item_count ?? 1) > 1 && d.order_items_summary ? (
                                  <p className="whitespace-pre-wrap text-[11px] leading-snug text-muted-foreground">
                                    {d.order_items_summary}
                                  </p>
                                ) : null}
                                {d.product_inventory_id ? (
                                  <p className="text-[11px] text-muted-foreground">
                                    {t.modalSkuPrefix} {d.product_inventory_id}
                                  </p>
                                ) : null}
                                <div className="flex flex-wrap gap-x-2 gap-y-0 text-[11px] text-muted-foreground">
                                  {d.variant_color?.trim() ? (
                                    <span>
                                      {t.modalColor}: <span className="text-foreground">{d.variant_color}</span>
                                    </span>
                                  ) : null}
                                  {d.variant_size?.trim() ? (
                                    <span>
                                      {t.modalSize}: <span className="text-foreground">{d.variant_size}</span>
                                    </span>
                                  ) : null}
                                  <span>
                                    {t.modalQty}: <span className="tabular-nums text-foreground">{d.quantity}</span>
                                  </span>
                                </div>
                                {d.product_url ? (
                                  <a
                                    href={d.product_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={d.product_url}
                                    className="mt-0.5 inline-flex max-w-full items-center gap-1 text-[11px] font-medium text-violet-600 hover:underline dark:text-violet-400"
                                  >
                                    <span className="min-w-0 truncate">{t.openProduct}</span>
                                    <ExternalLink className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
                                  </a>
                                ) : null}
                                {d.note?.trim() ? (
                                  <p className="border-t border-border/50 pt-1 text-[11px] leading-snug text-muted-foreground">
                                    <span className="font-medium text-foreground">{t.modalOrderNoteLabel}:</span> {d.note}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          <div className="rounded-md border border-amber-200/90 bg-amber-50/95 px-2.5 py-2 dark:border-amber-900/55 dark:bg-amber-950/35 sm:px-3 sm:py-2.5">
                            <div className="mb-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] leading-snug">
                              <Badge
                                variant="outline"
                                className={cn(
                                  'h-auto min-h-0 px-1.5 py-0 text-[10px] font-medium leading-tight',
                                  dk === 'full' &&
                                    'border-emerald-600/45 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-50',
                                  dk === 'partial' &&
                                    'border-amber-600/50 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-50',
                                  dk === 'none' && 'border-border bg-background/80 text-muted-foreground'
                                )}
                              >
                                {depositLabelText(t, dk)}
                              </Badge>
                              <span className="text-muted-foreground" aria-hidden>
                                ·
                              </span>
                              <span
                                className={cn('font-semibold', sepay ? 'text-violet-900 dark:text-violet-100' : 'text-amber-950 dark:text-amber-50')}
                              >
                                {sepay ? messagingOrderShopTemplate(t.pathSepay, d.partner_display_name) : t.pathManual}
                              </span>
                              <span className="text-muted-foreground" aria-hidden>
                                ·
                              </span>
                              {sepay ? (
                                <span className="line-clamp-2 max-w-[min(100%,28rem)] text-muted-foreground">
                                  {messagingOrderShopTemplate(t.sepayAutoHint, d.partner_display_name)}
                                </span>
                              ) : (
                                <span className="font-medium text-foreground">{proofReceiptShort(t, d.latest_proof_status)}</span>
                              )}
                            </div>
                            <p className="text-xs font-semibold text-amber-950 dark:text-amber-100">{t.modalPaymentHeading}</p>
                            <div className="mt-1.5 space-y-1">
                              <div className="flex items-baseline justify-between gap-2 text-sm">
                                <span className="text-muted-foreground">{t.modalOrderTotal}</span>
                                <span className="font-semibold tabular-nums text-foreground">{money(d.subtotal_amount, locale)}</span>
                              </div>
                              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0 text-sm">
                                <span>
                                  <span className="text-muted-foreground">{t.modalDepositNeed}:</span>{' '}
                                  <span className="font-medium tabular-nums text-foreground">{money(d.required_amount, locale)}</span>
                                </span>
                                <span>
                                  <span className="text-muted-foreground">{t.modalDepositDeposited}:</span>{' '}
                                  <span className="font-medium tabular-nums text-foreground">{money(d.paid_amount, locale)}</span>
                                </span>
                              </div>
                              <div className="border-t border-amber-200/70 pt-1.5 dark:border-amber-800/50">
                                <p className="text-[11px] leading-snug text-muted-foreground">{t.modalCodAfterDeposit}</p>
                                <p className="mt-0.5 text-lg font-bold tabular-nums text-red-600 dark:text-red-400">
                                  {money(codRemainder(d), locale)}
                                </p>
                              </div>
                              {needDep && !isOrderCancelled(d) ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  className="mt-1.5 h-8 bg-orange-500 px-3 text-xs text-white shadow-sm hover:bg-orange-600"
                                  disabled={pending}
                                  onClick={() => confirmDepositManual(d.id)}
                                >
                                  {t.btnConfirmDeposit}
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 border-t border-border/60 pt-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t.modalContactSectionTitle}</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/60 bg-muted/10 p-2 dark:bg-muted/5">
                            <input
                              type="checkbox"
                              checked={Boolean(consultedMap[d.id])}
                              onChange={(e) => toggleConsulted(d.id, e.target.checked)}
                              className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-violet-600"
                            />
                            <span className="leading-snug">{t.modalConsultedCustomer}</span>
                          </label>
                          <div className="space-y-1 rounded-lg border border-border/50 bg-background/80 px-2 py-2 dark:bg-background/40">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t.labelCustomer}</p>
                            <p className="text-sm font-semibold leading-snug [overflow-wrap:anywhere]">{d.customer_name || '—'}</p>
                            <p className="tabular-nums text-xs text-muted-foreground">{d.customer_phone || '—'}</p>
                            {d.customer_email ? (
                              <p className="break-all text-xs leading-snug text-muted-foreground">{d.customer_email}</p>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(reviewedMap[d.id])}
                          onChange={(e) => toggleReviewed(d.id, e.target.checked)}
                          className="h-4 w-4 rounded border-input accent-violet-600"
                        />
                        <span>{t.reviewedAria}</span>
                      </label>

                      <div className="flex flex-wrap items-center gap-2">
                        {d.product_url ? (
                          <Button type="button" variant="outline" size="sm" asChild>
                            <a href={d.product_url} target="_blank" rel="noopener noreferrer">
                              {t.openProduct}
                            </a>
                          </Button>
                        ) : null}
                        {d.latest_proof_image_url ? (
                          <Button type="button" variant="outline" size="sm" asChild>
                            <a href={d.latest_proof_image_url} target="_blank" rel="noopener noreferrer">
                              {t.openProofImage}
                            </a>
                          </Button>
                        ) : null}
                        <Button type="button" variant="outline" size="sm" asChild>
                          <Link
                            href={`/dashboard/messaging/inbox?partner=${encodeURIComponent(d.partner_id)}&conversation=${encodeURIComponent(d.conversation_id)}`}
                          >
                            {t.openInbox}
                          </Link>
                        </Button>
                      </div>

                      <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
                        <Input
                          value={noteByOrder[d.id] ?? d.verified_note ?? ''}
                          onChange={(e) => setNoteByOrder((prev) => ({ ...prev, [d.id]: e.target.value }))}
                          placeholder={t.notePlaceholder}
                          className="h-9"
                        />
                        <Button type="button" size="sm" onClick={() => confirmDepositManual(d.id)} disabled={pending}>
                          {t.btnConfirmPaid}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => setStatus(d.id, 'pending_manual_review')}
                          disabled={pending}
                        >
                          {t.btnMarkManualReview}
                        </Button>
                        <Button type="button" size="sm" variant="destructive" onClick={() => setStatus(d.id, 'cancelled')} disabled={pending}>
                          {t.btnCancelOrder}
                        </Button>
                      </div>

                      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                        <Select
                          value={d.shipping_status}
                          onValueChange={(v) =>
                            setShipping(
                              d.id,
                              v === 'pending' ||
                                v === 'confirmed' ||
                                v === 'packing' ||
                                v === 'shipping' ||
                                v === 'delivered' ||
                                v === 'returned' ||
                                v === 'cancelled'
                                ? (v as OrderRow['shipping_status'])
                                : 'pending'
                            )
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">{t.shippingPending}</SelectItem>
                            <SelectItem value="confirmed">{t.shippingConfirmed}</SelectItem>
                            <SelectItem value="packing">{t.shippingPacking}</SelectItem>
                            <SelectItem value="shipping">{t.shippingShipping}</SelectItem>
                            <SelectItem value="delivered">{t.shippingDelivered}</SelectItem>
                            <SelectItem value="returned">{t.shippingReturned}</SelectItem>
                            <SelectItem value="cancelled">{t.shippingCancelled}</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button type="button" size="sm" variant="outline" asChild>
                          <Link
                            href={`/dashboard/messaging/inbox?partner=${encodeURIComponent(d.partner_id)}&conversation=${encodeURIComponent(d.conversation_id)}`}
                          >
                            {t.openChat}
                          </Link>
                        </Button>
                      </div>

                      <div className="border-t border-border/60 pt-4">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.timelineTitle}</p>
                        {eventsByOrder[d.id] === undefined ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                            <span>{t.timelineLoading}</span>
                          </div>
                        ) : (eventsByOrder[d.id] ?? []).length === 0 ? (
                          <p className="leading-relaxed text-muted-foreground">{t.timelineNoEvents}</p>
                        ) : (
                          <div className="max-h-[min(280px,40vh)] space-y-2.5 overflow-y-auto pr-1 [scrollbar-gutter:stable]">
                            {(eventsByOrder[d.id] ?? []).map((e) => (
                              <div key={e.id} className="rounded-lg border border-border/70 bg-card/50 p-3 shadow-sm">
                                <p className="text-xs font-semibold leading-snug text-foreground">{e.title}</p>
                                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{e.detail}</p>
                                <p className="mt-2 text-[10px] tabular-nums text-muted-foreground">
                                  {new Date(e.created_at).toLocaleString(tag, { dateStyle: 'short', timeStyle: 'short' })} · {e.source}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()
              : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
