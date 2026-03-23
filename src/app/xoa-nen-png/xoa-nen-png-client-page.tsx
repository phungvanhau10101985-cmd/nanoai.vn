'use client'

import { useState, useRef, ChangeEvent, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { removeBackgroundToTransparentPng } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, RefreshCw, Link2 } from 'lucide-react'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { ImagePreview } from '@/components/ui/image-preview'
import { ImageProcessingLoader } from '@/components/image-processing-loader'
import { DownloadImageButton } from '@/components/download-image-button'

type Step = 'UPLOAD' | 'SOURCE_SELECT' | 'GENERATING' | 'RESULT'

type SourceImage = { url: string; label: string }
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

export default function XoaNenPngClientPage() {
  const searchParams = useSearchParams()
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [step, setStep] = useState<Step>('UPLOAD')
  const [sourceImages, setSourceImages] = useState<SourceImage[] | null>(null)
  const [image, setImage] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [imageUrl, setImageUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cost = 1.5
  const t = useMemo(() => {
    if (uiLocale === 'zh') {
      return {
        err: '错误', pasteLink: '请粘贴图片链接。', invalidLink: '链接无效。', notImage: '不是图片',
        loaded: '图片已加载', loadedDesc: '已添加来自链接的图片。', cannotLoad: '无法加载图片',
        cannotLoadDesc: '链接可能被 CORS 阻止。请直接上传图片。', pasted: '已粘贴图片', pastedDesc: '已添加剪贴板图片。',
        uploadNeed: '请上传要抠图的图片。', failed: '抠图失败', success: '成功！', successDesc: '透明背景 PNG 已准备好。',
        title: '在线抠图导出透明 PNG', subtitle: '精准分离主体，保留自然边缘，输出透明 PNG（Alpha）。',
        uploadCard: '上传需要抠图的图片', uploadDesc: '可选择图片、粘贴图片（Ctrl+V）或粘贴链接。',
        chooseOrPaste: '选择图片或粘贴图片（Ctrl+V）', reselect: '重新选择', pasteLinkInput: '粘贴链接后点击获取图片',
        fetching: '加载中...', fetchImage: '获取图片',         options: '选项', optionsDesc: '每张 1.5 积分。',
        quality: '图片质量', removeBg: '抠图', pngOut: '* 输出透明 PNG', generatingTitle: '正在抠图导出 PNG',
        generatingDesc: 'AI 正在生成前景遮罩并导出透明背景 PNG', resultTitle: '透明 PNG 结果', resultDesc: '抠图处理完成。',
        before: '之前', after: '之后（PNG Alpha）', tryAgain: '重试', downloadPng: '下载 PNG',
        fromBaoBiTitle: '从包装设计选择图片', fromBaoBiDesc: '选择要抠图的平面图。每张 1.5 credits。',
        uploadOther: '上传其他图片',
        footer: '透明 PNG 适合电商、设计和社媒发布场景。',
      }
    }
    if (uiLocale === 'ja') {
      return {
        err: 'エラー', pasteLink: '画像リンクを貼り付けてください。', invalidLink: '無効なリンクです。', notImage: '画像ではありません',
        loaded: '画像を読み込みました', loadedDesc: 'リンク画像を追加しました。', cannotLoad: '画像を読み込めません',
        cannotLoadDesc: 'CORS によりブロックされた可能性があります。直接アップロードしてください。', pasted: '画像を貼り付けました', pastedDesc: 'クリップボード画像を追加しました。',
        uploadNeed: '背景を削除する画像をアップロードしてください。', failed: '背景削除に失敗しました', success: '成功', successDesc: '透過 PNG の準備ができました。',
        title: 'オンライン背景削除（透過 PNG）', subtitle: '被写体を高精度に切り抜き、自然なエッジで透過 PNG を出力します。',
        uploadCard: '背景削除する画像をアップロード', uploadDesc: '画像選択・貼り付け（Ctrl+V）・リンク貼り付けに対応。',
        chooseOrPaste: '画像を選択または貼り付け（Ctrl+V）', reselect: '再選択', pasteLinkInput: '画像リンクを貼って「取得」を押してください',
        fetching: '読み込み中...', fetchImage: '画像を取得',         options: 'オプション', optionsDesc: '1枚 1.5 クレジット。',
        quality: '画質', removeBg: '背景削除', pngOut: '* 透過 PNG を出力', generatingTitle: '透過 PNG を生成中',
        generatingDesc: 'AI がマスクを作成して透過 PNG を出力しています', resultTitle: '透過 PNG 結果', resultDesc: '背景削除が完了しました。',
        before: '前', after: '後（PNG アルファ）', tryAgain: 'やり直す', downloadPng: 'PNG ダウンロード',
        fromBaoBiTitle: '包装デザインから選択', fromBaoBiDesc: '背景削除する平面図を選択。1枚 1.5 credits。',
        uploadOther: '他の画像をアップロード',
        footer: '透過 PNG は合成、デザイン、EC 掲載に最適です。',
      }
    }
    if (uiLocale === 'ko') {
      return {
        err: '오류', pasteLink: '이미지 링크를 붙여 넣어주세요.', invalidLink: '유효하지 않은 링크입니다.', notImage: '이미지 파일이 아닙니다',
        loaded: '이미지를 불러왔습니다', loadedDesc: '링크 이미지가 추가되었습니다.', cannotLoad: '이미지를 불러올 수 없습니다',
        cannotLoadDesc: 'CORS 차단일 수 있습니다. 직접 업로드해 주세요.', pasted: '이미지를 붙여넣었습니다', pastedDesc: '클립보드 이미지가 추가되었습니다.',
        uploadNeed: '배경 제거할 이미지를 업로드해 주세요.', failed: '배경 제거 실패', success: '성공', successDesc: '투명 배경 PNG가 준비되었습니다.',
        title: '온라인 배경 제거 (투명 PNG)', subtitle: '피사체를 정확히 분리하고 자연스러운 경계를 유지해 투명 PNG를 출력합니다.',
        uploadCard: '배경 제거할 이미지 업로드', uploadDesc: '이미지 선택, 붙여넣기(Ctrl+V), 링크 붙여넣기 지원.',
        chooseOrPaste: '이미지를 선택하거나 붙여넣기(Ctrl+V)', reselect: '다시 선택', pasteLinkInput: '이미지 링크를 붙여넣고 가져오기를 누르세요',
        fetching: '불러오는 중...', fetchImage: '가져오기',         options: '옵션', optionsDesc: '1장 1.5 크레딧.',
        quality: '이미지 품질', removeBg: '배경 제거', pngOut: '* 투명 PNG 출력', generatingTitle: 'PNG 배경 제거 중',
        generatingDesc: 'AI가 마스크를 생성해 투명 PNG를 출력하고 있습니다', resultTitle: '투명 PNG 결과', resultDesc: '배경 제거가 완료되었습니다.',
        before: '전', after: '후 (PNG 알파)', tryAgain: '다시 시도', downloadPng: 'PNG 다운로드',
        fromBaoBiTitle: '패키징 디자인에서 선택', fromBaoBiDesc: '배경 제거할 평면 디자인 선택. 1장당 1.5 credits.',
        uploadOther: '다른 이미지 업로드',
        footer: '투명 PNG는 합성, 디자인, 쇼핑몰 등록에 적합합니다.',
      }
    }
    if (uiLocale === 'en') {
      return {
        err: 'Error', pasteLink: 'Please paste an image URL.', invalidLink: 'Invalid URL.', notImage: 'Not an image',
        loaded: 'Image loaded', loadedDesc: 'Image from URL was added.', cannotLoad: 'Cannot load image',
        cannotLoadDesc: 'The URL may be blocked by CORS. Please upload directly.', pasted: 'Image pasted', pastedDesc: 'Image from clipboard was added.',
        uploadNeed: 'Please upload an image to remove background.', failed: 'Background removal failed', success: 'Success!', successDesc: 'Transparent PNG is ready.',
        title: 'Remove Background Online to Transparent PNG', subtitle: 'Accurate subject extraction, natural edges, and ready-to-use alpha PNG output.',
        uploadCard: 'Upload image for background removal', uploadDesc: 'Choose an image, paste one (Ctrl+V), or paste an image URL.',
        chooseOrPaste: 'Choose image or paste (Ctrl+V)', reselect: 'Select again', pasteLinkInput: 'Paste image URL then click Fetch',
        fetching: 'Loading...', fetchImage: 'Fetch image',         options: 'Options', optionsDesc: '1.5 credits per image.',
        quality: 'Image quality', removeBg: 'Remove BG', pngOut: '* Output transparent PNG', generatingTitle: 'Generating transparent PNG',
        generatingDesc: 'AI is building a foreground mask and exporting transparent PNG', resultTitle: 'Transparent PNG result', resultDesc: 'Background removal completed.',
        before: 'Before', after: 'After (PNG alpha)', tryAgain: 'Try again', downloadPng: 'Download PNG',
        fromBaoBiTitle: 'Select from packaging design', fromBaoBiDesc: 'Choose flat designs to remove background. 1.5 credits/image.',
        uploadOther: 'Upload other image',
        footer: 'Transparent PNG is ideal for compositing, design, and e-commerce listings.',
      }
    }
    return {
      err: 'Lỗi', pasteLink: 'Vui lòng dán link ảnh.', invalidLink: 'Link không hợp lệ.', notImage: 'Không phải ảnh',
      loaded: 'Đã tải ảnh', loadedDesc: 'Ảnh từ link đã được thêm.', cannotLoad: 'Không tải được ảnh',
      cannotLoadDesc: 'Link có thể bị chặn CORS. Thử tải ảnh lên trực tiếp.', pasted: 'Đã dán ảnh', pastedDesc: 'Ảnh từ clipboard đã được thêm.',
      uploadNeed: 'Vui lòng tải lên ảnh cần xóa nền.', failed: 'Xóa nền thất bại', success: 'Thành công!', successDesc: 'Ảnh PNG nền trong suốt đã sẵn sàng.',
      title: 'Xóa nền ảnh online ra PNG trong suốt', subtitle: 'Tách chủ thể chính xác, giữ viền tự nhiên và trả PNG alpha để dùng ngay cho TMĐT, thiết kế, social.',
      uploadCard: 'Tải ảnh cần xóa nền', uploadDesc: 'Chọn ảnh, dán ảnh (Ctrl+V) hoặc dán link ảnh.',
      chooseOrPaste: 'Chọn ảnh hoặc dán ảnh (Ctrl+V)', reselect: 'Chọn lại', pasteLinkInput: 'Dán link ảnh rồi bấm Lấy ảnh',
      fetching: 'Đang tải...', fetchImage: 'Lấy ảnh',       options: 'Tùy chọn', optionsDesc: '1,5 credits/ảnh.',
      quality: 'Chất lượng ảnh', removeBg: 'Xóa nền', pngOut: '* Trả ảnh PNG nền trong suốt', generatingTitle: 'Đang tách nền PNG',
      generatingDesc: 'AI đang tạo mask và xuất ảnh nền trong suốt (alpha)', resultTitle: 'Kết quả PNG trong suốt', resultDesc: 'Ảnh đã được tách nền thành công.',
      before: 'Trước', after: 'Sau (PNG alpha)', tryAgain: 'Thử lại', downloadPng: 'Tải PNG',
      fromBaoBiTitle: 'Chọn từ thiết kế bao bì', fromBaoBiDesc: 'Chọn ảnh phẳng cần tách nền. Mỗi ảnh 1,5 credits.',
      uploadOther: 'Tải ảnh khác',
      footer: 'Ảnh PNG trong suốt phù hợp để ghép nền, thiết kế và đăng sản phẩm lên sàn TMĐT.',
    }
  }, [uiLocale])

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

  useEffect(() => {
    if (searchParams.get('from') === 'bao-bi' && typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem('xoa_nen_source_images')
        if (raw) {
          const parsed = JSON.parse(raw) as SourceImage[]
          if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((p) => p?.url && typeof p.url === 'string')) {
            setSourceImages(parsed)
            setStep('SOURCE_SELECT')
          }
        }
      } catch {
        /* ignore */
      }
    }
  }, [searchParams])

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
  }, [step, toast])

  const handleSubmit = async () => {
    if (!image.file) {
      toast({ title: t.err, description: t.uploadNeed, variant: 'destructive' })
      return
    }
    setStep('GENERATING')
    const formData = new FormData()
    formData.append('image', image.file)
    const result = await removeBackgroundToTransparentPng(formData)
    if (result.error) {
      setStep('UPLOAD')
      toast({ title: t.failed, description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      toast({ title: t.success, description: t.successDesc, duration: 3000 })
    }
  }

  const handleReset = () => {
    setStep(sourceImages ? 'SOURCE_SELECT' : 'UPLOAD')
    setImage({ file: null, preview: null })
    setResultUrl(null)
  }

  const handleProcessSourceImage = async (item: SourceImage) => {
    setUrlLoading(true)
    try {
      const res = await fetch(item.url, { mode: 'cors' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      if (!blob.type.startsWith('image/')) throw new Error(t.notImage)
      const file = new File([blob], `flat-${item.label.replace(/\s+/g, '-')}.png`, { type: blob.type || 'image/png' })
      setImage({ file, preview: item.url })
      setStep('GENERATING')
      const formData = new FormData()
      formData.append('image', file)
      const result = await removeBackgroundToTransparentPng(formData)
      if (result.error) {
        setStep('SOURCE_SELECT')
        toast({ title: t.failed, description: result.error, variant: 'destructive', duration: 5000 })
      } else if (result.success && result.resultUrl) {
        setResultUrl(result.resultUrl)
        setStep('RESULT')
        toast({ title: t.success, description: t.successDesc, duration: 3000 })
      }
    } catch {
      toast({ title: t.cannotLoad, description: t.cannotLoadDesc, variant: 'destructive', duration: 5000 })
      setStep('SOURCE_SELECT')
    } finally {
      setUrlLoading(false)
    }
  }

  const handleProcessSourceWithCredits = (item: SourceImage) => {
    checkCreditsAndProceed(cost, () => handleProcessSourceImage(item))
  }

  return (
    <>
      <Toaster />
      <div className="tool-page-container">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">{t.title}</h1>
          <p className="text-muted-foreground mt-1">{t.subtitle}</p>
        </div>

        {step === 'SOURCE_SELECT' && sourceImages && sourceImages.length > 0 && (
          <div className="grid lg:grid-cols-[1fr_220px] gap-4 items-start">
            <Card className="border shadow-sm bg-white/80 backdrop-blur border-teal-200/60">
              <CardHeader>
                <CardTitle className="text-base">{t.fromBaoBiTitle}</CardTitle>
                <CardDescription>{t.fromBaoBiDesc}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {sourceImages.map((item, i) => (
                    <div key={i} className="space-y-1">
                      <div className="w-full aspect-square rounded border bg-muted/30 overflow-hidden">
                        <ImagePreview src={item.url} alt={item.label} className="w-full h-full" asImg />
                      </div>
                      <p className="text-xs font-medium text-muted-foreground truncate">{item.label}</p>
                      <Button
                        size="sm"
                        className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                        onClick={() => handleProcessSourceWithCredits(item)}
                        disabled={urlLoading}
                      >
                        <Sparkles className="mr-2 h-3.5 w-3.5" />
                        {t.removeBg} (1,5 credit)
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="border shadow-sm bg-white/80 backdrop-blur border-teal-200/60 h-fit">
              <CardContent className="p-4 space-y-2">
                <DepositCreditButton variant="outline" size="sm" className="w-full border-teal-200 text-teal-700 hover:bg-teal-50" />
                <Button variant="outline" size="sm" className="w-full" onClick={() => { setSourceImages(null); setStep('UPLOAD') }}>
                  {t.uploadOther}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'UPLOAD' && (
          <div className="grid lg:grid-cols-[1fr_220px] gap-4 items-start">
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-teal-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="h-4 w-4 text-teal-600" /> {t.uploadCard}
                  </CardTitle>
                  <CardDescription className="text-xs">{t.uploadDesc}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <div className="rounded-lg">
                    <label
                      htmlFor="xoa-nen-input"
                      className="block w-full aspect-[4/3] max-h-[420px] rounded-lg border-2 border-dashed border-teal-200 bg-teal-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-teal-300 hover:bg-teal-50/80 transition-colors"
                    >
                      {image.preview ? (
                        <ImagePreview src={image.preview} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                      ) : (
                        <>
                          <Upload className="h-12 w-12 text-teal-500" />
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
                    id="xoa-nen-input"
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
                      className="shrink-0 border-teal-200 text-teal-700 hover:bg-teal-50"
                    >
                      <Link2 className="mr-2 h-4 w-4" />
                      {urlLoading ? t.fetching : t.fetchImage}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="lg:w-[220px] lg:shrink-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-teal-200/60 h-full">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">{t.options}</CardTitle>
                  <CardDescription className="text-xs">{t.optionsDesc}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="pt-2 space-y-2 flex flex-col items-center">
                    <DepositCreditButton
                      variant="outline"
                      size="sm"
                      className="w-full max-w-[180px] border-teal-200 text-teal-700 hover:bg-teal-50"
                    />
                    <Button
                      onClick={() => checkCreditsAndProceed(cost, handleSubmit)}
                      disabled={!image.file}
                      className="w-full max-w-[180px] h-9 shadow-md hover:shadow-lg transition-all text-sm bg-teal-600 hover:bg-teal-700 text-white"
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> {t.removeBg} (1,5 credit)
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground mt-2">{t.pngOut}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === 'GENERATING' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-teal-200/60">
            <CardContent className="flex flex-col items-center py-8">
              <ImageProcessingLoader
                mode="eraser"
                title={t.generatingTitle}
                description={t.generatingDesc}
                steps={['Phân đoạn chủ thể', 'Tạo mask trắng/đen', 'Ghép alpha bằng Python PIL', 'Xuất PNG trong suốt']}
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
            <CardContent className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">{t.before}</h3>
                {image.preview && (
                  <div className="aspect-square rounded-lg border overflow-hidden">
                    <ImagePreview src={image.preview} alt={t.before} className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground">{t.after}</h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleReset}>
                      <RefreshCw className="mr-2 h-3 w-3" /> {t.tryAgain}
                    </Button>
                    <DownloadImageButton
                      imageUrl={resultUrl}
                      filename="xoa-nen-png-result"
                      size="sm"
                      className="bg-teal-600 hover:bg-teal-700 text-white border-0"
                      printReady
                      printReadyInferFromImage
                    />
                  </div>
                </div>
                <div className="aspect-square rounded-lg border overflow-hidden bg-[linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%,#eee),linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%,#eee)] bg-[length:24px_24px] bg-[position:0_0,12px_12px]">
                  <ImagePreview src={resultUrl} alt={t.after} className="w-full h-full object-contain" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">{t.footer}</p>
    </>
  )
}
