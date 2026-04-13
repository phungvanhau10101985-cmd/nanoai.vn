'use client'

import type { ReactNode } from 'react'
import { Loader2, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import type { PartnerOrderRow } from '@/lib/db/messaging-partner-orders-pg'
import { enrichPaymentDisplayFromQrUrl } from '@/lib/messaging/payment-qr-display-enrich'
import { isSepayStyleOrderPayment } from '@/lib/messaging/sepay-order-ui'
import { sepayQrUrlForDownload } from '@/lib/sepay-qr'

function displayBankName(raw: string): string {
  return raw.replace(/\s*\(BIN\s+\d+\)\s*$/i, '').trim() || raw.trim()
}

export function guestOrderNeedsDepositUi(order: PartnerOrderRow): boolean {
  const qr = String(order.payment_qr_url ?? '').trim()
  return (
    order.status === 'awaiting_payment' &&
    order.required_amount > 0 &&
    /^https?:\/\//i.test(qr)
  )
}

function CompactCopyRow({
  label,
  value,
  copyText,
  monospace,
}: {
  label: string
  value: ReactNode
  copyText: string
  monospace?: boolean
}) {
  const { toast } = useToast()
  const copy = async () => {
    const t = copyText.trim()
    if (!t) return
    try {
      await navigator.clipboard.writeText(t)
      toast({ title: 'Đã sao chép' })
    } catch {
      toast({ title: 'Không sao chép được', variant: 'destructive' })
    }
  }
  return (
    <div className="flex min-h-9 items-center justify-between gap-2 border-b border-border/50 px-1 py-1 last:border-b-0 sm:px-1.5">
      <span className="shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-1">
        <span className={`min-w-0 truncate text-right text-[11px] text-foreground sm:text-xs ${monospace ? 'font-mono' : ''}`}>
          {value}
        </span>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => void copy()} aria-label="Sao chép">
          <Copy className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  )
}

/**
 * Khối QR + STK (+ gửi biên lai nếu **không** phải SePay) — dialog đơn, cùng API verify-payment với chat.
 */
export function GuestWidgetOrderDepositPanel({
  order,
  busyOrderId,
  onPickProof,
  className = '',
}: {
  order: PartnerOrderRow
  busyOrderId: string | null
  onPickProof: (orderId: string) => void
  className?: string
}) {
  if (!guestOrderNeedsDepositUi(order)) return null

  const qrUrl = String(order.payment_qr_url ?? '').trim()
  const ref = String(order.payment_reference ?? '').trim()
  const enriched = enrichPaymentDisplayFromQrUrl(qrUrl, {
    bank_name: '',
    account_number: '',
    account_holder: '',
  })
  const bank = displayBankName(enriched.bank_name)
  const acc = enriched.account_number
  const holder = enriched.account_holder
  const amount = Math.max(0, Math.round(order.required_amount))
  const busy = busyOrderId === order.id
  const isSepay = isSepayStyleOrderPayment({
    payment_qr_url: order.payment_qr_url,
    payment_reference: order.payment_reference,
  })

  return (
    <div className={`rounded-lg border border-amber-300/60 bg-amber-50/50 p-2.5 dark:border-amber-700/50 dark:bg-amber-950/25 ${className}`}>
      <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">Đặt cọc chuyển khoản</p>
      <div className="mt-1.5 space-y-0 overflow-hidden rounded-md border border-border/60 bg-background/80 px-0">
        {bank ? <CompactCopyRow label="Ngân hàng" value={bank} copyText={bank} /> : null}
        {acc ? <CompactCopyRow label="STK" value={acc} copyText={acc} monospace /> : null}
        {holder ? <CompactCopyRow label="Chủ TK" value={holder} copyText={holder} /> : null}
        {amount > 0 ? (
          <CompactCopyRow
            label="Số tiền"
            value={<>{new Intl.NumberFormat('vi-VN').format(amount)}đ</>}
            copyText={String(amount)}
            monospace
          />
        ) : null}
        {ref ? (
          <CompactCopyRow label="Nội dung CK" value={<span className="font-mono">{ref}</span>} copyText={ref} monospace />
        ) : null}
      </div>
      <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
        {isSepay
          ? 'Chuyển đúng số tiền và «Nội dung CK» (memo). Quét QR để điền sẵn. Shop nhận xác nhận qua SePay — không cần gửi ảnh biên lai.'
          : 'Nhập đúng nội dung chuyển khoản. Có thể quét QR để điền sẵn.'}
      </p>
      <div className="mt-2 flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrUrl}
          alt="QR chuyển khoản đặt cọc"
          width={260}
          height={260}
          className="h-auto w-full max-w-[260px] rounded-md border border-border/60 bg-white object-contain"
          loading="lazy"
        />
      </div>
      {isSepay ? (
        <div className="mt-2 space-y-1.5">
          <Button type="button" size="sm" className="h-10 w-full text-sm font-medium" asChild>
            <a
              href={sepayQrUrlForDownload(qrUrl)}
              target="_blank"
              rel="noopener noreferrer"
              download
            >
              Tải mã QR đơn hàng
            </a>
          </Button>
          <p className="text-center text-[10px] text-muted-foreground">
            Tải ảnh QR về máy (SePay) — chuyển khoản đúng «Nội dung CK»; xác nhận tự động, không cần ảnh biên lai.
          </p>
        </div>
      ) : (
        <div className="mt-2">
          <Button
            type="button"
            size="sm"
            className="h-10 w-full gap-1.5 text-sm font-medium"
            disabled={Boolean(busyOrderId)}
            onClick={() => onPickProof(order.id)}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                Đang tải ảnh và đối chiếu…
              </>
            ) : (
              <>Gửi ảnh giao dịch{ref ? ` · ${ref}` : ''}</>
            )}
          </Button>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
            Chỉ gửi biên lai qua nút này (đúng mã đơn); không gửi qua ô ảnh chat.
          </p>
        </div>
      )}
    </div>
  )
}
