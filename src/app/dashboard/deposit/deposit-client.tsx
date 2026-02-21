"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { CreditCard, QrCode, Banknote, CheckCircle, Copy, RefreshCw, AlertCircle } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { formatNumber } from '@/lib/format'
import { buildSePayQrImgUrl } from '@/lib/sepay-qr'
import { isLocalhost, getDevUserId } from '@/lib/auth-client'

type PaymentConfig = {
  id: string
  bank_account: string
  bank_id: string
  bank_name: string
  account_holder_name?: string
  qr_template_url: string
  is_active: boolean
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
  created_at: string
}

export default function DepositClient() {
  const [amount, setAmount] = useState<number>(6000)
  const [selectedBank, setSelectedBank] = useState<string>('')
  const [paymentConfigs, setPaymentConfigs] = useState<PaymentConfig[]>([])
  const [activePayment, setActivePayment] = useState<Payment | null>(null)
  const [loading, setLoading] = useState(false)
  const [userCredits, setUserCredits] = useState<number>(0)
  const supabase = createClient()

  const generateTransferContent = () => {
    // SePay content format: "SEVQR " + PREFIX + integer suffix.
    // Example: SEVQR DH1111111111
    const rawPrefix = (process.env.NEXT_PUBLIC_SEPAY_CONTENT_PREFIX || 'DH').toUpperCase()
    const prefix = rawPrefix.replace(/[^A-Z0-9]/g, '').slice(0, 5) || 'DH'

    const minLengthEnv = Number(process.env.NEXT_PUBLIC_SEPAY_CONTENT_SUFFIX_MIN_LENGTH || '1')
    const maxLengthEnv = Number(process.env.NEXT_PUBLIC_SEPAY_CONTENT_SUFFIX_MAX_LENGTH || '10')
    const minLength = Number.isFinite(minLengthEnv) ? Math.max(1, Math.min(10, Math.floor(minLengthEnv))) : 1
    const maxLength = Number.isFinite(maxLengthEnv) ? Math.max(minLength, Math.min(10, Math.floor(maxLengthEnv))) : 10
    const suffixLength = maxLength

    const maxValue = 10 ** suffixLength - 1
    const randomNumber = Math.floor(Math.random() * (maxValue + 1))
    const suffix = randomNumber.toString().padStart(suffixLength, '0')

    return `SEVQR ${prefix}${suffix}`
  }

  const buildSePayQrUrl = (bankAccount: string, bankId: string, amountValue: number, content: string, templateUrl?: string) => {
    const baseOptions = { acc: bankAccount, bank: bankId, amount: amountValue, des: content }
    if (!templateUrl) return buildSePayQrImgUrl(baseOptions)
    try {
      const replaced = templateUrl
        .replace('{bank_acc}', bankAccount)
        .replace('{bank_id}', bankId)
        .replace('{amount}', String(amountValue))
        .replace('{content}', content)
      const parsed = new URL(replaced)
      parsed.searchParams.set('acc', bankAccount)
      parsed.searchParams.set('bank', bankId)
      parsed.searchParams.set('amount', String(amountValue))
      parsed.searchParams.set('des', content)
      return parsed.toString()
    } catch {
      return buildSePayQrImgUrl(baseOptions)
    }
  }

  useEffect(() => {
    fetchPaymentConfigs()
    fetchUserCredits()
  }, [])

  const fetchPaymentConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_configs')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true })

      if (error) throw error
      
      setPaymentConfigs(data || [])
      if (data && data.length > 0) {
        setSelectedBank(data[0].id)
      }
    } catch (error) {
      console.error('Error fetching payment configs:', error)
      toast({
        title: 'Lỗi',
        description: 'Không thể tải cấu hình thanh toán',
        variant: 'destructive'
      })
    }
  }

  const fetchUserCredits = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('credits')
        .select('balance')
        .eq('user_id', user.id)
        .single()

      if (error) throw error
      setUserCredits(data?.balance || 0)
    } catch (error) {
      console.error('Error fetching user credits:', error)
    }
  }

  const handleCreatePayment = async () => {
    if (!selectedBank) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng chọn ngân hàng',
        variant: 'destructive'
      })
      return
    }

    if (amount < 1000) {
      toast({
        title: 'Lỗi',
        description: `Số tiền tối thiểu là ${formatNumber(1000)} VND`,
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? (isLocalhost() ? getDevUserId() : null)
      if (!userId) {
        toast({ title: 'Lỗi', description: 'Vui lòng đăng nhập để nạp tiền.', variant: 'destructive' })
        setLoading(false)
        return
      }

      const selectedConfig = paymentConfigs.find(config => config.id === selectedBank)
      if (!selectedConfig) throw new Error('Bank config not found')

      // Tính số credits sẽ được cộng (6000 VND = 1 credit)
      const creditsToAdd = Math.floor(amount / 6000)

      // Tạo nội dung chuyển khoản riêng cho từng giao dịch.
      const content = generateTransferContent()
      const qrUrl = buildSePayQrUrl(
        selectedConfig.bank_account,
        selectedConfig.bank_id,
        amount,
        content,
        selectedConfig.qr_template_url
      )

      // Tạo payment record
      const { data: payment, error } = await supabase
        .from('payments')
        .insert({
          user_id: userId,
          amount: amount,
          credits_added: creditsToAdd,
          transaction_content: content,
          bank_account: selectedConfig.bank_account,
          bank_name: selectedConfig.bank_name,
          qr_url: qrUrl,
          status: 'pending'
        })
        .select()
        .single()

      if (error) throw error

      setActivePayment(payment)
      toast({
        title: 'Thành công',
        description: 'Đã tạo mã QR thanh toán',
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Không thể tạo thanh toán'
      console.error('Error creating payment:', error)
      toast({
        title: 'Lỗi',
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCopyContent = async () => {
    if (!activePayment) return
    
    try {
      // Lấy nội dung từ payment đã tạo
      const content = activePayment.transaction_content
      if (!content) {
        throw new Error('Không tìm thấy nội dung chuyển khoản')
      }
      
      await navigator.clipboard.writeText(content)
      toast({
        title: 'Đã sao chép',
        description: 'Nội dung chuyển khoản đã được sao chép',
      })
    } catch (error) {
      console.error('Error copying content:', error)
      toast({
        title: 'Lỗi',
        description: 'Không thể sao chép nội dung',
        variant: 'destructive'
      })
    }
  }

  const handleCopyBankAccount = async (bankAccount: string) => {
    try {
      await navigator.clipboard.writeText(bankAccount)
      toast({
        title: 'Đã sao chép',
        description: 'Số tài khoản đã được sao chép',
      })
    } catch (error) {
      console.error('Error copying bank account:', error)
      toast({
        title: 'Lỗi',
        description: 'Không thể sao chép số tài khoản',
        variant: 'destructive'
      })
    }
  }

  const handleRefreshPayment = () => {
    if (activePayment) {
      fetchPaymentStatus(activePayment.id)
    }
  }

  const fetchPaymentStatus = async (paymentId: string) => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single()

      if (error) throw error

      if (data.status === 'completed') {
        setActivePayment(data)
        fetchUserCredits()
        toast({
          title: 'Thành công',
          description: `Đã nạp thành công ${data.credits_added} credits!`,
        })
      } else {
        setActivePayment(data)
      }
    } catch (error) {
      console.error('Error fetching payment status:', error)
    }
  }

  const presetAmounts = [6000, 12000, 30000, 60000, 120000]

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-4xl mx-auto">
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-bold">Nạp tiền</h1>
            <p className="text-muted-foreground mt-2">
              Nạp tiền để nhận credits sử dụng dịch vụ thử đồ ảo
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
            {/* Left column - Payment info */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Thông tin thanh toán
                  </CardTitle>
                  <CardDescription>
                    Chọn số tiền và phương thức thanh toán
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Current credits */}
                  <div className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Số dư hiện tại</p>
                        <p className="text-2xl font-bold text-blue-700">{userCredits} credits</p>
                      </div>
                      <Badge variant="outline" className="text-blue-600 border-blue-300">
                        1 credit = {formatNumber(6000)} VND
                      </Badge>
                    </div>
                  </div>

                  {/* Amount selection */}
                  <div className="space-y-3">
                    <Label>Số tiền nạp (VND)</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                      {presetAmounts.map((preset) => (
                        <Button
                          key={preset}
                          type="button"
                          variant={amount === preset ? "default" : "outline"}
                          onClick={() => setAmount(preset)}
                          className="h-12"
                        >
                          {formatNumber(preset)}₫
                        </Button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        min="1000"
                        step="1000"
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">VND</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Sẽ nhận được: <span className="font-semibold text-green-600">
                        {Math.floor(amount / 6000)} credits
                      </span>
                    </p>
                  </div>

                  {/* Bank selection */}
                  <div className="space-y-3">
                    <Label>Chọn ngân hàng</Label>
                    <Tabs defaultValue={paymentConfigs[0]?.id} value={selectedBank} onValueChange={setSelectedBank}>
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value={paymentConfigs[0]?.id || ''}>MB Bank</TabsTrigger>
                        <TabsTrigger value={paymentConfigs[1]?.id || ''}>Vietcombank</TabsTrigger>
                      </TabsList>
                      
                      {paymentConfigs.map((config) => (
                        <TabsContent key={config.id} value={config.id} className="space-y-3">
                          <div className="rounded-lg border p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Banknote className="h-4 w-4 text-green-600" />
                                <span className="font-medium">{config.bank_name}</span>
                              </div>
                              <Badge variant="secondary">Đang hoạt động</Badge>
                            </div>
                            
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Số tài khoản:</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-semibold">{config.bank_account}</span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleCopyBankAccount(config.bank_account)}
                                    className="h-6 w-6 p-0"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Chủ tài khoản:</span>
                                <span className="font-medium">Tên chủ tài khoản của bạn</span>
                              </div>
                            </div>
                          </div>
                        </TabsContent>
                      ))}
                    </Tabs>
                  </div>

                  {/* Create payment button */}
                  <Button
                    type="button"
                    onClick={() => {
                      if (loading) return
                      if (!selectedBank) {
                        toast({ title: 'Đang tải', description: 'Vui lòng chờ cấu hình ngân hàng tải xong.', variant: 'destructive' })
                        return
                      }
                      handleCreatePayment()
                    }}
                    disabled={loading}
                    className="w-full min-h-[52px] h-12 text-lg touch-manipulation select-none relative z-10"
                    size="lg"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Đang xử lý...
                      </>
                    ) : (
                      <>
                        <QrCode className="mr-2 h-5 w-5" />
                        Tạo mã QR thanh toán
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Instructions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Hướng dẫn thanh toán
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="rounded-full bg-blue-100 p-1 mt-0.5">
                        <span className="text-xs font-bold text-blue-600 w-4 h-4 flex items-center justify-center">1</span>
                      </div>
                      <p className="text-sm">Chọn số tiền và ngân hàng nhận tiền</p>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <div className="rounded-full bg-blue-100 p-1 mt-0.5">
                        <span className="text-xs font-bold text-blue-600 w-4 h-4 flex items-center justify-center">2</span>
                      </div>
                      <p className="text-sm">Quét mã QR hoặc chuyển khoản đến số tài khoản trên</p>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <div className="rounded-full bg-blue-100 p-1 mt-0.5">
                        <span className="text-xs font-bold text-blue-600 w-4 h-4 flex items-center justify-center">3</span>
                      </div>
                      <p className="text-sm">
                        <span className="font-semibold">QUAN TRỌNG:</span> Ghi nội dung{' '}
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">hệ thống cung cấp</code>{' '}
                        khi chuyển khoản
                      </p>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <div className="rounded-full bg-blue-100 p-1 mt-0.5">
                        <span className="text-xs font-bold text-blue-600 w-4 h-4 flex items-center justify-center">4</span>
                      </div>
                      <p className="text-sm">Hệ thống sẽ tự động cộng credits trong vòng 1-5 phút</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right column - QR Code and active payment */}
            <div className="space-y-6">
              {activePayment ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <QrCode className="h-5 w-5" />
                        Mã QR thanh toán
                      </span>
                      <Badge variant={activePayment.status === 'completed' ? 'default' : 'secondary'}>
                        {activePayment.status === 'completed' ? 'Đã thanh toán' : 'Chờ thanh toán'}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Quét mã QR bằng ứng dụng ngân hàng của bạn
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* QR Code */}
                    <div className="flex justify-center">
                      <div className="border-2 border-gray-200 rounded-lg p-4 bg-white">
                        <img
                          src={activePayment.qr_url}
                          alt="QR Code"
                          className="w-64 h-64"
                        />
                      </div>
                    </div>

                    {/* Payment details */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Ngân hàng:</span>
                        <span className="font-medium">{activePayment.bank_name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Chủ tài khoản:</span>
                        <span className="font-medium">
                          {paymentConfigs.find(c => c.id === selectedBank)?.account_holder_name || '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Số tài khoản:</span>
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                            {activePayment.bank_account}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyBankAccount(activePayment.bank_account || '')}
                            className="h-8 w-8 p-0"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Số tiền:</span>
                        <span className="font-bold text-lg">{formatNumber(activePayment.amount)}₫</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-muted-foreground">Nội dung CK:</span>
                        <span className="font-mono font-semibold break-all text-right">
                          {activePayment.transaction_content || '---'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Sẽ nhận:</span>
                        <span className="font-bold text-green-600">{activePayment.credits_added} credits</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Trạng thái:</span>
                        <span className={`font-medium ${
                          activePayment.status === 'completed' ? 'text-green-600' : 
                          activePayment.status === 'pending' ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {activePayment.status === 'completed' ? '✅ Đã thanh toán' : 
                           activePayment.status === 'pending' ? '⏳ Chờ thanh toán' : '❌ Thất bại'}
                        </span>
                      </div>
                    </div>

                    {/* Nội dung chuyển khoản */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Nội dung chuyển khoản:</span>
                        <span className="text-sm font-medium text-blue-600">(Bắt buộc)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                          <code className="text-sm font-mono text-gray-800">
                            {activePayment.transaction_content}
                          </code>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCopyContent}
                          className="h-10"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Phải ghi chính xác nội dung này khi chuyển khoản để hệ thống nhận diện
                      </p>
                    </div>

                    {/* Refresh button */}
                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        onClick={handleRefreshPayment}
                        className="w-full"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Kiểm tra trạng thái
                      </Button>
                    </div>

                    {activePayment.status === 'pending' && (
                      <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3">
                        <p className="text-sm text-yellow-800">
                          <span className="font-medium">Lưu ý:</span> Vui lòng chuyển khoản trong vòng 15 phút. 
                          Hệ thống sẽ tự động cập nhật khi nhận được tiền.
                        </p>
                      </div>
                    )}

                    {activePayment.status === 'completed' && (
                      <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                        <div className="flex items-center gap-2 text-green-800">
                          <CheckCircle className="h-4 w-4" />
                          <span className="font-medium">Thanh toán thành công!</span>
                        </div>
                        <p className="text-sm text-green-700 mt-1">
                          {activePayment.credits_added} credits đã được cộng vào tài khoản của bạn.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <QrCode className="h-5 w-5" />
                      Mã QR thanh toán
                    </CardTitle>
                    <CardDescription>
                      Mã QR sẽ xuất hiện sau khi bạn chọn số tiền và ngân hàng
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="w-48 h-48 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center mb-4">
                      <QrCode className="h-16 w-16 text-gray-300" />
                    </div>
                    <p className="text-center text-muted-foreground">
                      Chọn số tiền và bấm &quot;Tạo mã QR thanh toán&quot; để hiển thị mã QR
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Support info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Hỗ trợ</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Nếu gặp vấn đề với thanh toán, vui lòng liên hệ:
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li>📧 Email: support@thudoonline.com</li>
                    <li>📞 Hotline: 1900 1234</li>
                    <li>💬 Zalo: 0987 654 321</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}