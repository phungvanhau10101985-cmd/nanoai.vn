'use client'

import { useState, useRef, ChangeEvent, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createHeadshot } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, RefreshCw, Link2, Briefcase } from 'lucide-react'
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

const setImageFromFile = (file: File, setImage: (v: { file: File; preview: string }) => void) => {
  if (!file.type.startsWith('image/')) return false
  setImage({ file, preview: URL.createObjectURL(file) })
  return true
}

export default function TaoAnhChainDungClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [step, setStep] = useState<Step>('UPLOAD')
  const [image, setImage] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const [note, setNote] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cost = imageQuality === '2K' ? 2 : 4
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

  const handleFetchFromUrl = async () => {
    const url = imageUrl.trim()
    if (!url) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Vui lòng dán link ảnh.', 'Please paste image URL.', '请粘贴图片链接。', '画像のURLを貼り付けてください。', '이미지 링크를 붙여넣어 주세요.'), variant: 'destructive' })
      return
    }
    if (!/^https?:\/\//i.test(url)) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Link không hợp lệ.', 'Invalid URL.', '链接无效。', '無効なURLです。', '잘못된 URL입니다.'), variant: 'destructive' })
      return
    }
    setUrlLoading(true)
    try {
      const res = await fetch(url, { mode: 'cors' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      if (!blob.type.startsWith('image/')) throw new Error(tr('Không phải ảnh', 'Not an image', '不是图片', '画像ではありません', '이미지가 아닙니다'))
      const file = new File([blob], 'image-from-url.png', { type: blob.type || 'image/png' })
      setImageFromFile(file, setImage)
      setImageUrl('')
      toast({ title: tr('Đã tải ảnh', 'Image loaded', '已加载图片', '画像を読み込みました', '이미지 로드됨'), description: tr('Ảnh từ link đã được thêm.', 'Image from URL has been added.', '已从链接添加图片。', 'URLから画像を追加しました。', 'URL에서 이미지가 추가되었습니다.'), duration: 2000 })
    } catch {
      toast({
        title: tr('Không tải được ảnh', 'Failed to load image', '无法加载图片', '画像の読み込みに失敗しました', '이미지 로드 실패'),
        description: tr('Link có thể bị chặn CORS. Thử tải ảnh lên trực tiếp.', 'URL may be CORS-blocked. Try uploading directly.', '链接可能被 CORS 阻止。请直接上传。', 'CORSでブロックされている可能性があります。直接アップロードしてください。', 'CORS로 차단되었을 수 있습니다. 직접 업로드해 보세요.'),
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
            toast({ title: tr('Đã dán ảnh', 'Image pasted', '已粘贴图片', '画像を貼り付けました', '이미지 붙여넣음'), description: tr('Ảnh từ clipboard đã được thêm.', 'Image from clipboard has been added.', '已从剪贴板添加图片。', 'クリップボードから画像を追加しました。', '클립보드에서 이미지가 추가되었습니다.'), duration: 2000 })
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
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Vui lòng tải lên ảnh selfie.', 'Please upload a selfie.', '请上传自拍照。', 'セルフィーをアップロードしてください。', '셀카를 업로드해 주세요.'), variant: 'destructive' })
      return
    }
    setStep('GENERATING')
    const formData = new FormData()
    formData.append('image', image.file)
    formData.append('imageQuality', imageQuality)
    formData.append('note', note)
    const result = await createHeadshot(formData)
    if (result.error) {
      setStep('UPLOAD')
      toast({ title: tr('Tạo ảnh thất bại', 'Create image failed', '创建图片失败', '画像作成に失敗しました', '이미지 생성 실패'), description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      await preloadImageUrl(result.resultUrl)
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      toast({ title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'), description: tr('Đã tạo ảnh chân dung chuyên nghiệp.', 'Professional headshot created.', '已创建专业肖像照。', 'プロの証明写真を作成しました。', '전문 인물 사진이 생성되었습니다.'), duration: 3000 })
    }
  }

  const handleReset = () => {
    setStep('UPLOAD')
    setImage({ file: null, preview: null })
    setNote('')
    setResultUrl(null)
  }

  return (
    <>
      <Toaster />
      <div className="tool-page-container">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
            <Briefcase className="h-8 w-8 text-slate-600" /> {tr('Tạo ảnh chân dung chuyên nghiệp', 'Create professional headshot', '创建专业肖像照', 'プロの証明写真を作成', '전문 인물 사진 만들기')}
          </h1>
          <p className="text-muted-foreground mt-1">{tr('Biến selfie thành ảnh LinkedIn, CV. Áo vest, ánh sáng studio. 2–4 credits/ảnh.', 'Turn selfie into LinkedIn, CV photo. Suit, studio lighting. 2–4 credits/image.', '将自拍变成 LinkedIn、简历照。西装、影棚灯光。2–4 积分/张。', 'セルフィーをLinkedIn・履歴書用に。スーツ、スタジオ照明。2〜4クレジット/枚。', '셀카를 LinkedIn, 이력서 사진으로. 정장, 스튜디오 조명. 2–4 크레딧/장.')}</p>
        </div>

        {step === 'UPLOAD' && (
          <div className="grid lg:grid-cols-[1fr_200px] gap-4 items-start">
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-slate-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="h-4 w-4 text-slate-600" /> {tr('Ảnh selfie', 'Selfie image', '自拍照', 'セルフィー画像', '셀카 이미지')}
                  </CardTitle>
                  <CardDescription className="text-xs">{tr('Chọn ảnh selfie bình thường. AI sẽ chỉnh thành ảnh chuyên nghiệp.', 'Choose a normal selfie. AI will transform it into a professional portrait.', '选择一张普通自拍。AI 会将其处理为专业人像。', '通常のセルフィーを選択。AIがプロ風ポートレートに仕上げます。', '일반 셀카를 선택하세요. AI가 전문 인물 사진으로 보정합니다.')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <label
                    htmlFor="headshot-input"
                    className="block w-full aspect-[4/3] max-h-[400px] rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-slate-300 hover:bg-slate-50/80 transition-colors"
                  >
                    {image.preview ? (
                      <ImagePreview src={image.preview} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                    ) : (
                      <>
                        <Upload className="h-12 w-12 text-slate-500" />
                        <p className="text-sm text-muted-foreground font-medium">{tr('Chọn ảnh selfie', 'Select selfie', '选择自拍照', 'セルフィーを選択', '셀카 선택')}</p>
                      </>
                    )}
                  </label>
                  {image.preview && (
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <RefreshCw className="h-3.5 w-3.5" /> {tr('Chọn lại', 'Choose again', '重新选择', '選び直す', '다시 선택')}
                    </button>
                  )}
                  <input id="headshot-input" ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Yêu cầu thêm (tùy chọn)', 'Extra prompt (optional)', '附加要求（可选）', '追加要望（任意）', '추가 요청 (선택)')}</h4>
                    <Textarea placeholder={tr('VD: áo vest xanh, nền tối...', 'e.g. blue suit, dark background...', '例如：蓝色西装、深色背景...', '例: 青いスーツ、暗い背景...', '예: 파란 정장, 어두운 배경...')} value={note} onChange={(e) => setNote(e.target.value)} className="bg-white/80 text-xs h-16 resize-y" />
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder={tr('Dán link ảnh rồi bấm Lấy ảnh', 'Paste image URL then click Fetch', '粘贴图片链接后点击获取', '画像URLを貼り付けて取得をクリック', '이미지 링크 붙여넣기 후 가져오기 클릭')} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="flex-1" />
                    <Button type="button" variant="outline" onClick={handleFetchFromUrl} disabled={urlLoading} className="shrink-0 border-slate-200 text-slate-700 hover:bg-slate-50">
                      <Link2 className="mr-2 h-4 w-4" /> {urlLoading ? tr('Đang tải...', 'Loading...', '加载中...', '読み込み中...', '불러오는 중...') : tr('Lấy ảnh', 'Fetch image', '获取图片', '画像を取得', '이미지 가져오기')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="lg:w-[200px] lg:shrink-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-slate-200/60 h-full">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">{tr('Tùy chọn', 'Options', '选项', 'オプション', '옵션')}</CardTitle>
                  <CardDescription className="text-xs">{tr('Chất lượng xuất ảnh.', 'Output image quality.', '输出图像质量。', '出力画像の品質。', '출력 이미지 품질.')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Chất lượng ảnh', 'Image quality', '图像质量', '画像品質', '이미지 품질')}</h4>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setImageQuality('2K')} className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${imageQuality === '2K' ? 'border-slate-500 bg-slate-50 text-slate-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'}`}>
                        2K (2)
                      </button>
                      <button type="button" onClick={() => setImageQuality('4K')} className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${imageQuality === '4K' ? 'border-slate-500 bg-slate-50 text-slate-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'}`}>
                        4K (4)
                      </button>
                    </div>
                  </div>
                  <div className="pt-4 border-t space-y-2 flex flex-col items-center">
                    <DepositCreditButton variant="outline" size="sm" className="w-full max-w-[180px] border-slate-200 text-slate-700 hover:bg-slate-50" />
                    <Button onClick={() => checkCreditsAndProceed(cost, handleSubmit)} disabled={!image.file} className="w-full max-w-[180px] h-9 shadow-md hover:shadow-lg transition-all text-sm bg-slate-600 hover:bg-slate-700 text-white">
                      <Sparkles className="mr-2 h-4 w-4" /> {tr('Tạo ảnh', 'Create image', '创建图片', '画像を作成', '이미지 만들기')} ({imageQuality === '2K' ? '2' : '4'} credit)
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground mt-2">{tr('* Thời gian: 15–45 giây', '* Time: 15–45 seconds', '* 时长：15–45 秒', '* 所要時間: 15〜45秒', '* 소요 시간: 15–45초')}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === 'GENERATING' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-slate-200/60">
            <CardContent className="flex flex-col items-center py-8">
              <ImageProcessingLoader mode="headshot" title={tr('Đang tạo ảnh chân dung', 'Creating portrait', '正在创建人像', 'ポートレート作成中', '인물 사진 생성 중')} description={tr('AI đang chỉnh trang phục, ánh sáng studio', 'AI is adjusting outfit and studio lighting', 'AI 正在调整服装与影棚光线', 'AIが服装とスタジオ照明を調整中', 'AI가 의상과 스튜디오 조명을 조정 중')} imagePreview={image.preview} />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>{tr('Kết quả', 'Result', '结果', '結果', '결과')}</CardTitle>
              <CardDescription>{tr('Đã tạo ảnh chân dung chuyên nghiệp.', 'Professional portrait created.', '已创建专业人像。', 'プロのポートレートを作成しました。', '전문 인물 사진이 생성되었습니다.')}</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">{tr('Trước', 'Before', '之前', '前', '이전')}</h3>
                {image.preview && (
                  <div className="aspect-square rounded-lg border overflow-hidden">
                    <ImagePreview src={image.preview} alt={tr('Trước', 'Before', '之前', '前', '이전')} className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground">{tr('Sau', 'After', '之后', '後', '이후')}</h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleReset}><RefreshCw className="mr-2 h-3 w-3" /> {tr('Thử lại', 'Try again', '重试', '再試行', '다시 시도')}</Button>
                    <DownloadImageButton
                    imageUrl={resultUrl}
                    filename="headshot-result"
                    size="sm"
                    className="bg-slate-600 hover:bg-slate-700 text-white border-0"
                    printReady
                    printReadyInferFromImage
                  />
                  </div>
                </div>
                <div className="aspect-square rounded-lg border overflow-hidden">
                  <ImagePreview src={resultUrl} alt={tr('Sau', 'After', '之后', '後', '이후')} className="w-full h-full object-cover" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">{tr('Ảnh do AI tạo có thể có sai sót.', 'AI-generated image may contain inaccuracies.', 'AI 生成的图片可能存在误差。', 'AI生成画像には誤りが含まれる場合があります。', 'AI 생성 이미지는 오류가 있을 수 있습니다.')}</p>
    </>
  )
}
