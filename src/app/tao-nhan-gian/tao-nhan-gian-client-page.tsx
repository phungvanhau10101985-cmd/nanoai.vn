'use client'

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

import { useState, useEffect } from 'react'
import type { ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createStickerLabel, createStickerFromPhoto } from './actions'
import type { StickerPhotoExpressionId } from './actions'
import {
  PHOTO_EXPRESSION_OPTIONS,
  labelForExpression,
  defaultCaptionForExpression,
  type StickerLocale,
} from './sticker-photo-presets'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Tag, Sparkles, RefreshCw, ImagePlus, Smile } from 'lucide-react'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { DownloadImageButton } from '@/components/download-image-button'
import { ImagePreview } from '@/components/ui/image-preview'
import { ImageProcessingLoader } from '@/components/image-processing-loader'
import { preloadImageUrl } from '@/lib/preload-image-url'

type Step = 'INPUT' | 'GENERATING' | 'RESULT'
type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'
type WorkshopTab = 'idea' | 'photo'

function getWebLocaleFromCookie(): UiLocale {
  if (typeof document === 'undefined') return 'vi'
  const cookieValue = readWebLocaleFromDocumentCookie()
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
  const [workshopTab, setWorkshopTab] = useState<WorkshopTab>('idea')
  const [prompt, setPrompt] = useState('')
  const [photo, setPhoto] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [expressionId, setExpressionId] = useState<StickerPhotoExpressionId>('happy')
  const [photoCaption, setPhotoCaption] = useState('')
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

  useEffect(() => {
    const url = photo.preview
    return () => {
      if (url) {
        try {
          URL.revokeObjectURL(url)
        } catch {
          /* ignore */
        }
      }
    }
  }, [photo.preview])

  const stickerLocale = uiLocale as StickerLocale

  useEffect(() => {
    setPhotoCaption(defaultCaptionForExpression(stickerLocale, expressionId))
  }, [expressionId, stickerLocale])

  const clearPhotoPreview = () => {
    setPhoto((prev) => {
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

  const handlePhotoFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file?.type.startsWith('image/')) {
      setPhoto((prev) => {
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

  const handleSubmitIdea = async () => {
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

  const handleSubmitPhoto = async () => {
    if (!photo.file) {
      toast({
        title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
        description: tr(
          'Vui lòng tải ảnh chân dung (khuôn mặt rõ).',
          'Please upload a portrait photo with a clear face.',
          '请上传面部清晰的肖像照。',
          '顔がはっきり写ったポートレート写真をアップロードしてください。',
          '얼굴이 잘 보이는 인물 사진을 업로드해 주세요.'
        ),
        variant: 'destructive',
      })
      return
    }
    if (!photoCaption.trim()) {
      toast({
        title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
        description: tr(
          'Nhập chữ hiển thị trên sticker (hoặc chọn biểu cảm khác để lấy chữ mẫu).',
          'Enter the text on the sticker, or pick another expression for a default line.',
          '请输入贴纸上的文字，或选择其他表情以使用默认文案。',
          'ステッカーに表示する文字を入力するか、別の表情を選んでデフォルト文を使ってください。',
          '스티커에 넣을 문구를 입력하거나 다른 표정을 골라 기본 문구를 쓰세요.'
        ),
        variant: 'destructive',
      })
      return
    }
    setStep('GENERATING')
    const formData = new FormData()
    formData.append('portraitImage', photo.file)
    formData.append('expressionId', expressionId)
    formData.append('stickerCaption', photoCaption.trim())
    formData.append('imageQuality', imageQuality)
    formData.append('aspectRatio', aspectRatio)
    const result = await createStickerFromPhoto(formData)
    if (result.error) {
      setStep('INPUT')
      toast({ title: tr('Tạo nhãn gián thất bại', 'Create sticker label failed', '创建贴纸标签失败', 'ステッカーラベル作成に失敗しました', '스티커 라벨 생성 실패'), description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      await preloadImageUrl(result.resultUrl)
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      toast({ title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'), description: tr('Sticker từ ảnh đã được tạo.', 'Sticker from photo created.', '已从照片创建贴纸。', '写真からステッカーを作成しました。', '사진 스티커가 생성되었습니다.'), duration: 3000 })
    }
  }

  const handleReset = () => {
    setStep('INPUT')
    setPrompt('')
    clearPhotoPreview()
    setExpressionId('happy')
    setPhotoCaption(defaultCaptionForExpression(uiLocale as StickerLocale, 'happy'))
    setAspectRatio('1:1')
    setResultUrl(null)
  }

  return (
    <>
      <Toaster />
      <div className="tool-page-container">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">{tr('Tạo nhãn gián nền trong suốt', 'Create Transparent Sticker Label', '创建透明贴纸标签', '透明ステッカーラベル作成', '투명 스티커 라벨 만들기')}</h1>
          <p className="text-muted-foreground mt-1">
            {tr(
              'Chế độ «Ý tưởng»: mô tả bằng chữ — AI vẽ nhãn. Chế độ «Ảnh của bạn»: tải ảnh chụp khuôn mặt, chọn biểu cảm và chữ sticker (đổi chữ thoải mái). 2–4 credits/ảnh.',
              'Idea mode: describe in text — AI draws the label. Photo mode: upload a face photo, pick an expression and sticker text (edit anytime). 2–4 credits per image.',
              '「创意」用文字描述并由 AI 绘制；「你的照片」上传脸部照片，选表情和贴纸文案（可随时修改）。每张 2–4 积分。',
              '「アイデア」は文章で説明してAIが描画。「自分の写真」は顔写真をアップし表情とキャプションを選べます（自由に編集可）。1枚につき2〜4クレジット。',
              '「아이디어」는 글로 설명·AI가 그림. 「내 사진」은 얼굴 사진 업로드 후 표정·스티커 문구 선택(언제든 수정). 장당 2–4 크레딧.'
            )}
          </p>
        </div>

        {step === 'INPUT' && (
          <div className="grid lg:grid-cols-[1fr_240px] gap-4 items-start">
            <div className="min-w-0">
              <Tabs value={workshopTab} onValueChange={(v) => setWorkshopTab(v as WorkshopTab)}>
                <TabsList className="grid w-full max-w-xl grid-cols-2 lg:mx-0 mx-auto mb-3">
                  <TabsTrigger value="idea">
                    <Tag className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                    {tr('Từ ý tưởng', 'From idea', '从创意', 'アイデア', '아이디어')}
                  </TabsTrigger>
                  <TabsTrigger value="photo">
                    <ImagePlus className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                    {tr('Từ ảnh của bạn', 'From your photo', '用你的照片', '自分の写真', '내 사진')}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="idea" className="mt-0">
                  <Card className="border shadow-sm bg-white/80 backdrop-blur border-teal-200/60">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Tag className="h-4 w-4 text-teal-600" /> {tr('Ý tưởng nhãn gián', 'Sticker label idea', '贴纸标签想法', 'ステッカーラベルアイデア', '스티커 라벨 아이디어')}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {tr(
                          'Mô tả ngắn gọn nhãn gián bạn muốn. AI sẽ mở rộng thành mô tả chi tiết rồi tạo ảnh nền trong suốt.',
                          'Briefly describe the sticker label you want. AI will expand into detailed description and create a transparent background image.',
                          '简要描述您想要的贴纸标签。AI 将扩展为详细描述并创建透明背景图片。',
                          '欲しいステッカーラベルを簡潔に記述。AIが詳細説明に拡張し透明背景画像を作成。',
                          '원하는 스티커 라벨을 간단히 설명하세요. AI가 상세 설명으로 확장하고 투명 배경 이미지를 생성합니다.'
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-4">
                      <Textarea
                        placeholder={tr(
                          'Ví dụ: Gấu trúc kawaii đội mũ tre, đang ăn lá trúc. Hoặc: Logo cafe với cốc cà phê và chữ ABC. Hoặc: Mèo dễ thương vẫy tay.',
                          'E.g.: Kawaii panda with bamboo hat, eating bamboo. Or: Cafe logo with coffee cup and ABC. Or: Cute cat waving.',
                          '例如：戴竹帽的可爱熊猫吃竹子。或：带咖啡杯和 ABC 的咖啡馆 Logo。或：可爱猫咪挥手。',
                          '例：竹の帽子をかぶったかわいいパンダが竹を食べる。または：コーヒーカップとABCのカフェロゴ。または：かわいい猫が手を振る。',
                          '예: 대나무 모자 쓴 카와이 판다가 대나무 먹기. 또는: 커피 컵과 ABC가 있는 카페 로고. 또는: 귀여운 고양이가 손 흔들기.'
                        )}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        rows={6}
                        className="resize-none"
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="photo" className="mt-0">
                  <Card className="border shadow-sm bg-white/80 backdrop-blur border-teal-200/60">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Smile className="h-4 w-4 text-teal-600" /> {tr('Ảnh chân dung & biểu cảm', 'Portrait & expression', '肖像与表情', 'ポートレートと表情', '인물 사진·표정')}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {tr(
                          'Tải ảnh chụp khuôn mặt rõ. Chọn biểu cảm sticker — chữ mẫu có thể sửa. Chế độ «Tuỳ chỉnh»: tự viết toàn bộ chữ trên sticker.',
                          'Upload a clear face photo. Pick an expression — default caption is editable. «Custom» expression: write your own sticker text.',
                          '上传清晰的面部照片。选择表情——默认文案可编辑。「自定义」模式：自行填写贴纸上的全部文字。',
                          '顔がはっきり写った写真をアップロード。表情を選び—デフォルトの文言は編集可。「カスタム」で全文を自分で入力。',
                          '얼굴이 선명한 사진을 업로드하세요. 표정 선택—기본 문구는 수정 가능. «사용자»는 스티커 문구를 직접 입력.'
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-4">
                      <div className="flex flex-col sm:flex-row gap-3 items-start">
                        <div className="flex flex-col gap-2">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="sr-only"
                            id="sticker-portrait-file"
                            onChange={handlePhotoFile}
                          />
                          <label
                            htmlFor="sticker-portrait-file"
                            className="inline-flex h-10 cursor-pointer items-center justify-center whitespace-nowrap rounded-md border border-teal-200 bg-white px-4 py-2 text-sm font-medium text-foreground hover:bg-teal-50"
                          >
                            <ImagePlus className="mr-2 h-4 w-4" />
                            {tr('Chọn ảnh', 'Choose photo', '选择照片', '写真を選ぶ', '사진 선택')}
                          </label>
                          {photo.preview && (
                            <Button type="button" variant="ghost" size="sm" className="text-xs h-8 self-start" onClick={clearPhotoPreview}>
                              {tr('Xóa ảnh', 'Remove photo', '移除照片', '写真を削除', '사진 제거')}
                            </Button>
                          )}
                        </div>
                        <div className="relative w-28 h-28 rounded-lg border border-dashed border-teal-200 bg-muted/30 overflow-hidden shrink-0">
                          {photo.preview ? (
                            <img src={photo.preview} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground px-1 text-center">
                              {tr('Chưa có ảnh', 'No photo yet', '暂无照片', '未選択', '없음')}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          {tr('Biểu cảm sticker', 'Sticker expression', '贴纸表情', 'ステッカー表情', '스티커 표정')}
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {PHOTO_EXPRESSION_OPTIONS.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setExpressionId(opt.id)}
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors ${
                                expressionId === opt.id
                                  ? 'border-teal-500 bg-teal-50 text-teal-900'
                                  : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                              }`}
                              title={labelForExpression(stickerLocale, opt.id)}
                            >
                              <span aria-hidden>{opt.emoji}</span>
                              {labelForExpression(stickerLocale, opt.id)}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {tr('Chữ trên sticker', 'Text on sticker', '贴纸上的文字', 'ステッカーの文字', '스티커 문구')}
                        </h4>
                        <Textarea
                          value={photoCaption}
                          onChange={(e) => setPhotoCaption(e.target.value.slice(0, 120))}
                          rows={2}
                          className="resize-none text-sm"
                          placeholder={tr(
                            'Sửa chữ mẫu hoặc viết mới (tối đa 120 ký tự).',
                            'Edit the default line or write your own (max 120 characters).',
                            '可修改默认文案或自行输入（最多120字）。',
                            'デフォルトを編集するか新規入力（最大120文字）。',
                            '기본 문구를 수정하거나 직접 입력 (최대 120자).'
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
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
                      onClick={() =>
                        checkCreditsAndProceed(cost, workshopTab === 'idea' ? handleSubmitIdea : handleSubmitPhoto)
                      }
                      disabled={workshopTab === 'idea' ? !prompt.trim() : !photo.file || !photoCaption.trim()}
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
                description={
                  workshopTab === 'idea'
                    ? tr(
                        'AI đang mở rộng ý tưởng và vẽ nhãn nền trong suốt',
                        'AI is expanding idea and drawing transparent label',
                        'AI 正在扩展想法并绘制透明标签',
                        'AIがアイデアを拡張し透明ラベルを描画中',
                        'AI가 아이디어를 확장하고 투명 라벨을 그리는 중'
                      )
                    : tr(
                        'AI đang tạo sticker từ ảnh với biểu cảm và chữ bạn chọn',
                        'AI is creating a sticker from your photo with your expression and caption',
                        'AI 正根据您的照片生成贴纸',
                        'AIが写真と表情・キャプションでステッカーを作成中',
                        'AI가 사진과 표정·문구로 스티커를 만들고 있습니다'
                      )
                }
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
                <ImagePreview src={resultUrl} alt={tr('Nhãn gián', 'Sticker label', '贴纸标签', 'ステッカーラベル', '스티커 라벨')} className="w-full h-full object-contain" printReadyAspectRatio={aspectRatio} />
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={handleReset}>
                  <RefreshCw className="mr-2 h-3 w-3" /> {tr('Thử lại', 'Try again', '重试', '再試行', '다시 시도')}
                </Button>
                <DownloadImageButton
                    imageUrl={resultUrl}
                    filename="nhan-gian"
                    size="sm"
                    className="bg-teal-600 hover:bg-teal-700 text-white border-0"
                    printReady
                    printReadyAspectRatio={aspectRatio}
                    printReadyLabel={tr('Tải PDF chuẩn in', 'Download print-ready PDF', '下载印刷用PDF', '印刷用PDFをダウンロード', '인쇄용 PDF 다운로드')}
                    printReadySuccessToast={tr('Đã tạo PDF chuẩn in. Bleed 3mm, crop marks.', 'Print-ready PDF created. Bleed 3mm, crop marks.', '已生成印刷用PDF。出血3mm，裁切线。', '印刷用PDFを作成しました。塗り足し3mm、トンボ付き。', '인쇄용 PDF 생성됨. 블리드 3mm, 크롭 마크.')}
                  />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">{tr('Ảnh do AI tạo có thể có sai sót. Nền trong suốt phụ thuộc model.', 'AI-generated images may contain errors. Transparency depends on model.', 'AI 生成结果可能存在误差。透明度取决于模型。', 'AI生成結果には誤差が含まれる場合があります。透明度はモデルに依存。', 'AI 생성 결과에는 오차가 있을 수 있습니다. 투명도는 모델에 따라 다릅니다.')}</p>
    </>
  )
}
