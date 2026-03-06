'use client'

import { useState, useRef, ChangeEvent, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { createProductLabel } from './actions'
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

const MAX_PRODUCT_IMAGES = 6

const LABEL_ASPECT_RATIOS = [
  { value: '1:1', label: '1:1 Vuông' },
  { value: '2:3', label: '2:3 Dọc' },
  { value: '3:2', label: '3:2 Ngang' },
  { value: '3:4', label: '3:4 Dọc' },
  { value: '4:3', label: '4:3 Ngang' },
  { value: '4:5', label: '4:5 Dọc' },
  { value: '5:4', label: '5:4 Ngang' },
  { value: '9:16', label: '9:16 Dọc' },
  { value: '16:9', label: '16:9 Ngang' },
] as const

export default function TaoNhanGioiThieuSanPhamClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [step, setStep] = useState<Step>('UPLOAD')
  const [labelText, setLabelText] = useState('')
  const [brandName, setBrandName] = useState('')
  const [logo, setLogo] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [images, setImages] = useState<{ file: File; preview: string; removeBackground: boolean }[]>([])
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const [aspectRatio, setAspectRatio] = useState<string>('1:1')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
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

  const handleAddImages = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    const newImages: { file: File; preview: string; removeBackground: boolean }[] = []
    for (let i = 0; i < files.length && images.length + newImages.length < MAX_PRODUCT_IMAGES; i++) {
      const file = files[i]
      if (file.type.startsWith('image/')) {
        newImages.push({ file, preview: URL.createObjectURL(file), removeBackground: true })
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
    formData.append('labelText', labelText)
    formData.append('brandName', brandName)
    if (logo.file) formData.append('logo', logo.file)
    images.forEach((img, i) => {
      formData.append(`image_${i}`, img.file)
      formData.append(`image_${i}_removeBg`, String(img.removeBackground))
    })
    const result = await createProductLabel(formData)
    if (result.error) {
      setStep('UPLOAD')
      toast({ title: tr('Tạo nhãn thất bại', 'Create label failed', '创建标签失败', 'ラベル作成に失敗しました', '라벨 생성 실패'), description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      await preloadImageUrl(result.resultUrl)
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      window.dispatchEvent(new Event('credits-updated'))
      toast({ title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'), description: tr('Nhãn sản phẩm đã được tạo.', 'Product label has been created.', '产品标签已创建。', '商品ラベルを作成しました。', '제품 라벨이 생성되었습니다.'), duration: 3000 })
    }
  }

  const handleReset = () => {
    setStep('UPLOAD')
    setLabelText('')
    setBrandName('')
    setLogo({ file: null, preview: null })
    setImages([])
    setAspectRatio('1:1')
    setResultUrl(null)
  }

  return (
    <>
      <Toaster />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">{tr('Tạo nhãn giới thiệu sản phẩm', 'Create product intro label', '创建产品介绍标签', '商品紹介ラベルを作成', '제품 소개 라벨 만들기')}</h1>
          <p className="text-muted-foreground mt-1">{tr('Tải 1–6 ảnh sản phẩm, nhập nội dung ghi trên nhãn. AI tạo nhãn chuyên nghiệp cho đóng gói. 1,5 credit (2K) / 3 credit (4K) mỗi lượt.', 'Upload 1–6 product images, enter label text. AI creates professional packaging labels. 1.5 credits (2K) / 3 credits (4K) per creation.', '上传 1–6 张产品图片，输入标签内容。AI 创建专业包装标签。每次 1.5 积分 (2K) / 3 积分 (4K)。', '1〜6枚の商品画像をアップロードし、ラベル内容を入力。AIがプロの包装ラベルを作成。1回 1.5 クレジット (2K) / 3 クレジット (4K)。', '1–6장의 제품 이미지를 업로드하고 라벨 내용을 입력하세요. AI가 전문 포장 라벨을 생성합니다. 1회 1.5 크레딧 (2K) / 3 크레딧 (4K).')}</p>
        </div>

        {step === 'UPLOAD' && (
          <div className="grid lg:grid-cols-[1fr_240px] gap-4 items-start">
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-emerald-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="h-4 w-4 text-emerald-600" /> {tr('Ảnh sản phẩm (1–6 ảnh)', 'Product images (1–6)', '产品图片（1–6 张）', '商品画像（1〜6枚）', '제품 이미지 (1–6장)')}
                  </CardTitle>
                  <CardDescription className="text-xs">{tr('Tải ảnh sản phẩm để tạo nhãn đóng gói. AI thiết kế nhãn chuyên nghiệp.', 'Upload product images for packaging labels. AI designs professional labels.', '上传产品图片以创建包装标签。AI 设计专业标签。', '商品画像をアップロードして包装ラベルを作成。AIがプロのラベルをデザイン。', '제품 이미지를 업로드하여 포장 라벨을 만듭니다. AI가 전문 라벨을 디자인합니다.')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Thương hiệu (tùy chọn)', 'Brand (optional)', '品牌（可选）', 'ブランド（任意）', '브랜드 (선택)')}</h4>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Input
                        placeholder={tr('Tên thương hiệu', 'Brand name', '品牌名称', 'ブランド名', '브랜드명')}
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                        className="bg-white/80 text-xs flex-1"
                      />
                      <label
                        htmlFor="label-logo-input"
                        className="inline-flex w-24 h-24 rounded-lg border-2 border-dashed border-emerald-200 bg-emerald-50/60 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/80 transition-colors shrink-0"
                      >
                        {logo.preview ? (
                          <div className="relative w-full h-full flex items-center justify-center p-2">
                            <ImagePreview src={logo.preview} alt={tr('Logo', 'Logo', 'Logo', 'ロゴ', '로고')} className="w-full h-full object-contain" />
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
                            <Upload className="h-6 w-6 text-emerald-500" />
                            <p className="text-[10px] text-muted-foreground font-medium leading-tight text-center">{tr('Logo', 'Logo', '标志', 'ロゴ', '로고')}</p>
                          </>
                        )}
                      </label>
                      <input
                        id="label-logo-input"
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
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Nội dung ghi trên nhãn', 'Label text', '标签内容', 'ラベル内容', '라벨 내용')}</h4>
                    <Textarea
                      placeholder={tr('Ví dụ: Tên sản phẩm, thành phần, hạn sử dụng, thông tin thương hiệu...', 'e.g. Product name, ingredients, expiry date, brand info...', '例如：产品名称、成分、保质期、品牌信息...', '例: 商品名、成分、賞味期限、ブランド情報...', '예: 제품명, 성분, 유통기한, 브랜드 정보...')}
                      value={labelText}
                      onChange={(e) => setLabelText(e.target.value)}
                      className="bg-white/80 text-xs h-16 min-h-[64px] resize-y"
                    />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Ảnh sản phẩm (chọn tách nền từng ảnh)', 'Product images (set background removal per image)', '产品图片（可为每张选择抠图）', '商品画像（画像ごとに背景除去を選択）', '제품 이미지 (각 이미지별 배경제거 선택)')}</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {images.map((img, i) => (
                        <div key={i} className="space-y-1.5">
                          <div className="relative group aspect-square rounded-lg border overflow-hidden bg-emerald-50/60">
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
                                img.removeBackground ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                              }`}
                            >
                              {img.removeBackground && <Check className="h-3 w-3 shrink-0" />}
                              {tr('Tách nền', 'Remove background', '去背景', '背景除去', '배경 제거')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setImages((prev) => prev.map((im, j) => (j === i ? { ...im, removeBackground: false } : im)))}
                              className={`flex items-center justify-center gap-1 py-1.5 rounded-md border text-[10px] font-medium transition-colors ${
                                !img.removeBackground ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                              }`}
                            >
                              {!img.removeBackground && <Check className="h-3 w-3 shrink-0" />}
                              {tr('Không tách', 'Keep background', '保留背景', '背景維持', '배경 유지')}
                            </button>
                          </div>
                        </div>
                      ))}
                      {images.length < MAX_PRODUCT_IMAGES && (
                        <label
                          htmlFor="label-input"
                          className="aspect-square rounded-lg border-2 border-dashed border-emerald-200 bg-emerald-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/80 transition-colors"
                        >
                          <Plus className="h-10 w-10 text-emerald-500" />
                          <p className="text-xs text-muted-foreground font-medium">{tr('Thêm ảnh', 'Add image', '添加图片', '画像を追加', '이미지 추가')}</p>
                        </label>
                      )}
                    </div>
                    <input
                      id="label-input"
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
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-emerald-200/60 h-full">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">{tr('Tùy chọn', 'Options', '选项', 'オプション', '옵션')}</CardTitle>
                  <CardDescription className="text-xs">{tr('Chọn kích thước nhãn và chất lượng ảnh.', 'Choose label size and image quality.', '选择标签尺寸和图像质量。', 'ラベルサイズと画像品質を選択。', '라벨 크기와 이미지 품질을 선택하세요.')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Kích thước nhãn', 'Label size', '标签尺寸', 'ラベルサイズ', '라벨 크기')}</h4>
                    <div className="grid grid-cols-2 gap-1.5">
                      {LABEL_ASPECT_RATIOS.map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setAspectRatio(r.value)}
                          className={`px-2 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                            aspectRatio === r.value ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
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
                          imageQuality === '2K' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        2K (1,5)
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageQuality('4K')}
                        className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                          imageQuality === '4K' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        4K (3)
                      </button>
                    </div>
                  </div>
                  <div className="pt-4 border-t space-y-2 flex flex-col items-center">
                    <DepositCreditButton variant="outline" size="sm" className="w-full max-w-[180px] border-emerald-200 text-emerald-700 hover:bg-emerald-50" />
                    <Button
                      onClick={() => checkCreditsAndProceed(cost, handleSubmit)}
                      disabled={images.length === 0}
                      className="w-full max-w-[180px] h-9 shadow-md hover:shadow-lg transition-all text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> {tr('Tạo nhãn', 'Create label', '创建标签', 'ラベルを作成', '라벨 만들기')} ({imageQuality === '2K' ? '1,5' : '3'} credit)
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground mt-2">{tr('* Thời gian: 15–45 giây', '* Time: 15–45 seconds', '* 时长：15–45 秒', '* 所要時間: 15〜45秒', '* 소요 시간: 15–45초')}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === 'GENERATING' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-emerald-200/60">
            <CardContent className="flex flex-col items-center py-8">
              <ImageProcessingLoader
                mode="banner"
                title={tr('Đang tạo nhãn', 'Creating label', '正在创建标签', 'ラベル作成中', '라벨 생성 중')}
                description={tr('AI đang thiết kế nhãn sản phẩm', 'AI is designing product label', 'AI 正在设计产品标签', 'AIが商品ラベルをデザイン中', 'AI가 제품 라벨을 디자인 중')}
                imagePreviews={images.map((img) => img.preview)}
              />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>{tr('Kết quả nhãn', 'Label result', '标签结果', 'ラベル結果', '라벨 결과')}</CardTitle>
              <CardDescription>{tr('Nhãn sản phẩm đã được tạo.', 'Product label has been created.', '产品标签已创建。', '商品ラベルを作成しました。', '제품 라벨이 생성되었습니다.')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">{tr('Kết quả', 'Result', '结果', '結果', '결과')}</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleReset}>
                    <RefreshCw className="mr-2 h-3 w-3" /> {tr('Thử lại', 'Try again', '重试', '再試行', '다시 시도')}
                  </Button>
                  <DownloadImageButton imageUrl={resultUrl} filename="product-label" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white border-0" />
                </div>
              </div>
              <div
                className="max-w-2xl mx-auto rounded-lg border overflow-hidden"
                style={{ aspectRatio: aspectRatio.replace(':', '/') }}
              >
                <ImagePreview src={resultUrl} alt={tr('Nhãn sản phẩm', 'Product label', '产品标签', '商品ラベル', '제품 라벨')} className="w-full h-full object-contain" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">{tr('Ảnh do AI tạo có thể có sai sót.', 'AI-generated image may contain inaccuracies.', 'AI 生成的图片可能存在误差。', 'AI生成画像には誤りが含まれる場合があります。', 'AI 생성 이미지는 오류가 있을 수 있습니다.')}</p>
    </>
  )
}
