'use client'

import { useState, useRef, ChangeEvent, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { create3DMockup } from './actions'
import { preloadImageUrl } from '@/lib/preload-image-url'

const SAMPLE_PRODUCTS = [
  { id: 'phone', label: 'Điện thoại', url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800' },
  { id: 'cup', label: 'Cốc/Tumbler', url: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=800' },
  { id: 'box', label: 'Hộp sản phẩm', url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800' },
  { id: 'bag', label: 'Túi vải', url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800' },
  { id: 'bottle', label: 'Chai nước', url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800' },
]
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, RefreshCw, Link2, Box, ImageIcon, Tag } from 'lucide-react'
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

export default function TaoAnh3DClientPage() {
  const [step, setStep] = useState<Step>('UPLOAD')
  const [useSample, setUseSample] = useState(false)
  const [productImage, setProductImage] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [logoImage, setLogoImage] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [selectedSampleId, setSelectedSampleId] = useState('')
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const [note, setNote] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlTarget, setUrlTarget] = useState<'product' | 'logo'>('product')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const productInputRef = useRef<HTMLInputElement>(null)
  const cost = imageQuality === '2K' ? 1.5 : 3
  const logoInputRef = useRef<HTMLInputElement>(null)

  const handleProductChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && setImageFromFile(file, (v) => setProductImage({ file: v.file, preview: v.preview }))) {
      setUseSample(false)
      setSelectedSampleId('')
    }
  }

  const handleLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setImageFromFile(file, (v) => setLogoImage({ file: v.file, preview: v.preview }))
  }

  const handleSelectSample = (id: string) => {
    setSelectedSampleId(id)
    setUseSample(true)
    setProductImage({ file: null, preview: null })
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
      if (urlTarget === 'product') {
        setImageFromFile(file, (v) => setProductImage({ file: v.file, preview: v.preview }))
        setUseSample(false)
        setSelectedSampleId('')
      } else {
        setImageFromFile(file, (v) => setLogoImage({ file: v.file, preview: v.preview }))
      }
      setImageUrl('')
      toast({ title: 'Đã tải ảnh', description: 'Ảnh từ link đã được thêm.', duration: 2000 })
    } catch {
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
          if (file && setImageFromFile(file, (v) => setLogoImage({ file: v.file, preview: v.preview }))) {
            e.preventDefault()
            toast({ title: 'Đã dán ảnh', description: 'Ảnh logo đã được thêm.', duration: 2000 })
          }
          break
        }
      }
    }
    document.addEventListener('paste', fn)
    return () => document.removeEventListener('paste', fn)
  }, [step, toast])

  const canSubmit = logoImage.file && (useSample ? !!selectedSampleId : !!productImage.file)

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast({ title: 'Lỗi', description: 'Cần ảnh sản phẩm (hoặc chọn mẫu) và ảnh logo.', variant: 'destructive' })
      return
    }
    setStep('GENERATING')
    const formData = new FormData()
    if (productImage.file) formData.append('productImage', productImage.file)
    formData.append('logoImage', logoImage.file!)
    formData.append('useSample', String(useSample))
    formData.append('sampleId', selectedSampleId)
    formData.append('imageQuality', imageQuality)
    formData.append('note', note)
    const result = await create3DMockup(formData)
    if (result.error) {
      setStep('UPLOAD')
      toast({ title: 'Tạo mockup thất bại', description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      await preloadImageUrl(result.resultUrl)
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      toast({ title: 'Thành công!', description: 'Đã tạo ảnh 3D mockup.', duration: 3000 })
    }
  }

  const handleReset = () => {
    setStep('UPLOAD')
    setProductImage({ file: null, preview: null })
    setLogoImage({ file: null, preview: null })
    setUseSample(false)
    setSelectedSampleId('')
    setNote('')
    setResultUrl(null)
  }

  return (
    <>
      <Toaster />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
            <Box className="h-8 w-8 text-cyan-600" /> Tạo ảnh 3D (Mockup sản phẩm)
          </h1>
          <p className="text-muted-foreground mt-1">Ảnh 1: Sản phẩm (hoặc chọn mẫu). Ảnh 2: Logo in lên sản phẩm. 1,5–3 credits/ảnh.</p>
        </div>

        {step === 'UPLOAD' && (
          <div className="grid lg:grid-cols-[1fr_200px] gap-4 items-start">
            <div className="min-w-0 space-y-4">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-cyan-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ImageIcon className="h-4 w-4 text-cyan-600" /> Ảnh 1: Ảnh sản phẩm
                  </CardTitle>
                  <CardDescription className="text-xs">Ảnh sản phẩm của bạn hoặc chọn mẫu (điện thoại, cốc, hộp...). Logo sẽ in lên đây.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setUseSample(false); setSelectedSampleId(''); setProductImage({ file: null, preview: null }) }}
                      className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium ${!useSample ? 'border-cyan-500 bg-cyan-50 text-cyan-800' : 'border-gray-200 hover:bg-gray-50'}`}
                    >
                      Tải ảnh sản phẩm
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseSample(true)}
                      className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium ${useSample ? 'border-cyan-500 bg-cyan-50 text-cyan-800' : 'border-gray-200 hover:bg-gray-50'}`}
                    >
                      Chọn mẫu
                    </button>
                  </div>
                  {!useSample ? (
                    <label
                      htmlFor="product-input"
                      className="block w-full aspect-[4/3] max-h-[220px] rounded-lg border-2 border-dashed border-cyan-200 bg-cyan-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-cyan-300"
                    >
                      {productImage.preview ? (
                        <ImagePreview src={productImage.preview} alt="Sản phẩm" className="w-full h-full object-contain rounded-lg" />
                      ) : (
                        <>
                          <Upload className="h-10 w-10 text-cyan-500" />
                          <p className="text-sm text-muted-foreground">Chọn ảnh sản phẩm</p>
                        </>
                      )}
                    </label>
                  ) : null}
                  {!useSample && productImage.preview && (
                    <button type="button" onClick={() => productInputRef.current?.click()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <RefreshCw className="h-3.5 w-3.5" /> Chọn lại
                    </button>
                  )}
                  {useSample && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {SAMPLE_PRODUCTS.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleSelectSample(s.id)}
                          className={`relative aspect-square rounded-lg border-2 overflow-hidden transition-all ${selectedSampleId === s.id ? 'border-cyan-500 ring-2 ring-cyan-200' : 'border-gray-200 hover:border-cyan-300'}`}
                        >
                          <img src={s.url} alt={s.label} className="w-full h-full object-cover" />
                          <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] py-0.5 text-center">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <input id="product-input" ref={productInputRef} type="file" accept="image/*" className="hidden" onChange={handleProductChange} />
                </CardContent>
              </Card>

              <Card className="border shadow-sm bg-white/80 backdrop-blur border-cyan-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Tag className="h-4 w-4 text-cyan-600" /> Ảnh 2: Logo / Thương hiệu
                  </CardTitle>
                  <CardDescription className="text-xs">Logo, thiết kế in lên sản phẩm. Bắt buộc.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <label
                    htmlFor="logo-input"
                    className="block w-full aspect-[4/3] max-h-[220px] rounded-lg border-2 border-dashed border-cyan-200 bg-cyan-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-cyan-300"
                  >
                    {logoImage.preview ? (
                      <ImagePreview src={logoImage.preview} alt="Logo" className="w-full h-full object-contain rounded-lg" />
                    ) : (
                      <>
                        <Upload className="h-10 w-10 text-cyan-500" />
                        <p className="text-sm text-muted-foreground">Chọn ảnh logo / thương hiệu</p>
                      </>
                    )}
                  </label>
                  {logoImage.preview && (
                    <button type="button" onClick={() => logoInputRef.current?.click()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <RefreshCw className="h-3.5 w-3.5" /> Chọn lại
                    </button>
                  )}
                  <input id="logo-input" ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                </CardContent>
              </Card>

              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Yêu cầu thêm (tùy chọn)</h4>
                <Input placeholder="VD: nền trắng, góc nghiêng 45 độ..." value={note} onChange={(e) => setNote(e.target.value)} className="bg-white/80" />
              </div>
              <div className="flex gap-2">
                <select value={urlTarget} onChange={(e) => setUrlTarget(e.target.value as 'product' | 'logo')} className="px-3 py-2 rounded-md border border-gray-200 bg-white text-sm w-36">
                  <option value="product">Ảnh sản phẩm</option>
                  <option value="logo">Ảnh logo</option>
                </select>
                <Input placeholder="Dán link ảnh rồi bấm Lấy ảnh" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="flex-1" />
                <Button type="button" variant="outline" onClick={handleFetchFromUrl} disabled={urlLoading} className="shrink-0 border-cyan-200 text-cyan-700 hover:bg-cyan-50">
                  <Link2 className="mr-2 h-4 w-4" /> {urlLoading ? 'Đang tải...' : 'Lấy ảnh'}
                </Button>
              </div>
            </div>
            <div className="lg:w-[200px] lg:shrink-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-cyan-200/60 h-full">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">Tùy chọn</CardTitle>
                  <CardDescription className="text-xs">Chất lượng xuất ảnh.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Chất lượng ảnh</h4>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setImageQuality('2K')} className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${imageQuality === '2K' ? 'border-cyan-500 bg-cyan-50 text-cyan-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'}`}>2K (1,5)</button>
                      <button type="button" onClick={() => setImageQuality('4K')} className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${imageQuality === '4K' ? 'border-cyan-500 bg-cyan-50 text-cyan-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'}`}>4K (3)</button>
                    </div>
                  </div>
                  <div className="pt-4 border-t space-y-2 flex flex-col items-center">
                    <DepositCreditButton variant="outline" size="sm" className="w-full max-w-[180px] border-cyan-200 text-cyan-700 hover:bg-cyan-50" />
                    <Button onClick={() => checkCreditsAndProceed(cost, handleSubmit)} disabled={!canSubmit} className="w-full max-w-[180px] h-9 shadow-md hover:shadow-lg transition-all text-sm bg-cyan-600 hover:bg-cyan-700 text-white">
                      <Sparkles className="mr-2 h-4 w-4" /> Tạo mockup ({imageQuality === '2K' ? '1,5' : '3'} credit)
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground mt-2">* Thời gian: 15–45 giây</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === 'GENERATING' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-cyan-200/60">
            <CardContent className="flex flex-col items-center py-8">
              <ImageProcessingLoader mode="mockup3d" title="Đang tạo mockup 3D" description="AI đang in logo lên sản phẩm" imagePreview={logoImage.preview} />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>Kết quả</CardTitle>
              <CardDescription>Đã tạo ảnh 3D mockup.</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Logo gốc</h3>
                {logoImage.preview && (
                  <div className="aspect-square rounded-lg border overflow-hidden">
                    <ImagePreview src={logoImage.preview} alt="Logo" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground">Mockup 3D</h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleReset}><RefreshCw className="mr-2 h-3 w-3" /> Thử lại</Button>
                    <DownloadImageButton imageUrl={resultUrl} filename="mockup-3d-result" size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white border-0" />
                  </div>
                </div>
                <div className="aspect-square rounded-lg border overflow-hidden">
                  <ImagePreview src={resultUrl} alt="Mockup 3D" className="w-full h-full object-cover" />
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
