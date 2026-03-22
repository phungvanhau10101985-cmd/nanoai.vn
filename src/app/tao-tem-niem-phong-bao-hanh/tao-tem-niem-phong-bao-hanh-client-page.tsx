'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Download, Sparkles, Upload, X } from 'lucide-react'
import { DownloadImageButton } from '@/components/download-image-button'
import { ImagePreview } from '@/components/ui/image-preview'
import { ImageProcessingLoader } from '@/components/image-processing-loader'
import { type SealType } from './lib/seal-label-render'
import { createSealLabelWithAI } from './actions'
import { useCredits } from '@/hooks/use-credits'
import { preloadImageUrl } from '@/lib/preload-image-url'

const ASPECT_RATIOS = [
  { value: '1:1', label: '1:1' },
  { value: '2:3', label: '2:3' },
  { value: '3:2', label: '3:2' },
  { value: '3:4', label: '3:4' },
  { value: '4:3', label: '4:3' },
  { value: '4:5', label: '4:5' },
  { value: '5:4', label: '5:4' },
  { value: '5:7', label: '5:7' },
  { value: '7:10', label: '7:10' },
] as const

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

type Step = 'INPUT' | 'GENERATING' | 'RESULT'

export default function TaoTemNiemPhongBaoHanhClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [step, setStep] = useState<Step>('INPUT')
  const logoInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()

  const [sealType, setSealType] = useState<SealType>('chinh-hang')
  const [mainText, setMainText] = useState('')
  const [brandName, setBrandName] = useState('')
  const [productName, setProductName] = useState('')
  const [sealColor, setSealColor] = useState('')
  const [validityDate, setValidityDate] = useState('')
  const [logo, setLogo] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const cost = imageQuality === '2K' ? 1.5 : 3

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
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (sealType === 'chinh-hang') setMainText('HÀNG CHÍNH HÃNG')
    else if (sealType === 'bao-hanh') setMainText('BẢO HÀNH')
    else if (sealType === 'niem-phong') setMainText('TEM LIÊM PHONG')
  }, [sealType])

  const handleSubmit = async () => {
    const main = mainText.trim() || (sealType === 'chinh-hang' ? 'HÀNG CHÍNH HÃNG' : sealType === 'bao-hanh' ? 'BẢO HÀNH' : 'TEM LIÊM PHONG')
    setStep('GENERATING')
    const formData = new FormData()
    formData.append('mainText', main)
    formData.append('brandName', brandName.trim())
    formData.append('productName', productName.trim())
    formData.append('sealColor', sealColor.trim())
    formData.append('sealType', sealType)
    formData.append('validityDate', validityDate.trim())
    formData.append('imageQuality', imageQuality)
    formData.append('aspectRatio', aspectRatio)
    if (logo.file) formData.append('logo', logo.file)
    const result = await createSealLabelWithAI(formData)
    if (result.error) {
      setStep('INPUT')
      toast({ title: tr('Tạo tem thất bại', 'Create seal failed', '创建标签失败', 'シール作成に失敗', '씰 생성 실패'), description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      await preloadImageUrl(result.resultUrl)
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      window.dispatchEvent(new Event('credits-updated'))
      toast({ title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'), description: tr('Tem đã được tạo.', 'Seal has been created.', '标签已创建。', 'シールを作成しました。', '씰이 생성되었습니다.'), duration: 3000 })
    }
  }

  const handleReset = () => {
    setStep('INPUT')
    setMainText('')
    setBrandName('')
    setProductName('')
    setSealColor('')
    setValidityDate('')
    setLogo({ file: null, preview: null })
    setResultUrl(null)
  }

  return (
    <>
      <Toaster />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">
            {tr('Tạo tem nhãn - Tem niêm phong, bảo hành', 'Create seal label - Security & warranty', '创建封条/保修标签', 'シールラベル作成 - 封印・保証', '씰 라벨 만들기 - 봉인·보증')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {tr('Chọn logo (tùy chọn), nhập tên thương hiệu và nội dung. AI vẽ tem chuyên nghiệp. 1,5–3 credits/lượt.', 'Upload logo (optional), enter brand name and content. AI draws professional seal. 1.5–3 credits/creation.', '上传 logo（可选），输入品牌名和内容。AI 绘制专业标签。1.5–3 积分/次。', 'ロゴをアップロード（任意）、ブランド名と内容を入力。AIがプロのシールを描画。1.5〜3クレジット/回。', '로고 업로드(선택), 브랜드명·내용 입력. AI가 전문 씰 디자인. 1.5–3 크레딧/회.')}
          </p>
        </div>

        {step === 'GENERATING' && (
              <div className="flex flex-col items-center justify-center py-12">
                <ImageProcessingLoader mode="seal" title={tr('Đang tạo tem', 'Creating seal', '正在创建标签', 'シール作成中', '씰 생성 중')} description={tr('AI đang vẽ tem chuyên nghiệp', 'AI is drawing professional seal', 'AI 正在绘制专业标签', 'AIがプロのシールを描画中', 'AI가 전문 씰을 그리는 중')} />
                <p className="text-sm text-muted-foreground mt-4">{tr('AI đang tạo tem...', 'AI is creating seal...', 'AI 正在创建标签...', 'AIがシールを作成中...', 'AI가 씰을 생성 중...')}</p>
              </div>
            )}
        {step === 'RESULT' && resultUrl && (
          <div className="max-w-2xl mx-auto space-y-4">
            <Card className="border shadow-sm overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-center bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#f9fafb_0%_50%)] bg-[length:12px_12px] rounded-lg border p-4">
                  <img src={resultUrl} alt={tr('Tem đã tạo', 'Created seal', '已创建标签', '作成したシール', '생성된 씰')} className="max-w-full max-h-[400px] object-contain rounded shadow" />
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  <a href={resultUrl} download="tem-ai.png" className="inline-flex items-center gap-2 px-4 py-2 rounded-md border bg-white hover:bg-gray-50 text-sm font-medium">
                    <Download className="h-3 w-3" /> {tr('Tải PNG', 'Download PNG', '下载 PNG', 'PNGをダウンロード', 'PNG 다운로드')}
                  </a>
                  <DownloadImageButton imageUrl={resultUrl} filename="tem-ai" printReady printReadyAspectRatio={aspectRatio} printReadyLabel={tr('Tải PDF chuẩn in', 'Download print-ready PDF', '下载印刷用PDF', '印刷用PDFをダウンロード', '인쇄용 PDF 다운로드')} printReadySuccessToast={tr('Đã tạo PDF chuẩn in.', 'Print-ready PDF created.', '已生成印刷用PDF。', '印刷用PDFを作成しました。', '인쇄용 PDF 생성됨.')} />
                  <Button variant="outline" size="sm" onClick={handleReset}>{tr('Tạo mới', 'Create new', '新建', '新規作成', '새로 만들기')}</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        {step === 'INPUT' && (
              <div className="max-w-2xl">
                <Card className="border shadow-sm bg-white/80 backdrop-blur border-rose-200/60">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Sparkles className="h-4 w-4 text-rose-600" />
                      {tr('AI thiết kế tem', 'AI design seal', 'AI 设计标签', 'AIデザインシール', 'AI 씰 디자인')}
                    </CardTitle>
                    <CardDescription>
                      {tr('Chọn logo (tùy chọn), nhập tên thương hiệu và nội dung. AI vẽ tem chuyên nghiệp. 1,5–3 credits/lượt.', 'Upload logo (optional), enter brand name and content. AI draws professional seal. 1.5–3 credits/creation.', '上传 logo（可选），输入品牌名和内容。AI 绘制专业标签。1.5–3 积分/次。', 'ロゴをアップロード（任意）、ブランド名と内容を入力。AIがプロのシールを描画。1.5〜3クレジット/回。', '로고 업로드(선택), 브랜드명·내용 입력. AI가 전문 씰 디자인. 1.5–3 크레딧/회.')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2 relative z-10">
                      <label className="text-xs font-medium text-muted-foreground">{tr('Loại tem', 'Label type', '标签类型', 'ラベル種類', '라벨 유형')}</label>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setSealType('chinh-hang')} className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded-md border text-sm font-medium transition-colors cursor-pointer select-none touch-manipulation ${sealType === 'chinh-hang' ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'}`}>{tr('Tem chính hãng', 'Authentic seal', '正品标签', '正規品シール', '정품 씰')}</button>
                        <button type="button" onClick={() => setSealType('bao-hanh')} className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded-md border text-sm font-medium transition-colors cursor-pointer select-none touch-manipulation ${sealType === 'bao-hanh' ? 'border-rose-500 bg-rose-50 text-rose-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'}`}>{tr('Tem bảo hành', 'Warranty seal', '保修标签', '保証シール', '보증 씰')}</button>
                        <button type="button" onClick={() => setSealType('niem-phong')} className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded-md border text-sm font-medium transition-colors cursor-pointer select-none touch-manipulation ${sealType === 'niem-phong' ? 'border-rose-500 bg-rose-50 text-rose-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'}`}>{tr('Tem liêm phong', 'Security seal', '封条', '封印', '봉인')}</button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">{tr('Dòng chính', 'Main text', '主文字', 'メインテキスト', '메인 텍스트')}</label>
                      <Input value={mainText} onChange={(e) => setMainText(e.target.value)} placeholder={sealType === 'chinh-hang' ? 'HÀNG CHÍNH HÃNG' : sealType === 'bao-hanh' ? 'BẢO HÀNH' : 'TEM LIÊM PHONG'} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">{tr('Tên thương hiệu (tùy chọn)', 'Brand name (optional)', '品牌名称（可选）', 'ブランド名（任意）', '브랜드명 (선택)')}</label>
                      <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Công ty ABC" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">{tr('Tên sản phẩm (tùy chọn)', 'Product name (optional)', '产品名称（可选）', '商品名（任意）', '제품명 (선택)')}</label>
                      <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder={tr('Ví dụ: Điện thoại XYZ', 'e.g. Phone XYZ', '例如：手机 XYZ', '例: スマホ XYZ', '예: 폰 XYZ')} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">{tr('Màu cơ bản tem (tùy chọn)', 'Seal base color (optional)', '标签主色（可选）', 'シール基本色（任意）', '씰 기본색 (선택)')}</label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: 'do', label: tr('Đỏ', 'Red', '红', '赤', '빨강') },
                          { value: 'xanh-la', label: tr('Xanh lá', 'Green', '绿', '緑', '초록') },
                          { value: 'xanh-duong', label: tr('Xanh dương', 'Blue', '蓝', '青', '파랑') },
                          { value: 'vang', label: tr('Vàng', 'Yellow', '黄', '黄', '노랑') },
                          { value: 'trang', label: tr('Trắng', 'White', '白', '白', '흰색') },
                          { value: 'den', label: tr('Đen', 'Black', '黑', '黒', '검정') },
                          { value: 'cam', label: tr('Cam', 'Orange', '橙', 'オレンジ', '주황') },
                        ].map((c) => (
                          <button key={c.value} type="button" onClick={() => setSealColor(sealColor === c.value ? '' : c.value)} className={`min-h-[36px] px-3 py-1.5 rounded-md border text-xs font-medium transition-colors cursor-pointer touch-manipulation ${sealColor === c.value ? 'border-rose-500 bg-rose-50 text-rose-800 ring-1 ring-rose-500' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'}`}>{c.label}</button>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="space-y-1 shrink-0">
                        <label className="text-xs font-medium text-muted-foreground block">{tr('Logo (tùy chọn)', 'Logo (optional)', 'Logo（可选）', 'ロゴ（任意）', '로고 (선택)')}</label>
                        <label htmlFor="ai-seal-logo" className="flex w-24 h-24 rounded-lg border-2 border-dashed border-rose-200 bg-rose-50/60 flex-col items-center justify-center gap-1 cursor-pointer hover:border-rose-300 hover:bg-rose-50/80 transition-colors">
                          {logo.preview ? (
                            <div className="relative w-full h-full flex items-center justify-center p-2">
                              <ImagePreview src={logo.preview} alt="Logo" className="w-full h-full object-contain" />
                              <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLogo({ file: null, preview: null }) }} className="absolute -top-1 -right-1 p-0.5 rounded-full bg-red-500/90 text-white hover:bg-red-600"><X className="h-3 w-3" /></button>
                            </div>
                          ) : (
                            <>
                              <Upload className="h-6 w-6 text-rose-500" />
                              <p className="text-[10px] text-muted-foreground font-medium leading-tight text-center">{tr('Logo', 'Logo', '标志', 'ロゴ', '로고')}</p>
                            </>
                          )}
                        </label>
                        <input id="ai-seal-logo" ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f?.type.startsWith('image/')) setLogo({ file: f, preview: URL.createObjectURL(f) }); e.target.value = '' }} />
                      </div>
                    </div>
                    {sealType === 'bao-hanh' && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">{tr('Hạn bảo hành', 'Warranty validity', '保修期限', '保証期限', '보증 기한')}</label>
                        <Input value={validityDate} onChange={(e) => setValidityDate(e.target.value)} placeholder="01/01/2026" />
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">{tr('Tỷ lệ / Chất lượng', 'Aspect / Quality', '比例/质量', '比率・画質', '비율·화질')}</label>
                      <div className="flex flex-wrap gap-2">
                        {ASPECT_RATIOS.map((r) => (
                          <button key={r.value} type="button" onClick={() => setAspectRatio(r.value)} className={`px-2 py-1.5 rounded-md border text-xs transition-colors ${aspectRatio === r.value ? 'border-rose-500 bg-rose-50 text-rose-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'}`}>{r.label}</button>
                        ))}
                        <button type="button" onClick={() => setImageQuality('2K')} className={`px-2 py-1.5 rounded-md border text-xs transition-colors ${imageQuality === '2K' ? 'border-rose-500 bg-rose-50 text-rose-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'}`}>2K (1.5)</button>
                        <button type="button" onClick={() => setImageQuality('4K')} className={`px-2 py-1.5 rounded-md border text-xs transition-colors ${imageQuality === '4K' ? 'border-rose-500 bg-rose-50 text-rose-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'}`}>4K (3)</button>
                      </div>
                    </div>
                    <Button onClick={() => checkCreditsAndProceed(cost, () => void handleSubmit())} disabled={false} className="w-full bg-rose-600 hover:bg-rose-700 text-white">
                      <Sparkles className="h-4 w-4 mr-2" />
                      {tr('Tạo tem bằng AI', 'Create seal with AI', 'AI 创建标签', 'AIでシール作成', 'AI로 씰 만들기')} ({cost} credits)
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

        <p className="text-xs text-muted-foreground text-center">
          {tr('Tem phù hợp in trên giấy decal, giấy nhiệt. Dùng cho niêm phong sản phẩm, bảo hành.', 'Label suitable for decal paper, thermal paper. For product sealing, warranty.', '标签适合打印在贴纸、热敏纸上。用于产品封条、保修。', 'ラベルはデカール紙・感熱紙に印刷可能。製品封印・保証に使用。', '라벨은 데칼지, 감열지에 인쇄 가능. 제품 봉인·보증용.')}
        </p>
      </div>
    </>
  )
}
