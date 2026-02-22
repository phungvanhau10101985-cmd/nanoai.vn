'use client'

import { useState, useRef, ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { generateAiImage } from '@/app/thu-do-online/actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/sonner'
import { Upload, Shirt, Sparkles, Download, RefreshCw, User, Loader2, Zap } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

type Step = 'UPLOAD' | 'GENERATING' | 'RESULT'
type ModelQuality = 'high' | 'low'

interface ImageState {
  file: File | null
  preview: string | null
}

export default function HomeTryOn() {
  const [step, setStep] = useState<Step>('UPLOAD')
  const [userImage, setUserImage] = useState<ImageState>({ file: null, preview: null })
  const [garmentImage, setGarmentImage] = useState<ImageState>({ file: null, preview: null })
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [modelQuality, setModelQuality] = useState<ModelQuality>('high')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const userFileInputRef = useRef<HTMLInputElement>(null)
  const garmentFileInputRef = useRef<HTMLInputElement>(null)

  const handleImageChange = (
    e: ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<ImageState>>
  ) => {
    const file = e.target.files?.[0]
    if (file) {
      setter({
        file,
        preview: URL.createObjectURL(file),
      })
    }
  }

  const handleSubmit = async () => {
    if (!userImage.file || !garmentImage.file) {
      toast({ title: 'Thiếu ảnh', description: 'Vui lòng tải lên cả ảnh người và ảnh trang phục.', variant: 'destructive' })
      return
    }

    setIsSubmitting(true)
    setStep('GENERATING')
    
    const formData = new FormData()
    formData.append('userImage', userImage.file)
    formData.append('garmentImage', garmentImage.file)
    formData.append('modelQuality', modelQuality)

    try {
      const result = await generateAiImage(formData)

      if (result.error) {
        if (result.error === 'Authentication required.') {
           toast({ title: 'Yêu cầu đăng nhập', description: 'Vui lòng đăng nhập để sử dụng tính năng này.', variant: 'default' })
           router.push('/auth/login')
        } else {
           toast({ title: 'Thất bại', description: result.error, variant: 'destructive' })
           setStep('UPLOAD')
        }
      } else if (result.success && result.resultUrl) {
        setResultUrl(result.resultUrl)
        setStep('RESULT')
        toast({ title: 'Thành công!', description: 'Ảnh thử đồ của bạn đã sẵn sàng.' })
      }
    } catch {
      toast({ title: 'Lỗi', description: 'Đã xảy ra lỗi không mong muốn.', variant: 'destructive' })
      setStep('UPLOAD')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReset = () => {
    setStep('UPLOAD')
    setUserImage({ file: null, preview: null })
    setGarmentImage({ file: null, preview: null })
    setResultUrl(null)
    setModelQuality('high')
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-4">
      <Toaster />
      
      {step === 'UPLOAD' && (
        <div className="space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="grid lg:grid-cols-3 gap-8 items-start">
            {/* Image Upload Area - Takes up 2 columns */}
            <div className="lg:col-span-2 grid md:grid-cols-2 gap-6">
              {/* User Image Upload */}
              <div className="relative group cursor-pointer" onClick={() => userFileInputRef.current?.click()}>
                <div className={cn(
                  "aspect-[3/4] rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 transition-all duration-300 flex flex-col items-center justify-center overflow-hidden shadow-sm hover:shadow-md hover:border-primary/50",
                  userImage.preview ? "border-primary bg-primary/5" : ""
                )}>
                  {userImage.preview ? (
                    <Image 
                      src={userImage.preview} 
                      alt="User preview" 
                      fill 
                      className="object-cover"
                    />
                  ) : (
                    <div className="text-center p-6 space-y-4">
                      <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto text-primary">
                        <User className="w-8 h-8" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">Tải ảnh của bạn</h3>
                        <p className="text-sm text-muted-foreground mt-1">Chọn ảnh toàn thân rõ nét</p>
                      </div>
                      <Button variant="outline" className="mt-2 pointer-events-none">
                        <Upload className="mr-2 h-4 w-4" /> Chọn ảnh
                      </Button>
                    </div>
                  )}
                  {userImage.preview && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button variant="secondary" className="pointer-events-none">
                        <RefreshCw className="mr-2 h-4 w-4" /> Thay đổi
                      </Button>
                    </div>
                  )}
                </div>
                <Input ref={userFileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageChange(e, setUserImage)} />
              </div>

              {/* Garment Image Upload */}
              <div className="relative group cursor-pointer" onClick={() => garmentFileInputRef.current?.click()}>
                <div className={cn(
                  "aspect-[3/4] rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 transition-all duration-300 flex flex-col items-center justify-center overflow-hidden shadow-sm hover:shadow-md hover:border-primary/50",
                  garmentImage.preview ? "border-primary bg-primary/5" : ""
                )}>
                  {garmentImage.preview ? (
                    <Image 
                      src={garmentImage.preview} 
                      alt="Garment preview" 
                      fill 
                      className="object-cover"
                    />
                  ) : (
                    <div className="text-center p-6 space-y-4">
                      <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto text-primary">
                        <Shirt className="w-8 h-8" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">Tải ảnh trang phục</h3>
                        <p className="text-sm text-muted-foreground mt-1">Chọn ảnh quần áo bạn thích</p>
                      </div>
                      <Button variant="outline" className="mt-2 pointer-events-none">
                        <Upload className="mr-2 h-4 w-4" /> Chọn ảnh
                      </Button>
                    </div>
                  )}
                  {garmentImage.preview && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button variant="secondary" className="pointer-events-none">
                        <RefreshCw className="mr-2 h-4 w-4" /> Thay đổi
                      </Button>
                    </div>
                  )}
                </div>
                <Input ref={garmentFileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageChange(e, setGarmentImage)} />
              </div>
            </div>

            {/* Action Area - Takes up 1 column on large screens */}
            <div className="lg:col-span-1 flex flex-col justify-center space-y-6 bg-gray-50/50 p-6 rounded-2xl border border-gray-100 h-full">
               <div className="space-y-4">
                 <h3 className="font-semibold text-lg">Tùy chọn xử lý</h3>
                 <div className="grid grid-cols-1 gap-3">
                    <Button 
                      variant={modelQuality === 'high' ? 'default' : 'outline'}
                      onClick={() => setModelQuality('high')}
                      className="w-full justify-start h-12"
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> Chất lượng cao
                    </Button>
                    <Button 
                      variant={modelQuality === 'low' ? 'default' : 'outline'}
                      onClick={() => setModelQuality('low')}
                      className="w-full justify-start h-12"
                    >
                      <Zap className="mr-2 h-4 w-4" /> Tốc độ nhanh
                    </Button>
                 </div>
               </div>

               <div className="pt-4 border-t border-gray-200">
                 <Button 
                    size="lg" 
                    className="w-full h-14 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
                    onClick={handleSubmit}
                    disabled={!userImage.file || !garmentImage.file || isSubmitting}
                 >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Đang xử lý...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" /> Thử Đồ Ngay
                      </>
                    )}
                 </Button>
                 <p className="text-xs text-center text-muted-foreground mt-3">
                   * Quá trình có thể mất 10-30 giây tùy thuộc vào độ phức tạp.
                 </p>
               </div>
            </div>
          </div>
        </div>
      )}

      {step === 'GENERATING' && (
        <div className="w-full max-w-2xl mx-auto text-center space-y-8 py-12 animate-in fade-in duration-500">
          <div className="relative w-32 h-32 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping"></div>
            <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="w-12 h-12 text-primary animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">Đang thực hiện phép màu...</h3>
            <p className="text-muted-foreground">AI đang phân tích và ghép trang phục cho bạn. Vui lòng đợi trong giây lát.</p>
          </div>
          <div className="grid grid-cols-2 gap-4 opacity-50 pointer-events-none blur-sm">
             <div className="aspect-[3/4] bg-gray-100 rounded-xl"></div>
             <div className="aspect-[3/4] bg-gray-100 rounded-xl"></div>
          </div>
        </div>
      )}

      {step === 'RESULT' && (
        <div className="w-full max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-10 duration-700">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4 order-2 md:order-1">
               <div className="bg-white p-6 rounded-2xl shadow-sm border space-y-6">
                  <div className="text-center md:text-left">
                    <h3 className="text-2xl font-bold mb-2">Kết quả tuyệt vời!</h3>
                    <p className="text-muted-foreground">Đây là hình ảnh bạn mặc thử trang phục mới.</p>
                  </div>
                  
                  <div className="flex flex-col gap-3">
                    <a href={resultUrl!} download="try-on-result.png" className="w-full">
                      <Button className="w-full h-12 text-lg" size="lg">
                        <Download className="mr-2 h-5 w-5" /> Tải ảnh về máy
                      </Button>
                    </a>
                    <Button variant="outline" className="w-full h-12" onClick={handleReset}>
                      <RefreshCw className="mr-2 h-4 w-4" /> Thử bộ khác
                    </Button>
                  </div>
               </div>
            </div>

            <div className="order-1 md:order-2 relative aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl border-4 border-white">
               {resultUrl && (
                 <Image 
                   src={resultUrl} 
                   alt="Result" 
                   fill 
                   className="object-cover"
                 />
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
