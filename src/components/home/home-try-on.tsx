'use client'

import { useState, useRef, ChangeEvent, useEffect } from 'react'
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
  const [uiLocale, setUiLocale] = useState<'vi' | 'en' | 'zh' | 'ja' | 'ko'>('vi')
  const [step, setStep] = useState<Step>('UPLOAD')
  const [userImage, setUserImage] = useState<ImageState>({ file: null, preview: null })
  const [garmentImage, setGarmentImage] = useState<ImageState>({ file: null, preview: null })
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [modelQuality, setModelQuality] = useState<ModelQuality>('high')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  const userFileInputRef = useRef<HTMLInputElement>(null)
  const garmentFileInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const syncLocale = () => {
      const cookieValue = document.cookie
        .split(';')
        .map((x) => x.trim())
        .find((x) => x.startsWith('nanoai_locale='))
        ?.split('=')[1]
        ?.trim()
        .toLowerCase()
      if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') setUiLocale(cookieValue)
      else setUiLocale('vi')
    }
    syncLocale()
    const timer = window.setInterval(syncLocale, 1000)
    window.addEventListener('focus', syncLocale)
    document.addEventListener('visibilitychange', syncLocale)
    return () => {
      window.removeEventListener('focus', syncLocale)
      document.removeEventListener('visibilitychange', syncLocale)
      window.clearInterval(timer)
    }
  }, [])

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
      toast({ title: tr('Thiếu ảnh', 'Missing images', '缺少图片', '画像不足', '이미지 부족'), description: tr('Vui lòng tải lên cả ảnh người và ảnh trang phục.', 'Please upload both person and garment images.', '请同时上传人物图和服装图。', '人物画像と衣装画像の両方をアップロードしてください。', '인물 이미지와 의류 이미지를 모두 업로드해 주세요.'), variant: 'destructive' })
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
           toast({ title: tr('Yêu cầu đăng nhập', 'Login required', '需要登录', 'ログインが必要です', '로그인이 필요합니다'), description: tr('Vui lòng đăng nhập để sử dụng tính năng này.', 'Please sign in to use this feature.', '请登录后使用此功能。', 'この機能を使うにはログインしてください。', '이 기능을 사용하려면 로그인해 주세요.'), variant: 'default' })
           router.push('/auth/login')
        } else {
           toast({ title: tr('Thất bại', 'Failed', '失败', '失敗', '실패'), description: result.error, variant: 'destructive' })
           setStep('UPLOAD')
        }
      } else if (result.success && result.resultUrl) {
        setResultUrl(result.resultUrl)
        setStep('RESULT')
        toast({ title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'), description: tr('Ảnh thử đồ của bạn đã sẵn sàng.', 'Your try-on image is ready.', '你的试衣图片已准备好。', '試着画像の準備ができました。', '가상피팅 이미지가 준비되었습니다.') })
      }
    } catch {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Đã xảy ra lỗi không mong muốn.', 'Unexpected error occurred.', '发生了意外错误。', '予期しないエラーが発生しました。', '예기치 않은 오류가 발생했습니다.'), variant: 'destructive' })
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
                        <h3 className="font-semibold text-lg">{tr('Tải ảnh của bạn', 'Upload your photo', '上传你的照片', 'あなたの写真をアップロード', '내 사진 업로드')}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{tr('Chọn ảnh toàn thân rõ nét', 'Choose a clear full-body photo', '选择清晰的全身照', '鮮明な全身写真を選択', '선명한 전신 사진을 선택하세요')}</p>
                      </div>
                      <Button variant="outline" className="mt-2 pointer-events-none">
                        <Upload className="mr-2 h-4 w-4" /> {tr('Chọn ảnh', 'Select image', '选择图片', '画像を選択', '이미지 선택')}
                      </Button>
                    </div>
                  )}
                  {userImage.preview && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button variant="secondary" className="pointer-events-none">
                        <RefreshCw className="mr-2 h-4 w-4" /> {tr('Thay đổi', 'Change', '更换', '変更', '변경')}
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
                        <h3 className="font-semibold text-lg">{tr('Tải ảnh trang phục', 'Upload garment image', '上传服装图片', '衣装画像をアップロード', '의류 이미지 업로드')}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{tr('Chọn ảnh quần áo bạn thích', 'Choose the clothing image you like', '选择你喜欢的服装图片', '好きな服の画像を選択', '원하는 의류 이미지를 선택하세요')}</p>
                      </div>
                      <Button variant="outline" className="mt-2 pointer-events-none">
                        <Upload className="mr-2 h-4 w-4" /> {tr('Chọn ảnh', 'Select image', '选择图片', '画像を選択', '이미지 선택')}
                      </Button>
                    </div>
                  )}
                  {garmentImage.preview && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button variant="secondary" className="pointer-events-none">
                        <RefreshCw className="mr-2 h-4 w-4" /> {tr('Thay đổi', 'Change', '更换', '変更', '변경')}
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
                 <h3 className="font-semibold text-lg">{tr('Tùy chọn xử lý', 'Processing options', '处理选项', '処理オプション', '처리 옵션')}</h3>
                 <div className="grid grid-cols-1 gap-3">
                    <Button 
                      variant={modelQuality === 'high' ? 'default' : 'outline'}
                      onClick={() => setModelQuality('high')}
                      className="w-full justify-start h-12"
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> {tr('Chất lượng cao', 'High quality', '高质量', '高品質', '고품질')}
                    </Button>
                    <Button 
                      variant={modelQuality === 'low' ? 'default' : 'outline'}
                      onClick={() => setModelQuality('low')}
                      className="w-full justify-start h-12"
                    >
                      <Zap className="mr-2 h-4 w-4" /> {tr('Tốc độ nhanh', 'Fast speed', '快速速度', '高速', '빠른 속도')}
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
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {tr('Đang xử lý...', 'Processing...', '处理中...', '処理中...', '처리 중...')}
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" /> {tr('Thử Đồ Ngay', 'Try On Now', '立即试衣', '今すぐ試着', '지금 피팅하기')}
                      </>
                    )}
                 </Button>
                 <p className="text-xs text-center text-muted-foreground mt-3">
                   {tr('* Quá trình có thể mất 10-30 giây tùy thuộc vào độ phức tạp.', '* Process may take 10-30 seconds depending on complexity.', '* 根据复杂度，处理可能需要10-30秒。', '* 複雑さに応じて10〜30秒かかる場合があります。', '* 복잡도에 따라 10~30초 소요될 수 있습니다.')}
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
            <h3 className="text-2xl font-bold">{tr('Đang thực hiện phép màu...', 'Working magic...', '正在施展魔法...', '魔法をかけています...', '마법을 부리는 중...')}</h3>
            <p className="text-muted-foreground">{tr('AI đang phân tích và ghép trang phục cho bạn. Vui lòng đợi trong giây lát.', 'AI is analyzing and fitting the outfit for you. Please wait a moment.', 'AI 正在为你分析并搭配服装，请稍候。', 'AIが解析して衣装を合わせています。少々お待ちください。', 'AI가 의상을 분석하고 피팅 중입니다. 잠시만 기다려 주세요.')}</p>
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
                    <h3 className="text-2xl font-bold mb-2">{tr('Kết quả tuyệt vời!', 'Great result!', '很棒的结果！', '素晴らしい結果！', '멋진 결과!')}</h3>
                    <p className="text-muted-foreground">{tr('Đây là hình ảnh bạn mặc thử trang phục mới.', 'Here is your try-on image with the new outfit.', '这是你试穿新服装后的图片。', '新しい衣装を試着した画像です。', '새 의상을 착용한 피팅 이미지입니다.')}</p>
                  </div>
                  
                  <div className="flex flex-col gap-3">
                    <a href={resultUrl!} download="try-on-result.png" className="w-full">
                      <Button className="w-full h-12 text-lg" size="lg">
                        <Download className="mr-2 h-5 w-5" /> {tr('Tải ảnh về máy', 'Download image', '下载图片', '画像をダウンロード', '이미지 다운로드')}
                      </Button>
                    </a>
                    <Button variant="outline" className="w-full h-12" onClick={handleReset}>
                      <RefreshCw className="mr-2 h-4 w-4" /> {tr('Thử bộ khác', 'Try another outfit', '试试其他套装', '別のコーデを試す', '다른 의상 시도')}
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
