'use client'

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

import { useState, useRef, ChangeEvent, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { beautifyImage } from './actions'
import { getDictionary } from '@/lib/i18n/dictionaries'
import {
  finalizeStandardImageGenerationResult,
  waitForNextPaintClient,
} from '@/lib/client/finalize-standard-image-generation-result'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, RefreshCw, Link2 } from 'lucide-react'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { DownloadImageButton } from '@/components/download-image-button'
import { ImagePreview } from '@/components/ui/image-preview'
import { BeforeAfterResultDisplay } from '@/components/image-tools/before-after-result-display'
import { ImageProcessingLoader } from '@/components/image-processing-loader'

type Step = 'UPLOAD' | 'GENERATING' | 'RESULT'
type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'
type PersonCount = 1 | 2 | 3 | 4
type BeautifyStyle = 'natural' | 'korean' | 'pro_sharp' | 'beauty_glow' | 'male_elegant' | 'female_soft' | 'mixed_group'
type BeautifyStrength = 'light' | 'medium' | 'strong'

function getWebLocaleFromCookie(): UiLocale {
  if (typeof document === 'undefined') return 'vi'
  const cookieValue = readWebLocaleFromDocumentCookie()
  if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') return cookieValue
  return 'vi'
}

const PERSON_LABELS: Record<UiLocale, Record<PersonCount, string[]>> = {
  vi: {
    1: ['Người trong ảnh'],
    2: ['Người bên trái', 'Người bên phải'],
    3: ['Người bên trái', 'Người ở giữa', 'Người bên phải'],
    4: ['Người 1 (từ trái)', 'Người 2', 'Người 3', 'Người 4'],
  },
  en: {
    1: ['Person in image'],
    2: ['Left person', 'Right person'],
    3: ['Left person', 'Center person', 'Right person'],
    4: ['Person 1 (left)', 'Person 2', 'Person 3', 'Person 4'],
  },
  zh: {
    1: ['图中人物'],
    2: ['左侧人物', '右侧人物'],
    3: ['左侧人物', '中间人物', '右侧人物'],
    4: ['人物1（左）', '人物2', '人物3', '人物4'],
  },
  ja: {
    1: ['写真内の人物'],
    2: ['左の人物', '右の人物'],
    3: ['左の人物', '中央の人物', '右の人物'],
    4: ['人物1（左）', '人物2', '人物3', '人物4'],
  },
  ko: {
    1: ['사진 속 인물'],
    2: ['왼쪽 인물', '오른쪽 인물'],
    3: ['왼쪽 인물', '가운데 인물', '오른쪽 인물'],
    4: ['인물 1(왼쪽)', '인물 2', '인물 3', '인물 4'],
  },
}

const setImageFromFile = (file: File, setImage: (v: { file: File; preview: string }) => void) => {
  if (!file.type.startsWith('image/')) return false
  setImage({ file, preview: URL.createObjectURL(file) })
  return true
}

