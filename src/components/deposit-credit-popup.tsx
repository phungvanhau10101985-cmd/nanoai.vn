"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { formatNumber } from '@/lib/format'
import { toast } from '@/hooks/use-toast'
import { Smartphone, Download, Copy, CreditCard, Loader2, CheckCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { buildSePayQrImgUrl, buildSePayDeeplink } from '@/lib/sepay-qr'
import { isLocalhost, getDevUserId } from '@/lib/auth-client'
import { trackEvent, toFeatureFromRoute } from '@/lib/analytics-track'

type PaymentConfig = {
  id: string
  bank_account: string
  bank_id: string
  bank_name: string
  account_holder_name?: string
  qr_template_url: string
}

type Payment = {
  id: string
  amount: number
  credits_added: number
  status: string
  qr_url: string
  transaction_content?: string
  bank_account?: string
  bank_name?: string
}

const PRESET_AMOUNTS = [6000, 12000, 30000, 60000, 120000]

function generateTransferContent() {
  const rawPrefix = (process.env.NEXT_PUBLIC_SEPAY_CONTENT_PREFIX || 'DH').toUpperCase()
  const prefix = rawPrefix.replace(/[^A-Z0-9]/g, '').slice(0, 5) || 'DH'
  const maxLength = Math.min(10, Math.max(1, Number(process.env.NEXT_PUBLIC_SEPAY_CONTENT_SUFFIX_MAX_LENGTH) || 10))
  const maxValue = 10 ** maxLength - 1
  const suffix = Math.floor(Math.random() * (maxValue + 1)).toString().padStart(maxLength, '0')
  return `SEVQR ${prefix}${suffix}`
}

interface DepositCreditPopupProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  returnPath?: string
  onCreditsUpdated?: () => void
}

