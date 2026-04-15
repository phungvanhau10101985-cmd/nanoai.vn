'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { PartnerOrderRow } from '@/lib/db/messaging-partner-orders-pg'
import { guestFacingOrderRef } from '@/lib/messaging/widget-order-ref-display'
import {
  GuestWidgetOrderDepositPanel,
  guestOrderNeedsDepositUi,
} from '@/components/messaging/guest-widget-order-deposit-panel'
import { Loader2, Package } from 'lucide-react'

type T = Dictionary['messagingMyOrders']

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

export function GuestWidgetMyOrdersDialog({
  open,
  onOpenChange,
  slug,
  t,
  detailActionLabel,
  onSelectOrderId,
  authHeaders,
  captureGuestSessionFromResponse,
  loadErrorLabel,
  depositBusyOrderId,
  onDepositPickProof,
  dataRefreshNonce = 0,
  shopDisplayName = 'Shop',
  embedUi = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  slug: string
  t: T
  /** Nút mở chi tiết một dòng (vd. «Xem chi tiết»). */
  detailActionLabel: string
  onSelectOrderId: (orderId: string) => void
  authHeaders: () => Record<string, string>
  captureGuestSessionFromResponse: (res: Response) => void
  loadErrorLabel: string
  depositBusyOrderId: string | null
  onDepositPickProof: (orderId: string) => void
  /** Tăng sau khi gửi biên lai để tải lại danh sách. */
  dataRefreshNonce?: number
  shopDisplayName?: string
  /**
   * true: chat nhúng / iframe — sheet mobile full-width, không trùng tiêu đề với thanh widget,
   * không tràn ngang; desktop: modal rộng hơn, cuộn trong khung.
   */
  embedUi?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orders, setOrders] = useState<PartnerOrderRow[]>([])
  const [expandedDepositOrderId, setExpandedDepositOrderId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setOrders([])
      setError(null)
      setExpandedDepositOrderId(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setOrders([])
    void (async () => {
      try {
        const res = await fetch(`/api/messaging/guest/${encodeURIComponent(slug)}/orders`, {
          credentials: 'same-origin',
          headers: { ...authHeaders() },
        })
        captureGuestSessionFromResponse(res)
        const json = (await res.json().catch(() => null)) as { orders?: PartnerOrderRow[]; error?: string } | null
        if (cancelled) return
        if (!res.ok) {
          setError(json?.error || loadErrorLabel)
          return
        }
        setOrders(Array.isArray(json?.orders) ? json!.orders! : [])
      } catch {
        if (!cancelled) setError(loadErrorLabel)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, slug, authHeaders, captureGuestSessionFromResponse, loadErrorLabel, dataRefreshNonce])

  const listBody =
    loading ? (
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
    ) : orders.length === 0 ? (
      <p className="py-6 text-center text-sm text-muted-foreground">{t.emptyList}</p>
    ) : (
      <ul className="flex flex-col gap-3">
        {orders.map((row) => {
          const created = row.created_at ? new Date(row.created_at).toLocaleString() : ''
          const name = row.product_name.trim() || '—'
          const needDeposit = guestOrderNeedsDepositUi(row)
          const depositOpen = expandedDepositOrderId === row.id
          return (
            <li
              key={row.id}
              className="flex max-w-full min-w-0 flex-col gap-2 overflow-hidden rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5 sm:px-3.5"
            >
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between sm:gap-4">
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="break-words text-pretty text-sm font-medium leading-snug text-foreground">{name}</p>
                  <p className="mt-1.5 break-all text-[10px] leading-snug text-muted-foreground sm:text-[11px]">
                    <span className="text-muted-foreground">{t.orderIdLabel}: </span>
                    <span className="font-mono text-foreground/90" title={row.id}>
                      {guestFacingOrderRef(row)}
                    </span>
                  </p>
                  {created ? (
                    <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-[11px]">{created}</p>
                  ) : null}
                  <div className="mt-2 space-y-1 text-[11px] leading-snug sm:mt-2 sm:flex sm:flex-wrap sm:gap-x-3 sm:gap-y-1 sm:space-y-0">
                    <p className="min-w-0 sm:inline">
                      <span className="text-muted-foreground">{t.payStatus}: </span>
                      <span className="font-medium text-foreground">{payLabel(t, row.status)}</span>
                    </p>
                    <p className="min-w-0 sm:inline">
                      <span className="text-muted-foreground">{t.shipStatus}: </span>
                      <span className="font-medium text-foreground">{shipLabel(t, row.shipping_status)}</span>
                    </p>
                  </div>
                </div>
                <div className="flex w-full shrink-0 flex-col gap-1.5 sm:w-[9.5rem] sm:min-w-[9rem]">
                  {needDeposit ? (
                    <Button
                      type="button"
                      size="sm"
                      variant={depositOpen ? 'secondary' : 'default'}
                      className="h-9 w-full whitespace-normal px-2 text-center text-xs leading-tight sm:h-9"
                      onClick={() =>
                        setExpandedDepositOrderId((cur) => (cur === row.id ? null : row.id))
                      }
                    >
                      {depositOpen ? 'Thu gọn đặt cọc' : 'Đặt cọc'}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 w-full whitespace-normal px-2 text-center text-xs leading-tight"
                    onClick={() => {
                      onSelectOrderId(row.id)
                      onOpenChange(false)
                    }}
                  >
                    {detailActionLabel}
                  </Button>
                </div>
              </div>
              {needDeposit && depositOpen ? (
                <GuestWidgetOrderDepositPanel
                  order={row}
                  busyOrderId={depositBusyOrderId}
                  onPickProof={onDepositPickProof}
                  shopDisplayName={shopDisplayName}
                />
              ) : null}
            </li>
          )
        })}
      </ul>
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className={cn(
          embedUi
            ? 'fixed bottom-0 left-0 right-0 top-auto z-50 flex h-[min(92dvh,880px)] max-h-[92dvh] w-full max-w-[100vw] translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-2xl border-x-0 border-b-0 p-0 shadow-[0_-4px_24px_rgba(0,0,0,.12)] sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:h-auto sm:max-h-[min(85vh,720px)] sm:w-full sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border sm:shadow-lg'
            : 'max-h-[min(90vh,640px)] max-w-lg gap-4 overflow-y-auto p-6'
        )}
      >
        {embedUi ? (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>{t.pageTitle}</DialogTitle>
            </DialogHeader>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-3 pb-6 pt-12 [scrollbar-gutter:stable] sm:px-6 sm:pt-14">
                {listBody}
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-left">
                <Package className="h-5 w-5 shrink-0 text-violet-600" aria-hidden />
                <span className="leading-snug">{t.pageTitle}</span>
              </DialogTitle>
            </DialogHeader>
            {listBody}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
