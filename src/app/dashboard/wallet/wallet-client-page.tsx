'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { createDepositTransaction } from './actions'
import { Loader2, Wallet, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/sonner'

const CREDIT_PACKAGES = [
  { id: 1, credits: 10, price: 50000, popular: false },
  { id: 2, credits: 25, price: 100000, popular: true },
  { id: 3, credits: 60, price: 200000, popular: false },
]

export default function WalletPage({ userId }: { userId: string }) {
  const [selectedPackage, setSelectedPackage] = useState(CREDIT_PACKAGES[1])
  const [isLoading, setIsLoading] = useState(false)
  const [transactionId, setTransactionId] = useState<string | null>(null)
  const { toast } = useToast()

  const handlePurchase = async () => {
    setIsLoading(true)
    setTransactionId(null)
    const result = await createDepositTransaction(selectedPackage.id)
    setIsLoading(false)

    if (result.error) {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive',
      })
    } else if (result.transactionId) {
      setTransactionId(result.transactionId)
      toast({
        title: 'Success',
        description: 'Transaction created. Please complete the payment.',
      })
    }
  }

  return (
    <div className="space-y-8">
      <Toaster />
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Ví của tôi</h2>
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Chọn gói tín dụng</CardTitle>
              <CardDescription>Chọn một gói để nạp tiền vào số dư của bạn.</CardDescription>
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
                    <p className="font-semibold">{pkg.credits} Tín dụng</p>
                    <p className="text-sm text-muted-foreground">
                      {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(pkg.price)}
                    </p>
                  </div>
                  {pkg.popular && (
                    <div className="text-xs font-bold bg-primary text-primary-foreground px-2 py-1 rounded-full">
                      PHỔ BIẾN
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
            <CardFooter>
              <Button onClick={handlePurchase} disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Thanh toán
              </Button>
            </CardFooter>
          </Card>
        </div>
        <div>
          {transactionId ? (
            <Card>
              <CardHeader>
                <CardTitle>Hoàn tất thanh toán</CardTitle>
                <CardDescription>Quét mã QR bằng ứng dụng ngân hàng của bạn để thanh toán.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.vietqr.io/v2/generate?accountNo=YOUR_ACCOUNT_NO&accountName=YOUR_ACCOUNT_NAME&acqId=970408&amount=${selectedPackage.price}&addInfo=${userId}&template=compact`}
                  alt="VietQR Code"
                  width={250}
                  height={250}
                />
                <div className="mt-4 space-y-2 text-sm">
                  <p>
                    <strong>Số tiền:</strong>{' '}
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(selectedPackage.price)}
                  </p>
                  <p>
                    <strong>Nội dung:</strong> {userId}
                  </p>
                  <div className="mt-4 flex items-center justify-center rounded-md bg-yellow-50 p-3 text-yellow-700">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    <p>
                      Giao dịch của bạn đang chờ xử lý. Tín dụng sẽ được cộng sau khi quản trị viên xác nhận.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="flex flex-col items-center justify-center h-full text-center">
              <CardContent>
                <Wallet className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold">Sẵn sàng thanh toán?</h3>
                <p className="text-sm text-muted-foreground">
                  Chọn một gói và nhấp vào &quot;Thanh toán&quot; để tạo mã QR của bạn.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
