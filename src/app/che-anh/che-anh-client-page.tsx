'use client'

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

import { useState, useRef, ChangeEvent, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cheAnh } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, RefreshCw, Link2, Plus, X } from 'lucide-react'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { DownloadImageButton } from '@/components/download-image-button'
import { ImagePreview } from '@/components/ui/image-preview'
import { ImageProcessingLoader } from '@/components/image-processing-loader'
import { preloadImageUrl } from '@/lib/preload-image-url'

type Step = 'UPLOAD' | 'GENERATING' | 'RESULT'
type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

function getWebLocaleFromCookie(): UiLocale {
  if (typeof document === 'undefined') return 'vi'
  const cookieValue = readWebLocaleFromDocumentCookie()
  if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') return cookieValue
  return 'vi'
}

const MAX_IMAGES = 13
const CHE_ANH_ASPECT_RATIOS = [
  { value: '1:1', labels: ['1:1 Vuông', '1:1 Square', '1:1 方形', '1:1 正方形', '1:1 정사각형'] as const },
  { value: '4:5', labels: ['4:5 Dọc', '4:5 Portrait', '4:5 竖版', '4:5 縦', '4:5 세로'] as const },
  { value: '3:4', labels: ['3:4 Dọc', '3:4 Portrait', '3:4 竖版', '3:4 縦', '3:4 세로'] as const },
  { value: '9:16', labels: ['9:16 Dọc rộng', '9:16 Tall', '9:16 竖屏', '9:16 縦長', '9:16 세로형'] as const },
  { value: '16:9', labels: ['16:9 Ngang rộng', '16:9 Wide', '16:9 宽屏', '16:9 ワイド', '16:9 와이드'] as const },
  { value: '4:3', labels: ['4:3 Ngang', '4:3 Landscape', '4:3 横版', '4:3 横', '4:3 가로'] as const },
] as const

const MEME_STYLES: { value: string; label: string }[] = [
  { value: '', label: 'Chọn phong cách meme...' },
  { value: 'cam_xuc', label: 'Meme cảm xúc – Khóc, cười, ngạc nhiên, cười đểu, "haha"' },
  { value: 'dong_vat', label: 'Meme động vật – Chó, mèo (Corgi, Husky, Shiba, mèo lè lưỡi, loading)' },
  { value: 'nhan_vat', label: 'Meme nhân vật – Anime, hoạt hình (Pikachu, Tom & Jerry, Doremon), người nổi tiếng (Obama, The Rock, Messi)' },
  { value: 'phan_ung', label: 'Meme phản ứng (Reaction) – Dùng để comment, trả lời tin nhắn' },
  { value: 'deep_dark', label: 'Meme deep/dark – Châm biếm sâu cay, suy ngẫm, không dành cho người yếu tim' },
  { value: 'kho_hieu', label: 'Meme khó hiểu (vô tri/lú) – Nhìn không hiểu gì nhưng càng nhìn càng buồn cười' },
  { value: 've_tay', label: 'Meme vẽ tay – Nét vẽ nguệch ngoạc, kỹ thuật số, phong cách "tay ngang" châm biếm cực gắt' },
  { value: 'co_dien', label: 'Meme cổ điển – LOLcats, Condescending Wonka, Chuck Norris Facts, Gangnam Style' },
]

