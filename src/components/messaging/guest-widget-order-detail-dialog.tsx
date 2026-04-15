'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { PartnerOrderRow } from '@/lib/db/messaging-partner-orders-pg'
import { guestFacingOrderRef } from '@/lib/messaging/widget-order-ref-display'
import { GuestWidgetOrderDepositPanel, guestOrderNeedsDepositUi } from '@/components/messaging/guest-widget-order-deposit-panel'
import { Loader2 } from 'lucide-react'

type T = Dictionary['messagingMyOrders']

function formatVnd(n: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(Math.max(0, Math.round(n)))}đ`
}

function payLabel(t: T, status: PartnerOrderRow['status']): string {
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

function shipLabel(t: T, s: PartnerOrderRow['shipping_status']): string {
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

type ApiOk = {
  order: PartnerOrderRow
  partner_display_name: string
  partner_slug: string
}

export function GuestWidgetOrderDetailDialog({
  open,
  onOpenChange,
  slug,
  orderId,
  t,
  authHeaders,
  captureGuestSessionFromResponse,
  loadErrorLabel,
  depositBusyOrderId,
  onDepositPickProof,
  dataRefreshNonce = 0,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  slug: string
  orderId: string | null
  t: T
  authHeaders: () => Record<string, string>
  captureGuestSessionFromResponse: (res: Response) => void
  /** Dùng cùng chuỗi «Không tải được…» như trang đơn hàng. */
  loadErrorLabel: string
  /** Luồng đặt cọc + gửi biên lai (cùng handler với chat). */
  depositBusyOrderId: string | null
  onDepositPickProof: (orderId: string) => void
  /** Tăng sau khi gửi biên lai thành công để tải lại chi tiết đơn. */
  dataRefreshNonce?: number
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ApiOk | null>(null)
  const prevOpenOrderIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!open || !orderId) {
      prevOpenOrderIdRef.current = null
      setData(null)
      setError(null)
      return
    }
    const orderChanged = prevOpenOrderIdRef.current !== orderId
    prevOpenOrderIdRef.current = orderId
    let cancelled = false
    setLoading(true)
    setError(null)
    if (orderChanged) setData(null)
    void (async () => {
      try {
        const res = await fetch(
          `/api/messaging/guest/${encodeURIComponent(slug)}/order/${encodeURIComponent(orderId)}`,
          { credentials: 'same-origin', headers: { ...authHeaders() } }
        )
        captureGuestSessionFromResponse(res)
        const json = (await res.json().catch(() => null)) as { error?: string } & Partial<ApiOk> | null
        if (cancelled) return
        if (!res.ok) {
          setError(json?.error || loadErrorLabel)
          return
        }
        if (json?.order && typeof json.partner_display_name === 'string') {
          setData({
            order: json.order,
            partner_display_name: json.partner_display_name,
            partner_slug: typeof json.partner_slug === 'string' ? json.partner_slug : slug,
          })
        } else {
          setError(loadErrorLabel)
        }
      } catch {
        if (!cancelled) setError(loadErrorLabel)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, orderId, slug, authHeaders, captureGuestSessionFromResponse, loadErrorLabel, dataRefreshNonce])

  const row = data?.order
  const shop = (data?.partner_display_name ?? '').trim() || '—'

  const img = row?.product_image_url.trim() ?? ''
  const showImg = row && /^https?:\/\//i.test(img)
  const refMemo = row?.payment_reference.trim() ?? ''
  const displayOrderRef = row ? guestFacingOrderRef(row) : ''
  const showSeparateTransferMemo = Boolean(
    row && refMemo && displayOrderRef && refMemo.toUpperCase() !== displayOrderRef.toUpperCase()
  )
  const depositPct = row ? Math.max(0, Math.min(100, Math.round(row.deposit_percent))) : 0
  const qty = row ? Math.max(1, row.quantity) : 1
  const paid = row ? Math.max(0, Math.round(row.paid_amount)) : 0
  const due = row ? Math.max(0, Math.round(row.required_amount)) : 0
  const subtotal = row ? Math.max(0, Math.round(row.subtotal_amount)) : 0
  const unit = row ? Math.max(0, Math.round(row.unit_price)) : 0
  const addr = row?.shipping_address.trim() ?? ''
  const note = row?.note.trim() ?? ''
  const created = row?.created_at ? new Date(row.created_at).toLocaleString() : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.pageTitle}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div
            className="flex items-center justify-center py-12 text-muted-foreground"
            role="status"
            aria-busy="true"
            aria-live="polite"
          >
            <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
          </div>
        ) : error ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : row ? (
          <Card className="border-border/70 shadow-sm">
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
                  <CardTitle className="text-base font-semibold leading-snug sm:text-lg">
                    {row.product_name.trim() || '—'}
                  </CardTitle>
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
              {guestOrderNeedsDepositUi(row) ? (
                <GuestWidgetOrderDepositPanel
                  order={row}
                  busyOrderId={depositBusyOrderId}
                  onPickProof={onDepositPickProof}
                  className="mb-1"
                  shopDisplayName={shop !== '—' ? shop : 'Shop'}
                />
              ) : null}
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
            </CardContent>
          </Card>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
