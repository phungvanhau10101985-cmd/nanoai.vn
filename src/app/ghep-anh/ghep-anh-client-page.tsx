'use client'

import { useState, useRef, ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { mergeImages } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, Download, RefreshCw, Plus, X } from 'lucide-react'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { DownloadImageButton } from '@/components/download-image-button'
import { ImagePreview } from '@/components/ui/image-preview'
import { ImageProcessingLoader } from '@/components/image-processing-loader'
import { preloadImageUrl } from '@/lib/preload-image-url'

type Step = 'UPLOAD' | 'GENERATING' | 'RESULT'

const MAX_IMAGES = 6

export default function GhepAnhClientPage() {
  const [step, setStep] = useState<Step>('UPLOAD')
  const [images, setImages] = useState<{ file: File; preview: string }[]>([])
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const [note, setNote] = useState('')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cost = imageQuality === '2K' ? 1.5 : 3

  const handleAddImages = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    const newImages: { file: File; preview: string }[] = []
    for (let i = 0; i < files.length && images.length + newImages.length < MAX_IMAGES; i++) {
      const file = files[i]
      if (file.type.startsWith('image/')) {
        newImages.push({ file, preview: URL.createObjectURL(file) })
      }
    }
    if (newImages.length) {
      setImages((prev) => [...prev, ...newImages].slice(0, MAX_IMAGES))
      toast({ title: 'Đã thêm ảnh', description: `Thêm ${newImages.length} ảnh.`, duration: 2000 })
    }
    e.target.value = ''
  }

  const handleRemove = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (images.length < 2) {
      toast({ title: 'Lỗi', description: 'Cần ít nhất 2 ảnh để ghép.', variant: 'destructive' })
      return
    }
    setStep('GENERATING')
    const formData = new FormData()
    formData.append('imageQuality', imageQuality)
    formData.append('note', note)
    images.forEach((img, i) => formData.append(`image_${i}`, img.file))
    const result = await mergeImages(formData)
    if (result.error) {
      setStep('UPLOAD')
      toast({ title: 'Ghép ảnh thất bại', description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      await preloadImageUrl(result.resultUrl)
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      toast({ title: 'Thành công!', description: 'Ảnh đã được ghép.', duration: 3000 })
    }
  }

  const handleReset = () => {
    setStep('UPLOAD')
    setImages([])
    setNote('')
    setResultUrl(null)
  }

  return (
    <>
      <Toaster />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Ghép ảnh</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Ghép 2–6 ảnh thành một. 1,5–3 credits/ảnh.</p>
        </div>

        {step === 'UPLOAD' && (
          <div className="grid lg:grid-cols-[1fr_200px] gap-4 items-start">
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-amber-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="h-4 w-4 text-amber-600" /> Tải ảnh cần ghép (tối thiểu 2, tối đa 6)
                  </CardTitle>
                  <CardDescription className="text-xs">Chọn nhiều ảnh để ghép thành một.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {images.map((img, i) => (
                      <div key={i} className="relative group aspect-square rounded-lg border overflow-hidden bg-amber-50/60">
                        <ImagePreview src={img.preview} alt={`Ảnh ${i + 1}`} className="w-full h-full object-cover" />
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
                    ))}
                    {images.length < MAX_IMAGES && (
                      <label
                        htmlFor="ghep-anh-input"
                        className="aspect-square rounded-lg border-2 border-dashed border-amber-200 bg-amber-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-amber-300 hover:bg-amber-50/80 transition-colors"
                      >
                        <Plus className="h-10 w-10 text-amber-500" />
                        <p className="text-xs text-muted-foreground font-medium">Thêm ảnh</p>
                      </label>
                    )}
                  </div>
                  <input
                    id="ghep-anh-input"
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleAddImages}
                  />
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Yêu cầu thêm (tùy chọn)</h4>
                    <Textarea
                      placeholder="Ví dụ: sắp xếp theo thứ tự, ưu tiên ảnh 1..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="bg-white/80 text-xs h-20 min-h-[80px] resize-y"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="lg:w-[200px] lg:shrink-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-amber-200/60 h-full">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">Tùy chọn</CardTitle>
                  <CardDescription className="text-xs">Chất lượng xuất ảnh.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
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
                      disabled={images.length < 2}
                      className="w-full max-w-[180px] min-h-[44px] shadow-md hover:shadow-lg transition-all text-sm bg-amber-600 hover:bg-amber-700 text-white touch-manipulation"
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> Ghép ảnh ({imageQuality === '2K' ? '1,5' : '3'} credit)
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
                mode="merge"
                title="Đang ghép ảnh"
                description="AI đang kết hợp các ảnh thành một bức hài hòa"
                imagePreviews={images.map((img) => img.preview)}
              />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>Kết quả ghép ảnh</CardTitle>
              <CardDescription>Ảnh đã được ghép.</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Trước</h3>
                {images.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {images.map((img, i) => (
                      <div key={i} className="aspect-square rounded-lg border overflow-hidden">
                        <ImagePreview src={img.preview} alt={`Trước ${i + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground">Sau</h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleReset}>
                      <RefreshCw className="mr-2 h-3 w-3" /> Thử lại
                    </Button>
                    <DownloadImageButton imageUrl={resultUrl} filename="ghep-anh-result" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white border-0" />
                  </div>
                </div>
                <div className="aspect-square rounded-lg border overflow-hidden">
                  <ImagePreview src={resultUrl} alt="Sau" className="w-full h-full object-cover" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">Ảnh do AI tạo có thể có sai sót.</p>
    </>
  )
}
