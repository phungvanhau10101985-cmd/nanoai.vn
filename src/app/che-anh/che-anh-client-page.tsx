'use client'

import { useState, useRef, ChangeEvent, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cheAnh } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, Download, RefreshCw, Link2, Plus, X } from 'lucide-react'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { DownloadImageButton } from '@/components/download-image-button'
import { ImagePreview } from '@/components/ui/image-preview'
import { ImageProcessingLoader } from '@/components/image-processing-loader'

type Step = 'UPLOAD' | 'GENERATING' | 'RESULT'

const MAX_IMAGES = 13

const MEME_STYLES: { value: string; label: string }[] = [
  { value: '', label: 'Chọn phong cách meme...' },
  { value: 'cam_xuc', label: 'Meme cảm xúc – Khóc, cười, ngạc nhiên, cười đểu, "haha"' },
  { value: 'dong_vat', label: 'Meme động vật – Chó, mèo (Corgi, Husky, Shiba, mèo lè lưỡi, loading)' },
  { value: 'nhan_vat', label: 'Meme nhân vật – Anime, hoạt hình (Pikachu, Tom & Jerry, Doremon), người nổi tiếng (Obama, The Rock, Messi)' },
  { value: 'phan_ung', label: 'Meme phản ứng (Reaction) – Dùng để comment, trả lời tin nhắn' },
  { value: 'deep_dark', label: 'Meme deep/dark – Châm biếm sâu cay, suy ngẫm, không dành cho người yếu tim' },
  { value: 'kho_hieu', label: 'Meme khó hiểu (vô tri/lú) – Nhìn không hiểu gì nhưng càng nhìn càng buồn cười' },
  { value: 've_tay', label: 'Meme vẽ tay – Nét vẽ nguệch ngoạc, kỹ thuật số, phong cách "tay ngang" châm biếm cực gắt' },
  { value: 'co_dien', label: 'Meme cổ điển – LOLcats, Condescending Wonka, Chuck Norris Facts, Gangnam Style' },
]

