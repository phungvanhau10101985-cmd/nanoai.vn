'use client'

import { useState, useRef, ChangeEvent, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { createLogo } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, RefreshCw } from 'lucide-react'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { DownloadImageButton } from '@/components/download-image-button'
import { ImagePreview } from '@/components/ui/image-preview'
import { ImageProcessingLoader } from '@/components/image-processing-loader'
import { preloadImageUrl } from '@/lib/preload-image-url'

type Step = 'UPLOAD' | 'GENERATING' | 'RESULT'
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

const LOGO_ASPECT_RATIOS = [
  { value: '1:1', label: '1:1 Vuông' },
  { value: '4:3', label: '4:3 Ngang' },
  { value: '3:4', label: '3:4 Dọc' },
  { value: '16:9', label: '16:9 Ngang rộng' },
  { value: '9:16', label: '9:16 Dọc rộng' },
  { value: '3:2', label: '3:2 Ngang' },
  { value: '2:3', label: '2:3 Dọc' },
] as const

export default function ThietKeLogoClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [step, setStep] = useState<Step>('UPLOAD')
  const [note, setNote] = useState('')
  const [image, setImage] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const [aspectRatio, setAspectRatio] = useState<string>('1:1')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const fileInputRef = useRef<HTMLInputElement>(null)
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
    window.addEventListener('focus', syncLocale)
    document.addEventListener('visibilitychange', syncLocale)
    return () => {
      window.removeEventListener('focus', syncLocale)
      document.removeEventListener('visibilitychange', syncLocale)
      window.clearInterval(timer)
    }
  }, [])

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file?.type.startsWith('image/')) {
      setImage({ file, preview: URL.createObjectURL(file) })
    }
  }

  const handleSubmit = async () => {
    if (!note.trim() && !image.file) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Vui lòng mô tả thương hiệu/logo hoặc tải ảnh tham khảo.', 'Please describe your brand/logo or upload a reference image.', '请描述品牌/Logo或上传参考图。', 'ブランド/ロゴを説明するか参考画像をアップロードしてください。', '브랜드/로고 설명 또는 참고 이미지를 업로드해 주세요.'), variant: 'destructive' })
      return
    }
    setStep('GENERATING')
    const formData = new FormData()
    formData.append('imageQuality', imageQuality)
    formData.append('aspectRatio', aspectRatio)
    formData.append('note', note)
    if (image.file) formData.append('image', image.file)
    const result = await createLogo(formData)
    if (result.error) {
      setStep('UPLOAD')
      toast({ title: tr('Thiết kế logo thất bại', 'Logo generation failed', 'Logo 生成失败', 'ロゴ生成に失敗しました', '로고 생성 실패'), description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      await preloadImageUrl(result.resultUrl)
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      toast({ title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'), description: tr('Logo đã được tạo.', 'Logo has been generated.', 'Logo 已生成。', 'ロゴを生成しました。', '로고가 생성되었습니다.'), duration: 3000 })
    }
  }

  const handleReset = () => {
    setStep('UPLOAD')
    setNote('')
    setImage({ file: null, preview: null })
    setAspectRatio('1:1')
    setResultUrl(null)
  }

  return (
    <>
      <Toaster />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">{tr('Thiết kế logo thương hiệu', 'Brand Logo Design', '品牌 Logo 设计', 'ブランドロゴデザイン', '브랜드 로고 디자인')}</h1>
          <p className="text-muted-foreground mt-1">{tr('Mô tả thương hiệu, tải ảnh tham khảo. AI tạo logo chuyên nghiệp. 1,5-3 credits/ảnh.', 'Describe your brand, upload references, and let AI create professional logos. 1.5-3 credits/image.', '描述品牌并上传参考图，AI 生成专业 Logo。1.5-3 credits/张。', 'ブランド説明と参考画像でAIがロゴを生成。1.5-3 credits/枚。', '브랜드 설명과 참고 이미지로 AI가 로고를 생성합니다. 1.5-3 credits/장.')}</p>
        </div>

        {step === 'UPLOAD' && (
          <div className="grid lg:grid-cols-[1fr_240px] gap-4 items-start">
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-amber-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="h-4 w-4 text-amber-600" /> {tr('Thông tin thương hiệu', 'Brand information', '品牌信息', 'ブランド情報', '브랜드 정보')}
                  </CardTitle>
                  <CardDescription className="text-xs">{tr('Mô tả tên, ngành nghề, phong cách. Có thể tải ảnh tham khảo (tùy chọn).', 'Describe name, industry, style. Optional reference image.', '描述名称、行业、风格。可上传参考图（可选）。', '名前・業種・スタイルを説明。参考画像は任意。', '이름, 업종, 스타일을 설명하세요. 참고 이미지 선택 가능.')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Yêu cầu thêm', 'Additional requirements', '附加要求', '追加要望', '추가 요청')}</h4>
                    <Textarea
                      placeholder={tr('Ví dụ: Cafe ABC, logo cốc cà phê, tông màu nâu, minimalist, kèm chữ...', 'e.g. Cafe ABC, coffee cup logo, brown tones, minimalist, with text...', '例如：Cafe ABC、咖啡杯 logo、棕色调、极简、带文字...', '例：Cafe ABC、コーヒーカップロゴ、茶色、ミニマル、文字入り...', '예: Cafe ABC, 커피잔 로고, 갈색 톤, 미니멀, 텍스트 포함...')}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="bg-white/80 text-xs h-24 min-h-[96px] resize-y"
                    />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Ảnh tham khảo (tùy chọn)', 'Reference image (optional)', '参考图（可选）', '参考画像（任意）', '참고 이미지 (선택)')}</h4>
                    <label
                      htmlFor="logo-input"
                      className="block w-full aspect-[4/3] max-h-[200px] rounded-lg border-2 border-dashed border-amber-200 bg-amber-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-amber-300 hover:bg-amber-50/80 transition-colors"
                    >
                      {image.preview ? (
                        <ImagePreview src={image.preview} alt={tr('Tham khảo', 'Reference', '参考', '参考', '참고')} className="w-full h-full object-contain rounded-lg" />
                      ) : (
                        <>
                          <Upload className="h-10 w-10 text-amber-500" />
                          <p className="text-sm text-muted-foreground font-medium">{tr('Chọn ảnh tham khảo (tùy chọn)', 'Select reference image (optional)', '选择参考图（可选）', '参考画像を選択（任意）', '참고 이미지 선택 (선택)')}</p>
                        </>
                      )}
                    </label>
                    <input
                      id="logo-input"
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageChange}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="lg:w-[240px] lg:shrink-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-amber-200/60 h-full">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">{tr('Tùy chọn', 'Options', '选项', 'オプション', '옵션')}</CardTitle>
                  <CardDescription className="text-xs">{tr('Chọn tỷ lệ logo và chất lượng xuất ảnh.', 'Choose logo ratio and output quality.', '选择 Logo 比例和输出质量。', 'ロゴ比率と画質を選択。', '로고 비율과 화질을 선택하세요.')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Tỷ lệ logo', 'Logo ratio', 'Logo 比例', 'ロゴ比率', '로고 비율')}</h4>
                    <div className="grid grid-cols-2 gap-1.5">
                      {LOGO_ASPECT_RATIOS.map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setAspectRatio(r.value)}
                          className={`px-2 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                            aspectRatio === r.value ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                          }`}
                        >
                          {tr(...r.labels)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Chất lượng ảnh', 'Image quality', '图片质量', '画質', '이미지 품질')}</h4>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setImageQuality('2K')}
                        className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                          imageQuality === '2K' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        2K (1,5)
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageQuality('4K')}
                        className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                          imageQuality === '4K' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        4K (3)
                      </button>
                    </div>
                  </div>
                  <div className="pt-4 border-t space-y-2 flex flex-col items-center">
                    <DepositCreditButton variant="outline" size="sm" className="w-full max-w-[180px] border-amber-200 text-amber-700 hover:bg-amber-50" />
                    <Button
                      onClick={() => checkCreditsAndProceed(cost, handleSubmit)}
                      disabled={!note.trim() && !image.file}
                      className="w-full max-w-[180px] h-9 shadow-md hover:shadow-lg transition-all text-sm bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> {tr('Tạo logo', 'Create logo', '生成 Logo', 'ロゴを作成', '로고 생성')} ({imageQuality === '2K' ? '1,5' : '3'} credit)
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground mt-2">* {tr('Thời gian: 15–45 giây', 'Time: 15–45 seconds', '时间：15–45 秒', '時間：15–45秒', '시간: 15–45초')}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === 'GENERATING' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-amber-200/60">
            <CardContent className="flex flex-col items-center py-8">
              <ImageProcessingLoader
                mode="logo"
                title={tr('Đang thiết kế logo', 'Designing logo', '正在设计 Logo', 'ロゴをデザイン中', '로고 디자인 중')}
                description={tr('AI đang tạo logo thương hiệu chuyên nghiệp', 'AI is creating professional brand logo', 'AI 正在生成专业品牌 Logo', 'AIがプロのロゴを生成中', 'AI가 전문 브랜드 로고를 생성 중입니다')}
                imagePreview={image.preview}
              />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>{tr('Kết quả logo', 'Logo result', 'Logo 结果', 'ロゴ結果', '로고 결과')}</CardTitle>
              <CardDescription>{tr('Logo đã được tạo.', 'Logo has been generated.', 'Logo 已生成。', 'ロゴを生成しました。', '로고가 생성되었습니다.')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">{tr('Kết quả', 'Result', '结果', '結果', '결과')}</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleReset}>
                    <RefreshCw className="mr-2 h-3 w-3" /> {tr('Thử lại', 'Try again', '重试', 'やり直す', '다시 시도')}
                  </Button>
                  <DownloadImageButton
                    imageUrl={resultUrl}
                    filename="logo-result"
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white border-0"
                    printReady
                    printReadyAspectRatio={aspectRatio}
                    printReadyLabel={tr('Tải PDF chuẩn in', 'Download print-ready PDF', '下载印刷用PDF', '印刷用PDFをダウンロード', '인쇄용 PDF 다운로드')}
                    printReadySuccessToast={tr('Đã tạo PDF chuẩn in. Bleed 3mm, crop marks.', 'Print-ready PDF created. Bleed 3mm, crop marks.', '已生成印刷用PDF。出血3mm，裁切线。', '印刷用PDFを作成しました。塗り足し3mm、トンボ付き。', '인쇄용 PDF 생성됨. 블리드 3mm, 크롭 마크.')}
                  />
                </div>
              </div>
              <div
                className="max-w-md mx-auto rounded-lg border overflow-hidden bg-white p-8"
                style={{ aspectRatio: aspectRatio.replace(':', '/') }}
              >
                <ImagePreview src={resultUrl} alt={tr('Logo', 'Logo', 'Logo', 'ロゴ', '로고')} className="w-full h-full object-contain" printReadyAspectRatio={aspectRatio} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">{tr('Ảnh do AI tạo có thể có sai sót.', 'AI-generated images may contain minor errors.', 'AI 生成结果可能存在误差。', 'AI生成結果には誤差が含まれる場合があります。', 'AI 생성 결과에는 오차가 있을 수 있습니다.')}</p>
    </>
  )
}
