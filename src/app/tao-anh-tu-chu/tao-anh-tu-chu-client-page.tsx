'use client'

import { useState, useRef, ChangeEvent, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { createImageFromText } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, RefreshCw, X } from 'lucide-react'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { DownloadImageButton } from '@/components/download-image-button'
import { ImagePreview } from '@/components/ui/image-preview'
import { ImageProcessingLoader } from '@/components/image-processing-loader'
import { preloadImageUrl } from '@/lib/preload-image-url'
import { cn } from '@/lib/utils'

type Step = 'UPLOAD' | 'GENERATING' | 'RESULT'
type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

/** Lets React paint `GENERATING` before the server action runs (see `.cursor/rules/tao-anh-tu-chu-generate-flow.mdc`). */
function waitForNextPaint(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
}

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

const IMAGE_STYLES = [
  { id: 'auto', labels: ['Tự động', 'Auto', '自动', '自動', '자동'] },
  { id: 'photorealistic', labels: ['Ảnh thật', 'Photorealistic', '写实照片', 'フォトリアル', '실사풍'] },
  { id: 'anime', labels: ['Anime', 'Anime', '动漫', 'アニメ', '애니'] },
  { id: 'illustration', labels: ['Minh họa', 'Illustration', '插画', 'イラスト', '일러스트'] },
  { id: '3d_render', labels: ['3D render', '3D render', '3D 渲染', '3Dレンダー', '3D 렌더'] },
  { id: 'watercolor', labels: ['Màu nước', 'Watercolor', '水彩', '水彩', '수채화'] },
  { id: 'minimal_flat', labels: ['Tối giản flat', 'Minimal flat', '扁平简约', 'ミニマルフラット', '미니멀 플랫'] },
  { id: 'cinematic', labels: ['Điện ảnh', 'Cinematic', '电影感', 'シネマティック', '시네마틱'] },
  { id: 'sketch', labels: ['Phác thảo', 'Sketch', '素描', 'スケッチ', '스케치'] },
  { id: 'pixel_art', labels: ['Pixel art', 'Pixel art', '像素风', 'ピクセルアート', '픽셀 아트'] },
] as const

type Text2ImageStyleId = (typeof IMAGE_STYLES)[number]['id']

const ASPECT_RATIOS = [
  { value: '1:1', labels: ['1:1 Vuông', '1:1 Square', '1:1 方形', '1:1 正方形', '1:1 정사각형'] as const },
  { value: '16:9', labels: ['16:9 Ngang rộng', '16:9 Wide', '16:9 宽屏', '16:9 ワイド', '16:9 와이드'] as const },
  { value: '9:16', labels: ['9:16 Dọc', '9:16 Tall', '9:16 竖屏', '9:16 縦長', '9:16 세로형'] as const },
  { value: '4:3', labels: ['4:3 Ngang', '4:3 Landscape', '4:3 横版', '4:3 横', '4:3 가로'] as const },
  { value: '3:4', labels: ['3:4 Dọc', '3:4 Portrait', '3:4 竖版', '3:4 縦', '3:4 세로'] as const },
  { value: '3:2', labels: ['3:2 Ngang', '3:2 Landscape', '3:2 横', '3:2 横', '3:2 가로'] as const },
  { value: '2:3', labels: ['2:3 Dọc', '2:3 Portrait', '2:3 竖', '2:3 縦', '2:3 세로'] as const },
] as const

