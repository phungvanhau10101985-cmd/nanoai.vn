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
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const supabase = createClient()

  useEffect(() => {
    fetchPayments()
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
        title: 'Lỗi',
        description: 'Không thể tải lịch sử giao dịch',
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
            Thành công
          </Badge>
        )
      case 'pending':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
            <Clock className="mr-1 h-3 w-3" />
            Chờ xử lý
          </Badge>
        )
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Thất bại
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
    const headers = ['ID', 'Ngày giao dịch', 'Số tiền', 'Credits', 'Ngân hàng', 'Trạng thái', 'Nội dung']
    const rows = payments.map(payment => [
      payment.id.slice(0, 8),
      formatDate(payment.created_at),
      formatCurrency(payment.amount),
      payment.credits_added.toString(),
      payment.bank_name,
      payment.status === 'completed' ? 'Thành công' : 
      payment.status === 'pending' ? 'Chờ xử lý' : 'Thất bại',
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
      title: 'Thành công',
      description: 'Đã xuất file CSV',
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
                  Lịch sử giao dịch
                </h1>
                <p className="text-muted-foreground mt-2">
                  Xem lịch sử nạp tiền và sử dụng credits của bạn
                </p>
              </div>
              
              <Button onClick={handleExportCSV} variant="outline" className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" />
                Xuất CSV
              </Button>
            </div>
          </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tổng đã nạp</p>
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
                <p className="text-sm text-muted-foreground">Tổng credits nhận</p>
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
                <p className="text-sm text-muted-foreground">Tổng giao dịch</p>
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
              <CardTitle>Chi tiết giao dịch</CardTitle>
              <CardDescription>
                {payments.length} giao dịch được tìm thấy
              </CardDescription>
            </div>
            
            <Tabs value={filter} onValueChange={setFilter} className="w-auto">
              <TabsList>
                <TabsTrigger value="all">Tất cả</TabsTrigger>
                <TabsTrigger value="completed">Thành công</TabsTrigger>
                <TabsTrigger value="pending">Chờ xử lý</TabsTrigger>
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
              <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có giao dịch nào</h3>
              <p className="text-gray-500">
                {filter === 'all' 
                  ? 'Bạn chưa thực hiện giao dịch nạp tiền nào.' 
                  : `Không có giao dịch ${filter === 'completed' ? 'thành công' : 'chờ xử lý'}.`}
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
                        <p className="text-sm text-muted-foreground">Số tiền</p>
                        <p className="font-semibold">{formatCurrency(payment.amount)}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-muted-foreground">Credits nhận</p>
                        <p className="font-semibold text-green-600">{payment.credits_added} credits</p>
                      </div>
                      
                      <div>
                        <p className="text-sm text-muted-foreground">Ngân hàng</p>
                        <p className="font-medium">{payment.bank_name}</p>
                      </div>
                    </div>
                    
                    {payment.transaction_content && (
                      <div className="mt-2">
                        <p className="text-sm text-muted-foreground">Nội dung</p>
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
                      <span className="text-sm text-muted-foreground">Đã hoàn thành</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex flex-col sm:flex-row items-center justify-between border-t pt-6">
          <div className="text-sm text-muted-foreground mb-4 sm:mb-0">
            Hiển thị {payments.length} giao dịch
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPayments}
              disabled={loading}
            >
              <Filter className="mr-2 h-3 w-3" />
              Làm mới
            </Button>
            
            <DepositCreditButton size="sm" />
          </div>
        </CardFooter>
      </Card>

      {/* Help section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-sm">Cần hỗ trợ?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Giao dịch chưa được cập nhật?</h4>
              <p className="text-sm text-muted-foreground">
                Hệ thống tự động cập nhật trong vòng 1-5 phút sau khi chuyển khoản.
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Sai nội dung chuyển khoản?</h4>
              <p className="text-sm text-muted-foreground">
                Liên hệ hỗ trợ với mã giao dịch và thông tin chuyển khoản.
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Credits chưa được cộng?</h4>
              <p className="text-sm text-muted-foreground">
                Kiểm tra lại nội dung chuyển khoản và liên hệ hỗ trợ nếu cần.
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