'use client'

import { useState, useRef, useEffect, ChangeEvent } from 'react'
import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { generateAiImage } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Shirt, Sparkles, Download, RefreshCw, ChevronDown, User, Users, Zap } from 'lucide-react'
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

const SUBTITLE_MAP: Record<TryOnMode, string> = {
  single: 'Thử đồ 1 người với AI',
  couple: 'Thử đồ 2 người với AI',
  group: 'Thử đồ 3 người với AI',
  group4: 'Thử đồ 4 người với AI',
  group5: 'Thử đồ 5 người với AI',
}

interface ImageState {
  file: File | null
  preview: string | null
}

export default function TryOnClientPage({ gender: initialGender, initialMode = 'single' }: { gender: Gender; initialMode?: TryOnMode }) {
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
    const buttonLabel = totalGarmentCount >= 2 ? 'Phối Đồ' : 'Thử Đồ'

  const handleSubmit = async () => {
    const isSingleInvalid = tryOnMode === 'single' && garmentImages.length === 0;
    const isCoupleInvalid = tryOnMode === 'couple' && leftGarmentImages.length === 0 && rightGarmentImages.length === 0;
    const isGroup3Invalid = tryOnMode === 'group' && leftGarmentImages.length === 0 && middleGarmentImages.length === 0 && rightGarmentImages.length === 0;
    const isGroup4Invalid = tryOnMode === 'group4' && person1Images.length === 0 && person2Images.length === 0 && person3Images.length === 0 && person4Images.length === 0;
    const isGroup5Invalid = tryOnMode === 'group5' && person1Images.length === 0 && person2Images.length === 0 && person3Images.length === 0 && person4Images.length === 0 && person5Images.length === 0;

    if (!userImage.file || isSingleInvalid || isCoupleInvalid || isGroup3Invalid || isGroup4Invalid || isGroup5Invalid) {
      toast({ title: 'Lỗi', description: 'Vui lòng tải lên ảnh của bạn và ít nhất một ảnh sản phẩm.', variant: 'destructive' })
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
        title: 'Tạo ảnh thất bại', 
        description: result.error || 'Có lỗi xảy ra khi tạo ảnh. Vui lòng thử lại.', 
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
        title: 'Thành công!', 
        description: 'Ảnh thử đồ của bạn đã sẵn sàng.',
        duration: 3000
      })
    } else {
      console.error('Unexpected result format:', result)
      toast({ 
        title: 'Lỗi không xác định', 
        description: 'Có lỗi xảy ra. Vui lòng thử lại.',
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
    if (searchParams.get('reset')) {
      handleReset()
      router.replace(pathname, { scroll: false })
    }
  }, [searchParams])

  const renderContent = () => {
    switch (step) {
      case 'USER_UPLOAD':
      case 'GARMENT_UPLOAD':
        return (
          <div className="space-y-8">
            <p className="text-xs sm:text-sm text-muted-foreground mb-2">{SUBTITLE_MAP[tryOnMode]}</p>
            <div className="grid lg:grid-cols-[1fr_200px] gap-4 items-start">
              {/* Image Upload Area - flexible width */}
              <div className="min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className={cn('border shadow-sm bg-white/80 backdrop-blur', theme.cardBorder)}>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Upload className={cn('h-4 w-4', theme.accentText)} /> Bước 1: Ảnh của bạn
                    </CardTitle>
                    <CardDescription className="text-xs">Tải lên ảnh chân dung một người hoặc ảnh đôi.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <label className={cn('block w-full aspect-[3/4] rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 relative overflow-hidden group cursor-pointer touch-manipulation min-h-[120px]', theme.dashedBorder, theme.softBg)}>
                      {userImage.preview ? (
                        <>
                          <ImagePreview src={userImage.preview} alt="User preview" className="w-full h-full pointer-events-none" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity flex items-center justify-center touch-manipulation" onClick={(e) => { e.preventDefault(); userFileInputRef.current?.click(); }}>
                            <span className="pointer-events-none px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium flex items-center gap-2">
                              <RefreshCw className="h-3 w-3" /> Thay đổi
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
                          <p className="text-xs text-muted-foreground font-medium pointer-events-none">Tải ảnh của bạn</p>
                          <span className={cn("mt-1 pointer-events-none px-3 py-1.5 rounded-md border text-xs", theme.outlineButton)}>
                            <Upload className="mr-2 h-3 w-3 inline" /> Chọn ảnh
                          </span>
                        </>
                      )}
                    </label>
                  </CardContent>
                </Card>

                <div className={cn('sm:col-span-1', step === 'GENERATING' ? 'opacity-50 pointer-events-none' : '')}>
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
                            <Shirt className={cn('h-4 w-4', theme.accentText)} /> Bước 2: Ảnh sản phẩm
                          </CardTitle>
                          <CardDescription className="text-xs">Chọn các món đồ bạn muốn thử (tối đa 6 món, {garmentImages.length} ảnh).</CardDescription>
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
                              <Shirt className={cn('h-4 w-4', theme.accentText)} /> Người bên trái
                            </CardTitle>
                            <CardDescription className="text-xs">Tối đa 6 món đồ.</CardDescription>
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
                              <Shirt className={cn('h-4 w-4', theme.accentText)} /> Người bên phải
                            </CardTitle>
                            <CardDescription className="text-xs">Tối đa 6 món đồ.</CardDescription>
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
                            <CardTitle className="flex items-center gap-2 text-sm"><Shirt className="h-4 w-4"/>Trái</CardTitle>
                          </CardHeader>
                          <CardContent className="p-2 pt-0">
                            <GarmentUploader images={leftGarmentImages} onImagesChange={(files) => handleGarmentImageChange(files, 'left')} onImageRemove={(index) => removeGarmentImage(index, 'left')} theme={theme} maxImages={4} compact />
                          </CardContent>
                        </Card>
                        <Card className={cn('border shadow-sm bg-white/80 backdrop-blur', theme.cardBorder)}>
                           <CardHeader className="p-4 pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm"><Shirt className="h-4 w-4"/>Giữa / Trên</CardTitle>
                          </CardHeader>
                          <CardContent className="p-2 pt-0">
                             <GarmentUploader images={middleGarmentImages} onImagesChange={(files) => handleGarmentImageChange(files, 'middle')} onImageRemove={(index) => removeGarmentImage(index, 'middle')} theme={theme} maxImages={4} compact />
                          </CardContent>
                        </Card>
                        <Card className={cn('border shadow-sm bg-white/80 backdrop-blur', theme.cardBorder)}>
                           <CardHeader className="p-4 pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm"><Shirt className="h-4 w-4"/>Phải</CardTitle>
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
                        <p className="text-sm text-muted-foreground">Chọn ảnh sản phẩm cho từng người (tối đa 3 món/người). <span className="text-amber-600 dark:text-amber-400 font-medium">Thứ tự từ trái qua phải.</span></p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {[
                            { n: 1, imgs: person1Images, side: 'person1' as const, label: 'Người 1' },
                            { n: 2, imgs: person2Images, side: 'person2' as const, label: 'Người 2' },
                            { n: 3, imgs: person3Images, side: 'person3' as const, label: 'Người 3' },
                            { n: 4, imgs: person4Images, side: 'person4' as const, label: 'Người 4' },
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
                        <p className="text-sm text-muted-foreground">Chọn ảnh sản phẩm cho từng người (tối đa 2 món/người). <span className="text-amber-600 dark:text-amber-400 font-medium">Thứ tự từ trái qua phải.</span></p>
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
                                  Người {n}
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
                    <CardTitle className="text-base">Tùy chọn</CardTitle>
                    <CardDescription className="text-xs">Thiết lập và tạo ảnh.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Giao diện</h4>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className={cn('w-full justify-between h-9', theme.badge)}>
                            {isFemale ? 'Giao diện Nữ' : 'Giao diện Nam'}
                            <ChevronDown className="h-3 w-3 opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[200px]">
                          <DropdownMenuItem onClick={() => setCurrentGender('male')}>
                            Giao diện Nam
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setCurrentGender('female')}>
                            Giao diện Nữ
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Chất lượng ảnh</h4>
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
                        {imageQuality === '2K' ? 'Giá không đổi' : 'Giá ×2,2'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Yêu cầu thêm</h4>
                      <Textarea
                        placeholder="Ví dụ: thay đổi màu tóc thành màu xanh..."
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
                        title={imageQuality === '2K' ? 'Tạo chất lượng ảnh 2K' : 'Tạo chất lượng ảnh 4K'}
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
                        * Thời gian xử lý: 10-30s
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
                title="Đang tạo ảnh thử đồ"
                description="AI đang áp trang phục lên ảnh của bạn một cách tự nhiên"
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
                  <h3 className="font-semibold text-sm text-center">Trước</h3>
                  <Button size="sm" variant="outline" className={cn('h-8 text-xs', theme.outlineButton)} onClick={handleReset}>
                    <RefreshCw className="mr-2 h-3 w-3" /> Thử lại
                  </Button>
                </div>
                {userImage.preview && <div className="relative w-full aspect-square rounded-md border overflow-hidden"><ImagePreview src={userImage.preview} alt="Original user" className="w-full h-full" /></div>}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-center">Sau</h3>
                  <DownloadImageButton imageUrl={resultUrl!} filename="try-on-result" size="sm" className={cn('h-8 text-xs', theme.primaryButton, 'border-0')} />
                </div>
                {resultUrl && (
                  <div className="relative w-full aspect-square rounded-md border shadow-sm overflow-hidden">
                    <ImagePreview src={resultUrl} alt="Try-on result" className="w-full h-full" />
                    
                    {/* Quality and time info overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/90 font-medium">Thời gian tạo:</span>
                          <span className="text-xs text-white font-semibold">{currentTime} - {currentDate}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/90 font-medium">Chất lượng:</span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-green-100 text-green-800 border-green-200">
                            Chất lượng Cao (Pro)
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/90 font-medium">Chế độ:</span>
                          <span className="text-xs text-white font-semibold">
                            {tryOnMode === 'single' ? '1 người' : 
                             tryOnMode === 'couple' ? '2 người' : 
                             tryOnMode === 'group' ? '3 người' : 
                             tryOnMode === 'group4' ? '4 người' : '5 người'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col items-center justify-center pb-6 pt-2 px-4">
              <CardTitle className="text-xl text-center">Đây là kết quả của bạn!</CardTitle>
              <CardDescription className="text-center mt-1">
                Ảnh được tạo với chất lượng cao (Pro) vào lúc {currentTime} ngày {currentDate}
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
          Ảnh càng nét càng chính xác. Ảnh do AI tạo có thể có sai lầm.
        </p>
      </div>
    </>
  )
}
