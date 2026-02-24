'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { createStickerLabel } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Tag, Sparkles, RefreshCw } from 'lucide-react'
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

const STICKER_ASPECT_RATIOS = [
  { value: '1:1', label: '1:1 Vuông' },
  { value: '4:3', label: '4:3 Ngang' },
  { value: '3:4', label: '3:4 Dọc' },
  { value: '16:9', label: '16:9 Ngang rộng' },
  { value: '9:16', label: '9:16 Dọc rộng' },
] as const

export default function TaoNhanGianClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [step, setStep] = useState<Step>('INPUT')
  const [prompt, setPrompt] = useState('')
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const [aspectRatio, setAspectRatio] = useState<string>('1:1')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
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

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Vui lòng nhập ý tưởng nhãn gián.', 'Please enter sticker label idea.', '请输入贴纸标签想法。', 'ステッカーラベルのアイデアを入力してください。', '스티커 라벨 아이디어를 입력해 주세요.'), variant: 'destructive' })
      return
    }
    setStep('GENERATING')
    const formData = new FormData()
    formData.append('prompt', prompt)
    formData.append('imageQuality', imageQuality)
    formData.append('aspectRatio', aspectRatio)
    const result = await createStickerLabel(formData)
    if (result.error) {
      setStep('INPUT')
      toast({ title: tr('Tạo nhãn gián thất bại', 'Create sticker label failed', '创建贴纸标签失败', 'ステッカーラベル作成に失敗しました', '스티커 라벨 생성 실패'), description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      await preloadImageUrl(result.resultUrl)
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      toast({ title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'), description: tr('Nhãn gián đã được tạo.', 'Sticker label has been created.', '贴纸标签已创建。', 'ステッカーラベルを作成しました。', '스티커 라벨이 생성되었습니다.'), duration: 3000 })
    }
  }

  const handleReset = () => {
    setStep('INPUT')
    setPrompt('')
    setAspectRatio('1:1')
    setResultUrl(null)
  }

  return (
    <>
      <Toaster />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">{tr('Tạo nhãn gián nền trong suốt', 'Create Transparent Sticker Label', '创建透明贴纸标签', '透明ステッカーラベル作成', '투명 스티커 라벨 만들기')}</h1>
          <p className="text-muted-foreground mt-1">{tr('Đưa ý tưởng nhãn gián. AI mở rộng chi tiết rồi tạo ảnh PNG nền trong suốt, phù hợp in sticker. 2–4 credits/ảnh.', 'Describe sticker idea. AI expands details and creates transparent PNG, suitable for printing. 2–4 credits/image.', '描述贴纸想法。AI 扩展细节并创建透明 PNG，适合打印。2–4 积分/张。', 'ステッカーアイデアを記述。AIが詳細を拡張し透明PNGを作成、印刷に適しています。2〜4クレジット/枚。', '스티커 아이디어를 설명하세요. AI가 세부사항을 확장하고 인쇄에 적합한 투명 PNG를 생성합니다. 2–4 크레딧/장.')}</p>
        </div>

        {step === 'INPUT' && (
          <div className="grid lg:grid-cols-[1fr_240px] gap-4 items-start">
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-teal-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Tag className="h-4 w-4 text-teal-600" /> {tr('Ý tưởng nhãn gián', 'Sticker label idea', '贴纸标签想法', 'ステッカーラベルアイデア', '스티커 라벨 아이디어')}
                  </CardTitle>
                  <CardDescription className="text-xs">{tr('Mô tả ngắn gọn nhãn gián bạn muốn. AI sẽ mở rộng thành mô tả chi tiết rồi tạo ảnh nền trong suốt.', 'Briefly describe the sticker label you want. AI will expand into detailed description and create transparent background image.', '简要描述您想要的贴纸标签。AI 将扩展为详细描述并创建透明背景图片。', '欲しいステッカーラベルを簡潔に記述。AIが詳細説明に拡張し透明背景画像を作成。', '원하는 스티커 라벨을 간단히 설명하세요. AI가 상세 설명으로 확장하고 투명 배경 이미지를 생성합니다.')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <Textarea
                    placeholder={tr('Ví dụ: Gấu trúc kawaii đội mũ tre, đang ăn lá trúc. Hoặc: Logo cafe với cốc cà phê và chữ ABC. Hoặc: Mèo dễ thương vẫy tay.', 'E.g.: Kawaii panda with bamboo hat, eating bamboo. Or: Cafe logo with coffee cup and ABC. Or: Cute cat waving.', '例如：戴竹帽的可爱熊猫吃竹子。或：带咖啡杯和 ABC 的咖啡馆 Logo。或：可爱猫咪挥手。', '例：竹の帽子をかぶったかわいいパンダが竹を食べる。または：コーヒーカップとABCのカフェロゴ。または：かわいい猫が手を振る。', '예: 대나무 모자 쓴 카와이 판다가 대나무 먹기. 또는: 커피 컵과 ABC가 있는 카페 로고. 또는: 귀여운 고양이가 손 흔들기.')}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={6}
                    className="resize-none"
                  />
                </CardContent>
              </Card>
            </div>
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-teal-200/60">
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Tỷ lệ khung', 'Aspect ratio', '宽高比', 'アスペクト比', '화면 비율')}</h4>
                    <div className="flex flex-wrap gap-2">
                      {STICKER_ASPECT_RATIOS.map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setAspectRatio(r.value)}
                          className={`px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                            aspectRatio === r.value ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                          }`}
                        >
                          {r.label}
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
                          imageQuality === '2K' ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        2K (2)
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageQuality('4K')}
                        className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                          imageQuality === '4K' ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        4K (4)
                      </button>
                    </div>
                  </div>
                  <div className="pt-4 border-t space-y-2 flex flex-col items-center">
                    <DepositCreditButton variant="outline" size="sm" className="w-full max-w-[180px] border-teal-200 text-teal-700 hover:bg-teal-50" />
                    <Button
                      onClick={() => checkCreditsAndProceed(cost, handleSubmit)}
                      disabled={!prompt.trim()}
                      className="w-full max-w-[180px] h-9 shadow-md hover:shadow-lg transition-all text-sm bg-teal-600 hover:bg-teal-700 text-white"
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> {tr('Tạo nhãn', 'Create label', '创建标签', 'ラベルを作成', '라벨 만들기')} ({imageQuality === '2K' ? '2' : '4'} credit)
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground mt-2">* {tr('Thời gian: 15–45 giây', 'Time: 15–45 seconds', '时间：15–45 秒', '所要時間: 15〜45秒', '소요 시간: 15–45초')}</p>
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
                mode="sticker"
                title={tr('Đang tạo nhãn gián', 'Creating sticker label', '正在创建贴纸标签', 'ステッカーラベルを作成中', '스티커 라벨 생성 중')}
                description={tr('AI đang mở rộng ý tưởng và vẽ nhãn nền trong suốt', 'AI is expanding idea and drawing transparent label', 'AI 正在扩展想法并绘制透明标签', 'AIがアイデアを拡張し透明ラベルを描画中', 'AI가 아이디어를 확장하고 투명 라벨을 그리는 중')}
              />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur overflow-hidden min-w-0">
            <CardHeader>
              <CardTitle>{tr('Kết quả nhãn gián', 'Sticker label result', '贴纸标签结果', 'ステッカーラベル結果', '스티커 라벨 결과')}</CardTitle>
              <CardDescription>{tr('Nhãn gián nền trong suốt đã được tạo. Tải PNG để in sticker.', 'Transparent sticker label created. Download PNG to print.', '透明贴纸标签已创建。下载 PNG 以打印。', '透明ステッカーラベルを作成しました。PNGをダウンロードして印刷。', '투명 스티커 라벨이 생성되었습니다. PNG를 다운로드하여 인쇄하세요.')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative aspect-square max-h-[55vh] w-full min-w-0 overflow-hidden rounded-lg border bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#f9fafb_0%_50%)] bg-[length:16px_16px]">
                <ImagePreview src={resultUrl} alt={tr('Nhãn gián', 'Sticker label', '贴纸标签', 'ステッカーラベル', '스티커 라벨')} className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={handleReset}>
                  <RefreshCw className="mr-2 h-3 w-3" /> {tr('Thử lại', 'Try again', '重试', '再試行', '다시 시도')}
                </Button>
                <DownloadImageButton imageUrl={resultUrl} filename="nhan-gian" size="sm" className="bg-teal-600 hover:bg-teal-700 text-white border-0" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">{tr('Ảnh do AI tạo có thể có sai sót. Nền trong suốt phụ thuộc model.', 'AI-generated images may contain errors. Transparency depends on model.', 'AI 生成结果可能存在误差。透明度取决于模型。', 'AI生成結果には誤差が含まれる場合があります。透明度はモデルに依存。', 'AI 생성 결과에는 오차가 있을 수 있습니다. 투명도는 모델에 따라 다릅니다.')}</p>
    </>
  )
}