export default function CheAnhClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
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
  const [step, setStep] = useState<Step>('UPLOAD')
  const [images, setImages] = useState<{ file: File; preview: string; note: string }[]>([])
  const [memeStyle, setMemeStyle] = useState('')
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const [aspectRatio, setAspectRatio] = useState<string>('1:1')
  const [note, setNote] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cost = imageQuality === '2K' ? 1.5 : 3

  const addImage = (file: File) => {
    if (!file.type.startsWith('image/')) return false
    setImages((prev) => {
      if (prev.length >= MAX_IMAGES) return prev
      return [...prev, { file, preview: URL.createObjectURL(file), note: '' }]
    })
    return true
  }

  const handleImageNoteChange = (index: number, value: string) => {
    setImages((prev) => prev.map((img, i) => (i === index ? { ...img, note: value } : img)))
  }

  const handleAddImages = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    const newImages: { file: File; preview: string; note: string }[] = []
    for (let i = 0; i < files.length && images.length + newImages.length < MAX_IMAGES; i++) {
      const file = files[i]
      if (file.type.startsWith('image/')) {
        newImages.push({ file, preview: URL.createObjectURL(file), note: '' })
      }
    }
    if (newImages.length) {
      setImages((prev) => [...prev, ...newImages].slice(0, MAX_IMAGES))
      toast({ title: tr('Đã thêm ảnh', 'Images added', '已添加图片', '画像を追加しました', '이미지를 추가했습니다'), description: tr(`Thêm ${newImages.length} ảnh.`, `Added ${newImages.length} images.`, `已添加 ${newImages.length} 张图片。`, `${newImages.length}枚追加しました。`, `${newImages.length}장 추가되었습니다.`), duration: 2000 })
    }
    e.target.value = ''
  }

  const handleRemove = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleFetchFromUrl = async () => {
    const url = imageUrl.trim()
    if (!url) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Vui lòng dán link ảnh.', 'Please paste image URL.', '请粘贴图片链接。', '画像のURLを貼り付けてください。', '이미지 링크를 붙여넣어 주세요.'), variant: 'destructive' })
      return
    }
    if (!/^https?:\/\//i.test(url)) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Link không hợp lệ.', 'Invalid URL.', '链接无效。', '無効なURLです。', '잘못된 URL입니다.'), variant: 'destructive' })
      return
    }
    if (images.length >= MAX_IMAGES) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr(`Đã đủ tối đa ${MAX_IMAGES} ảnh.`, `Maximum ${MAX_IMAGES} images reached.`, `已达最大 ${MAX_IMAGES} 张图片。`, `最大${MAX_IMAGES}枚です。`, `최대 ${MAX_IMAGES}장입니다.`), variant: 'destructive' })
      return
    }
    setUrlLoading(true)
    try {
      const res = await fetch(url, { mode: 'cors' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      if (!blob.type.startsWith('image/')) throw new Error('Not an image')
      const file = new File([blob], 'image-from-url.png', { type: blob.type || 'image/png' })
      if (addImage(file)) {
        setImageUrl('')
        toast({ title: tr('Đã tải ảnh', 'Image loaded', '已加载图片', '画像を読み込みました', '이미지 로드됨'), description: tr('Ảnh từ link đã được thêm.', 'Image from URL has been added.', '已从链接添加图片。', 'URLから画像を追加しました。', 'URL에서 이미지가 추가되었습니다.'), duration: 2000 })
      }
    } catch {
      toast({
        title: tr('Không tải được ảnh', 'Failed to load image', '无法加载图片', '画像の読み込みに失敗しました', '이미지 로드 실패'),
        description: tr('Link có thể bị chặn CORS. Thử tải ảnh lên trực tiếp.', 'URL may be CORS-blocked. Try uploading directly.', '链接可能被 CORS 阻止。请直接上传。', 'CORSでブロックされている可能性があります。直接アップロードしてください。', 'CORS로 차단되었을 수 있습니다. 직접 업로드해 보세요.'),
        variant: 'destructive',
        duration: 5000,
      })
    } finally {
      setUrlLoading(false)
    }
  }

  useEffect(() => {
    const fn = (e: globalThis.ClipboardEvent) => {
      if (step !== 'UPLOAD' || images.length >= MAX_IMAGES) return
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file && addImage(file)) {
            e.preventDefault()
            toast({ title: tr('Đã dán ảnh', 'Image pasted', '已粘贴图片', '画像を貼り付けました', '이미지 붙여넣음'), description: tr('Ảnh từ clipboard đã được thêm.', 'Image from clipboard has been added.', '已从剪贴板添加图片。', 'クリップボードから画像を追加しました。', '클립보드에서 이미지가 추가되었습니다.'), duration: 2000 })
          }
          break
        }
      }
    }
    document.addEventListener('paste', fn)
    return () => document.removeEventListener('paste', fn)
  }, [step, toast, images.length])

  const handleSubmit = async () => {
    if (images.length === 0) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Vui lòng tải lên ảnh cần chế.', 'Please upload images to edit.', '请上传要编辑的图片。', '編集する画像をアップロードしてください。', '편집할 이미지를 업로드해 주세요.'), variant: 'destructive' })
      return
    }
    if (!memeStyle) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Vui lòng chọn phong cách meme.', 'Please select meme style.', '请选择表情包风格。', 'ミームスタイルを選択してください。', '밈 스타일을 선택해 주세요.'), variant: 'destructive' })
      return
    }
    setStep('GENERATING')
    const formData = new FormData()
    formData.append('memeStyle', memeStyle)
    formData.append('imageQuality', imageQuality)
    formData.append('aspectRatio', aspectRatio)
    formData.append('note', note)
    images.forEach((img, i) => {
      formData.append(`image_${i}`, img.file)
      formData.append(`image_${i}_note`, img.note || '')
    })
    const result = await cheAnh(formData)
    if (result.error) {
      setStep('UPLOAD')
      toast({ title: tr('Chế ảnh thất bại', 'Meme edit failed', '表情包编辑失败', 'ミーム編集に失敗しました', '밈 편집 실패'), description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      await preloadImageUrl(result.resultUrl)
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      toast({ title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'), description: tr('Ảnh đã được chế.', 'Images have been edited.', '图片已编辑。', '画像を編集しました。', '이미지 편집이 완료되었습니다.'), duration: 3000 })
    }
  }

  const handleReset = () => {
    setStep('UPLOAD')
    setImages([])
    setMemeStyle('')
    setAspectRatio('1:1')
    setNote('')
    setResultUrl(null)
  }

  return (
    <>
      <Toaster />
      <div className="tool-page-container">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">{tr('Chế ảnh', 'Meme Image Editor', '表情包图片编辑', 'ミーム画像編集', '밈 이미지 편집')}</h1>
          <p className="text-muted-foreground mt-1">{tr('Chọn ảnh (tối đa 13), mô tả ý tưởng. AI biến tấu ảnh theo yêu cầu. 1,5–3 credits/ảnh.', 'Select images (max 13), describe idea. AI transforms images per request. 1.5–3 credits/image.', '选择图片（最多 13 张），描述想法。AI 按要求变换图片。1.5–3 积分/张。', '画像を選択（最大13枚）、アイデアを記述。AIが要望に応じて変形。1.5〜3クレジット/枚。', '이미지 선택 (최대 13장), 아이디어 설명. AI가 요청대로 변형. 1.5–3 크레딧/장.')}</p>
        </div>

        {step === 'UPLOAD' && (
          <div className="grid lg:grid-cols-[1fr_200px] gap-4 items-start">
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-amber-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="h-4 w-4 text-amber-600" /> {tr('Ảnh cần chế (tối đa 13)', 'Images to edit (max 13)', '待编辑图片（最多 13 张）', '編集する画像（最大13枚）', '편집할 이미지 (최대 13장)')}
                  </CardTitle>
                  <CardDescription className="text-xs">{tr('Chọn ảnh, dán ảnh (Ctrl+V) hoặc dán link ảnh. Ghi chú chung và/hoặc ghi chú riêng từng ảnh.', 'Select images, paste (Ctrl+V) or paste image URL. General and/or per-image notes.', '选择图片、粘贴 (Ctrl+V) 或粘贴图片链接。通用和/或每张图片备注。', '画像を選択、貼り付け(Ctrl+V)またはURL貼り付け。共通および/または各画像のメモ。', '이미지 선택, 붙여넣기(Ctrl+V) 또는 이미지 링크 붙여넣기. 공통 및/또는 개별 메모.')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground">{tr('Phong cách meme', 'Meme style', '表情包风格', 'ミームスタイル', '밈 스타일')} <span className="text-amber-600">*</span></h4>
                    <select
                      value={memeStyle}
                      onChange={(e) => setMemeStyle(e.target.value)}
                      className="w-full max-w-md h-11 rounded-lg border-2 border-amber-200 bg-white px-4 text-sm font-medium"
                    >
                      {MEME_STYLES.map((opt) => (
                        <option key={opt.value || 'empty'} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Ghi chú chung (tùy chọn – áp dụng cho tất cả ảnh)', 'General note (optional – applies to all images)', '通用备注（可选 – 应用于所有图片）', '共通メモ（任意・全画像に適用）', '공통 메모 (선택 – 모든 이미지에 적용)')}</h4>
                    <Textarea
                      placeholder={tr('Ví dụ: đặt vào bối cảnh vũ trụ, thêm mũ vua, biến thành nhân vật anime...', 'E.g.: place in space, add crown, turn into anime character...', '例如：放入太空背景、加皇冠、变成动漫角色...', '例：宇宙に配置、王冠追加、アニメキャラに...', '예: 우주 배경, 왕관 추가, 애니메이션 캐릭터로...')}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="bg-white/80 text-xs h-20 min-h-[80px] resize-y"
                    />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Ảnh cần chế (ghi chú riêng từng ảnh bên dưới)', 'Images to edit (per-image notes below)', '待编辑图片（下方每张图片备注）', '編集する画像（下に各画像のメモ）', '편집할 이미지 (아래 개별 메모)')}</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {images.map((img, i) => (
                        <div key={i} className="space-y-1.5">
                          <div className="relative group aspect-square rounded-lg border overflow-hidden bg-amber-50/60">
                            <ImagePreview src={img.preview} alt={`${tr('Ảnh', 'Image', '图片', '画像', '이미지')} ${i + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => handleRemove(i)}
                              className="absolute top-1 right-1 p-1 rounded-full bg-red-500/90 text-white hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-4 w-4" />
                            </button>
                            <span className="absolute bottom-1 left-1 text-xs bg-black/60 text-white px-2 py-0.5 rounded">
                              {i + 1}
                            </span>
                          </div>
                          <Input
                            placeholder={`${tr('Ghi chú riêng ảnh', 'Per-image note', '单张图片备注', '各画像メモ', '개별 이미지 메모')} ${i + 1} (${tr('tùy chọn', 'optional', '可选', '任意', '선택')})`}
                            value={img.note}
                            onChange={(e) => handleImageNoteChange(i, e.target.value)}
                            className="text-xs h-8"
                          />
                        </div>
                      ))}
                      {images.length < MAX_IMAGES && (
                        <label
                          htmlFor="che-anh-input"
                          className="aspect-square rounded-lg border-2 border-dashed border-amber-200 bg-amber-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-amber-300 hover:bg-amber-50/80 transition-colors"
                        >
                          <Plus className="h-10 w-10 text-amber-500" />
                          <p className="text-xs text-muted-foreground font-medium">{tr('Thêm ảnh', 'Add image', '添加图片', '画像を追加', '이미지 추가')}</p>
                        </label>
                      )}
                    </div>
                    <input
                      id="che-anh-input"
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleAddImages}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder={tr('Dán link ảnh rồi bấm Lấy ảnh', 'Paste image URL then click Fetch', '粘贴图片链接后点击获取', '画像URLを貼り付けて取得をクリック', '이미지 링크 붙여넣기 후 가져오기 클릭')}
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
                      {urlLoading ? tr('Đang tải...', 'Loading...', '加载中...', '読み込み中...', '불러오는 중...') : tr('Lấy ảnh', 'Fetch image', '获取图片', '画像を取得', '이미지 가져오기')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="lg:w-[200px] lg:shrink-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-amber-200/60 h-full">
                <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base">{tr('Tùy chọn', 'Options', '选项', 'オプション', '옵션')}</CardTitle>
                <CardDescription className="text-xs">{tr('Yêu cầu thêm và chất lượng xuất ảnh.', 'Additional requirements and output quality.', '附加要求和输出质量。', '追加要件と出力品質。', '추가 요구사항 및 출력 품질.')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Tỷ lệ khung hình', 'Aspect ratio', '画面比例', 'アスペクト比', '화면 비율')}</h4>
                    <div className="grid grid-cols-2 gap-1.5">
                      {CHE_ANH_ASPECT_RATIOS.map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setAspectRatio(r.value)}
                          className={`px-2 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                            aspectRatio === r.value ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                          }`}
                        >
                          {tr(r.labels[0], r.labels[1], r.labels[2], r.labels[3], r.labels[4])}
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
                      disabled={images.length === 0 || !memeStyle}
                      className="w-full max-w-[180px] h-9 shadow-md hover:shadow-lg transition-all text-sm bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> {tr('Chế ảnh', 'Edit meme', '编辑表情包', 'ミーム編集', '밈 편집')} ({imageQuality === '2K' ? '1,5' : '3'} credit)
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground mt-2">* {tr('Thời gian: 15–45 giây', 'Time: 15–45 seconds', '时间：15–45 秒', '所要時間: 15〜45秒', '소요 시간: 15–45초')}</p>
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
                mode="cheanh"
                title={tr('Đang chế ảnh', 'Editing images', '正在编辑图片', '画像を編集中', '이미지 편집 중')}
                description={tr('AI đang chỉnh sửa, biến tấu ảnh theo ý tưởng của bạn', 'AI is editing and transforming images per your idea', 'AI 正在根据您的想法编辑和变换图片', 'AIがアイデアに応じて編集・変形しています', 'AI가 아이디어에 맞춰 편집·변형 중입니다')}
                imagePreviews={images.map((img) => img.preview)}
              />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>{tr('Kết quả chế ảnh', 'Meme edit result', '表情包编辑结果', 'ミーム編集結果', '밈 편집 결과')}</CardTitle>
              <CardDescription>{tr('Ảnh đã được chế.', 'Images have been edited.', '图片已编辑。', '画像を編集しました。', '이미지 편집이 완료되었습니다.')}</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">{tr('Trước', 'Before', '之前', '前', '이전')}</h3>
                {images.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {images.map((img, i) => (
                      <div key={i} className="aspect-square rounded-lg border overflow-hidden">
                        <ImagePreview src={img.preview} alt={`${tr('Trước', 'Before', '之前', '前', '이전')} ${i + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground">{tr('Sau', 'After', '之后', '後', '이후')}</h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleReset}>
                      <RefreshCw className="mr-2 h-3 w-3" /> {tr('Thử lại', 'Try again', '重试', '再試行', '다시 시도')}
                    </Button>
                    <DownloadImageButton
                    imageUrl={resultUrl}
                    filename="che-anh-result"
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white border-0"
                    printReady
                    printReadyAspectRatio={aspectRatio}
                  />
                  </div>
                </div>
                <div
                  className="rounded-lg border overflow-hidden bg-white"
                  style={{ aspectRatio: aspectRatio.replace(':', '/') }}
                >
                  <ImagePreview src={resultUrl} alt={tr('Sau', 'After', '之后', '後', '이후')} className="w-full h-full object-cover" printReadyAspectRatio={aspectRatio} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">{tr('Ảnh do AI tạo có thể có sai sót.', 'AI-generated images may contain minor errors.', 'AI 生成结果可能存在误差。', 'AI生成結果には誤差が含まれる場合があります。', 'AI 생성 결과에는 오차가 있을 수 있습니다.')}</p>
    </>
  )
}
