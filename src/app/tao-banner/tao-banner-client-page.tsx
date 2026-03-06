'use client'

import { useState, useRef, ChangeEvent, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { createBanner } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, RefreshCw, Plus, X, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
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

const MAX_PRODUCT_IMAGES = 13

const BANNER_ASPECT_RATIOS = [
  { value: '16:9', label: '16:9 Web/Header' },
  { value: '21:9', label: '21:9 Siêu rộng' },
  { value: '4:3', label: '4:3 Ngang' },
  { value: '3:4', label: '3:4 Dọc' },
  { value: '9:16', label: '9:16 Story' },
  { value: '1:1', label: '1:1 Vuông' },
  { value: '3:2', label: '3:2 Ngang' },
  { value: '2:3', label: '2:3 Dọc' },
] as const

export default function TaoBannerClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [step, setStep] = useState<Step>('UPLOAD')
  const [note, setNote] = useState('')
  const [images, setImages] = useState<{ file: File; preview: string; removeBackground: boolean; caption: string }[]>([])
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const [aspectRatio, setAspectRatio] = useState<string>('16:9')
  const [logo, setLogo] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cost = imageQuality === '2K' ? 1.5 : 3
  const logoInputRef = useRef<HTMLInputElement>(null)
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

  const handleAddImages = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    const newImages: { file: File; preview: string; removeBackground: boolean }[] = []
    for (let i = 0; i < files.length && images.length + newImages.length < MAX_PRODUCT_IMAGES; i++) {
      const file = files[i]
      if (file.type.startsWith('image/')) {
        newImages.push({ file, preview: URL.createObjectURL(file), removeBackground: true, caption: '' })
      }
    }
    if (newImages.length) {
      setImages((prev) => [...prev, ...newImages].slice(0, MAX_PRODUCT_IMAGES))
      toast({ title: tr('Đã thêm ảnh', 'Images added', '已添加图片', '画像を追加しました', '이미지를 추가했습니다'), description: tr(`Thêm ${newImages.length} ảnh sản phẩm.`, `Added ${newImages.length} product images.`, `已添加 ${newImages.length} 张产品图片。`, `${newImages.length}枚の商品画像を追加しました。`, `${newImages.length}장의 제품 이미지를 추가했습니다.`), duration: 2000 })
    }
    e.target.value = ''
  }

  const handleRemove = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (images.length === 0) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Vui lòng tải lên ít nhất 1 ảnh sản phẩm.', 'Please upload at least 1 product image.', '请至少上传 1 张产品图片。', '少なくとも1枚の商品画像をアップロードしてください。', '최소 1장의 제품 이미지를 업로드해 주세요.'), variant: 'destructive' })
      return
    }
    setStep('GENERATING')
    const formData = new FormData()
    formData.append('imageQuality', imageQuality)
    formData.append('aspectRatio', aspectRatio)
    formData.append('note', note)
    if (logo.file) formData.append('logo', logo.file)
    images.forEach((img, i) => {
      formData.append(`image_${i}`, img.file)
      formData.append(`image_${i}_removeBg`, String(img.removeBackground))
      formData.append(`image_${i}_caption`, img.caption || '')
    })
    const result = await createBanner(formData)
    if (result.error) {
      setStep('UPLOAD')
      toast({ title: tr('Tạo banner thất bại', 'Create banner failed', '创建横幅失败', 'バナー作成に失敗しました', '배너 생성 실패'), description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      await preloadImageUrl(result.resultUrl)
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      toast({ title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'), description: tr('Banner đã được tạo.', 'Banner has been created.', '横幅已创建。', 'バナーを作成しました。', '배너가 생성되었습니다.'), duration: 3000 })
    }
  }

  const handleReset = () => {
    setStep('UPLOAD')
    setNote('')
    setImages([])
    setLogo({ file: null, preview: null })
    setAspectRatio('16:9')
    setResultUrl(null)
  }

  return (
    <>
      <Toaster />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">{tr('Tạo banner quảng cáo', 'Create ad banner', '创建广告横幅', '広告バナーを作成', '광고 배너 만들기')}</h1>
          <p className="text-muted-foreground mt-1">{tr('Tải ảnh sản phẩm kinh doanh (tối đa 13 ảnh). AI tạo banner chuyên nghiệp. 1,5–3 credits/ảnh.', 'Upload product images (max 13). AI creates professional banners. 1.5–3 credits/image.', '上传产品图片（最多 13 张）。AI 创建专业横幅。 1.5–3 积分/张。', '商品画像をアップロード（最大13枚）。AIがプロのバナーを作成。1.5〜3クレジット/枚。', '제품 이미지 업로드 (최대 13장). AI가 전문 배너를 생성합니다. 1.5–3 크레딧/장.')}</p>
        </div>

        {step === 'UPLOAD' && (
          <div className="grid lg:grid-cols-[1fr_240px] gap-4 items-start">
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-amber-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="h-4 w-4 text-amber-600" /> {tr('Ảnh sản phẩm (tối đa 13)', 'Product images (max 13)', '产品图片（最多 13 张）', '商品画像（最大13枚）', '제품 이미지 (최대 13장)')}
                  </CardTitle>
                  <CardDescription className="text-xs">{tr('Tải ảnh sản phẩm khách hàng kinh doanh. AI tạo banner từ sản phẩm.', 'Upload customer product images. AI creates banner from products.', '上传客户产品图片。AI 将基于产品生成横幅。', '顧客の商品画像をアップロード。AIが商品からバナーを作成します。', '고객 제품 이미지를 업로드하세요. AI가 제품 기반 배너를 생성합니다.')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider shrink-0">{tr('Logo (tùy chọn)', 'Logo (optional)', 'Logo（可选）', 'ロゴ（任意）', '로고 (선택)')}</h4>
                    <label
                      htmlFor="banner-logo-input"
                      className="inline-flex w-32 h-32 rounded-lg border-2 border-dashed border-amber-200 bg-amber-50/60 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-amber-300 hover:bg-amber-50/80 transition-colors shrink-0 ml-auto"
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
                          <Upload className="h-8 w-8 text-amber-500" />
                          <p className="text-xs text-muted-foreground font-medium leading-tight text-center">{tr('Logo', 'Logo', 'Logo', 'ロゴ', '로고')}</p>
                        </>
                      )}
                    </label>
                    <input
                      id="banner-logo-input"
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f?.type.startsWith('image/')) {
                          setLogo({ file: f, preview: URL.createObjectURL(f) })
                        }
                        e.target.value = ''
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Yêu cầu thêm', 'Extra prompt', '附加要求', '追加要望', '추가 요청')}</h4>
                    <Textarea
                      placeholder={tr('Ví dụ: slogan Khuyến mãi 20%, nền trắng, màu xanh, logo góc trái... (ý tưởng thiết kế, AI sẽ trình bày chuyên nghiệp)', 'e.g. 20% off slogan, white background, blue color, logo at top-left... (design idea, AI will present professionally)', '例如：20%促销标语、白色背景、蓝色、Logo在左上角...（设计思路，AI会专业呈现）', '例: 20%オフのスローガン、白背景、青色、左上ロゴ...（デザイン案、AIがプロ向けに仕上げます）', '예: 20% 할인 슬로건, 흰 배경, 파란색, 좌상단 로고... (디자인 아이디어, AI가 전문적으로 구성)')}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="bg-white/80 text-xs h-16 min-h-[64px] resize-y"
                    />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Ảnh sản phẩm (chọn tách nền từng ảnh)', 'Product images (set background removal per image)', '产品图片（可为每张选择抠图）', '商品画像（画像ごとに背景除去を選択）', '제품 이미지 (각 이미지별 배경제거 선택)')}</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {images.map((img, i) => (
                        <div key={i} className="space-y-1.5">
                          <div className="relative group aspect-square rounded-lg border overflow-hidden bg-amber-50/60">
                            <ImagePreview src={img.preview} alt={`${tr('Sản phẩm', 'Product', '产品', '商品', '제품')} ${i + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => handleRemove(i)}
                              className="absolute top-1 right-1 p-1 rounded-full bg-red-500/90 text-white hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-4 w-4" />
                            </button>
                            <span className="absolute bottom-1 left-1 text-xs bg-black/60 text-white px-2 py-0.5 rounded">
                              {i + 1}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            <button
                              type="button"
                              onClick={() => setImages((prev) => prev.map((im, j) => (j === i ? { ...im, removeBackground: true } : im)))}
                              className={`flex items-center justify-center gap-1 py-1.5 rounded-md border text-[10px] font-medium transition-colors ${
                                img.removeBackground ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                              }`}
                            >
                              {img.removeBackground && <Check className="h-3 w-3 shrink-0" />}
                              {tr('Tách nền', 'Remove background', '去背景', '背景除去', '배경 제거')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setImages((prev) => prev.map((im, j) => (j === i ? { ...im, removeBackground: false } : im)))}
                              className={`flex items-center justify-center gap-1 py-1.5 rounded-md border text-[10px] font-medium transition-colors ${
                                !img.removeBackground ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                              }`}
                            >
                              {!img.removeBackground && <Check className="h-3 w-3 shrink-0" />}
                              {tr('Không tách', 'Keep background', '保留背景', '背景維持', '배경 유지')}
                            </button>
                          </div>
                          <Input
                            placeholder={`${tr('Chú thích viết lên ảnh', 'Caption text on image', '图片上显示的文字', '画像に載せるテキスト', '이미지에 넣을 문구')} ${i + 1} (${tr('tùy chọn', 'optional', '可选', '任意', '선택')})`}
                            value={img.caption}
                            onChange={(e) => setImages((prev) => prev.map((im, j) => (j === i ? { ...im, caption: e.target.value } : im)))}
                            className="text-xs h-8"
                          />
                        </div>
                      ))}
                      {images.length < MAX_PRODUCT_IMAGES && (
                        <label
                          htmlFor="banner-input"
                          className="aspect-square rounded-lg border-2 border-dashed border-amber-200 bg-amber-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-amber-300 hover:bg-amber-50/80 transition-colors"
                        >
                          <Plus className="h-10 w-10 text-amber-500" />
                          <p className="text-xs text-muted-foreground font-medium">{tr('Thêm ảnh', 'Add image', '添加图片', '画像を追加', '이미지 추가')}</p>
                        </label>
                      )}
                    </div>
                    <input
                      id="banner-input"
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleAddImages}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="lg:w-[240px] lg:shrink-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-amber-200/60 h-full">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">{tr('Tùy chọn', 'Options', '选项', 'オプション', '옵션')}</CardTitle>
                  <CardDescription className="text-xs">{tr('Chọn tỷ lệ khung ảnh banner và chất lượng.', 'Choose banner aspect ratio and quality.', '选择横幅比例和质量。', 'バナーの縦横比と品質を選択。', '배너 비율과 품질을 선택하세요.')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Tỷ lệ banner', 'Banner ratio', '横幅比例', 'バナー比率', '배너 비율')}</h4>
                    <div className="grid grid-cols-2 gap-1.5">
                      {BANNER_ASPECT_RATIOS.map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setAspectRatio(r.value)}
                          className={`px-2 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                            aspectRatio === r.value ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Chất lượng ảnh', 'Image quality', '图像质量', '画像品質', '이미지 품질')}</h4>
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
                      disabled={images.length === 0}
                      className="w-full max-w-[180px] h-9 shadow-md hover:shadow-lg transition-all text-sm bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> {tr('Tạo banner', 'Create banner', '创建横幅', 'バナーを作成', '배너 만들기')} ({imageQuality === '2K' ? '1,5' : '3'} credit)
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground mt-2">{tr('* Thời gian: 15–45 giây', '* Time: 15–45 seconds', '* 时长：15–45 秒', '* 所要時間: 15〜45秒', '* 소요 시간: 15–45초')}</p>
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
                mode="banner"
                title={tr('Đang tạo banner', 'Creating banner', '正在创建横幅', 'バナー作成中', '배너 생성 중')}
                description={tr('AI đang thiết kế banner từ ảnh sản phẩm', 'AI is designing banner from product images', 'AI 正在根据产品图片设计横幅', 'AIが商品画像からバナーをデザイン中', 'AI가 제품 이미지로 배너를 디자인 중')}
                imagePreviews={images.map((img) => img.preview)}
              />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>{tr('Kết quả banner', 'Banner result', '横幅结果', 'バナー結果', '배너 결과')}</CardTitle>
              <CardDescription>{tr('Banner đã được tạo.', 'Banner has been created.', '横幅已创建。', 'バナーを作成しました。', '배너가 생성되었습니다.')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">{tr('Kết quả', 'Result', '结果', '結果', '결과')}</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleReset}>
                    <RefreshCw className="mr-2 h-3 w-3" /> {tr('Thử lại', 'Try again', '重试', '再試行', '다시 시도')}
                  </Button>
                  <DownloadImageButton
                    imageUrl={resultUrl}
                    filename="banner-result"
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
                className="max-w-2xl mx-auto rounded-lg border overflow-hidden"
                style={{ aspectRatio: aspectRatio.replace(':', '/') }}
              >
                <ImagePreview src={resultUrl} alt={tr('Banner', 'Banner', '横幅', 'バナー', '배너')} className="w-full h-full object-contain" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">{tr('Ảnh do AI tạo có thể có sai sót.', 'AI-generated image may contain inaccuracies.', 'AI 生成的图片可能存在误差。', 'AI生成画像には誤りが含まれる場合があります。', 'AI 생성 이미지는 오류가 있을 수 있습니다.')}</p>
    </>
  )
}
