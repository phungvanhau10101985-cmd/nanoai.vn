'use client'

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

import { useState, useRef, ChangeEvent, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { editImageByPrompt } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, RefreshCw, Link2, Wand2 } from 'lucide-react'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { DownloadImageButton } from '@/components/download-image-button'
import { ImagePreview } from '@/components/ui/image-preview'
import { BeforeAfterResultDisplay } from '@/components/image-tools/before-after-result-display'
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

export default function SuaAnhTheoYeuCauClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [step, setStep] = useState<Step>('UPLOAD')
  const [image, setImage] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const [requestText, setRequestText] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
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

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setImageFromFile(file, setImage)
  }

  const handleFetchFromUrl = async () => {
    const url = imageUrl.trim()
    if (!url) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Vui lòng dán link ảnh.', 'Please paste image URL.', '请粘贴图片链接。', '画像リンクを貼ってください。', '이미지 링크를 붙여넣어 주세요.'), variant: 'destructive' })
      return
    }
    if (!/^https?:\/\//i.test(url)) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Link không hợp lệ.', 'Invalid URL.', '链接无效。', '無効なリンクです。', '유효하지 않은 링크입니다.'), variant: 'destructive' })
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
      toast({ title: tr('Đã tải ảnh', 'Image loaded', '图片已加载', '画像を読み込みました', '이미지를 불러왔습니다'), description: tr('Ảnh từ link đã được thêm.', 'Image from URL was added.', '已添加来自链接的图片。', 'リンク画像を追加しました。', '링크 이미지가 추가되었습니다.'), duration: 2000 })
    } catch {
      toast({
        title: tr('Không tải được ảnh', 'Cannot load image', '无法加载图片', '画像を読み込めません', '이미지를 불러올 수 없습니다'),
        description: tr('Link có thể bị chặn CORS. Thử tải ảnh lên trực tiếp.', 'URL may be blocked by CORS. Try uploading directly.', '链接可能被 CORS 阻止。请直接上传。', 'CORS によりブロックされた可能性があります。直接アップロードしてください。', 'CORS 차단일 수 있습니다. 직접 업로드해 주세요.'),
        variant: 'destructive',
        duration: 5000,
      })
    } finally {
      setUrlLoading(false)
    }
  }

  const pastedTitle = tr('Đã dán ảnh', 'Image pasted', '已粘贴图片', '画像を貼り付けました', '이미지를 붙여넣었습니다')
  const pastedDesc = tr(
    'Ảnh từ clipboard đã được thêm.',
    'Image from clipboard was added.',
    '已添加剪贴板图片。',
    'クリップボード画像を追加しました。',
    '클립보드 이미지가 추가되었습니다.'
  )

  useEffect(() => {
    const syncLocale = () => setUiLocale(getWebLocaleFromCookie())
    syncLocale()
    const timer = window.setInterval(syncLocale, 1000)
    const fn = (e: globalThis.ClipboardEvent) => {
      if (step !== 'UPLOAD') return
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file && setImageFromFile(file, setImage)) {
            e.preventDefault()
            toast({ title: pastedTitle, description: pastedDesc, duration: 2000 })
          }
          break
        }
      }
    }
    document.addEventListener('paste', fn)
    window.addEventListener('focus', syncLocale)
    document.addEventListener('visibilitychange', syncLocale)
    return () => {
      document.removeEventListener('paste', fn)
      window.removeEventListener('focus', syncLocale)
      document.removeEventListener('visibilitychange', syncLocale)
      window.clearInterval(timer)
    }
  }, [pastedDesc, pastedTitle, step, toast])

  const handleSubmit = async () => {
    if (!image.file) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Vui lòng tải lên ảnh.', 'Please upload an image.', '请上传图片。', '画像をアップロードしてください。', '이미지를 업로드해 주세요.'), variant: 'destructive' })
      return
    }
    if (!requestText.trim()) {
      toast({ title: tr('Thiếu yêu cầu', 'Missing request', '缺少要求', '要望が未入力です', '요청이 비어 있습니다'), description: tr('Hãy nhập mô tả bạn muốn AI chỉnh gì trên ảnh.', 'Please describe what you want to edit.', '请输入你希望 AI 如何编辑图片。', 'AIにどのように編集してほしいか入力してください。', 'AI가 어떻게 편집하길 원하는지 입력해 주세요.'), variant: 'destructive' })
      return
    }
    setStep('GENERATING')
    const formData = new FormData()
    formData.append('image', image.file)
    formData.append('imageQuality', imageQuality)
    formData.append('requestText', requestText)
    const result = await editImageByPrompt(formData)
    if (result.error) {
      setStep('UPLOAD')
      toast({ title: tr('Sửa ảnh thất bại', 'Image edit failed', '图片编辑失败', '画像編集に失敗しました', '이미지 편집 실패'), description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      await preloadImageUrl(result.resultUrl)
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      toast({ title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'), description: tr('Ảnh đã được chỉnh theo yêu cầu.', 'Image edited as requested.', '图片已按要求编辑。', '要望どおりに画像を編集しました。', '요청대로 이미지가 편집되었습니다.'), duration: 3000 })
    }
  }

  const handleReset = () => {
    setStep('UPLOAD')
    setImage({ file: null, preview: null })
    setRequestText('')
    setResultUrl(null)
  }

  return (
    <>
      <Toaster />
      <div className="tool-page-container">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
            <Wand2 className="h-8 w-8 text-violet-600" /> {tr('Sửa ảnh theo yêu cầu', 'Edit image by request', '按要求编辑图片', '要望に応じて画像編集', '요청 기반 이미지 편집')}
          </h1>
          <p className="text-muted-foreground mt-1">{tr('Tải ảnh lên, nhập yêu cầu tự do để AI chỉnh sửa đúng ý. 1,5-3 credits/ảnh.', 'Upload image and describe edits in natural language. 1.5-3 credits/image.', '上传图片并输入自然语言要求，AI 将按需编辑。1.5-3 credits/张。', '画像をアップロードし、要望を入力するとAIが編集します。1.5-3 credits/枚。', '이미지를 업로드하고 요청을 입력하면 AI가 편집합니다. 1.5-3 credits/장.')}</p>
        </div>

        {step === 'UPLOAD' && (
          <div className="grid lg:grid-cols-[1fr_200px] gap-4 items-start">
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-violet-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="h-4 w-4 text-violet-600" /> {tr('Ảnh cần chỉnh sửa', 'Image to edit', '需要编辑的图片', '編集する画像', '편집할 이미지')}
                  </CardTitle>
                  <CardDescription className="text-xs">{tr('Bạn có thể dán ảnh từ clipboard, upload file hoặc lấy từ URL.', 'You can paste from clipboard, upload file, or fetch from URL.', '可从剪贴板粘贴、上传文件或从链接获取图片。', 'クリップボード貼り付け、アップロード、URL取得に対応。', '클립보드 붙여넣기, 파일 업로드, URL 가져오기를 지원합니다.')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <label
                    htmlFor="edit-input"
                    className="block w-full aspect-[4/3] max-h-[400px] rounded-lg border-2 border-dashed border-violet-200 bg-violet-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-violet-300 hover:bg-violet-50/80 transition-colors"
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
                      <RefreshCw className="h-3.5 w-3.5" /> {tr('Chọn lại', 'Select again', '重新选择', '再選択', '다시 선택')}
                    </button>
                  )}
                  <input id="edit-input" ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Yêu cầu chỉnh sửa', 'Edit request', '编辑要求', '編集リクエスト', '편집 요청')}</h4>
                    <Input placeholder={tr('VD: đổi nền thành studio sáng, giữ nguyên khuôn mặt và màu áo', 'e.g. change background to bright studio, keep face and shirt color', '例如：改成明亮影棚背景，保持脸和衣服颜色不变', '例：背景を明るいスタジオに変更、顔と服色は維持', '예: 배경을 밝은 스튜디오로 변경, 얼굴과 옷 색상 유지')} value={requestText} onChange={(e) => setRequestText(e.target.value)} className="bg-white/80" />
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder={tr('Dán link ảnh rồi bấm Lấy ảnh', 'Paste image URL then click Fetch', '粘贴图片链接后点击获取', '画像リンクを貼って「取得」を押す', '이미지 링크 붙여넣고 가져오기 클릭')} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="flex-1" />
                    <Button type="button" variant="outline" onClick={handleFetchFromUrl} disabled={urlLoading} className="shrink-0 border-violet-200 text-violet-700 hover:bg-violet-50">
                      <Link2 className="mr-2 h-4 w-4" /> {urlLoading ? tr('Đang tải...', 'Loading...', '加载中...', '読み込み中...', '불러오는 중...') : tr('Lấy ảnh', 'Fetch image', '获取图片', '画像を取得', '가져오기')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="lg:w-[200px] lg:shrink-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-violet-200/60 h-full">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">{tr('Tùy chọn', 'Options', '选项', 'オプション', '옵션')}</CardTitle>
                  <CardDescription className="text-xs">{tr('Chất lượng ảnh đầu ra.', 'Output image quality.', '输出图片质量。', '出力画質。', '출력 이미지 품질.')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Chất lượng ảnh', 'Image quality', '图片质量', '画質', '이미지 품질')}</h4>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setImageQuality('2K')} className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${imageQuality === '2K' ? 'border-violet-500 bg-violet-50 text-violet-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'}`}>
                        2K (1,5)
                      </button>
                      <button type="button" onClick={() => setImageQuality('4K')} className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${imageQuality === '4K' ? 'border-violet-500 bg-violet-50 text-violet-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'}`}>
                        4K (3)
                      </button>
                    </div>
                  </div>
                  <div className="pt-4 border-t space-y-2 flex flex-col items-center">
                    <DepositCreditButton variant="outline" size="sm" className="w-full max-w-[180px] border-violet-200 text-violet-700 hover:bg-violet-50" />
                    <Button onClick={() => checkCreditsAndProceed(cost, handleSubmit)} disabled={!image.file || !requestText.trim()} className="w-full max-w-[180px] h-9 shadow-md hover:shadow-lg transition-all text-sm bg-violet-600 hover:bg-violet-700 text-white">
                      <Sparkles className="mr-2 h-4 w-4" /> {tr('Sửa ảnh', 'Edit image', '编辑图片', '画像を編集', '이미지 편집')} ({imageQuality === '2K' ? '1,5' : '3'} credit)
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground mt-2">* {tr('Thời gian: 15–60 giây', 'Time: 15–60 seconds', '时间：15–60 秒', '時間：15–60秒', '시간: 15–60초')}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === 'GENERATING' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-violet-200/60">
            <CardContent className="flex flex-col items-center py-8">
              <ImageProcessingLoader mode="text2img" title={tr('Đang sửa ảnh', 'Editing image', '正在编辑图片', '画像を編集中', '이미지 편집 중')} description={tr('AI đang xử lý theo yêu cầu bạn nhập', 'AI is applying your request', 'AI 正在按你的要求处理', 'AIが要望に沿って処理中です', 'AI가 입력한 요청에 맞춰 처리 중입니다')} imagePreview={image.preview} />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>{tr('Kết quả', 'Result', '结果', '結果', '결과')}</CardTitle>
              <CardDescription>{tr('Ảnh đã được chỉnh sửa theo yêu cầu.', 'Image edited according to your request.', '图片已按你的要求编辑。', '要望に沿って画像を編集しました。', '요청에 따라 이미지가 편집되었습니다.')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {image.preview ? (
                <BeforeAfterResultDisplay
                  beforeSrc={image.preview}
                  afterSrc={resultUrl}
                  beforeAlt={tr('Trước', 'Before', '之前', '前', '전')}
                  afterAlt={tr('Sau', 'After', '之后', '後', '후')}
                  beforeHeader={
                    <h3 className="text-sm font-medium text-muted-foreground">{tr('Trước', 'Before', '之前', '前', '전')}</h3>
                  }
                  afterHeader={
                    <div className="flex w-full flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-medium text-muted-foreground">{tr('Sau', 'After', '之后', '後', '후')}</h3>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={handleReset}>
                          <RefreshCw className="mr-2 h-3 w-3" /> {tr('Thử lại', 'Try again', '重试', 'やり直す', '다시 시도')}
                        </Button>
                        <DownloadImageButton
                          imageUrl={resultUrl}
                          filename="sua-anh-theo-yeu-cau-result"
                          size="sm"
                          className="bg-violet-600 hover:bg-violet-700 text-white border-0"
                          printReady
                          printReadyInferFromImage
                        />
                      </div>
                    </div>
                  }
                />
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">{tr('Ảnh do AI tạo có thể có sai sót.', 'AI-generated images may contain minor errors.', 'AI 生成结果可能存在误差。', 'AI生成結果には誤差が含まれる場合があります。', 'AI 생성 결과에는 오차가 있을 수 있습니다.')}</p>
    </>
  )
}

