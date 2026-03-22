'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { generateBarcode, fetchVietQRImage, type BarcodeType } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { QrCode, Barcode, Download, Building2, Sparkles, ClipboardPaste } from 'lucide-react'
import { DownloadImageButton } from '@/components/download-image-button'

const VIETQR_STORAGE_KEY = 'tao_ma_vach_vietqr'
const POPULAR_BANKS = ['VCB', 'BIDV', 'ICB', 'VBA', 'TCB', 'MB', 'VPB', 'ACB', 'TPB', 'HDB', 'STB', 'MSB', 'SCB', 'OCB', 'EIB', 'VIB', 'SHB']
const BANK_NAME_TO_CODE: Record<string, string> = {
  Vietcombank: 'VCB', VietinBank: 'ICB', BIDV: 'BIDV', Techcombank: 'TCB', MBBank: 'MB', VPBank: 'VPB',
  TPBank: 'TPB', ACB: 'ACB', HDBank: 'HDB', MSB: 'MSB', Agribank: 'VBA', Sacombank: 'STB',
}
const QUICK_AMOUNTS = [50000, 100000, 200000, 500000, 1000000]
const QR_EXAMPLES: { label: string; value: string }[] = [
  { label: 'https://example.com', value: 'https://example.com' },
  { label: 'WiFi', value: 'WIFI:T:WPA;S:MyWiFi;P:password;;' },
  { label: 'vCard', value: 'BEGIN:VCARD\nFN:Nguyen Van A\nTEL:0901234567\nEND:VCARD' },
]

type BankItem = { id: number; name: string; code: string; shortName: string; bin: string }

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

const BARCODE_TYPES: { value: BarcodeType; label: string; desc: string; placeholder: string }[] = [
  {
    value: 'qrcode',
    label: 'QR Code',
    desc: 'Link, văn bản, số tài khoản, vCard, WiFi...',
    placeholder: 'https://example.com hoặc văn bản bất kỳ',
  },
  {
    value: 'ean13',
    label: 'EAN-13',
    desc: 'Mã sản phẩm (13 chữ số)',
    placeholder: '8936012345678',
  },
  {
    value: 'upca',
    label: 'UPC-A',
    desc: 'Mã sản phẩm (12 chữ số)',
    placeholder: '012345678901',
  },
  {
    value: 'code128',
    label: 'Code 128',
    desc: 'Chữ và số',
    placeholder: 'ABC123',
  },
]

