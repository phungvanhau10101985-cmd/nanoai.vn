'use client'

import { useState, useRef, ChangeEvent, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { restoreImage } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, RefreshCw, Link2 } from 'lucide-react'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { DownloadImageButton } from '@/components/download-image-button'
import { ImagePreview } from '@/components/ui/image-preview'
import { ImageProcessingLoader } from '@/components/image-processing-loader'
import { preloadImageUrl } from '@/lib/preload-image-url'

type Step = 'UPLOAD' | 'GENERATING' | 'RESULT'
type ColorMode = 'original' | 'colorize'
type PersonCount = 1 | 2 | 3 | 4 | 5 | 6
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

const PERSON_LABELS: Record<PersonCount, string[]> = {
  1: ['Người trong ảnh'],
  2: ['Người bên trái', 'Người bên phải'],
  3: ['Người bên trái', 'Người ở giữa', 'Người bên phải'],
  4: ['Người thứ 1 (từ trái)', 'Người thứ 2', 'Người thứ 3', 'Người thứ 4'],
  5: ['Người thứ 1 (từ trái)', 'Người thứ 2', 'Người thứ 3', 'Người thứ 4', 'Người thứ 5'],
  6: [],
}

const setImageFromFile = (file: File, setImage: (v: { file: File; preview: string }) => void) => {
  if (!file.type.startsWith('image/')) return false
  setImage({ file, preview: URL.createObjectURL(file) })
  return true
}

