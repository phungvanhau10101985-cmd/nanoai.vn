'use client'

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

import { useState, useRef, ChangeEvent, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { replaceProductBackground } from './actions'
import { getDictionary } from '@/lib/i18n/dictionaries'
import {
  finalizeStandardImageGenerationResult,
  waitForNextPaintClient,
} from '@/lib/client/finalize-standard-image-generation-result'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, RefreshCw, Link2, Package } from 'lucide-react'
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

export default function ThayNenSanPhamClientPage() {
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
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }
  const genClient = useMemo(() => getDictionary(uiLocale).imageGenerationClient, [uiLocale])

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
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Vui lòng tải lên ảnh sản phẩm.', 'Please upload product image.', '请上传商品图片。', '商品画像をアップロードしてください。', '상품 이미지를 업로드해 주세요.'), variant: 'destructive' })
      return
    }
    setStep('GENERATING')
    await waitForNextPaintClient()
    const formData = new FormData()
    formData.append('image', image.file)
    formData.append('imageQuality', imageQuality)
    formData.append('note', note)
    try {
      const result = await replaceProductBackground(formData)
      await finalizeStandardImageGenerationResult(result, {
        onServerErrorMessage: (message) => {
          setStep('UPLOAD')
          toast({
            title: tr('Thay nền thất bại', 'Background replace failed', '换背景失败', '背景差し替えに失敗しました', '배경 변경 실패'),
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
            description: tr('Đã thay nền ảnh.', 'Product background replaced.', '商品背景已替换。', '商品背景を差し替えました。', '상품 배경이 변경되었습니다.'),
            duration: 3000,
          })
        },
        onUnexpectedPayload: () => {
          setStep('UPLOAD')
          toast({
            title: tr('Thay nền thất bại', 'Background replace failed', '换背景失败', '背景差し替えに失敗しました', '배경 변경 실패'),
            description: genClient.unexpectedNoUrl,
            variant: 'destructive',
            duration: 6000,
          })
        },
      })
    } catch (e) {
      setStep('UPLOAD')
      toast({
        title: tr('Thay nền thất bại', 'Background replace failed', '换背景失败', '背景差し替えに失敗しました', '배경 변경 실패'),
        description: e instanceof Error ? e.message : genClient.clientFault,
        variant: 'destructive',
        duration: 6000,
      })
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
            <Package className="h-8 w-8 text-amber-600" /> {tr('Thay nền ảnh', 'Replace Product Background', '商品换背景', '商品背景差し替え', '상품 배경 변경')}
          </h1>
          <p className="text-muted-foreground mt-1">{tr('Tách sản phẩm, đặt vào bối cảnh studio, bãi biển... 1,5-3 credits/ảnh.', 'Cut product and place it into new scenes. 1.5-3 credits/image.', '抠出商品并替换新场景。1.5-3 credits/张。', '商品を切り抜いて新しい背景へ。1.5-3 credits/枚。', '상품을 분리해 새 배경에 배치합니다. 1.5-3 credits/장.')}</p>
        </div>

        {step === 'UPLOAD' && (
          <div className="grid lg:grid-cols-[1fr_200px] gap-4 items-start">
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-amber-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="h-4 w-4 text-amber-600" /> {tr('Ảnh sản phẩm', 'Product image', '商品图片', '商品画像', '상품 이미지')}
                  </CardTitle>
                  <CardDescription className="text-xs">{tr('Chụp sản phẩm trên nền nhà/bàn. AI sẽ tách và đặt vào bối cảnh đẹp.', 'Product on home/table background. AI will cut out and place in nice scene.', '商品置于家中/桌面背景。AI 将抠图并放入美观场景。', '商品を家/机の上で撮影。AIが切り抜き美しい背景へ。', '상품을 집/탁자 위에서 촬영. AI가 분리해 멋진 배경에 배치합니다.')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <label
                    htmlFor="product-input"
                    className="block w-full aspect-[4/3] max-h-[400px] rounded-lg border-2 border-dashed border-amber-200 bg-amber-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-amber-300 hover:bg-amber-50/80 transition-colors"
                  >
                    {image.preview ? (
                      <ImagePreview src={image.preview} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                    ) : (
                      <>
                        <Upload className="h-12 w-12 text-amber-500" />
                        <p className="text-sm text-muted-foreground font-medium">{tr('Chọn ảnh sản phẩm', 'Select product image', '选择商品图片', '商品画像を選択', '상품 이미지 선택')}</p>
                      </>
                    )}
                  </label>
                  {image.preview && (
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <RefreshCw className="h-3.5 w-3.5" /> {tr('Chọn lại', 'Select again', '重新选择', '再選択', '다시 선택')}
                    </button>
                  )}
                  <input id="product-input" ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Bối cảnh nền (tùy chọn)', 'Background scene (optional)', '背景场景（可选）', '背景シーン（任意）', '배경 장면 (선택)')}</h4>
                    <Input placeholder={tr('VD: studio trắng, bãi biển, phòng khách...', 'e.g. white studio, beach, living room...', '例如：白色影棚、海滩、客厅...', '例：白スタジオ、ビーチ、リビング...', '예: 흰색 스튜디오, 해변, 거실...')} value={note} onChange={(e) => setNote(e.target.value)} className="bg-white/80" />
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder={tr('Dán link ảnh rồi bấm Lấy ảnh', 'Paste image URL then click Fetch', '粘贴图片链接后点击获取', '画像リンクを貼って「取得」を押す', '이미지 링크 붙여넣고 가져오기 클릭')} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="flex-1" />
                    <Button type="button" variant="outline" onClick={handleFetchFromUrl} disabled={urlLoading} className="shrink-0 border-amber-200 text-amber-700 hover:bg-amber-50">
                      <Link2 className="mr-2 h-4 w-4" /> {urlLoading ? tr('Đang tải...', 'Loading...', '加载中...', '読み込み中...', '불러오는 중...') : tr('Lấy ảnh', 'Fetch image', '获取图片', '画像を取得', '가져오기')}
                    </Button>
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
                      <button type="button" onClick={() => setImageQuality('2K')} className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${imageQuality === '2K' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'}`}>
                        2K (1,5)
                      </button>
                      <button type="button" onClick={() => setImageQuality('4K')} className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${imageQuality === '4K' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'}`}>
                        4K (3)
                      </button>
                    </div>
                  </div>
                  <div className="pt-4 border-t space-y-2 flex flex-col items-center">
                    <DepositCreditButton variant="outline" size="sm" className="w-full max-w-[180px] border-amber-200 text-amber-700 hover:bg-amber-50" />
                    <Button onClick={() => checkCreditsAndProceed(cost, handleSubmit)} disabled={!image.file} className="w-full max-w-[180px] h-9 shadow-md hover:shadow-lg transition-all text-sm bg-amber-600 hover:bg-amber-700 text-white">
                      <Sparkles className="mr-2 h-4 w-4" /> {tr('Thay nền', 'Replace background', '换背景', '背景差し替え', '배경 변경')} ({imageQuality === '2K' ? '1,5' : '3'} credit)
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
              <ImageProcessingLoader mode="product" title={tr('Đang thay nền', 'Replacing background', '正在换背景', '背景を差し替え中', '배경 변경 중')} description={tr('AI đang tách sản phẩm và đặt vào bối cảnh mới', 'AI is cutting out product and placing in new scene', 'AI 正在抠出商品并放入新场景', 'AIが商品を切り抜き新背景へ配置中', 'AI가 상품을 분리해 새 배경에 배치 중입니다')} imagePreview={image.preview} />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>{tr('Kết quả', 'Result', '结果', '結果', '결과')}</CardTitle>
              <CardDescription>{tr('Đã thay nền ảnh.', 'Product background replaced.', '商品背景已替换。', '商品背景を差し替えました。', '상품 배경이 변경되었습니다.')}</CardDescription>
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
                          filename="thay-nen-result"
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
      <p className="text-xs text-muted-foreground text-center mt-6">{tr('Ảnh do AI tạo có thể có sai sót.', 'AI-generated images may contain minor errors.', 'AI 生成结果可能存在误差。', 'AI生成結果には誤差が含まれる場合があります。', 'AI 생성 결과에는 오차가 있을 수 있습니다.')}</p>
    </>
  )
}
