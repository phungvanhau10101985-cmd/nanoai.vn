'use client'

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

import { useState, useRef, ChangeEvent, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createIdCard } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, RefreshCw, Link2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { DownloadImageButton } from '@/components/download-image-button'
import { ImagePreview } from '@/components/ui/image-preview'
import { BeforeAfterResultDisplay } from '@/components/image-tools/before-after-result-display'
import { ImageProcessingLoader } from '@/components/image-processing-loader'
import { getDictionary } from '@/lib/i18n/dictionaries'
import {
  finalizeStandardImageGenerationResult,
  waitForNextPaintClient,
} from '@/lib/client/finalize-standard-image-generation-result'

type Step = 'UPLOAD' | 'GENERATING' | 'RESULT'
type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

function getWebLocaleFromCookie(): UiLocale {
  if (typeof document === 'undefined') return 'vi'
  const cookieValue = readWebLocaleFromDocumentCookie()
  if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') return cookieValue
  return 'vi'
}

const IDCARD_ASPECT_RATIOS = [
  { value: '3:4', label: '3:4 Chuẩn 3x4 (CMND/CCCD)' },
  { value: '2:3', label: '2:3 Ảnh 2x3 / 4x6 (Hộ chiếu)' },
  { value: '4:3', label: '4:3 Ngang 4x3' },
  { value: '1:1', label: '1:1 Vuông' },
] as const

const BACKGROUND_COLORS = [
  { value: 'white', labelVi: 'Trắng', labelEn: 'White', labelZh: '白色', labelJa: '白', labelKo: '흰색', hex: '#FFFFFF' },
  { value: 'blue', labelVi: 'Xanh nhạt', labelEn: 'Light blue', labelZh: '浅蓝', labelJa: '薄い青', labelKo: '연한 파랑', hex: '#4A90E2' },
  { value: 'gray', labelVi: 'Xám nhạt', labelEn: 'Light gray', labelZh: '浅灰', labelJa: '薄いグレー', labelKo: '연한 회색', hex: '#E5E7EB' },
  { value: 'red', labelVi: 'Đỏ nhạt', labelEn: 'Light red', labelZh: '浅红', labelJa: '薄い赤', labelKo: '연한 빨강', hex: '#E8B4B8' },
] as const

const SHIRT_STYLES = [
  { value: 'default', labelVi: 'Không chỉ định', labelEn: 'Default', labelZh: '默认', labelJa: '指定なし', labelKo: '기본' },
  { value: 'formal', labelVi: 'Áo sơ mi trắng', labelEn: 'White formal shirt', labelZh: '白衬衫', labelJa: '白シャツ', labelKo: '흰색 셔츠' },
  { value: 'casual', labelVi: 'Áo thun', labelEn: 'Casual T-shirt', labelZh: 'T恤', labelJa: 'Tシャツ', labelKo: '티셔츠' },
  { value: 'vest', labelVi: 'Áo vest', labelEn: 'Blazer/Vest', labelZh: '西装', labelJa: 'スーツ', labelKo: '정장' },
  { value: 'traditional', labelVi: 'Áo dài', labelEn: 'Traditional', labelZh: '传统服装', labelJa: '民族衣装', labelKo: '전통 의상' },
] as const

const setImageFromFile = (file: File, setImage: (v: { file: File; preview: string }) => void) => {
  if (!file.type.startsWith('image/')) return false
  setImage({ file, preview: URL.createObjectURL(file) })
  return true
}