export default function TaoMaVachClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [mode, setMode] = useState<'barcode' | 'vietqr'>('barcode')
  const [type, setType] = useState<BarcodeType>('qrcode')
  const [content, setContent] = useState('')
  const [size, setSize] = useState(256)
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [vietqrUrl, setVietqrUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [banks, setBanks] = useState<BankItem[]>([])
  const [vietqr, setVietqr] = useState({ bankId: '', accountNo: '', amount: '', addInfo: '', accountName: '' })
  const { toast } = useToast()
  const resultRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const syncLocale = () => setUiLocale(getWebLocaleFromCookie())
    syncLocale()
    const timer = window.setInterval(syncLocale, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIETQR_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed?.bankId || parsed?.accountNo || parsed?.accountName) {
          let bankId = parsed.bankId || ''
          if (bankId && !/^[A-Z0-9]{2,10}$/i.test(bankId)) {
            bankId = BANK_NAME_TO_CODE[bankId] || bankId
          }
          setVietqr((p) => ({ ...p, ...parsed, bankId: bankId || parsed.bankId }))
        }
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    try {
      if (!vietqr.bankId && !vietqr.accountNo && !vietqr.accountName) {
        localStorage.removeItem(VIETQR_STORAGE_KEY)
        return
      }
      localStorage.setItem(VIETQR_STORAGE_KEY, JSON.stringify({
        bankId: vietqr.bankId,
        accountNo: vietqr.accountNo,
        accountName: vietqr.accountName,
      }))
    } catch { /* ignore */ }
  }, [vietqr.bankId, vietqr.accountNo, vietqr.accountName])

  const clearSavedVietqr = () => {
    setVietqr((p) => ({ ...p, bankId: '', accountNo: '', accountName: '' }))
    try { localStorage.removeItem(VIETQR_STORAGE_KEY) } catch { /* ignore */ }
    toast({ title: tr('Đã xóa', 'Cleared', '已清除', '削除しました', '삭제됨'), description: tr('Thông tin đã lưu đã được xóa.', 'Saved info has been cleared.', '已清除保存的信息。', '保存した情報を削除しました。', '저장된 정보가 삭제되었습니다.'), duration: 2000 })
  }

  useEffect(() => {
    fetch('https://api.vietqr.io/v2/banks')
      .then((r) => r.json())
      .then((d) => {
        if (!d?.data) return
        const list = d.data.filter((b: BankItem & { transferSupported?: number }) => b.transferSupported === 1)
        const sorted = [...list].sort((a: BankItem, b: BankItem) => {
          const ai = POPULAR_BANKS.indexOf(a.code)
          const bi = POPULAR_BANKS.indexOf(b.code)
          if (ai >= 0 && bi >= 0) return ai - bi
          if (ai >= 0) return -1
          if (bi >= 0) return 1
          return (a.name || '').localeCompare(b.name || '')
        })
        setBanks(sorted)
      })
      .catch(() => {})
  }, [])

  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  const handleGenerate = async () => {
    if (mode === 'vietqr') {
      const { bankId, accountNo } = vietqr
      if (!bankId.trim() || !accountNo.trim()) {
        toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Vui lòng chọn ngân hàng và nhập số tài khoản.', 'Please select bank and enter account number.', '请选择银行并输入账号。', '銀行と口座番号を入力してください。', '은행과 계좌번호를 입력하세요.'), variant: 'destructive' })
        return
      }
      const params = new URLSearchParams()
      if (vietqr.amount.trim()) params.set('amount', vietqr.amount.trim())
      if (vietqr.addInfo.trim()) params.set('addInfo', vietqr.addInfo.trim())
      if (vietqr.accountName.trim()) params.set('accountName', vietqr.accountName.trim())
      const qs = params.toString()
      const url = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png${qs ? `?${qs}` : ''}`
      setVietqrUrl(url)
      setDataUrl(null)
      toast({ title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'), description: tr('VietQR đã sẵn sàng. App ngân hàng quét được.', 'VietQR ready. Banking apps can scan.', 'VietQR 已就绪，银行应用可扫描。', 'VietQRの準備ができました。銀行アプリでスキャン可能。', 'VietQR 준비 완료. 뱅킹 앱에서 스캔 가능.'), duration: 2000 })
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      return
    }
    if (!content.trim()) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Vui lòng nhập nội dung.', 'Please enter content.', '请输入内容。', '内容を入力してください。', '내용을 입력하세요.'), variant: 'destructive' })
      return
    }
    setLoading(true)
    setDataUrl(null)
    setVietqrUrl(null)
    const result = await generateBarcode(type, content, size)
    setLoading(false)
    if (result.error) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: result.error, variant: 'destructive' })
    } else if (result.dataUrl) {
      setDataUrl(result.dataUrl)
      toast({ title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'), description: tr('Mã vạch đã được tạo.', 'Barcode has been generated.', '条形码已生成。', 'バーコードを生成しました。', '바코드가 생성되었습니다.'), duration: 2000 })
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text?.trim()) setContent(text.trim())
      else toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Clipboard trống.', 'Clipboard empty.', '剪贴板为空。', 'クリップボードが空です。', '클립보드가 비어 있습니다.'), variant: 'destructive' })
    } catch {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Không đọc được clipboard.', 'Cannot read clipboard.', '无法读取剪贴板。', 'クリップボードを読み取れません。', '클립보드 읽기 실패.'), variant: 'destructive' })
    }
  }

  const handleDownload = async () => {
    if (vietqrUrl) {
      setLoading(true)
      const result = await fetchVietQRImage(vietqrUrl)
      setLoading(false)
      if (result.dataUrl) {
        const a = document.createElement('a')
        a.href = result.dataUrl
        a.download = `vietqr-${Date.now()}.png`
        a.click()
      } else {
        toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: result.error || tr('Không tải được ảnh.', 'Could not download image.', '无法下载图片。', '画像をダウンロードできません。', '이미지를 다운로드할 수 없습니다.'), variant: 'destructive' })
      }
      return
    }
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `barcode-${type}-${Date.now()}.png`
    a.click()
  }

  return (
    <>
      <Toaster />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 md:pb-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">{tr('Tạo mã vạch & QR Code', 'Create Barcode & QR Code', '创建条形码和二维码', 'バーコード・QRコード作成', '바코드·QR 코드 만들기')}</h1>
          <p className="text-muted-foreground mt-1">{tr('Mã hóa link, văn bản, VietQR ngân hàng, mã sản phẩm... Tải xuống PNG miễn phí.', 'Encode links, text, VietQR bank transfer, product codes... Download PNG for free.', '编码链接、文本、VietQR银行转账、产品代码... 免费下载 PNG。', 'リンク、テキスト、VietQR銀行振込、商品コード... PNGを無料でダウンロード。', '링크, 텍스트, VietQR 계좌이체, 상품코드... PNG 무료 다운로드.')}</p>
        </div>

        <div className="flex gap-2 relative z-10">
          <button
            type="button"
            onClick={() => { setMode('barcode'); setDataUrl(null); setVietqrUrl(null) }}
            className={`flex-1 py-3 rounded-lg border text-sm font-medium transition-colors cursor-pointer touch-manipulation select-none ${mode === 'barcode' ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-gray-200 bg-white hover:bg-gray-50 active:bg-gray-100'}`}
          >
            <Barcode className="h-4 w-4 inline mr-2" /> {tr('Mã vạch thường', 'Standard barcode', '普通条码', '通常バーコード', '일반 바코드')}
          </button>
          <button
            type="button"
            onClick={() => { setMode('vietqr'); setDataUrl(null); setVietqrUrl(null) }}
            className={`flex-1 py-3 rounded-lg border text-sm font-medium transition-colors cursor-pointer touch-manipulation select-none ${mode === 'vietqr' ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-gray-200 bg-white hover:bg-gray-50 active:bg-gray-100'}`}
          >
            <Building2 className="h-4 w-4 inline mr-2" /> VietQR {tr('(Ngân hàng)', '(Bank)', '(银行)', '(銀行)', '(은행)')}
          </button>
        </div>

        <Card className="relative z-10 border shadow-sm bg-white/80 backdrop-blur border-sky-200/60">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              {mode === 'vietqr' ? <Building2 className="h-4 w-4 text-sky-600" /> : <Barcode className="h-4 w-4 text-sky-600" />}{' '}
              {mode === 'vietqr' ? 'VietQR' : tr('Loại mã', 'Barcode type', '条码类型', 'バーコード種類', '바코드 유형')}
            </CardTitle>
            <CardDescription className="text-xs">
              {mode === 'vietqr' ? tr('Nhập ngân hàng, số tài khoản, tên chủ – lưu vĩnh viễn trong trình duyệt. Lần sau chỉ cần nhập số tiền.', 'Enter bank, account, name – saved permanently in browser. Next time just enter amount.', '输入银行、账号、户名 – 永久保存在浏览器。下次只需输入金额。', '銀行・口座・名義を入力 – ブラウザに永久保存。次回は金額のみ。', '은행·계좌·예금주 입력 – 브라우저에 영구 저장. 다음엔 금액만.') : tr('Chọn loại mã, nhập nội dung, rồi bấm Tạo mã vạch.', 'Select type, enter content, then click Generate barcode.', '选择类型、输入内容，然后点击生成条码。', '種類を選び内容を入力し、バーコードを生成をクリック。', '유형 선택, 내용 입력 후 바코드 생성 클릭.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            {mode === 'vietqr' ? (
              <>
                {(vietqr.bankId || vietqr.accountNo || vietqr.accountName) && (
                  <p className="text-xs text-emerald-600 flex items-center gap-2">
                    <span>✓</span> {tr('Đã lưu trong trình duyệt – chỉ cần nhập số tiền mỗi lần.', 'Saved in browser – just enter amount each time.', '已保存到浏览器 – 每次只需输入金额。', 'ブラウザに保存済み – 毎回金額のみ入力。', '브라우저에 저장됨 – 매번 금액만 입력.')}
                    <button type="button" onClick={clearSavedVietqr} className="text-muted-foreground hover:text-red-600 underline">
                      {tr('Xóa', 'Clear', '清除', '削除', '삭제')}
                    </button>
                  </p>
                )}
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">{tr('Ngân hàng', 'Bank', '银行', '銀行', '은행')}</label>
                    <select
                      value={vietqr.bankId}
                      onChange={(e) => setVietqr((p) => ({ ...p, bankId: e.target.value }))}
                      className="w-full h-10 rounded-md border bg-white px-3 text-sm cursor-pointer"
                    >
                      <option value="">{tr('Chọn ngân hàng', 'Select bank', '选择银行', '銀行を選択', '은행 선택')}</option>
                      {banks.map((b) => (
                        <option key={b.id} value={b.code}>{b.shortName} - {b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">{tr('Số tài khoản', 'Account number', '账号', '口座番号', '계좌번호')}</label>
                    <Input
                      placeholder="1234567890"
                      value={vietqr.accountNo}
                      onChange={(e) => setVietqr((p) => ({ ...p, accountNo: e.target.value }))}
                      className="font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    {tr('Tên thụ hưởng (tùy chọn – app ngân hàng hiển thị khi quét)', 'Beneficiary name (optional – shown in banking app when scanned)', '收款人（可选 – 扫描时银行应用显示）', '受取人名（任意 – スキャン時に銀行アプリで表示）', '수취인 (선택 – 스캔 시 뱅킹 앱에 표시)')}
                  </label>
                  <Input
                    placeholder="Nguyen Van A"
                    value={vietqr.accountName}
                    onChange={(e) => setVietqr((p) => ({ ...p, accountName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Số tiền (tùy chọn)', 'Amount (optional)', '金额（可选）', '金額（任意）', '금액 (선택)')}</label>
                  <Input
                    type="number"
                    placeholder="100000"
                    value={vietqr.amount}
                    onChange={(e) => setVietqr((p) => ({ ...p, amount: e.target.value }))}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_AMOUNTS.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setVietqr((p) => ({ ...p, amount: String(a) }))}
                        className="px-2 py-1 rounded text-xs border bg-white hover:bg-sky-50 hover:border-sky-300 cursor-pointer"
                      >
                        {a >= 1000000 ? `${a / 1000000}tr` : `${a / 1000}k`}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Nội dung CK (tùy chọn)', 'Transfer note (optional)', '转账备注（可选）', '振込メモ（任意）', '이체 메모 (선택)')}</label>
                  <Input
                    placeholder="Thanh toan don hang"
                    value={vietqr.addInfo}
                    onChange={(e) => setVietqr((p) => ({ ...p, addInfo: e.target.value }))}
                  />
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={!vietqr.bankId.trim() || !vietqr.accountNo.trim()}
                  className="w-full h-11 bg-sky-600 hover:bg-sky-700 text-white cursor-pointer touch-manipulation"
                >
                  <Sparkles className="mr-2 h-4 w-4" /> {tr('Tạo VietQR', 'Generate VietQR', '生成 VietQR', 'VietQRを生成', 'VietQR 생성')}
                </Button>
              </>
            ) : (
            <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {BARCODE_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`px-3 py-3 rounded-lg border text-left text-xs font-medium transition-colors cursor-pointer touch-manipulation select-none min-h-[52px] ${
                    type === t.value ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-gray-200 bg-white hover:bg-gray-50 active:bg-gray-100 text-muted-foreground'
                  }`}
                >
                  <span className="block font-semibold">{t.label}</span>
                  <span className="block text-[10px] opacity-80 mt-0.5">{t.desc}</span>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {type === 'qrcode' ? tr('Nội dung (URL, văn bản, số tài khoản...)', 'Content (URL, text, bank account...)', '内容（URL、文本、账号...）', '内容（URL、テキスト、口座...）', '내용 (URL, 텍스트, 계좌...)') : tr('Nội dung', 'Content', '内容', '内容', '내용')}
                </label>
                {type === 'qrcode' && (
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handlePaste}>
                    <ClipboardPaste className="h-3.5 w-3.5" /> {tr('Dán', 'Paste', '粘贴', '貼り付け', '붙여넣기')}
                  </Button>
                )}
              </div>
              <Textarea
                placeholder={BARCODE_TYPES.find((t) => t.value === type)?.placeholder}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="bg-white/80 text-sm min-h-[80px] font-mono"
                rows={3}
              />
              {type === 'qrcode' && (
                <div className="flex flex-wrap gap-1.5">
                  {QR_EXAMPLES.map((ex) => (
                    <button
                      key={ex.label}
                      type="button"
                      onClick={() => setContent(ex.value)}
                      className="px-2 py-1 rounded text-xs border bg-white hover:bg-sky-50 hover:border-sky-300 cursor-pointer text-muted-foreground hover:text-foreground"
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {type === 'qrcode' && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Kích thước (px)', 'Size (px)', '尺寸（像素）', 'サイズ (px)', '크기 (px)')}</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="range"
                    min="128"
                    max="512"
                    step="64"
                    value={size}
                    onChange={(e) => setSize(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm font-mono w-12">{size}</span>
                </div>
              </div>
            )}

            <Button
              onClick={handleGenerate}
              disabled={loading || (mode === 'barcode' ? !content.trim() : !vietqr.bankId.trim() || !vietqr.accountNo.trim())}
              className="w-full h-11 bg-sky-600 hover:bg-sky-700 text-white cursor-pointer touch-manipulation"
            >
              {loading ? (
                <span className="animate-pulse">{tr('Đang tạo...', 'Generating...', '生成中...', '生成中...', '생성 중...')}</span>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" /> {tr('Tạo mã vạch', 'Generate barcode', '生成条码', 'バーコードを生成', '바코드 생성')}
                </>
              )}
            </Button>
            </>
            )}
          </CardContent>
        </Card>

        {(dataUrl || vietqrUrl) && (
          <Card ref={resultRef} className="border shadow-sm bg-white/80 backdrop-blur scroll-mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-4 w-4" /> {tr('Kết quả', 'Result', '结果', '結果', '결과')}
              </CardTitle>
              <CardDescription>
                {vietqrUrl ? tr('Mã hiển thị ngay. App ngân hàng quét được. Bấm tải PNG để in.', 'Code displayed below. Banking apps can scan. Click download PNG for print.', '下方显示二维码。银行应用可扫描。点击下载 PNG 打印。', '下にコードを表示。銀行アプリでスキャン可能。PNGをダウンロードして印刷。', '아래에 코드 표시. 뱅킹 앱 스캔 가능. PNG 다운로드하여 인쇄.') : tr('Mã hiển thị ngay. Tải PNG để in hoặc dùng trên nhãn.', 'Code displayed below. Download PNG for print or use on labels.', '下方显示。下载 PNG 用于打印或标签。', '下にコードを表示。PNGをダウンロードして印刷やラベルに使用。', '아래에 코드 표시. PNG 다운로드하여 인쇄 또는 라벨에 사용.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="p-4 bg-white rounded-lg shadow-sm">
                  <img
                    src={dataUrl || vietqrUrl || ''}
                    alt={tr('Mã vạch', 'Barcode', '条码', 'バーコード', '바코드')}
                    className="max-w-[min(320px,90vw)] max-h-[380px] w-auto h-auto object-contain block"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleDownload} variant="outline" size="sm" className="gap-2" disabled={loading}>
                    {loading ? tr('Đang tải...', 'Downloading...', '下载中...', 'ダウンロード中...', '다운로드 중...') : <><Download className="h-4 w-4" /> {tr('Tải PNG', 'Download PNG', '下载 PNG', 'PNGをダウンロード', 'PNG 다운로드')}</>}
                  </Button>
                  <DownloadImageButton
                    imageUrl={dataUrl || vietqrUrl || ''}
                    filename={vietqrUrl ? `vietqr-${Date.now()}` : `barcode-${type}-${Date.now()}`}
                    size="sm"
                    variant="outline"
                    printReady
                    printReadyInferFromImage
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-xs text-muted-foreground space-y-2">
          <p><strong>VietQR</strong> – {tr('Tích hợp VietQR.io. App ngân hàng quét được. Không đăng ký, không giới hạn (Public Access).', 'VietQR.io integration. Banking apps can scan. No signup, no limit (Public Access).', 'VietQR.io 集成。银行应用可扫描。无需注册，无限制。', 'VietQR.io連携。銀行アプリでスキャン可能。登録不要、制限なし。', 'VietQR.io 연동. 뱅킹 앱 스캔 가능. 가입·제한 없음.')}</p>
          <p><strong>QR Code</strong> – {tr('Link, văn bản, WiFi, vCard...', 'Links, text, WiFi, vCard...', '链接、文本、WiFi、vCard...', 'リンク、テキスト、WiFi、vCard...', '링크, 텍스트, WiFi, vCard...')}</p>
          <p><strong>EAN-13</strong> – {tr('13 chữ số, mã sản phẩm siêu thị.', '13 digits, retail product code.', '13位数字，零售商品码。', '13桁、小売商品コード。', '13자리, 소매 상품 코드.')}</p>
          <p><strong>UPC-A</strong> – {tr('12 chữ số, chuẩn Bắc Mỹ.', '12 digits, North American standard.', '12位数字，北美标准。', '12桁、北米標準。', '12자리, 북미 표준.')}</p>
          <p><strong>Code 128</strong> – {tr('Chữ và số, linh hoạt.', 'Alphanumeric, flexible.', '字母数字，灵活。', '英数字、柔軟。', '영숫자, 유연.')}</p>
        </div>
      </div>
    </>
  )
}