export default function LamDepAnhClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [step, setStep] = useState<Step>('UPLOAD')
  const [image, setImage] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const [personCount, setPersonCount] = useState<PersonCount>(1)
  const [personGenders, setPersonGenders] = useState<('male' | 'female')[]>(['female'])
  const [beautifyStyle, setBeautifyStyle] = useState<BeautifyStyle>('natural')
  const [beautifyStrength, setBeautifyStrength] = useState<BeautifyStrength>('medium')
  const [backgroundBlurStrength, setBackgroundBlurStrength] = useState(35)
  const [note, setNote] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cost = imageQuality === '2K' ? 1.5 : 3
  const t = useMemo(() => {
    if (uiLocale === 'en') {
      return {
        err: 'Error', title: 'Beautify Image', subtitle: 'Studio-like retouch for 1-4 people while preserving identity and scene.',
        uploadCard: 'Upload image to beautify', uploadDesc: 'Choose portrait image, paste one (Ctrl+V), or paste an image URL.',
        chooseOrPaste: 'Choose image or paste (Ctrl+V)', reselect: 'Select again', urlPlaceholder: 'Paste image URL then click Fetch',
        loading: 'Loading...', fetchImage: 'Fetch image', options: 'Options', peopleCount: 'People in image',
        peopleGender: 'Gender per person', noteTitle: 'Extra request', notePlaceholder: 'e.g. smoother skin, keep beard...',
        styleTitle: 'Beautify style', levelTitle: 'Strength', blurTitle: 'Professional background blur', blurHint: '0% keeps full background detail, 100% applies strongest blur.',
        qualityTitle: 'Image quality', beautify: 'Beautify', timeHint: '* Time: 15-45 seconds',
        generatingTitle: 'Beautifying image', generatingDesc: 'AI is retouching subjects and only blurring original background',
        resultTitle: 'Beautify result', resultDesc: 'Image has been beautified.', before: 'Before', after: 'After', retry: 'Try again', footer: 'AI-generated images may contain minor errors.',
      }
    }
    if (uiLocale === 'zh') {
      return {
        err: '错误', title: '人像美化', subtitle: '1-4 人影棚级美化，保留原有人脸特征与场景。',
        uploadCard: '上传待美化图片', uploadDesc: '可选择人像图片、粘贴图片（Ctrl+V）或粘贴链接。',
        chooseOrPaste: '选择图片或粘贴图片（Ctrl+V）', reselect: '重新选择', urlPlaceholder: '粘贴图片链接后点击获取图片',
        loading: '加载中...', fetchImage: '获取图片', options: '选项', peopleCount: '图片中的人数',
        peopleGender: '每人性别', noteTitle: '额外要求', notePlaceholder: '例如：优先磨皮，保留胡须...',
        styleTitle: '美化风格', levelTitle: '强度', blurTitle: '专业背景虚化', blurHint: '0% 保持背景清晰，100% 虚化最强。',
        qualityTitle: '图片质量', beautify: '美化', timeHint: '* 耗时：15-45 秒',
        generatingTitle: '正在美化图片', generatingDesc: 'AI 正在优化人物并仅对原背景做虚化',
        resultTitle: '美化结果', resultDesc: '图片已完成美化。', before: '之前', after: '之后', retry: '重试', footer: 'AI 生成结果可能存在误差。',
      }
    }
    if (uiLocale === 'ja') {
      return {
        err: 'エラー', title: '写真美化', subtitle: '1-4人をスタジオ風に補正し、顔の特徴と元の背景を維持します。',
        uploadCard: '美化する画像をアップロード', uploadDesc: 'ポートレート画像の選択、貼り付け（Ctrl+V）、リンク貼り付けに対応。',
        chooseOrPaste: '画像を選択または貼り付け（Ctrl+V）', reselect: '再選択', urlPlaceholder: '画像リンクを貼って「取得」を押してください',
        loading: '読み込み中...', fetchImage: '画像を取得', options: 'オプション', peopleCount: '画像内の人数',
        peopleGender: '各人物の性別', noteTitle: '追加要望', notePlaceholder: '例：肌をなめらかに、ひげは維持...',
        styleTitle: '美化スタイル', levelTitle: '強さ', blurTitle: '背景ぼかし（プロ）', blurHint: '0% は背景を鮮明に維持、100% は最も強いぼかし。',
        qualityTitle: '画質', beautify: '美化', timeHint: '* 時間：15-45秒',
        generatingTitle: '画像を美化中', generatingDesc: 'AI が人物を補正し、元背景のみをぼかしています',
        resultTitle: '美化結果', resultDesc: '画像の美化が完了しました。', before: '前', after: '後', retry: 'やり直す', footer: 'AI生成結果には誤差が含まれる場合があります。',
      }
    }
    if (uiLocale === 'ko') {
      return {
        err: '오류', title: '사진 보정', subtitle: '1-4명을 스튜디오처럼 보정하며 얼굴 특징과 원본 배경을 유지합니다.',
        uploadCard: '보정할 이미지 업로드', uploadDesc: '인물 사진 선택, 붙여넣기(Ctrl+V), 링크 붙여넣기 지원.',
        chooseOrPaste: '이미지를 선택하거나 붙여넣기(Ctrl+V)', reselect: '다시 선택', urlPlaceholder: '이미지 링크를 붙여넣고 가져오기를 누르세요',
        loading: '불러오는 중...', fetchImage: '가져오기', options: '옵션', peopleCount: '이미지 인원 수',
        peopleGender: '인물별 성별', noteTitle: '추가 요청', notePlaceholder: '예: 피부를 더 매끈하게, 수염 유지...',
        styleTitle: '보정 스타일', levelTitle: '강도', blurTitle: '전문 배경 흐림', blurHint: '0%는 배경을 선명하게 유지, 100%는 가장 강한 흐림입니다.',
        qualityTitle: '이미지 품질', beautify: '보정', timeHint: '* 시간: 15-45초',
        generatingTitle: '이미지 보정 중', generatingDesc: 'AI가 인물을 보정하고 원본 배경만 흐리게 처리 중입니다',
        resultTitle: '보정 결과', resultDesc: '이미지 보정이 완료되었습니다.', before: '전', after: '후', retry: '다시 시도', footer: 'AI 생성 결과에는 오차가 있을 수 있습니다.',
      }
    }
    return {
      err: 'Lỗi', title: 'Làm đẹp ảnh', subtitle: 'Retouch ảnh 1-4 người như studio, giữ nguyên nét mặt và bối cảnh gốc.',
      uploadCard: 'Tải ảnh cần làm đẹp', uploadDesc: 'Chọn ảnh chân dung, dán ảnh (Ctrl+V) hoặc dán link ảnh.',
      chooseOrPaste: 'Chọn ảnh hoặc dán ảnh (Ctrl+V)', reselect: 'Chọn lại', urlPlaceholder: 'Dán link ảnh rồi bấm Lấy ảnh',
      loading: 'Đang tải...', fetchImage: 'Lấy ảnh', options: 'Tùy chọn', peopleCount: 'Số người trong ảnh',
      peopleGender: 'Giới tính từng người', noteTitle: 'Yêu cầu thêm', notePlaceholder: 'Ví dụ: ưu tiên da mịn, giữ râu...',
      styleTitle: 'Phong cách làm đẹp', levelTitle: 'Mức độ', blurTitle: 'Xóa phông chuyên nghiệp', blurHint: '0% = giữ nền rõ hoàn toàn, 100% = xóa phông mạnh.',
      qualityTitle: 'Chất lượng ảnh', beautify: 'Làm đẹp', timeHint: '* Thời gian: 15-45 giây',
      generatingTitle: 'Đang làm đẹp ảnh', generatingDesc: 'AI đang retouch chủ thể và chỉ xóa phông nền gốc',
      resultTitle: 'Kết quả làm đẹp', resultDesc: 'Ảnh đã được làm đẹp.', before: 'Trước', after: 'Sau', retry: 'Thử lại', footer: 'Ảnh do AI tạo có thể có sai sót.',
    }
  }, [uiLocale])
  const genClient = useMemo(() => getDictionary(uiLocale).imageGenerationClient, [uiLocale])

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setImageFromFile(file, setImage)
  }

  const handleFetchFromUrl = async () => {
    const url = imageUrl.trim()
    if (!url) {
      toast({ title: t.err, description: t.urlPlaceholder, variant: 'destructive' })
      return
    }
    if (!/^https?:\/\//i.test(url)) {
      toast({ title: t.err, description: uiLocale === 'vi' ? 'Link không hợp lệ.' : uiLocale === 'en' ? 'Invalid URL.' : uiLocale === 'zh' ? '链接无效。' : uiLocale === 'ja' ? '無効なリンクです。' : '유효하지 않은 링크입니다.', variant: 'destructive' })
      return
    }
    setUrlLoading(true)
    try {
      const res = await fetch(url, { mode: 'cors' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      if (!blob.type.startsWith('image/')) throw new Error(uiLocale === 'vi' ? 'Không phải ảnh' : uiLocale === 'en' ? 'Not an image' : uiLocale === 'zh' ? '不是图片' : uiLocale === 'ja' ? '画像ではありません' : '이미지 파일이 아닙니다')
      const file = new File([blob], 'image-from-url.png', { type: blob.type || 'image/png' })
      setImageFromFile(file, setImage)
      setImageUrl('')
      toast({ title: uiLocale === 'vi' ? 'Đã tải ảnh' : uiLocale === 'en' ? 'Image loaded' : uiLocale === 'zh' ? '图片已加载' : uiLocale === 'ja' ? '画像を読み込みました' : '이미지를 불러왔습니다', description: uiLocale === 'vi' ? 'Ảnh từ link đã được thêm.' : uiLocale === 'en' ? 'Image from URL was added.' : uiLocale === 'zh' ? '已添加来自链接的图片。' : uiLocale === 'ja' ? 'リンク画像を追加しました。' : '링크 이미지가 추가되었습니다.', duration: 2000 })
    } catch {
      toast({
        title: uiLocale === 'vi' ? 'Không tải được ảnh' : uiLocale === 'en' ? 'Cannot load image' : uiLocale === 'zh' ? '无法加载图片' : uiLocale === 'ja' ? '画像を読み込めません' : '이미지를 불러올 수 없습니다',
        description: uiLocale === 'vi' ? 'Link có thể bị chặn CORS. Thử tải ảnh lên trực tiếp.' : uiLocale === 'en' ? 'The URL may be blocked by CORS. Please upload directly.' : uiLocale === 'zh' ? '链接可能被 CORS 阻止。请直接上传图片。' : uiLocale === 'ja' ? 'CORS によりブロックされた可能性があります。直接アップロードしてください。' : 'CORS 차단일 수 있습니다. 직접 업로드해 주세요.',
        variant: 'destructive',
        duration: 5000,
      })
    } finally {
      setUrlLoading(false)
    }
  }

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
            toast({ title: uiLocale === 'vi' ? 'Đã dán ảnh' : uiLocale === 'en' ? 'Image pasted' : uiLocale === 'zh' ? '已粘贴图片' : uiLocale === 'ja' ? '画像を貼り付けました' : '이미지를 붙여넣었습니다', description: uiLocale === 'vi' ? 'Ảnh từ clipboard đã được thêm.' : uiLocale === 'en' ? 'Image from clipboard was added.' : uiLocale === 'zh' ? '已添加剪贴板图片。' : uiLocale === 'ja' ? 'クリップボード画像を追加しました。' : '클립보드 이미지가 추가되었습니다.', duration: 2000 })
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
  }, [step, toast, uiLocale])

  const handleSubmit = async () => {
    if (!image.file) {
      toast({ title: t.err, description: uiLocale === 'vi' ? 'Vui lòng tải lên ảnh cần làm đẹp.' : uiLocale === 'en' ? 'Please upload an image to beautify.' : uiLocale === 'zh' ? '请上传需要美化的图片。' : uiLocale === 'ja' ? '美化する画像をアップロードしてください。' : '보정할 이미지를 업로드해 주세요.', variant: 'destructive' })
      return
    }
    setStep('GENERATING')
    await waitForNextPaintClient()
    const formData = new FormData()
    formData.append('image', image.file)
    formData.append('imageQuality', imageQuality)
    formData.append('personCount', String(personCount))
    formData.append('beautifyStyle', beautifyStyle)
    formData.append('beautifyStrength', beautifyStrength)
    formData.append('backgroundBlurStrength', String(backgroundBlurStrength))
    for (let i = 0; i < personCount; i++) {
      formData.append(`person_${i}_gender`, personGenders[i] ?? 'female')
    }
    formData.append('note', note)
    try {
      const result = await beautifyImage(formData)
      await finalizeStandardImageGenerationResult(result, {
        onServerErrorMessage: (message) => {
          setStep('UPLOAD')
          toast({
            title: uiLocale === 'vi' ? 'Làm đẹp thất bại' : uiLocale === 'en' ? 'Beautify failed' : uiLocale === 'zh' ? '美化失败' : uiLocale === 'ja' ? '美化に失敗しました' : '보정 실패',
            description: message,
            variant: 'destructive',
            duration: 5000,
          })
        },
        onSuccessWithUrl: (url) => {
          setResultUrl(url)
          setStep('RESULT')
          toast({
            title: uiLocale === 'vi' ? 'Thành công!' : uiLocale === 'en' ? 'Success!' : uiLocale === 'zh' ? '成功！' : uiLocale === 'ja' ? '成功' : '성공!',
            description: t.resultDesc,
            duration: 3000,
          })
        },
        onUnexpectedPayload: () => {
          setStep('UPLOAD')
          toast({
            title: uiLocale === 'vi' ? 'Làm đẹp thất bại' : uiLocale === 'en' ? 'Beautify failed' : uiLocale === 'zh' ? '美化失败' : uiLocale === 'ja' ? '美化に失敗しました' : '보정 실패',
            description: genClient.unexpectedNoUrl,
            variant: 'destructive',
            duration: 6000,
          })
        },
      })
    } catch (e) {
      setStep('UPLOAD')
      toast({
        title: uiLocale === 'vi' ? 'Làm đẹp thất bại' : uiLocale === 'en' ? 'Beautify failed' : uiLocale === 'zh' ? '美化失败' : uiLocale === 'ja' ? '美化に失敗しました' : '보정 실패',
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

  const handlePersonCountChange = (n: PersonCount) => {
    setPersonCount(n)
    setPersonGenders((prev) => {
      const next = [...prev.slice(0, n)]
      while (next.length < n) next.push('female')
      return next
    })
  }

  const setPersonGender = (i: number, g: 'male' | 'female') => {
    setPersonGenders((prev) => {
      const next = [...prev]
      next[i] = g
      return next
    })
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
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-rose-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="h-4 w-4 text-rose-600" /> {t.uploadCard}
                  </CardTitle>
                  <CardDescription className="text-xs">{t.uploadDesc}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <div className="rounded-lg space-y-2">
                    <label
                      htmlFor="lam-dep-input"
                      className="block w-full aspect-[4/3] max-h-[400px] rounded-lg border-2 border-dashed border-rose-200 bg-rose-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-rose-300 hover:bg-rose-50/80 transition-colors"
                    >
                      {image.preview ? (
                        <ImagePreview src={image.preview} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                      ) : (
                        <>
                          <Upload className="h-12 w-12 text-rose-500" />
                          <p className="text-sm text-muted-foreground font-medium">{t.chooseOrPaste}</p>
                        </>
                      )}
                    </label>
                    {image.preview && (
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <RefreshCw className="h-3.5 w-3.5" /> {t.reselect}
                      </button>
                    )}
                  </div>
                  <input
                    id="lam-dep-input"
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder={t.urlPlaceholder}
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleFetchFromUrl}
                      disabled={urlLoading}
                      className="shrink-0 border-rose-200 text-rose-700 hover:bg-rose-50"
                    >
                      <Link2 className="mr-2 h-4 w-4" />
                      {urlLoading ? t.loading : t.fetchImage}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="lg:w-[220px] lg:shrink-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-rose-200/60 h-full">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">{t.options}</CardTitle>
                  <CardDescription className="text-xs">{uiLocale === 'vi' ? 'Chọn số người và giới tính từng người (từ trái sang phải).' : uiLocale === 'en' ? 'Choose people count and each person gender (left to right).' : uiLocale === 'zh' ? '选择人数与每个人的性别（从左到右）。' : uiLocale === 'ja' ? '人数と各人物の性別を設定（左から右）。' : '인원 수와 각 인물 성별을 설정하세요(왼쪽부터).'}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.peopleCount}</h4>
                    <div className="flex flex-wrap gap-1">
                      {([1, 2, 3, 4] as const).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => handlePersonCountChange(n)}
                          className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                            personCount === n
                              ? 'border-rose-500 bg-rose-50 text-rose-800'
                              : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                          }`}
                        >
                          {uiLocale === 'vi' ? `${n} người` : n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.peopleGender}</h4>
                    <div className="space-y-2">
                      {Array.from({ length: personCount }, (_, i) => (
                        <div key={i} className="space-y-1">
                          <span className="text-[10px] text-muted-foreground block">{PERSON_LABELS[uiLocale][personCount][i]}</span>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => setPersonGender(i, 'male')}
                              className={`flex-1 px-2 py-1.5 rounded border text-xs font-medium ${
                                personGenders[i] === 'male'
                                  ? 'border-rose-500 bg-rose-50 text-rose-800'
                                  : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                              }`}
                            >
                              {uiLocale === 'vi' ? 'Nam' : uiLocale === 'en' ? 'Male' : uiLocale === 'zh' ? '男' : uiLocale === 'ja' ? '男性' : '남성'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setPersonGender(i, 'female')}
                              className={`flex-1 px-2 py-1.5 rounded border text-xs font-medium ${
                                personGenders[i] === 'female'
                                  ? 'border-rose-500 bg-rose-50 text-rose-800'
                                  : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                              }`}
                            >
                              {uiLocale === 'vi' ? 'Nữ' : uiLocale === 'en' ? 'Female' : uiLocale === 'zh' ? '女' : uiLocale === 'ja' ? '女性' : '여성'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.noteTitle}</h4>
                    <Textarea
                      placeholder={t.notePlaceholder}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="bg-white/80 text-xs h-20 min-h-[80px] resize-y"
                    />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.styleTitle}</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        ['natural', 'Tự nhiên'],
                        ['korean', 'Makeup nhẹ Hàn'],
                        ['pro_sharp', 'Sắc nét chuyên nghiệp'],
                        ['beauty_glow', 'Beauty glow'],
                        ['male_elegant', 'Nam lịch lãm'],
                        ['female_soft', 'Nữ mềm mại'],
                        ['mixed_group', 'Nhóm nam + nữ'],
                      ] as [BeautifyStyle, string][]).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setBeautifyStyle(value)}
                          className={`px-2 py-2 rounded-md border text-[11px] font-medium transition-colors ${
                            beautifyStyle === value
                              ? 'border-rose-500 bg-rose-50 text-rose-800'
                              : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.levelTitle}</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        ['light', 'Nhẹ'],
                        ['medium', 'Vừa'],
                        ['strong', 'Mạnh'],
                      ] as [BeautifyStrength, string][]).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setBeautifyStrength(value)}
                          className={`px-2 py-2 rounded-md border text-xs font-medium transition-colors ${
                            beautifyStrength === value
                              ? 'border-rose-500 bg-rose-50 text-rose-800'
                              : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.blurTitle}</h4>
                      <span className="text-[11px] text-rose-700 font-medium">{backgroundBlurStrength}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={backgroundBlurStrength}
                      onChange={(e) => setBackgroundBlurStrength(Number(e.target.value))}
                      className="w-full accent-rose-600"
                    />
                    <p className="text-[10px] text-muted-foreground">{t.blurHint}</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.qualityTitle}</h4>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setImageQuality('2K')}
                        className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                          imageQuality === '2K'
                            ? 'border-rose-500 bg-rose-50 text-rose-800'
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
                            ? 'border-rose-500 bg-rose-50 text-rose-800'
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
                      className="w-full max-w-[180px] border-rose-200 text-rose-700 hover:bg-rose-50"
                    />
                    <Button
                      onClick={() => checkCreditsAndProceed(cost, handleSubmit)}
                      disabled={!image.file}
                      className="w-full max-w-[180px] h-9 shadow-md hover:shadow-lg transition-all text-sm bg-rose-600 hover:bg-rose-700 text-white"
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> {t.beautify} ({imageQuality === '2K' ? '1,5' : '3'} credit)
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground mt-2">{t.timeHint}</p>
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
                mode="beautify"
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
                          <RefreshCw className="mr-2 h-3 w-3" /> {t.retry}
                        </Button>
                        <DownloadImageButton
                          imageUrl={resultUrl}
                          filename="lam-dep-result"
                          size="sm"
                          className="bg-rose-600 hover:bg-rose-700 text-white border-0"
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
