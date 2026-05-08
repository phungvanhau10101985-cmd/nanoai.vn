'use client'

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

import { useState, useRef, ChangeEvent, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { sharpenImage } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, RefreshCw, Link2 } from 'lucide-react'
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

export default function LamNetAnhClientPage() {
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
  const cost = imageQuality === '2K' ? 1.5 : 3
  const t = useMemo(() => {
    if (uiLocale === 'zh') {
      return {
        err: '错误', pasteLink: '请粘贴图片链接。', invalidLink: '链接无效。', notImage: '不是图片',
        loaded: '图片已加载', loadedDesc: '已添加来自链接的图片。', cannotLoad: '无法加载图片',
        cannotLoadDesc: '链接可能被 CORS 阻止。请直接上传图片。', pasted: '已粘贴图片', pastedDesc: '已添加剪贴板图片。',
        uploadNeed: '请上传需要增强的图片。', failed: '增强失败', success: '成功！', successDesc: '图片已增强。',
        title: '图片增强', subtitle: '使用 AI 提升清晰度并减少模糊。1.5–3 点数/张。',
        uploadCard: '上传待增强图片', uploadDesc: '可选择图片、粘贴图片（Ctrl+V）或粘贴链接。',
        chooseOrPaste: '选择图片或粘贴图片（Ctrl+V）', reselect: '重新选择', pasteLinkInput: '粘贴链接后点击获取图片',
        fetching: '加载中...', fetchImage: '获取图片', options: '选项', optionsDesc: '附加要求与输出质量。',
        extraReq: '附加要求', extraPlaceholder: '例如：优先增强人脸、文字...',
        quality: '图片质量', sharpen: '增强', time: '* 时长：15–45 秒', generatingTitle: '正在增强图片',
        generatingDesc: 'AI 正在提升清晰度与细节', resultTitle: '增强结果', resultDesc: '图片处理完成',
        before: '之前', after: '之后', tryAgain: '重试', footer: '图片越清晰结果越准确。AI 结果可能存在误差。',
      }
    }
    if (uiLocale === 'ja') {
      return {
        err: 'エラー', pasteLink: '画像リンクを貼り付けてください。', invalidLink: '無効なリンクです。', notImage: '画像ではありません',
        loaded: '画像を読み込みました', loadedDesc: 'リンク画像を追加しました。', cannotLoad: '画像を読み込めません',
        cannotLoadDesc: 'CORS によりブロックされた可能性があります。直接アップロードしてください。', pasted: '画像を貼り付けました', pastedDesc: 'クリップボード画像を追加しました。',
        uploadNeed: '高画質化する画像をアップロードしてください。', failed: '高画質化に失敗しました', success: '成功', successDesc: '画像を高画質化しました。',
        title: '画像高画質化', subtitle: 'AIで鮮明度を上げ、ぼやけを軽減します。1.5–3 クレジット/枚。',
        uploadCard: '高画質化する画像をアップロード', uploadDesc: '画像選択・貼り付け（Ctrl+V）・リンク貼り付けに対応。',
        chooseOrPaste: '画像を選択または貼り付け（Ctrl+V）', reselect: '再選択', pasteLinkInput: '画像リンクを貼って「取得」を押してください',
        fetching: '読み込み中...', fetchImage: '画像を取得', options: 'オプション', optionsDesc: '追加要件と出力品質。',
        extraReq: '追加要件', extraPlaceholder: '例：顔や文字を優先して鮮明化...',
        quality: '画質', sharpen: '高画質化', time: '* 処理時間: 15–45秒', generatingTitle: '画像を高画質化中',
        generatingDesc: 'AI が鮮明度とディテールを強化しています', resultTitle: '結果', resultDesc: '画像を処理しました',
        before: '前', after: '後', tryAgain: 'やり直す', footer: '高品質な画像ほど精度が上がります。AI生成結果には誤差が出る場合があります。',
      }
    }
    if (uiLocale === 'ko') {
      return {
        err: '오류', pasteLink: '이미지 링크를 붙여 넣어주세요.', invalidLink: '유효하지 않은 링크입니다.', notImage: '이미지 파일이 아닙니다',
        loaded: '이미지를 불러왔습니다', loadedDesc: '링크 이미지가 추가되었습니다.', cannotLoad: '이미지를 불러올 수 없습니다',
        cannotLoadDesc: 'CORS 차단일 수 있습니다. 직접 업로드해 주세요.', pasted: '이미지를 붙여넣었습니다', pastedDesc: '클립보드 이미지가 추가되었습니다.',
        uploadNeed: '선명화할 이미지를 업로드해 주세요.', failed: '선명화 실패', success: '성공', successDesc: '이미지가 선명화되었습니다.',
        title: '이미지 선명화', subtitle: 'AI로 선명도를 높이고 흐림을 줄입니다. 1.5–3 크레딧/장.',
        uploadCard: '선명화할 이미지 업로드', uploadDesc: '이미지 선택, 붙여넣기(Ctrl+V), 링크 붙여넣기 지원.',
        chooseOrPaste: '이미지를 선택하거나 붙여넣기(Ctrl+V)', reselect: '다시 선택', pasteLinkInput: '이미지 링크를 붙여넣고 가져오기를 누르세요',
        fetching: '불러오는 중...', fetchImage: '가져오기', options: '옵션', optionsDesc: '추가 요청 및 출력 화질.',
        extraReq: '추가 요청', extraPlaceholder: '예: 얼굴/텍스트를 우선 선명화...',
        quality: '이미지 품질', sharpen: '선명화', time: '* 처리 시간: 15–45초', generatingTitle: '이미지를 선명화하는 중',
        generatingDesc: 'AI가 선명도와 디테일을 강화하고 있습니다', resultTitle: '선명화 결과', resultDesc: '이미지 처리가 완료되었습니다',
        before: '전', after: '후', tryAgain: '다시 시도', footer: '이미지가 선명할수록 정확도가 높습니다. AI 결과에는 오류가 있을 수 있습니다.',
      }
    }
    if (uiLocale === 'en') {
      return {
        err: 'Error', pasteLink: 'Please paste an image URL.', invalidLink: 'Invalid URL.', notImage: 'Not an image',
        loaded: 'Image loaded', loadedDesc: 'Image from URL was added.', cannotLoad: 'Cannot load image',
        cannotLoadDesc: 'The URL may be blocked by CORS. Please upload directly.', pasted: 'Image pasted', pastedDesc: 'Image from clipboard was added.',
        uploadNeed: 'Please upload an image to sharpen.', failed: 'Sharpen failed', success: 'Success!', successDesc: 'Image has been sharpened.',
        title: 'Image Sharpen', subtitle: 'Increase sharpness and reduce blur with AI. 1.5–3 credits/image.',
        uploadCard: 'Upload image to sharpen', uploadDesc: 'Choose an image, paste one (Ctrl+V), or paste an image URL.',
        chooseOrPaste: 'Choose image or paste (Ctrl+V)', reselect: 'Select again', pasteLinkInput: 'Paste image URL then click Fetch',
        fetching: 'Loading...', fetchImage: 'Fetch image', options: 'Options', optionsDesc: 'Extra requirements and output quality.',
        extraReq: 'Extra requirements', extraPlaceholder: 'Example: prioritize face/text sharpening...',
        quality: 'Image quality', sharpen: 'Sharpen', time: '* Time: 15–45s', generatingTitle: 'Sharpening image',
        generatingDesc: 'AI is improving sharpness and detail', resultTitle: 'Sharpen result', resultDesc: 'Image has been processed',
        before: 'Before', after: 'After', tryAgain: 'Try again', footer: 'Sharper source images produce better results. AI output may contain errors.',
      }
    }
    return {
      err: 'Lỗi', pasteLink: 'Vui lòng dán link ảnh.', invalidLink: 'Link không hợp lệ.', notImage: 'Không phải ảnh',
      loaded: 'Đã tải ảnh', loadedDesc: 'Ảnh từ link đã được thêm.', cannotLoad: 'Không tải được ảnh',
      cannotLoadDesc: 'Link có thể bị chặn CORS. Thử tải ảnh lên trực tiếp.', pasted: 'Đã dán ảnh', pastedDesc: 'Ảnh từ clipboard đã được thêm.',
      uploadNeed: 'Vui lòng tải lên ảnh cần làm nét.', failed: 'Làm nét thất bại', success: 'Thành công!', successDesc: 'Ảnh đã được làm nét.',
      title: 'Làm nét ảnh', subtitle: 'Tăng độ sắc nét, giảm mờ với AI. 1,5–3 credits/ảnh.',
      uploadCard: 'Tải ảnh cần làm nét', uploadDesc: 'Chọn ảnh, dán ảnh (Ctrl+V) hoặc dán link ảnh.',
      chooseOrPaste: 'Chọn ảnh hoặc dán ảnh (Ctrl+V)', reselect: 'Chọn lại', pasteLinkInput: 'Dán link ảnh rồi bấm Lấy ảnh',
      fetching: 'Đang tải...', fetchImage: 'Lấy ảnh', options: 'Tùy chọn', optionsDesc: 'Yêu cầu thêm và chất lượng xuất ảnh.',
      extraReq: 'Yêu cầu thêm', extraPlaceholder: 'Ví dụ: ưu tiên làm nét khuôn mặt, văn bản, chữ...',
      quality: 'Chất lượng ảnh', sharpen: 'Làm nét', time: '* Thời gian: 15–45 giây', generatingTitle: 'Đang làm nét ảnh',
      generatingDesc: 'AI đang tăng độ sắc nét và chi tiết để ảnh rõ ràng hơn', resultTitle: 'Kết quả làm nét', resultDesc: 'Ảnh đã được xử lý.',
      before: 'Trước', after: 'Sau', tryAgain: 'Thử lại', footer: 'Ảnh càng nét càng chính xác. Ảnh do AI tạo có thể có sai sót.',
    }
  }, [uiLocale])

  useEffect(() => {
    setUiLocale(getWebLocaleFromCookie())
  }, [])

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setImageFromFile(file, setImage)
  }

  const handleFetchFromUrl = async () => {
    const url = imageUrl.trim()
    if (!url) {
      toast({ title: t.err, description: t.pasteLink, variant: 'destructive' })
      return
    }
    if (!/^https?:\/\//i.test(url)) {
      toast({ title: t.err, description: t.invalidLink, variant: 'destructive' })
      return
    }
    setUrlLoading(true)
    try {
      const res = await fetch(url, { mode: 'cors' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      if (!blob.type.startsWith('image/')) throw new Error(t.notImage)
      const file = new File([blob], 'image-from-url.png', { type: blob.type || 'image/png' })
      setImageFromFile(file, setImage)
      setImageUrl('')
      toast({ title: t.loaded, description: t.loadedDesc, duration: 2000 })
    } catch {
      toast({
        title: t.cannotLoad,
        description: t.cannotLoadDesc,
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
            toast({ title: t.pasted, description: t.pastedDesc, duration: 2000 })
          }
          break
        }
      }
    }
    document.addEventListener('paste', fn)
    return () => document.removeEventListener('paste', fn)
  }, [step, t.pasted, t.pastedDesc, toast])

  const handleSubmit = async () => {
    if (!image.file) {
      toast({ title: t.err, description: t.uploadNeed, variant: 'destructive' })
      return
    }
    setStep('GENERATING')
    const formData = new FormData()
    formData.append('image', image.file)
    formData.append('imageQuality', imageQuality)
    formData.append('note', note)
    const result = await sharpenImage(formData)
    if (result.error) {
      setStep('UPLOAD')
      toast({ title: t.failed, description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      await preloadImageUrl(result.resultUrl)
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      toast({ title: t.success, description: t.successDesc, duration: 3000 })
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
          <h1 className="text-2xl font-bold text-foreground">{t.title}</h1>
          <p className="text-muted-foreground mt-1">{t.subtitle}</p>
        </div>

        {step === 'UPLOAD' && (
          <div className="grid lg:grid-cols-[1fr_200px] gap-4 items-start">
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-amber-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="h-4 w-4 text-amber-600" /> {t.uploadCard}
                  </CardTitle>
                  <CardDescription className="text-xs">{t.uploadDesc}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <div className="rounded-lg">
                    <label
                      htmlFor="lam-net-input"
                      className="block w-full aspect-[4/3] max-h-[400px] rounded-lg border-2 border-dashed border-amber-200 bg-amber-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-amber-300 hover:bg-amber-50/80 transition-colors"
                    >
                      {image.preview ? (
                        <ImagePreview src={image.preview} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                      ) : (
                        <>
                          <Upload className="h-12 w-12 text-amber-500" />
                          <p className="text-sm text-muted-foreground font-medium">{t.chooseOrPaste}</p>
                        </>
                      )}
                    </label>
                  </div>
                  {image.preview && (
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors -mt-1">
                      <RefreshCw className="h-3.5 w-3.5" /> {t.reselect}
                    </button>
                  )}
                  <input
                    id="lam-net-input"
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder={t.pasteLinkInput}
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleFetchFromUrl}
                      disabled={urlLoading}
                      className="shrink-0 border-amber-200 text-amber-700 hover:bg-amber-50"
                    >
                      <Link2 className="mr-2 h-4 w-4" />
                      {urlLoading ? t.fetching : t.fetchImage}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="lg:w-[200px] lg:shrink-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-amber-200/60 h-full">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">{t.options}</CardTitle>
                  <CardDescription className="text-xs">{t.optionsDesc}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.extraReq}</h4>
                    <Textarea
                      placeholder={t.extraPlaceholder}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="bg-white/80 text-xs h-20 min-h-[80px] resize-y"
                    />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.quality}</h4>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setImageQuality('2K')}
                        className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                          imageQuality === '2K'
                            ? 'border-amber-500 bg-amber-50 text-amber-800'
                            : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        2K (1,5)
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageQuality('4K')}
                        className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                          imageQuality === '4K'
                            ? 'border-amber-500 bg-amber-50 text-amber-800'
                            : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        4K (3)
                      </button>
                    </div>
                  </div>
                  <div className="pt-4 border-t space-y-2 flex flex-col items-center">
                    <DepositCreditButton
                      variant="outline"
                      size="sm"
                      className="w-full max-w-[180px] border-amber-200 text-amber-700 hover:bg-amber-50"
                    />
                    <Button
                      onClick={() => checkCreditsAndProceed(cost, handleSubmit)}
                      disabled={!image.file}
                      className="w-full max-w-[180px] h-9 shadow-md hover:shadow-lg transition-all text-sm bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> {t.sharpen} ({imageQuality === '2K' ? '1,5' : '3'} credit)
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground mt-2">{t.time}</p>
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
                mode="sharpen"
                title={t.generatingTitle}
                description={t.generatingDesc}
                imagePreview={image.preview}
              />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>{t.resultTitle}</CardTitle>
              <CardDescription>{t.resultDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {image.preview ? (
                <BeforeAfterResultDisplay
                  beforeSrc={image.preview}
                  afterSrc={resultUrl}
                  beforeAlt={t.before}
                  afterAlt={t.after}
                  beforeHeader={<h3 className="text-sm font-medium text-muted-foreground">{t.before}</h3>}
                  afterHeader={
                    <div className="flex w-full flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-medium text-muted-foreground">{t.after}</h3>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={handleReset}>
                          <RefreshCw className="mr-2 h-3 w-3" /> {t.tryAgain}
                        </Button>
                        <DownloadImageButton
                          imageUrl={resultUrl}
                          filename="lam-net-result"
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700 text-white border-0"
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
      <p className="text-xs text-muted-foreground text-center mt-6">{t.footer}</p>
    </>
  )
}
