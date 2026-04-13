'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,640px)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-violet-600" aria-hidden />
            {t.pageTitle}
          </DialogTitle>
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
        ) : orders.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t.emptyList}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {orders.map((row) => {
              const created = row.created_at ? new Date(row.created_at).toLocaleString() : ''
              const name = row.product_name.trim() || '—'
              const needDeposit = guestOrderNeedsDepositUi(row)
              const depositOpen = expandedDepositOrderId === row.id
              return (
                <li
                  key={row.id}
                  className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-snug">{name}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {t.orderIdLabel}:{' '}
                        <span className="font-mono text-foreground/90" title={row.id}>
                          {guestFacingOrderRef(row)}
                        </span>
                        {created ? ` · ${created}` : ''}
                      </p>
                      <p className="mt-1 text-[11px]">
                        <span className="text-muted-foreground">{t.payStatus}: </span>
                        <span className="font-medium">{payLabel(t, row.status)}</span>
                        <span className="text-muted-foreground"> · </span>
                        <span className="text-muted-foreground">{t.shipStatus}: </span>
                        <span className="font-medium">{shipLabel(t, row.shipping_status)}</span>
                      </p>
                    </div>
                    <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:min-w-[9rem] sm:shrink-0">
                      {needDeposit ? (
                        <Button
                          type="button"
                          size="sm"
                          variant={depositOpen ? 'secondary' : 'default'}
                          className="w-full"
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
                        className="w-full"
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
                    />
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
