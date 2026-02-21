'use client'

import { useState, useRef, ChangeEvent, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { beautifyImage } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, RefreshCw, Link2 } from 'lucide-react'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { DownloadImageButton } from '@/components/download-image-button'
import { ImagePreview } from '@/components/ui/image-preview'
import { ImageProcessingLoader } from '@/components/image-processing-loader'

type Step = 'UPLOAD' | 'GENERATING' | 'RESULT'
type PersonCount = 1 | 2 | 3 | 4
type BeautifyStyle = 'natural' | 'korean' | 'pro_sharp' | 'beauty_glow' | 'male_elegant' | 'female_soft' | 'mixed_group'
type BeautifyStrength = 'light' | 'medium' | 'strong'

const PERSON_LABELS: Record<PersonCount, string[]> = {
  1: ['Người trong ảnh'],
  2: ['Người bên trái', 'Người bên phải'],
  3: ['Người bên trái', 'Người ở giữa', 'Người bên phải'],
  4: ['Người 1 (từ trái)', 'Người 2', 'Người 3', 'Người 4'],
}

const setImageFromFile = (file: File, setImage: (v: { file: File; preview: string }) => void) => {
  if (!file.type.startsWith('image/')) return false
  setImage({ file, preview: URL.createObjectURL(file) })
  return true
}

