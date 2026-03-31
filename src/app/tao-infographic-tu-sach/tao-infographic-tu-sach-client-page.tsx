'use client'

import { useState, useRef, ChangeEvent, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { createInfographicFromBook } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, RefreshCw, X, ImagePlus } from 'lucide-react'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { DownloadImageButton } from '@/components/download-image-button'
import { ImagePreview } from '@/components/ui/image-preview'
import { ImageProcessingLoader } from '@/components/image-processing-loader'
import { preloadImageUrl } from '@/lib/preload-image-url'
import { cn } from '@/lib/utils'

type Step = 'UPLOAD' | 'GENERATING' | 'RESULT'
type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

const MAX_BOOK_FILES = 6
const MAX_CONTENT_TEXT = 28000
const MAX_EDGE_PX = 1400

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

async function compressFilesForUpload(files: File[]): Promise<File[]> {
  if (typeof createImageBitmap !== 'function') return files.slice(0, MAX_BOOK_FILES)
  const out: File[] = []
  for (const file of files.slice(0, MAX_BOOK_FILES)) {
    if (!file.type.startsWith('image/')) continue
    let bmp: ImageBitmap | null = null
    try {
      bmp = await createImageBitmap(file)
      const w = bmp.width
      const h = bmp.height
      if (w < 1 || h < 1) continue
      const scale = Math.min(1, MAX_EDGE_PX / Math.max(w, h))
      const cw = Math.max(1, Math.round(w * scale))
      const ch = Math.max(1, Math.round(h * scale))
      const canvas = document.createElement('canvas')
      canvas.width = cw
      canvas.height = ch
      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      ctx.drawImage(bmp, 0, 0, cw, ch)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.82))
      if (!blob) continue
      out.push(new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }))
    } catch {
      out.push(file)
    } finally {
      bmp?.close()
    }
  }
  return out
}

type BookSlot = { id: string; file: File; preview: string }

