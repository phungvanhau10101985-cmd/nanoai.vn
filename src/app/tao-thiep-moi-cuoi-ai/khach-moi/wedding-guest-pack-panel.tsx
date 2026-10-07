'use client'
/* eslint-disable @next/next/no-img-element -- SePay QR is a dynamic external image */

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Copy, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { sepayQrUrlForDownload } from '@/lib/sepay-qr'
import {
  formatWeddingPackVnd,
  weddingGuestPackBanner,
  type WeddingGuestPackId,
  type WeddingGuestPackQuota,
} from '@/lib/wedding/wedding-guest-pack'
import { WEDDING_CARD_RETENTION_NOTICE } from '@/lib/wedding/wedding-card-retention'
import {
  confirmWeddingGuestPackPaymentLocal,
  readWeddingGuestPackPayment,
  startWeddingGuestPackPayment,
} from './actions'

type PaymentView = {
  id: string
  packId: WeddingGuestPackId
  amount: number
  transactionContent: string
  bankAccount: string
  bankName: string
  accountHolderName: string
  qrUrl: string
  status: string
}

type Props = {
  cardId: string
  quota: WeddingGuestPackQuota | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onPaid: (quota: WeddingGuestPackQuota | null) => void
}

export function WeddingGuestPackPanel({ cardId, quota, open, onOpenChange, onPaid }: Props) {
  const { toast } = useToast()
  const [payment, setPayment] = useState<PaymentView | null>(null)
  const [buying, setBuying] = useState<WeddingGuestPackId | null>(null)
  const [localDev, setLocalDev] = useState(false)
  const [confirmingLocal, setConfirmingLocal] = useState(false)
  const onPaidRef = useRef(onPaid)
  onPaidRef.current = onPaid

  useEffect(() => {
    const host = window.location.hostname
    setLocalDev(host === 'localhost' || host === '127.0.0.1')
  }, [])

  useEffect(() => {
    if (!open) setPayment(null)
  }, [open])

  useEffect(() => {
    if (!open || !payment || payment.status === 'completed') return
    const timer = window.setInterval(async () => {
      const result = await readWeddingGuestPackPayment(payment.id)
      if ('error' in result && result.error) return
      if (!('payment' in result) || !result.payment) return
      if (result.payment.status !== 'completed') return
      setPayment(null)
      onOpenChange(false)
      onPaidRef.current(result.quota ?? null)
      toast({ title: 'Đã mở gói khách mời', description: `Có thể thêm khách tiếp. ${WEDDING_CARD_RETENTION_NOTICE}` })
    }, 2000)
    return () => window.clearInterval(timer)
  }, [onOpenChange, open, payment, toast])

  const buy = async (packId: WeddingGuestPackId) => {
    if (buying) return
    setBuying(packId)
    const result = await startWeddingGuestPackPayment(cardId, packId)
    setBuying(null)
    if ('error' in result && result.error) {
      toast({ title: 'Chưa tạo được mã chuyển khoản', description: result.error, variant: 'destructive' })
      return
    }
    if ('payment' in result && result.payment) setPayment(result.payment)
  }

  const confirmLocal = async () => {
    if (!payment || confirmingLocal) return
    setConfirmingLocal(true)
    const result = await confirmWeddingGuestPackPaymentLocal(payment.id)
    setConfirmingLocal(false)
    if ('error' in result && result.error) {
      toast({ title: 'Chưa ghi được gói', description: result.error, variant: 'destructive' })
      return
    }
    setPayment(null)
    onOpenChange(false)
    onPaid(('quota' in result ? result.quota : null) ?? null)
    toast({ title: 'Đã mở gói khách mời', description: `Có thể thêm khách tiếp. ${WEDDING_CARD_RETENTION_NOTICE}` })
  }

  const copyText = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value)
    toast({ title: 'Đã sao chép', description: label })
  }

  if (!quota) return null
  const canUpgrade = quota.offers.some((offer) => offer.available)

  return (
    <>
      <div className="rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-800">
        <p className="font-medium">{weddingGuestPackBanner(quota)}</p>
        <p className="mt-1 text-stone-600">
          Một khách là một dòng, một link mời. Nhà trai và nhà gái dùng chung một gói. Nâng gói tính phần chênh.
        </p>
        <p className="mt-1 text-stone-600">{WEDDING_CARD_RETENTION_NOTICE}</p>
        {canUpgrade ? (
          <Button type="button" size="sm" className="mt-3 h-9" onClick={() => onOpenChange(true)}>
            {quota.packId ? 'Nâng gói' : 'Chọn gói'}
          </Button>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Gói khách mời</DialogTitle>
            <DialogDescription>
              3 khách đầu miễn phí. Gói 50 khách 149.000đ, gói 100 khách 199.000đ, từ 101 khách 299.000đ.
              Cô dâu chú rể tự gửi link. {WEDDING_CARD_RETENTION_NOTICE}
            </DialogDescription>
          </DialogHeader>

          {payment ? (
            <div className="space-y-3">
              <p className="text-sm text-stone-700">
                Chuyển đúng <span className="font-semibold">{formatWeddingPackVnd(payment.amount)}</span> với nội dung bên dưới.
              </p>
              {payment.qrUrl ? (
                <img src={payment.qrUrl} alt="Mã QR chuyển khoản" className="mx-auto h-52 w-52 rounded-lg border" />
              ) : null}
              <div className="space-y-2 rounded-lg border bg-stone-50 p-3 text-sm">
                <Row label="Ngân hàng" value={payment.bankName} />
                <Row label="Số tài khoản" value={payment.bankAccount} onCopy={() => void copyText(payment.bankAccount, 'Số tài khoản')} />
                <Row label="Chủ tài khoản" value={payment.accountHolderName} />
                <Row label="Số tiền" value={formatWeddingPackVnd(payment.amount)} onCopy={() => void copyText(String(payment.amount), 'Số tiền')} />
                <Row
                  label="Nội dung"
                  value={payment.transactionContent}
                  onCopy={() => void copyText(payment.transactionContent, 'Nội dung chuyển khoản')}
                />
              </div>
              <p className="flex items-center gap-2 text-sm text-stone-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang chờ ngân hàng báo tiền về.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const link = document.createElement('a')
                  link.href = sepayQrUrlForDownload(payment.qrUrl)
                  link.download = `qr-${payment.transactionContent}.png`
                  link.target = '_blank'
                  link.rel = 'noreferrer'
                  link.click()
                }}
              >
                Tải mã QR
              </Button>
              {localDev ? (
                <Button type="button" variant="secondary" disabled={confirmingLocal} onClick={() => void confirmLocal()}>
                  {confirmingLocal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Xác nhận đã chuyển (máy local)
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              {quota.offers.map((offer) => (
                <div key={offer.id} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-3">
                  <div>
                    <p className="font-medium text-stone-900">{offer.label}</p>
                    <p className="text-sm text-stone-600">
                      {offer.current
                        ? 'Đang dùng'
                        : offer.available
                          ? offer.payVnd === offer.listPriceVnd
                            ? formatWeddingPackVnd(offer.listPriceVnd)
                            : `Trả thêm ${formatWeddingPackVnd(offer.payVnd)}`
                          : offer.guestCap != null && quota.guestCount > offer.guestCap
                            ? `Danh sách đã hơn ${offer.guestCap} khách`
                            : formatWeddingPackVnd(offer.listPriceVnd)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!offer.available || buying != null}
                    onClick={() => void buy(offer.id)}
                  >
                    {buying === offer.id ? <Loader2 className="h-4 w-4 animate-spin" /> : offer.current ? 'Đang dùng' : 'Chọn'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function Row({ label, value, onCopy }: { label: string; value: string; onCopy?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs text-stone-500">{label}</p>
        <p className="font-medium text-stone-900">{value || '—'}</p>
      </div>
      {onCopy && value ? (
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onCopy}>
          <Copy className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  )
}
