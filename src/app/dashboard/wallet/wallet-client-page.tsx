'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { createDepositTransaction } from './actions'
import { Loader2, Wallet, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/sonner'

type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

function getWebLocaleFromCookie(): UiLocale {
  if (typeof document === 'undefined') return 'vi'
  const cookieValue = document.cookie
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('nanoai_locale='))
    ?.split('=')[1]
    ?.trim()
    .toLowerCase()
  if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') return cookieValue
  return 'vi'
}

const CREDIT_PACKAGES = [
  { id: 1, credits: 10, price: 50000, popular: false },
  { id: 2, credits: 25, price: 100000, popular: true },
  { id: 3, credits: 60, price: 200000, popular: false },
]

export default function WalletPage({ userId }: { userId: string }) {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [selectedPackage, setSelectedPackage] = useState(CREDIT_PACKAGES[1])
  const [isLoading, setIsLoading] = useState(false)
  const [transactionId, setTransactionId] = useState<string | null>(null)
  const { toast } = useToast()

  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  useEffect(() => {
    const syncLocale = () => setUiLocale(getWebLocaleFromCookie())
    syncLocale()
    const timer = window.setInterval(syncLocale, 1000)
    window.addEventListener('focus', syncLocale)
    document.addEventListener('visibilitychange', syncLocale)
    return () => {
      window.removeEventListener('focus', syncLocale)
      document.removeEventListener('visibilitychange', syncLocale)
      window.clearInterval(timer)
    }
  }, [])

  const handlePurchase = async () => {
    setIsLoading(true)
    setTransactionId(null)
    const result = await createDepositTransaction(selectedPackage.id)
    setIsLoading(false)

    if (result.error) {
      toast({
        title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
        description: result.error,
        variant: 'destructive',
      })
    } else if (result.transactionId) {
      setTransactionId(result.transactionId)
      toast({
        title: tr('Thành công', 'Success', '成功', '成功', '성공'),
        description: tr('Đã tạo giao dịch. Vui lòng hoàn tất thanh toán.', 'Transaction created. Please complete the payment.', '交易已创建。请完成付款。', '取引を作成しました。お支払いを完了してください。', '거래가 생성되었습니다. 결제를 완료해 주세요.'),
      })
    }
  }

  return (
    <div className="space-y-8">
      <Toaster />
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">{tr('Ví của tôi', 'My Wallet', '我的钱包', 'マイウォレット', '내 지갑')}</h2>
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <Card>
            <CardHeader>
              <CardTitle>{tr('Chọn gói tín dụng', 'Select credit package', '选择积分套餐', 'クレジットパッケージを選択', '크레딧 패키지 선택')}</CardTitle>
              <CardDescription>{tr('Chọn một gói để nạp tiền vào số dư của bạn.', 'Select a package to add credits to your balance.', '选择套餐以充值到您的余额。', 'パッケージを選択して残高にクレジットを追加。', '패키지를 선택해 잔액에 크레딧을 추가하세요.')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {CREDIT_PACKAGES.map((pkg) => (
                <div
                  key={pkg.id}
                  onClick={() => setSelectedPackage(pkg)}
                  className={`flex items-center justify-between rounded-lg border p-4 cursor-pointer transition-all ${
                    selectedPackage.id === pkg.id ? 'border-primary ring-2 ring-primary' : 'border-border'
                  }`}
                >
                  <div>
                    <p className="font-semibold">{pkg.credits} {tr('Tín dụng', 'Credits', '积分', 'クレジット', '크레딧')}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(pkg.price)}
                    </p>
                  </div>
                  {pkg.popular && (
                    <div className="text-xs font-bold bg-primary text-primary-foreground px-2 py-1 rounded-full">
                      {tr('PHỔ BIẾN', 'POPULAR', '热门', '人気', '인기')}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
            <CardFooter>
              <Button onClick={handlePurchase} disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {tr('Thanh toán', 'Pay', '支付', '支払う', '결제')}
              </Button>
            </CardFooter>
          </Card>
        </div>
        <div>
          {transactionId ? (
            <Card>
              <CardHeader>
                <CardTitle>{tr('Hoàn tất thanh toán', 'Complete payment', '完成支付', '支払いを完了', '결제 완료')}</CardTitle>
                <CardDescription>{tr('Quét mã QR bằng ứng dụng ngân hàng của bạn để thanh toán.', 'Scan the QR code with your banking app to pay.', '使用您的银行应用扫描二维码完成支付。', '銀行アプリでQRコードをスキャンして支払ってください。', '은행 앱으로 QR 코드를 스캔해 결제하세요.')}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.vietqr.io/v2/generate?accountNo=YOUR_ACCOUNT_NO&accountName=YOUR_ACCOUNT_NAME&acqId=970408&amount=${selectedPackage.price}&addInfo=${userId}&template=compact`}
                  alt={tr('Mã VietQR', 'VietQR code', 'VietQR 二维码', 'VietQRコード', 'VietQR 코드')}
                  width={250}
                  height={250}
                />
                <div className="mt-4 space-y-2 text-sm">
                  <p>
                    <strong>{tr('Số tiền', 'Amount', '金额', '金額', '금액')}:</strong>{' '}
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(selectedPackage.price)}
                  </p>
                  <p>
                    <strong>{tr('Nội dung', 'Transfer note', '转账内容', '振込内容', '입금 내용')}:</strong> {userId}
                  </p>
                  <div className="mt-4 flex items-center justify-center rounded-md bg-yellow-50 p-3 text-yellow-700">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    <p>
                      {tr('Giao dịch của bạn đang chờ xử lý. Tín dụng sẽ được cộng sau khi quản trị viên xác nhận.', 'Your transaction is pending. Credits will be added after admin confirmation.', '您的交易正在处理中。管理员确认后将添加积分。', '取引は処理待ちです。管理者確認後にクレジットが追加されます。', '거래가 처리 대기 중입니다. 관리자 확인 후 크레딧이 추가됩니다.')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="flex flex-col items-center justify-center h-full text-center">
              <CardContent>
                <Wallet className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold">{tr('Sẵn sàng thanh toán?', 'Ready to pay?', '准备付款？', 'お支払いの準備はできましたか？', '결제할 준비가 되셨나요?')}</h3>
                <p className="text-sm text-muted-foreground">
                  {tr('Chọn một gói và nhấp vào "Thanh toán" để tạo mã QR của bạn.', 'Select a package and click "Pay" to generate your QR code.', '选择套餐并点击“付款”以生成二维码。', 'パッケージを選択して「支払う」をクリックしてQRコードを生成。', '패키지를 선택하고 "결제"를 클릭하여 QR 코드를 생성하세요.')}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
