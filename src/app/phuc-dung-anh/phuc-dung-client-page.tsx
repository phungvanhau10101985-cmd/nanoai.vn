'use client'

import { useState, useRef, ChangeEvent, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { restoreImage } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, Download, RefreshCw, Link2 } from 'lucide-react'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { DownloadImageButton } from '@/components/download-image-button'
import { ImagePreview } from '@/components/ui/image-preview'
import { ImageProcessingLoader } from '@/components/image-processing-loader'

type Step = 'UPLOAD' | 'GENERATING' | 'RESULT'
type ColorMode = 'original' | 'colorize'
type PersonCount = 1 | 2 | 3 | 4 | 5 | 6

const PERSON_LABELS: Record<PersonCount, string[]> = {
  1: ['Người trong ảnh'],
  2: ['Người bên trái', 'Người bên phải'],
  3: ['Người bên trái', 'Người ở giữa', 'Người bên phải'],
  4: ['Người thứ 1 (từ trái)', 'Người thứ 2', 'Người thứ 3', 'Người thứ 4'],
  5: ['Người thứ 1 (từ trái)', 'Người thứ 2', 'Người thứ 3', 'Người thứ 4', 'Người thứ 5'],
  6: [],
}

const setImageFromFile = (file: File, setImage: (v: { file: File; preview: string }) => void) => {
  if (!file.type.startsWith('image/')) return false
  setImage({ file, preview: URL.createObjectURL(file) })
  return true
}

