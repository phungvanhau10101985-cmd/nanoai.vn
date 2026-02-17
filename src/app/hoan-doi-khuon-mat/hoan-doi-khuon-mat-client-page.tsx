'use client'

import { useState, useRef, ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { faceSwap } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, Download, RefreshCw, Repeat } from 'lucide-react'
import { ImageUploadWithPreview } from '@/components/image-upload-with-preview'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { DownloadImageButton } from '@/components/download-image-button'
import { ImagePreview } from '@/components/ui/image-preview'
import { ImageProcessingLoader } from '@/components/image-processing-loader'

type Step = 'UPLOAD' | 'GENERATING' | 'RESULT'

const setImageFromFile = (file: File, setImage: (v: { file: File; preview: string }) => void) => {
  if (!file.type.startsWith('image/')) return false
  setImage({ file, preview: URL.createObjectURL(file) })
  return true
}

export default function HoanDoiKhuonMatClientPage() {
  const [step, setStep] = useState<Step>('UPLOAD')
  const [faceImage, setFaceImage] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [targetImage, setTargetImage] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const [note, setNote] = useState('')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const faceInputRef = useRef<HTMLInputElement>(null)
  const cost = imageQuality === '2K' ? 2 : 4
  const targetInputRef = useRef<HTMLInputElement>(null)

  const handleFaceChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setImageFromFile(file, setFaceImage)
  }

  const handleTargetChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setImageFromFile(file, setTargetImage)
  }

  const handleSubmit = async () => {
    if (!faceImage.file) {
      toast({ title: 'Lỗi', description: 'Vui lòng tải ảnh khuôn mặt nguồn (ảnh bạn).', variant: 'destructive' })
      return
    }
    if (!targetImage.file) {
      toast({ title: 'Lỗi', description: 'Vui lòng tải ảnh đích (nhân vật muốn ghép mặt vào).', variant: 'destructive' })
      return
    }
    setStep('GENERATING')
    const formData = new FormData()
    formData.append('faceImage', faceImage.file)
    formData.append('targetImage', targetImage.file)
    formData.append('imageQuality', imageQuality)
    formData.append('note', note)
    const result = await faceSwap(formData)
    if (result.error) {
      setStep('UPLOAD')
      toast({ title: 'Hoán đổi thất bại', description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      toast({ title: 'Thành công!', description: 'Đã hoán đổi khuôn mặt.', duration: 3000 })
    }
  }

  const handleReset = () => {
    setStep('UPLOAD')
    setFaceImage({ file: null, preview: null })
    setTargetImage({ file: null, preview: null })
    setNote('')
    setResultUrl(null)
  }

  return (
    <>
      <Toaster />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
            <Repeat className="h-8 w-8 text-fuchsia-600" /> Hoán đổi khuôn mặt (Face Swap)
          </h1>
          <p className="text-muted-foreground mt-1">Ghép mặt bạn vào nhân vật phim ảnh, siêu anh hùng. 2–4 credits/ảnh.</p>
        </div>

        {step === 'UPLOAD' && (
          <div className="grid lg:grid-cols-[1fr_200px] gap-4 items-start">
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-fuchsia-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="h-4 w-4 text-fuchsia-600" /> Ảnh cần ghép
                  </CardTitle>
                  <CardDescription className="text-xs">Ảnh 1: khuôn mặt bạn. Ảnh 2: nhân vật muốn ghép mặt vào.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">1. Ảnh khuôn mặt nguồn (ảnh bạn)</h4>
                      <ImageUploadWithPreview
                        preview={faceImage.preview}
                        onFileChange={handleFaceChange}
                        inputId="face-input"
                        emptyLabel="Chọn ảnh bạn"
                        className="block w-full aspect-square max-h-[280px] rounded-lg border-2 border-dashed border-fuchsia-200 bg-fuchsia-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-fuchsia-300 hover:bg-fuchsia-50/80 transition-colors"
                        ref={faceInputRef}
                      />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">2. Ảnh đích (nhân vật muốn ghép mặt vào)</h4>
                      <ImageUploadWithPreview
                        preview={targetImage.preview}
                        onFileChange={handleTargetChange}
                        inputId="target-input"
                        emptyLabel="Chọn ảnh nhân vật"
                        className="block w-full aspect-square max-h-[280px] rounded-lg border-2 border-dashed border-fuchsia-200 bg-fuchsia-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-fuchsia-300 hover:bg-fuchsia-50/80 transition-colors"
                        ref={targetInputRef}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Yêu cầu (tùy chọn)</h4>
                    <Input placeholder="VD: giữ biểu cảm vui..." value={note} onChange={(e) => setNote(e.target.value)} className="bg-white/80" />
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="lg:w-[200px] lg:shrink-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-fuchsia-200/60 h-full">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">Tùy chọn</CardTitle>
                  <CardDescription className="text-xs">Chất lượng xuất ảnh.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Chất lượng ảnh</h4>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setImageQuality('2K')} className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${imageQuality === '2K' ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'}`}>
                        2K (2)
                      </button>
                      <button type="button" onClick={() => setImageQuality('4K')} className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${imageQuality === '4K' ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'}`}>
                        4K (4)
                      </button>
                    </div>
                  </div>
                  <div className="pt-4 border-t space-y-2 flex flex-col items-center">
                    <DepositCreditButton variant="outline" size="sm" className="w-full max-w-[180px] border-fuchsia-200 text-fuchsia-700 hover:bg-fuchsia-50" />
                    <Button onClick={() => checkCreditsAndProceed(cost, handleSubmit)} disabled={!faceImage.file || !targetImage.file} className="w-full max-w-[180px] h-9 shadow-md hover:shadow-lg transition-all text-sm bg-fuchsia-600 hover:bg-fuchsia-700 text-white">
                      <Sparkles className="mr-2 h-4 w-4" /> Hoán đổi ({imageQuality === '2K' ? '2' : '4'} credit)
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground mt-2">* Thời gian: 15–45 giây</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === 'GENERATING' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-fuchsia-200/60">
            <CardContent className="flex flex-col items-center py-8">
              <ImageProcessingLoader mode="faceswap" title="Đang hoán đổi khuôn mặt" description="AI đang ghép mặt và điều chỉnh tự nhiên" imagePreview={faceImage.preview} />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>Kết quả</CardTitle>
              <CardDescription>Đã hoán đổi khuôn mặt.</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Ảnh gốc</h3>
                {targetImage.preview && (
                  <div className="aspect-square max-w-[400px] max-h-[400px] rounded-lg border overflow-hidden">
                    <ImagePreview src={targetImage.preview} alt="Gốc" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground">Sau khi ghép mặt</h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleReset}><RefreshCw className="mr-2 h-3 w-3" /> Thử lại</Button>
                    <DownloadImageButton imageUrl={resultUrl} filename="faceswap-result" size="sm" className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white border-0" />
                  </div>
                </div>
                <div className="aspect-square max-w-[400px] max-h-[400px] rounded-lg border overflow-hidden">
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
