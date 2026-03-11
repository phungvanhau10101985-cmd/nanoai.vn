'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { FileQuestion, RefreshCw, QrCode, Copy, Link2, BookOpen } from 'lucide-react'
import QRCode from 'qrcode'
import { SUBJECTS, GRADE_LEVELS, GRADE_LEVEL_GROUPS } from '../tao-giao-trinh/lib/curriculum-subjects'
import { listCurricula } from '../tao-giao-trinh/actions'

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

const EXAM_TYPES = [
  { id: '15ph', labelVi: '15 phút', labelEn: '15 min', duration: 15 },
  { id: '1tiet', labelVi: '1 tiết (45 phút)', labelEn: '1 period (45 min)', duration: 45 },
  { id: 'hocky', labelVi: 'Học kỳ (90 phút)', labelEn: 'Semester (90 min)', duration: 90 },
  { id: 'totnghiep', labelVi: 'Tốt nghiệp (120 phút)', labelEn: 'Graduation (120 min)', duration: 120 },
] as const

export default function TaoBaiThiClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [examType, setExamType] = useState<string>('15ph')
  const [subjectId, setSubjectId] = useState('toan')
  const [gradeLevelId, setGradeLevelId] = useState('lop-12')
  const [title, setTitle] = useState('')
  const [difficulty, setDifficulty] = useState<string>('')
  const [selectedCurriculumIds, setSelectedCurriculumIds] = useState<Set<string>>(new Set())
  const [curriculaList, setCurriculaList] = useState<Array<{ id: string; topic: string; subject_id: string; grade_level_id: string }>>([])
  const [loading, setLoading] = useState(false)
  const [browseLoading, setBrowseLoading] = useState(false)
  const [result, setResult] = useState<{ code: string; examUrl: string; totalQuestions: number; durationMinutes: number } | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const { toast } = useToast()

  const tr = (vi: string, en: string) => (uiLocale === 'en' ? en : vi)

  useEffect(() => {
    const syncLocale = () => setUiLocale(getWebLocaleFromCookie())
    syncLocale()
    const timer = window.setInterval(syncLocale, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    setBrowseLoading(true)
    listCurricula({ subjectId, gradeLevelId, limit: 100 })
      .then((res) => {
        if (res && 'items' in res) setCurriculaList(res.items)
        else setCurriculaList([])
      })
      .catch(() => setCurriculaList([]))
      .finally(() => setBrowseLoading(false))
  }, [subjectId, gradeLevelId])

  const toggleCurriculum = (id: string) => {
    setSelectedCurriculumIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSubmit = async () => {
    setLoading(true)
    setResult(null)
    setQrDataUrl(null)
    try {
      const res = await fetch('/api/exam-session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examType,
          subjectId,
          gradeLevelId,
          title: title.trim() || 'Bài thi',
          curriculumIds: [...selectedCurriculumIds],
          difficulty: difficulty || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ title: tr('Lỗi', 'Error'), description: data?.error ?? res.statusText, variant: 'destructive' })
        return
      }
      if (data.success && data.code && data.examUrl) {
        setResult({
          code: data.code,
          examUrl: data.examUrl,
          totalQuestions: data.totalQuestions ?? 0,
          durationMinutes: data.durationMinutes ?? 15,
        })
        try {
          const qr = await QRCode.toDataURL(data.examUrl, { width: 200, margin: 2 })
          setQrDataUrl(qr)
        } catch {
          /* ignore */
        }
        toast({ title: tr('Tạo thành công!', 'Created!'), description: tr('Đã tạo bài thi. Chia sẻ link hoặc QR cho học sinh.', 'Exam created. Share link or QR with students.'), duration: 3000 })
      }
    } catch (e) {
      toast({ title: tr('Lỗi', 'Error'), description: e instanceof Error ? e.message : String(e), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const copyLink = () => {
    if (!result?.examUrl) return
    navigator.clipboard.writeText(result.examUrl)
    toast({ title: tr('Đã copy', 'Copied'), description: tr('Link đã được sao chép.', 'Link copied.'), duration: 2000 })
  }

  return (
    <>
      <Toaster />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
            <FileQuestion className="h-7 w-7 text-violet-600" />
            {tr('Tạo bài thi trực tuyến', 'Create online exam')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {tr('15 phút, 1 tiết, học kỳ, tốt nghiệp. Chọn môn, lớp, bài. QR + link cho học sinh.', '15 min, 1 period, semester, graduation. Select subject, grade, lessons. QR + link for students.')}
          </p>
        </div>

        {result ? (
          <Card className="border border-emerald-200 dark:border-emerald-800">
            <CardHeader>
              <CardTitle className="text-emerald-700 dark:text-emerald-400">
                {tr('Bài thi đã tạo', 'Exam created')}
              </CardTitle>
              <CardDescription>
                {result.totalQuestions} {tr('câu', 'questions')} · {result.durationMinutes} {tr('phút', 'minutes')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                {qrDataUrl && (
                  <div className="flex-shrink-0 p-2 bg-white rounded-lg">
                    <img src={qrDataUrl} alt="QR" className="w-40 h-40" />
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{tr('Link làm bài', 'Exam link')}</span>
                  </div>
                  <div className="flex gap-2">
                    <Input readOnly value={result.examUrl} className="text-sm font-mono" />
                    <Button variant="outline" size="icon" onClick={copyLink} title={tr('Copy link', 'Copy link')}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tr('Mã bài thi', 'Exam code')}: <strong>{result.code}</strong>
                  </p>
                </div>
              </div>
              <Button variant="secondary" onClick={() => { setResult(null); setQrDataUrl(null) }}>
                {tr('Tạo bài thi khác', 'Create another exam')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <QrCode className="h-4 w-4 text-violet-600" />
                {tr('Thông tin bài thi', 'Exam info')}
              </CardTitle>
              <CardDescription>
                {tr('Chọn loại đề, môn, lớp. Có thể chọn giáo trình để lấy câu hỏi bám sát bài học.', 'Select exam type, subject, grade. Optionally select curricula to match questions to lessons.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{tr('Loại bài thi', 'Exam type')}</label>
                <div className="flex flex-wrap gap-2">
                  {EXAM_TYPES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setExamType(t.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        examType === t.id ? 'bg-violet-600 text-white' : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {uiLocale === 'en' ? t.labelEn : t.labelVi}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Môn học', 'Subject')}</label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    {SUBJECTS.map((s) => (
                      <option key={s.id} value={s.id}>{uiLocale === 'en' ? s.labelEn : s.labelVi}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Lớp', 'Grade')}</label>
                  <select
                    value={gradeLevelId}
                    onChange={(e) => setGradeLevelId(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    {GRADE_LEVEL_GROUPS.map((grp) => (
                      <optgroup key={grp.labelVi} label={uiLocale === 'en' ? grp.labelEn : grp.labelVi}>
                        {grp.ids.map((id) => {
                          const g = GRADE_LEVELS.find((x) => x.id === id)
                          return g ? <option key={g.id} value={g.id}>{uiLocale === 'en' ? g.labelEn : g.labelVi}</option> : null
                        })}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{tr('Tiêu đề (tùy chọn)', 'Title (optional)')}</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={tr('Bài thi Toán 15 phút', 'Math 15-min exam')}
                  className="text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{tr('Độ khó câu hỏi (tùy chọn)', 'Question difficulty (optional)')}</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="">{tr('Tất cả', 'All')}</option>
                  <option value="easy">{tr('Dễ', 'Easy')}</option>
                  <option value="medium">{tr('Trung bình', 'Medium')}</option>
                  <option value="hard">{tr('Khó', 'Hard')}</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <BookOpen className="h-3.5 w-3.5" />
                  {tr('Chọn giáo trình (để lấy câu bám sát bài)', 'Select curricula (to match questions to lessons)')}
                </label>
                {browseLoading ? (
                  <div className="flex items-center gap-2 py-2 text-muted-foreground text-sm">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    {tr('Đang tải...', 'Loading...')}
                  </div>
                ) : curriculaList.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    {tr('Chưa có giáo trình. Tạo giáo trình trước, hoặc để trống để lấy câu hỏi chung.', 'No curricula. Create curriculum first, or leave empty for general questions.')}
                  </p>
                ) : (
                  <div className="max-h-32 overflow-y-auto space-y-1 rounded border p-2 bg-muted/30">
                    {curriculaList.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                        <input
                          type="checkbox"
                          checked={selectedCurriculumIds.has(c.id)}
                          onChange={() => toggleCurriculum(c.id)}
                          className="rounded"
                        />
                        <span className="text-sm truncate">{c.topic}</span>
                        <span className="text-xs text-muted-foreground">{c.subject_id} · {c.grade_level_id}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    {tr('Đang tạo...', 'Creating...')}
                  </>
                ) : (
                  <>
                    <FileQuestion className="h-4 w-4 mr-2" />
                    {tr('Tạo bài thi', 'Create exam')}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
