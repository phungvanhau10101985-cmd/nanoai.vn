'use client'

import { useState, useRef, ChangeEvent } from 'react'
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
      toast({ title: 'Đã thêm ảnh', description: `Thêm ${newImages.length} ảnh sản phẩm.`, duration: 2000 })
    }
    e.target.value = ''
  }

  const handleRemove = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (images.length === 0) {
      toast({ title: 'Lỗi', description: 'Vui lòng tải lên ít nhất 1 ảnh sản phẩm.', variant: 'destructive' })
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
      toast({ title: 'Tạo banner thất bại', description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      await preloadImageUrl(result.resultUrl)
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      toast({ title: 'Thành công!', description: 'Banner đã được tạo.', duration: 3000 })
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
          <h1 className="text-2xl font-bold text-foreground">Tạo banner quảng cáo</h1>
          <p className="text-muted-foreground mt-1">Tải ảnh sản phẩm kinh doanh (tối đa 13 ảnh). AI tạo banner chuyên nghiệp. 1,5–3 credits/ảnh.</p>
        </div>

        {step === 'UPLOAD' && (
          <div className="grid lg:grid-cols-[1fr_240px] gap-4 items-start">
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-amber-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="h-4 w-4 text-amber-600" /> Ảnh sản phẩm (tối đa 13)
                  </CardTitle>
                  <CardDescription className="text-xs">Tải ảnh sản phẩm khách hàng kinh doanh. AI tạo banner từ sản phẩm.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider shrink-0">Logo (tùy chọn)</h4>
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
                          <p className="text-xs text-muted-foreground font-medium leading-tight text-center">Logo</p>
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
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Yêu cầu thêm</h4>
                    <Textarea
                      placeholder="Ví dụ: slogan Khuyến mãi 20%, nền trắng, màu xanh, logo góc trái... (ý tưởng thiết kế, AI sẽ trình bày chuyên nghiệp)"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="bg-white/80 text-xs h-16 min-h-[64px] resize-y"
                    />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ảnh sản phẩm (chọn tách nền từng ảnh)</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {images.map((img, i) => (
                        <div key={i} className="space-y-1.5">
                          <div className="relative group aspect-square rounded-lg border overflow-hidden bg-amber-50/60">
                            <ImagePreview src={img.preview} alt={`Sản phẩm ${i + 1}`} className="w-full h-full object-cover" />
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
                              Tách nền
                            </button>
                            <button
                              type="button"
                              onClick={() => setImages((prev) => prev.map((im, j) => (j === i ? { ...im, removeBackground: false } : im)))}
                              className={`flex items-center justify-center gap-1 py-1.5 rounded-md border text-[10px] font-medium transition-colors ${
                                !img.removeBackground ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                              }`}
                            >
                              {!img.removeBackground && <Check className="h-3 w-3 shrink-0" />}
                              Không tách
                            </button>
                          </div>
                          <Input
                            placeholder={`Chú thích viết lên ảnh ${i + 1} (tùy chọn)`}
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
                          <p className="text-xs text-muted-foreground font-medium">Thêm ảnh</p>
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
                  <CardTitle className="text-base">Tùy chọn</CardTitle>
                  <CardDescription className="text-xs">Chọn tỷ lệ khung ảnh banner và chất lượng.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tỷ lệ banner</h4>
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
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Chất lượng ảnh</h4>
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
                      <Sparkles className="mr-2 h-4 w-4" /> Tạo banner ({imageQuality === '2K' ? '1,5' : '3'} credit)
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground mt-2">* Thời gian: 15–45 giây</p>
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
                title="Đang tạo banner"
                description="AI đang thiết kế banner từ ảnh sản phẩm"
                imagePreviews={images.map((img) => img.preview)}
              />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>Kết quả banner</CardTitle>
              <CardDescription>Banner đã được tạo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">Kết quả</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleReset}>
                    <RefreshCw className="mr-2 h-3 w-3" /> Thử lại
                  </Button>
                  <DownloadImageButton imageUrl={resultUrl} filename="banner-result" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white border-0" />
                </div>
              </div>
              <div
                className="max-w-2xl mx-auto rounded-lg border overflow-hidden"
                style={{ aspectRatio: aspectRatio.replace(':', '/') }}
              >
                <ImagePreview src={resultUrl} alt="Banner" className="w-full h-full object-contain" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">Ảnh do AI tạo có thể có sai sót.</p>
    </>
  )
}
