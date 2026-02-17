'use client'

import { useState, useRef, ChangeEvent, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createIdCard } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, Download, RefreshCw, Link2 } from 'lucide-react'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { DownloadImageButton } from '@/components/download-image-button'
import { ImagePreview } from '@/components/ui/image-preview'
import { ImageProcessingLoader } from '@/components/image-processing-loader'

type Step = 'UPLOAD' | 'GENERATING' | 'RESULT'

const IDCARD_ASPECT_RATIOS = [
  { value: '3:4', label: '3:4 Chuẩn 3x4 (CMND/CCCD)' },
  { value: '2:3', label: '2:3 Ảnh 2x3 / 4x6 (Hộ chiếu)' },
  { value: '4:3', label: '4:3 Ngang 4x3' },
  { value: '1:1', label: '1:1 Vuông' },
] as const

const setImageFromFile = (file: File, setImage: (v: { file: File; preview: string }) => void) => {
  if (!file.type.startsWith('image/')) return false
  setImage({ file, preview: URL.createObjectURL(file) })
  return true
}

export default function TaoAnhTheClientPage() {
  const [step, setStep] = useState<Step>('UPLOAD')
  const [image, setImage] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const [aspectRatio, setAspectRatio] = useState<string>('3:4')
  const [note, setNote] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cost = imageQuality === '2K' ? 1.5 : 3

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setImageFromFile(file, setImage)
  }

  const handleFetchFromUrl = async () => {
    const url = imageUrl.trim()
    if (!url) {
      toast({ title: 'Lỗi', description: 'Vui lòng dán link ảnh.', variant: 'destructive' })
      return
    }
    if (!/^https?:\/\//i.test(url)) {
      toast({ title: 'Lỗi', description: 'Link không hợp lệ.', variant: 'destructive' })
      return
    }
    setUrlLoading(true)
    try {
      const res = await fetch(url, { mode: 'cors' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      if (!blob.type.startsWith('image/')) throw new Error('Không phải ảnh')
      const file = new File([blob], 'image-from-url.png', { type: blob.type || 'image/png' })
      setImageFromFile(file, setImage)
      setImageUrl('')
      toast({ title: 'Đã tải ảnh', description: 'Ảnh từ link đã được thêm.', duration: 2000 })
    } catch (err) {
      toast({
        title: 'Không tải được ảnh',
        description: 'Link có thể bị chặn CORS. Thử tải ảnh lên trực tiếp.',
        variant: 'destructive',
        duration: 5000,
      })
    } finally {
      setUrlLoading(false)
    }
  }

  useEffect(() => {
    const fn = (e: globalThis.ClipboardEvent) => {
      if (step !== 'UPLOAD') return
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file && setImageFromFile(file, setImage)) {
            e.preventDefault()
            toast({ title: 'Đã dán ảnh', description: 'Ảnh từ clipboard đã được thêm.', duration: 2000 })
          }
          break
        }
      }
    }
    document.addEventListener('paste', fn)
    return () => document.removeEventListener('paste', fn)
  }, [step, toast])

  const handleSubmit = async () => {
    if (!image.file) {
      toast({ title: 'Lỗi', description: 'Vui lòng tải lên ảnh cần tạo ảnh thẻ.', variant: 'destructive' })
      return
    }
    setStep('GENERATING')
    const formData = new FormData()
    formData.append('image', image.file)
    formData.append('imageQuality', imageQuality)
    formData.append('aspectRatio', aspectRatio)
    formData.append('note', note)
    const result = await createIdCard(formData)
    if (result.error) {
      setStep('UPLOAD')
      toast({ title: 'Tạo ảnh thẻ thất bại', description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      toast({ title: 'Thành công!', description: 'Ảnh thẻ đã được tạo.', duration: 3000 })
    }
  }

  const handleReset = () => {
    setStep('UPLOAD')
    setImage({ file: null, preview: null })
    setAspectRatio('3:4')
    setNote('')
    setResultUrl(null)
  }

  return (
    <>
      <Toaster />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Tạo ảnh thẻ</h1>
          <p className="text-muted-foreground mt-1">Tách nền, thay nền trắng/xanh. Chuẩn 3x4, 4x6. 1,5–3 credits/ảnh.</p>
        </div>

        {step === 'UPLOAD' && (
          <div className="grid lg:grid-cols-[1fr_240px] gap-4 items-start">
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-amber-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="h-4 w-4 text-amber-600" /> Tải ảnh cần tạo ảnh thẻ
                  </CardTitle>
                  <CardDescription className="text-xs">Chọn ảnh, dán ảnh (Ctrl+V) hoặc dán link ảnh.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <div className="rounded-lg">
                    <label
                      htmlFor="idcard-input"
                      className="block w-full aspect-[4/3] max-h-[400px] rounded-lg border-2 border-dashed border-amber-200 bg-amber-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-amber-300 hover:bg-amber-50/80 transition-colors"
                    >
                      {image.preview ? (
                        <ImagePreview src={image.preview} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                      ) : (
                        <>
                          <Upload className="h-12 w-12 text-amber-500" />
                          <p className="text-sm text-muted-foreground font-medium">Chọn ảnh hoặc dán ảnh (Ctrl+V)</p>
                        </>
                      )}
                    </label>
                  </div>
                  {image.preview && (
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors -mt-1">
                      <RefreshCw className="h-3.5 w-3.5" /> Chọn lại
                    </button>
                  )}
                  <input
                    id="idcard-input"
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder="Dán link ảnh rồi bấm Lấy ảnh"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleFetchFromUrl}
                      disabled={urlLoading}
                      className="shrink-0 border-amber-200 text-amber-700 hover:bg-amber-50"
                    >
                      <Link2 className="mr-2 h-4 w-4" />
                      {urlLoading ? 'Đang tải...' : 'Lấy ảnh'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="lg:w-[240px] lg:shrink-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-amber-200/60 h-full">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">Tùy chọn</CardTitle>
                  <CardDescription className="text-xs">Chọn tỷ lệ ảnh thẻ, yêu cầu thêm và chất lượng.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tỷ lệ ảnh thẻ</h4>
                    <div className="grid grid-cols-2 gap-1.5">
                      {IDCARD_ASPECT_RATIOS.map((r) => (
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
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Yêu cầu thêm</h4>
                    <Textarea
                      placeholder="Ví dụ: nền trắng, nền xanh, size 3x4, 4x6..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="bg-white/80 text-xs h-20 min-h-[80px] resize-y"
                    />
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
                      disabled={!image.file}
                      className="w-full max-w-[180px] h-9 shadow-md hover:shadow-lg transition-all text-sm bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> Tạo ảnh thẻ ({imageQuality === '2K' ? '1,5' : '3'} credit)
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
                mode="idcard"
                title="Đang tạo ảnh thẻ"
                description="AI đang tách nền và chuẩn hóa ảnh thẻ"
                imagePreview={image.preview}
              />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>Kết quả ảnh thẻ</CardTitle>
              <CardDescription>Ảnh thẻ đã được tạo.</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Trước</h3>
                {image.preview && (
                  <div className="aspect-square rounded-lg border overflow-hidden">
                    <ImagePreview src={image.preview} alt="Trước" className="w-full h-full object-cover" />
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
                    <DownloadImageButton imageUrl={resultUrl} filename="anh-the-result" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white border-0" />
                  </div>
                </div>
                <div
                  className="rounded-lg border overflow-hidden"
                  style={{ aspectRatio: aspectRatio.replace(':', '/') }}
                >
                  <ImagePreview src={resultUrl} alt="Sau" className="w-full h-full object-cover" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">Ảnh càng nét càng chính xác. Ảnh do AI tạo có thể có sai sót.</p>
    </>
  )
}
