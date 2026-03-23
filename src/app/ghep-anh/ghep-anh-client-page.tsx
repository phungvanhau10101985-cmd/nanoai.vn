'use client'

import { useState, useRef, ChangeEvent, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { mergeImages } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, RefreshCw, Plus, X } from 'lucide-react'
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

const MAX_IMAGES = 6

export default function GhepAnhClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [step, setStep] = useState<Step>('UPLOAD')
  const [images, setImages] = useState<{ file: File; preview: string }[]>([])
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const [note, setNote] = useState('')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cost = imageQuality === '2K' ? 1.5 : 3
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

  const handleAddImages = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    const newImages: { file: File; preview: string }[] = []
    for (let i = 0; i < files.length && images.length + newImages.length < MAX_IMAGES; i++) {
      const file = files[i]
      if (file.type.startsWith('image/')) {
        newImages.push({ file, preview: URL.createObjectURL(file) })
      }
    }
    if (newImages.length) {
      setImages((prev) => [...prev, ...newImages].slice(0, MAX_IMAGES))
      toast({ title: tr('Đã thêm ảnh', 'Images added', '已添加图片', '画像を追加しました', '이미지를 추가했습니다'), description: tr(`Thêm ${newImages.length} ảnh.`, `Added ${newImages.length} images.`, `已添加 ${newImages.length} 张图片。`, `${newImages.length}枚追加しました。`, `${newImages.length}장 추가되었습니다.`), duration: 2000 })
    }
    e.target.value = ''
  }

  const handleRemove = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (images.length < 2) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Cần ít nhất 2 ảnh để ghép.', 'Need at least 2 images to merge.', '至少需要 2 张图片进行合成。', '合成には最低2枚必要です。', '합성하려면 최소 2장의 이미지가 필요합니다.'), variant: 'destructive' })
      return
    }
    setStep('GENERATING')
    const formData = new FormData()
    formData.append('imageQuality', imageQuality)
    formData.append('note', note)
    images.forEach((img, i) => formData.append(`image_${i}`, img.file))
    const result = await mergeImages(formData)
    if (result.error) {
      setStep('UPLOAD')
      toast({ title: tr('Ghép ảnh thất bại', 'Image merge failed', '合成失败', '画像合成に失敗しました', '이미지 합성 실패'), description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      await preloadImageUrl(result.resultUrl)
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      toast({ title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'), description: tr('Ảnh đã được ghép.', 'Images have been merged.', '图片已合成。', '画像を合成しました。', '이미지 합성이 완료되었습니다.'), duration: 3000 })
    }
  }

  const handleReset = () => {
    setStep('UPLOAD')
    setImages([])
    setNote('')
    setResultUrl(null)
  }

  return (
    <>
      <Toaster />
      <div className="tool-page-container">
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">{tr('Ghép ảnh', 'Merge Images', '图片合成', '画像合成', '이미지 합성')}</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">{tr('Ghép 2-6 ảnh thành một. 1,5-3 credits/ảnh.', 'Merge 2-6 images into one. 1.5-3 credits/image.', '将 2-6 张图片合成为一张。1.5-3 credits/张。', '2-6枚の画像を1枚に合成。1.5-3 credits/枚。', '2-6장의 이미지를 1장으로 합성합니다. 1.5-3 credits/장.')}</p>
        </div>

        {step === 'UPLOAD' && (
          <div className="grid lg:grid-cols-[1fr_200px] gap-4 items-start">
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-amber-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="h-4 w-4 text-amber-600" /> {tr('Tải ảnh cần ghép (tối thiểu 2, tối đa 6)', 'Upload images to merge (min 2, max 6)', '上传待合成图片（最少2张，最多6张）', '合成する画像をアップロード（2〜6枚）', '합성할 이미지 업로드 (최소 2장, 최대 6장)')}
                  </CardTitle>
                  <CardDescription className="text-xs">{tr('Chọn nhiều ảnh để ghép thành một.', 'Select multiple images to merge into one.', '选择多张图片合成一张。', '複数画像を選択して1枚に合成。', '여러 이미지를 선택해 한 장으로 합성합니다.')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {images.map((img, i) => (
                      <div key={i} className="relative group aspect-square rounded-lg border overflow-hidden bg-amber-50/60">
                        <ImagePreview src={img.preview} alt={tr('Ảnh', 'Image', '图片', '画像', '이미지') + ` ${i + 1}`} className="w-full h-full object-cover" />
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
                    ))}
                    {images.length < MAX_IMAGES && (
                      <label
                        htmlFor="ghep-anh-input"
                        className="aspect-square rounded-lg border-2 border-dashed border-amber-200 bg-amber-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-amber-300 hover:bg-amber-50/80 transition-colors"
                      >
                        <Plus className="h-10 w-10 text-amber-500" />
                        <p className="text-xs text-muted-foreground font-medium">{tr('Thêm ảnh', 'Add image', '添加图片', '画像を追加', '이미지 추가')}</p>
                      </label>
                    )}
                  </div>
                  <input
                    id="ghep-anh-input"
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleAddImages}
                  />
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Yêu cầu thêm (tùy chọn)', 'Additional request (optional)', '附加要求（可选）', '追加要望（任意）', '추가 요청 (선택)')}</h4>
                    <Textarea
                      placeholder={tr('Ví dụ: sắp xếp theo thứ tự, ưu tiên ảnh 1...', 'e.g. arrange in order, prioritize image 1...', '例如：按顺序排列、优先图片1...', '例：順番に並べる、画像1を優先...', '예: 순서대로 배치, 이미지 1 우선...')}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="bg-white/80 text-xs h-20 min-h-[80px] resize-y"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="lg:w-[200px] lg:shrink-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-amber-200/60 h-full">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">{tr('Tùy chọn', 'Options', '选项', 'オプション', '옵션')}</CardTitle>
                  <CardDescription className="text-xs">{tr('Chất lượng xuất ảnh.', 'Output image quality.', '输出图片质量。', '出力画質。', '출력 이미지 품질.')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Chất lượng ảnh', 'Image quality', '图片质量', '画質', '이미지 품질')}</h4>
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
                      disabled={images.length < 2}
                      className="w-full max-w-[180px] min-h-[44px] shadow-md hover:shadow-lg transition-all text-sm bg-amber-600 hover:bg-amber-700 text-white touch-manipulation"
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> {tr('Ghép ảnh', 'Merge images', '合成图片', '画像を合成', '이미지 합성')} ({imageQuality === '2K' ? '1,5' : '3'} credit)
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground mt-2">* {tr('Thời gian: 15–45 giây', 'Time: 15–45 seconds', '时间：15–45 秒', '時間：15–45秒', '시간: 15–45초')}</p>
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
                mode="merge"
                title={tr('Đang ghép ảnh', 'Merging images', '正在合成图片', '画像を合成中', '이미지 합성 중')}
                description={tr('AI đang kết hợp các ảnh thành một bức hài hòa', 'AI is combining images into one harmonious result', 'AI 正在将多张图片合成为一张', 'AIが複数画像を1枚に合成中', 'AI가 여러 이미지를 하나로 합성 중입니다')}
                imagePreviews={images.map((img) => img.preview)}
              />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>{tr('Kết quả ghép ảnh', 'Merge result', '合成结果', '合成結果', '합성 결과')}</CardTitle>
              <CardDescription>{tr('Ảnh đã được ghép.', 'Images have been merged.', '图片已合成。', '画像を合成しました。', '이미지 합성이 완료되었습니다.')}</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">{tr('Trước', 'Before', '之前', '前', '전')}</h3>
                {images.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {images.map((img, i) => (
                      <div key={i} className="aspect-square rounded-lg border overflow-hidden">
                        <ImagePreview src={img.preview} alt={`${tr('Trước', 'Before', '之前', '前', '전')} ${i + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground">{tr('Sau', 'After', '之后', '後', '후')}</h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleReset}>
                      <RefreshCw className="mr-2 h-3 w-3" /> {tr('Thử lại', 'Try again', '重试', 'やり直す', '다시 시도')}
                    </Button>
                    <DownloadImageButton
                    imageUrl={resultUrl}
                    filename="ghep-anh-result"
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white border-0"
                    printReady
                    printReadyInferFromImage
                  />
                  </div>
                </div>
                <div className="aspect-square rounded-lg border overflow-hidden">
                  <ImagePreview src={resultUrl} alt={tr('Sau', 'After', '之后', '後', '후')} className="w-full h-full object-cover" />
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
