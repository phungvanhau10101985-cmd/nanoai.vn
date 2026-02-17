'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { createStickerLabel } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Tag, Sparkles, RefreshCw } from 'lucide-react'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { DownloadImageButton } from '@/components/download-image-button'
import { ImagePreview } from '@/components/ui/image-preview'
import { ImageProcessingLoader } from '@/components/image-processing-loader'

type Step = 'INPUT' | 'GENERATING' | 'RESULT'

const STICKER_ASPECT_RATIOS = [
  { value: '1:1', label: '1:1 Vuông' },
  { value: '4:3', label: '4:3 Ngang' },
  { value: '3:4', label: '3:4 Dọc' },
  { value: '16:9', label: '16:9 Ngang rộng' },
  { value: '9:16', label: '9:16 Dọc rộng' },
] as const

export default function TaoNhanGianClientPage() {
  const [step, setStep] = useState<Step>('INPUT')
  const [prompt, setPrompt] = useState('')
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const [aspectRatio, setAspectRatio] = useState<string>('1:1')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const cost = imageQuality === '2K' ? 2 : 4

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      toast({ title: 'Lỗi', description: 'Vui lòng nhập ý tưởng nhãn gián.', variant: 'destructive' })
      return
    }
    setStep('GENERATING')
    const formData = new FormData()
    formData.append('prompt', prompt)
    formData.append('imageQuality', imageQuality)
    formData.append('aspectRatio', aspectRatio)
    const result = await createStickerLabel(formData)
    if (result.error) {
      setStep('INPUT')
      toast({ title: 'Tạo nhãn gián thất bại', description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      toast({ title: 'Thành công!', description: 'Nhãn gián đã được tạo.', duration: 3000 })
    }
  }

  const handleReset = () => {
    setStep('INPUT')
    setPrompt('')
    setAspectRatio('1:1')
    setResultUrl(null)
  }

  return (
    <>
      <Toaster />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Tạo nhãn gián nền trong suốt</h1>
          <p className="text-muted-foreground mt-1">Đưa ý tưởng nhãn gián. AI mở rộng chi tiết rồi tạo ảnh PNG nền trong suốt, phù hợp in sticker. 2–4 credits/ảnh.</p>
        </div>

        {step === 'INPUT' && (
          <div className="grid lg:grid-cols-[1fr_240px] gap-4 items-start">
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-teal-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Tag className="h-4 w-4 text-teal-600" /> Ý tưởng nhãn gián
                  </CardTitle>
                  <CardDescription className="text-xs">Mô tả ngắn gọn nhãn gián bạn muốn. AI sẽ mở rộng thành mô tả chi tiết rồi tạo ảnh nền trong suốt.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <Textarea
                    placeholder="Ví dụ: Gấu trúc kawaii đội mũ tre, đang ăn lá trúc. Hoặc: Logo cafe với cốc cà phê và chữ ABC. Hoặc: Mèo dễ thương vẫy tay."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={6}
                    className="resize-none"
                  />
                </CardContent>
              </Card>
            </div>
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-teal-200/60">
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tỷ lệ khung</h4>
                    <div className="flex flex-wrap gap-2">
                      {STICKER_ASPECT_RATIOS.map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setAspectRatio(r.value)}
                          className={`px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                            aspectRatio === r.value ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
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
                          imageQuality === '2K' ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        2K (2)
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageQuality('4K')}
                        className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                          imageQuality === '4K' ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        4K (4)
                      </button>
                    </div>
                  </div>
                  <div className="pt-4 border-t space-y-2 flex flex-col items-center">
                    <DepositCreditButton variant="outline" size="sm" className="w-full max-w-[180px] border-teal-200 text-teal-700 hover:bg-teal-50" />
                    <Button
                      onClick={() => checkCreditsAndProceed(cost, handleSubmit)}
                      disabled={!prompt.trim()}
                      className="w-full max-w-[180px] h-9 shadow-md hover:shadow-lg transition-all text-sm bg-teal-600 hover:bg-teal-700 text-white"
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> Tạo nhãn ({imageQuality === '2K' ? '2' : '4'} credit)
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground mt-2">* Thời gian: 15–45 giây</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === 'GENERATING' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-teal-200/60">
            <CardContent className="flex flex-col items-center py-8">
              <ImageProcessingLoader
                mode="sticker"
                title="Đang tạo nhãn gián"
                description="AI đang mở rộng ý tưởng và vẽ nhãn nền trong suốt"
              />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur overflow-hidden min-w-0">
            <CardHeader>
              <CardTitle>Kết quả nhãn gián</CardTitle>
              <CardDescription>Nhãn gián nền trong suốt đã được tạo. Tải PNG để in sticker.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative aspect-square max-h-[55vh] w-full min-w-0 overflow-hidden rounded-lg border bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#f9fafb_0%_50%)] bg-[length:16px_16px]">
                <ImagePreview src={resultUrl} alt="Nhãn gián" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={handleReset}>
                  <RefreshCw className="mr-2 h-3 w-3" /> Thử lại
                </Button>
                <DownloadImageButton imageUrl={resultUrl} filename="nhan-gian" size="sm" className="bg-teal-600 hover:bg-teal-700 text-white border-0" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">Ảnh do AI tạo có thể có sai sót. Nền trong suốt phụ thuộc model.</p>
    </>
  )
}
