'use client'

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

import { useState, useRef, ChangeEvent, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { faceSwap } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, RefreshCw, Repeat } from 'lucide-react'
import { ImageUploadWithPreview } from '@/components/image-upload-with-preview'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { DownloadImageButton } from '@/components/download-image-button'
import { ImagePreview } from '@/components/ui/image-preview'
import { ImageProcessingLoader } from '@/components/image-processing-loader'
import { preloadImageUrl } from '@/lib/preload-image-url'

type Step = 'UPLOAD' | 'GENERATING' | 'RESULT'
type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

function getWebLocaleFromCookie(): UiLocale {
  if (typeof document === 'undefined') return 'vi'
  const cookieValue = readWebLocaleFromDocumentCookie()
  if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') return cookieValue
  return 'vi'
}

const setImageFromFile = (file: File, setImage: (v: { file: File; preview: string }) => void) => {
  if (!file.type.startsWith('image/')) return false
  setImage({ file, preview: URL.createObjectURL(file) })
  return true
}

export default function HoanDoiKhuonMatClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [step, setStep] = useState<Step>('UPLOAD')
  const [swapMode, setSwapMode] = useState<'single' | 'couple'>('single')
  const [faceImage, setFaceImage] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [faceImageLeft, setFaceImageLeft] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [faceImageRight, setFaceImageRight] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [targetImage, setTargetImage] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const [note, setNote] = useState('')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const faceInputRef = useRef<HTMLInputElement>(null)
  const faceLeftInputRef = useRef<HTMLInputElement>(null)
  const faceRightInputRef = useRef<HTMLInputElement>(null)
  const cost = imageQuality === '2K' ? 1 : 2
  const targetInputRef = useRef<HTMLInputElement>(null)
  const isSubmittingRef = useRef(false)
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }
  const t = useMemo(() => ({
    err: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
    title: tr('Hoán đổi khuôn mặt (Face Swap)', 'Face Swap', '换脸 (Face Swap)', '顔入れ替え (Face Swap)', '얼굴 교체 (Face Swap)'),
    subtitle: tr('Ghép mặt bạn vào nhân vật phim ảnh, siêu anh hùng. 1–2 credits/ảnh.', 'Swap your face into movie characters and heroes. 1–2 credits/image.', '把你的脸替换到电影角色中。1–2 credits/张。', '映画キャラに顔を入れ替え。1–2 credits/枚。', '영화 캐릭터에 얼굴 교체. 1–2 credits/장.'),
    uploadCard: tr('Ảnh cần ghép', 'Images to swap', '待合成图片', '合成する画像', '합성할 이미지'),
    uploadDesc: tr('Ảnh 1: khuôn mặt bạn. Ảnh 2: nhân vật muốn ghép mặt vào.', 'Image 1: your face. Image 2: character to swap face into.', '图1：你的脸。图2：要换脸的角色。', '画像1：あなたの顔。画像2：顔を入れ替えるキャラ。', '이미지 1: 내 얼굴. 이미지 2: 얼굴을 합성할 캐릭터.'),
    swap1: tr('Hoán đổi 1 người', 'Swap 1 person', '单人换脸', '1人入れ替え', '1명 교체'),
    swap2: tr('Hoán đổi 2 người (trái/phải)', 'Swap 2 people (left/right)', '双人换脸（左/右）', '2人入れ替え（左/右）', '2명 교체 (좌/우)'),
    faceSource: tr('1. Ảnh khuôn mặt nguồn (ảnh bạn)', '1. Source face image (your face)', '1. 源人脸图片（你的脸）', '1. 元の顔画像（あなたの顔）', '1. 원본 얼굴 이미지 (내 얼굴)'),
    chooseYourFace: tr('Chọn ảnh bạn', 'Select your photo', '选择你的照片', 'あなたの写真を選択', '내 사진 선택'),
    leftSource: tr('1. Mặt nguồn người bên trái', '1. Left person source face', '1. 左侧人物源脸', '1. 左の人物の元の顔', '1. 왼쪽 인물 원본 얼굴'),
    chooseLeft: tr('Chọn mặt trái', 'Select left face', '选择左侧脸', '左の顔を選択', '왼쪽 얼굴 선택'),
    targetSingle: tr('2. Ảnh đích (nhân vật muốn ghép mặt vào)', '2. Target image (character to swap into)', '2. 目标图片（要换脸的角色）', '2. 対象画像（顔を入れ替えるキャラ）', '2. 대상 이미지 (얼굴 합성할 캐릭터)'),
    chooseCharacter: tr('Chọn ảnh nhân vật', 'Select character image', '选择角色图片', 'キャラ画像を選択', '캐릭터 이미지 선택'),
    rightSource: tr('2. Mặt nguồn người bên phải', '2. Right person source face', '2. 右侧人物源脸', '2. 右の人物の元の顔', '2. 오른쪽 인물 원본 얼굴'),
    chooseRight: tr('Chọn mặt phải', 'Select right face', '选择右侧脸', '右の顔を選択', '오른쪽 얼굴 선택'),
    targetCouple: tr('3. Ảnh đích (có 2 người trái/phải)', '3. Target image (2 people left/right)', '3. 目标图片（2人左/右）', '3. 対象画像（2人左/右）', '3. 대상 이미지 (2명 좌/우)'),
    chooseTarget2: tr('Chọn ảnh đích 2 người', 'Select target image (2 people)', '选择目标图片（2人）', '対象画像を選択（2人）', '대상 이미지 선택 (2명)'),
    requestOpt: tr('Yêu cầu (tùy chọn)', 'Request (optional)', '要求（可选）', '要望（任意）', '요청 (선택)'),
    requestPlaceholder: tr('VD: giữ biểu cảm vui...', 'e.g. keep happy expression...', '例如：保持开心表情...', '例：笑顔を維持...', '예: 밝은 표정 유지...'),
    options: tr('Tùy chọn', 'Options', '选项', 'オプション', '옵션'),
    optionsDesc: tr('Chất lượng xuất ảnh.', 'Output image quality.', '输出图片质量。', '出力画質。', '출력 이미지 품질.'),
    quality: tr('Chất lượng ảnh', 'Image quality', '图片质量', '画質', '이미지 품질'),
    swapBtn: tr('Hoán đổi', 'Swap', '换脸', '入れ替え', '교체'),
    time: tr('Thời gian: 15–45 giây', 'Time: 15–45 seconds', '时间：15–45 秒', '時間：15–45秒', '시간: 15–45초'),
    generatingTitle: tr('Đang hoán đổi khuôn mặt', 'Swapping faces', '正在换脸', '顔を入れ替え中', '얼굴 교체 중'),
    generatingDesc: tr('AI đang ghép mặt và điều chỉnh tự nhiên', 'AI is swapping faces and adjusting naturally', 'AI 正在换脸并自然调整', 'AIが顔を入れ替え自然に調整中', 'AI가 얼굴을 교체하고 자연스럽게 조정 중입니다'),
    resultTitle: tr('Kết quả', 'Result', '结果', '結果', '결과'),
    resultDesc: tr('Đã hoán đổi khuôn mặt.', 'Face swap completed.', '换脸已完成。', '顔入れ替えが完了しました。', '얼굴 교체가 완료되었습니다.'),
    original: tr('Ảnh gốc', 'Original', '原图', '元画像', '원본'),
    afterSwap: tr('Sau khi ghép mặt', 'After swap', '换脸后', '入れ替え後', '교체 후'),
    retry: tr('Thử lại', 'Try again', '重试', 'やり直す', '다시 시도'),
  }), [uiLocale])

  useEffect(() => {
    const syncLocale = () => setUiLocale(getWebLocaleFromCookie())
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

  const handleFaceChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setImageFromFile(file, setFaceImage)
  }

  const handleTargetChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setImageFromFile(file, setTargetImage)
  }

  const hasRequiredFaces = swapMode === 'single'
    ? !!faceImage.file
    : !!faceImageLeft.file && !!faceImageRight.file

  const handleSubmit = async () => {
    if (isSubmittingRef.current) return
    if (swapMode === 'single') {
      if (!faceImage.file) {
        toast({ title: t.err, description: tr('Vui lòng tải ảnh khuôn mặt nguồn (ảnh bạn).', 'Please upload source face image (your face).', '请上传源人脸图片（你的脸）。', '元の顔画像（あなたの顔）をアップロードしてください。', '원본 얼굴 이미지(내 얼굴)를 업로드해 주세요.'), variant: 'destructive' })
        return
      }
    } else {
      if (!faceImageLeft.file) {
        toast({ title: t.err, description: tr('Vui lòng tải ảnh khuôn mặt cho người bên trái.', 'Please upload face image for left person.', '请上传左侧人物的人脸图片。', '左の人物の顔画像をアップロードしてください。', '왼쪽 인물 얼굴 이미지를 업로드해 주세요.'), variant: 'destructive' })
        return
      }
      if (!faceImageRight.file) {
        toast({ title: t.err, description: tr('Vui lòng tải ảnh khuôn mặt cho người bên phải.', 'Please upload face image for right person.', '请上传右侧人物的人脸图片。', '右の人物の顔画像をアップロードしてください。', '오른쪽 인물 얼굴 이미지를 업로드해 주세요.'), variant: 'destructive' })
        return
      }
    }
    if (!targetImage.file) {
      toast({ title: t.err, description: tr('Vui lòng tải ảnh đích (nhân vật muốn ghép mặt vào).', 'Please upload target image to swap face into.', '请上传目标图片。', '顔を入れ替える対象画像をアップロードしてください。', '얼굴을 합성할 대상 이미지를 업로드해 주세요.'), variant: 'destructive' })
      return
    }
    isSubmittingRef.current = true
    setStep('GENERATING')
    try {
      const formData = new FormData()
      formData.append('swapMode', swapMode)
      if (swapMode === 'single' && faceImage.file) {
        formData.append('faceImage', faceImage.file)
      } else {
        if (faceImageLeft.file) formData.append('faceImageLeft', faceImageLeft.file)
        if (faceImageRight.file) formData.append('faceImageRight', faceImageRight.file)
      }
      formData.append('targetImage', targetImage.file)
      formData.append('imageQuality', imageQuality)
      formData.append('note', note)
      const result = await faceSwap(formData)
      if (result.error) {
        setStep('UPLOAD')
        toast({ title: tr('Hoán đổi thất bại', 'Face swap failed', '换脸失败', '顔入れ替えに失敗しました', '얼굴 교체 실패'), description: result.error, variant: 'destructive', duration: 5000 })
      } else if (result.success && result.resultUrl) {
        await preloadImageUrl(result.resultUrl)
        setResultUrl(result.resultUrl)
        setStep('RESULT')
        toast({ title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'), description: tr('Đã hoán đổi khuôn mặt.', 'Face swap completed.', '换脸已完成。', '顔入れ替えが完了しました。', '얼굴 교체가 완료되었습니다.'), duration: 3000 })
      }
    } finally {
      isSubmittingRef.current = false
    }
  }

  const handleReset = () => {
    setStep('UPLOAD')
    setFaceImage({ file: null, preview: null })
    setFaceImageLeft({ file: null, preview: null })
    setFaceImageRight({ file: null, preview: null })
    setTargetImage({ file: null, preview: null })
    setNote('')
    setResultUrl(null)
  }

  return (
    <>
      <Toaster />
      <div className="tool-page-container">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
            <Repeat className="h-8 w-8 text-fuchsia-600" /> {t.title}
          </h1>
          <p className="text-muted-foreground mt-1">{t.subtitle}</p>
        </div>

        {step === 'UPLOAD' && (
          <div className="grid lg:grid-cols-[1fr_200px] gap-4 items-start">
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-fuchsia-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="h-4 w-4 text-fuchsia-600" /> {t.uploadCard}
                  </CardTitle>
                  <CardDescription className="text-xs">{t.uploadDesc}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSwapMode('single')}
                      className={`px-3 py-2 rounded-md border text-xs font-medium transition-colors ${swapMode === 'single' ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'}`}
                    >
                      {t.swap1}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSwapMode('couple')}
                      className={`px-3 py-2 rounded-md border text-xs font-medium transition-colors ${swapMode === 'couple' ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'}`}
                    >
                      {t.swap2}
                    </button>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    {swapMode === 'single' ? (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold">{t.faceSource}</h4>
                        <ImageUploadWithPreview
                          preview={faceImage.preview}
                          onFileChange={handleFaceChange}
                          inputId="face-input"
                          emptyLabel={t.chooseYourFace}
                          className="block w-full aspect-square max-h-[280px] rounded-lg border-2 border-dashed border-fuchsia-200 bg-fuchsia-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-fuchsia-300 hover:bg-fuchsia-50/80 transition-colors"
                          ref={faceInputRef}
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold">{t.leftSource}</h4>
                        <ImageUploadWithPreview
                          preview={faceImageLeft.preview}
                          onFileChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) setImageFromFile(file, setFaceImageLeft)
                          }}
                          inputId="face-left-input"
                          emptyLabel={t.chooseLeft}
                          className="block w-full aspect-square max-h-[280px] rounded-lg border-2 border-dashed border-fuchsia-200 bg-fuchsia-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-fuchsia-300 hover:bg-fuchsia-50/80 transition-colors"
                          ref={faceLeftInputRef}
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      {swapMode === 'single' ? (
                        <>
                          <h4 className="text-sm font-semibold">{t.targetSingle}</h4>
                          <ImageUploadWithPreview
                            preview={targetImage.preview}
                            onFileChange={handleTargetChange}
                            inputId="target-input"
                            emptyLabel={t.chooseCharacter}
                            className="block w-full aspect-square max-h-[280px] rounded-lg border-2 border-dashed border-fuchsia-200 bg-fuchsia-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-fuchsia-300 hover:bg-fuchsia-50/80 transition-colors"
                            ref={targetInputRef}
                          />
                        </>
                      ) : (
                        <>
                          <h4 className="text-sm font-semibold">{t.rightSource}</h4>
                          <ImageUploadWithPreview
                            preview={faceImageRight.preview}
                            onFileChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) setImageFromFile(file, setFaceImageRight)
                            }}
                            inputId="face-right-input"
                            emptyLabel={t.chooseRight}
                            className="block w-full aspect-square max-h-[280px] rounded-lg border-2 border-dashed border-fuchsia-200 bg-fuchsia-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-fuchsia-300 hover:bg-fuchsia-50/80 transition-colors"
                            ref={faceRightInputRef}
                          />
                        </>
                      )}
                    </div>
                  </div>
                  {swapMode === 'couple' && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">{t.targetCouple}</h4>
                      <ImageUploadWithPreview
                        preview={targetImage.preview}
                        onFileChange={handleTargetChange}
                        inputId="target-input-couple"
                        emptyLabel={t.chooseTarget2}
                        className="block w-full aspect-[16/10] max-h-[320px] rounded-lg border-2 border-dashed border-fuchsia-200 bg-fuchsia-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-fuchsia-300 hover:bg-fuchsia-50/80 transition-colors"
                        ref={targetInputRef}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.requestOpt}</h4>
                    <Input placeholder={t.requestPlaceholder} value={note} onChange={(e) => setNote(e.target.value)} className="bg-white/80" />
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="lg:w-[200px] lg:shrink-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-fuchsia-200/60 h-full">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">{t.options}</CardTitle>
                  <CardDescription className="text-xs">{t.optionsDesc}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.quality}</h4>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setImageQuality('2K')} className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${imageQuality === '2K' ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'}`}>
                        2K (1)
                      </button>
                      <button type="button" onClick={() => setImageQuality('4K')} className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${imageQuality === '4K' ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'}`}>
                        4K (2)
                      </button>
                    </div>
                  </div>
                  <div className="pt-4 border-t space-y-2 flex flex-col items-center">
                    <DepositCreditButton variant="outline" size="sm" className="w-full max-w-[180px] border-fuchsia-200 text-fuchsia-700 hover:bg-fuchsia-50" />
                    <Button onClick={() => checkCreditsAndProceed(cost, handleSubmit)} disabled={!hasRequiredFaces || !targetImage.file} className="w-full max-w-[180px] h-9 shadow-md hover:shadow-lg transition-all text-sm bg-fuchsia-600 hover:bg-fuchsia-700 text-white">
                      <Sparkles className="mr-2 h-4 w-4" /> {t.swapBtn} ({imageQuality === '2K' ? '1' : '2'} credit)
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground mt-2">* {t.time}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === 'GENERATING' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-fuchsia-200/60">
            <CardContent className="flex flex-col items-center py-8">
              <ImageProcessingLoader mode="faceswap" title={t.generatingTitle} description={t.generatingDesc} imagePreview={faceImage.preview} />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>{t.resultTitle}</CardTitle>
              <CardDescription>{t.resultDesc}</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">{t.original}</h3>
                {targetImage.preview && (
                  <div className="aspect-square max-w-[400px] max-h-[400px] rounded-lg border overflow-hidden">
                    <ImagePreview src={targetImage.preview} alt={t.original} className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground">{t.afterSwap}</h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleReset}><RefreshCw className="mr-2 h-3 w-3" /> {t.retry}</Button>
                    <DownloadImageButton
                    imageUrl={resultUrl}
                    filename="faceswap-result"
                    size="sm"
                    className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white border-0"
                    printReady
                    printReadyInferFromImage
                  />
                  </div>
                </div>
                <div className="aspect-square max-w-[400px] max-h-[400px] rounded-lg border overflow-hidden">
                  <ImagePreview src={resultUrl} alt={t.afterSwap} className="w-full h-full object-cover" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">{tr('Ảnh do AI tạo có thể có sai sót.', 'AI-generated images may contain minor errors.', 'AI 生成结果可能存在误差。', 'AI生成結果には誤差が含まれる場合があります。', 'AI 생성 결과에는 오차가 있을 수 있습니다.')}</p>
    </>
  )
}
