'use client'

import { useState, useRef, ChangeEvent, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { createVideoFromImage } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, RefreshCw, Video } from 'lucide-react'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { ImagePreview } from '@/components/ui/image-preview'
import { ImageProcessingLoader } from '@/components/image-processing-loader'
import { preloadImageUrl } from '@/lib/preload-image-url'

type Step = 'UPLOAD' | 'GENERATING' | 'RESULT'
type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

function getWebLocaleFromCookie(): UiLocale {
  if (typeof document === 'undefined') return 'vi'
  const cookieValue = document.cookie
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('nanoai_locale='))
    ?.split('=')[1]
    ?.trim()
    .toLowerCase()
  if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') return cookieValue
  return 'vi'
}

const setImageFromFile = (file: File, setImage: (v: { file: File; preview: string }) => void) => {
  if (!file.type.startsWith('image/')) return false
  setImage({ file, preview: URL.createObjectURL(file) })
  return true
}

export default function TaoVideoTuAnhClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [step, setStep] = useState<Step>('UPLOAD')
  const [image, setImage] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p')
  const [prompt, setPrompt] = useState('')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cost = resolution === '720p' ? 8 : 16
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

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

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setImageFromFile(file, setImage)
  }

  const handleSubmit = async () => {
    if (!image.file) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Vui lòng tải lên ảnh.', 'Please upload an image.', '请上传图片。', '画像をアップロードしてください。', '이미지를 업로드해 주세요.'), variant: 'destructive' })
      return
    }
    setStep('GENERATING')
    const formData = new FormData()
    formData.append('image', image.file)
    formData.append('resolution', resolution)
    formData.append('prompt', prompt)
    const result = await createVideoFromImage(formData)
    if (result.error) {
      setStep('UPLOAD')
      toast({
        title: tr('Tạo video thất bại', 'Create video failed', '创建视频失败', '動画作成に失敗しました', '비디오 생성 실패'),
        description: result.error,
        variant: 'destructive',
        duration: 5000,
      })
    } else if (result.success && result.resultUrl) {
      await preloadImageUrl(result.resultUrl)
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      toast({
        title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'),
        description: tr('Đã tạo video 8 giây từ ảnh.', '8-second video created from image.', '已从图片创建 8 秒视频。', '画像から8秒の動画を作成しました。', '이미지에서 8초 비디오가 생성되었습니다.'),
        duration: 3000,
      })
    }
  }

  const handleReset = () => {
    setStep('UPLOAD')
    setImage({ file: null, preview: null })
    setPrompt('')
    setResultUrl(null)
  }

  return (
    <>
      <Toaster />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
            <Video className="h-8 w-8 text-violet-600" /> {tr('Tạo video từ ảnh', 'Create video from image', '从图片创建视频', '画像から動画を作成', '이미지에서 비디오 만들기')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {tr('Chuyển ảnh thành video 8 giây với AI Veo 3.1. 2 chất lượng: 720p và 1080p. Video có âm thanh.', 'Convert image to 8-second video with AI Veo 3.1. 2 qualities: 720p and 1080p. Video has sound.', '使用 AI Veo 3.1 将图片转为 8 秒视频。2 种质量：720p 和 1080p。视频有声音。', 'AI Veo 3.1で画像を8秒動画に変換。720pと1080pの2品質。音声付き。', 'AI Veo 3.1로 이미지를 8초 비디오로 변환. 720p, 1080p 2가지 품질. 음성 포함.')}
          </p>
        </div>

        {step === 'UPLOAD' && (
          <div className="grid lg:grid-cols-[1fr_220px] gap-4 items-start">
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-violet-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="h-4 w-4 text-violet-600" /> {tr('Ảnh gốc', 'Original image', '原图', '元画像', '원본 이미지')}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {tr('Tải lên ảnh. AI sẽ tạo video 8 giây với chuyển động tự nhiên từ ảnh này.', 'Upload an image. AI will create an 8-second video with natural motion from this image.', '上传图片。AI 将基于此图生成 8 秒自然运动视频。', '画像をアップロードしてください。AIがこの画像から自然な動きの8秒動画を作成します。', '이미지를 업로드하세요. AI가 이 이미지로 자연스러운 움직임의 8초 영상을 만듭니다.')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <label
                    htmlFor="video-input"
                    className="block w-full aspect-video max-h-[320px] rounded-lg border-2 border-dashed border-violet-200 bg-violet-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-violet-300 hover:bg-violet-50/80 transition-colors"
                  >
                    {image.preview ? (
                      <ImagePreview src={image.preview} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                    ) : (
                      <>
                        <Upload className="h-12 w-12 text-violet-500" />
                        <p className="text-sm text-muted-foreground font-medium">{tr('Chọn ảnh', 'Select image', '选择图片', '画像を選択', '이미지 선택')}</p>
                      </>
                    )}
                  </label>
                  {image.preview && (
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <RefreshCw className="h-3.5 w-3.5" /> {tr('Chọn lại', 'Choose again', '重新选择', '選び直す', '다시 선택')}
                    </button>
                  )}
                  <input
                    id="video-input"
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {tr('Mô tả chuyển động (tùy chọn)', 'Motion description (optional)', '运动描述（可选）', '動きの説明（任意）', '모션 설명 (선택)')}
                    </label>
                    <Textarea
                      placeholder={tr('VD: Cảnh quay chậm, gió thổi nhẹ qua lá cây, ánh nắng chiếu...', 'e.g. slow camera move, gentle wind through leaves, sunlight rays...', '例如：慢镜头、微风吹过树叶、阳光洒落...', '例：スローカメラ、葉を揺らすそよ風、差し込む日差し...', '예: 슬로우 카메라, 나뭇잎 사이로 부는 바람, 햇살...')}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="min-h-[80px] bg-white/80"
                      maxLength={500}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="lg:w-[220px] lg:shrink-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-violet-200/60 h-full">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">{tr('Chất lượng', 'Quality', '质量', '画質', '화질')}</CardTitle>
                  <CardDescription className="text-xs">{tr('8 giây, 16:9, có âm thanh', '8 seconds, 16:9, with audio', '8 秒，16:9，含音频', '8秒、16:9、音声あり', '8초, 16:9, 오디오 포함')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {tr('Độ phân giải', 'Resolution', '分辨率', '解像度', '해상도')}
                    </h4>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => setResolution('720p')}
                        className={`w-full px-3 py-2.5 rounded-md border text-sm font-medium transition-colors ${
                          resolution === '720p'
                            ? 'border-violet-500 bg-violet-50 text-violet-800'
                            : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        720p (8 credit)
                      </button>
                      <button
                        type="button"
                        onClick={() => setResolution('1080p')}
                        className={`w-full px-3 py-2.5 rounded-md border text-sm font-medium transition-colors ${
                          resolution === '1080p'
                            ? 'border-violet-500 bg-violet-50 text-violet-800'
                            : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        1080p (16 credit)
                      </button>
                    </div>
                  </div>
                  <div className="pt-4 border-t space-y-2 flex flex-col items-center">
                    <DepositCreditButton
                      variant="outline"
                      size="sm"
                      className="w-full max-w-[180px] border-violet-200 text-violet-700 hover:bg-violet-50"
                    />
                    <Button
                      onClick={() => checkCreditsAndProceed(cost, handleSubmit)}
                      disabled={!image.file}
                      className="w-full max-w-[180px] h-9 shadow-md hover:shadow-lg transition-all text-sm bg-violet-600 hover:bg-violet-700 text-white"
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> {tr('Tạo video', 'Create video', '创建视频', '動画を作成', '비디오 만들기')} ({cost} credit)
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground mt-2">
                      {tr('* Thời gian: 1–6 phút', '* Time: 1–6 minutes', '* 时长：1–6 分钟', '* 所要時間: 1〜6分', '* 소요 시간: 1–6분')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === 'GENERATING' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-violet-200/60">
            <CardContent className="flex flex-col items-center py-12">
              <ImageProcessingLoader
                mode="interior"
                title={tr('Đang tạo video', 'Creating video', '正在创建视频', '動画を作成中', '비디오 생성 중')}
                description={tr('AI Veo 3.1 đang xử lý. Video 8 giây có thể mất 1–6 phút.', 'AI Veo 3.1 is processing. The 8-second video may take 1–6 minutes.', 'AI Veo 3.1 正在处理。8 秒视频可能需要 1–6 分钟。', 'AI Veo 3.1が処理中です。8秒動画は1〜6分かかる場合があります。', 'AI Veo 3.1 처리 중입니다. 8초 영상은 1–6분 걸릴 수 있습니다.')}
                imagePreview={image.preview}
              />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>{tr('Kết quả', 'Result', '结果', '結果', '결과')}</CardTitle>
              <CardDescription>{tr('Đã tạo video 8 giây từ ảnh.', '8-second video created from image.', '已从图片创建 8 秒视频。', '画像から8秒の動画を作成しました。', '이미지에서 8초 비디오가 생성되었습니다.')}</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">{tr('Ảnh gốc', 'Original image', '原图', '元画像', '원본 이미지')}</h3>
                {image.preview && (
                  <div className="aspect-video rounded-lg border overflow-hidden">
                    <ImagePreview src={image.preview} alt={tr('Gốc', 'Original', '原图', '元画像', '원본')} className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground">{tr('Video', 'Video', '视频', '動画', '비디오')}</h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleReset}>
                      <RefreshCw className="mr-2 h-3 w-3" /> {tr('Thử lại', 'Try again', '重试', '再試行', '다시 시도')}
                    </Button>
                    <Button
                      size="sm"
                      className="bg-violet-600 hover:bg-violet-700 text-white border-0"
                      onClick={async () => {
                        try {
                          const res = await fetch(resultUrl)
                          const blob = await res.blob()
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = 'video-ai.mp4'
                          a.click()
                          URL.revokeObjectURL(url)
                        } catch {
                          window.open(resultUrl, '_blank')
                        }
                      }}
                    >
                      {tr('Tải video', 'Download video', '下载视频', '動画をダウンロード', '비디오 다운로드')}
                    </Button>
                  </div>
                </div>
                <div className="aspect-video rounded-lg border overflow-hidden bg-black">
                  <video src={resultUrl} controls className="w-full h-full" playsInline>
                    {tr('Trình duyệt không hỗ trợ video.', 'Browser does not support video.', '浏览器不支持视频。', 'ブラウザが動画をサポートしていません。', '브라우저가 비디오를 지원하지 않습니다.')}
                  </video>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">{tr('Video do AI tạo có thể có sai sót.', 'AI-generated video may contain inaccuracies.', 'AI 生成的视频可能存在误差。', 'AI生成動画には誤りが含まれる場合があります。', 'AI 생성 비디오는 오류가 있을 수 있습니다.')}</p>
    </>
  )
}
