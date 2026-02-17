'use client'

import { useState, useRef, ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { createLogo } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, Download, RefreshCw } from 'lucide-react'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { DownloadImageButton } from '@/components/download-image-button'
import { ImagePreview } from '@/components/ui/image-preview'
import { ImageProcessingLoader } from '@/components/image-processing-loader'

type Step = 'UPLOAD' | 'GENERATING' | 'RESULT'

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

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file?.type.startsWith('image/')) {
      setImage({ file, preview: URL.createObjectURL(file) })
    }
  }

  const handleSubmit = async () => {
    if (!note.trim() && !image.file) {
      toast({ title: 'Lỗi', description: 'Vui lòng mô tả thương hiệu/logo hoặc tải ảnh tham khảo.', variant: 'destructive' })
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
      toast({ title: 'Thiết kế logo thất bại', description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      toast({ title: 'Thành công!', description: 'Logo đã được tạo.', duration: 3000 })
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
          <h1 className="text-2xl font-bold text-foreground">Thiết kế logo thương hiệu</h1>
          <p className="text-muted-foreground mt-1">Mô tả thương hiệu, tải ảnh tham khảo. AI tạo logo chuyên nghiệp. 1,5–3 credits/ảnh.</p>
        </div>

        {step === 'UPLOAD' && (
          <div className="grid lg:grid-cols-[1fr_240px] gap-4 items-start">
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-amber-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="h-4 w-4 text-amber-600" /> Thông tin thương hiệu
                  </CardTitle>
                  <CardDescription className="text-xs">Mô tả tên, ngành nghề, phong cách. Có thể tải ảnh tham khảo (tùy chọn).</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Yêu cầu thêm</h4>
                    <Textarea
                      placeholder="Ví dụ: Cafe ABC, logo cốc cà phê, tông màu nâu, minimalist, kèm chữ..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="bg-white/80 text-xs h-24 min-h-[96px] resize-y"
                    />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ảnh tham khảo (tùy chọn)</h4>
                    <label
                      htmlFor="logo-input"
                      className="block w-full aspect-[4/3] max-h-[200px] rounded-lg border-2 border-dashed border-amber-200 bg-amber-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-amber-300 hover:bg-amber-50/80 transition-colors"
                    >
                      {image.preview ? (
                        <ImagePreview src={image.preview} alt="Tham khảo" className="w-full h-full object-contain rounded-lg" />
                      ) : (
                        <>
                          <Upload className="h-10 w-10 text-amber-500" />
                          <p className="text-sm text-muted-foreground font-medium">Chọn ảnh tham khảo (tùy chọn)</p>
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
                  <CardTitle className="text-base">Tùy chọn</CardTitle>
                  <CardDescription className="text-xs">Chọn tỷ lệ logo và chất lượng xuất ảnh.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tỷ lệ logo</h4>
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
                      disabled={!note.trim() && !image.file}
                      className="w-full max-w-[180px] h-9 shadow-md hover:shadow-lg transition-all text-sm bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> Tạo logo ({imageQuality === '2K' ? '1,5' : '3'} credit)
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
                mode="logo"
                title="Đang thiết kế logo"
                description="AI đang tạo logo thương hiệu chuyên nghiệp"
                imagePreview={image.preview}
              />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>Kết quả logo</CardTitle>
              <CardDescription>Logo đã được tạo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">Kết quả</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleReset}>
                    <RefreshCw className="mr-2 h-3 w-3" /> Thử lại
                  </Button>
                  <DownloadImageButton imageUrl={resultUrl} filename="logo-result" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white border-0" />
                </div>
              </div>
              <div
                className="max-w-md mx-auto rounded-lg border overflow-hidden bg-white p-8"
                style={{ aspectRatio: aspectRatio.replace(':', '/') }}
              >
                <ImagePreview src={resultUrl} alt="Logo" className="w-full h-full object-contain" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">Ảnh do AI tạo có thể có sai sót.</p>
    </>
  )
}