export default function LamDepAnhClientPage() {
  const [step, setStep] = useState<Step>('UPLOAD')
  const [image, setImage] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const [personCount, setPersonCount] = useState<PersonCount>(1)
  const [personGenders, setPersonGenders] = useState<('male' | 'female')[]>(['female'])
  const [beautifyStyle, setBeautifyStyle] = useState<BeautifyStyle>('natural')
  const [beautifyStrength, setBeautifyStrength] = useState<BeautifyStrength>('medium')
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
      toast({ title: 'Lỗi', description: 'Vui lòng tải lên ảnh cần làm đẹp.', variant: 'destructive' })
      return
    }
    setStep('GENERATING')
    const formData = new FormData()
    formData.append('image', image.file)
    formData.append('imageQuality', imageQuality)
    formData.append('personCount', String(personCount))
    formData.append('beautifyStyle', beautifyStyle)
    formData.append('beautifyStrength', beautifyStrength)
    for (let i = 0; i < personCount; i++) {
      formData.append(`person_${i}_gender`, personGenders[i] ?? 'female')
    }
    formData.append('note', note)
    const result = await beautifyImage(formData)
    if (result.error) {
      setStep('UPLOAD')
      toast({ title: 'Làm đẹp thất bại', description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      toast({ title: 'Thành công!', description: 'Ảnh đã được làm đẹp.', duration: 3000 })
    }
  }

  const handleReset = () => {
    setStep('UPLOAD')
    setImage({ file: null, preview: null })
    setNote('')
    setResultUrl(null)
  }

  const handlePersonCountChange = (n: PersonCount) => {
    setPersonCount(n)
    setPersonGenders((prev) => {
      const next = [...prev.slice(0, n)]
      while (next.length < n) next.push('female')
      return next
    })
  }

  const setPersonGender = (i: number, g: 'male' | 'female') => {
    setPersonGenders((prev) => {
      const next = [...prev]
      next[i] = g
      return next
    })
  }

  return (
    <>
      <Toaster />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Làm đẹp ảnh</h1>
          <p className="text-muted-foreground mt-1">Retouch ảnh 1–4 người như studio. Chọn số người và giới tính từng người cho AI xử lý đúng. Giữ nguyên nét khuôn mặt. 1,5–3 credits/ảnh.</p>
        </div>

        {step === 'UPLOAD' && (
          <div className="grid lg:grid-cols-[1fr_200px] gap-4 items-start">
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-rose-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="h-4 w-4 text-rose-600" /> Tải ảnh cần làm đẹp
                  </CardTitle>
                  <CardDescription className="text-xs">Chọn ảnh chân dung, dán ảnh (Ctrl+V) hoặc dán link ảnh.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <div className="rounded-lg space-y-2">
                    <label
                      htmlFor="lam-dep-input"
                      className="block w-full aspect-[4/3] max-h-[400px] rounded-lg border-2 border-dashed border-rose-200 bg-rose-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-rose-300 hover:bg-rose-50/80 transition-colors"
                    >
                      {image.preview ? (
                        <ImagePreview src={image.preview} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                      ) : (
                        <>
                          <Upload className="h-12 w-12 text-rose-500" />
                          <p className="text-sm text-muted-foreground font-medium">Chọn ảnh hoặc dán ảnh (Ctrl+V)</p>
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
                    id="lam-dep-input"
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
                      className="shrink-0 border-rose-200 text-rose-700 hover:bg-rose-50"
                    >
                      <Link2 className="mr-2 h-4 w-4" />
                      {urlLoading ? 'Đang tải...' : 'Lấy ảnh'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="lg:w-[220px] lg:shrink-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-rose-200/60 h-full">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">Tùy chọn</CardTitle>
                  <CardDescription className="text-xs">Chọn số người và giới tính từng người (từ trái sang phải).</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Số người trong ảnh</h4>
                    <div className="flex flex-wrap gap-1">
                      {([1, 2, 3, 4] as const).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => handlePersonCountChange(n)}
                          className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                            personCount === n
                              ? 'border-rose-500 bg-rose-50 text-rose-800'
                              : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                          }`}
                        >
                          {n} người
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Giới tính từng người</h4>
                    <div className="space-y-2">
                      {Array.from({ length: personCount }, (_, i) => (
                        <div key={i} className="space-y-1">
                          <span className="text-[10px] text-muted-foreground block">{PERSON_LABELS[personCount][i]}</span>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => setPersonGender(i, 'male')}
                              className={`flex-1 px-2 py-1.5 rounded border text-xs font-medium ${
                                personGenders[i] === 'male'
                                  ? 'border-rose-500 bg-rose-50 text-rose-800'
                                  : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                              }`}
                            >
                              Nam
                            </button>
                            <button
                              type="button"
                              onClick={() => setPersonGender(i, 'female')}
                              className={`flex-1 px-2 py-1.5 rounded border text-xs font-medium ${
                                personGenders[i] === 'female'
                                  ? 'border-rose-500 bg-rose-50 text-rose-800'
                                  : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                              }`}
                            >
                              Nữ
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Yêu cầu thêm</h4>
                    <Textarea
                      placeholder="Ví dụ: ưu tiên da mịn, giữ râu..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="bg-white/80 text-xs h-20 min-h-[80px] resize-y"
                    />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phong cách làm đẹp</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        ['natural', 'Tự nhiên'],
                        ['korean', 'Makeup nhẹ Hàn'],
                        ['pro_sharp', 'Sắc nét chuyên nghiệp'],
                        ['beauty_glow', 'Beauty glow'],
                        ['male_elegant', 'Nam lịch lãm'],
                        ['female_soft', 'Nữ mềm mại'],
                        ['mixed_group', 'Nhóm nam + nữ'],
                      ] as [BeautifyStyle, string][]).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setBeautifyStyle(value)}
                          className={`px-2 py-2 rounded-md border text-[11px] font-medium transition-colors ${
                            beautifyStyle === value
                              ? 'border-rose-500 bg-rose-50 text-rose-800'
                              : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mức độ</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        ['light', 'Nhẹ'],
                        ['medium', 'Vừa'],
                        ['strong', 'Mạnh'],
                      ] as [BeautifyStrength, string][]).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setBeautifyStrength(value)}
                          className={`px-2 py-2 rounded-md border text-xs font-medium transition-colors ${
                            beautifyStrength === value
                              ? 'border-rose-500 bg-rose-50 text-rose-800'
                              : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                          }`}
                        >
                          {label}
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
                          imageQuality === '2K'
                            ? 'border-rose-500 bg-rose-50 text-rose-800'
                            : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        2K (1,5)
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageQuality('4K')}
                        className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                          imageQuality === '4K'
                            ? 'border-rose-500 bg-rose-50 text-rose-800'
                            : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        4K (3)
                      </button>
                    </div>
                  </div>
                  <div className="pt-4 border-t space-y-2 flex flex-col items-center">
                    <DepositCreditButton
                      variant="outline"
                      size="sm"
                      className="w-full max-w-[180px] border-rose-200 text-rose-700 hover:bg-rose-50"
                    />
                    <Button
                      onClick={() => checkCreditsAndProceed(cost, handleSubmit)}
                      disabled={!image.file}
                      className="w-full max-w-[180px] h-9 shadow-md hover:shadow-lg transition-all text-sm bg-rose-600 hover:bg-rose-700 text-white"
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> Làm đẹp ({imageQuality === '2K' ? '1,5' : '3'} credit)
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
                mode="beautify"
                title="Đang làm đẹp ảnh"
                description="AI đang retouch như studio, giữ nguyên nét khuôn mặt"
                imagePreview={image.preview}
              />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>Kết quả làm đẹp</CardTitle>
              <CardDescription>Ảnh đã được retouch như studio.</CardDescription>
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
                    <DownloadImageButton imageUrl={resultUrl} filename="lam-dep-result" size="sm" className="bg-rose-600 hover:bg-rose-700 text-white border-0" />
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
      <p className="text-xs text-muted-foreground text-center mt-6">Chọn đúng số người và giới tính từng người (từ trái sang phải) để kết quả tốt nhất. Ảnh do AI tạo có thể có sai sót.</p>
    </>
  )
}