export default function TaoAnhTuChuClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [step, setStep] = useState<Step>('UPLOAD')
  const [prompt, setPrompt] = useState('')
  const [reference, setReference] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const [aspectRatio, setAspectRatio] = useState<string>('1:1')
  const [imageStyle, setImageStyle] = useState<Text2ImageStyleId>('auto')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const refInputRef = useRef<HTMLInputElement>(null)
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

  const handleRefChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file?.type.startsWith('image/')) {
      setReference({ file, preview: URL.createObjectURL(file) })
    }
    e.target.value = ''
  }

  const handleSubmit = async () => {
    if (!prompt.trim() || prompt.trim().length < 3) {
      toast({
        title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
        description: tr('Vui lòng nhập mô tả ảnh.', 'Please enter an image description.', '请输入图片描述。', '画像の説明を入力してください。', '이미지 설명을 입력해 주세요.'),
        variant: 'destructive',
      })
      return
    }
    setStep('GENERATING')
    await waitForNextPaint()
    const formData = new FormData()
    formData.append('imageQuality', imageQuality)
    formData.append('aspectRatio', aspectRatio)
    formData.append('imageStyle', imageStyle)
    formData.append('prompt', prompt)
    if (reference.file) formData.append('referenceImage', reference.file)
    const result = await createImageFromText(formData)
    if (result.error) {
      setStep('UPLOAD')
      toast({
        title: tr('Tạo ảnh thất bại', 'Image generation failed', '生成失败', '生成に失敗しました', '이미지 생성 실패'),
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
        description: tr('Ảnh đã được tạo.', 'Image has been generated.', '图片已生成。', '画像を生成しました。', '이미지가 생성되었습니다.'),
        duration: 3000,
      })
    }
  }

  const handleReset = () => {
    setStep('UPLOAD')
    setPrompt('')
    setReference({ file: null, preview: null })
    setAspectRatio('1:1')
    setImageStyle('auto')
    setResultUrl(null)
  }

  return (
    <>
      <Toaster />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">
            {tr('Tạo ảnh bằng chữ', 'Text-to-image', '文生图', 'テキストから画像', '텍스트로 이미지 생성')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {tr(
              'Mô tả bằng chữ, chọn phong cách; có thể thêm ảnh tham khảo. 1,5–3 credits/ảnh.',
              'Describe in text, pick a style; optional reference image. 1.5–3 credits/image.',
              '文字描述并选择风格；可选参考图。1.5–3 积分/张。',
              'テキストとスタイルを選び、参考画像は任意。1.5–3クレジット/枚。',
              '텍스트·스타일 선택, 참고 이미지 선택. 1.5–3 크레딧/장.',
            )}
          </p>
        </div>

        {step === 'UPLOAD' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-violet-200/60 relative z-10">
            <CardHeader className="p-4 sm:p-6 pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-violet-600 shrink-0" />
                {tr('Tạo ảnh', 'Create image', '生成图片', '画像を作成', '이미지 만들기')}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {tr(
                  'Điền mô tả → chọn phong cách và tỷ lệ → (tuỳ chọn) ảnh tham khảo → Tạo ảnh.',
                  'Describe → pick style and ratio → (optional) reference → Generate.',
                  '填写描述 → 选风格和比例 →（可选）参考图 → 生成。',
                  '説明 → スタイル・比率 →（任意）参考画像 → 生成。',
                  '설명 → 스타일·비율 → (선택) 참고 이미지 → 생성.',
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-6">
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {tr('Mô tả ảnh', 'Image description', '图片描述', '画像の説明', '이미지 설명')}
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  {tr(
                    'Càng cụ thể càng tốt: chủ thể, ánh sáng, màu…',
                    'Be specific: subject, lighting, colors…',
                    '越具体越好：主体、光线、色彩…',
                    '具体的に：被写体、光、色など',
                    '구체적으로: 피사체, 조명, 색 등',
                  )}
                </p>
                <Textarea
                  placeholder={tr(
                    'Ví dụ: Mèo cam đội mũ len, tuyết rơi, phong cách 3D dễ thương, ánh sáng ấm…',
                    'e.g. Orange cat in a knit hat, snow, cute 3D style, warm light…',
                    '例如：戴毛线帽的橘猫、下雪、可爱3D风、暖光…',
                    '例：ニット帽のオレンジ猫、雪、かわいい3D、暖かい光…',
                    '예: 니트 모자 쓴 오렌지 고양이, 눈, 귀여운 3D, 따뜻한 조명…',
                  )}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="bg-white/80 text-sm min-h-[140px] resize-y"
                />
              </div>

              <div className="space-y-2" role="radiogroup" aria-labelledby="text2img-style-heading">
                <h4
                  id="text2img-style-heading"
                  className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
                >
                  {tr('Phong cách ảnh', 'Image style', '图像风格', '画像のスタイル', '이미지 스타일')}
                </h4>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {tr(
                    '“Tự động”: AI theo mô tả. Các mục khác: kiểu vẽ cố định hơn.',
                    'Auto: AI follows your text. Others: a stronger fixed look.',
                    '“自动”跟描述；其余：风格更固定。',
                    '「自動」は説明優先。その他はスタイル固定寄り。',
                    '「자동」은 설명 우선. 나머지는 스타일 고정.',
                  )}
                </p>
                <div className="relative z-[1] grid grid-cols-2 gap-2">
                  {IMAGE_STYLES.map((s) => {
                    const selected = imageStyle === s.id
                    const inputId = `text2img-style-${s.id}`
                    return (
                      <div key={s.id} className="relative min-w-0">
                        <input
                          id={inputId}
                          type="radio"
                          name="text2img-style"
                          value={s.id}
                          checked={selected}
                          onChange={() => setImageStyle(s.id)}
                          className="peer sr-only"
                        />
                        <label
                          htmlFor={inputId}
                          className={cn(
                            'flex min-h-10 w-full cursor-pointer touch-manipulation select-none items-center justify-center rounded-md border py-2 px-2 text-center text-xs font-medium leading-snug whitespace-normal shadow-sm transition-colors',
                            'peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
                            selected
                              ? 'border-violet-600 bg-violet-600 text-white hover:bg-violet-600/90'
                              : 'border-input bg-background hover:bg-accent hover:text-accent-foreground',
                          )}
                        >
                          {tr(s.labels[0], s.labels[1], s.labels[2], s.labels[3], s.labels[4])}
                        </label>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {tr('Ảnh tham khảo (tùy chọn)', 'Reference image (optional)', '参考图（可选）', '参考画像（任意）', '참고 이미지 (선택)')}
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  {tr(
                    'Gợi ý phong cách/màu/bố cục; nội dung chính theo chữ bạn nhập.',
                    'Hints for style/colors/layout; main content follows your text.',
                    '提示风格/色彩/构图；主体仍以文字为准。',
                    'スタイル・色・構図のヒント。内容はテキスト優先。',
                    '스타일·색·구도 힌트. 내용은 텍스트 우선.',
                  )}
                </p>
                <label
                  htmlFor="text2img-ref-input"
                  className="block w-full aspect-[4/3] max-h-[220px] rounded-lg border-2 border-dashed border-violet-200 bg-violet-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-violet-300 hover:bg-violet-50/80 transition-colors relative"
                >
                  {reference.preview ? (
                    <div className="relative w-full h-full flex items-center justify-center p-2">
                      <ImagePreview
                        src={reference.preview}
                        alt=""
                        asImg
                        className="w-full h-full object-contain rounded-lg max-h-[200px]"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setReference({ file: null, preview: null })
                        }}
                        className="absolute top-1 right-1 p-1 rounded-full bg-red-500/90 text-white hover:bg-red-600 z-10"
                        aria-label={tr('Xóa', 'Remove', '删除', '削除', '삭제')}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-10 w-10 text-violet-500" />
                      <p className="text-sm text-muted-foreground font-medium px-2 text-center">
                        {tr('Chọn ảnh tham khảo', 'Choose reference image', '选择参考图', '参考画像を選択', '참고 이미지 선택')}
                      </p>
                    </>
                  )}
                </label>
                <input
                  id="text2img-ref-input"
                  ref={refInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleRefChange}
                />
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {tr('Tỷ lệ khung', 'Aspect ratio', '画幅比例', '比率', '화면 비율')}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ASPECT_RATIOS.map((r) => (
                    <Button
                      key={r.value}
                      type="button"
                      variant={aspectRatio === r.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setAspectRatio(r.value)}
                      className={cn(
                        'text-xs h-9 touch-manipulation',
                        aspectRatio === r.value &&
                          'bg-violet-600 text-white hover:bg-violet-600/90 border-violet-600',
                      )}
                    >
                      {tr(r.labels[0], r.labels[1], r.labels[2], r.labels[3], r.labels[4])}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {tr('Chất lượng ảnh', 'Image quality', '图片质量', '画質', '이미지 품질')}
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={imageQuality === '2K' ? 'default' : 'outline'}
                    size="sm"
                    className={cn(
                      'h-11 touch-manipulation text-sm',
                      imageQuality === '2K' &&
                        'bg-violet-600 text-white hover:bg-violet-600/90 border-violet-600',
                    )}
                    onClick={() => setImageQuality('2K')}
                  >
                    2K (1,5)
                  </Button>
                  <Button
                    type="button"
                    variant={imageQuality === '4K' ? 'default' : 'outline'}
                    size="sm"
                    className={cn(
                      'h-11 touch-manipulation text-sm',
                      imageQuality === '4K' &&
                        'bg-violet-600 text-white hover:bg-violet-600/90 border-violet-600',
                    )}
                    onClick={() => setImageQuality('4K')}
                  >
                    4K (3)
                  </Button>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-border/60">
                <DepositCreditButton
                  variant="outline"
                  size="sm"
                  className="w-full border-violet-200 text-violet-700 hover:bg-violet-50 h-10 touch-manipulation"
                />
                <Button
                  type="button"
                  onClick={() => checkCreditsAndProceed(cost, handleSubmit)}
                  disabled={prompt.trim().length < 3}
                  className="w-full h-11 text-sm bg-violet-600 hover:bg-violet-700 text-white touch-manipulation"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {tr('Tạo ảnh', 'Generate', '生成', '生成', '생성')} ({imageQuality === '2K' ? '1,5' : '3'} credit)
                </Button>
                <p className="text-[10px] text-center text-muted-foreground">
                  * {tr('Thời gian: 15–45 giây', 'Time: 15–45 seconds', '时间：15–45 秒', '時間：15–45秒', '시간: 15–45초')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'GENERATING' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-violet-200/60">
            <CardContent className="flex flex-col items-center py-8">
              <ImageProcessingLoader
                mode="text2img"
                title={tr('Đang tạo ảnh', 'Generating image', '正在生成图片', '画像を生成中', '이미지 생성 중')}
                description={tr(
                  'AI đang vẽ theo mô tả của bạn',
                  'AI is rendering from your description',
                  'AI 正在根据描述绘制',
                  '説明に基づき描画中',
                  '설명에 따라 AI가 그리는 중',
                )}
                imagePreview={reference.preview}
              />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>{tr('Kết quả', 'Result', '结果', '結果', '결과')}</CardTitle>
              <CardDescription>
                {tr('Ảnh đã được tạo.', 'Image has been generated.', '图片已生成。', '画像を生成しました。', '이미지가 생성되었습니다.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-medium text-muted-foreground">{tr('Xem trước', 'Preview', '预览', 'プレビュー', '미리보기')}</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleReset}>
                    <RefreshCw className="mr-2 h-3 w-3" />
                    {tr('Thử lại', 'Try again', '重试', 'やり直す', '다시 시도')}
                  </Button>
                  <DownloadImageButton
                    imageUrl={resultUrl}
                    filename="text-to-image-result"
                    size="sm"
                    className="bg-violet-600 hover:bg-violet-700 text-white border-0"
                  />
                </div>
              </div>
              <div
                className="max-w-2xl mx-auto rounded-lg border overflow-hidden bg-white p-4 sm:p-6"
                style={{ aspectRatio: aspectRatio.replace(':', '/') }}
              >
                <ImagePreview src={resultUrl} alt="" className="w-full h-full object-contain" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6 px-4">
        {tr(
          'Ảnh do AI tạo có thể có sai sót. Tuân thủ pháp luật và điều khoản nội dung.',
          'AI-generated images may contain errors. Follow laws and content policies.',
          'AI 生成结果可能有误。请遵守法律法规与内容政策。',
          'AI生成には誤りがある場合があります。法令とポリシーを遵守してください。',
          'AI 생성 결과에 오류가 있을 수 있습니다. 법령과 정책을 준수하세요.',
        )}
      </p>
    </>
  )
}
