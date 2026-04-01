'use client'

import { useState, useRef, ChangeEvent, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createVeoVideo } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, RefreshCw, Video, FileText, ImageIcon } from 'lucide-react'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { ImagePreview } from '@/components/ui/image-preview'
import { ImageProcessingLoader } from '@/components/image-processing-loader'
import { preloadImageUrl } from '@/lib/preload-image-url'
import { cn } from '@/lib/utils'

type Step = 'UPLOAD' | 'GENERATING' | 'RESULT'
type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'
type VideoMode = 'text' | 'image'
type AspectRatio = '16:9' | '9:16'
type Resolution = '720p' | '1080p' | '4k'
type DurationSec = 4 | 6 | 8

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

function videoCredits(resolution: Resolution, durationSeconds: DurationSec): number {
  if (resolution === '4k') return 28
  if (resolution === '1080p') return 16
  if (durationSeconds === 4) return 6
  if (durationSeconds === 6) return 7
  return 8
}

const setImageFromFile = (file: File, setImage: (v: { file: File; preview: string }) => void) => {
  if (!file.type.startsWith('image/')) return false
  setImage({ file, preview: URL.createObjectURL(file) })
  return true
}

export default function TaoVideoTuAnhClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [step, setStep] = useState<Step>('UPLOAD')
  const [mode, setMode] = useState<VideoMode>('image')
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9')
  const [resolution, setResolution] = useState<Resolution>('720p')
  const [durationSeconds, setDurationSeconds] = useState<DurationSec>(8)
  const [image, setImage] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [promptText, setPromptText] = useState('')
  const [promptImage, setPromptImage] = useState('')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const cost = videoCredits(resolution, durationSeconds)
  const durationLocked = resolution === '1080p' || resolution === '4k'
  const aspectLocked = resolution === '4k'

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
    if (resolution === '1080p' || resolution === '4k') setDurationSeconds(8)
    if (resolution === '4k') setAspectRatio('16:9')
  }, [resolution])

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setImageFromFile(file, setImage)
  }

  const canSubmit =
    mode === 'text'
      ? promptText.trim().length >= 8
      : Boolean(image.file)

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast({
        title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
        description:
          mode === 'text'
            ? tr('Nhập mô tả video (ít nhất 8 ký tự).', 'Enter a video description (at least 8 characters).', '请输入至少 8 个字符的视频描述。', '動画の説明を8文字以上入力してください。', '설명을 8자 이상 입력하세요.')
            : tr('Vui lòng tải lên ảnh.', 'Please upload an image.', '请上传图片。', '画像をアップロードしてください。', '이미지를 업로드해 주세요.'),
        variant: 'destructive',
      })
      return
    }
    setStep('GENERATING')
    const formData = new FormData()
    formData.append('mode', mode)
    formData.append('aspectRatio', aspectRatio)
    formData.append('resolution', resolution)
    formData.append('durationSeconds', String(durationSeconds))
    formData.append('prompt', mode === 'text' ? promptText : promptImage)
    if (mode === 'image' && image.file) formData.append('image', image.file)

    const result = await createVeoVideo(formData)
    if (result.error) {
      setStep('UPLOAD')
      toast({
        title: tr('Tạo video thất bại', 'Create video failed', '创建视频失败', '動画作成に失敗しました', '비디오 생성 실패'),
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
        description: tr('Đã tạo video.', 'Video created.', '已创建视频。', '動画を作成しました。', '비디오가 생성되었습니다.'),
        duration: 3000,
      })
    }
  }

  const handleReset = () => {
    setStep('UPLOAD')
    setImage({ file: null, preview: null })
    setPromptText('')
    setPromptImage('')
    setResultUrl(null)
  }

  const optionBtn = (active: boolean) =>
    cn(
      'w-full px-3 py-2.5 rounded-md border text-sm font-medium transition-colors text-left',
      active ? 'border-violet-500 bg-violet-50 text-violet-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
    )

  return (
    <>
      <Toaster />
      <div className="tool-page-container">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
            <Video className="h-8 w-8 text-violet-600" />{' '}
            {tr('Tạo video AI (Veo 3.1)', 'AI video (Veo 3.1)', 'AI 视频（Veo 3.1）', 'AI動画（Veo 3.1）', 'AI 비디오 (Veo 3.1)')}
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl mx-auto text-sm">
            {tr(
              'Chọn tạo từ mô tả văn bản hoặc từ ảnh khung đầu. Tỷ lệ 16:9 / 9:16, 720p / 1080p / 4K, thời lượng 4–8 giây (theo quy tắc Veo). Có âm thanh.',
              'Choose text-to-video or image-to-video. Aspect 16:9 / 9:16, 720p / 1080p / 4K, duration 4–8s (per Veo rules). Includes audio.',
              '可选文生视频或图生视频。比例 16:9 / 9:16，720p / 1080p / 4K，时长 4–8 秒（按 Veo 规则）。含音频。',
              'テキストから動画、または先頭フレーム画像から。16:9/9:16、720p/1080p/4K、4〜8秒（Veoの制約に準拠）。音声付き。',
              '텍스트→비디오 또는 이미지(첫 프레임). 16:9/9:16, 720p/1080p/4K, 4–8초(Veo 규칙). 음성 포함.'
            )}
          </p>
        </div>

        {step === 'UPLOAD' && (
          <div className="grid lg:grid-cols-[1fr_240px] gap-4 items-start">
            <div className="min-w-0 space-y-4">
              <Tabs value={mode} onValueChange={(v) => setMode(v as VideoMode)} className="w-full">
                <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 h-10">
                  <TabsTrigger value="text" className="gap-1.5">
                    <FileText className="h-4 w-4 shrink-0" />
                    {tr('Từ văn bản', 'From text', '从文字', 'テキスト', '텍스트')}
                  </TabsTrigger>
                  <TabsTrigger value="image" className="gap-1.5">
                    <ImageIcon className="h-4 w-4 shrink-0" />
                    {tr('Từ ảnh', 'From image', '从图片', '画像', '이미지')}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="text" className="mt-4">
                  <Card className="border shadow-sm bg-white/80 backdrop-blur border-violet-200/60">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-base">{tr('Mô tả video', 'Video description', '视频描述', '動画の説明', '비디오 설명')}</CardTitle>
                      <CardDescription className="text-xs">
                        {tr(
                          'Mô tả cảnh, chuyển động camera, phong cách, âm thanh / lời thoại (trong ngoặc kép). Tối thiểu 8 ký tự.',
                          'Describe the scene, camera motion, style, and sound / dialogue (in quotes). At least 8 characters.',
                          '描述场景、镜头、风格及音效/对白（引号内）。至少 8 个字符。',
                          'シーン・カメラ・スタイル・音/セリフ（引用）を記述。8文字以上。',
                          '장면, 카메라, 스타일, 음성/대사(따옴표)를 설명하세요. 최소 8자.'
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <Textarea
                        value={promptText}
                        onChange={(e) => setPromptText(e.target.value)}
                        className="min-h-[140px] bg-white/80"
                        maxLength={2000}
                        placeholder={tr(
                          'VD: Cảnh quay cinematic hoàng hôn trên biển, sóng vỗ nhẹ, tiếng chim và gió...',
                          'e.g. Cinematic sunset over the ocean, gentle waves, distant birds and wind...',
                          '例如：电影感海边日落，轻浪、风声……',
                          '例：シネマティックな海の夕焼け、穏やかな波と風の音…',
                          '예: 시네마틱한 해변 노을, 잔잔한 파도와 바람 소리…'
                        )}
                      />
                      <p className="text-[10px] text-muted-foreground mt-1 text-right">{promptText.length}/2000</p>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="image" className="mt-4">
                  <Card className="border shadow-sm bg-white/80 backdrop-blur border-violet-200/60">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Upload className="h-4 w-4 text-violet-600" /> {tr('Ảnh khung đầu', 'Start frame image', '首帧图片', '開始フレーム画像', '시작 프레임 이미지')}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {tr(
                          'Ảnh làm khung đầu video. Có thể thêm mô tả chuyển động bên dưới.',
                          'Image used as the first frame. You can add motion description below.',
                          '作为视频首帧的图片。可在下方补充运动描述。',
                          '動画の先頭フレームに使う画像。下に動きの説明を追加できます。',
                          '비디오 첫 프레임으로 쓸 이미지. 아래에 움직임 설명을 추가할 수 있습니다.'
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-4">
                      <label
                        htmlFor="video-input"
                        className="block w-full aspect-video max-h-[320px] rounded-lg border-2 border-dashed border-violet-200 bg-violet-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-violet-300 hover:bg-violet-50/80 transition-colors"
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
                          <RefreshCw className="h-3.5 w-3.5" /> {tr('Chọn lại', 'Choose again', '重新选择', '選び直す', '다시 선택')}
                        </button>
                      )}
                      <input id="video-input" ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {tr('Mô tả chuyển động (tùy chọn)', 'Motion description (optional)', '运动描述（可选）', '動きの説明（任意）', '모션 설명 (선택)')}
                        </label>
                        <Textarea
                          value={promptImage}
                          onChange={(e) => setPromptImage(e.target.value)}
                          className="min-h-[80px] bg-white/80"
                          maxLength={500}
                          placeholder={tr(
                            'Để trống để AI tự làm mượt chuyển động từ ảnh.',
                            'Leave empty for subtle motion from the image.',
                            '留空则根据图片生成自然微动。',
                            '空欄で画像から自然な動きを生成。',
                            '비워 두면 이미지 기반 자연스러운 움직임.'
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            <div className="lg:w-[240px] lg:shrink-0 space-y-4">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-violet-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">{tr('Định dạng đầu ra', 'Output format', '输出格式', '出力形式', '출력 형식')}</CardTitle>
                  <CardDescription className="text-xs">{tr('Theo API Veo 3.1', 'Per Veo 3.1 API', '按 Veo 3.1 API', 'Veo 3.1 APIに準拠', 'Veo 3.1 API 기준')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Tỷ lệ', 'Aspect', '比例', 'アスペクト比', '화면비')}</h4>
                    <button type="button" disabled={aspectLocked} className={optionBtn(aspectRatio === '16:9')} onClick={() => setAspectRatio('16:9')}>
                      16:9 {tr('(ngang)', '(landscape)', '（横屏）', '（横）', '(가로)')}
                    </button>
                    <button type="button" disabled={aspectLocked} className={optionBtn(aspectRatio === '9:16')} onClick={() => setAspectRatio('9:16')}>
                      9:16 {tr('(dọc)', '(portrait)', '（竖屏）', '（縦）', '(세로)')}
                    </button>
                    {aspectLocked ? (
                      <p className="text-[10px] text-amber-700">{tr('4K chỉ 16:9', '4K is 16:9 only', '4K 仅 16:9', '4Kは16:9のみ', '4K는 16:9만')}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Độ phân giải', 'Resolution', '分辨率', '解像度', '해상도')}</h4>
                    {(['720p', '1080p', '4k'] as const).map((r) => (
                      <button key={r} type="button" className={optionBtn(resolution === r)} onClick={() => setResolution(r)}>
                        {r.toUpperCase()}
                        {r === '720p' ? ` (${tr('4/6/8s', '4/6/8s', '4/6/8秒', '4/6/8秒', '4/6/8초')})` : null}
                        {r === '1080p' ? ` (${tr('chỉ 8s', '8s only', '仅 8 秒', '8秒のみ', '8초만')})` : null}
                        {r === '4k' ? ` (${tr('chỉ 8s, 16:9', '8s, 16:9 only', '仅 8 秒 16:9', '8秒・16:9', '8초·16:9')})` : null}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Thời lượng', 'Duration', '时长', '長さ', '길이')}</h4>
                    {([4, 6, 8] as const).map((d) => {
                      const disabled = durationLocked && d !== 8
                      const label720 = resolution === '720p' && !durationLocked
                      const suffix =
                        label720
                          ? ` (${videoCredits('720p', d)} credit)`
                          : durationLocked && d === 8
                            ? ` (${cost} credit)`
                            : ''
                      return (
                        <button
                          key={d}
                          type="button"
                          disabled={disabled}
                          className={optionBtn(durationSeconds === d)}
                          onClick={() => setDurationSeconds(d)}
                        >
                          {d}s{suffix}
                        </button>
                      )
                    })}
                    {durationLocked ? (
                      <p className="text-[10px] text-muted-foreground">
                        {tr('1080p/4K: chỉ 8 giây.', '1080p/4K: 8 seconds only.', '1080p/4K：仅 8 秒。', '1080p/4Kは8秒のみ。', '1080p/4K: 8초만.')}
                      </p>
                    ) : null}
                  </div>

                  <div className="pt-3 border-t space-y-2 flex flex-col items-stretch">
                    <p className="text-sm font-semibold text-violet-900 text-center">
                      {tr('Chi phí:', 'Cost:', '费用：', '料金：', '비용:')} {cost} credit
                    </p>
                    <DepositCreditButton variant="outline" size="sm" className="w-full border-violet-200 text-violet-700 hover:bg-violet-50" />
                    <Button
                      onClick={() => checkCreditsAndProceed(cost, handleSubmit)}
                      disabled={!canSubmit}
                      className="w-full h-9 shadow-md hover:shadow-lg transition-all text-sm bg-violet-600 hover:bg-violet-700 text-white"
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> {tr('Tạo video', 'Create video', '创建视频', '動画を作成', '비디오 만들기')}
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground">
                      {tr('* Thường 1–6 phút', '* Usually 1–6 min', '* 通常 1–6 分钟', '* 目安1〜6分', '* 보통 1–6분')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === 'GENERATING' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-violet-200/60">
            <CardContent className="flex flex-col items-center py-12">
              <ImageProcessingLoader
                mode="interior"
                title={tr('Đang tạo video', 'Creating video', '正在创建视频', '動画を作成中', '비디오 생성 중')}
                description={tr(
                  'Veo 3.1 đang xử lý. Có thể mất 1–6 phút.',
                  'Veo 3.1 is processing. May take 1–6 minutes.',
                  'Veo 3.1 处理中，可能需要 1–6 分钟。',
                  'Veo 3.1が処理中です。1〜6分かかる場合があります。',
                  'Veo 3.1 처리 중. 1–6분 걸릴 수 있습니다.'
                )}
                imagePreview={mode === 'image' ? image.preview : null}
              />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>{tr('Kết quả', 'Result', '结果', '結果', '결과')}</CardTitle>
              <CardDescription>{tr('Video đã tạo xong.', 'Your video is ready.', '视频已生成。', '動画の準備ができました。', '비디오가 준비되었습니다.')}</CardDescription>
            </CardHeader>
            <CardContent className={cn('grid gap-6', mode === 'image' && image.preview ? 'md:grid-cols-2' : 'md:grid-cols-1')}>
              {mode === 'image' && image.preview ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">{tr('Ảnh gốc', 'Source image', '原图', '元画像', '원본 이미지')}</h3>
                  <div className="aspect-video rounded-lg border overflow-hidden">
                    <ImagePreview src={image.preview} alt="" className="w-full h-full object-cover" />
                  </div>
                </div>
              ) : null}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm font-medium text-muted-foreground">{tr('Video', 'Video', '视频', '動画', '비디오')}</h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleReset}>
                      <RefreshCw className="mr-2 h-3 w-3" /> {tr('Thử lại', 'Try again', '重试', '再試行', '다시 시도')}
                    </Button>
                    <Button
                      size="sm"
                      className="bg-violet-600 hover:bg-violet-700 text-white border-0"
                      onClick={async () => {
                        try {
                          const res = await fetch(resultUrl)
                          const blob = await res.blob()
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = 'video-ai.mp4'
                          a.click()
                          URL.revokeObjectURL(url)
                        } catch {
                          window.open(resultUrl, '_blank')
                        }
                      }}
                    >
                      {tr('Tải video', 'Download video', '下载视频', '動画をダウンロード', '비디오 다운로드')}
                    </Button>
                  </div>
                </div>
                <div className="aspect-video rounded-lg border overflow-hidden bg-black max-w-3xl mx-auto md:mx-0">
                  <video src={resultUrl} controls className="w-full h-full" playsInline>
                    {tr('Trình duyệt không hỗ trợ video.', 'Browser does not support video.', '浏览器不支持视频。', 'ブラウザが動画をサポートしていません。', '브라우저가 비디오를 지원하지 않습니다.')}
                  </video>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">
        {tr('Video do AI tạo có thể có sai sót. Tuân thủ điều khoản và luật địa phương về nội dung có người.', 'AI-generated video may be imperfect. Follow terms and local rules for people in content.', 'AI 视频可能有误差。请遵守条款及当地关于人物内容的法规。', 'AI生成には誤りがあります。人物を含むコンテンツは利用規約と法令に従ってください。', 'AI 생성물에는 오류가 있을 수 있습니다. 인물 콘텐츠는 약관과 현지 법규를 준수하세요.')}
      </p>
    </>
  )
}
