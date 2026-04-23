'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Banknote, ClipboardList, Download, Layers, PiggyBank, Receipt, RefreshCw, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import type { WebLocale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { isSepayStyleOrderPayment } from '@/lib/messaging/sepay-order-ui'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database.types'
import {
  exportMyMessagingOrdersExcel,
  listMyMessagingOrderEvents,
  listMyMessagingOrders,
  updateMyMessagingOrderShipping,
  updateMyMessagingOrderStatus,
  type PartnerOrderOwnerStats,
} from '@/app/dashboard/messaging/actions'

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
  product_image_url: string
  product_url: string
  quantity: number
  subtotal_amount: number
  required_amount: number
  paid_amount: number
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
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  /** YYYY-MM-DD — lọc theo ngày tạo đơn (VN), để trống = không giới hạn */
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [query, setQuery] = useState('')
  const [noteByOrder, setNoteByOrder] = useState<Record<string, string>>({})
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [eventsByOrder, setEventsByOrder] = useState<Record<string, OrderEventRow[]>>({})
  const [stats, setStats] = useState<PartnerOrderOwnerStats | null>(null)

  const tag = intlLocaleTag(locale)
  const t = ordersT

  const loadOrders = () => {
    startTransition(async () => {
      const res = await listMyMessagingOrders({
        partnerId: selectedPartnerId === 'all' ? '' : selectedPartnerId,
        status: selectedStatus === 'all' ? '' : selectedStatus,
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
        status: selectedStatus === 'all' ? '' : selectedStatus,
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
  }, [selectedPartnerId, selectedStatus, dateFrom, dateTo])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      return (
        r.payment_reference.toLowerCase().includes(q) ||
        r.product_name.toLowerCase().includes(q) ||
        (r.customer_name || '').toLowerCase().includes(q) ||
        (r.customer_phone || '').toLowerCase().includes(q)
      )
    })
  }, [rows, query])

  const setStatus = (orderId: string, status: OrderStatus) => {
    startTransition(async () => {
      const note = (noteByOrder[orderId] ?? '').trim()
      const res = await updateMyMessagingOrderStatus({ orderId, status, verifiedNote: note })
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      toast({ title: t.toastStatusUpdated })
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
      if (selectedOrderId === orderId) {
        const evt = await listMyMessagingOrderEvents({ orderId, limit: 60 })
        if ('rows' in evt) {
          setEventsByOrder((prev) => ({ ...prev, [orderId]: (evt.rows ?? []) as unknown as OrderEventRow[] }))
        }
      }
    })
  }

  useEffect(() => {
    const oid = selectedOrderId
    if (!oid || eventsByOrder[oid]) return
    startTransition(async () => {
      const res = await listMyMessagingOrderEvents({ orderId: oid, limit: 60 })
      if ('rows' in res) {
        setEventsByOrder((prev) => ({ ...prev, [oid]: (res.rows ?? []) as unknown as OrderEventRow[] }))
      }
    })
  }, [eventsByOrder, selectedOrderId])

  return (
    <div className="space-y-4">
      <Card className="border-border/70 shadow-sm">
        <CardContent className="flex flex-wrap items-end gap-2 pt-6">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-transparent select-none" aria-hidden>
              {'\u00a0'}
            </span>
            <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
              <SelectTrigger className="h-9 w-[260px]">
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
          <div className="flex flex-col gap-1">
            <span className="text-xs text-transparent select-none" aria-hidden>
              {'\u00a0'}
            </span>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="h-9 w-[220px]">
                <SelectValue placeholder={t.allStatuses} />
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
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="messaging-orders-date-from" className="text-xs font-normal text-muted-foreground">
              {t.filterCreatedFrom}
            </Label>
            <Input
              id="messaging-orders-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 w-[158px]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="messaging-orders-date-to" className="text-xs font-normal text-muted-foreground">
              {t.filterCreatedTo}
            </Label>
            <Input
              id="messaging-orders-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 w-[158px]"
            />
          </div>
          <div className="flex min-w-[260px] flex-1 flex-col gap-1">
            <span className="text-xs text-transparent select-none" aria-hidden>
              {'\u00a0'}
            </span>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="h-9 w-full"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-transparent select-none" aria-hidden>
              {'\u00a0'}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-9"
              onClick={() => exportExcel()}
              disabled={pending}
              title={t.exportExcelTitle}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {t.exportExcel}
            </Button>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-transparent select-none" aria-hidden>
              {'\u00a0'}
            </span>
            <Button type="button" variant="outline" size="sm" className="h-9" onClick={loadOrders} disabled={pending}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              {t.reload}
            </Button>
          </div>
        </CardContent>
      </Card>

      {stats ? (
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-5 w-5 text-violet-600" aria-hidden />
              {t.summaryTitle}
            </CardTitle>
            <CardDescription>{t.summaryDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <ClipboardList className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {t.statOrders}
                </div>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{stats.orderCount.toLocaleString(tag)}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Receipt className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {t.statSubtotal}
                </div>
                <p className="mt-1 text-lg font-semibold tabular-nums leading-snug">{money(stats.sumSubtotalVnd, locale)}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{t.statSubtotalHint}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <PiggyBank className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {t.statRequired}
                </div>
                <p className="mt-1 text-lg font-semibold tabular-nums leading-snug">{money(stats.sumRequiredVnd, locale)}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{t.statRequiredHint}</p>
              </div>
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                  <Wallet className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {t.statPaid}
                </div>
                <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-900 dark:text-emerald-100">{money(stats.sumPaidVnd, locale)}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{t.statPaidHint}</p>
              </div>
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-amber-900 dark:text-amber-100">
                  <Banknote className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {t.statOutstanding}
                </div>
                <p className="mt-1 text-lg font-semibold tabular-nums">{money(stats.sumOutstandingVnd, locale)}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{t.statOutstandingHint}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-lg border border-dashed border-border/80 bg-muted/15 px-3 py-2 text-[11px] text-muted-foreground">
              <span>
                {t.statusAwaitingPayment}: <strong className="text-foreground">{stats.countAwaitingPayment}</strong>
              </span>
              <span>
                {t.statusPaymentChecking}: <strong className="text-foreground">{stats.countPaymentChecking}</strong>
              </span>
              <span>
                {t.statusPaidVerified}: <strong className="text-foreground">{stats.countPaidVerified}</strong>
              </span>
              <span>
                {t.statusPendingManualReview}: <strong className="text-foreground">{stats.countPendingManual}</strong>
              </span>
              <span>
                {t.statusCancelled}: <strong className="text-foreground">{stats.countCancelled}</strong>
              </span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card className="border-border/70 shadow-sm">
            <CardContent className="py-8 text-sm text-muted-foreground">{t.emptyList}</CardContent>
          </Card>
        ) : null}
        {filtered.map((r) => {
          const dk = depositKind(r)
          const sepay = isSepayStyleOrderPayment(r)
          return (
          <Card key={r.id} className="border-border/70 shadow-sm">
            <CardHeader className="space-y-2 pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <CardTitle className="text-base font-semibold leading-snug">
                  {r.payment_reference || r.id.slice(0, 8)}
                </CardTitle>
                <span className="shrink-0 text-xs font-normal text-muted-foreground tabular-nums">
                  {new Date(r.created_at).toLocaleString(tag)}
                </span>
              </div>
              <div
                className={cn(
                  'rounded-lg border px-3 py-2.5 text-sm',
                  sepay
                    ? 'border-violet-300/80 bg-violet-50/80 dark:border-violet-800/80 dark:bg-violet-950/35'
                    : 'border-amber-300/70 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/25'
                )}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <Badge
                    variant="outline"
                    className={cn(
                      'font-medium',
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
                    className={cn(
                      'font-semibold',
                      sepay ? 'text-violet-900 dark:text-violet-100' : 'text-amber-950 dark:text-amber-50'
                    )}
                  >
                    {sepay ? messagingOrderShopTemplate(t.pathSepay, r.partner_display_name) : t.pathManual}
                  </span>
                  <span className="text-muted-foreground" aria-hidden>
                    ·
                  </span>
                  {sepay ? (
                    <span className="text-xs leading-snug text-muted-foreground">
                      {messagingOrderShopTemplate(t.sepayAutoHint, r.partner_display_name)}
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-foreground">{proofReceiptShort(t, r.latest_proof_status)}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{statusLabel(t, r.status)}</Badge>
                <Badge variant="outline">{shippingLabel(t, r.shipping_status)}</Badge>
                {r.locked_at ? <Badge className="bg-emerald-600 hover:bg-emerald-600">{t.orderLocked}</Badge> : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 text-sm md:grid-cols-2">
                <p>
                  <strong>{t.labelWorkspace}:</strong> {r.partner_display_name || r.partner_id}
                </p>
                <p>
                  <strong>{t.labelCustomer}:</strong> {r.customer_name || '—'} | {r.customer_phone || '—'}
                </p>
                <p>
                  <strong>{t.labelEmail}:</strong> {r.customer_email || '—'}
                </p>
                <p>
                  <strong>{t.labelAddress}:</strong> {r.shipping_address || '—'}
                </p>
                <p>
                  <strong>{t.labelProduct}:</strong> {r.product_name}
                </p>
                <p>
                  <strong>{t.labelMoneyPrefix}:</strong>{' '}
                  {t.moneyLine
                    .replace('{subtotal}', money(r.subtotal_amount, locale))
                    .replace('{required}', money(r.required_amount, locale))
                    .replace('{paid}', money(r.paid_amount, locale))}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {r.product_url ? (
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href={r.product_url} target="_blank" rel="noopener noreferrer">
                      {t.openProduct}
                    </a>
                  </Button>
                ) : null}
                {r.latest_proof_image_url ? (
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href={r.latest_proof_image_url} target="_blank" rel="noopener noreferrer">
                      {t.openProofImage}
                    </a>
                  </Button>
                ) : null}
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link
                    href={`/dashboard/messaging/inbox?partner=${encodeURIComponent(r.partner_id)}&conversation=${encodeURIComponent(r.conversation_id)}`}
                  >
                    {t.openInbox}
                  </Link>
                </Button>
              </div>
              <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
                <Input
                  value={noteByOrder[r.id] ?? r.verified_note ?? ''}
                  onChange={(e) => setNoteByOrder((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  placeholder={t.notePlaceholder}
                  className="h-9"
                />
                <Button type="button" size="sm" onClick={() => setStatus(r.id, 'paid_verified')} disabled={pending}>
                  {t.btnConfirmPaid}
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => setStatus(r.id, 'pending_manual_review')} disabled={pending}>
                  {t.btnMarkManualReview}
                </Button>
                <Button type="button" size="sm" variant="destructive" onClick={() => setStatus(r.id, 'cancelled')} disabled={pending}>
                  {t.btnCancelOrder}
                </Button>
              </div>
              <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
                <Select
                  value={r.shipping_status}
                  onValueChange={(v) =>
                    setShipping(
                      r.id,
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
                <Button type="button" size="sm" variant="outline" onClick={() => setSelectedOrderId(r.id)}>
                  {t.btnViewTimeline}
                </Button>
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link
                    href={`/dashboard/messaging/inbox?partner=${encodeURIComponent(r.partner_id)}&conversation=${encodeURIComponent(r.conversation_id)}`}
                  >
                    {t.openChat}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
          )
        })}
        </div>

        <Card className="h-fit border-border/70 shadow-sm lg:sticky lg:top-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.timelineTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!selectedOrderId ? (
              <p className="text-sm text-muted-foreground">{t.timelinePickOrder}</p>
            ) : (eventsByOrder[selectedOrderId] ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.timelineNoEvents}</p>
            ) : (
              <div className="space-y-2">
                {(eventsByOrder[selectedOrderId] ?? []).map((e) => (
                  <div key={e.id} className="rounded-md border border-border/60 p-2">
                    <p className="text-xs font-semibold">{e.title}</p>
                    <p className="text-[11px] text-muted-foreground">{e.detail}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {new Date(e.created_at).toLocaleString(tag)} • {e.source}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
