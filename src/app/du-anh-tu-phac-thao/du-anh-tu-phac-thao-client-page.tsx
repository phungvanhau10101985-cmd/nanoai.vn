'use client'

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

import { useState, useRef, ChangeEvent, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { createImageFromSketch } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, RefreshCw, X, PencilLine } from 'lucide-react'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { DownloadImageButton } from '@/components/download-image-button'
import { BeforeAfterResultDisplay } from '@/components/image-tools/before-after-result-display'
import { ImagePreview } from '@/components/ui/image-preview'
import { ImageProcessingLoader } from '@/components/image-processing-loader'
import { preloadImageUrl } from '@/lib/preload-image-url'
import { cn } from '@/lib/utils'

type Step = 'UPLOAD' | 'GENERATING' | 'RESULT'
type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'
type SketchModeId = '2d' | 'color' | '3d'

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
  const cookieValue = readWebLocaleFromDocumentCookie()
  if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') return cookieValue
  return 'vi'
}

const SKETCH_MODES: { id: SketchModeId; labels: [string, string, string, string, string]; hints: [string, string, string, string, string] }[] = [
  {
    id: '2d',
    labels: ['Ảnh 2D', '2D flat', '二维平面', '2Dフラット', '2D 플랫'],
    hints: [
      'Minh họa phẳng, nét sạch, ít chiều sâu giả 3D.',
      'Flat illustration, clean shapes, little fake depth.',
      '扁平插画、线条清晰。',
      'フラットな2Dイラスト。',
      '플랫 2D 일러스트.',
    ],
  },
  {
    id: 'color',
    labels: ['Ảnh phối màu', 'Full color', '全彩上色', 'フルカラー', '풀컬러'],
    hints: [
      'Tô màu hoàn chỉnh, bóng đổ và chất liệu minh họa.',
      'Full color, shading and illustrative materials.',
      '完整上色与明暗。',
      '彩色・影・質感付きの完成イラスト。',
      '색채·명암·질감이 살아 있는 완성 일러스트.',
    ],
  },
  {
    id: '3d',
    labels: ['Ảnh 3D', '3D style', '3D 风格', '3D風', '3D 스타일'],
    hints: [
      'Khối, phối cảnh và ánh sáng kiểu render 3D.',
      'Volume, perspective and lighting like a 3D render.',
      '体积感与三维光影。',
      '立体・パース・ライティングの3D風。',
      '부피감·원근·조명의 3D 렌더 느낌.',
    ],
  },
]

const ASPECT_RATIOS = [
  { value: '1:1', labels: ['1:1 Vuông', '1:1 Square', '1:1 方形', '1:1 正方形', '1:1 정사각형'] as const },
  { value: '4:3', labels: ['4:3 Ngang', '4:3 Landscape', '4:3 横版', '4:3 横', '4:3 가로'] as const },
  { value: '3:4', labels: ['3:4 Dọc', '3:4 Portrait', '3:4 竖版', '3:4 縦', '3:4 세로'] as const },
  { value: '16:9', labels: ['16:9 Ngang rộng', '16:9 Wide', '16:9 宽屏', '16:9 ワイド', '16:9 와이드'] as const },
  { value: '9:16', labels: ['9:16 Dọc', '9:16 Tall', '9:16 竖屏', '9:16 縦長', '9:16 세로형'] as const },
] as const

function aspectRatioToCss(ratio: string): string {
  const [a, b] = ratio.split(':').map((x) => Number(x.trim()))
  if (!a || !b || Number.isNaN(a) || Number.isNaN(b)) return '1 / 1'
  return `${a} / ${b}`
}

export default function DuAnhTuPhacThaoClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [step, setStep] = useState<Step>('UPLOAD')
  const [sketch, setSketch] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [sketchMode, setSketchMode] = useState<SketchModeId>('color')
  const [optionalPrompt, setOptionalPrompt] = useState('')
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const [aspectRatio, setAspectRatio] = useState<string>('1:1')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const cost = imageQuality === '2K' ? 1.5 : 3

  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  const labelIndex = uiLocale === 'en' ? 1 : uiLocale === 'zh' ? 2 : uiLocale === 'ja' ? 3 : uiLocale === 'ko' ? 4 : 0

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

  const resultAspectCss = useMemo(() => aspectRatioToCss(aspectRatio), [aspectRatio])

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file?.type.startsWith('image/')) {
      setSketch((prev) => {
        if (prev.preview) {
          try {
            URL.revokeObjectURL(prev.preview)
          } catch {
            /* ignore */
          }
        }
        return { file, preview: URL.createObjectURL(file) }
      })
    }
    e.target.value = ''
  }

  const clearSketch = () => {
    setSketch((prev) => {
      if (prev.preview) {
        try {
          URL.revokeObjectURL(prev.preview)
        } catch {
          /* ignore */
        }
      }
      return { file: null, preview: null }
    })
  }

  const handleSubmit = async () => {
    if (!sketch.file) {
      toast({
        title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
        description: tr(
          'Vui lòng tải lên ảnh phác thảo.',
          'Please upload a sketch image.',
          '请上传草图。',
          'スケッチ画像をアップロードしてください。',
          '스케치 이미지를 업로드해 주세요.'
        ),
        variant: 'destructive',
      })
      return
    }

    setStep('GENERATING')
    await waitForNextPaint()
    const formData = new FormData()
    formData.append('sketchImage', sketch.file)
    formData.append('sketchMode', sketchMode)
    formData.append('optionalPrompt', optionalPrompt.trim())
    formData.append('imageQuality', imageQuality)
    formData.append('aspectRatio', aspectRatio)

    const result = await createImageFromSketch(formData)
    if (result.error) {
      setStep('UPLOAD')
      toast({
        title: tr('Dựng ảnh thất bại', 'Rebuild failed', '生成失败', '作成に失敗', '생성 실패'),
        description: result.error,
        variant: 'destructive',
        duration: 6000,
      })
    } else if (result.success && result.resultUrl) {
      await preloadImageUrl(result.resultUrl)
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      toast({
        title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'),
        description: tr('Đã dựng ảnh từ phác thảo.', 'Image rebuilt from sketch.', '已从草图生成图像。', 'スケッチから画像を作成しました。', '스케치에서 이미지를 만들었습니다.'),
        duration: 3000,
      })
    }
  }

  const handleReset = () => {
    clearSketch()
    setStep('UPLOAD')
    setSketchMode('color')
    setOptionalPrompt('')
    setAspectRatio('1:1')
    setImageQuality('2K')
    setResultUrl(null)
  }

  return (
    <>
      <Toaster />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">
            {tr('Dựng ảnh từ phác thảo', 'Sketch to image', '草图生成图', 'スケッチから画像', '스케치로 이미지')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {tr(
              'Tải phác thảo → chọn kiểu 2D, phối màu hoặc 3D → AI dựng ảnh hoàn chỉnh. 1,5–3 credits/lần.',
              'Upload sketch → pick 2D, full color, or 3D style → AI finishes the image. 1.5–3 credits per run.',
              '上传草图 → 选择二维、全彩或三维风格 → AI 生成成品。每次 1.5–3 积分。',
              'スケッチをアップロード → 2D・フルカラー・3Dから選択 → AIが仕上げ。1.5–3クレジット/回。',
              '스케치 업로드 → 2D·풀컬러·3D 선택 → AI가 완성. 회당 1.5–3 크레딧.'
            )}
          </p>
        </div>

        {step === 'UPLOAD' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-violet-200/60 relative z-10">
            <CardHeader className="p-4 sm:p-6 pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <PencilLine className="h-5 w-5 text-violet-600 shrink-0" />
                {tr('Phác thảo của bạn', 'Your sketch', '你的草图', 'あなたのスケッチ', '내 스케치')}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {tr(
                  'Chụp hoặc tải ảnh nét vẽ tay / phác thảo số; thêm ghi chú tuỳ chọn để AI hiểu rõ hơn.',
                  'Upload a hand-drawn or digital sketch; optional notes help the model.',
                  '上传手绘或数字线稿；可选备注帮助理解。',
                  '手描き・ラフをアップロード。任意のメモで補足できます。',
                  '손그림·디지털 러프 업로드. 선택 메모로 보완.'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:px-6 pt-0 space-y-5">
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {tr('Ảnh phác thảo', 'Sketch image', '草图', 'スケッチ画像', '스케치 이미지')}
                </h4>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
                {!sketch.preview ? (
                  <Button type="button" variant="outline" className="w-full h-32 border-dashed gap-2" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4" />
                    {tr('Chọn ảnh phác thảo', 'Choose sketch', '选择草图', 'スケッチを選ぶ', '스케치 선택')}
                  </Button>
                ) : (
                  <div className="relative rounded-lg border overflow-hidden bg-muted/30 max-h-64">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sketch.preview} alt="" className="w-full max-h-64 object-contain" />
                    <button
                      type="button"
                      onClick={clearSketch}
                      className="absolute right-2 top-2 rounded-md bg-background/90 p-1 shadow-sm"
                      aria-label={tr('Xóa', 'Remove', '删除', '削除', '제거')}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {tr('Kiểu dựng ảnh', 'Rebuild style', '生成风格', '仕上げスタイル', '완성 스타일')}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {SKETCH_MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSketchMode(m.id)}
                      className={cn(
                        'rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                        sketchMode === m.id
                          ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-500/30'
                          : 'border-border hover:bg-muted/50'
                      )}
                    >
                      <div className="font-medium">{m.labels[labelIndex]}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{m.hints[labelIndex]}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {tr('Ghi chú thêm (tuỳ chọn)', 'Extra notes (optional)', '补充说明（可选）', '補足メモ（任意）', '추가 메모(선택)')}
                </h4>
                <Textarea
                  value={optionalPrompt}
                  onChange={(e) => setOptionalPrompt(e.target.value)}
                  rows={3}
                  maxLength={4000}
                  placeholder={tr(
                    'Ví dụ: màu chủ đạo xanh lá, phong cách hoạt hình, thêm cây phía sau…',
                    'e.g. green palette, cartoon style, add trees in the back…',
                    '例如：主色绿色、卡通风格、背景加树…',
                    '例：緑基調、アニメ調、後ろに木…',
                    '예: 초록 톤, 카툰, 뒤에 나무…'
                  )}
                  className="resize-y min-h-[72px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {tr('Tỷ lệ khung', 'Aspect ratio', '画幅比例', 'アスペクト比', '비율')}
                  </h4>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                  >
                    {ASPECT_RATIOS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.labels[labelIndex]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {tr('Độ phân giải', 'Resolution', '分辨率', '解像度', '해상도')}
                  </h4>
                  <div className="flex rounded-md border border-input overflow-hidden">
                    <button
                      type="button"
                      className={cn('flex-1 py-2 text-sm', imageQuality === '2K' ? 'bg-violet-600 text-white' : 'bg-background')}
                      onClick={() => setImageQuality('2K')}
                    >
                      2K
                    </button>
                    <button
                      type="button"
                      className={cn('flex-1 py-2 text-sm border-l', imageQuality === '4K' ? 'bg-violet-600 text-white' : 'bg-background')}
                      onClick={() => setImageQuality('4K')}
                    >
                      4K
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between pt-2">
                <DepositCreditButton />
                <Button
                  type="button"
                  size="lg"
                  className={cn('gap-2 bg-violet-600 hover:bg-violet-700')}
                  onClick={() => checkCreditsAndProceed(cost, handleSubmit)}
                >
                  <Sparkles className="h-4 w-4" />
                  {tr(`Dựng ảnh (${cost} credits)`, `Rebuild (${cost} credits)`, `生成（${cost} 积分）`, `作成（${cost}クレジット）`, `생성 (${cost} 크레딧)`)}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'GENERATING' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-violet-200/60">
            <CardContent className="flex flex-col items-center py-8">
              <ImageProcessingLoader
                mode="text2img"
                title={tr('Đang dựng ảnh', 'Rebuilding image', '正在生成', '画像を作成中', '이미지 생성 중')}
                description={tr(
                  'AI đang đọc phác thảo và vẽ ảnh hoàn chỉnh…',
                  'Reading your sketch and rendering the finished image…',
                  '正在读取草图并渲染成品…',
                  'スケッチを読み取り、仕上げ画像を描画中…',
                  '스케치를 읽고 완성 이미지를 그리는 중…'
                )}
              />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle>{tr('Kết quả', 'Result', '结果', '結果', '결과')}</CardTitle>
              <CardDescription>
                {tr('Bấm ảnh để xem phóng to.', 'Click the image to enlarge.', '点击图片可放大。', '画像をタップで拡大。', '이미지를 눌러 확대.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sketch.preview ? (
                <BeforeAfterResultDisplay
                  beforeSrc={sketch.preview}
                  afterSrc={resultUrl}
                  beforeAlt={tr('Phác thảo', 'Sketch', '草图', 'スケッチ', '스케치')}
                  afterAlt={tr('Ảnh đã dựng', 'Rebuilt image', '生成图', '生成画像', '완성 이미지')}
                  afterPrintReadyAspectRatio={aspectRatio}
                  beforeHeader={<h3 className="text-sm font-medium text-muted-foreground">{tr('Phác thảo', 'Sketch', '草图', 'スケッチ', '스케치')}</h3>}
                  afterHeader={
                    <div className="flex w-full flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-medium text-muted-foreground">{tr('Ảnh đã dựng', 'Rebuilt image', '生成图', '生成画像', '완성 이미지')}</h3>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" className="gap-2" onClick={handleReset}>
                          <RefreshCw className="h-4 w-4" />
                          {tr('Tạo mới', 'Start over', '重新开始', '最初から', '다시 하기')}
                        </Button>
                        <DownloadImageButton
                          imageUrl={resultUrl}
                          filename="sketch-rebuild-result"
                          size="sm"
                          className="bg-violet-600 hover:bg-violet-700 text-white border-0"
                          printReady
                          printReadyAspectRatio={aspectRatio}
                        />
                      </div>
                    </div>
                  }
                />
              ) : (
                <>
                  <div
                    className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-lg border bg-muted/30"
                    style={{ aspectRatio: resultAspectCss }}
                  >
                    <ImagePreview
                      src={resultUrl}
                      alt={tr('Ảnh đã dựng', 'Rebuilt image', '生成图', '生成画像', '완성 이미지')}
                      asImg
                      printReadyAspectRatio={aspectRatio}
                      className="absolute inset-0 h-full w-full rounded-md"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <DownloadImageButton
                      imageUrl={resultUrl}
                      filename="sketch-rebuild-result"
                      size="sm"
                      className="bg-violet-600 hover:bg-violet-700 text-white border-0"
                    />
                    <Button type="button" variant="outline" className="gap-2" onClick={handleReset}>
                      <RefreshCw className="h-4 w-4" />
                      {tr('Tạo mới', 'Start over', '重新开始', '最初から', '다시 하기')}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