export function DepositCreditPopup({ open, onOpenChange, returnPath, onCreditsUpdated }: DepositCreditPopupProps) {
  const router = useRouter()
  const [amount, setAmount] = useState(6000)
  const [configs, setConfigs] = useState<PaymentConfig[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState<string>('')
  const [payment, setPayment] = useState<Payment | null>(null)
  const [paymentSuccess, setPaymentSuccess] = useState<{ amount: number; credits_added: number } | null>(null)
  const [creating, setCreating] = useState(false)
  const createPressLockRef = useRef(false)
  const supabase = createClient()

  const fetchConfigs = useCallback(async () => {
    const { data, error } = await supabase
      .from('payment_configs')
      .select('id, bank_account, bank_id, bank_name, account_holder_name, qr_template_url')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
    if (error) throw error
    setConfigs(data || [])
    if (data?.length && !selectedConfigId) setSelectedConfigId(data[0].id)
  }, [supabase, selectedConfigId])

  const createPayment = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id ?? (isLocalhost() ? getDevUserId() : null)
    if (!userId) {
      toast({ title: 'Lỗi', description: 'Vui lòng đăng nhập để nạp tiền.', variant: 'destructive' })
      return
    }
    const effectiveConfigId = selectedConfigId || configs[0]?.id || ''
    const config = configs.find(c => c.id === effectiveConfigId)
    if (!config || amount < 1000) return

    setCreating(true)
    try {
      const content = generateTransferContent()
      const qrUrl = buildSePayQrImgUrl({
        acc: config.bank_account,
        bank: config.bank_id,
        amount,
        des: content,
      })
      const creditsToAdd = Math.floor(amount / 6000)

      const { data: pay, error } = await supabase
        .from('payments')
        .insert({
          user_id: userId,
          amount,
          credits_added: creditsToAdd,
          transaction_content: content,
          bank_account: config.bank_account,
          bank_name: config.bank_name,
          qr_url: qrUrl,
          status: 'pending',
        })
        .select()
        .single()

      if (error) throw error
      setPayment(pay)
    } catch (e) {
      console.error(e)
      toast({ title: 'Lỗi', description: 'Không thể tạo giao dịch', variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }, [configs, selectedConfigId, amount, supabase])

  const handleCreatePaymentPress = async () => {
    if (createPressLockRef.current || creating) return
    if (!configs.length) {
      toast({ title: 'Đang tải', description: 'Vui lòng chờ cấu hình ngân hàng tải xong.', variant: 'destructive' })
      return
    }
    if (amount < 1000) {
      toast({ title: 'Lỗi', description: 'Số tiền tối thiểu 1.000 VND.', variant: 'destructive' })
      return
    }
    createPressLockRef.current = true
    try {
      await createPayment()
    } finally {
      setTimeout(() => {
        createPressLockRef.current = false
      }, 300)
    }
  }

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text)
    toast({ title: 'Đã sao chép', description: label })
  }

  const downloadQr = () => {
    if (!payment?.qr_url || !config) return
    // SePay: thêm download=true để tải ảnh QR về máy
    const downloadUrl = buildSePayQrImgUrl({
      acc: config.bank_account,
      bank: config.bank_id,
      amount: payment.amount,
      des: payment.transaction_content || '',
      download: true,
    })
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = `qr-${payment.transaction_content || 'payment'}.png`
    link.target = '_blank'
    link.click()
  }

  useEffect(() => {
    if (open) {
      fetchConfigs()
      setPayment(null)
      setPaymentSuccess(null)
    }
  }, [open, fetchConfigs])

  // Polling: kiểm tra thanh toán hoàn tất (webhook đã cập nhật)
  useEffect(() => {
    if (!open || !payment || payment.status === 'completed') return
    const interval = setInterval(async () => {
      const { data } = await supabase.from('payments').select('status, amount, credits_added').eq('id', payment.id).single()
      if (data?.status === 'completed') {
        const route = returnPath || window.location.pathname
        trackEvent('topup_success', {
          route,
          feature: toFeatureFromRoute(route),
          amount: data.amount,
          credits_added: data.credits_added,
        })
        // Đóng QR, hiển thị thông báo thành công
        setPaymentSuccess({
          amount: data.amount,
          credits_added: data.credits_added,
        })
        setPayment(null)
        onCreditsUpdated?.()
        window.dispatchEvent(new CustomEvent('credits-updated'))
        router.refresh()
        toast({
          title: 'Nạp thành công!',
          description: `Đã nạp ${formatNumber(data.amount)}₫, nhận ${data.credits_added} credits.`,
          duration: 5000,
        })
        // Đóng popup sau 10 giây, khách có thể tự tắt sớm hơn
        setTimeout(() => {
          setPaymentSuccess(null)
          onOpenChange(false)
          if (returnPath) router.push(returnPath)
        }, 10000)
      }
    }, 2000) // Poll mỗi 2 giây
    return () => clearInterval(interval)
  }, [open, payment?.id, payment?.status, supabase, onOpenChange, returnPath, router, onCreditsUpdated])

  const config = configs.find(c => c.id === selectedConfigId)
  const deeplink = payment && config
    ? buildSePayDeeplink(
        config.bank_account,
        config.bank_id,
        payment.amount,
        payment.transaction_content || '',
        config.account_holder_name
      )
    : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md sm:max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden overscroll-contain pb-6 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Nạp Credits
          </DialogTitle>
          <DialogDescription>
            Chọn số tiền, quét QR hoặc mở app ngân hàng để thanh toán
          </DialogDescription>
        </DialogHeader>

        {paymentSuccess ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="rounded-full bg-green-100 p-4">
              <CheckCircle className="h-16 w-16 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-green-700">Nạp thành công!</h3>
            <p className="text-center text-muted-foreground">
              Đã nạp <span className="font-bold text-green-600">{formatNumber(paymentSuccess.amount)}₫</span>
              <br />
              Nhận <span className="font-bold text-green-600">{paymentSuccess.credits_added} credits</span> vào tài khoản
            </p>
            <p className="text-sm text-muted-foreground">Đóng sau 10 giây hoặc bấm bên dưới</p>
            <Button
              onClick={() => {
                setPaymentSuccess(null)
                onOpenChange(false)
                if (returnPath) router.push(returnPath)
              }}
              className="mt-2"
            >
              Đóng
            </Button>
          </div>
        ) : !payment ? (
          <div className="space-y-4 pb-6">
            <div className="space-y-2">
              <Label>Số tiền (VND)</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_AMOUNTS.map((a) => (
                  <Button
                    key={a}
                    type="button"
                    variant={amount === a ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAmount(a)}
                  >
                    {formatNumber(a)}₫
                  </Button>
                ))}
              </div>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 6000)}
                min={1000}
                step={1000}
              />
              <p className="text-sm text-muted-foreground">
                Sẽ nhận: <span className="font-semibold text-green-600">{Math.floor(amount / 6000)} credits</span>
              </p>
            </div>

            {configs.length > 1 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Chọn ngân hàng</Label>
                <div className="grid gap-3">
                  {configs.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedConfigId(c.id)}
                      className={`
                        w-full min-h-[52px] px-4 py-3 rounded-xl border-2 text-left font-medium
                        transition-all duration-200 ease-out
                        hover:shadow-lg hover:shadow-green-500/10 hover:scale-[1.02]
                        active:scale-[0.98]
                        ${selectedConfigId === c.id
                          ? 'border-green-500 bg-green-50 dark:bg-green-950/30 shadow-md'
                          : 'border-muted-foreground/20 bg-background/80 backdrop-blur-sm hover:border-green-300'
                        }
                      `}
                    >
                      <span className="block text-base">{c.bank_name}</span>
                      {c.bank_account && (
                        <span className="block text-xs text-muted-foreground mt-0.5 font-mono">
                          {c.bank_account}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button
              type="button"
              className="w-full min-h-[52px] h-12 text-base touch-manipulation select-none relative z-10"
              onClick={handleCreatePaymentPress}
              onPointerUp={handleCreatePaymentPress}
              disabled={creating || !configs.length}
            >
              {creating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                configs.length ? 'Tạo mã thanh toán' : 'Đang tải cấu hình ngân hàng...'
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {/* Bước 1: Nút Mở App Ngân hàng - Tạm ẩn */}
            {/* <a href={deeplink} target="_blank" rel="noopener noreferrer" className="block">
              <Button className="w-full h-12 sm:h-14 text-base sm:text-lg bg-green-600 hover:bg-green-700 text-white font-semibold shadow-lg">
                <Smartphone className="mr-2 h-6 w-6" />
                Mở App Ngân hàng & Thanh toán ngay
              </Button>
            </a> */}

            {/* Bước 2: QR + Tải về */}
            <div className="flex flex-col items-center gap-3">
              <div className="border-2 rounded-lg p-2 sm:p-3 bg-white shrink-0">
                <img
                  src={payment.qr_url}
                  alt="QR Thanh toán"
                  className="w-36 h-36 sm:w-48 sm:h-48 object-contain"
                />
              </div>
              <Button variant="outline" className="w-full" onClick={downloadQr}>
                <Download className="mr-2 h-4 w-4" />
                Lưu mã QR
              </Button>
            </div>

            {/* Bước 3: Thông tin thủ công */}
            <div className="space-y-2 sm:space-y-3 rounded-lg border p-3 sm:p-4 bg-muted/50 text-sm sm:text-base">
              <p className="text-sm font-medium">Hoặc chuyển khoản thủ công:</p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">Ngân hàng:</span>
                <span className="font-semibold">{config?.bank_name || payment.bank_name}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">Chủ tài khoản:</span>
                <span className="font-semibold">{config?.account_holder_name || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">Số tài khoản:</span>
                <div className="flex items-center gap-2">
                  <code className="font-mono font-semibold">{payment.bank_account}</code>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(payment.bank_account || '', 'Số tài khoản')}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">Nội dung:</span>
                <div className="flex items-center gap-2">
                  <code className="font-mono font-semibold">{payment.transaction_content}</code>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(payment.transaction_content || '', 'Nội dung chuyển khoản')}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Số tiền:</span>
                <span className="font-bold">{formatNumber(payment.amount)}₫</span>
              </div>
            </div>

            <Button variant="outline" className="w-full" onClick={() => setPayment(null)}>
              Tạo giao dịch mới
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
