"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
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
  const [uiLocale, setUiLocale] = useState<'vi' | 'en' | 'zh' | 'ja' | 'ko'>('vi')
  const [amount, setAmount] = useState<number>(6000)
  const [selectedBank, setSelectedBank] = useState<string>('')
  const [paymentConfigs, setPaymentConfigs] = useState<PaymentConfig[]>([])
  const [activePayment, setActivePayment] = useState<Payment | null>(null)
  const [loading, setLoading] = useState(false)
  const [userCredits, setUserCredits] = useState<number>(0)
  const supabase = useMemo(() => createClient(), [])
  const tr = useCallback((vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }, [uiLocale])

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

  const fetchPaymentConfigs = useCallback(async () => {
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
        title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
        description: tr('Không thể tải cấu hình thanh toán', 'Cannot load payment configs', '无法加载支付配置', '支払い設定を読み込めません', '결제 설정을 불러올 수 없습니다'),
        variant: 'destructive'
      })
    }
  }, [supabase, tr])

  const fetchUserCredits = useCallback(async () => {
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
  }, [supabase])

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
    void fetchPaymentConfigs()
    void fetchUserCredits()
    return () => {
      window.removeEventListener('focus', syncLocale)
      document.removeEventListener('visibilitychange', syncLocale)
      window.clearInterval(timer)
    }
  }, [fetchPaymentConfigs, fetchUserCredits])

  const handleCreatePayment = async () => {
    if (!selectedBank) {
      toast({
        title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
        description: tr('Vui lòng chọn ngân hàng', 'Please select a bank', '请选择银行', '銀行を選択してください', '은행을 선택해 주세요'),
        variant: 'destructive'
      })
      return
    }

    if (amount < 1000) {
      toast({
        title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
        description: `${tr('Số tiền tối thiểu là', 'Minimum amount is', '最低金额为', '最小金額は', '최소 금액은')} ${formatNumber(1000)} VND`,
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? (isLocalhost() ? getDevUserId() : null)
      if (!userId) {
        toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Vui lòng đăng nhập để nạp tiền.', 'Please sign in to top up.', '请登录后充值。', 'チャージするにはログインしてください。', '충전하려면 로그인해 주세요.'), variant: 'destructive' })
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
        title: tr('Thành công', 'Success', '成功', '成功', '성공'),
        description: tr('Đã tạo mã QR thanh toán', 'Payment QR created', '支付二维码已创建', '支払いQRを作成しました', '결제 QR을 생성했습니다'),
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : tr('Không thể tạo thanh toán', 'Cannot create payment', '无法创建支付', '支払いを作成できません', '결제를 생성할 수 없습니다')
      console.error('Error creating payment:', error)
      toast({
        title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
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
        throw new Error(tr('Không tìm thấy nội dung chuyển khoản', 'Transfer note not found', '未找到转账备注', '振込内容が見つかりません', '입금 내용을 찾을 수 없습니다'))
      }
      
      await navigator.clipboard.writeText(content)
      toast({
        title: tr('Đã sao chép', 'Copied', '已复制', 'コピーしました', '복사됨'),
        description: tr('Nội dung chuyển khoản đã được sao chép', 'Transfer note copied', '转账备注已复制', '振込内容をコピーしました', '입금 내용을 복사했습니다'),
      })
    } catch (error) {
      console.error('Error copying content:', error)
      toast({
        title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
        description: tr('Không thể sao chép nội dung', 'Cannot copy note', '无法复制内容', '内容をコピーできません', '내용을 복사할 수 없습니다'),
        variant: 'destructive'
      })
    }
  }

  const handleCopyBankAccount = async (bankAccount: string) => {
    try {
      await navigator.clipboard.writeText(bankAccount)
      toast({
        title: tr('Đã sao chép', 'Copied', '已复制', 'コピーしました', '복사됨'),
        description: tr('Số tài khoản đã được sao chép', 'Account number copied', '账号已复制', '口座番号をコピーしました', '계좌번호를 복사했습니다'),
      })
    } catch (error) {
      console.error('Error copying bank account:', error)
      toast({
        title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
        description: tr('Không thể sao chép số tài khoản', 'Cannot copy account number', '无法复制账号', '口座番号をコピーできません', '계좌번호를 복사할 수 없습니다'),
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
          title: tr('Thành công', 'Success', '成功', '成功', '성공'),
          description: `${tr('Đã nạp thành công', 'Top-up successful', '充值成功', 'チャージ成功', '충전 성공')} ${data.credits_added} credits!`,
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
            <h1 className="text-3xl font-bold">{tr('Nạp tiền', 'Top up', '充值', 'チャージ', '충전')}</h1>
            <p className="text-muted-foreground mt-2">
              {tr('Nạp tiền để nhận credits sử dụng dịch vụ thử đồ ảo', 'Top up to receive credits for virtual try-on services', '充值以获取用于虚拟试衣服务的积分', 'バーチャル試着サービス用クレジットをチャージ', '가상 피팅 서비스용 크레딧 충전')}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
            {/* Left column - Payment info */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    {tr('Thông tin thanh toán', 'Payment information', '支付信息', '支払い情報', '결제 정보')}
                  </CardTitle>
                  <CardDescription>
                    {tr('Chọn số tiền và phương thức thanh toán', 'Choose amount and payment method', '选择金额和支付方式', '金額と支払い方法を選択', '금액과 결제 방법 선택')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Current credits */}
                  <div className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{tr('Số dư hiện tại', 'Current balance', '当前余额', '現在の残高', '현재 잔액')}</p>
                        <p className="text-2xl font-bold text-blue-700">{userCredits} credits</p>
                      </div>
                      <Badge variant="outline" className="text-blue-600 border-blue-300">
                        1 credit = {formatNumber(6000)} VND
                      </Badge>
                    </div>
                  </div>

                  {/* Amount selection */}
                  <div className="space-y-3">
                    <Label>{tr('Số tiền nạp (VND)', 'Top-up amount (VND)', '充值金额 (VND)', 'チャージ金額 (VND)', '충전 금액 (VND)')}</Label>
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
                      {tr('Sẽ nhận được', 'You will receive', '将获得', '受け取れる', '받게 되는')} <span className="font-semibold text-green-600">
                        {Math.floor(amount / 6000)} credits
                      </span>
                    </p>
                  </div>

                  {/* Bank selection */}
                  <div className="space-y-3">
                    <Label>{tr('Chọn ngân hàng', 'Choose bank', '选择银行', '銀行を選択', '은행 선택')}</Label>
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
                              <Badge variant="secondary">{tr('Đang hoạt động', 'Active', '运行中', '稼働中', '활성')}</Badge>
                            </div>
                            
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">{tr('Số tài khoản', 'Account number', '账号', '口座番号', '계좌번호')}:</span>
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
                                <span className="text-sm text-muted-foreground">{tr('Chủ tài khoản', 'Account holder', '账户名', '口座名義', '예금주')}:</span>
                                <span className="font-medium">{tr('Tên chủ tài khoản của bạn', 'Your account holder name', '你的账户名', 'あなたの口座名義', '당신의 예금주명')}</span>
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
                        toast({ title: tr('Đang tải', 'Loading', '加载中', '読み込み中', '불러오는 중'), description: tr('Vui lòng chờ cấu hình ngân hàng tải xong.', 'Please wait for bank config to load.', '请等待银行配置加载完成。', '銀行設定の読み込み完了までお待ちください。', '은행 설정이 로드될 때까지 기다려 주세요.'), variant: 'destructive' })
                        return
                      }
                      handleCreatePayment()
                    }}
                    onPointerUp={() => {
                      if (loading) return
                      if (!selectedBank) return
                      handleCreatePayment()
                    }}
                    disabled={loading || paymentConfigs.length === 0}
                    className="w-full min-h-[52px] h-12 text-lg touch-manipulation select-none relative z-10"
                    size="lg"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        {tr('Đang xử lý...', 'Processing...', '处理中...', '処理中...', '처리 중...')}
                      </>
                    ) : (
                      <>
                        <QrCode className="mr-2 h-5 w-5" />
                        {tr('Tạo mã QR thanh toán', 'Create payment QR', '创建支付二维码', '支払いQRを作成', '결제 QR 생성')}
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
                    {tr('Hướng dẫn thanh toán', 'Payment guide', '支付指南', '支払いガイド', '결제 안내')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="rounded-full bg-blue-100 p-1 mt-0.5">
                        <span className="text-xs font-bold text-blue-600 w-4 h-4 flex items-center justify-center">1</span>
                      </div>
                      <p className="text-sm">{tr('Chọn số tiền và ngân hàng nhận tiền', 'Choose amount and destination bank', '选择金额和收款银行', '金額と振込先銀行を選択', '금액과 수취 은행 선택')}</p>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <div className="rounded-full bg-blue-100 p-1 mt-0.5">
                        <span className="text-xs font-bold text-blue-600 w-4 h-4 flex items-center justify-center">2</span>
                      </div>
                      <p className="text-sm">{tr('Quét mã QR hoặc chuyển khoản đến số tài khoản trên', 'Scan QR or transfer to the account above', '扫码或转账到上方账户', 'QRをスキャンするか上記口座へ振込', 'QR 스캔 또는 위 계좌로 이체')}</p>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <div className="rounded-full bg-blue-100 p-1 mt-0.5">
                        <span className="text-xs font-bold text-blue-600 w-4 h-4 flex items-center justify-center">3</span>
                      </div>
                      <p className="text-sm">
                        <span className="font-semibold">{tr('QUAN TRỌNG', 'IMPORTANT', '重要', '重要', '중요')}:</span> {tr('Ghi nội dung', 'Use the transfer note', '请填写转账备注', '振込内容を入力', '입금 내용을 입력')} {' '}
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">{tr('hệ thống cung cấp', 'provided by system', '系统提供', 'システム提供', '시스템 제공')}</code>{' '}
                        {tr('khi chuyển khoản', 'when transferring', '进行转账时', '振込時に', '이체 시')}
                      </p>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <div className="rounded-full bg-blue-100 p-1 mt-0.5">
                        <span className="text-xs font-bold text-blue-600 w-4 h-4 flex items-center justify-center">4</span>
                      </div>
                      <p className="text-sm">{tr('Hệ thống sẽ tự động cộng credits trong vòng 1-5 phút', 'System will auto-add credits within 1-5 minutes', '系统将在1-5分钟内自动到账积分', '1〜5分でクレジットが自動反映されます', '1~5분 내 크레딧이 자동 반영됩니다')}</p>
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
                        {tr('Mã QR thanh toán', 'Payment QR', '支付二维码', '支払いQR', '결제 QR')}
                      </span>
                      <Badge variant={activePayment.status === 'completed' ? 'default' : 'secondary'}>
                        {activePayment.status === 'completed' ? tr('Đã thanh toán', 'Paid', '已支付', '支払い済み', '결제 완료') : tr('Chờ thanh toán', 'Pending payment', '待支付', '支払い待ち', '결제 대기')}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      {tr('Quét mã QR bằng ứng dụng ngân hàng của bạn', 'Scan QR with your banking app', '使用你的银行App扫码', '銀行アプリでQRをスキャン', '은행 앱으로 QR 스캔')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* QR Code */}
                    <div className="flex justify-center">
                      <div className="border-2 border-gray-200 rounded-lg p-4 bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element -- SePay QR URL is dynamic */}
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
                        <span className="text-sm text-muted-foreground">{tr('Ngân hàng', 'Bank', '银行', '銀行', '은행')}:</span>
                        <span className="font-medium">{activePayment.bank_name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{tr('Chủ tài khoản', 'Account holder', '账户名', '口座名義', '예금주')}:</span>
                        <span className="font-medium">
                          {paymentConfigs.find(c => c.id === selectedBank)?.account_holder_name || '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{tr('Số tài khoản', 'Account number', '账号', '口座番号', '계좌번호')}:</span>
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
                        <span className="text-sm text-muted-foreground">{tr('Số tiền', 'Amount', '金额', '金額', '금액')}:</span>
                        <span className="font-bold text-lg">{formatNumber(activePayment.amount)}₫</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-muted-foreground">{tr('Nội dung CK', 'Transfer note', '转账备注', '振込内容', '입금 내용')}:</span>
                        <span className="font-mono font-semibold break-all text-right">
                          {activePayment.transaction_content || '---'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{tr('Sẽ nhận', 'Will receive', '将获得', '受け取る', '받게 됨')}:</span>
                        <span className="font-bold text-green-600">{activePayment.credits_added} credits</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{tr('Trạng thái', 'Status', '状态', '状態', '상태')}:</span>
                        <span className={`font-medium ${
                          activePayment.status === 'completed' ? 'text-green-600' : 
                          activePayment.status === 'pending' ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {activePayment.status === 'completed' ? `✅ ${tr('Đã thanh toán', 'Paid', '已支付', '支払い済み', '결제 완료')}` :
                           activePayment.status === 'pending' ? `⏳ ${tr('Chờ thanh toán', 'Pending payment', '待支付', '支払い待ち', '결제 대기')}` : `❌ ${tr('Thất bại', 'Failed', '失败', '失敗', '실패')}`}
                        </span>
                      </div>
                    </div>

                    {/* Nội dung chuyển khoản */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{tr('Nội dung chuyển khoản', 'Transfer note', '转账备注', '振込内容', '입금 내용')}:</span>
                        <span className="text-sm font-medium text-blue-600">({tr('Bắt buộc', 'Required', '必填', '必須', '필수')})</span>
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
                        {tr('Phải ghi chính xác nội dung này khi chuyển khoản để hệ thống nhận diện', 'You must enter this exact note so the system can recognize your payment', '必须填写完全一致的备注，系统才能识别', 'システム識別のため、この内容を正確に入力してください', '시스템 인식을 위해 이 내용을 정확히 입력해야 합니다')}
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
                        {tr('Kiểm tra trạng thái', 'Check status', '检查状态', '状態を確認', '상태 확인')}
                      </Button>
                    </div>

                    {activePayment.status === 'pending' && (
                      <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3">
                        <p className="text-sm text-yellow-800">
                          <span className="font-medium">{tr('Lưu ý', 'Note', '注意', '注意', '안내')}:</span> {tr('Vui lòng chuyển khoản trong vòng 15 phút.', 'Please transfer within 15 minutes.', '请在15分钟内转账。', '15分以内にお振込ください。', '15분 내 이체해 주세요.')} {' '}
                          {tr('Hệ thống sẽ tự động cập nhật khi nhận được tiền.', 'System will auto-update once payment is received.', '系统收到款项后会自动更新。', '入金確認後に自動更新されます。', '입금 확인 후 시스템이 자동 업데이트됩니다.')}
                        </p>
                      </div>
                    )}

                    {activePayment.status === 'completed' && (
                      <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                        <div className="flex items-center gap-2 text-green-800">
                          <CheckCircle className="h-4 w-4" />
                          <span className="font-medium">{tr('Thanh toán thành công!', 'Payment successful!', '支付成功！', '支払い成功！', '결제 성공!')}</span>
                        </div>
                        <p className="text-sm text-green-700 mt-1">
                          {activePayment.credits_added} credits {tr('đã được cộng vào tài khoản của bạn.', 'have been added to your account.', '已添加到你的账户。', 'がアカウントに追加されました。', '가 계정에 추가되었습니다.')}
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
                      {tr('Mã QR thanh toán', 'Payment QR', '支付二维码', '支払いQR', '결제 QR')}
                    </CardTitle>
                    <CardDescription>
                      {tr('Mã QR sẽ xuất hiện sau khi bạn chọn số tiền và ngân hàng', 'QR will appear after you choose amount and bank', '选择金额和银行后会显示二维码', '金額と銀行を選択するとQRが表示されます', '금액과 은행 선택 후 QR이 표시됩니다')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="w-48 h-48 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center mb-4">
                      <QrCode className="h-16 w-16 text-gray-300" />
                    </div>
                    <p className="text-center text-muted-foreground">
                      {tr('Chọn số tiền và bấm "Tạo mã QR thanh toán" để hiển thị mã QR', 'Choose amount and click "Create payment QR" to show QR', '选择金额并点击“创建支付二维码”以显示二维码', '金額を選択して「支払いQRを作成」を押すと表示されます', '금액을 선택하고 "결제 QR 생성"을 누르면 표시됩니다')}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Support info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">{tr('Hỗ trợ', 'Support', '支持', 'サポート', '지원')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {tr('Nếu gặp vấn đề với thanh toán, vui lòng liên hệ:', 'If you have payment issues, please contact:', '如支付遇到问题，请联系：', '決済に問題がある場合はこちらへ：', '결제 문제가 있으면 문의하세요:')}
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