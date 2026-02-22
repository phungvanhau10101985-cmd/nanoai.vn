'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { createStoryImage } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { BookOpen, Sparkles, RefreshCw } from 'lucide-react'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { DownloadImageButton } from '@/components/download-image-button'
import { ImagePreview } from '@/components/ui/image-preview'
import { ImageProcessingLoader } from '@/components/image-processing-loader'
import { preloadImageUrl } from '@/lib/preload-image-url'

type Step = 'INPUT' | 'GENERATING' | 'RESULT'

const STORY_ASPECT_RATIOS = [
  { value: '4:3', label: '4:3 Ngang' },
  { value: '3:4', label: '3:4 Dọc' },
  { value: '16:9', label: '16:9 Ngang rộng' },
  { value: '9:16', label: '9:16 Dọc rộng' },
  { value: '1:1', label: '1:1 Vuông' },
] as const

export default function KeChuyenBangHinhAnhClientPage() {
  const [step, setStep] = useState<Step>('INPUT')
  const [prompt, setPrompt] = useState('')
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const [aspectRatio, setAspectRatio] = useState<string>('4:3')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const cost = imageQuality === '2K' ? 3 : 6

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      toast({ title: 'Lỗi', description: 'Vui lòng nhập ý tưởng hoặc chủ đề cần minh họa.', variant: 'destructive' })
      return
    }
    setStep('GENERATING')
    const formData = new FormData()
    formData.append('prompt', prompt)
    formData.append('imageQuality', imageQuality)
    formData.append('aspectRatio', aspectRatio)
    const result = await createStoryImage(formData)
    if (result.error) {
      setStep('INPUT')
      toast({ title: 'Tạo ảnh thất bại', description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      await preloadImageUrl(result.resultUrl)
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      toast({ title: 'Thành công!', description: 'Ảnh minh họa đã được tạo.', duration: 3000 })
    }
  }

  const handleReset = () => {
    setStep('INPUT')
    setPrompt('')
    setAspectRatio('4:3')
    setResultUrl(null)
  }

  return (
    <>
      <Toaster />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Kể chuyện bằng hình ảnh</h1>
          <p className="text-muted-foreground mt-1">Đưa ý tưởng. AI viết câu chuyện dẫn dắt đúng chuẩn khoa học (không bịa) rồi tạo ảnh minh họa, chữ tiếng Việt. 3–6 credits/ảnh.</p>
        </div>

        {step === 'INPUT' && (
          <div className="grid lg:grid-cols-[1fr_240px] gap-4 items-start">
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-rose-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BookOpen className="h-4 w-4 text-rose-600" /> Ý tưởng / chủ đề
                  </CardTitle>
                  <CardDescription className="text-xs">Đưa ý tưởng. AI viết câu chuyện dẫn dắt đúng chuẩn khoa học (không bịa), rồi tạo ảnh minh họa, chữ tiếng Việt.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <Textarea
                    placeholder="Ví dụ: Quang hợp – dẫn dắt từ sáng (lá hấp ánh sáng) đến trưa (tạo đường) đến chiều (tích trữ). Hoặc: Vòng tuần hoàn nước. Hoặc: Cô bé quàng khăn đỏ gặp sói."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={8}
                    className="resize-none"
                  />
                </CardContent>
              </Card>
            </div>
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-rose-200/60">
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tỷ lệ khung</h4>
                    <div className="flex flex-wrap gap-2">
                      {STORY_ASPECT_RATIOS.map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setAspectRatio(r.value)}
                          className={`px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                            aspectRatio === r.value ? 'border-rose-500 bg-rose-50 text-rose-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
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
                          imageQuality === '2K' ? 'border-rose-500 bg-rose-50 text-rose-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        2K (3)
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageQuality('4K')}
                        className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                          imageQuality === '4K' ? 'border-rose-500 bg-rose-50 text-rose-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        4K (6)
                      </button>
                    </div>
                  </div>
                  <div className="pt-4 border-t space-y-2 flex flex-col items-center">
                    <DepositCreditButton variant="outline" size="sm" className="w-full max-w-[180px] border-rose-200 text-rose-700 hover:bg-rose-50" />
                    <Button
                      onClick={() => checkCreditsAndProceed(cost, handleSubmit)}
                      disabled={!prompt.trim()}
                      className="w-full max-w-[180px] h-9 shadow-md hover:shadow-lg transition-all text-sm bg-rose-600 hover:bg-rose-700 text-white"
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> Tạo ảnh ({imageQuality === '2K' ? '3' : '6'} credit)
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground mt-2">* Thời gian: 15–45 giây</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === 'GENERATING' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-rose-200/60">
            <CardContent className="flex flex-col items-center py-8">
              <ImageProcessingLoader
                mode="story"
                title="Đang tạo ảnh kể chuyện"
                description="AI đang mở rộng ý tưởng và vẽ minh họa"
              />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur overflow-hidden min-w-0">
            <CardHeader>
              <CardTitle>Kết quả ảnh minh họa</CardTitle>
              <CardDescription>Ảnh đã được tạo theo mô tả của bạn.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative aspect-[4/3] max-h-[55vh] w-full min-w-0 overflow-hidden rounded-lg border bg-black/5">
                <ImagePreview src={resultUrl} alt="Ảnh minh họa" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={handleReset}>
                  <RefreshCw className="mr-2 h-3 w-3" /> Thử lại
                </Button>
                <DownloadImageButton imageUrl={resultUrl} filename="ke-chuyen-anh" size="sm" className="bg-rose-600 hover:bg-rose-700 text-white border-0" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">Ảnh do AI tạo có thể có sai sót.</p>
    </>
  )
}