export default function TaoAnhTheClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [step, setStep] = useState<Step>('UPLOAD')
  const [image, setImage] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const [aspectRatio, setAspectRatio] = useState<string>('3:4')
  const [backgroundColor, setBackgroundColor] = useState<string>('white')
  const [shirtStyle, setShirtStyle] = useState<string>('formal')
  const [note, setNote] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cost = imageQuality === '2K' ? 1.5 : 3
  const t = useMemo(() => {
    if (uiLocale === 'en') return { err: 'Error', title: 'Create ID Photo', subtitle: 'Remove background and create standard ID photo sizes. 1.5-3 credits/image.', uploadCard: 'Upload portrait image', uploadDesc: 'Choose image, paste one (Ctrl+V), or paste image URL.', chooseOrPaste: 'Choose image or paste (Ctrl+V)', reselect: 'Select again', urlPlaceholder: 'Paste image URL then click Fetch', loading: 'Loading...', fetch: 'Fetch image', options: 'Options', optionsDesc: 'Choose ratio, extra request, and quality.', ratio: 'ID ratio', bgColor: 'Background color', shirtStyle: 'Shirt style', extra: 'Extra request', extraPlaceholder: 'e.g. white background, blue background, 3x4, 4x6...', quality: 'Image quality', create: 'Create ID photo', time: '* Time: 15-45 seconds', generatingTitle: 'Generating ID photo', generatingDesc: 'AI is removing background and standardizing ID photo', resultTitle: 'ID photo result', resultDesc: 'ID photo generated.', before: 'Before', after: 'After', retry: 'Try again', download: 'Download', footer: 'Sharper input gives better output. AI-generated images may contain minor errors.' }
    if (uiLocale === 'zh') return { err: '错误', title: '制作证件照', subtitle: '抠图并生成标准证件照尺寸。1.5-3 credits/张。', uploadCard: '上传人像图片', uploadDesc: '可选择图片、粘贴图片（Ctrl+V）或粘贴链接。', chooseOrPaste: '选择图片或粘贴图片（Ctrl+V）', reselect: '重新选择', urlPlaceholder: '粘贴图片链接后点击获取图片', loading: '加载中...', fetch: '获取图片', options: '选项', optionsDesc: '选择比例、附加要求与画质。', ratio: '证件照比例', bgColor: '背景颜色', shirtStyle: '服装款式', extra: '附加要求', extraPlaceholder: '例如：白底、蓝底、3x4、4x6...', quality: '图片质量', create: '生成证件照', time: '* 时间：15-45 秒', generatingTitle: '正在生成证件照', generatingDesc: 'AI 正在抠图并标准化证件照', resultTitle: '证件照结果', resultDesc: '证件照已生成。', before: '之前', after: '之后', retry: '重试', download: '下载', footer: '输入越清晰，结果越准确。AI 生成结果可能存在误差。' }
    if (uiLocale === 'ja') return { err: 'エラー', title: '証明写真作成', subtitle: '背景を除去し、標準サイズの証明写真を作成します。1.5-3 credits/枚。', uploadCard: 'ポートレートをアップロード', uploadDesc: '画像選択・貼り付け（Ctrl+V）・リンク貼り付けに対応。', chooseOrPaste: '画像を選択または貼り付け（Ctrl+V）', reselect: '再選択', urlPlaceholder: '画像リンクを貼って「取得」を押してください', loading: '読み込み中...', fetch: '画像を取得', options: 'オプション', optionsDesc: '比率、追加要望、画質を設定。', ratio: '証明写真の比率', bgColor: '背景色', shirtStyle: '服装スタイル', extra: '追加要望', extraPlaceholder: '例：白背景、青背景、3x4、4x6...', quality: '画質', create: '証明写真を作成', time: '* 時間：15-45秒', generatingTitle: '証明写真を生成中', generatingDesc: 'AI が背景を除去し証明写真を最適化しています', resultTitle: '証明写真の結果', resultDesc: '証明写真を生成しました。', before: '前', after: '後', retry: 'やり直す', download: 'ダウンロード', footer: '元画像が鮮明なほど精度が上がります。AI生成結果には誤差が含まれる場合があります。' }
    if (uiLocale === 'ko') return { err: '오류', title: '증명사진 만들기', subtitle: '배경 제거 후 표준 증명사진 규격으로 생성합니다. 1.5-3 credits/장.', uploadCard: '인물 사진 업로드', uploadDesc: '이미지 선택, 붙여넣기(Ctrl+V), 링크 붙여넣기 지원.', chooseOrPaste: '이미지를 선택하거나 붙여넣기(Ctrl+V)', reselect: '다시 선택', urlPlaceholder: '이미지 링크를 붙여넣고 가져오기를 누르세요', loading: '불러오는 중...', fetch: '가져오기', options: '옵션', optionsDesc: '비율, 추가 요청, 화질 선택.', ratio: '증명사진 비율', bgColor: '배경색', shirtStyle: '의상 스타일', extra: '추가 요청', extraPlaceholder: '예: 흰 배경, 파란 배경, 3x4, 4x6...', quality: '이미지 품질', create: '증명사진 생성', time: '* 시간: 15-45초', generatingTitle: '증명사진 생성 중', generatingDesc: 'AI가 배경을 제거하고 증명사진 규격으로 보정 중입니다', resultTitle: '증명사진 결과', resultDesc: '증명사진 생성 완료.', before: '전', after: '후', retry: '다시 시도', download: '다운로드', footer: '원본이 선명할수록 결과가 정확합니다. AI 생성 결과에는 오차가 있을 수 있습니다.' }
    return { err: 'Lỗi', title: 'Tạo ảnh thẻ', subtitle: 'Tách nền, thay nền trắng/xanh. Chuẩn 3x4, 4x6. 1,5-3 credits/ảnh.', uploadCard: 'Tải ảnh cần tạo ảnh thẻ', uploadDesc: 'Chọn ảnh, dán ảnh (Ctrl+V) hoặc dán link ảnh.', chooseOrPaste: 'Chọn ảnh hoặc dán ảnh (Ctrl+V)', reselect: 'Chọn lại', urlPlaceholder: 'Dán link ảnh rồi bấm Lấy ảnh', loading: 'Đang tải...', fetch: 'Lấy ảnh', options: 'Tùy chọn', optionsDesc: 'Chọn tỷ lệ ảnh thẻ, yêu cầu thêm và chất lượng.', ratio: 'Tỷ lệ ảnh thẻ', bgColor: 'Màu nền', shirtStyle: 'Kiểu áo', extra: 'Yêu cầu thêm', extraPlaceholder: 'Ví dụ: nền trắng, nền xanh, size 3x4, 4x6...', quality: 'Chất lượng ảnh', create: 'Tạo ảnh thẻ', time: '* Thời gian: 15-45 giây', generatingTitle: 'Đang tạo ảnh thẻ', generatingDesc: 'AI đang tách nền và chuẩn hóa ảnh thẻ', resultTitle: 'Kết quả ảnh thẻ', resultDesc: 'Ảnh thẻ đã được tạo.', before: 'Trước', after: 'Sau', retry: 'Thử lại', download: 'Tải xuống', footer: 'Ảnh càng nét càng chính xác. Ảnh do AI tạo có thể có sai sót.' }
  }, [uiLocale])
  const genClient = useMemo(() => getDictionary(uiLocale).imageGenerationClient, [uiLocale])
  const getAspectLabel = (value: string, fallback: string) => {
    if (value === '3:4') return uiLocale === 'vi' ? '3:4 Chuẩn 3x4 (CMND/CCCD)' : uiLocale === 'en' ? '3:4 Standard 3x4 (ID card)' : uiLocale === 'zh' ? '3:4 标准 3x4（证件）' : uiLocale === 'ja' ? '3:4 標準 3x4（身分証）' : '3:4 표준 3x4 (신분증)'
    if (value === '2:3') return uiLocale === 'vi' ? '2:3 Ảnh 2x3 / 4x6 (Hộ chiếu)' : uiLocale === 'en' ? '2:3 2x3 / 4x6 (Passport)' : uiLocale === 'zh' ? '2:3 2x3 / 4x6（护照）' : uiLocale === 'ja' ? '2:3 2x3 / 4x6（パスポート）' : '2:3 2x3 / 4x6 (여권)'
    if (value === '4:3') return uiLocale === 'vi' ? '4:3 Ngang 4x3' : uiLocale === 'en' ? '4:3 Landscape 4x3' : uiLocale === 'zh' ? '4:3 横向 4x3' : uiLocale === 'ja' ? '4:3 横向き 4x3' : '4:3 가로 4x3'
    if (value === '1:1') return uiLocale === 'vi' ? '1:1 Vuông' : uiLocale === 'en' ? '1:1 Square' : uiLocale === 'zh' ? '1:1 方形' : uiLocale === 'ja' ? '1:1 正方形' : '1:1 정사각형'
    return fallback
  }

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
      toast({ title: t.err, description: uiLocale === 'vi' ? 'Vui lòng tải lên ảnh cần tạo ảnh thẻ.' : uiLocale === 'en' ? 'Please upload image for ID photo.' : uiLocale === 'zh' ? '请上传需要制作证件照的图片。' : uiLocale === 'ja' ? '証明写真用の画像をアップロードしてください。' : '증명사진 생성용 이미지를 업로드해 주세요.', variant: 'destructive' })
      return
    }
    setStep('GENERATING')
    await waitForNextPaintClient()
    const formData = new FormData()
    formData.append('image', image.file)
    formData.append('imageQuality', imageQuality)
    formData.append('aspectRatio', aspectRatio)
    formData.append('backgroundColor', backgroundColor)
    formData.append('shirtStyle', shirtStyle)
    formData.append('note', note)
    try {
      const result = await createIdCard(formData)
      await finalizeStandardImageGenerationResult(result, {
        onServerErrorMessage: (message) => {
          setStep('UPLOAD')
          toast({
            title: uiLocale === 'vi' ? 'Tạo ảnh thẻ thất bại' : uiLocale === 'en' ? 'ID photo generation failed' : uiLocale === 'zh' ? '证件照生成失败' : uiLocale === 'ja' ? '証明写真の生成に失敗しました' : '증명사진 생성 실패',
            description: message,
            variant: 'destructive',
            duration: 5000,
          })
        },
        onSuccessWithUrl: (url) => {
          setResultUrl(url)
          setStep('RESULT')
          toast({ title: uiLocale === 'vi' ? 'Thành công!' : uiLocale === 'en' ? 'Success!' : uiLocale === 'zh' ? '成功！' : uiLocale === 'ja' ? '成功' : '성공!', description: t.resultDesc, duration: 3000 })
        },
        onUnexpectedPayload: () => {
          setStep('UPLOAD')
          toast({
            title: uiLocale === 'vi' ? 'Tạo ảnh thẻ thất bại' : uiLocale === 'en' ? 'ID photo generation failed' : uiLocale === 'zh' ? '证件照生成失败' : uiLocale === 'ja' ? '証明写真の生成に失敗しました' : '증명사진 생성 실패',
            description: genClient.unexpectedNoUrl,
            variant: 'destructive',
            duration: 6000,
          })
        },
      })
    } catch (e) {
      setStep('UPLOAD')
      toast({
        title: uiLocale === 'vi' ? 'Tạo ảnh thẻ thất bại' : uiLocale === 'en' ? 'ID photo generation failed' : uiLocale === 'zh' ? '证件照生成失败' : uiLocale === 'ja' ? '証明写真の生成に失敗しました' : '증명사진 생성 실패',
        description: e instanceof Error ? e.message : genClient.clientFault,
        variant: 'destructive',
        duration: 6000,
      })
    }
  }

  const handleReset = () => {
    setStep('UPLOAD')
    setImage({ file: null, preview: null })
    setAspectRatio('3:4')
    setBackgroundColor('white')
    setShirtStyle('formal')
    setNote('')
    setResultUrl(null)
  }

  const getBgLabel = (value: string) => {
    const c = BACKGROUND_COLORS.find((x) => x.value === value)
    if (!c) return value
    if (uiLocale === 'en') return c.labelEn
    if (uiLocale === 'zh') return c.labelZh
    if (uiLocale === 'ja') return c.labelJa
    if (uiLocale === 'ko') return c.labelKo
    return c.labelVi
  }
  const getShirtLabel = (value: string) => {
    const s = SHIRT_STYLES.find((x) => x.value === value)
    if (!s) return value
    if (uiLocale === 'en') return s.labelEn
    if (uiLocale === 'zh') return s.labelZh
    if (uiLocale === 'ja') return s.labelJa
    if (uiLocale === 'ko') return s.labelKo
    return s.labelVi
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
          <div className="grid lg:grid-cols-[1fr_240px] gap-4 items-start">
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-amber-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="h-4 w-4 text-amber-600" /> {t.uploadCard}
                  </CardTitle>
                  <CardDescription className="text-xs">{t.uploadDesc}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <div className="rounded-lg">
                    <label
                      htmlFor="idcard-input"
                      className="block w-full aspect-[4/3] max-h-[400px] rounded-lg border-2 border-dashed border-amber-200 bg-amber-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-amber-300 hover:bg-amber-50/80 transition-colors"
                    >
                      {image.preview ? (
                        <ImagePreview src={image.preview} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                      ) : (
                        <>
                          <Upload className="h-12 w-12 text-amber-500" />
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
                    id="idcard-input"
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
                      className="shrink-0 border-amber-200 text-amber-700 hover:bg-amber-50"
                    >
                      <Link2 className="mr-2 h-4 w-4" />
                      {urlLoading ? t.loading : t.fetch}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="lg:w-[240px] lg:shrink-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-amber-200/60 h-full">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">{t.options}</CardTitle>
                  <CardDescription className="text-xs">{t.optionsDesc}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.ratio}</h4>
                    <div className="grid grid-cols-2 gap-1.5">
                      {IDCARD_ASPECT_RATIOS.map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setAspectRatio(r.value)}
                          className={`px-2 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                            aspectRatio === r.value ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                          }`}
                        >
                          {getAspectLabel(r.value, r.label)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.bgColor}</h4>
                    <div className="flex flex-wrap gap-2">
                      {BACKGROUND_COLORS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setBackgroundColor(c.value)}
                          className={`w-9 h-9 rounded-full border-2 transition-all ${
                            backgroundColor === c.value ? 'border-amber-500 ring-2 ring-amber-200 scale-110' : 'border-gray-200 hover:border-gray-300'
                          }`}
                          style={{ backgroundColor: c.hex }}
                          title={getBgLabel(c.value)}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.shirtStyle}</h4>
                    <Select value={shirtStyle} onValueChange={setShirtStyle}>
                      <SelectTrigger className="h-9 text-xs border-amber-200/60 bg-white">
                        <SelectValue placeholder={getShirtLabel('default')} />
                      </SelectTrigger>
                      <SelectContent>
                        {SHIRT_STYLES.map((s) => (
                          <SelectItem key={s.value} value={s.value} className="text-xs">
                            {getShirtLabel(s.value)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.extra}</h4>
                    <Textarea
                      placeholder={t.extraPlaceholder}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="bg-white/80 text-xs h-20 min-h-[80px] resize-y"
                    />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.quality}</h4>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setImageQuality('2K')}
                        className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                          imageQuality === '2K' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        2K (1,5)
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageQuality('4K')}
                        className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                          imageQuality === '4K' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        4K (3)
                      </button>
                    </div>
                  </div>
                  <div className="pt-4 border-t space-y-2 flex flex-col items-center">
                    <DepositCreditButton variant="outline" size="sm" className="w-full max-w-[180px] border-amber-200 text-amber-700 hover:bg-amber-50" />
                    <Button
                      onClick={() => checkCreditsAndProceed(cost, handleSubmit)}
                      disabled={!image.file}
                      className="w-full max-w-[180px] h-9 shadow-md hover:shadow-lg transition-all text-sm bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> {t.create} ({imageQuality === '2K' ? '1,5' : '3'} credit)
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground mt-2">{t.time}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === 'GENERATING' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-amber-200/60">
            <CardContent className="flex flex-col items-center py-8">
              <ImageProcessingLoader
                mode="idcard"
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
                  splitImagePreviewClassName="w-full h-full object-cover"
                  afterPrintReadyAspectRatio={aspectRatio}
                  splitAfterPaneClassName="w-full rounded-lg border overflow-hidden relative"
                  splitAfterPaneStyle={{ aspectRatio: aspectRatio.replace(':', '/') }}
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
                          filename="anh-the-result"
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700 text-white border-0"
                          printReady
                          printReadyAspectRatio={aspectRatio}
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