export default function PhucDungClientPage() {
  const [step, setStep] = useState<Step>('UPLOAD')
  const [image, setImage] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [colorMode, setColorMode] = useState<ColorMode>('original')
  const [personCount, setPersonCount] = useState<PersonCount>(1)
  const [personInfo, setPersonInfo] = useState<{ gender: string; age: string; extra: string }[]>(() =>
    Array(5).fill(null).map(() => ({ gender: '', age: '', extra: '' }))
  )
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const [imageUrl, setImageUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [note, setNote] = useState('')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cost = imageQuality === '2K' ? 4 : 8

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

  const allPersonsFilled = () => {
    if (personCount >= 6) return true
    for (let i = 0; i < personCount; i++) {
      const p = personInfo[i]
      if (!p?.gender || !p?.age?.trim()) return false
    }
    return true
  }
  const canSubmit = image.file && allPersonsFilled()

  const handleSubmit = async () => {
    if (!image.file) {
      toast({ title: 'Lỗi', description: 'Vui lòng tải lên ảnh cần phục dựng.', variant: 'destructive' })
      return
    }
    if (!allPersonsFilled()) {
      toast({ title: 'Lỗi', description: 'Vui lòng chọn giới tính và nhập tuổi cho từng người trong ảnh.', variant: 'destructive' })
      return
    }
    setStep('GENERATING')
    const formData = new FormData()
    formData.append('image', image.file)
    formData.append('colorMode', colorMode)
    formData.append('imageQuality', imageQuality)
    formData.append('personCount', String(personCount))
    formData.append('note', note)
    if (personCount < 6) {
      for (let i = 0; i < personCount; i++) {
        formData.append(`person_${i}_gender`, personInfo[i]?.gender || '')
        formData.append(`person_${i}_age`, personInfo[i]?.age || '')
        formData.append(`person_${i}_extra`, personInfo[i]?.extra || '')
      }
    }
    const result = await restoreImage(formData)
    if (result.error) {
      setStep('UPLOAD')
      toast({ title: 'Phục dựng thất bại', description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      toast({ title: 'Thành công!', description: 'Ảnh đã được phục dựng.', duration: 3000 })
    }
  }

  const handleReset = () => {
    setStep('UPLOAD')
    setImage({ file: null, preview: null })
    setPersonCount(1)
    setPersonInfo(Array(5).fill(null).map(() => ({ gender: '', age: '', extra: '' })))
    setNote('')
    setResultUrl(null)
  }

  return (
    <>
      <Toaster />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Phục dựng ảnh</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Sửa ảnh cũ, mờ, hư hỏng và tăng chất lượng với AI. 4–8 credits/ảnh.</p>
        </div>

        {step === 'UPLOAD' && (
          <div className="grid lg:grid-cols-[1fr_240px_240px] gap-5 items-start">
            {/* Cột 1: Tải ảnh */}
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/95 backdrop-blur border-amber-200/60">
                <CardHeader className="p-5 pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Upload className="h-5 w-5 text-amber-600" /> Tải ảnh cần phục dựng
                  </CardTitle>
                  <CardDescription className="text-sm">Chọn ảnh, dán ảnh (Ctrl+V) hoặc dán link ảnh.</CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-0 space-y-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="phuc-dung-input"
                      className="block w-full aspect-[4/3] max-h-[400px] rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-amber-400 hover:bg-amber-50/80 transition-colors"
                    >
                      {image.preview ? (
                        <ImagePreview src={image.preview} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                      ) : (
                        <>
                          <Upload className="h-14 w-14 text-amber-500" />
                          <p className="text-sm font-medium text-muted-foreground">Chọn ảnh hoặc dán ảnh (Ctrl+V)</p>
                        </>
                      )}
                    </label>
                    {image.preview && (
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <RefreshCw className="h-3.5 w-3.5" /> Chọn lại
                      </button>
                    )}
                  </div>
                  <input
                    id="phuc-dung-input"
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      placeholder="Dán link ảnh rồi bấm Lấy ảnh"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="flex-1 min-w-0"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleFetchFromUrl}
                      disabled={urlLoading}
                      className="shrink-0 min-h-[44px] border-amber-200 text-amber-700 hover:bg-amber-50 touch-manipulation"
                    >
                      <Link2 className="mr-2 h-4 w-4" />
                      {urlLoading ? 'Đang tải...' : 'Lấy ảnh'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Cột 2: Số người - Giới tính & Tuổi (bắt buộc) */}
            <div className="lg:w-[240px] lg:shrink-0">
              <Card className="border shadow-sm bg-white/95 backdrop-blur border-amber-200/60">
                <CardHeader className="p-5 pb-3">
                  <CardTitle className="text-lg">Thông tin từng người</CardTitle>
                  <CardDescription className="text-sm">Từ 1-5 người: chọn giới tính + tuổi từng người. Chọn 6+ người: AI tự tối ưu 100%.</CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-0 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground">Số người trong ảnh</h4>
                    <div className="grid grid-cols-6 gap-2">
                      {([1, 2, 3, 4, 5, 6] as PersonCount[]).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setPersonCount(n)}
                          className={`py-2.5 rounded-lg border-2 text-sm font-semibold transition-all ${
                            personCount === n
                              ? 'border-amber-500 bg-amber-50 text-amber-800 ring-2 ring-amber-200'
                              : 'border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50/50 text-muted-foreground'
                          }`}
                        >
                          {n === 6 ? '6+' : n}
                        </button>
                      ))}
                    </div>
                  </div>
                  {personCount < 6 ? (
                    <div className="space-y-3">
                      {PERSON_LABELS[personCount].map((label, i) => (
                        <div key={i} className="rounded-xl border-2 border-gray-100 bg-gray-50/50 p-3 space-y-2">
                          <p className="text-sm font-semibold text-foreground">{label}</p>
                          <div className="space-y-2">
                            <div>
                              <span className="text-xs font-medium text-muted-foreground block mb-1">Giới tính *</span>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPersonInfo((prev) => {
                                      const next = [...prev]
                                      next[i] = { ...next[i], gender: 'nam' }
                                      return next
                                    })
                                  }
                                  className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-semibold transition-all ${
                                    personInfo[i]?.gender === 'nam'
                                      ? 'border-amber-500 bg-amber-50 text-amber-800'
                                      : 'border-gray-200 bg-white hover:border-amber-300 text-muted-foreground'
                                  }`}
                                >
                                  Nam
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPersonInfo((prev) => {
                                      const next = [...prev]
                                      next[i] = { ...next[i], gender: 'nữ' }
                                      return next
                                    })
                                  }
                                  className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-semibold transition-all ${
                                    personInfo[i]?.gender === 'nữ'
                                      ? 'border-amber-500 bg-amber-50 text-amber-800'
                                      : 'border-gray-200 bg-white hover:border-amber-300 text-muted-foreground'
                                  }`}
                                >
                                  Nữ
                                </button>
                              </div>
                            </div>
                            <div>
                              <span className="text-xs font-medium text-muted-foreground block mb-1">Tuổi *</span>
                              <Input
                                placeholder="VD: 25"
                                value={personInfo[i]?.age || ''}
                                onChange={(e) =>
                                  setPersonInfo((prev) => {
                                    const next = [...prev]
                                    next[i] = { ...next[i], age: e.target.value.replace(/\D/g, '').slice(0, 3) }
                                    return next
                                  })
                                }
                                className="h-10 text-sm font-medium"
                              />
                            </div>
                            <div>
                              <span className="text-xs font-medium text-muted-foreground block mb-1">Đặc thù (tùy chọn)</span>
                              <Input
                                placeholder="Màu tóc, tóc xoăn/thẳng, nốt ruồi..."
                                value={personInfo[i]?.extra || ''}
                                onChange={(e) =>
                                  setPersonInfo((prev) => {
                                    const next = [...prev]
                                    next[i] = { ...next[i], extra: e.target.value }
                                    return next
                                  })
                                }
                                className="h-9 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border-2 border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800">
                      Ảnh có 6 người trở lên: hệ thống sẽ để AI tự tối ưu toàn bộ (100%), không cần chọn giới tính từng người.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Cột 3: Tùy chọn & Phục dựng */}
            <div className="lg:w-[240px] lg:shrink-0">
              <Card className="border shadow-sm bg-white/95 backdrop-blur border-amber-200/60">
                <CardHeader className="p-5 pb-3">
                  <CardTitle className="text-lg">Cài đặt</CardTitle>
                  <CardDescription className="text-sm">Chất lượng & chế độ màu.</CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-0 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground">Chất lượng ảnh</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setImageQuality('2K')}
                        className={`py-3 rounded-lg border-2 text-sm font-semibold transition-all ${
                          imageQuality === '2K'
                            ? 'border-amber-500 bg-amber-50 text-amber-800'
                            : 'border-gray-200 bg-white hover:border-amber-300 text-muted-foreground'
                        }`}
                      >
                        2K (4)
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageQuality('4K')}
                        className={`py-3 rounded-lg border-2 text-sm font-semibold transition-all ${
                          imageQuality === '4K'
                            ? 'border-amber-500 bg-amber-50 text-amber-800'
                            : 'border-gray-200 bg-white hover:border-amber-300 text-muted-foreground'
                        }`}
                      >
                        4K (8)
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground">Chế độ màu</h4>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => setColorMode('original')}
                        className={`w-full py-3 rounded-lg border-2 text-sm font-semibold transition-all ${
                          colorMode === 'original'
                            ? 'border-amber-500 bg-amber-50 text-amber-800'
                            : 'border-gray-200 bg-white hover:border-amber-300 text-muted-foreground'
                        }`}
                      >
                        Giữ nguyên màu
                      </button>
                      <button
                        type="button"
                        onClick={() => setColorMode('colorize')}
                        className={`w-full py-3 rounded-lg border-2 text-sm font-semibold transition-all ${
                          colorMode === 'colorize'
                            ? 'border-amber-500 bg-amber-50 text-amber-800'
                            : 'border-gray-200 bg-white hover:border-amber-300 text-muted-foreground'
                        }`}
                      >
                        Phối màu như ảnh thật
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground">Yêu cầu về ảnh</h4>
                    <Textarea
                      placeholder="Ví dụ: Nền ảnh trong công viên, viết thêm chữ kỷ niệm 7 năm"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="bg-white/80 text-sm min-h-[80px] resize-y placeholder:text-sm placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="pt-4 border-t space-y-2 flex flex-col items-center">
                    <DepositCreditButton
                      variant="outline"
                      size="sm"
                      className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
                    />
                    <Button
                      onClick={() => checkCreditsAndProceed(cost, handleSubmit)}
                      disabled={!canSubmit}
                      className="w-full min-h-[44px] h-11 shadow-md hover:shadow-lg transition-all text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> Phục dựng ({imageQuality === '2K' ? '4' : '8'} credit)
                    </Button>
                    {!canSubmit && (
                      <p className="text-xs text-amber-600 font-medium">
                        {!image.file ? 'Tải ảnh và chọn giới tính, tuổi cho từng người.' : 'Chọn giới tính và nhập tuổi cho từng người.'}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">Thời gian: 15–45 giây</p>
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
                mode="restore"
                title="Đang phục dựng ảnh"
                description="AI đang phân tích và sửa mờ, xước, hư hỏng để khôi phục ảnh gốc"
                imagePreview={image.preview}
              />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>Kết quả phục dựng</CardTitle>
              <CardDescription>Ảnh đã được xử lý.</CardDescription>
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
                    <DownloadImageButton imageUrl={resultUrl} filename="phuc-dung-result" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white border-0" />
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
      <p className="text-xs text-muted-foreground text-center mt-6">Ảnh càng nét càng chính xác. Ảnh do AI tạo có thể có sai sót.</p>
    </>
  )
}