export default function TaoInfographicTuSachClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [step, setStep] = useState<Step>('UPLOAD')
  const [topic, setTopic] = useState('')
  const [contentText, setContentText] = useState('')
  const [teacherNotes, setTeacherNotes] = useState('')
  const [bookSlots, setBookSlots] = useState<BookSlot[]>([])
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultSummary, setResultSummary] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const cost = 1.5

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

  const revokePreviews = (slots: BookSlot[]) => {
    slots.forEach((s) => {
      try {
        URL.revokeObjectURL(s.preview)
      } catch {
        /* ignore */
      }
    })
  }

  const handleFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (picked.length === 0) return
    const remain = MAX_BOOK_FILES - bookSlots.length
    if (remain <= 0) {
      toast({
        title: tr('Đủ số ảnh', 'Photo limit', '已达上限', '上限です', '상한 도달'),
        description: tr(`Tối đa ${MAX_BOOK_FILES} ảnh.`, `Up to ${MAX_BOOK_FILES} images.`, `最多 ${MAX_BOOK_FILES} 张。`, `最大 ${MAX_BOOK_FILES} 枚。`, `최대 ${MAX_BOOK_FILES}장.`),
        variant: 'destructive',
      })
      return
    }
    const compressed = await compressFilesForUpload(picked.slice(0, remain))
    const t0 = Date.now()
    setBookSlots((prev) => {
      const next = [...prev]
      compressed.forEach((file, i) => {
        if (next.length >= MAX_BOOK_FILES) return
        next.push({ id: `${t0}-${i}`, file, preview: URL.createObjectURL(file) })
      })
      return next
    })
  }

  const removeSlot = (id: string) => {
    setBookSlots((prev) => {
      const slot = prev.find((s) => s.id === id)
      if (slot) {
        try {
          URL.revokeObjectURL(slot.preview)
        } catch {
          /* ignore */
        }
      }
      return prev.filter((s) => s.id !== id)
    })
  }

  const handleSubmit = async () => {
    const textOk = contentText.trim().length >= 40
    const hasImg = bookSlots.length > 0
    if (!textOk && !hasImg) {
      toast({
        title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
        description: tr(
          'Nhập nội dung chữ (khoảng 40 ký tự trở lên) hoặc thêm ít nhất một ảnh trang sách.',
          'Enter at least ~40 characters or add at least one textbook photo.',
          '请输入约 40 字以上内容，或至少添加一张教材页照片。',
          '約40文字以上を入力するか、教科書の写真を1枚以上追加してください。',
          '약 40자 이상 입력하거나 교과서 사진을 1장 이상 추가하세요.'
        ),
        variant: 'destructive',
      })
      return
    }

    setStep('GENERATING')
    await waitForNextPaint()
    const formData = new FormData()
    formData.append('topic', topic.trim())
    formData.append('contentText', contentText.trim())
    formData.append('teacherNotes', teacherNotes.trim())
    formData.append('outputLocale', getWebLocaleFromCookie())
    bookSlots.forEach((s) => formData.append('bookPage', s.file))

    const result = await createInfographicFromBook(formData)
    if (result.error) {
      setStep('UPLOAD')
      toast({
        title: tr('Tạo infographic thất bại', 'Infographic failed', '生成失败', '作成に失敗', '인포그래픽 실패'),
        description: result.error,
        variant: 'destructive',
        duration: 6000,
      })
    } else if (result.success && result.resultUrl) {
      await preloadImageUrl(result.resultUrl)
      setResultUrl(result.resultUrl)
      setResultSummary(result.summary ?? null)
      setStep('RESULT')
      toast({
        title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'),
        description: tr('Đã tạo ảnh infographic.', 'Infographic image created.', '信息图已生成。', 'インフォグラフィックを作成しました。', '인포그래픽이 생성되었습니다.'),
        duration: 3000,
      })
    }
  }

  const handleReset = () => {
    setBookSlots((prev) => {
      revokePreviews(prev)
      return []
    })
    setStep('UPLOAD')
    setTopic('')
    setContentText('')
    setTeacherNotes('')
    setResultUrl(null)
    setResultSummary(null)
  }

  return (
    <>
      <Toaster />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">
            {tr('Infographic từ sách / nội dung', 'Infographic from book or text', '从书籍或内容生成信息图', '教科書・内容からインフォグラフィック', '교과서·내용으로 인포그래픽')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {tr(
              'Gemini 2.5 Flash đọc ảnh trang sách và chữ bạn nhập → sơ đồ tư duy (tóm tắt) → ảnh infographic 16:9 (2K). 1,5 credits/lần.',
              'Gemini 2.5 Flash reads textbook photos and your text → mind-map summary → 16:9 infographic (2K). 1.5 credits per run.',
              'Gemini 2.5 Flash 读取教材照片与文本 → 思维导图摘要 → 16:9 信息图（2K）。每次 1.5 积分。',
              'Gemini 2.5 Flash が写真とテキストを読み取り → マインドマップ要約 → 16:9 インフォグラフィック（2K）。1.5クレジット/回。',
              'Gemini 2.5 Flash가 사진·텍스트 읽기 → 마인드맵 요약 → 16:9 인포그래픽(2K). 회당 1.5 크레딧.'
            )}
          </p>
        </div>

        {step === 'UPLOAD' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-violet-200/60 relative z-10">
            <CardHeader className="p-4 sm:p-6 pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-violet-600 shrink-0" />
                {tr('Tạo infographic', 'Create infographic', '创建信息图', 'インフォグラフィック作成', '인포그래픽 만들기')}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {tr(
                  'Tiêu đề (tuỳ chọn) → nội dung chữ và/hoặc ảnh trang sách → ghi chú giáo viên → Tạo.',
                  'Optional title → text and/or textbook photos → teacher notes → Generate.',
                  '可选标题 → 文本和/或教材页照片 → 教师备注 → 生成。',
                  '任意のタイトル → テキストと/または教科書写真 → メモ → 生成。',
                  '선택 제목 → 텍스트·교과서 사진 → 메모 → 생성.'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-5">
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {tr('Tiêu đề bài (tuỳ chọn)', 'Lesson title (optional)', '课题标题（可选）', '授業タイトル（任意）', '수업 제목(선택)')}
                </h4>
                <Input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={500} placeholder={tr('Ví dụ: Phân số lớp 6', 'e.g. Fractions grade 6', '例如：六年级分数', '例：分数 小6', '예: 분수 6학년')} />
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {tr('Ảnh trang sách / tài liệu (tuỳ chọn)', 'Textbook photos (optional)', '教材页照片（可选）', '教科書の写真（任意）', '교과서 사진(선택)')}
                </h4>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={bookSlots.length >= MAX_BOOK_FILES}
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-1.5"
                  >
                    <ImagePlus className="h-4 w-4" />
                    {tr('Thêm ảnh', 'Add images', '添加图片', '画像を追加', '이미지 추가')}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {bookSlots.length}/{MAX_BOOK_FILES}
                  </span>
                </div>
                {bookSlots.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {bookSlots.map((s) => (
                      <div key={s.id} className="relative h-20 w-16 overflow-hidden rounded-md border bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.preview} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeSlot(s.id)}
                          className="absolute right-0 top-0 rounded-bl bg-background/90 p-0.5"
                          aria-label={tr('Xóa', 'Remove', '删除', '削除', '제거')}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {tr('Nội dung chữ', 'Text content', '文字内容', 'テキスト内容', '텍스트 내용')}
                </h4>
                <Textarea
                  value={contentText}
                  onChange={(e) => setContentText(e.target.value)}
                  rows={8}
                  maxLength={MAX_CONTENT_TEXT}
                  placeholder={tr(
                    'Dán nội dung bài học, đoạn sách, hoặc ghi chú dạy… (hoặc chỉ dùng ảnh phía trên).',
                    'Paste lesson text, book excerpt, or notes… (or rely on photos only).',
                    '粘贴课文、书摘或讲义……（也可仅用上方照片）。',
                    '授業テキストや書籍の抜粋を貼り付け…（写真のみでも可）。',
                    '수업 텍스트·발췌를 붙여넣기…(사진만으로도 가능).'
                  )}
                  className="min-h-[160px] resize-y"
                />
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {tr('Ghi chú / trọng tâm (tuỳ chọn)', 'Focus notes (optional)', '重点备注（可选）', 'メモ（任意）', '메모(선택)')}
                </h4>
                <Textarea
                  value={teacherNotes}
                  onChange={(e) => setTeacherNotes(e.target.value)}
                  rows={3}
                  maxLength={4000}
                  placeholder={tr('Ví dụ: nhấn mạnh phần định nghĩa…', 'e.g. emphasize definitions…', '例如：强调定义部分…', '例：定義を強調…', '예: 정의 부분 강조…')}
                  className="resize-y min-h-[72px]"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between pt-2">
                <DepositCreditButton />
                <Button
                  type="button"
                  size="lg"
                  className={cn('gap-2 bg-violet-600 hover:bg-violet-700')}
                  onClick={() => checkCreditsAndProceed(cost, handleSubmit)}
                >
                  <Upload className="h-4 w-4" />
                  {tr(`Tạo infographic (${cost} credits)`, `Create infographic (${cost} credits)`, `创建信息图（${cost} 积分）`, `作成（${cost}クレジット）`, `만들기 (${cost} 크레딧)`)}
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
                title={tr('Đang tạo infographic', 'Creating infographic', '正在创建信息图', 'インフォグラフィック作成中', '인포그래픽 생성 중')}
                description={tr(
                  'Đang đọc ảnh/chữ, tóm tắt và vẽ ảnh 16:9…',
                  'Reading images/text, summarizing, rendering 16:9…',
                  '正在读取图文、摘要并渲染 16:9…',
                  '画像・テキストを読み取り、要約して16:9を描画中…',
                  '이미지·텍스트 읽기, 요약, 16:9 렌더링…'
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
                {tr(
                  'Ảnh infographic 16:9 — bấm ảnh để xem phóng to.',
                  '16:9 infographic — click the image to enlarge.',
                  '16:9 信息图 — 点击图片可放大。',
                  '16:9 インフォグラフィック — 画像をタップで拡大。',
                  '16:9 인포그래픽 — 이미지를 눌러 확대.'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Khung tỷ lệ cố định — ImagePreview(fill) cần cha có chiều cao, nếu không ảnh biến mất */}
              <div
                className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-lg border bg-muted/30"
                style={{ aspectRatio: '16 / 9' }}
              >
                <ImagePreview
                  src={resultUrl}
                  alt={tr('Infographic', 'Infographic', '信息图', 'インフォグラフィック', '인포그래픽')}
                  asImg
                  printReadyAspectRatio="16:9"
                  className="absolute inset-0 h-full w-full rounded-md"
                />
              </div>
              {resultSummary ? (
                <details className="rounded-lg border bg-muted/20 text-sm">
                  <summary className="cursor-pointer select-none px-3 py-2 font-medium text-muted-foreground hover:bg-muted/40">
                    {tr('Xem tóm tắt dạng chữ (tùy chọn)', 'View text summary (optional)', '查看文字摘要（可选）', 'テキスト要約を表示（任意）', '텍스트 요약 보기(선택)')}
                  </summary>
                  <div className="border-t px-3 py-2 whitespace-pre-wrap text-muted-foreground">{resultSummary}</div>
                </details>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <DownloadImageButton
                  imageUrl={resultUrl}
                  filename="infographic-result"
                  size="sm"
                  className="bg-violet-600 hover:bg-violet-700 text-white border-0"
                />
                <Button type="button" variant="outline" className="gap-2" onClick={handleReset}>
                  <RefreshCw className="h-4 w-4" />
                  {tr('Tạo mới', 'Start over', '重新开始', '最初から', '다시 하기')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
