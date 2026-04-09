'use client'

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

import { useState, useRef, useEffect, ChangeEvent } from 'react'
import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { generateAiImage } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Shirt, Sparkles, RefreshCw, ChevronDown, User, Users } from 'lucide-react'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { DownloadImageButton } from '@/components/download-image-button'
import { cn } from '@/lib/utils'
import { ImagePreview } from '@/components/ui/image-preview'
import { ImageProcessingLoader } from '@/components/image-processing-loader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GarmentUploader } from './garment-uploader'
import { preloadImageUrl } from '@/lib/preload-image-url'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type Step = 'USER_UPLOAD' | 'GARMENT_UPLOAD' | 'GENERATING' | 'RESULT'
// Chỉ sử dụng chất lượng cao
type Gender = 'male' | 'female' | 'unknown'
type TryOnMode = 'single' | 'couple' | 'group' | 'group4' | 'group5'
type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

function getWebLocaleFromCookie(): UiLocale {
  if (typeof document === 'undefined') return 'vi'
  const cookieValue = readWebLocaleFromDocumentCookie()
  if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') return cookieValue
  return 'vi'
}

interface ImageState {
  file: File | null
  preview: string | null
}

export default function TryOnClientPage({ gender: initialGender, initialMode = 'single' }: { gender: Gender; initialMode?: TryOnMode }) {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [currentGender, setCurrentGender] = useState<Gender>(initialGender)
  const [step, setStep] = useState<Step>('USER_UPLOAD')
  const [tryOnMode, setTryOnMode] = useState<TryOnMode>(initialMode)
  const [userImage, setUserImage] = useState<ImageState>({ file: null, preview: null })
  
  // State for different modes
  const [garmentImages, setGarmentImages] = useState<ImageState[]>([]) // Single
  const [leftGarmentImages, setLeftGarmentImages] = useState<ImageState[]>([]) // Couple & Group3
  const [middleGarmentImages, setMiddleGarmentImages] = useState<ImageState[]>([]) // Group3
  const [rightGarmentImages, setRightGarmentImages] = useState<ImageState[]>([]) // Couple & Group3

  // State for 4 & 5-person groups
  const [person1Images, setPerson1Images] = useState<ImageState[]>([])
  const [person2Images, setPerson2Images] = useState<ImageState[]>([])
  const [person3Images, setPerson3Images] = useState<ImageState[]>([])
  const [person4Images, setPerson4Images] = useState<ImageState[]>([])
  const [person5Images, setPerson5Images] = useState<ImageState[]>([])

  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [customPrompt, setCustomPrompt] = useState<string>('')
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }
  const subtitle = {
    single: tr('Thử đồ 1 người với AI', 'AI try-on for 1 person', 'AI 单人试衣', 'AI 1人試着', 'AI 1인 가상피팅'),
    couple: tr('Thử đồ 2 người với AI', 'AI try-on for 2 people', 'AI 双人试衣', 'AI 2人試着', 'AI 2인 가상피팅'),
    group: tr('Thử đồ 3 người với AI', 'AI try-on for 3 people', 'AI 3人试衣', 'AI 3人試着', 'AI 3인 가상피팅'),
    group4: tr('Thử đồ 4 người với AI', 'AI try-on for 4 people', 'AI 4人试衣', 'AI 4人試着', 'AI 4인 가상피팅'),
    group5: tr('Thử đồ 5 người với AI', 'AI try-on for 5 people', 'AI 5人试衣', 'AI 5人試着', 'AI 5인 가상피팅'),
  } as const

  const isFemale = currentGender === 'female'
  const theme = {
    gradient: isFemale
      ? 'from-rose-50 via-white to-pink-100'
      : 'from-slate-50 via-white to-blue-100',
    badge: isFemale
      ? 'bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200'
      : 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200',
    tabsTriggerActive: isFemale
      ? 'data-[state=active]:bg-rose-100 data-[state=active]:text-rose-700 data-[state=active]:border-rose-200'
      : 'data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 data-[state=active]:border-blue-200',
    cardBorder: isFemale ? 'border-rose-200/60' : 'border-blue-200/60',
    softBg: isFemale ? 'bg-rose-50/60' : 'bg-blue-50/60',
    dashedBorder: isFemale ? 'border-rose-200/80' : 'border-blue-200/80',
    primaryButton: isFemale
      ? 'bg-rose-600 hover:bg-rose-700 text-white'
      : 'bg-blue-600 hover:bg-blue-700 text-white',
    outlineButton: isFemale
      ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
      : 'border-blue-200 text-blue-700 hover:bg-blue-50',
    accentText: isFemale ? 'text-rose-600' : 'text-blue-600',
  }

  const userFileInputRef = useRef<HTMLInputElement>(null)

  const handleUserImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUserImage({
        file,
        preview: URL.createObjectURL(file),
      })
    }
  }

  const handleGarmentImageChange = (files: FileList, side: 'single' | 'left' | 'middle' | 'right' | 'person1' | 'person2' | 'person3' | 'person4' | 'person5') => {
    if (files && files.length > 0) {
      const newImages: ImageState[] = Array.from(files).map(file => ({
        file,
        preview: URL.createObjectURL(file)
      }));

      switch (side) {
        case 'single': setGarmentImages(prev => [...prev, ...newImages]); break;
        case 'left': setLeftGarmentImages(prev => [...prev, ...newImages]); break;
        case 'middle': setMiddleGarmentImages(prev => [...prev, ...newImages]); break;
        case 'right': setRightGarmentImages(prev => [...prev, ...newImages]); break;
        case 'person1': setPerson1Images(prev => [...prev, ...newImages]); break;
        case 'person2': setPerson2Images(prev => [...prev, ...newImages]); break;
        case 'person3': setPerson3Images(prev => [...prev, ...newImages]); break;
        case 'person4': setPerson4Images(prev => [...prev, ...newImages]); break;
        case 'person5': setPerson5Images(prev => [...prev, ...newImages]); break;
      }
    }
  }

  const removeGarmentImage = (index: number, side: 'single' | 'left' | 'middle' | 'right' | 'person1' | 'person2' | 'person3' | 'person4' | 'person5') => {
    switch (side) {
      case 'single': setGarmentImages(prev => prev.filter((_, i) => i !== index)); break;
      case 'left': setLeftGarmentImages(prev => prev.filter((_, i) => i !== index)); break;
      case 'middle': setMiddleGarmentImages(prev => prev.filter((_, i) => i !== index)); break;
      case 'right': setRightGarmentImages(prev => prev.filter((_, i) => i !== index)); break;
      case 'person1': setPerson1Images(prev => prev.filter((_, i) => i !== index)); break;
      case 'person2': setPerson2Images(prev => prev.filter((_, i) => i !== index)); break;
      case 'person3': setPerson3Images(prev => prev.filter((_, i) => i !== index)); break;
      case 'person4': setPerson4Images(prev => prev.filter((_, i) => i !== index)); break;
      case 'person5': setPerson5Images(prev => prev.filter((_, i) => i !== index)); break;
    }
  }

    const costMap = {
      single: 1,
      couple: 1.2,
      group: 1.3,
      group4: 1.4,
      group5: 1.5
    };
    const baseCost = costMap[tryOnMode];
    const cost = imageQuality === '4K' ? baseCost * 2.2 : baseCost;
    const displayCost = cost.toFixed(1).replace('.', ',')

    const totalGarmentCount = tryOnMode === 'single' ? garmentImages.length
      : tryOnMode === 'couple' ? leftGarmentImages.length + rightGarmentImages.length
      : tryOnMode === 'group' ? leftGarmentImages.length + middleGarmentImages.length + rightGarmentImages.length
      : tryOnMode === 'group4' ? person1Images.length + person2Images.length + person3Images.length + person4Images.length
      : person1Images.length + person2Images.length + person3Images.length + person4Images.length + person5Images.length
    const buttonLabel = totalGarmentCount >= 2
      ? tr('Phối đồ', 'Mix outfits', '服装搭配', 'コーデ作成', '코디 조합')
      : tr('Thử đồ', 'Try-on', '试衣', '試着', '가상피팅')

  const handleSubmit = async () => {
    const isSingleInvalid = tryOnMode === 'single' && garmentImages.length === 0;
    const isCoupleInvalid = tryOnMode === 'couple' && leftGarmentImages.length === 0 && rightGarmentImages.length === 0;
    const isGroup3Invalid = tryOnMode === 'group' && leftGarmentImages.length === 0 && middleGarmentImages.length === 0 && rightGarmentImages.length === 0;
    const isGroup4Invalid = tryOnMode === 'group4' && person1Images.length === 0 && person2Images.length === 0 && person3Images.length === 0 && person4Images.length === 0;
    const isGroup5Invalid = tryOnMode === 'group5' && person1Images.length === 0 && person2Images.length === 0 && person3Images.length === 0 && person4Images.length === 0 && person5Images.length === 0;

    if (!userImage.file || isSingleInvalid || isCoupleInvalid || isGroup3Invalid || isGroup4Invalid || isGroup5Invalid) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Vui lòng tải lên ảnh của bạn và ít nhất một ảnh sản phẩm.', 'Please upload your photo and at least one garment image.', '请上传你的照片和至少一张服装图片。', 'あなたの写真と少なくとも1枚の服画像をアップロードしてください。', '사용자 사진과 의상 이미지를 최소 1장 업로드해 주세요.'), variant: 'destructive' })
      return
    }

    setStep('GENERATING')
    const formData = new FormData()
    formData.append('userImage', userImage.file)
    formData.append('tryOnMode', tryOnMode)
    formData.append('customPrompt', customPrompt)
    formData.append('imageQuality', imageQuality)

    if (tryOnMode === 'single') {
      garmentImages.forEach((img, i) => img.file && formData.append(`garmentImage${i}`, img.file))
      formData.append('garmentCount', garmentImages.length.toString())
    } else if (tryOnMode === 'couple') {
      leftGarmentImages.forEach((img, i) => img.file && formData.append(`leftGarmentImage${i}`, img.file))
      rightGarmentImages.forEach((img, i) => img.file && formData.append(`rightGarmentImage${i}`, img.file))
      formData.append('leftGarmentCount', leftGarmentImages.length.toString())
      formData.append('rightGarmentCount', rightGarmentImages.length.toString())
    } else if (tryOnMode === 'group') {
      leftGarmentImages.forEach((img, i) => img.file && formData.append(`leftGarmentImage${i}`, img.file))
      middleGarmentImages.forEach((img, i) => img.file && formData.append(`middleGarmentImage${i}`, img.file))
      rightGarmentImages.forEach((img, i) => img.file && formData.append(`rightGarmentImage${i}`, img.file))
      formData.append('leftGarmentCount', leftGarmentImages.length.toString())
      formData.append('middleGarmentCount', middleGarmentImages.length.toString())
      formData.append('rightGarmentCount', rightGarmentImages.length.toString())
    } else if (tryOnMode === 'group4') {
      person1Images.forEach((img, i) => img.file && formData.append(`person1Image${i}`, img.file))
      person2Images.forEach((img, i) => img.file && formData.append(`person2Image${i}`, img.file))
      person3Images.forEach((img, i) => img.file && formData.append(`person3Image${i}`, img.file))
      person4Images.forEach((img, i) => img.file && formData.append(`person4Image${i}`, img.file))
      formData.append('person1Count', person1Images.length.toString())
      formData.append('person2Count', person2Images.length.toString())
      formData.append('person3Count', person3Images.length.toString())
      formData.append('person4Count', person4Images.length.toString())
    } else if (tryOnMode === 'group5') {
      person1Images.forEach((img, i) => img.file && formData.append(`person1Image${i}`, img.file))
      person2Images.forEach((img, i) => img.file && formData.append(`person2Image${i}`, img.file))
      person3Images.forEach((img, i) => img.file && formData.append(`person3Image${i}`, img.file))
      person4Images.forEach((img, i) => img.file && formData.append(`person4Image${i}`, img.file))
      person5Images.forEach((img, i) => img.file && formData.append(`person5Image${i}`, img.file))
      formData.append('person1Count', person1Images.length.toString())
      formData.append('person2Count', person2Images.length.toString())
      formData.append('person3Count', person3Images.length.toString())
      formData.append('person4Count', person4Images.length.toString())
      formData.append('person5Count', person5Images.length.toString())
    }

    const result = await generateAiImage(formData)
    console.log('Generation result:', result)

    if (result.error) {
      console.error('Generation failed:', result.error)
      toast({ 
        title: tr('Tạo ảnh thất bại', 'Image generation failed', '生成失败', '生成に失敗しました', '생성 실패'), 
        description: result.error || tr('Có lỗi xảy ra khi tạo ảnh. Vui lòng thử lại.', 'An error occurred while generating the image. Please try again.', '生成图片时发生错误，请重试。', '画像生成中にエラーが発生しました。再試行してください。', '이미지 생성 중 오류가 발생했습니다. 다시 시도해 주세요.'), 
        variant: 'destructive',
        duration: 5000
      })
      setStep('GARMENT_UPLOAD')
    } else if (result.success && result.resultUrl) {
      console.log('Generation successful:', result.resultUrl)
      await preloadImageUrl(result.resultUrl)
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      toast({ 
        title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'), 
        description: tr('Ảnh thử đồ của bạn đã sẵn sàng.', 'Your try-on image is ready.', '试衣结果已准备好。', '試着画像の準備ができました。', '가상피팅 결과가 준비되었습니다.'),
        duration: 3000
      })
    } else {
      console.error('Unexpected result format:', result)
      toast({ 
        title: tr('Lỗi không xác định', 'Unknown error', '未知错误', '不明なエラー', '알 수 없는 오류'), 
        description: tr('Có lỗi xảy ra. Vui lòng thử lại.', 'Something went wrong. Please try again.', '发生错误，请重试。', 'エラーが発生しました。再試行してください。', '문제가 발생했습니다. 다시 시도해 주세요.'),
        variant: 'destructive',
        duration: 5000
      })
      setStep('GARMENT_UPLOAD')
    }
  }

  const handleReset = () => {
    setStep('USER_UPLOAD')
    setUserImage({ file: null, preview: null })
    setGarmentImages([])
    setLeftGarmentImages([])
    setMiddleGarmentImages([])
    setRightGarmentImages([])
    setPerson1Images([])
    setPerson2Images([])
    setPerson3Images([])
    setPerson4Images([])
    setPerson5Images([])
    setResultUrl(null)
    setCustomPrompt('')
  }

  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  useEffect(() => {
    const syncLocale = () => setUiLocale(getWebLocaleFromCookie())
    syncLocale()
    const timer = window.setInterval(syncLocale, 1000)
    if (searchParams.get('reset')) {
      handleReset()
      router.replace(pathname, { scroll: false })
    }
    window.addEventListener('focus', syncLocale)
    document.addEventListener('visibilitychange', syncLocale)
    return () => {
      window.removeEventListener('focus', syncLocale)
      document.removeEventListener('visibilitychange', syncLocale)
      window.clearInterval(timer)
    }
  }, [searchParams, pathname, router])

  const renderContent = () => {
    switch (step) {
      case 'USER_UPLOAD':
      case 'GARMENT_UPLOAD':
        return (
          <div className="space-y-8">
            <p className="text-xs sm:text-sm text-muted-foreground mb-2">{subtitle[tryOnMode]}</p>
            <div className="grid lg:grid-cols-[1fr_200px] gap-4 items-start">
              {/* Image Upload Area - flexible width */}
              <div className="min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className={cn('border shadow-sm bg-white/80 backdrop-blur', theme.cardBorder)}>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Upload className={cn('h-4 w-4', theme.accentText)} /> {tr('Bước 1: Ảnh của bạn', 'Step 1: Your photo', '步骤1：你的照片', 'ステップ1：あなたの写真', '1단계: 내 사진')}
                    </CardTitle>
                    <CardDescription className="text-xs">{tr('Tải lên ảnh chân dung một người hoặc ảnh đôi.', 'Upload a single portrait or couple photo.', '上传单人或双人照片。', '1人または2人の写真をアップロード。', '1인 또는 2인 사진을 업로드하세요.')}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <label className={cn('block w-full aspect-[3/4] rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 relative overflow-hidden group cursor-pointer touch-manipulation min-h-[120px]', theme.dashedBorder, theme.softBg)}>
                      {userImage.preview ? (
                        <>
                          <ImagePreview src={userImage.preview} alt="User preview" className="w-full h-full pointer-events-none" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity flex items-center justify-center touch-manipulation" onClick={(e) => { e.preventDefault(); userFileInputRef.current?.click(); }}>
                            <span className="pointer-events-none px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium flex items-center gap-2">
                              <RefreshCw className="h-3 w-3" /> {tr('Thay đổi', 'Change', '更换', '変更', '변경')}
                            </span>
                          </div>
                          <input ref={userFileInputRef} key={tryOnMode} type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer touch-manipulation z-10" style={{ fontSize: 0 }} onChange={(e) => { handleUserImageChange(e); setStep('GARMENT_UPLOAD'); }} />
                        </>
                      ) : (
                        <>
                          <input ref={userFileInputRef} key={tryOnMode} type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer touch-manipulation z-10" style={{ fontSize: 0 }} onChange={(e) => { handleUserImageChange(e); setStep('GARMENT_UPLOAD'); }} />
                          <div className={cn("p-2 rounded-full bg-white shadow-sm pointer-events-none", theme.accentText)}>
                             <User className="h-6 w-6" />
                          </div>
                          <p className="text-xs text-muted-foreground font-medium pointer-events-none">{tr('Tải ảnh của bạn', 'Upload your photo', '上传你的照片', '写真をアップロード', '내 사진 업로드')}</p>
                          <span className={cn("mt-1 pointer-events-none px-3 py-1.5 rounded-md border text-xs", theme.outlineButton)}>
                            <Upload className="mr-2 h-3 w-3 inline" /> {tr('Chọn ảnh', 'Choose image', '选择图片', '画像を選択', '이미지 선택')}
                          </span>
                        </>
                      )}
                    </label>
                  </CardContent>
                </Card>

                <div className="sm:col-span-1">
                  <Tabs value={tryOnMode} onValueChange={(value) => {
                    const newMode = value as TryOnMode
                    const prevMode = tryOnMode
                    setTryOnMode(newMode)
                    // Xóa ảnh chính và ảnh sản phẩm khi chuyển chế độ để chọn lại
                    setUserImage({ file: null, preview: null })
                    if (prevMode === 'single') setGarmentImages([])
                    if (prevMode === 'couple') { setLeftGarmentImages([]); setRightGarmentImages([]) }
                    if (prevMode === 'group') { setLeftGarmentImages([]); setMiddleGarmentImages([]); setRightGarmentImages([]) }
                    if (prevMode === 'group4' || prevMode === 'group5') {
                      setPerson1Images([]); setPerson2Images([]); setPerson3Images([]); setPerson4Images([]); setPerson5Images([])
                    }
                  }} className="w-full">
                    <TabsList className="grid w-full grid-cols-5 gap-0.5 sm:gap-1">
                      <TabsTrigger value="single" className={cn("text-xs px-1 data-[state=active]:shadow-md", theme.tabsTriggerActive)}><User className="mr-1 h-3 w-3"/>1</TabsTrigger>
                      <TabsTrigger value="couple" className={cn("text-xs px-1 data-[state=active]:shadow-md", theme.tabsTriggerActive)}><Users className="mr-1 h-3 w-3"/>2</TabsTrigger>
                      <TabsTrigger value="group" className={cn("text-xs px-1 data-[state=active]:shadow-md", theme.tabsTriggerActive)}><Users className="mr-1 h-3 w-3"/>3</TabsTrigger>
                      <TabsTrigger value="group4" className={cn("text-xs px-1 data-[state=active]:shadow-md", theme.tabsTriggerActive)}><Users className="mr-1 h-3 w-3"/>4</TabsTrigger>
                      <TabsTrigger value="group5" className={cn("text-xs px-1 data-[state=active]:shadow-md", theme.tabsTriggerActive)}><Users className="mr-1 h-3 w-3"/>5</TabsTrigger>
                    </TabsList>
                    <TabsContent value="single">
                      <div className={cn('mt-2', !userImage.file && 'opacity-50 pointer-events-none')}>
                      <Card className={cn('border shadow-sm bg-white/80 backdrop-blur', theme.cardBorder)}>
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Shirt className={cn('h-4 w-4', theme.accentText)} /> {tr('Bước 2: Ảnh sản phẩm', 'Step 2: Garment images', '步骤2：服装图片', 'ステップ2：服画像', '2단계: 의상 이미지')}
                          </CardTitle>
                          <CardDescription className="text-xs">{tr('Chọn các món đồ bạn muốn thử', 'Choose garments you want to try', '选择想试穿的服装', '試したい服を選択', '가상피팅할 의상을 선택')} ({garmentImages.length}/6)</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <GarmentUploader
                            images={garmentImages}
                            onImagesChange={(files) => handleGarmentImageChange(files, 'single')}
                            onImageRemove={(index) => removeGarmentImage(index, 'single')}
                            theme={theme}
                            maxImages={6}
                          />
                        </CardContent>
                      </Card>
                      </div>
                    </TabsContent>
                    <TabsContent value="couple">
                      <div className={cn('mt-2', !userImage.file && 'opacity-50 pointer-events-none')}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Card className={cn('border shadow-sm bg-white/80 backdrop-blur', theme.cardBorder)}>
                          <CardHeader className="p-3 sm:p-4 pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                              <Shirt className={cn('h-4 w-4', theme.accentText)} /> {tr('Người bên trái', 'Left person', '左侧人物', '左の人物', '왼쪽 인물')}
                            </CardTitle>
                            <CardDescription className="text-xs">{tr('Tối đa 6 món đồ.', 'Max 6 garments.', '最多 6 件服装。', '最大6点。', '최대 6벌.')}</CardDescription>
                          </CardHeader>
                          <CardContent className="p-4 pt-0">
                            <GarmentUploader
                              images={leftGarmentImages}
                              maxImages={6}
                              onImagesChange={(files) => handleGarmentImageChange(files, 'left')}
                              onImageRemove={(index) => removeGarmentImage(index, 'left')}
                              theme={theme}
                            />
                          </CardContent>
                        </Card>
                        <Card className={cn('border shadow-sm bg-white/80 backdrop-blur', theme.cardBorder)}>
                           <CardHeader className="p-3 sm:p-4 pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                              <Shirt className={cn('h-4 w-4', theme.accentText)} /> {tr('Người bên phải', 'Right person', '右侧人物', '右の人物', '오른쪽 인물')}
                            </CardTitle>
                            <CardDescription className="text-xs">{tr('Tối đa 6 món đồ.', 'Max 6 garments.', '最多 6 件服装。', '最大6点。', '최대 6벌.')}</CardDescription>
                          </CardHeader>
                          <CardContent className="p-4 pt-0">
                             <GarmentUploader
                              images={rightGarmentImages}
                              maxImages={6}
                              onImagesChange={(files) => handleGarmentImageChange(files, 'right')}
                              onImageRemove={(index) => removeGarmentImage(index, 'right')}
                              theme={theme}
                            />
                          </CardContent>
                        </Card>
                      </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="group">
                      <div className={cn('mt-2', !userImage.file && 'opacity-50 pointer-events-none')}>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <Card className={cn('border shadow-sm bg-white/80 backdrop-blur', theme.cardBorder)}>
                          <CardHeader className="p-3 sm:p-4 pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm"><Shirt className="h-4 w-4"/>{tr('Trái', 'Left', '左', '左', '왼쪽')}</CardTitle>
                          </CardHeader>
                          <CardContent className="p-2 pt-0">
                            <GarmentUploader images={leftGarmentImages} onImagesChange={(files) => handleGarmentImageChange(files, 'left')} onImageRemove={(index) => removeGarmentImage(index, 'left')} theme={theme} maxImages={4} compact />
                          </CardContent>
                        </Card>
                        <Card className={cn('border shadow-sm bg-white/80 backdrop-blur', theme.cardBorder)}>
                           <CardHeader className="p-4 pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm"><Shirt className="h-4 w-4"/>{tr('Giữa / Trên', 'Middle / Top', '中间 / 上方', '中央 / 上', '가운데 / 위')}</CardTitle>
                          </CardHeader>
                          <CardContent className="p-2 pt-0">
                             <GarmentUploader images={middleGarmentImages} onImagesChange={(files) => handleGarmentImageChange(files, 'middle')} onImageRemove={(index) => removeGarmentImage(index, 'middle')} theme={theme} maxImages={4} compact />
                          </CardContent>
                        </Card>
                        <Card className={cn('border shadow-sm bg-white/80 backdrop-blur', theme.cardBorder)}>
                           <CardHeader className="p-4 pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm"><Shirt className="h-4 w-4"/>{tr('Phải', 'Right', '右', '右', '오른쪽')}</CardTitle>
                          </CardHeader>
                          <CardContent className="p-2 pt-0">
                             <GarmentUploader images={rightGarmentImages} onImagesChange={(files) => handleGarmentImageChange(files, 'right')} onImageRemove={(index) => removeGarmentImage(index, 'right')} theme={theme} maxImages={4} compact />
                          </CardContent>
                        </Card>
                      </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="group4">
                      <div className={cn('space-y-3 mt-2', !userImage.file && 'opacity-50 pointer-events-none')}>
                        <p className="text-sm text-muted-foreground">{tr('Chọn ảnh sản phẩm cho từng người (tối đa 3 món/người).', 'Choose garment images for each person (max 3/person).', '为每个人选择服装图片（每人最多3件）。', '各人物の服画像を選択（1人最大3点）。', '각 인물 의상 이미지를 선택하세요(1인 최대 3개).')} <span className="text-amber-600 dark:text-amber-400 font-medium">{tr('Thứ tự từ trái qua phải.', 'Order from left to right.', '顺序从左到右。', '左から右の順。', '왼쪽부터 오른쪽 순서.')}</span></p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {[
                            { n: 1, imgs: person1Images, side: 'person1' as const, label: tr('Người 1', 'Person 1', '人物1', '人物1', '인물 1') },
                            { n: 2, imgs: person2Images, side: 'person2' as const, label: tr('Người 2', 'Person 2', '人物2', '人物2', '인물 2') },
                            { n: 3, imgs: person3Images, side: 'person3' as const, label: tr('Người 3', 'Person 3', '人物3', '人物3', '인물 3') },
                            { n: 4, imgs: person4Images, side: 'person4' as const, label: tr('Người 4', 'Person 4', '人物4', '人物4', '인물 4') },
                          ].map(({ n, imgs, side, label }) => (
                            <Card key={n} className={cn('border shadow-sm bg-white/80 backdrop-blur overflow-hidden', theme.cardBorder)}>
                              <CardHeader className="py-3 px-4 bg-muted/30">
                                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{n}</span>
                                  {label}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="p-4 pt-3">
                                <GarmentUploader
                                  images={imgs}
                                  onImagesChange={(files) => handleGarmentImageChange(files, side)}
                                  onImageRemove={(index) => removeGarmentImage(index, side)}
                                  theme={theme}
                                  maxImages={3}
                                  compact
                                />
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="group5">
                      <div className={cn('space-y-3 mt-2', !userImage.file && 'opacity-50 pointer-events-none')}>
                        <p className="text-sm text-muted-foreground">{tr('Chọn ảnh sản phẩm cho từng người (tối đa 2 món/người).', 'Choose garment images for each person (max 2/person).', '为每个人选择服装图片（每人最多2件）。', '各人物の服画像を選択（1人最大2点）。', '각 인물 의상 이미지를 선택하세요(1인 최대 2개).')} <span className="text-amber-600 dark:text-amber-400 font-medium">{tr('Thứ tự từ trái qua phải.', 'Order from left to right.', '顺序从左到右。', '左から右の順。', '왼쪽부터 오른쪽 순서.')}</span></p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {[
                            { n: 1, imgs: person1Images, side: 'person1' as const },
                            { n: 2, imgs: person2Images, side: 'person2' as const },
                            { n: 3, imgs: person3Images, side: 'person3' as const },
                            { n: 4, imgs: person4Images, side: 'person4' as const },
                            { n: 5, imgs: person5Images, side: 'person5' as const },
                          ].map(({ n, imgs, side }) => (
                            <Card key={n} className={cn('border shadow-sm bg-white/80 backdrop-blur overflow-hidden', theme.cardBorder)}>
                              <CardHeader className="py-3 px-4 bg-muted/30">
                                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{n}</span>
                                  {tr('Người', 'Person', '人物', '人物', '인물')} {n}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="p-4 pt-3">
                                <GarmentUploader
                                  images={imgs}
                                  onImagesChange={(files) => handleGarmentImageChange(files, side)}
                                  onImageRemove={(index) => removeGarmentImage(index, side)}
                                  theme={theme}
                                  maxImages={2}
                                  compact
                                />
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>

              {/* Action Area - narrower */}
              <div className="lg:w-[200px] lg:shrink-0">
                <Card className={cn('border shadow-sm bg-white/80 backdrop-blur h-full', theme.cardBorder)}>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-base">{tr('Tùy chọn', 'Options', '选项', 'オプション', '옵션')}</CardTitle>
                    <CardDescription className="text-xs">{tr('Thiết lập và tạo ảnh.', 'Configure and generate image.', '设置并生成图片。', '設定して画像を生成。', '설정 후 이미지 생성.')}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Giao diện', 'Theme', '界面', 'テーマ', '테마')}</h4>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              'h-8 w-auto max-w-[120px] px-2 justify-start gap-1 text-[11px] self-start sm:h-9 sm:w-full sm:max-w-none sm:px-3 sm:justify-between sm:text-xs',
                              theme.badge
                            )}
                          >
                            {isFemale ? tr('Nữ', 'Female', '女', '女性', '여성') : tr('Nam', 'Male', '男', '男性', '남성')}
                            <ChevronDown className="h-3 w-3 opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-[160px] sm:w-[200px]">
                          <DropdownMenuItem onClick={() => setCurrentGender('male')}>
                            {tr('Giao diện Nam', 'Male theme', '男性界面', '男性テーマ', '남성 테마')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setCurrentGender('female')}>
                            {tr('Giao diện Nữ', 'Female theme', '女性界面', '女性テーマ', '여성 테마')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Chất lượng ảnh', 'Image quality', '图片质量', '画質', '이미지 품질')}</h4>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setImageQuality('2K')}
                          className={cn(
                            'flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors',
                            imageQuality === '2K'
                              ? theme.badge
                              : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                          )}
                        >
                          2K
                        </button>
                        <button
                          type="button"
                          onClick={() => setImageQuality('4K')}
                          className={cn(
                            'flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors',
                            imageQuality === '4K'
                              ? theme.badge
                              : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                          )}
                        >
                          4K (×2,2)
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {imageQuality === '2K'
                          ? tr('Giá không đổi', 'Normal price', '原价', '通常価格', '기본 가격')
                          : tr('Giá ×2,2', 'Price ×2.2', '价格 ×2.2', '価格 ×2.2', '가격 ×2.2')}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Yêu cầu thêm', 'Extra prompt', '附加要求', '追加要望', '추가 요청')}</h4>
                      <Textarea
                        placeholder={tr('Ví dụ: thay đổi màu tóc thành màu xanh...', 'e.g. change hair color to blue...', '例如：把发色改成蓝色...', '例：髪色を青に変更...', '예: 머리색을 파란색으로 변경...')}
                        className="bg-white/80 text-xs h-20"
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                      />
                    </div>

                    <div className="pt-4 border-t space-y-2 flex flex-col items-center">
                      <DepositCreditButton
                        variant="outline"
                        size="sm"
                        className={cn('w-full max-w-[180px]', theme.outlineButton)}
                      />
                      <Button 
                        size="default" 
                        className={cn('w-full max-w-[180px] min-h-[44px] shadow-md hover:shadow-lg transition-all text-sm touch-manipulation', theme.primaryButton)} 
                        onClick={() => checkCreditsAndProceed(cost, handleSubmit)}
                        title={imageQuality === '2K' ? tr('Tạo chất lượng ảnh 2K', 'Generate 2K image', '生成 2K 图片', '2K画像を生成', '2K 이미지 생성') : tr('Tạo chất lượng ảnh 4K', 'Generate 4K image', '生成 4K 图片', '4K画像を生成', '4K 이미지 생성')}
                        disabled={!userImage.file || 
                          (tryOnMode === 'single' && garmentImages.length === 0) || 
                          (tryOnMode === 'couple' && leftGarmentImages.length === 0 && rightGarmentImages.length === 0) || 
                          (tryOnMode === 'group' && leftGarmentImages.length === 0 && middleGarmentImages.length === 0 && rightGarmentImages.length === 0) ||
                          (tryOnMode === 'group4' && person1Images.length === 0 && person2Images.length === 0 && person3Images.length === 0 && person4Images.length === 0) ||
                          (tryOnMode === 'group5' && person1Images.length === 0 && person2Images.length === 0 && person3Images.length === 0 && person4Images.length === 0 && person5Images.length === 0)
                        }
                      >
                        <Sparkles className="mr-2 h-4 w-4" /> {buttonLabel} ({displayCost} credit)
                      </Button>
                      <p className="text-[10px] text-center text-muted-foreground mt-2">
                        {tr('* Thời gian xử lý: 10-30s', '* Processing time: 10-30s', '* 处理时间：10-30秒', '* 処理時間: 10-30秒', '* 처리 시간: 10-30초')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )
      case 'GENERATING':
        const allGarmentPreviews = tryOnMode === 'single'
          ? garmentImages.map((g) => g.preview).filter(Boolean) as string[]
          : tryOnMode === 'couple'
          ? [...leftGarmentImages, ...rightGarmentImages].map((g) => g.preview).filter(Boolean) as string[]
          : tryOnMode === 'group'
          ? [...leftGarmentImages, ...middleGarmentImages, ...rightGarmentImages].map((g) => g.preview).filter(Boolean) as string[]
          : tryOnMode === 'group4'
          ? [...person1Images, ...person2Images, ...person3Images, ...person4Images].map((g) => g.preview).filter(Boolean) as string[]
          : [...person1Images, ...person2Images, ...person3Images, ...person4Images, ...person5Images].map((g) => g.preview).filter(Boolean) as string[]
        return (
          <Card className={cn('w-full max-w-2xl mx-auto border shadow-sm bg-white/80 backdrop-blur', theme.cardBorder)}>
            <CardContent className="flex flex-col items-center py-8">
              <ImageProcessingLoader
                mode="tryon"
                title={tr('Đang tạo ảnh thử đồ', 'Generating try-on image', '正在生成试衣图片', '試着画像を生成中', '가상피팅 이미지 생성 중')}
                description={tr('AI đang áp trang phục lên ảnh của bạn một cách tự nhiên', 'AI is fitting garments onto your photo naturally', 'AI 正在将服装自然地应用到你的照片上', 'AI が写真に自然に服を適用しています', 'AI가 사진에 의상을 자연스럽게 적용하고 있습니다')}
                imagePreview={userImage.preview}
                imagePreviews={allGarmentPreviews}
              />
            </CardContent>
          </Card>
        )
      case 'RESULT':
        const currentTime = new Date().toLocaleTimeString('vi-VN', { 
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit'
        });
        const currentDate = new Date().toLocaleDateString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
        
        return (
          <Card className={cn('w-full max-w-4xl mx-auto border shadow-sm bg-white/80 backdrop-blur', theme.cardBorder)}>
            <CardContent className="grid md:grid-cols-2 gap-4 p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-center">{tr('Trước', 'Before', '之前', '前', '전')}</h3>
                  <Button size="sm" variant="outline" className={cn('h-8 text-xs', theme.outlineButton)} onClick={handleReset}>
                    <RefreshCw className="mr-2 h-3 w-3" /> {tr('Thử lại', 'Try again', '重试', 'やり直す', '다시 시도')}
                  </Button>
                </div>
                {userImage.preview && <div className="relative w-full aspect-square rounded-md border overflow-hidden"><ImagePreview src={userImage.preview} alt="Original user" className="w-full h-full" /></div>}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-center">{tr('Sau', 'After', '之后', '後', '후')}</h3>
                  <DownloadImageButton
                  imageUrl={resultUrl!}
                  filename="try-on-result"
                  size="sm"
                  className={cn('h-8 text-xs', theme.primaryButton, 'border-0')}
                  printReady
                  printReadyInferFromImage
                />
                </div>
                {resultUrl && (
                  <div className="relative w-full aspect-square rounded-md border shadow-sm overflow-hidden">
                    <ImagePreview src={resultUrl} alt="Try-on result" className="w-full h-full" />
                    
                    {/* Quality and time info overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/90 font-medium">{tr('Thời gian tạo:', 'Generated at:', '生成时间：', '生成時刻：', '생성 시각:')}</span>
                          <span className="text-xs text-white font-semibold">{currentTime} - {currentDate}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/90 font-medium">{tr('Chất lượng:', 'Quality:', '质量：', '品質：', '품질:')}</span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-green-100 text-green-800 border-green-200">
                            {tr('Chất lượng Cao (Pro)', 'High Quality (Pro)', '高质量 (Pro)', '高品質 (Pro)', '고품질 (Pro)')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/90 font-medium">{tr('Chế độ:', 'Mode:', '模式：', 'モード：', '모드:')}</span>
                          <span className="text-xs text-white font-semibold">
                            {tryOnMode === 'single' ? tr('1 người', '1 person', '1人', '1人', '1명') : 
                             tryOnMode === 'couple' ? tr('2 người', '2 people', '2人', '2人', '2명') : 
                             tryOnMode === 'group' ? tr('3 người', '3 people', '3人', '3人', '3명') : 
                             tryOnMode === 'group4' ? tr('4 người', '4 people', '4人', '4人', '4명') : tr('5 người', '5 people', '5人', '5人', '5명')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col items-center justify-center pb-6 pt-2 px-4">
              <CardTitle className="text-xl text-center">{tr('Đây là kết quả của bạn!', 'Here is your result!', '这是你的结果！', 'これがあなたの結果です！', '결과가 준비되었습니다!')}</CardTitle>
              <CardDescription className="text-center mt-1">
                {tr('Ảnh được tạo với chất lượng cao (Pro) vào lúc', 'Generated in High Quality (Pro) at', '图片以高质量（Pro）生成于', '高品質（Pro）で生成：', '고품질(Pro) 생성 시각')} {currentTime} {tr('ngày', 'on', '', '', '')} {currentDate}
              </CardDescription>
            </CardFooter>
          </Card>
        )
    }
  }

  return (
    <>
      <div className={cn('rounded-2xl border p-2 shadow-sm mt-0', theme.cardBorder, `bg-gradient-to-br ${theme.gradient}`)}>
        <Toaster />
        {renderContent()}
        <p className="text-xs text-muted-foreground text-center mt-4 pb-2">
          {tr('Ảnh càng nét càng chính xác. Ảnh do AI tạo có thể có sai lầm.', 'Sharper input gives better output. AI-generated images may contain minor errors.', '输入越清晰，结果越准确。AI 生成结果可能存在误差。', '元画像が鮮明なほど精度が上がります。AI生成結果には誤差が含まれる場合があります。', '원본이 선명할수록 결과가 정확합니다. AI 생성 결과에는 오차가 있을 수 있습니다.')}
        </p>
      </div>
    </>
  )
}
