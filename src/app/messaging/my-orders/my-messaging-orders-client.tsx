'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { WidgetOrderListRow } from '@/lib/db/messaging-partner-orders-pg'
import { guestFacingOrderRef } from '@/lib/messaging/widget-order-ref-display'
import { ArrowLeft, History, Package } from 'lucide-react'

type T = Dictionary['messagingMyOrders']

function formatVnd(n: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(Math.max(0, Math.round(n)))}đ`
}

function payLabel(t: T, status: WidgetOrderListRow['status']): string {
  switch (status) {
    case 'awaiting_payment':
      return t.stAwaiting
    case 'payment_checking':
      return t.stChecking
    case 'paid_verified':
      return t.stPaid
    case 'pending_manual_review':
      return t.stManual
    case 'cancelled':
      return t.stCancelled
    default:
      return status
  }
}

function shipLabel(t: T, s: WidgetOrderListRow['shipping_status']): string {
  switch (s) {
    case 'pending':
      return t.shPending
    case 'confirmed':
      return t.shConfirmed
    case 'packing':
      return t.shPacking
    case 'shipping':
      return t.shShipping
    case 'delivered':
      return t.shDelivered
    case 'returned':
      return t.shReturned
    case 'cancelled':
      return t.shCancelled
    default:
      return s
  }
}

function meaningfulText(raw: string): boolean {
  const v = raw.trim()
  if (!v) return false
  if (/^[\s—\-–_]+$/u.test(v)) return false
  if (/^no\s*size$/i.test(v)) return false
  return true
}

export function MyMessagingOrdersClient({
  t,
  initialOrders,
  initialError,
  highlightOrderId,
}: {
  t: T
  initialOrders: WidgetOrderListRow[]
  initialError?: string
  highlightOrderId: string
}) {
  return (
    <div className="flex w-full max-w-2xl flex-col gap-6 pb-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/" aria-label={t.backHomeAria}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.pageTitle}</h1>
          <p className="text-sm text-muted-foreground">{t.pageDescription}</p>
        </div>
      </div>

      {initialError ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {initialError}
        </p>
      ) : null}

      {initialOrders.length === 0 && !initialError ? (
        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-violet-600" aria-hidden />
              {t.pageTitle}
            </CardTitle>
            <CardDescription>{t.emptyList}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="flex flex-col gap-4">
          {initialOrders.map((row) => (
            <OrderRow
              key={row.id}
              row={row}
              t={t}
              highlight={Boolean(highlightOrderId && highlightOrderId === row.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

type OrderEventApiRow = {
  id: string
  title: string
  detail: string
  source: string
  created_at: string
}

function OrderRow({
  row,
  t,
  highlight,
}: {
  row: WidgetOrderListRow
  t: T
  highlight: boolean
}) {
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [timelineEvents, setTimelineEvents] = useState<OrderEventApiRow[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineError, setTimelineError] = useState<string | null>(null)

  useEffect(() => {
    if (!timelineOpen) return
    let cancelled = false
    setTimelineLoading(true)
    setTimelineError(null)
    void (async () => {
      try {
        const res = await fetch(`/api/messaging/my-orders/${encodeURIComponent(row.id)}/events`)
        const data = (await res.json()) as { rows?: OrderEventApiRow[]; error?: string }
        if (cancelled) return
        if (!res.ok) {
          setTimelineError(data?.error || t.timelineLoadFailed)
          setTimelineEvents([])
          return
        }
        setTimelineEvents(Array.isArray(data.rows) ? data.rows : [])
      } catch {
        if (!cancelled) {
          setTimelineError(t.timelineLoadFailed)
          setTimelineEvents([])
        }
      } finally {
        if (!cancelled) setTimelineLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [timelineOpen, row.id, t.timelineLoadFailed])

  const ref = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (!highlight) return
    const el = ref.current
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlight])

  const shop = row.partner_display_name.trim() || '—'
  const slug = row.partner_slug.trim()
  const created = row.created_at ? new Date(row.created_at).toLocaleString() : ''
  const img = row.product_image_url.trim()
  const showImg = /^https?:\/\//i.test(img)
  const refMemo = row.payment_reference.trim()
  const displayOrderRef = guestFacingOrderRef(row)
  const showSeparateTransferMemo = Boolean(
    refMemo && displayOrderRef && refMemo.toUpperCase() !== displayOrderRef.toUpperCase()
  )
  const depositPct = Math.max(0, Math.min(100, Math.round(row.deposit_percent)))
  const qty = Math.max(1, row.quantity)
  const paid = Math.max(0, Math.round(row.paid_amount))
  const due = Math.max(0, Math.round(row.required_amount))
  const subtotal = Math.max(0, Math.round(row.subtotal_amount))
  const balanceOnDelivery =
    row.status === 'cancelled' ? 0 : Math.max(0, subtotal - paid)
  const unit = Math.max(0, Math.round(row.unit_price))
  const addr = row.shipping_address.trim()
  const note = row.note.trim()

  return (
    <li ref={ref}>
      <Card
        className={`overflow-hidden border-border/70 shadow-sm transition-shadow hover:shadow-md ${
          highlight ? 'ring-2 ring-violet-500/80 ring-offset-2 ring-offset-background' : ''
        }`}
      >
        <CardHeader className="space-y-2 pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="shrink-0">
              {showImg ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL ngoài từ kho shop
                <img
                  src={img}
                  alt={t.productPhotoAlt}
                  className="h-28 w-full max-w-[7.5rem] rounded-lg border border-border/60 bg-muted/30 object-contain sm:h-32 sm:w-32"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-28 w-full max-w-[7.5rem] items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/25 text-[11px] text-muted-foreground sm:h-32 sm:w-32">
                  —
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <CardTitle className="text-base font-semibold leading-snug sm:text-lg">{row.product_name.trim() || '—'}</CardTitle>
              <CardDescription className="text-sm font-medium text-foreground/90">{shop}</CardDescription>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border border-amber-200/90 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                  {t.payStatus}: {payLabel(t, row.status)}
                </span>
                <span className="inline-flex items-center rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-foreground">
                  {t.shipStatus}: {shipLabel(t, row.shipping_status)}
                </span>
              </div>
              {created ? (
                <p className="text-[11px] text-muted-foreground">
                  {t.createdAt}: {created}
                </p>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 border-t border-border/50 pt-3 text-sm">
          <dl className="grid gap-2 text-[13px] sm:grid-cols-1">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
              <dt className="shrink-0 text-muted-foreground">{t.orderIdLabel}</dt>
              <dd className="min-w-0 break-all font-mono text-xs text-foreground sm:text-[13px]" title={row.id}>
                {displayOrderRef}
              </dd>
            </div>
            {showSeparateTransferMemo ? (
              <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                <dt className="shrink-0 text-muted-foreground">{t.transferMemoLabel}</dt>
                <dd className="min-w-0 break-all font-mono text-xs font-semibold text-foreground sm:text-[13px]">
                  {refMemo}
                </dd>
              </div>
            ) : null}
            <div className="grid gap-2 border-t border-border/40 pt-2 sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">{t.qtyLabel}: </span>
                <span className="font-medium tabular-nums">{qty}</span>
              </div>
              {meaningfulText(row.variant_color) ? (
                <div>
                  <span className="text-muted-foreground">{t.colorLabel}: </span>
                  <span className="font-medium">{row.variant_color.trim()}</span>
                </div>
              ) : null}
              {meaningfulText(row.variant_size) ? (
                <div>
                  <span className="text-muted-foreground">{t.sizeLabel}: </span>
                  <span className="font-medium">{row.variant_size.trim()}</span>
                </div>
              ) : null}
            </div>
            <div className="space-y-1 border-t border-border/40 pt-2">
              <p>
                <span className="text-muted-foreground">{t.unitPriceLabel}: </span>
                <span className="font-medium tabular-nums">{formatVnd(unit)}</span>
              </p>
              <p>
                <span className="text-muted-foreground">{t.totalLabel}: </span>
                <span className="font-semibold tabular-nums">{formatVnd(subtotal)}</span>
              </p>
              <p className="text-[12px] text-muted-foreground">
                {t.depositPctLabel}: {depositPct}%
              </p>
              {due > 0 ? (
                <p>
                  <span className="text-muted-foreground">{t.amountDueLabel}: </span>
                  <span className="font-semibold tabular-nums text-amber-900 dark:text-amber-200">{formatVnd(due)}</span>
                </p>
              ) : null}
              {paid > 0 ? (
                <p>
                  <span className="text-muted-foreground">{t.paidRecordedLabel}: </span>
                  <span className="font-medium tabular-nums text-emerald-800 dark:text-emerald-300">{formatVnd(paid)}</span>
                </p>
              ) : null}
              {row.status !== 'cancelled' ? (
                <p>
                  <span className="text-muted-foreground">{t.balanceOnDeliveryLabel}: </span>
                  <span
                    className={
                      balanceOnDelivery > 0
                        ? 'font-semibold tabular-nums text-amber-900 dark:text-amber-200'
                        : 'font-medium tabular-nums text-muted-foreground'
                    }
                  >
                    {formatVnd(balanceOnDelivery)}
                  </span>
                </p>
              ) : null}
            </div>
            {meaningfulText(addr) ? (
              <div className="border-t border-border/40 pt-2">
                <p className="text-[12px] font-medium text-muted-foreground">{t.shipToLabel}</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-snug">{addr}</p>
              </div>
            ) : null}
            {meaningfulText(note) ? (
              <div className="border-t border-border/40 pt-2">
                <p className="text-[12px] font-medium text-muted-foreground">{t.noteLabel}</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-snug">{note}</p>
              </div>
            ) : null}
          </dl>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setTimelineOpen(true)}
            >
              <History className="mr-2 h-4 w-4 shrink-0" aria-hidden />
              {t.viewTimelineButton}
            </Button>
            {slug ? (
              <Button asChild className="w-full sm:w-auto" variant="default">
                <Link href={`/messaging/p/${encodeURIComponent(slug)}`}>{t.openChat}</Link>
              </Button>
            ) : null}
          </div>
          <Dialog open={timelineOpen} onOpenChange={setTimelineOpen}>
            <DialogContent className="max-h-[min(85vh,560px)] max-w-lg overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t.timelineTitle}</DialogTitle>
              </DialogHeader>
              {timelineLoading ? (
                <p className="text-sm text-muted-foreground">…</p>
              ) : timelineError ? (
                <p className="text-sm text-destructive">{timelineError}</p>
              ) : timelineEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.timelineEmpty}</p>
              ) : (
                <ul className="space-y-3">
                  {timelineEvents.map((e) => (
                    <li key={e.id} className="rounded-md border border-border/60 p-2.5">
                      <p className="text-sm font-semibold leading-snug">{e.title}</p>
                      {e.detail ? (
                        <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{e.detail}</p>
                      ) : null}
                      <p className="mt-1.5 text-[10px] text-muted-foreground">
                        {e.created_at ? new Date(e.created_at).toLocaleString() : ''}
                        {e.source ? ` · ${e.source}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </li>
  )
}
