'use client'

import { useState, useRef, ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { createVideoFromImage } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, RefreshCw, Video } from 'lucide-react'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { ImagePreview } from '@/components/ui/image-preview'
import { ImageProcessingLoader } from '@/components/image-processing-loader'

type Step = 'UPLOAD' | 'GENERATING' | 'RESULT'

const setImageFromFile = (file: File, setImage: (v: { file: File; preview: string }) => void) => {
  if (!file.type.startsWith('image/')) return false
  setImage({ file, preview: URL.createObjectURL(file) })
  return true
}

export default function TaoVideoTuAnhClientPage() {
  const [step, setStep] = useState<Step>('UPLOAD')
  const [image, setImage] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p')
  const [prompt, setPrompt] = useState('')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cost = resolution === '720p' ? 8 : 16

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setImageFromFile(file, setImage)
  }

  const handleSubmit = async () => {
    if (!image.file) {
      toast({ title: 'Lỗi', description: 'Vui lòng tải lên ảnh.', variant: 'destructive' })
      return
    }
    setStep('GENERATING')
    const formData = new FormData()
    formData.append('image', image.file)
    formData.append('resolution', resolution)
    formData.append('prompt', prompt)
    const result = await createVideoFromImage(formData)
    if (result.error) {
      setStep('UPLOAD')
      toast({
        title: 'Tạo video thất bại',
        description: result.error,
        variant: 'destructive',
        duration: 5000,
      })
    } else if (result.success && result.resultUrl) {
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      toast({
        title: 'Thành công!',
        description: 'Đã tạo video 8 giây từ ảnh.',
        duration: 3000,
      })
    }
  }

  const handleReset = () => {
    setStep('UPLOAD')
    setImage({ file: null, preview: null })
    setPrompt('')
    setResultUrl(null)
  }

  return (
    <>
      <Toaster />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
            <Video className="h-8 w-8 text-violet-600" /> Tạo video từ ảnh
          </h1>
          <p className="text-muted-foreground mt-1">
            Chuyển ảnh thành video 8 giây với AI Veo 3.1. 2 chất lượng: 720p và 1080p. Video có âm thanh.
          </p>
        </div>

        {step === 'UPLOAD' && (
          <div className="grid lg:grid-cols-[1fr_220px] gap-4 items-start">
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-violet-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="h-4 w-4 text-violet-600" /> Ảnh gốc
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Tải lên ảnh. AI sẽ tạo video 8 giây với chuyển động tự nhiên từ ảnh này.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <label
                    htmlFor="video-input"
                    className="block w-full aspect-video max-h-[320px] rounded-lg border-2 border-dashed border-violet-200 bg-violet-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-violet-300 hover:bg-violet-50/80 transition-colors"
                  >
                    {image.preview ? (
                      <ImagePreview src={image.preview} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                    ) : (
                      <>
                        <Upload className="h-12 w-12 text-violet-500" />
                        <p className="text-sm text-muted-foreground font-medium">Chọn ảnh</p>
                      </>
                    )}
                  </label>
                  {image.preview && (
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <RefreshCw className="h-3.5 w-3.5" /> Chọn lại
                    </button>
                  )}
                  <input
                    id="video-input"
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Mô tả chuyển động (tùy chọn)
                    </label>
                    <Textarea
                      placeholder="VD: Cảnh quay chậm, gió thổi nhẹ qua lá cây, ánh nắng chiếu..."
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="min-h-[80px] bg-white/80"
                      maxLength={500}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="lg:w-[220px] lg:shrink-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-violet-200/60 h-full">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">Chất lượng</CardTitle>
                  <CardDescription className="text-xs">8 giây, 16:9, có âm thanh</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Độ phân giải
                    </h4>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => setResolution('720p')}
                        className={`w-full px-3 py-2.5 rounded-md border text-sm font-medium transition-colors ${
                          resolution === '720p'
                            ? 'border-violet-500 bg-violet-50 text-violet-800'
                            : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        720p (8 credit)
                      </button>
                      <button
                        type="button"
                        onClick={() => setResolution('1080p')}
                        className={`w-full px-3 py-2.5 rounded-md border text-sm font-medium transition-colors ${
                          resolution === '1080p'
                            ? 'border-violet-500 bg-violet-50 text-violet-800'
                            : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        1080p (16 credit)
                      </button>
                    </div>
                  </div>
                  <div className="pt-4 border-t space-y-2 flex flex-col items-center">
                    <DepositCreditButton
                      variant="outline"
                      size="sm"
                      className="w-full max-w-[180px] border-violet-200 text-violet-700 hover:bg-violet-50"
                    />
                    <Button
                      onClick={() => checkCreditsAndProceed(cost, handleSubmit)}
                      disabled={!image.file}
                      className="w-full max-w-[180px] h-9 shadow-md hover:shadow-lg transition-all text-sm bg-violet-600 hover:bg-violet-700 text-white"
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> Tạo video ({cost} credit)
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground mt-2">
                      * Thời gian: 1–6 phút
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === 'GENERATING' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-violet-200/60">
            <CardContent className="flex flex-col items-center py-12">
              <ImageProcessingLoader
                mode="interior"
                title="Đang tạo video"
                description="AI Veo 3.1 đang xử lý. Video 8 giây có thể mất 1–6 phút."
                imagePreview={image.preview}
              />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>Kết quả</CardTitle>
              <CardDescription>Đã tạo video 8 giây từ ảnh.</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Ảnh gốc</h3>
                {image.preview && (
                  <div className="aspect-video rounded-lg border overflow-hidden">
                    <ImagePreview src={image.preview} alt="Gốc" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground">Video</h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleReset}>
                      <RefreshCw className="mr-2 h-3 w-3" /> Thử lại
                    </Button>
                    <Button
                      size="sm"
                      className="bg-violet-600 hover:bg-violet-700 text-white border-0"
                      onClick={async () => {
                        try {
                          const res = await fetch(resultUrl)
                          const blob = await res.blob()
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = 'video-ai.mp4'
                          a.click()
                          URL.revokeObjectURL(url)
                        } catch {
                          window.open(resultUrl, '_blank')
                        }
                      }}
                    >
                      Tải video
                    </Button>
                  </div>
                </div>
                <div className="aspect-video rounded-lg border overflow-hidden bg-black">
                  <video src={resultUrl} controls className="w-full h-full" playsInline>
                    Trình duyệt không hỗ trợ video.
                  </video>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">Video do AI tạo có thể có sai sót.</p>
    </>
  )
}
