'use client'

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { createStoryImage } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { BookOpen, Sparkles, RefreshCw } from 'lucide-react'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { DownloadImageButton } from '@/components/download-image-button'
import { ImagePreview } from '@/components/ui/image-preview'
import { ImageProcessingLoader } from '@/components/image-processing-loader'
import { preloadImageUrl } from '@/lib/preload-image-url'

type Step = 'INPUT' | 'GENERATING' | 'RESULT'
type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

function getWebLocaleFromCookie(): UiLocale {
  if (typeof document === 'undefined') return 'vi'
  const cookieValue = readWebLocaleFromDocumentCookie()
  if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') return cookieValue
  return 'vi'
}

const STORY_ASPECT_RATIO_LABELS: Record<string, Record<UiLocale, string>> = {
  '4:3': { vi: '4:3 Ngang', en: '4:3 Landscape', zh: '4:3 横屏', ja: '4:3 横', ko: '4:3 가로' },
  '3:4': { vi: '3:4 Dọc', en: '3:4 Portrait', zh: '3:4 竖屏', ja: '3:4 縦', ko: '3:4 세로' },
  '16:9': { vi: '16:9 Ngang rộng', en: '16:9 Wide', zh: '16:9 宽屏', ja: '16:9 ワイド', ko: '16:9 와이드' },
  '9:16': { vi: '9:16 Dọc rộng', en: '9:16 Tall', zh: '9:16 竖宽', ja: '9:16 縦長', ko: '9:16 세로 넓음' },
  '1:1': { vi: '1:1 Vuông', en: '1:1 Square', zh: '1:1 正方形', ja: '1:1 正方形', ko: '1:1 정사각형' },
}
const STORY_ASPECT_RATIOS = ['4:3', '3:4', '16:9', '9:16', '1:1'] as const

export default function KeChuyenBangHinhAnhClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [step, setStep] = useState<Step>('INPUT')
  const [prompt, setPrompt] = useState('')
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const [aspectRatio, setAspectRatio] = useState<string>('4:3')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const cost = imageQuality === '2K' ? 3 : 6
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

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Vui lòng nhập ý tưởng hoặc chủ đề cần minh họa.', 'Please enter your idea or topic to illustrate.', '请输入想法或主题进行插图。', 'アイデアやテーマを入力してください。', '아이디어나 주제를 입력해 주세요.'), variant: 'destructive' })
      return
    }
    setStep('GENERATING')
    const formData = new FormData()
    formData.append('prompt', prompt)
    formData.append('imageQuality', imageQuality)
    formData.append('aspectRatio', aspectRatio)
    const result = await createStoryImage(formData)
    if (result.error) {
      setStep('INPUT')
      toast({ title: tr('Tạo ảnh thất bại', 'Image creation failed', '图片生成失败', '画像作成に失敗しました', '이미지 생성 실패'), description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      await preloadImageUrl(result.resultUrl)
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      toast({ title: tr('Thành công!', 'Success!', '成功！', '成功しました！', '성공!'), description: tr('Ảnh minh họa đã được tạo.', 'Illustration image has been created.', '插图已生成。', 'イラスト画像が作成されました。', '일러스트 이미지가 생성되었습니다.'), duration: 3000 })
    }
  }

  const handleReset = () => {
    setStep('INPUT')
    setPrompt('')
    setAspectRatio('4:3')
    setResultUrl(null)
  }

  return (
    <>
      <Toaster />
      <div className="tool-page-container">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">{tr('Kể chuyện bằng hình ảnh', 'Story with images', '图像讲故事', '画像でストーリー', '이미지로 이야기')}</h1>
          <p className="text-muted-foreground mt-1">{tr('Đưa ý tưởng. AI viết câu chuyện dẫn dắt đúng chuẩn khoa học (không bịa) rồi tạo ảnh minh họa, chữ tiếng Việt. 3–6 credits/ảnh.', 'Submit an idea. AI writes a science-based story and creates illustrated images. 3–6 credits/image.', '提交想法。AI 撰写科学故事并生成插图。每张 3–6 积分。', 'アイデアを入力。AIが科学的なストーリーを書き、イラスト画像を作成。3–6クレジット/枚。', '아이디어를 입력하세요. AI가 과학적 스토리를 작성하고 일러스트 이미지를 생성합니다. 3–6 크레딧/장.')}</p>
        </div>

        {step === 'INPUT' && (
          <div className="grid lg:grid-cols-[1fr_240px] gap-4 items-start">
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-rose-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BookOpen className="h-4 w-4 text-rose-600" /> {tr('Ý tưởng / chủ đề', 'Idea / topic', '想法/主题', 'アイデア/テーマ', '아이디어/주제')}
                  </CardTitle>
                  <CardDescription className="text-xs">{tr('Đưa ý tưởng. AI viết câu chuyện dẫn dắt đúng chuẩn khoa học (không bịa), rồi tạo ảnh minh họa, chữ tiếng Việt.', 'Submit an idea. AI writes a science-based story and creates illustrated images.', '提交想法。AI 撰写科学故事并生成插图。', 'アイデアを入力。AIが科学的なストーリーを書き、イラスト画像を作成。', '아이디어를 입력하세요. AI가 과학적 스토리를 작성하고 일러스트 이미지를 생성합니다.')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <Textarea
                    placeholder={tr('Ví dụ: Quang hợp – dẫn dắt từ sáng (lá hấp ánh sáng) đến trưa (tạo đường) đến chiều (tích trữ). Hoặc: Vòng tuần hoàn nước. Hoặc: Cô bé quàng khăn đỏ gặp sói.', 'E.g. Photosynthesis – from morning (leaf absorbs light) to noon (sugar) to evening (storage). Or: Water cycle. Or: Little Red Riding Hood meets the wolf.', '例如：光合作用——从早晨（叶片吸收光）到中午（产糖）到傍晚（储存）。或：水循环。或：小红帽遇狼。', '例：光合成—朝（葉が光を吸収）→昼（糖生成）→夕（貯蔵）。または：水循環。または：赤ずきんと狼。', '예: 광합성 – 아침(잎이 빛 흡수)→낮(당 생성)→저녁(저장). 또는: 물순환. 또는: 빨간 모자와 늑대.')}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={8}
                    className="resize-none"
                  />
                </CardContent>
              </Card>
            </div>
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-rose-200/60">
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Tỷ lệ khung', 'Aspect ratio', '画面比例', 'アスペクト比', '화면 비율')}</h4>
                    <div className="flex flex-wrap gap-2">
                      {STORY_ASPECT_RATIOS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setAspectRatio(r)}
                          className={`px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                            aspectRatio === r ? 'border-rose-500 bg-rose-50 text-rose-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                          }`}
                        >
                          {STORY_ASPECT_RATIO_LABELS[r]?.[uiLocale] ?? r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Chất lượng ảnh', 'Image quality', '图片质量', '画像品質', '이미지 품질')}</h4>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setImageQuality('2K')}
                        className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                          imageQuality === '2K' ? 'border-rose-500 bg-rose-50 text-rose-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        2K (3)
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageQuality('4K')}
                        className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                          imageQuality === '4K' ? 'border-rose-500 bg-rose-50 text-rose-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        4K (6)
                      </button>
                    </div>
                  </div>
                  <div className="pt-4 border-t space-y-2 flex flex-col items-center">
                    <DepositCreditButton variant="outline" size="sm" className="w-full max-w-[180px] border-rose-200 text-rose-700 hover:bg-rose-50" />
                    <Button
                      onClick={() => checkCreditsAndProceed(cost, handleSubmit)}
                      disabled={!prompt.trim()}
                      className="w-full max-w-[180px] h-9 shadow-md hover:shadow-lg transition-all text-sm bg-rose-600 hover:bg-rose-700 text-white"
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> {tr('Tạo ảnh', 'Create image', '生成图片', '画像を作成', '이미지 생성')} ({imageQuality === '2K' ? '3' : '6'} credit)
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground mt-2">* {tr('Thời gian: 15–45 giây', 'Time: 15–45 seconds', '时间：15–45 秒', '所要時間：15–45秒', '소요 시간: 15–45초')}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === 'GENERATING' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-rose-200/60">
            <CardContent className="flex flex-col items-center py-8">
              <ImageProcessingLoader
                mode="story"
                title={tr('Đang tạo ảnh kể chuyện', 'Creating story image', '正在生成故事图片', 'ストーリー画像を作成中', '스토리 이미지 생성 중')}
                description={tr('AI đang mở rộng ý tưởng và vẽ minh họa', 'AI is expanding the idea and drawing illustrations', 'AI 正在扩展想法并绘制插图', 'AIがアイデアを広げ、イラストを描いています', 'AI가 아이디어를 확장하고 일러스트를 그리고 있습니다')}
              />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur overflow-hidden min-w-0">
            <CardHeader>
              <CardTitle>{tr('Kết quả ảnh minh họa', 'Illustration result', '插图结果', 'イラスト結果', '일러스트 결과')}</CardTitle>
              <CardDescription>{tr('Ảnh đã được tạo theo mô tả của bạn.', 'Image created according to your description.', '已根据您的描述生成图片。', '説明に従って画像が作成されました。', '설명에 따라 이미지가 생성되었습니다.')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative aspect-[4/3] max-h-[55vh] w-full min-w-0 overflow-hidden rounded-lg border bg-black/5">
                <ImagePreview src={resultUrl} alt={tr('Ảnh minh họa', 'Illustration', '插图', 'イラスト', '일러스트')} className="w-full h-full object-contain" printReadyAspectRatio={aspectRatio} />
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={handleReset}>
                  <RefreshCw className="mr-2 h-3 w-3" /> {tr('Thử lại', 'Try again', '重试', 'もう一度', '다시 시도')}
                </Button>
                <DownloadImageButton
                  imageUrl={resultUrl}
                  filename="ke-chuyen-anh"
                  size="sm"
                  className="bg-rose-600 hover:bg-rose-700 text-white border-0"
                  printReady
                  printReadyAspectRatio={aspectRatio}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">{tr('Ảnh do AI tạo có thể có sai sót.', 'AI-generated images may contain minor errors.', 'AI 生成结果可能存在误差。', 'AI生成結果には誤差が含まれる場合があります。', 'AI 생성 결과에는 오차가 있을 수 있습니다.')}</p>
    </>
  )
}