export default function PhucDungClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [step, setStep] = useState<Step>('UPLOAD')
  const [image, setImage] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [colorMode, setColorMode] = useState<ColorMode>('original')
  const [personCount, setPersonCount] = useState<PersonCount>(1)
  const [personInfo, setPersonInfo] = useState<{ gender: string; age: string; extra: string }[]>(() =>
    Array(5).fill(null).map(() => ({ gender: '', age: '', extra: '' }))
  )
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const [imageUrl, setImageUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [note, setNote] = useState('')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cost = imageQuality === '2K' ? 4 : 8
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setImageFromFile(file, setImage)
  }

  const handleFetchFromUrl = async () => {
    const url = imageUrl.trim()
    if (!url) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Vui lòng dán link ảnh.', 'Please paste an image URL.', '请粘贴图片链接。', '画像リンクを貼り付けてください。', '이미지 링크를 붙여 넣어주세요.'), variant: 'destructive' })
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
      if (!blob.type.startsWith('image/')) throw new Error(tr('Không phải ảnh', 'Not an image', '不是图片', '画像ではありません', '이미지 파일이 아닙니다'))
      const file = new File([blob], 'image-from-url.png', { type: blob.type || 'image/png' })
      setImageFromFile(file, setImage)
      setImageUrl('')
      toast({ title: tr('Đã tải ảnh', 'Image loaded', '图片已加载', '画像を読み込みました', '이미지를 불러왔습니다'), description: tr('Ảnh từ link đã được thêm.', 'Image from URL was added.', '已添加来自链接的图片。', 'リンク画像を追加しました。', '링크 이미지가 추가되었습니다.'), duration: 2000 })
    } catch {
      toast({
        title: tr('Không tải được ảnh', 'Cannot load image', '无法加载图片', '画像を読み込めません', '이미지를 불러올 수 없습니다'),
        description: tr('Link có thể bị chặn CORS. Thử tải ảnh lên trực tiếp.', 'The URL may be blocked by CORS. Please upload directly.', '链接可能被 CORS 阻止。请直接上传图片。', 'CORS によりブロックされた可能性があります。直接アップロードしてください。', 'CORS 차단일 수 있습니다. 직접 업로드해 주세요.'),
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
            toast({ title: tr('Đã dán ảnh', 'Image pasted', '已粘贴图片', '画像を貼り付けました', '이미지를 붙여넣었습니다'), description: tr('Ảnh từ clipboard đã được thêm.', 'Image from clipboard was added.', '已添加剪贴板图片。', 'クリップボード画像を追加しました。', '클립보드 이미지가 추가되었습니다.'), duration: 2000 })
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
  }, [step, toast])

  const allPersonsFilled = () => {
    if (personCount >= 6) return true
    for (let i = 0; i < personCount; i++) {
      const p = personInfo[i]
      if (!p?.gender || !p?.age?.trim()) return false
    }
    return true
  }
  const canSubmit = image.file && allPersonsFilled()

  const handleSubmit = async () => {
    if (!image.file) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Vui lòng tải lên ảnh cần phục dựng.', 'Please upload an image to restore.', '请上传需要修复的图片。', '修復する画像をアップロードしてください。', '복원할 이미지를 업로드해 주세요.'), variant: 'destructive' })
      return
    }
    if (!allPersonsFilled()) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Vui lòng chọn giới tính và nhập tuổi cho từng người trong ảnh.', 'Please select gender and age for each person in the image.', '请为图片中的每个人选择性别并输入年龄。', '画像内の各人物の性別と年齢を入力してください。', '이미지 속 각 사람의 성별과 나이를 입력해 주세요.'), variant: 'destructive' })
      return
    }
    setStep('GENERATING')
    const formData = new FormData()
    formData.append('image', image.file)
    formData.append('colorMode', colorMode)
    formData.append('imageQuality', imageQuality)
    formData.append('personCount', String(personCount))
    formData.append('note', note)
    if (personCount < 6) {
      for (let i = 0; i < personCount; i++) {
        formData.append(`person_${i}_gender`, personInfo[i]?.gender || '')
        formData.append(`person_${i}_age`, personInfo[i]?.age || '')
        formData.append(`person_${i}_extra`, personInfo[i]?.extra || '')
      }
    }
    const result = await restoreImage(formData)
    if (result.error) {
      setStep('UPLOAD')
      toast({ title: tr('Phục dựng thất bại', 'Restoration failed', '修复失败', '修復に失敗しました', '복원 실패'), description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      await preloadImageUrl(result.resultUrl)
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      toast({ title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'), description: tr('Ảnh đã được phục dựng.', 'Image restored successfully.', '图片已修复。', '画像の修復が完了しました。', '이미지 복원이 완료되었습니다.'), duration: 3000 })
    }
  }

  const handleReset = () => {
    setStep('UPLOAD')
    setImage({ file: null, preview: null })
    setPersonCount(1)
    setPersonInfo(Array(5).fill(null).map(() => ({ gender: '', age: '', extra: '' })))
    setNote('')
    setResultUrl(null)
  }

  return (
    <>
      <Toaster />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">{tr('Phục dựng ảnh', 'Restore Image', '照片修复', '写真修復', '사진 복원')}</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">{tr('Sửa ảnh cũ, mờ, hư hỏng và tăng chất lượng với AI. 4-8 credits/ảnh.', 'Fix old, blurry, and damaged photos with AI. 4-8 credits/image.', '使用 AI 修复老旧、模糊、破损照片并提升画质。4-8 credits/张。', '古い・ぼやけた・破損した写真を AI で修復し高画質化します。4-8 credits/枚。', '오래되거나 흐리고 손상된 사진을 AI로 복원하고 품질을 높입니다. 4-8 credits/장.')}</p>
        </div>

        {step === 'UPLOAD' && (
          <div className="grid lg:grid-cols-[1fr_240px_240px] gap-5 items-start">
            {/* Cột 1: Tải ảnh */}
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/95 backdrop-blur border-amber-200/60">
                <CardHeader className="p-5 pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Upload className="h-5 w-5 text-amber-600" /> {tr('Tải ảnh cần phục dựng', 'Upload image to restore', '上传待修复图片', '修復する画像をアップロード', '복원할 이미지 업로드')}
                  </CardTitle>
                  <CardDescription className="text-sm">{tr('Chọn ảnh, dán ảnh (Ctrl+V) hoặc dán link ảnh.', 'Choose an image, paste one (Ctrl+V), or paste an image URL.', '可选择图片、粘贴图片（Ctrl+V）或粘贴链接。', '画像選択・貼り付け（Ctrl+V）・リンク貼り付けに対応。', '이미지 선택, 붙여넣기(Ctrl+V), 링크 붙여넣기 지원.')}</CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-0 space-y-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="phuc-dung-input"
                      className="block w-full aspect-[4/3] max-h-[400px] rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-amber-400 hover:bg-amber-50/80 transition-colors"
                    >
                      {image.preview ? (
                        <ImagePreview src={image.preview} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                      ) : (
                        <>
                          <Upload className="h-14 w-14 text-amber-500" />
                          <p className="text-sm font-medium text-muted-foreground">{tr('Chọn ảnh hoặc dán ảnh (Ctrl+V)', 'Choose image or paste (Ctrl+V)', '选择图片或粘贴图片（Ctrl+V）', '画像を選択または貼り付け（Ctrl+V）', '이미지를 선택하거나 붙여넣기(Ctrl+V)')}</p>
                        </>
                      )}
                    </label>
                    {image.preview && (
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <RefreshCw className="h-3.5 w-3.5" /> {tr('Chọn lại', 'Select again', '重新选择', '再選択', '다시 선택')}
                      </button>
                    )}
                  </div>
                  <input
                    id="phuc-dung-input"
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      placeholder={tr('Dán link ảnh rồi bấm Lấy ảnh', 'Paste image URL then click Fetch', '粘贴图片链接后点击获取图片', '画像リンクを貼って「取得」を押してください', '이미지 링크를 붙여넣고 가져오기를 누르세요')}
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="flex-1 min-w-0"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleFetchFromUrl}
                      disabled={urlLoading}
                      className="shrink-0 min-h-[44px] border-amber-200 text-amber-700 hover:bg-amber-50 touch-manipulation"
                    >
                      <Link2 className="mr-2 h-4 w-4" />
                      {urlLoading ? tr('Đang tải...', 'Loading...', '加载中...', '読み込み中...', '불러오는 중...') : tr('Lấy ảnh', 'Fetch image', '获取图片', '画像を取得', '가져오기')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Cột 2: Số người - Giới tính & Tuổi (bắt buộc) */}
            <div className="lg:w-[240px] lg:shrink-0">
              <Card className="border shadow-sm bg-white/95 backdrop-blur border-amber-200/60">
                <CardHeader className="p-5 pb-3">
                  <CardTitle className="text-lg">{tr('Thông tin từng người', 'Per-person info', '每人信息', '人物ごとの情報', '인물별 정보')}</CardTitle>
                  <CardDescription className="text-sm">{tr('Từ 1-5 người: chọn giới tính + tuổi từng người. Chọn 6+ người: AI tự tối ưu 100%.', 'For 1-5 people: choose gender + age for each person. For 6+ people: AI auto-optimizes 100%.', '1-5 人：需填写每人的性别与年龄。6 人以上：AI 自动优化。', '1-5人は各人物の性別と年齢を入力。6人以上はAIが自動最適化。', '1-5명은 각 인물 성별+나이 입력, 6명 이상은 AI 자동 최적화.')}</CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-0 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground">{tr('Số người trong ảnh', 'People in image', '图片中的人数', '画像内の人数', '이미지 인원 수')}</h4>
                    <div className="grid grid-cols-6 gap-2">
                      {([1, 2, 3, 4, 5, 6] as PersonCount[]).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setPersonCount(n)}
                          className={`py-2.5 rounded-lg border-2 text-sm font-semibold transition-all ${
                            personCount === n
                              ? 'border-amber-500 bg-amber-50 text-amber-800 ring-2 ring-amber-200'
                              : 'border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50/50 text-muted-foreground'
                          }`}
                        >
                          {n === 6 ? '6+' : n}
                        </button>
                      ))}
                    </div>
                  </div>
                  {personCount < 6 ? (
                    <div className="space-y-3">
                      {PERSON_LABELS[personCount].map((label, i) => (
                        <div key={i} className="rounded-xl border-2 border-gray-100 bg-gray-50/50 p-3 space-y-2">
                          <p className="text-sm font-semibold text-foreground">{label}</p>
                          <div className="space-y-2">
                            <div>
                              <span className="text-xs font-medium text-muted-foreground block mb-1">{tr('Giới tính *', 'Gender *', '性别 *', '性別 *', '성별 *')}</span>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPersonInfo((prev) => {
                                      const next = [...prev]
                                      next[i] = { ...next[i], gender: 'nam' }
                                      return next
                                    })
                                  }
                                  className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-semibold transition-all ${
                                    personInfo[i]?.gender === 'nam'
                                      ? 'border-amber-500 bg-amber-50 text-amber-800'
                                      : 'border-gray-200 bg-white hover:border-amber-300 text-muted-foreground'
                                  }`}
                                >
                                  {tr('Nam', 'Male', '男', '男性', '남성')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPersonInfo((prev) => {
                                      const next = [...prev]
                                      next[i] = { ...next[i], gender: 'nữ' }
                                      return next
                                    })
                                  }
                                  className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-semibold transition-all ${
                                    personInfo[i]?.gender === 'nữ'
                                      ? 'border-amber-500 bg-amber-50 text-amber-800'
                                      : 'border-gray-200 bg-white hover:border-amber-300 text-muted-foreground'
                                  }`}
                                >
                                  {tr('Nữ', 'Female', '女', '女性', '여성')}
                                </button>
                              </div>
                            </div>
                            <div>
                              <span className="text-xs font-medium text-muted-foreground block mb-1">{tr('Tuổi *', 'Age *', '年龄 *', '年齢 *', '나이 *')}</span>
                              <Input
                                placeholder={tr('VD: 25', 'e.g. 25', '例如：25', '例：25', '예: 25')}
                                value={personInfo[i]?.age || ''}
                                onChange={(e) =>
                                  setPersonInfo((prev) => {
                                    const next = [...prev]
                                    next[i] = { ...next[i], age: e.target.value.replace(/\D/g, '').slice(0, 3) }
                                    return next
                                  })
                                }
                                className="h-10 text-sm font-medium"
                              />
                            </div>
                            <div>
                              <span className="text-xs font-medium text-muted-foreground block mb-1">{tr('Đặc thù (tùy chọn)', 'Special traits (optional)', '特征（可选）', '特徴（任意）', '특징 (선택)')}</span>
                              <Input
                                placeholder={tr('Màu tóc, tóc xoăn/thẳng, nốt ruồi...', 'Hair color, curly/straight, mole...', '发色、卷直发、痣等...', '髪色・くせ毛/直毛・ほくろなど...', '머리색, 곱슬/직모, 점 등...')}
                                value={personInfo[i]?.extra || ''}
                                onChange={(e) =>
                                  setPersonInfo((prev) => {
                                    const next = [...prev]
                                    next[i] = { ...next[i], extra: e.target.value }
                                    return next
                                  })
                                }
                                className="h-9 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border-2 border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800">
                      {tr('Ảnh có 6 người trở lên: hệ thống sẽ để AI tự tối ưu toàn bộ (100%), không cần chọn giới tính từng người.', 'For 6+ people, AI auto-optimizes all faces; no per-person gender input needed.', '6 人以上时，AI 将自动整体优化，无需逐人选择性别。', '6人以上はAIが自動で全体最適化するため、個別の性別設定は不要です。', '6명 이상은 AI가 전체 자동 최적화하며, 인물별 성별 입력이 필요 없습니다.')}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Cột 3: Tùy chọn & Phục dựng */}
            <div className="lg:w-[240px] lg:shrink-0">
              <Card className="border shadow-sm bg-white/95 backdrop-blur border-amber-200/60">
                <CardHeader className="p-5 pb-3">
                  <CardTitle className="text-lg">{tr('Cài đặt', 'Settings', '设置', '設定', '설정')}</CardTitle>
                  <CardDescription className="text-sm">{tr('Chất lượng & chế độ màu.', 'Quality & color mode.', '画质与色彩模式。', '画質とカラーモード。', '품질 및 색상 모드.')}</CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-0 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground">{tr('Chất lượng ảnh', 'Image quality', '图片质量', '画質', '이미지 품질')}</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setImageQuality('2K')}
                        className={`py-3 rounded-lg border-2 text-sm font-semibold transition-all ${
                          imageQuality === '2K'
                            ? 'border-amber-500 bg-amber-50 text-amber-800'
                            : 'border-gray-200 bg-white hover:border-amber-300 text-muted-foreground'
                        }`}
                      >
                        2K (4)
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageQuality('4K')}
                        className={`py-3 rounded-lg border-2 text-sm font-semibold transition-all ${
                          imageQuality === '4K'
                            ? 'border-amber-500 bg-amber-50 text-amber-800'
                            : 'border-gray-200 bg-white hover:border-amber-300 text-muted-foreground'
                        }`}
                      >
                        4K (8)
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground">{tr('Chế độ màu', 'Color mode', '色彩模式', 'カラーモード', '색상 모드')}</h4>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => setColorMode('original')}
                        className={`w-full py-3 rounded-lg border-2 text-sm font-semibold transition-all ${
                          colorMode === 'original'
                            ? 'border-amber-500 bg-amber-50 text-amber-800'
                            : 'border-gray-200 bg-white hover:border-amber-300 text-muted-foreground'
                        }`}
                      >
                        {tr('Giữ nguyên màu', 'Keep original colors', '保留原色', '元の色を保持', '원본 색상 유지')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setColorMode('colorize')}
                        className={`w-full py-3 rounded-lg border-2 text-sm font-semibold transition-all ${
                          colorMode === 'colorize'
                            ? 'border-amber-500 bg-amber-50 text-amber-800'
                            : 'border-gray-200 bg-white hover:border-amber-300 text-muted-foreground'
                        }`}
                      >
                        {tr('Phối màu như ảnh thật', 'Colorize naturally', '自然上色', '自然にカラー化', '자연스럽게 컬러화')}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground">{tr('Yêu cầu về ảnh', 'Image requirements', '图片要求', '画像への要望', '이미지 요청사항')}</h4>
                    <Textarea
                      placeholder={tr('Ví dụ: Nền ảnh trong công viên, viết thêm chữ kỷ niệm 7 năm', 'Example: park background, add text "7-year anniversary"', '例如：公园背景，添加“7周年纪念”文字', '例：公園の背景、7周年記念の文字を追加', '예: 공원 배경, "7주년 기념" 문구 추가')}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="bg-white/80 text-sm min-h-[80px] resize-y placeholder:text-sm placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="pt-4 border-t space-y-2 flex flex-col items-center">
                    <DepositCreditButton
                      variant="outline"
                      size="sm"
                      className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
                    />
                    <Button
                      onClick={() => checkCreditsAndProceed(cost, handleSubmit)}
                      disabled={!canSubmit}
                      className="w-full min-h-[44px] h-11 shadow-md hover:shadow-lg transition-all text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> {tr('Phục dựng', 'Restore', '修复', '修復', '복원')} ({imageQuality === '2K' ? '4' : '8'} credit)
                    </Button>
                    {!canSubmit && (
                      <p className="text-xs text-amber-600 font-medium">
                        {!image.file
                          ? tr('Tải ảnh và chọn giới tính, tuổi cho từng người.', 'Upload image and set gender + age for each person.', '请上传图片并填写每人的性别和年龄。', '画像をアップロードし、各人物の性別と年齢を入力してください。', '이미지 업로드 후 각 인물의 성별과 나이를 입력하세요.')
                          : tr('Chọn giới tính và nhập tuổi cho từng người.', 'Set gender and age for each person.', '请填写每人的性别和年龄。', '各人物の性別と年齢を入力してください。', '각 인물의 성별과 나이를 입력하세요.')}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">{tr('Thời gian: 15-45 giây', 'Time: 15-45 seconds', '时间：15-45 秒', '所要時間：15-45秒', '소요 시간: 15-45초')}</p>
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
                mode="restore"
                title={tr('Đang phục dựng ảnh', 'Restoring image', '正在修复图片', '画像を修復中', '이미지 복원 중')}
                description={tr('AI đang phân tích và sửa mờ, xước, hư hỏng để khôi phục ảnh gốc', 'AI is fixing blur, scratches, and damage to recover the original photo', 'AI 正在修复模糊、划痕和破损以恢复原图', 'AI がぼけ・傷・破損を補正して元画像を復元しています', 'AI가 흐림, 스크래치, 손상을 복구하여 원본을 되살리고 있습니다')}
                imagePreview={image.preview}
              />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>{tr('Kết quả phục dựng', 'Restoration result', '修复结果', '修復結果', '복원 결과')}</CardTitle>
              <CardDescription>{tr('Ảnh đã được xử lý.', 'Image has been processed.', '图片已处理完成。', '画像の処理が完了しました。', '이미지 처리가 완료되었습니다.')}</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">{tr('Trước', 'Before', '之前', '前', '전')}</h3>
                {image.preview && (
                  <div className="aspect-square rounded-lg border overflow-hidden">
                    <ImagePreview src={image.preview} alt={tr('Trước', 'Before', '之前', '前', '전')} className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground">{tr('Sau', 'After', '之后', '後', '후')}</h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleReset}>
                      <RefreshCw className="mr-2 h-3 w-3" /> {tr('Thử lại', 'Try again', '重试', 'やり直す', '다시 시도')}
                    </Button>
                    <DownloadImageButton imageUrl={resultUrl} filename="phuc-dung-result" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white border-0" />
                  </div>
                </div>
                <div className="aspect-square rounded-lg border overflow-hidden">
                  <ImagePreview src={resultUrl} alt={tr('Sau', 'After', '之后', '後', '후')} className="w-full h-full object-cover" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">{tr('Ảnh càng nét càng chính xác. Ảnh do AI tạo có thể có sai sót.', 'Sharper input gives better output. AI-generated images may contain minor errors.', '输入越清晰，结果越准确。AI 生成结果可能存在误差。', '元画像が鮮明なほど精度が上がります。AI生成結果には誤差が含まれる場合があります。', '원본이 선명할수록 결과가 정확합니다. AI 생성 결과에는 오차가 있을 수 있습니다.')}</p>
    </>
  )
}
