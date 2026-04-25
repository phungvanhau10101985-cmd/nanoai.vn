"use client"
/* eslint-disable @next/next/no-img-element -- payment QR image can be dynamic external URL */

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
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
import { getClientUserId } from '@/lib/auth/get-client-user-id'
import { formatNumber } from '@/lib/format'
import { toast } from '@/hooks/use-toast'
import { Download, Copy, CreditCard, Loader2, CheckCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { buildSePayQrImgUrl } from '@/lib/sepay-qr'
import { isLocalhost, getDevUserId } from '@/lib/auth-client'
import { trackEvent, toFeatureFromRoute } from '@/lib/analytics-track'
import { CREDIT_UNIT_PRICE_VND } from '@/lib/credit-unit-price'
import { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'
import { fireMetaStandardEvent } from '@/lib/tracking/meta-standard-events-client'

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

const PRESET_AMOUNTS = [
  CREDIT_UNIT_PRICE_VND,
  CREDIT_UNIT_PRICE_VND * 2,
  CREDIT_UNIT_PRICE_VND * 5,
  CREDIT_UNIT_PRICE_VND * 10,
  CREDIT_UNIT_PRICE_VND * 20,
]

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
  const [uiLocale, setUiLocale] = useState<'vi' | 'en' | 'zh' | 'ja' | 'ko'>('vi')
  const [amount, setAmount] = useState(CREDIT_UNIT_PRICE_VND)
  const [configs, setConfigs] = useState<PaymentConfig[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState<string>('')
  const [payment, setPayment] = useState<Payment | null>(null)
  const [paymentSuccess, setPaymentSuccess] = useState<{ amount: number; credits_added: number } | null>(null)
  const [creating, setCreating] = useState(false)
  const createPressLockRef = useRef(false)
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  const fetchConfigs = useCallback(async () => {
    const res = await fetch('/api/payment-configs', { credentials: 'same-origin' })
    if (!res.ok) throw new Error('config')
    const j = (await res.json()) as { configs?: PaymentConfig[] }
    const data = j.configs || []
    setConfigs(data)
    if (data.length && !selectedConfigId) setSelectedConfigId(data[0].id)
  }, [selectedConfigId])

  const createPayment = useCallback(async () => {
    let userId = await getClientUserId()
    if (!userId && isLocalhost()) userId = getDevUserId()
    if (!userId) {
      if (typeof window !== 'undefined') {
        const raw = `${window.location.pathname || '/'}${window.location.search || ''}`
        const loginHref = `/auth/login?next=${encodeURIComponent(sanitizeLoginNext(raw))}`
        window.location.href = loginHref
      } else {
        toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Vui lòng đăng nhập để nạp tiền.', 'Please sign in to top up.', '请登录后充值。', 'チャージするにはログインしてください。', '충전하려면 로그인해 주세요.'), variant: 'destructive' })
      }
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
      const creditsToAdd = Math.floor(amount / CREDIT_UNIT_PRICE_VND)

      const payRes = await fetch('/api/account/payments', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          credits_added: creditsToAdd,
          transaction_content: content,
          bank_account: config.bank_account,
          bank_name: config.bank_name,
          qr_url: qrUrl,
        }),
      })
      const payJson = (await payRes.json()) as { payment?: Payment; error?: string }
      if (!payRes.ok || !payJson.payment) throw new Error(payJson.error || 'payment')
      setPayment(payJson.payment)
    } catch (e) {
      console.error(e)
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Không thể tạo giao dịch', 'Cannot create transaction', '无法创建交易', '取引を作成できません', '거래를 생성할 수 없습니다'), variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }, [configs, selectedConfigId, amount])

  const handleCreatePaymentPress = async () => {
    if (createPressLockRef.current || creating) return
    if (!configs.length) {
      toast({ title: tr('Đang tải', 'Loading', '加载中', '読み込み中', '불러오는 중'), description: tr('Vui lòng chờ cấu hình ngân hàng tải xong.', 'Please wait for bank config to load.', '请等待银行配置加载完成。', '銀行設定の読み込み完了までお待ちください。', '은행 설정이 로드될 때까지 기다려 주세요.'), variant: 'destructive' })
      return
    }
    if (amount < 1000) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Số tiền tối thiểu 1.000 VND.', 'Minimum amount is 1,000 VND.', '最低金额为 1,000 VND。', '最小金額は1,000 VNDです。', '최소 금액은 1,000 VND입니다.'), variant: 'destructive' })
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
    toast({ title: tr('Đã sao chép', 'Copied', '已复制', 'コピーしました', '복사됨'), description: label })
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
    const syncLocale = () => {
      const cookieValue = readWebLocaleFromDocumentCookie()
      if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') setUiLocale(cookieValue)
      else setUiLocale('vi')
    }
    syncLocale()
    const timer = window.setInterval(syncLocale, 1000)
    window.addEventListener('focus', syncLocale)
    document.addEventListener('visibilitychange', syncLocale)
    if (open) {
      fetchConfigs()
      setPayment(null)
      setPaymentSuccess(null)
    }
    return () => {
      window.removeEventListener('focus', syncLocale)
      document.removeEventListener('visibilitychange', syncLocale)
      window.clearInterval(timer)
    }
  }, [open, fetchConfigs])

  // Polling: kiểm tra thanh toán hoàn tất (webhook đã cập nhật)
  useEffect(() => {
    if (!open || !payment || payment.status === 'completed') return
    const interval = setInterval(async () => {
      const res = await fetch(`/api/account/payments/${encodeURIComponent(payment.id)}`, {
        credentials: 'same-origin',
      })
      const j = (await res.json()) as { payment?: { status: string; amount: number; credits_added: number } }
      const data = j.payment
      if (data?.status === 'completed') {
        const route = returnPath || window.location.pathname
        trackEvent('topup_success', {
          route,
          feature: toFeatureFromRoute(route),
          amount: data.amount,
          credits_added: data.credits_added,
        })
        fireMetaStandardEvent('Subscribe', {
          dedupeKey: `topup_subscribe_${payment.id}`,
          customData: {
            currency: 'VND',
            value: Math.max(0, Math.round(Number(data.amount) || 0)),
            credits_added: Math.max(0, Math.round(Number(data.credits_added) || 0)),
            content_name: 'NanoAI credits top-up',
            content_category: 'credits',
          },
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
          title: tr('Nạp thành công!', 'Top-up successful!', '充值成功！', 'チャージ成功！', '충전 성공!'),
          description: `${tr('Đã nạp', 'Topped up', '已充值', 'チャージ済み', '충전 완료')} ${formatNumber(data.amount)}₫, ${tr('nhận', 'received', '获得', '受け取り', '수령')} ${data.credits_added} credits.`,
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
  }, [open, payment?.id, payment?.status, onOpenChange, returnPath, router, onCreditsUpdated])

  const config = configs.find(c => c.id === selectedConfigId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md sm:max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden overscroll-contain pb-6 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {tr('Nạp Credits', 'Top up credits', '充值积分', 'クレジットをチャージ', '크레딧 충전')}
          </DialogTitle>
          <DialogDescription>
            {tr('Chọn số tiền, quét QR hoặc mở app ngân hàng để thanh toán', 'Choose amount, scan QR, or open bank app to pay', '选择金额，扫码或打开银行App支付', '金額を選択し、QRスキャンまたは銀行アプリで支払い', '금액 선택 후 QR 스캔 또는 은행 앱으로 결제')}
          </DialogDescription>
        </DialogHeader>

        {paymentSuccess ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="rounded-full bg-green-100 p-4">
              <CheckCircle className="h-16 w-16 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-green-700">{tr('Nạp thành công!', 'Top-up successful!', '充值成功！', 'チャージ成功！', '충전 성공!')}</h3>
            <p className="text-center text-muted-foreground">
              {tr('Đã nạp', 'Topped up', '已充值', 'チャージ済み', '충전 완료')} <span className="font-bold text-green-600">{formatNumber(paymentSuccess.amount)}₫</span>
              <br />
              {tr('Nhận', 'Received', '获得', '受け取り', '수령')} <span className="font-bold text-green-600">{paymentSuccess.credits_added} credits</span> {tr('vào tài khoản', 'to your account', '到你的账户', 'アカウントへ', '계정으로')}
            </p>
            <p className="text-sm text-muted-foreground">{tr('Đóng sau 10 giây hoặc bấm bên dưới', 'Auto-close in 10 seconds or click below', '10秒后自动关闭或点击下方', '10秒後に自動で閉じるか下をクリック', '10초 후 자동 닫힘 또는 아래 버튼 클릭')}</p>
            <Button
              onClick={() => {
                setPaymentSuccess(null)
                onOpenChange(false)
                if (returnPath) router.push(returnPath)
              }}
              className="mt-2"
            >
              {tr('Đóng', 'Close', '关闭', '閉じる', '닫기')}
            </Button>
          </div>
        ) : !payment ? (
          <div className="space-y-4 pb-6">
            <div className="space-y-2">
              <Label>{tr('Số tiền (VND)', 'Amount (VND)', '金额 (VND)', '金額 (VND)', '금액 (VND)')}</Label>
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
                onChange={(e) => setAmount(Number(e.target.value) || CREDIT_UNIT_PRICE_VND)}
                min={1000}
                step={1000}
              />
              <p className="text-sm text-muted-foreground">
                {tr('Sẽ nhận', 'You will receive', '将获得', '受け取る', '받게 되는')} <span className="font-semibold text-green-600">{Math.floor(amount / CREDIT_UNIT_PRICE_VND)} credits</span>
              </p>
            </div>

            {configs.length > 1 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">{tr('Chọn ngân hàng', 'Choose bank', '选择银行', '銀行を選択', '은행 선택')}</Label>
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
                configs.length ? tr('Tạo mã thanh toán', 'Create payment QR', '创建支付码', '支払いQRを作成', '결제 QR 생성') : tr('Đang tải cấu hình ngân hàng...', 'Loading bank config...', '正在加载银行配置...', '銀行設定を読み込み中...', '은행 설정 불러오는 중...')
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
                  alt={tr('QR Thanh toán', 'Payment QR', '支付二维码', '支払いQR', '결제 QR')}
                  className="w-36 h-36 sm:w-48 sm:h-48 object-contain"
                />
              </div>
              <Button variant="outline" className="w-full" onClick={downloadQr}>
                <Download className="mr-2 h-4 w-4" />
                {tr('Lưu mã QR', 'Save QR image', '保存二维码', 'QR画像を保存', 'QR 저장')}
              </Button>
            </div>

            {/* Bước 3: Thông tin thủ công */}
            <div className="space-y-2 sm:space-y-3 rounded-lg border p-3 sm:p-4 bg-muted/50 text-sm sm:text-base">
              <p className="text-sm font-medium">{tr('Hoặc chuyển khoản thủ công:', 'Or transfer manually:', '或手动转账：', 'または手動振込：', '또는 수동 이체:')}</p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">{tr('Ngân hàng', 'Bank', '银行', '銀行', '은행')}:</span>
                <span className="font-semibold">{config?.bank_name || payment.bank_name}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">{tr('Chủ tài khoản', 'Account holder', '账户名', '口座名義', '예금주')}:</span>
                <span className="font-semibold">{config?.account_holder_name || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">{tr('Số tài khoản', 'Account number', '账号', '口座番号', '계좌번호')}:</span>
                <div className="flex items-center gap-2">
                  <code className="font-mono font-semibold">{payment.bank_account}</code>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(payment.bank_account || '', tr('Số tài khoản', 'Account number', '账号', '口座番号', '계좌번호'))}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">{tr('Nội dung', 'Transfer note', '转账内容', '振込内容', '입금 내용')}:</span>
                <div className="flex items-center gap-2">
                  <code className="font-mono font-semibold">{payment.transaction_content}</code>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(payment.transaction_content || '', tr('Nội dung chuyển khoản', 'Transfer note', '转账备注', '振込内容', '입금 내용'))}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{tr('Số tiền', 'Amount', '金额', '金額', '금액')}:</span>
                <span className="font-bold">{formatNumber(payment.amount)}₫</span>
              </div>
            </div>

            <Button variant="outline" className="w-full" onClick={() => setPayment(null)}>
              {tr('Tạo giao dịch mới', 'Create new transaction', '创建新交易', '新しい取引を作成', '새 거래 생성')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
