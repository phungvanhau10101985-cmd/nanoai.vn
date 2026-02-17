"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import { Wallet, CreditCard, History, PlusCircle, ArrowRight, Zap, TrendingUp } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import Link from 'next/link'
import { formatNumber } from '@/lib/format'
import { DepositCreditButton } from '@/components/deposit-credit-button'

type Payment = {
  id: string
  amount: number
  credits_added: number
  status: string
  created_at: string
}

export default function WalletClient() {
  const [userCredits, setUserCredits] = useState<number>(0)
  const [recentPayments, setRecentPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchWalletData()
  }, [])

  const fetchWalletData = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch user credits
      const { data: creditsData, error: creditsError } = await supabase
        .from('credits')
        .select('balance')
        .eq('user_id', user.id)
        .single()

      if (!creditsError && creditsData) {
        setUserCredits(creditsData.balance || 0)
      }

      // Fetch recent payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('id, amount, credits_added, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (!paymentsError) {
        setRecentPayments(paymentsData || [])
      }
    } catch (error: any) {
      console.error('Error fetching wallet data:', error)
      toast({
        title: 'Lỗi',
        description: 'Không thể tải thông tin ví',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return formatNumber(amount) + '₫'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Thành công</Badge>
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Chờ xử lý</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-6xl mx-auto">
          <div className="mb-10 text-center">
            <h1 className="text-xl sm:text-3xl font-bold flex items-center justify-center gap-2">
              <Wallet className="h-8 w-8" />
              Ví của tôi
            </h1>
            <p className="text-muted-foreground mt-2">
              Quản lý số dư credits và lịch sử giao dịch
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
        {/* Left column - Balance and quick actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Balance card */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Zap className="h-6 w-6 text-blue-600" />
                  Số dư credits
                </span>
                <Badge variant="outline" className="text-blue-600 border-blue-300">
                  1 credit = {formatNumber(6000)}₫
                </Badge>
              </CardTitle>
              <CardDescription>
                Credits dùng để sử dụng dịch vụ thử đồ ảo
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <>
                  <div className="text-center py-6">
                    <div className="text-5xl font-bold text-blue-700 mb-2">
                      {userCredits}
                    </div>
                    <div className="text-lg text-blue-600 font-medium">
                      credits
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">
                      Tương đương {formatCurrency(userCredits * 6000)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <DepositCreditButton
                      variant="default"
                      size="lg"
                      className="h-12"
                      onCreditsUpdated={fetchWalletData}
                    />
                    <Button asChild variant="outline" className="h-12">
                      <Link href="/thu-do-online">
                        <ArrowRight className="mr-2 h-4 w-4" />
                        Sử dụng ngay
                      </Link>
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Recent transactions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Giao dịch gần đây
              </CardTitle>
              <CardDescription>
                5 giao dịch nạp tiền gần nhất
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
                </div>
              ) : recentPayments.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có giao dịch</h3>
                  <p className="text-gray-500 mb-4">
                    Bạn chưa thực hiện giao dịch nạp tiền nào.
                  </p>
                  <DepositCreditButton onCreditsUpdated={fetchWalletData} />
                </div>
              ) : (
                <div className="space-y-4">
                  {recentPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="rounded-full bg-blue-100 p-2">
                          <CreditCard className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{formatCurrency(payment.amount)}</span>
                            {getStatusBadge(payment.status)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Nhận {payment.credits_added} credits • {formatDate(payment.created_at)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-green-600">
                          +{payment.credits_added} credits
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/dashboard/transactions">
                  Xem tất cả giao dịch
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Right column - Stats and info */}
        <div className="space-y-6">
          {/* Usage stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Thống kê sử dụng
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Credits đã sử dụng</span>
                  <span className="font-medium">0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Lần thử đồ</span>
                  <span className="font-medium">0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Tổng đã nạp</span>
                  <span className="font-medium">
                    {formatCurrency(recentPayments
                      .filter(p => p.status === 'completed')
                      .reduce((sum, p) => sum + p.amount, 0))}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Thao tác nhanh</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <DepositCreditButton
                variant="outline"
                className="w-full justify-start"
                onCreditsUpdated={fetchWalletData}
              />
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/dashboard/transactions">
                  <History className="mr-2 h-4 w-4" />
                  Lịch sử giao dịch
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/thu-do-online">
                  <Zap className="mr-2 h-4 w-4" />
                  Thử đồ ngay
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Help card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Cần hỗ trợ?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Nếu có vấn đề với ví hoặc thanh toán:
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <div className="rounded-full bg-blue-100 p-1">
                    <span className="text-xs font-bold text-blue-600 w-4 h-4 flex items-center justify-center">1</span>
                  </div>
                  <span>Kiểm tra lịch sử giao dịch</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="rounded-full bg-blue-100 p-1">
                    <span className="text-xs font-bold text-blue-600 w-4 h-4 flex items-center justify-center">2</span>
                  </div>
                  <span>Liên hệ hỗ trợ nếu cần</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="rounded-full bg-blue-100 p-1">
                    <span className="text-xs font-bold text-blue-600 w-4 h-4 flex items-center justify-center">3</span>
                  </div>
                  <span>Test với số tiền nhỏ trước</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Credit info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Thông tin credits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">1 credit =</span>
                  <span className="font-medium">{formatNumber(6000)}₫</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">1 lần thử đồ =</span>
                  <span className="font-medium">1-5 credits</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Credits không hoàn lại</span>
                  <span className="font-medium text-red-600">✓</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Có thời hạn</span>
                  <span className="font-medium">30 ngày</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom info */}
      <Card className="mt-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <h4 className="font-medium">Credits chưa được cộng?</h4>
              <p className="text-sm text-muted-foreground">
                Hệ thống tự động cộng trong vòng 1-5 phút sau khi chuyển khoản.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Cần nạp gấp?</h4>
              <p className="text-sm text-muted-foreground">
                Nạp ngay để không gián đoạn trải nghiệm thử đồ.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Hỗ trợ 24/7</h4>
              <p className="text-sm text-muted-foreground">
                Liên hệ qua email hoặc hotline nếu cần hỗ trợ.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</div>
  )
}