"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import { History, CreditCard, CheckCircle, Clock, XCircle, Filter, Download } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { formatNumber } from '@/lib/format'
import { DepositCreditButton } from '@/components/deposit-credit-button'

type Payment = {
  id: string
  amount: number
  credits_added: number
  status: string
  bank_name: string
  transaction_content: string
  created_at: string
  completed_at: string | null
}

export default function TransactionsClient() {
  const [uiLocale, setUiLocale] = useState<'vi' | 'en' | 'zh' | 'ja' | 'ko'>('vi')
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const supabase = createClient()
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
    fetchPayments()
    return () => {
      window.removeEventListener('focus', syncLocale)
      document.removeEventListener('visibilitychange', syncLocale)
      window.clearInterval(timer)
    }
  }, [filter])

  const fetchPayments = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let query = supabase
        .from('payments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      // Áp dụng filter
      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      if (error) throw error
      setPayments(data || [])
    } catch (error: unknown) {
      console.error('Error fetching payments:', error)
      toast({
        title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
        description: tr('Không thể tải lịch sử giao dịch', 'Cannot load transaction history', '无法加载交易记录', '取引履歴を読み込めません', '거래 내역을 불러올 수 없습니다'),
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
            <CheckCircle className="mr-1 h-3 w-3" />
            {tr('Thành công', 'Success', '成功', '成功', '성공')}
          </Badge>
        )
      case 'pending':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
            <Clock className="mr-1 h-3 w-3" />
            {tr('Chờ xử lý', 'Pending', '处理中', '保留中', '처리 대기')}
          </Badge>
        )
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            {tr('Thất bại', 'Failed', '失败', '失敗', '실패')}
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (amount: number) => {
    return formatNumber(amount) + '₫'
  }

  const handleExportCSV = () => {
    // Tạo CSV content
    const headers = [tr('ID', 'ID', 'ID', 'ID', 'ID'), tr('Ngày giao dịch', 'Transaction date', '交易日期', '取引日', '거래일'), tr('Số tiền', 'Amount', '金额', '金額', '금액'), 'Credits', tr('Ngân hàng', 'Bank', '银行', '銀行', '은행'), tr('Trạng thái', 'Status', '状态', '状態', '상태'), tr('Nội dung', 'Note', '内容', '内容', '내용')]
    const rows = payments.map(payment => [
      payment.id.slice(0, 8),
      formatDate(payment.created_at),
      formatCurrency(payment.amount),
      payment.credits_added.toString(),
      payment.bank_name,
      payment.status === 'completed' ? tr('Thành công', 'Success', '成功', '成功', '성공') : 
      payment.status === 'pending' ? tr('Chờ xử lý', 'Pending', '处理中', '保留中', '처리 대기') : tr('Thất bại', 'Failed', '失败', '失敗', '실패'),
      payment.transaction_content || ''
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    // Tạo blob và download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', `lich-su-giao-dich-${new Date().toISOString().slice(0, 10)}.csv`)
    link.style.visibility = 'hidden'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: tr('Thành công', 'Success', '成功', '成功', '성공'),
      description: tr('Đã xuất file CSV', 'CSV exported', 'CSV 已导出', 'CSVをエクスポートしました', 'CSV를 내보냈습니다'),
    })
  }

  const totalSpent = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, payment) => sum + payment.amount, 0)

  const totalCredits = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, payment) => sum + payment.credits_added, 0)

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-6xl mx-auto">
          <div className="mb-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <History className="h-8 w-8" />
                  {tr('Lịch sử giao dịch', 'Transaction history', '交易记录', '取引履歴', '거래 내역')}
                </h1>
                <p className="text-muted-foreground mt-2">
                  {tr('Xem lịch sử nạp tiền và sử dụng credits của bạn', 'View your top-up and credit usage history', '查看你的充值和积分使用记录', 'チャージとクレジット利用履歴を確認', '충전 및 크레딧 사용 내역 보기')}
                </p>
              </div>
              
              <Button onClick={handleExportCSV} variant="outline" className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" />
                {tr('Xuất CSV', 'Export CSV', '导出 CSV', 'CSV出力', 'CSV 내보내기')}
              </Button>
            </div>
          </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{tr('Tổng đã nạp', 'Total topped up', '累计充值', '累計チャージ', '총 충전 금액')}</p>
                <p className="text-2xl font-bold">{formatCurrency(totalSpent)}</p>
              </div>
              <div className="rounded-full bg-blue-100 p-3">
                <CreditCard className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{tr('Tổng credits nhận', 'Total credits received', '累计获得积分', '受け取ったクレジット合計', '총 수령 크레딧')}</p>
                <p className="text-2xl font-bold">{totalCredits} credits</p>
              </div>
              <div className="rounded-full bg-green-100 p-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{tr('Tổng giao dịch', 'Total transactions', '交易总数', '取引合計', '총 거래 수')}</p>
                <p className="text-2xl font-bold">{payments.length}</p>
              </div>
              <div className="rounded-full bg-purple-100 p-3">
                <History className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and transactions list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{tr('Chi tiết giao dịch', 'Transaction details', '交易明细', '取引詳細', '거래 상세')}</CardTitle>
              <CardDescription>
                {payments.length} {tr('giao dịch được tìm thấy', 'transactions found', '条交易', '件の取引', '건의 거래')}
              </CardDescription>
            </div>
            
            <Tabs value={filter} onValueChange={setFilter} className="w-auto">
              <TabsList>
                <TabsTrigger value="all">{tr('Tất cả', 'All', '全部', 'すべて', '전체')}</TabsTrigger>
                <TabsTrigger value="completed">{tr('Thành công', 'Success', '成功', '成功', '성공')}</TabsTrigger>
                <TabsTrigger value="pending">{tr('Chờ xử lý', 'Pending', '处理中', '保留中', '처리 대기')}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">{tr('Chưa có giao dịch nào', 'No transactions yet', '暂无交易', '取引はまだありません', '거래 내역이 없습니다')}</h3>
              <p className="text-gray-500">
                {filter === 'all' 
                  ? tr('Bạn chưa thực hiện giao dịch nạp tiền nào.', 'You have not made any top-up transaction yet.', '你还没有进行过充值交易。', 'まだチャージ取引がありません。', '아직 충전 거래가 없습니다.')
                  : `${tr('Không có giao dịch', 'No', '没有', '該当する', '해당')} ${filter === 'completed' ? tr('thành công', 'successful transactions', '成功交易', '成功取引', '성공 거래') : tr('chờ xử lý', 'pending transactions', '处理中交易', '保留中の取引', '대기 거래')}.`}
              </p>
              <DepositCreditButton className="mt-4" />
            </div>
          ) : (
            <div className="space-y-4">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getStatusBadge(payment.status)}
                      <span className="text-sm text-muted-foreground">
                        {formatDate(payment.created_at)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">{tr('Số tiền', 'Amount', '金额', '金額', '금액')}</p>
                        <p className="font-semibold">{formatCurrency(payment.amount)}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-muted-foreground">{tr('Credits nhận', 'Credits received', '获得积分', '受領クレジット', '수령 크레딧')}</p>
                        <p className="font-semibold text-green-600">{payment.credits_added} credits</p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-muted-foreground">{tr('Ngân hàng', 'Bank', '银行', '銀行', '은행')}</p>
                        <p className="font-medium">{payment.bank_name}</p>
                      </div>
                    </div>
                    
                    {payment.transaction_content && (
                      <div className="mt-2">
                        <p className="text-sm text-muted-foreground">{tr('Nội dung', 'Note', '内容', '内容', '내용')}</p>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                          {payment.transaction_content}
                        </code>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-4 sm:mt-0 sm:ml-4">
                    {payment.status === 'pending' ? (
                      <DepositCreditButton variant="outline" size="sm" />
                    ) : (
                      <span className="text-sm text-muted-foreground">{tr('Đã hoàn thành', 'Completed', '已完成', '完了', '완료')}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex flex-col sm:flex-row items-center justify-between border-t pt-6">
          <div className="text-sm text-muted-foreground mb-4 sm:mb-0">
            {tr('Hiển thị', 'Showing', '显示', '表示', '표시')} {payments.length} {tr('giao dịch', 'transactions', '条交易', '件の取引', '건의 거래')}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPayments}
              disabled={loading}
            >
              <Filter className="mr-2 h-3 w-3" />
              {tr('Làm mới', 'Refresh', '刷新', '更新', '새로고침')}
            </Button>
            
            <DepositCreditButton size="sm" />
          </div>
        </CardFooter>
      </Card>

      {/* Help section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-sm">{tr('Cần hỗ trợ?', 'Need help?', '需要帮助？', 'サポートが必要ですか？', '도움이 필요하신가요?')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">{tr('Giao dịch chưa được cập nhật?', 'Transaction not updated?', '交易未更新？', '取引が更新されない？', '거래가 업데이트되지 않았나요?')}</h4>
              <p className="text-sm text-muted-foreground">
                {tr('Hệ thống tự động cập nhật trong vòng 1-5 phút sau khi chuyển khoản.', 'System updates automatically within 1-5 minutes after transfer.', '转账后系统会在1-5分钟内自动更新。', '振込後1〜5分で自動更新されます。', '이체 후 1~5분 내 자동 업데이트됩니다.')}
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">{tr('Sai nội dung chuyển khoản?', 'Wrong transfer note?', '转账备注错误？', '振込内容を間違えた？', '입금 내용이 잘못되었나요?')}</h4>
              <p className="text-sm text-muted-foreground">
                {tr('Liên hệ hỗ trợ với mã giao dịch và thông tin chuyển khoản.', 'Contact support with transaction ID and transfer details.', '请携带交易号与转账信息联系支持。', '取引IDと振込情報を添えてサポートへ連絡してください。', '거래 ID와 이체 정보로 지원팀에 문의하세요.')}
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">{tr('Credits chưa được cộng?', 'Credits not added?', '积分未到账？', 'クレジットが反映されない？', '크레딧이 아직 안 들어왔나요?')}</h4>
              <p className="text-sm text-muted-foreground">
                {tr('Kiểm tra lại nội dung chuyển khoản và liên hệ hỗ trợ nếu cần.', 'Check transfer note again and contact support if needed.', '请再次检查转账备注，必要时联系支持。', '振込内容を再確認し、必要ならサポートへ連絡してください。', '입금 내용을 다시 확인하고 필요 시 지원팀에 문의하세요.')}
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