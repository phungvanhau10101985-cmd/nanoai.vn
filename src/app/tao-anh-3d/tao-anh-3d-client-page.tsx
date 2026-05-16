'use client'

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

import { useState, useRef, ChangeEvent, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { create3DMockup } from './actions'
import { getDictionary } from '@/lib/i18n/dictionaries'
import {
  finalizeStandardImageGenerationResult,
  waitForNextPaintClient,
} from '@/lib/client/finalize-standard-image-generation-result'

import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, RefreshCw, Link2, Box, ImageIcon, Tag } from 'lucide-react'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { DownloadImageButton } from '@/components/download-image-button'
import { ImagePreview } from '@/components/ui/image-preview'
import { BeforeAfterResultDisplay } from '@/components/image-tools/before-after-result-display'
import { ImageProcessingLoader } from '@/components/image-processing-loader'

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

export default function TaoAnh3DClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [step, setStep] = useState<Step>('UPLOAD')
  const [productImage, setProductImage] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [logoImage, setLogoImage] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const [note, setNote] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlTarget, setUrlTarget] = useState<'product' | 'logo'>('product')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const productInputRef = useRef<HTMLInputElement>(null)
  const cost = imageQuality === '2K' ? 1.5 : 3
  const logoInputRef = useRef<HTMLInputElement>(null)
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  const genClient = useMemo(() => getDictionary(uiLocale).imageGenerationClient, [uiLocale])

  const pastedTitle = tr('Đã dán ảnh', 'Image pasted', '已粘贴图片', '画像を貼り付けました', '이미지 붙여넣음')
  const pastedDesc = tr(
    'Ảnh 2 đã được thêm.',
    'Image 2 has been added.',
    '已添加图 2。',
    '画像2を追加しました。',
    '이미지 2가 추가되었습니다.'
  )

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

  const handleProductChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setImageFromFile(file, (v) => setProductImage({ file: v.file, preview: v.preview }))
  }

  const handleLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setImageFromFile(file, (v) => setLogoImage({ file: v.file, preview: v.preview }))
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
      if (urlTarget === 'product') {
        setImageFromFile(file, (v) => setProductImage({ file: v.file, preview: v.preview }))
      } else {
        setImageFromFile(file, (v) => setLogoImage({ file: v.file, preview: v.preview }))
      }
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
          if (file && setImageFromFile(file, (v) => setLogoImage({ file: v.file, preview: v.preview }))) {
            e.preventDefault()
            toast({ title: pastedTitle, description: pastedDesc, duration: 2000 })
          }
          break
        }
      }
    }
    document.addEventListener('paste', fn)
    return () => document.removeEventListener('paste', fn)
  }, [pastedDesc, pastedTitle, step, toast])

  const canSubmit = logoImage.file && !!productImage.file

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Cần ảnh sản phẩm và ảnh/logo in lên sản phẩm.', 'Need product image and logo/image to print on product.', '需要产品图片和印在产品上的 Logo/图片。', '商品画像と印刷用のロゴ/画像が必要です。', '제품 이미지와 인쇄할 로고/이미지가 필요합니다.'), variant: 'destructive' })
      return
    }
    setStep('GENERATING')
    await waitForNextPaintClient()
    const formData = new FormData()
    formData.append('productImage', productImage.file!)
    formData.append('logoImage', logoImage.file!)
    formData.append('imageQuality', imageQuality)
    formData.append('note', note)
    try {
      const result = await create3DMockup(formData)
      await finalizeStandardImageGenerationResult(result, {
        onServerErrorMessage: (message) => {
          setStep('UPLOAD')
          toast({
            title: tr('Tạo mockup thất bại', 'Create mockup failed', '创建模型失败', 'モックアップ作成に失敗しました', '목업 생성 실패'),
            description: message,
            variant: 'destructive',
            duration: 5000,
          })
        },
        onSuccessWithUrl: (url) => {
          setResultUrl(url)
          setStep('RESULT')
          toast({
            title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'),
            description: tr('Đã tạo ảnh 3D mockup.', '3D mockup created.', '已创建 3D 模型图。', '3Dモックアップを作成しました。', '3D 목업이 생성되었습니다.'),
            duration: 3000,
          })
        },
        onUnexpectedPayload: () => {
          setStep('UPLOAD')
          toast({
            title: tr('Tạo mockup thất bại', 'Create mockup failed', '创建模型失败', 'モックアップ作成に失敗しました', '목업 생성 실패'),
            description: genClient.unexpectedNoUrl,
            variant: 'destructive',
            duration: 6000,
          })
        },
      })
    } catch (e) {
      setStep('UPLOAD')
      toast({
        title: tr('Tạo mockup thất bại', 'Create mockup failed', '创建模型失败', 'モックアップ作成に失敗しました', '목업 생성 실패'),
        description: e instanceof Error ? e.message : genClient.clientFault,
        variant: 'destructive',
        duration: 6000,
      })
    }
  }

  const handleReset = () => {
    setStep('UPLOAD')
    setProductImage({ file: null, preview: null })
    setLogoImage({ file: null, preview: null })
    setNote('')
    setResultUrl(null)
  }

  return (
    <>
      <Toaster />
      <div className="tool-page-container">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
            <Box className="h-8 w-8 text-cyan-600" /> {tr('Tạo ảnh 3D (Mockup sản phẩm)', 'Create 3D image (Product mockup)', '创建 3D 图片（产品模型）', '3D画像を作成（商品モックアップ）', '3D 이미지 만들기 (제품 목업)')}
          </h1>
          <p className="text-muted-foreground mt-1">{tr('Ảnh 1: Sản phẩm. Ảnh 2: Logo hoặc ảnh in lên sản phẩm. 1,5–3 credits/ảnh.', 'Image 1: Product. Image 2: Logo or image to print on product. 1.5–3 credits/image.', '图 1：产品。图 2：印在产品上的 Logo 或图片。1.5–3 积分/张。', '画像1：商品。画像2：商品に印刷するロゴまたは画像。1.5〜3クレジット/枚。', '이미지 1: 제품. 이미지 2: 제품에 인쇄할 로고 또는 이미지. 1.5–3 크레딧/장.')}</p>
        </div>

        {step === 'UPLOAD' && (
          <div className="grid lg:grid-cols-[1fr_200px] gap-4 items-start">
            <div className="min-w-0 space-y-4">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-cyan-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ImageIcon className="h-4 w-4 text-cyan-600" /> {tr('Ảnh 1: Ảnh sản phẩm', 'Image 1: Product image', '图 1：产品图片', '画像1：商品画像', '이미지 1: 제품 이미지')}
                  </CardTitle>
                  <CardDescription className="text-xs">{tr('Ảnh sản phẩm của bạn (điện thoại, cốc, hộp...). Logo hoặc ảnh sẽ in lên đây.', 'Use your product image (phone, cup, box...). Logo or image will be printed here.', '使用你的产品图（手机、杯子、盒子...）。Logo 或图片将印在这里。', '商品画像（スマホ・カップ・箱など）を使用。ここにロゴまたは画像を印刷します。', '제품 이미지(폰, 컵, 박스 등)를 사용하세요. 여기에 로고 또는 이미지가 인쇄됩니다.')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <label
                      htmlFor="product-input"
                      className="block w-full aspect-[4/3] max-h-[220px] rounded-lg border-2 border-dashed border-cyan-200 bg-cyan-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-cyan-300"
                    >
                      {productImage.preview ? (
                        <ImagePreview src={productImage.preview} alt={tr('Sản phẩm', 'Product', '产品', '商品', '제품')} className="w-full h-full object-contain rounded-lg" />
                      ) : (
                        <>
                          <Upload className="h-10 w-10 text-cyan-500" />
                          <p className="text-sm text-muted-foreground">{tr('Chọn ảnh sản phẩm', 'Select product image', '选择产品图片', '商品画像を選択', '제품 이미지 선택')}</p>
                        </>
                      )}
                    </label>
                  {productImage.preview && (
                    <button type="button" onClick={() => productInputRef.current?.click()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <RefreshCw className="h-3.5 w-3.5" /> {tr('Chọn lại', 'Choose again', '重新选择', '選び直す', '다시 선택')}
                    </button>
                  )}
                  <input id="product-input" ref={productInputRef} type="file" accept="image/*" className="hidden" onChange={handleProductChange} />
                </CardContent>
              </Card>

              <Card className="border shadow-sm bg-white/80 backdrop-blur border-cyan-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Tag className="h-4 w-4 text-cyan-600" /> {tr('Ảnh 2: Logo hoặc ảnh in lên sản phẩm', 'Image 2: Logo or image to print on product', '图 2：印在产品上的 Logo 或图片', '画像2：商品に印刷するロゴまたは画像', '이미지 2: 제품에 인쇄할 로고 또는 이미지')}
                  </CardTitle>
                  <CardDescription className="text-xs">{tr('Logo, ảnh hoặc thiết kế in lên sản phẩm. Bắt buộc.', 'Logo, image or design to print on product. Required.', 'Logo、图片或设计印在产品上。必填。', 'ロゴ・画像・デザインを商品に印刷。必須です。', '로고, 이미지 또는 디자인을 제품에 인쇄. 필수입니다.')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <label
                    htmlFor="logo-input"
                    className="block w-full aspect-[4/3] max-h-[220px] rounded-lg border-2 border-dashed border-cyan-200 bg-cyan-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-cyan-300"
                  >
                    {logoImage.preview ? (
                      <ImagePreview src={logoImage.preview} alt={tr('Ảnh 2', 'Image 2', '图 2', '画像2', '이미지 2')} className="w-full h-full object-contain rounded-lg" />
                    ) : (
                      <>
                        <Upload className="h-10 w-10 text-cyan-500" />
                        <p className="text-sm text-muted-foreground">{tr('Chọn logo, ảnh hoặc thiết kế', 'Select logo, image or design', '选择 Logo、图片或设计', 'ロゴ・画像・デザインを選択', '로고, 이미지 또는 디자인 선택')}</p>
                      </>
                    )}
                  </label>
                  {logoImage.preview && (
                    <button type="button" onClick={() => logoInputRef.current?.click()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <RefreshCw className="h-3.5 w-3.5" /> {tr('Chọn lại', 'Choose again', '重新选择', '選び直す', '다시 선택')}
                    </button>
                  )}
                  <input id="logo-input" ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                </CardContent>
              </Card>

              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Yêu cầu thêm (tùy chọn)', 'Extra prompt (optional)', '附加要求（可选）', '追加要望（任意）', '추가 요청 (선택)')}</h4>
                <Input placeholder={tr('VD: nền trắng, góc nghiêng 45 độ...', 'e.g. white background, 45-degree angle...', '例如：白色背景、45度角...', '例: 白背景、45度アングル...', '예: 흰 배경, 45도 각도...')} value={note} onChange={(e) => setNote(e.target.value)} className="bg-white/80" />
              </div>
              <div className="flex gap-2">
                <select value={urlTarget} onChange={(e) => setUrlTarget(e.target.value as 'product' | 'logo')} className="px-3 py-2 rounded-md border border-gray-200 bg-white text-sm w-36">
                  <option value="product">{tr('Ảnh sản phẩm', 'Product image', '产品图片', '商品画像', '제품 이미지')}</option>
                  <option value="logo">{tr('Ảnh 2 (logo/ảnh)', 'Image 2 (logo/image)', '图 2（Logo/图片）', '画像2（ロゴ/画像）', '이미지 2 (로고/이미지)')}</option>
                </select>
                <Input placeholder={tr('Dán link ảnh rồi bấm Lấy ảnh', 'Paste image URL then click Fetch', '粘贴图片链接后点击获取', '画像URLを貼り付けて取得をクリック', '이미지 링크 붙여넣기 후 가져오기 클릭')} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="flex-1" />
                <Button type="button" variant="outline" onClick={handleFetchFromUrl} disabled={urlLoading} className="shrink-0 border-cyan-200 text-cyan-700 hover:bg-cyan-50">
                  <Link2 className="mr-2 h-4 w-4" /> {urlLoading ? tr('Đang tải...', 'Loading...', '加载中...', '読み込み中...', '불러오는 중...') : tr('Lấy ảnh', 'Fetch image', '获取图片', '画像を取得', '이미지 가져오기')}
                </Button>
              </div>
            </div>
            <div className="lg:w-[200px] lg:shrink-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-cyan-200/60 h-full">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">{tr('Tùy chọn', 'Options', '选项', 'オプション', '옵션')}</CardTitle>
                  <CardDescription className="text-xs">{tr('Chất lượng xuất ảnh.', 'Output image quality.', '输出图像质量。', '出力画像の品質。', '출력 이미지 품질.')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Chất lượng ảnh', 'Image quality', '图像质量', '画像品質', '이미지 품질')}</h4>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setImageQuality('2K')} className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${imageQuality === '2K' ? 'border-cyan-500 bg-cyan-50 text-cyan-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'}`}>2K (1,5)</button>
                      <button type="button" onClick={() => setImageQuality('4K')} className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${imageQuality === '4K' ? 'border-cyan-500 bg-cyan-50 text-cyan-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'}`}>4K (3)</button>
                    </div>
                  </div>
                  <div className="pt-4 border-t space-y-2 flex flex-col items-center">
                    <DepositCreditButton variant="outline" size="sm" className="w-full max-w-[180px] border-cyan-200 text-cyan-700 hover:bg-cyan-50" />
                    <Button onClick={() => checkCreditsAndProceed(cost, handleSubmit)} disabled={!canSubmit} className="w-full max-w-[180px] h-9 shadow-md hover:shadow-lg transition-all text-sm bg-cyan-600 hover:bg-cyan-700 text-white">
                      <Sparkles className="mr-2 h-4 w-4" /> {tr('Tạo mockup', 'Create mockup', '创建模型', 'モックアップを作成', '목업 만들기')} ({imageQuality === '2K' ? '1,5' : '3'} credit)
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground mt-2">{tr('* Thời gian: 15–45 giây', '* Time: 15–45 seconds', '* 时长：15–45 秒', '* 所要時間: 15〜45秒', '* 소요 시간: 15–45초')}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === 'GENERATING' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-cyan-200/60">
            <CardContent className="flex flex-col items-center py-8">
              <ImageProcessingLoader mode="mockup3d" title={tr('Đang tạo mockup 3D', 'Creating 3D mockup', '正在创建 3D 模型图', '3Dモックアップを作成中', '3D 목업 생성 중')} description={tr('AI đang in ảnh/logo lên sản phẩm', 'AI is applying image/logo onto product', 'AI 正在将图片/Logo 印到产品上', 'AIが商品に画像/ロゴを印刷中', 'AI가 제품에 이미지/로고를 인쇄 중')} imagePreview={logoImage.preview} />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>{tr('Kết quả', 'Result', '结果', '結果', '결과')}</CardTitle>
              <CardDescription>{tr('Đã tạo ảnh 3D mockup.', '3D mockup created.', '已创建 3D 模型图。', '3Dモックアップを作成しました。', '3D 목업이 생성되었습니다.')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {logoImage.preview ? (
                <BeforeAfterResultDisplay
                  beforeSrc={logoImage.preview}
                  afterSrc={resultUrl}
                  beforeAlt={tr('Ảnh 2', 'Image 2', '图 2', '画像2', '이미지 2')}
                  afterAlt="Mockup 3D"
                  beforeHeader={
                    <h3 className="text-sm font-medium text-muted-foreground">{tr('Ảnh 2 gốc', 'Original image 2', '原始图 2', '元画像2', '원본 이미지 2')}</h3>
                  }
                  afterHeader={
                    <div className="flex w-full flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-medium text-muted-foreground">{tr('Mockup 3D', '3D mockup', '3D 模型图', '3Dモックアップ', '3D 목업')}</h3>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={handleReset}>
                          <RefreshCw className="mr-2 h-3 w-3" /> {tr('Thử lại', 'Try again', '重试', '再試行', '다시 시도')}
                        </Button>
                        <DownloadImageButton
                          imageUrl={resultUrl}
                          filename="mockup-3d-result"
                          size="sm"
                          className="bg-cyan-600 hover:bg-cyan-700 text-white border-0"
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
      <p className="text-xs text-muted-foreground text-center mt-6">{tr('Ảnh do AI tạo có thể có sai sót.', 'AI-generated image may contain inaccuracies.', 'AI 生成的图片可能存在误差。', 'AI生成画像には誤りが含まれる場合があります。', 'AI 생성 이미지는 오류가 있을 수 있습니다.')}</p>
    </>
  )
}
