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
import {
  type StampType,
  STAMP_TYPES,
  SHAPE_OPTIONS,
  COLOR_OPTIONS,
  SIZE_OPTIONS_MM,
  SHAPE_TO_ASPECT_RATIO,
} from './lib/stamp-types'
import { createStampWithAI } from './actions'
import { useCredits } from '@/hooks/use-credits'
import { preloadImageUrl } from '@/lib/preload-image-url'

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

export default function ThietKeConDauClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [step, setStep] = useState<Step>('INPUT')
  const stepContentRef = useRef<HTMLDivElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()

  const [stampType, setStampType] = useState<StampType>('doanh-nghiep')
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [shape, setShape] = useState('tron')
  const [color, setColor] = useState('do')
  const [sizeMm, setSizeMm] = useState(25)
  const [logo, setLogo] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const aspectRatio = SHAPE_TO_ASPECT_RATIO[shape] || '1:1'
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
    const cfg = STAMP_TYPES[stampType]
    if (cfg.defaultMainText) {
      setFormData((prev) => ({ ...prev, mainText: cfg.defaultMainText! }))
    }
  }, [stampType])

  useEffect(() => {
    if (step === 'GENERATING' && stepContentRef.current) {
      stepContentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [step])

  const handleFieldChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async () => {
    const cfg = STAMP_TYPES[stampType]
    const missing = cfg.fields.filter((f) => f.required && !(formData[f.key]?.trim()))
    if (missing.length > 0) {
      toast({
        title: tr('Thiếu thông tin', 'Missing information', '缺少信息', '情報不足', '정보 누락'),
        description: tr('Vui lòng điền đầy đủ các trường bắt buộc.', 'Please fill in all required fields.', '请填写所有必填项。', '必須項目を入力してください。', '필수 항목을 입력해 주세요.'),
        variant: 'destructive',
      })
      return
    }
    setStep('GENERATING')
    const fd = new FormData()
    fd.append('stampType', stampType)
    fd.append('shape', shape)
    fd.append('color', color)
    fd.append('sizeMm', String(sizeMm))
    fd.append('aspectRatio', aspectRatio)
    fd.append('imageQuality', imageQuality)
    Object.entries(formData).forEach(([k, v]) => v && fd.append(k, v.trim()))
    if (logo.file) fd.append('logo', logo.file)
    const result = await createStampWithAI(fd)
    if (result.error) {
      setStep('INPUT')
      toast({
        title: tr('Tạo con dấu thất bại', 'Create stamp failed', '创建印章失败', 'スタンプ作成に失敗', '스탬프 생성 실패'),
        description: result.error,
        variant: 'destructive',
        duration: 5000,
      })
    } else if (result.success && result.resultUrl) {
      await preloadImageUrl(result.resultUrl)
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      window.dispatchEvent(new Event('credits-updated'))
      toast({
        title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'),
        description: tr('Con dấu đã được tạo.', 'Stamp has been created.', '印章已创建。', 'スタンプを作成しました。', '스탬프가 생성되었습니다.'),
        duration: 3000,
      })
    }
  }

  const handleReset = () => {
    setStep('INPUT')
    setFormData({})
    setLogo({ file: null, preview: null })
    setResultUrl(null)
  }

  const stampTypeLabels: Record<StampType, { vi: string; en: string; zh: string; ja: string; ko: string }> = {
    'doanh-nghiep': { vi: 'Con dấu doanh nghiệp', en: 'Company stamp', zh: '企业印章', ja: '会社印', ko: '회사 도장' },
    'chi-nhanh': { vi: 'Con dấu chi nhánh', en: 'Branch stamp', zh: '分公司印章', ja: '支店印', ko: '지점 도장' },
    'chuc-danh': { vi: 'Con dấu chức danh', en: 'Title stamp', zh: '职务印章', ja: '役職印', ko: '직함 도장' },
    'dia-chi': { vi: 'Con dấu địa chỉ', en: 'Address stamp', zh: '地址印章', ja: '住所印', ko: '주소 도장' },
    'da-thu-tien': { vi: 'Dấu đã thu tiền', en: 'Paid stamp', zh: '已收款章', ja: '入金済印', ko: '입금 완료 도장' },
    'trang-tri': { vi: 'Con dấu trang trí', en: 'Decorative stamp', zh: '装饰印章', ja: '装飾スタンプ', ko: '장식 스탬프' },
  }

  const fieldLabels: Record<string, { vi: string; en: string; zh: string; ja: string; ko: string }> = {
    companyName: { vi: 'Tên doanh nghiệp', en: 'Company name', zh: '企业名称', ja: '会社名', ko: '회사명' },
    taxCode: { vi: 'Mã số thuế', en: 'Tax code', zh: '税号', ja: '税番号', ko: '사업자등록번호' },
    branchName: { vi: 'Tên chi nhánh', en: 'Branch name', zh: '分公司名称', ja: '支店名', ko: '지점명' },
    position: { vi: 'Chức danh', en: 'Position/Title', zh: '职务', ja: '役職', ko: '직함' },
    address: { vi: 'Địa chỉ', en: 'Address', zh: '地址', ja: '住所', ko: '주소' },
    mainText: { vi: 'Nội dung chính', en: 'Main content', zh: '主要内容', ja: 'メイン内容', ko: '메인 내용' },
    subText: { vi: 'Nội dung phụ', en: 'Sub content', zh: '次要内容', ja: 'サブ内容', ko: '부가 내용' },
  }

  const shapeLabels: Record<string, string> = {
    tron: tr('Tròn', 'Circle', '圆形', '円形', '원형'),
    vuong: tr('Vuông', 'Square', '方形', '四角', '사각형'),
    elip: tr('Elip', 'Ellipse', '椭圆', '楕円', '타원'),
    'chu-nhat': tr('Chữ nhật', 'Rectangle', '矩形', '長方形', '직사각형'),
  }

  const colorLabels: Record<string, string> = {
    do: tr('Đỏ', 'Red', '红', '赤', '빨강'),
    'xanh-la': tr('Xanh lá', 'Green', '绿', '緑', '초록'),
    'xanh-duong': tr('Xanh dương', 'Blue', '蓝', '青', '파랑'),
    den: tr('Đen', 'Black', '黑', '黒', '검정'),
    vang: tr('Vàng', 'Yellow', '黄', '黄', '노랑'),
    cam: tr('Cam', 'Orange', '橙', 'オレンジ', '주황'),
  }

  const getFieldLabel = (key: string) => {
    const l = fieldLabels[key]
    if (!l) return key
    return tr(l.vi, l.en, l.zh, l.ja, l.ko)
  }

  const getPlaceholder = (key: string) => {
    const placeholders: Record<string, string> = {
      company: 'CÔNG TY TNHH ABC',
      tax_code: '0123456789',
      address: '123 Đường ABC, Quận 1, TP.HCM',
      branch: 'CHI NHÁNH TP.HCM',
      position: 'GIÁM ĐỐC',
      main_content: 'Nội dung tùy ý',
      main_da_thu_tien: 'ĐÃ THU TIỀN',
      sub_content: 'Ngày, số tiền (tùy chọn)',
    }
    return placeholders[key] || ''
  }

  const cfg = STAMP_TYPES[stampType]

  return (
    <>
      <Toaster />
      <div className="tool-page-container">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">
            {tr('Thiết kế con dấu bằng AI', 'AI Stamp Design', 'AI 印章设计', 'AI スタンプデザイン', 'AI 스탬프 디자인')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {tr(
              'Con dấu doanh nghiệp, chi nhánh, chức danh, địa chỉ, đã thu tiền, trang trí. Hình tròn, vuông, elip, chữ nhật. Tỷ lệ tự động theo hình dạng.',
              'Company, branch, title, address, paid stamps, decorative. Circle, square, ellipse, rectangle. Aspect ratio auto by shape.',
              '企业、分公司、职务、地址、已收款、装饰印章。圆形、方形、椭圆、矩形。比例随形状自动。',
              '会社印、支店印、役職印、住所印、入金済印、装飾スタンプ。円形、四角、楕円、長方形。比率は形状で自動。',
              '회사, 지점, 직함, 주소, 입금 완료, 장식 도장. 원형, 사각, 타원, 직사각형. 비율은 모양에 따라 자동.'
            )}
          </p>
        </div>

        <div ref={stepContentRef}>
          {step === 'GENERATING' && (
            <div className="flex flex-col items-center justify-center py-12">
              <ImageProcessingLoader
                mode="seal"
                title={tr('Đang tạo con dấu', 'Creating stamp', '正在创建印章', 'スタンプ作成中', '스탬프 생성 중')}
                description={tr('AI đang thiết kế con dấu chuyên nghiệp', 'AI is designing professional stamp', 'AI 正在设计专业印章', 'AIがプロのスタンプをデザイン中', 'AI가 전문 스탬프 디자인 중')}
              />
              <p className="text-sm text-muted-foreground mt-4">{tr('AI đang tạo...', 'AI is creating...', 'AI 正在创建...', 'AIが作成中...', 'AI가 생성 중...')}</p>
            </div>
          )}
        </div>

        {step === 'RESULT' && resultUrl && (
          <div className="max-w-2xl mx-auto space-y-4">
            <Card className="border shadow-sm overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-center bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#f9fafb_0%_50%)] bg-[length:12px_12px] rounded-lg border p-4">
                  <img src={resultUrl} alt={tr('Con dấu đã tạo', 'Created stamp', '已创建印章', '作成したスタンプ', '생성된 스탬프')} className="max-w-full max-h-[400px] object-contain rounded shadow" />
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  <a href={resultUrl} download="con-dau-ai.png" className="inline-flex items-center gap-2 px-4 py-2 rounded-md border bg-white hover:bg-gray-50 text-sm font-medium">
                    <Download className="h-3 w-3" /> {tr('Tải PNG', 'Download PNG', '下载 PNG', 'PNGをダウンロード', 'PNG 다운로드')}
                  </a>
                  <DownloadImageButton
                    imageUrl={resultUrl}
                    filename="con-dau-ai"
                    printReady
                    printReadyAspectRatio={aspectRatio}
                    printReadyLabel={tr('Tải PDF chuẩn in', 'Download print-ready PDF', '下载印刷用PDF', '印刷用PDFをダウンロード', '인쇄용 PDF 다운로드')}
                    printReadySuccessToast={tr('Đã tạo PDF chuẩn in.', 'Print-ready PDF created.', '已生成印刷用PDF。', '印刷用PDFを作成しました。', '인쇄용 PDF 생성됨.')}
                  />
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    {tr('Tạo mới', 'Create new', '新建', '新規作成', '새로 만들기')}
                  </Button>
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
                  {tr('AI thiết kế con dấu', 'AI design stamp', 'AI 设计印章', 'AIスタンプデザイン', 'AI 스탬프 디자인')}
                </CardTitle>
                <CardDescription>
                  {tr('Chọn loại con dấu, nhập thông tin. AI tạo mẫu chuyên nghiệp. 1,5–3 credits/lượt.', 'Choose stamp type, enter info. AI creates professional design. 1.5–3 credits/creation.', '选择印章类型，输入信息。AI 生成专业设计。1.5–3 积分/次。', 'スタンプ種類を選び、情報を入力。AIがプロのデザインを作成。1.5〜3クレジット/回。', '스탬프 유형 선택, 정보 입력. AI가 전문 디자인 생성. 1.5–3 크레딧/회.')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Loại con dấu', 'Stamp type', '印章类型', 'スタンプ種類', '스탬프 유형')}</label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(STAMP_TYPES) as StampType[]).map((t) => {
                      const l = stampTypeLabels[t]
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setStampType(t)}
                          className={`min-h-[44px] px-3 py-2 rounded-md border text-sm font-medium transition-colors cursor-pointer select-none touch-manipulation ${
                            stampType === t ? 'border-rose-500 bg-rose-50 text-rose-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                          }`}
                        >
                          {tr(l.vi, l.en, l.zh, l.ja, l.ko)}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {cfg.fields.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      {getFieldLabel(f.key)}
                      {f.required && ' *'}
                    </label>
                    <Input
                      value={formData[f.key] ?? ''}
                      onChange={(e) => handleFieldChange(f.key, e.target.value)}
                      placeholder={
                        f.key === 'companyName'
                          ? getPlaceholder('company')
                          : f.key === 'taxCode'
                            ? getPlaceholder('tax_code')
                            : f.key === 'address'
                              ? getPlaceholder('address')
                              : f.key === 'branchName'
                                ? getPlaceholder('branch')
                                : f.key === 'position'
                                  ? getPlaceholder('position')
                                    : f.key === 'mainText'
                                    ? stampType === 'da-thu-tien'
                                      ? getPlaceholder('main_da_thu_tien')
                                      : getPlaceholder('main_content')
                                    : f.key === 'subText'
                                    ? getPlaceholder('sub_content')
                                    : ''
                      }
                    />
                  </div>
                ))}

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Hình dạng', 'Shape', '形状', '形状', '모양')}</label>
                  <div className="flex flex-wrap gap-2">
                    {SHAPE_OPTIONS.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setShape(s.value)}
                        className={`px-2 py-1.5 rounded-md border text-xs transition-colors ${shape === s.value ? 'border-rose-500 bg-rose-50 text-rose-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'}`}
                      >
                        {shapeLabels[s.value]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Màu sắc', 'Color', '颜色', '色', '색상')}</label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setColor(c.value)}
                        className={`min-h-[36px] px-3 py-1.5 rounded-md border text-xs font-medium transition-colors cursor-pointer touch-manipulation ${
                          color === c.value ? 'border-rose-500 bg-rose-50 text-rose-800 ring-1 ring-rose-500' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        {colorLabels[c.value]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Kích thước (mm)', 'Size (mm)', '尺寸 (mm)', 'サイズ (mm)', '크기 (mm)')}</label>
                  <div className="flex flex-wrap gap-2">
                    {SIZE_OPTIONS_MM.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSizeMm(s)}
                        className={`px-2 py-1.5 rounded-md border text-xs transition-colors ${sizeMm === s ? 'border-rose-500 bg-rose-50 text-rose-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'}`}
                      >
                        {s} mm
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="space-y-1 shrink-0">
                    <label className="text-xs font-medium text-muted-foreground block">{tr('Logo (tùy chọn)', 'Logo (optional)', 'Logo（可选）', 'ロゴ（任意）', '로고 (선택)')}</label>
                    <label
                      htmlFor="stamp-logo"
                      className="flex w-24 h-24 rounded-lg border-2 border-dashed border-rose-200 bg-rose-50/60 flex-col items-center justify-center gap-1 cursor-pointer hover:border-rose-300 hover:bg-rose-50/80 transition-colors"
                    >
                      {logo.preview ? (
                        <div className="relative w-full h-full flex items-center justify-center p-2">
                          <ImagePreview src={logo.preview} alt="Logo" className="w-full h-full object-contain" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setLogo({ file: null, preview: null })
                            }}
                            className="absolute -top-1 -right-1 p-0.5 rounded-full bg-red-500/90 text-white hover:bg-red-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <Upload className="h-6 w-6 text-rose-500" />
                          <p className="text-[10px] text-muted-foreground font-medium leading-tight text-center">{tr('Logo', 'Logo', '标志', 'ロゴ', '로고')}</p>
                        </>
                      )}
                    </label>
                    <input
                      id="stamp-logo"
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f?.type.startsWith('image/')) setLogo({ file: f, preview: URL.createObjectURL(f) })
                        e.target.value = ''
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Chất lượng', 'Quality', '质量', '画質', '화질')}</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setImageQuality('2K')}
                      className={`px-2 py-1.5 rounded-md border text-xs transition-colors ${imageQuality === '2K' ? 'border-rose-500 bg-rose-50 text-rose-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'}`}
                    >
                      2K (1.5)
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageQuality('4K')}
                      className={`px-2 py-1.5 rounded-md border text-xs transition-colors ${imageQuality === '4K' ? 'border-rose-500 bg-rose-50 text-rose-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'}`}
                    >
                      4K (3)
                    </button>
                  </div>
                </div>

                <Button onClick={() => checkCreditsAndProceed(cost, () => void handleSubmit())} disabled={false} className="w-full bg-rose-600 hover:bg-rose-700 text-white">
                  <Sparkles className="h-4 w-4 mr-2" />
                  {tr('Tạo con dấu bằng AI', 'Create stamp with AI', 'AI 创建印章', 'AIでスタンプ作成', 'AI로 스탬프 만들기')} ({cost} credits)
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          {tr(
            'Con dấu phù hợp in trên cao su, nhựa.',
            'Stamps suitable for rubber, plastic.',
            '印章适合橡胶、塑料印刷。',
            'スタンプはゴム・プラスチックに適しています。',
            '도장은 고무, 플라스틱 인쇄에 적합.'
          )}
        </p>
      </div>
    </>
  )
}
