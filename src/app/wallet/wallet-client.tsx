"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getClientUserId } from '@/lib/auth/get-client-user-id'
import { Wallet, CreditCard, History, ArrowRight, Zap, TrendingUp } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import Link from 'next/link'
import { formatNumber } from '@/lib/format'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { CREDIT_UNIT_PRICE_VND } from '@/lib/credit-unit-price'

type Payment = {
  id: string
  amount: number
  credits_added: number
  status: string
  created_at: string
}

export default function WalletClient() {
  const [uiLocale, setUiLocale] = useState<'vi' | 'en' | 'zh' | 'ja' | 'ko'>('vi')
  const [userCredits, setUserCredits] = useState<number>(0)
  const [recentPayments, setRecentPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  useEffect(() => {
    const syncLocale = () => {
      const cookieValue = document.cookie
        .split(';')
        .map((x) => x.trim())
        .find((x) => x.startsWith('nanoai_locale='))
        ?.split('=')[1]
        ?.trim()
        .toLowerCase()
      if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') setUiLocale(cookieValue)
      else setUiLocale('vi')
    }
    syncLocale()
    const timer = window.setInterval(syncLocale, 1000)
    window.addEventListener('focus', syncLocale)
    document.addEventListener('visibilitychange', syncLocale)
    fetchWalletData()
    return () => {
      window.removeEventListener('focus', syncLocale)
      document.removeEventListener('visibilitychange', syncLocale)
      window.clearInterval(timer)
    }
  }, [])

  const fetchWalletData = async () => {
    setLoading(true)
    try {
      const uid = await getClientUserId()
      if (!uid) return

      const creditsRes = await fetch('/api/account/credits', { credentials: 'same-origin' })
      if (creditsRes.ok) {
        const j = (await creditsRes.json()) as { balance?: number }
        setUserCredits(Number(j.balance) || 0)
      }

      const payRes = await fetch('/api/account/payments?limit=5', { credentials: 'same-origin' })
      if (payRes.ok) {
        const j = (await payRes.json()) as { payments?: Payment[] }
        setRecentPayments(j.payments || [])
      }
    } catch (error: unknown) {
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
        return <Badge className="bg-green-100 text-green-800">{tr('Thành công', 'Success', '成功', '成功', '성공')}</Badge>
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">{tr('Chờ xử lý', 'Pending', '处理中', '保留中', '처리 대기')}</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-8 xl:p-10">
        <div className="mx-auto w-full max-w-6xl xl:max-w-7xl">
          <div className="mb-10 text-center lg:mb-12">
            <h1 className="flex items-center justify-center gap-2 text-xl font-bold sm:text-3xl lg:gap-3 lg:text-4xl">
              <Wallet className="h-8 w-8" />
              {tr('Ví của tôi', 'My wallet', '我的钱包', 'マイウォレット', '내 지갑')}
            </h1>
            <p className="mt-2 text-muted-foreground lg:mt-3 lg:text-[15px]">
              {tr('Quản lý số dư credits và lịch sử giao dịch', 'Manage credit balance and transaction history', '管理积分余额与交易记录', 'クレジット残高と取引履歴を管理', '크레딧 잔액과 거래 내역 관리')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-7 lg:grid-cols-3 xl:gap-8">
        {/* Left column - Balance and quick actions */}
        <div className="space-y-6 lg:col-span-2 lg:space-y-7">
          {/* Balance card */}
          <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 lg:shadow-md lg:shadow-blue-500/5">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Zap className="h-6 w-6 text-blue-600" />
                  {tr('Số dư credits', 'Credit balance', '积分余额', 'クレジット残高', '크레딧 잔액')}
                </span>
                <Badge variant="outline" className="text-blue-600 border-blue-300">
                  1 credit = {formatNumber(CREDIT_UNIT_PRICE_VND)}₫
                </Badge>
              </CardTitle>
              <CardDescription>
                {tr('Credits dùng để sử dụng dịch vụ thử đồ ảo', 'Credits are used for virtual try-on services', '积分用于虚拟试衣服务', 'クレジットはバーチャル試着サービスで使用します', '크레딧은 가상 피팅 서비스에 사용됩니다')}
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
                      {tr('Tương đương', 'Equivalent to', '约等于', '相当', '환산 금액')}{' '}
                      {formatCurrency(userCredits * CREDIT_UNIT_PRICE_VND)}
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
                        {tr('Sử dụng ngay', 'Use now', '立即使用', '今すぐ使う', '지금 사용')}
                      </Link>
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Recent transactions */}
          <Card className="lg:border-border/70 lg:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                {tr('Giao dịch gần đây', 'Recent transactions', '最近交易', '最近の取引', '최근 거래')}
              </CardTitle>
              <CardDescription>
                {tr('5 giao dịch nạp tiền gần nhất', 'Latest 5 top-up transactions', '最近 5 笔充值交易', '直近5件のチャージ取引', '최근 5건 충전 거래')}
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
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{tr('Chưa có giao dịch', 'No transactions yet', '暂无交易', '取引はまだありません', '거래 내역이 없습니다')}</h3>
                  <p className="text-gray-500 mb-4">
                    {tr('Bạn chưa thực hiện giao dịch nạp tiền nào.', 'You have not made any top-up transaction yet.', '你还没有进行过充值交易。', 'まだチャージ取引がありません。', '아직 충전 거래가 없습니다.')}
                  </p>
                  <DepositCreditButton onCreditsUpdated={fetchWalletData} />
                </div>
              ) : (
                <div className="space-y-4">
                  {recentPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-gray-50 lg:rounded-xl lg:border-border/60 lg:p-5 lg:shadow-sm lg:hover:bg-muted/40"
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
                            {tr('Nhận', 'Received', '获得', '受領', '수령')} {payment.credits_added} credits • {formatDate(payment.created_at)}
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
                  {tr('Xem tất cả giao dịch', 'View all transactions', '查看全部交易', 'すべての取引を見る', '모든 거래 보기')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Right column - Stats and info */}
        <div className="space-y-6 lg:space-y-7">
          {/* Usage stats */}
          <Card className="lg:border-border/70 lg:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {tr('Thống kê sử dụng', 'Usage stats', '使用统计', '利用統計', '사용 통계')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{tr('Credits đã sử dụng', 'Credits used', '已使用积分', '使用済みクレジット', '사용한 크레딧')}</span>
                  <span className="font-medium">0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{tr('Lần thử đồ', 'Try-on count', '试衣次数', '試着回数', '피팅 횟수')}</span>
                  <span className="font-medium">0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{tr('Tổng đã nạp', 'Total topped up', '累计充值', '累計チャージ', '총 충전 금액')}</span>
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
          <Card className="lg:border-border/70 lg:shadow-md">
            <CardHeader>
              <CardTitle className="text-sm">{tr('Thao tác nhanh', 'Quick actions', '快捷操作', 'クイック操作', '빠른 작업')}</CardTitle>
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
                  {tr('Lịch sử giao dịch', 'Transaction history', '交易记录', '取引履歴', '거래 내역')}
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/thu-do-online">
                  <Zap className="mr-2 h-4 w-4" />
                  {tr('Thử đồ ngay', 'Try on now', '立即试衣', '今すぐ試着', '지금 피팅')}
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Help card */}
          <Card className="lg:border-border/70 lg:shadow-md">
            <CardHeader>
              <CardTitle className="text-sm">{tr('Cần hỗ trợ?', 'Need help?', '需要帮助？', 'サポートが必要ですか？', '도움이 필요하신가요?')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                {tr('Nếu có vấn đề với ví hoặc thanh toán:', 'If you have issues with wallet or payment:', '如果钱包或支付有问题：', 'ウォレットや支払いで問題がある場合：', '지갑 또는 결제 문제 발생 시:')}
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <div className="rounded-full bg-blue-100 p-1">
                    <span className="text-xs font-bold text-blue-600 w-4 h-4 flex items-center justify-center">1</span>
                  </div>
                  <span>{tr('Kiểm tra lịch sử giao dịch', 'Check transaction history', '查看交易记录', '取引履歴を確認', '거래 내역 확인')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="rounded-full bg-blue-100 p-1">
                    <span className="text-xs font-bold text-blue-600 w-4 h-4 flex items-center justify-center">2</span>
                  </div>
                  <span>{tr('Liên hệ hỗ trợ nếu cần', 'Contact support if needed', '如有需要请联系支持', '必要に応じてサポートへ連絡', '필요 시 지원팀 문의')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="rounded-full bg-blue-100 p-1">
                    <span className="text-xs font-bold text-blue-600 w-4 h-4 flex items-center justify-center">3</span>
                  </div>
                  <span>{tr('Test với số tiền nhỏ trước', 'Test with a small amount first', '先用小额测试', 'まず少額でテスト', '먼저 소액으로 테스트')}</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Credit info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{tr('Thông tin credits', 'Credit info', '积分信息', 'クレジット情報', '크레딧 정보')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">1 credit =</span>
                  <span className="font-medium">{formatNumber(CREDIT_UNIT_PRICE_VND)}₫</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{tr('1 lần thử đồ =', '1 try-on =', '1次试衣 =', '1回の試着 =', '1회 피팅 =')}</span>
                  <span className="font-medium">1-5 credits</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{tr('Credits không hoàn lại', 'Credits are non-refundable', '积分不可退款', 'クレジットは返金不可', '크레딧 환불 불가')}</span>
                  <span className="font-medium text-red-600">✓</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{tr('Có thời hạn', 'Has expiration', '有有效期', '有効期限あり', '유효기간 있음')}</span>
                  <span className="font-medium">{tr('30 ngày', '30 days', '30天', '30日', '30일')}</span>
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
              <h4 className="font-medium">{tr('Credits chưa được cộng?', 'Credits not added yet?', '积分还没到账？', 'クレジットが反映されない？', '크레딧이 아직 안 들어왔나요?')}</h4>
              <p className="text-sm text-muted-foreground">
                {tr('Hệ thống tự động cộng trong vòng 1-5 phút sau khi chuyển khoản.', 'System auto-adds within 1-5 minutes after transfer.', '转账后系统会在1-5分钟内自动到账。', '振込後1〜5分で自動反映されます。', '이체 후 1~5분 내 자동 반영됩니다.')}
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">{tr('Cần nạp gấp?', 'Need urgent top-up?', '急需充值？', '急ぎでチャージが必要？', '급하게 충전이 필요한가요?')}</h4>
              <p className="text-sm text-muted-foreground">
                {tr('Nạp ngay để không gián đoạn trải nghiệm thử đồ.', 'Top up now to avoid interrupting your try-on experience.', '立即充值，避免中断试衣体验。', '今すぐチャージして試着体験を中断しないように。', '지금 충전해 피팅 경험이 끊기지 않도록 하세요.')}
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">{tr('Hỗ trợ 24/7', '24/7 Support', '7x24 支持', '24時間サポート', '24/7 지원')}</h4>
              <p className="text-sm text-muted-foreground">
                {tr('Liên hệ qua email hoặc hotline nếu cần hỗ trợ.', 'Contact via email or hotline if you need support.', '如需帮助，请通过邮箱或热线联系。', 'サポートが必要な場合はメールまたはホットラインへ。', '도움이 필요하면 이메일/핫라인으로 문의하세요.')}
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