export default function CheAnhClientPage() {
  const [step, setStep] = useState<Step>('UPLOAD')
  const [images, setImages] = useState<{ file: File; preview: string; note: string }[]>([])
  const [memeStyle, setMemeStyle] = useState('')
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const [note, setNote] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cost = imageQuality === '2K' ? 1.5 : 3

  const addImage = (file: File) => {
    if (!file.type.startsWith('image/')) return false
    setImages((prev) => {
      if (prev.length >= MAX_IMAGES) return prev
      return [...prev, { file, preview: URL.createObjectURL(file), note: '' }]
    })
    return true
  }

  const handleImageNoteChange = (index: number, value: string) => {
    setImages((prev) => prev.map((img, i) => (i === index ? { ...img, note: value } : img)))
  }

  const handleAddImages = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    const newImages: { file: File; preview: string; note: string }[] = []
    for (let i = 0; i < files.length && images.length + newImages.length < MAX_IMAGES; i++) {
      const file = files[i]
      if (file.type.startsWith('image/')) {
        newImages.push({ file, preview: URL.createObjectURL(file), note: '' })
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
    if (images.length >= MAX_IMAGES) {
      toast({ title: 'Lỗi', description: `Đã đủ tối đa ${MAX_IMAGES} ảnh.`, variant: 'destructive' })
      return
    }
    setUrlLoading(true)
    try {
      const res = await fetch(url, { mode: 'cors' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      if (!blob.type.startsWith('image/')) throw new Error('Không phải ảnh')
      const file = new File([blob], 'image-from-url.png', { type: blob.type || 'image/png' })
      if (addImage(file)) {
        setImageUrl('')
        toast({ title: 'Đã tải ảnh', description: 'Ảnh từ link đã được thêm.', duration: 2000 })
      }
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
      if (step !== 'UPLOAD' || images.length >= MAX_IMAGES) return
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file && addImage(file)) {
            e.preventDefault()
            toast({ title: 'Đã dán ảnh', description: 'Ảnh từ clipboard đã được thêm.', duration: 2000 })
          }
          break
        }
      }
    }
    document.addEventListener('paste', fn)
    return () => document.removeEventListener('paste', fn)
  }, [step, toast, images.length])

  const handleSubmit = async () => {
    if (images.length === 0) {
      toast({ title: 'Lỗi', description: 'Vui lòng tải lên ảnh cần chế.', variant: 'destructive' })
      return
    }
    if (!memeStyle) {
      toast({ title: 'Lỗi', description: 'Vui lòng chọn phong cách meme.', variant: 'destructive' })
      return
    }
    setStep('GENERATING')
    const formData = new FormData()
    formData.append('memeStyle', memeStyle)
    formData.append('imageQuality', imageQuality)
    formData.append('note', note)
    images.forEach((img, i) => {
      formData.append(`image_${i}`, img.file)
      formData.append(`image_${i}_note`, img.note || '')
    })
    const result = await cheAnh(formData)
    if (result.error) {
      setStep('UPLOAD')
      toast({ title: 'Chế ảnh thất bại', description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      toast({ title: 'Thành công!', description: 'Ảnh đã được chế.', duration: 3000 })
    }
  }

  const handleReset = () => {
    setStep('UPLOAD')
    setImages([])
    setMemeStyle('')
    setNote('')
    setResultUrl(null)
  }

  return (
    <>
      <Toaster />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Chế ảnh</h1>
          <p className="text-muted-foreground mt-1">Chọn ảnh (tối đa 13), mô tả ý tưởng. AI biến tấu ảnh theo yêu cầu. 1,5–3 credits/ảnh.</p>
        </div>

        {step === 'UPLOAD' && (
          <div className="grid lg:grid-cols-[1fr_200px] gap-4 items-start">
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-amber-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="h-4 w-4 text-amber-600" /> Ảnh cần chế (tối đa 13)
                  </CardTitle>
                  <CardDescription className="text-xs">Chọn ảnh, dán ảnh (Ctrl+V) hoặc dán link ảnh. Ghi chú chung và/hoặc ghi chú riêng từng ảnh.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground">Phong cách meme <span className="text-amber-600">*</span></h4>
                    <select
                      value={memeStyle}
                      onChange={(e) => setMemeStyle(e.target.value)}
                      className="w-full max-w-md h-11 rounded-lg border-2 border-amber-200 bg-white px-4 text-sm font-medium"
                    >
                      {MEME_STYLES.map((opt) => (
                        <option key={opt.value || 'empty'} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ghi chú chung (tùy chọn – áp dụng cho tất cả ảnh)</h4>
                    <Textarea
                      placeholder="Ví dụ: đặt vào bối cảnh vũ trụ, thêm mũ vua, biến thành nhân vật anime..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="bg-white/80 text-xs h-20 min-h-[80px] resize-y"
                    />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ảnh cần chế (ghi chú riêng từng ảnh bên dưới)</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {images.map((img, i) => (
                        <div key={i} className="space-y-1.5">
                          <div className="relative group aspect-square rounded-lg border overflow-hidden bg-amber-50/60">
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
                          <Input
                            placeholder={`Ghi chú riêng ảnh ${i + 1} (tùy chọn)`}
                            value={img.note}
                            onChange={(e) => handleImageNoteChange(i, e.target.value)}
                            className="text-xs h-8"
                          />
                        </div>
                      ))}
                      {images.length < MAX_IMAGES && (
                        <label
                          htmlFor="che-anh-input"
                          className="aspect-square rounded-lg border-2 border-dashed border-amber-200 bg-amber-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-amber-300 hover:bg-amber-50/80 transition-colors"
                        >
                          <Plus className="h-10 w-10 text-amber-500" />
                          <p className="text-xs text-muted-foreground font-medium">Thêm ảnh</p>
                        </label>
                      )}
                    </div>
                    <input
                      id="che-anh-input"
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleAddImages}
                    />
                  </div>
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
            <div className="lg:w-[200px] lg:shrink-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-amber-200/60 h-full">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">Tùy chọn</CardTitle>
                  <CardDescription className="text-xs">Yêu cầu thêm và chất lượng xuất ảnh.</CardDescription>
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
                      disabled={images.length === 0 || !memeStyle}
                      className="w-full max-w-[180px] h-9 shadow-md hover:shadow-lg transition-all text-sm bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> Chế ảnh ({imageQuality === '2K' ? '1,5' : '3'} credit)
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
                mode="cheanh"
                title="Đang chế ảnh"
                description="AI đang chỉnh sửa, biến tấu ảnh theo ý tưởng của bạn"
                imagePreviews={images.map((img) => img.preview)}
              />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>Kết quả chế ảnh</CardTitle>
              <CardDescription>Ảnh đã được chế.</CardDescription>
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
                    <DownloadImageButton imageUrl={resultUrl} filename="che-anh-result" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white border-0" />
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
