'use client'

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { DepositCreditPopup } from '@/components/deposit-credit-popup'
import { CREDIT_UNIT_PRICE_VND } from '@/lib/credit-unit-price'
import { Wallet } from 'lucide-react'

type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

function getWebLocaleFromCookie(): UiLocale {
  if (typeof document === 'undefined') return 'vi'
  const cookieValue = readWebLocaleFromDocumentCookie()
  if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') return cookieValue
  return 'vi'
}

const CREDIT_PACKAGES = [
  { id: 1, price: 50000, popular: false },
  { id: 2, price: 100000, popular: true },
  { id: 3, price: 200000, popular: false },
].map((pkg) => ({ ...pkg, credits: Math.floor(pkg.price / CREDIT_UNIT_PRICE_VND) }))

export default function WalletPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [selectedPackage, setSelectedPackage] = useState(CREDIT_PACKAGES[1])
  const [payOpen, setPayOpen] = useState(false)

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

  const handlePurchase = () => {
    setPayOpen(true)
  }

  return (
    <div className="space-y-8">
      <DepositCreditPopup
        open={payOpen}
        onOpenChange={setPayOpen}
        presetAmount={selectedPackage.price}
      />
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
              <Button onClick={handlePurchase} className="w-full">
                {tr('Thanh toán', 'Pay', '支付', '支払う', '결제')}
              </Button>
            </CardFooter>
          </Card>
        </div>
        <div>
          <Card className="flex h-full flex-col items-center justify-center text-center">
            <CardContent>
              <Wallet className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
              <h3 className="text-lg font-semibold">{tr('Sẵn sàng thanh toán?', 'Ready to pay?', '准备付款？', 'お支払いの準備はできましたか？', '결제할 준비가 되셨나요?')}</h3>
              <p className="text-sm text-muted-foreground">
                {tr('Bấm Thanh toán để hiện mã QR, rồi chọn app ngân hàng để chuyển khoản.', 'Click Pay to show the QR, then choose a bank app to transfer.', '点击支付显示二维码，再选择银行应用转账。', '支払うを押してQRを表示し、銀行アプリを選んで振り込みます。', '결제를 눌러 QR을 표시한 뒤 은행 앱을 선택해 이체하세요.')}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
