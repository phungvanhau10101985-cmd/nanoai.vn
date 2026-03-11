'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import Link from 'next/link'
import { FileQuestion, RefreshCw, QrCode, Copy, Link2, BookOpen, FileDown, FileText } from 'lucide-react'
import QRCode from 'qrcode'
import { SUBJECTS, GRADE_LEVELS, GRADE_LEVEL_GROUPS } from '../tao-giao-trinh/lib/curriculum-subjects'
import { listCurriculaForExam, listOpenedCurriculaForExam } from '../tao-giao-trinh/actions'
import { latexToReadable } from '../tao-giao-trinh/lib/latex-to-readable'
import { exportWorksheetToPdf, exportWorksheetToWord } from '../tao-giao-trinh/lib/worksheet-export'

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
  const [minutesPerQuestion, setMinutesPerQuestion] = useState<number>(1.5)
  const [selectedCurriculumIds, setSelectedCurriculumIds] = useState<Set<string>>(new Set())
  const [curriculaList, setCurriculaList] = useState<Array<{ id: string; topic: string; subject_id: string; grade_level_id: string; isOwn?: boolean }>>([])
  const [openedCurriculaList, setOpenedCurriculaList] = useState<Array<{ id: string; topic: string; subject_id: string; grade_level_id: string; isOwn?: boolean }>>([])
  const [curriculumSearch, setCurriculumSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [browseLoading, setBrowseLoading] = useState(false)
  const [result, setResult] = useState<{ code: string; examUrl: string; totalQuestions: number; durationMinutes: number; title: string } | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [exportLoading, setExportLoading] = useState<'pdf' | 'word' | null>(null)
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
    Promise.all([
      listCurriculaForExam({ subjectId, gradeLevelId, limit: 100 }),
      listOpenedCurriculaForExam({ subjectId, gradeLevelId, limit: 30 }),
    ])
      .then(([allRes, openedRes]) => {
        if (allRes && 'items' in allRes) setCurriculaList(allRes.items)
        else setCurriculaList([])
        if (openedRes && 'items' in openedRes) setOpenedCurriculaList(openedRes.items)
        else setOpenedCurriculaList([])
      })
      .catch(() => {
        setCurriculaList([])
        setOpenedCurriculaList([])
      })
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
          minutesPerQuestion,
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
          title: title.trim() || 'Bài thi',
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

  const buildExamMarkdown = (examData: { title: string; durationMinutes: number; questions: Array<{ question_text: string; options: string[] }> }): string => {
    const lines: string[] = [
      `# ${examData.title}`,
      '',
      `**Thời gian: ${examData.durationMinutes} phút**`,
      '',
      '---',
      '',
    ]
    examData.questions.forEach((q, i) => {
      const qText = latexToReadable(q.question_text)
      lines.push(`### Câu ${i + 1}. ${qText}`)
      lines.push('')
      const opts = Array.isArray(q.options) ? q.options : []
      ;['A', 'B', 'C', 'D'].forEach((label, j) => {
        const opt = opts[j]
        if (opt) lines.push(`${label}. ${latexToReadable(opt)}`)
      })
      lines.push('')
    })
    return lines.join('\n')
  }

  const handleExportPdf = async () => {
    if (!result?.code) return
    setExportLoading('pdf')
    try {
      const res = await fetch(`/api/exam-session/${encodeURIComponent(result.code)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        toast({ title: tr('Lỗi', 'Error'), description: data?.error ?? 'Không tải được đề thi.', variant: 'destructive' })
        return
      }
      const md = buildExamMarkdown({
        title: data.title || result.title,
        durationMinutes: data.durationMinutes ?? result.durationMinutes,
        questions: data.questions ?? [],
      })
      const filename = `bai-thi-${result.code}.pdf`
      await exportWorksheetToPdf(md, filename, null)
      toast({ title: tr('Đã xuất PDF', 'PDF exported'), description: filename, duration: 2000 })
    } catch (e) {
      toast({ title: tr('Lỗi', 'Error'), description: e instanceof Error ? e.message : String(e), variant: 'destructive' })
    } finally {
      setExportLoading(null)
    }
  }

  const handleExportWord = async () => {
    if (!result?.code) return
    setExportLoading('word')
    try {
      const res = await fetch(`/api/exam-session/${encodeURIComponent(result.code)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        toast({ title: tr('Lỗi', 'Error'), description: data?.error ?? 'Không tải được đề thi.', variant: 'destructive' })
        return
      }
      const md = buildExamMarkdown({
        title: data.title || result.title,
        durationMinutes: data.durationMinutes ?? result.durationMinutes,
        questions: data.questions ?? [],
      })
      const filename = `bai-thi-${result.code}.docx`
      await exportWorksheetToWord(md, filename)
      toast({ title: tr('Đã xuất Word', 'Word exported'), description: filename, duration: 2000 })
    } catch (e) {
      toast({ title: tr('Lỗi', 'Error'), description: e instanceof Error ? e.message : String(e), variant: 'destructive' })
    } finally {
      setExportLoading(null)
    }
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
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportPdf}
                      disabled={exportLoading !== null}
                      className="gap-1.5"
                    >
                      {exportLoading === 'pdf' ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileDown className="h-4 w-4" />
                      )}
                      {tr('Xuất PDF', 'Export PDF')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportWord}
                      disabled={exportLoading !== null}
                      className="gap-1.5"
                    >
                      {exportLoading === 'word' ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                      {tr('Xuất Word', 'Export Word')}
                    </Button>
                  </div>
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
                  <label className="text-xs font-medium text-muted-foreground">{tr('Thời gian mỗi câu (phút)', 'Minutes per question')}</label>
                  <select
                    value={String(minutesPerQuestion)}
                    onChange={(e) => setMinutesPerQuestion(parseFloat(e.target.value))}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    <option value="0.5">0.5 {tr('phút', 'min')}</option>
                    <option value="1">1 {tr('phút', 'min')}</option>
                    <option value="1.5">1.5 {tr('phút', 'min')}</option>
                    <option value="2">2 {tr('phút', 'min')}</option>
                    <option value="2.5">2.5 {tr('phút', 'min')}</option>
                    <option value="3">3 {tr('phút', 'min')}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Số câu hỏi (tự tính)', 'Number of questions (auto)')}</label>
                  <div className="h-9 flex items-center rounded-md border border-input bg-muted/50 px-3 text-sm font-medium">
                    {(() => {
                      const t = EXAM_TYPES.find((x) => x.id === examType)
                      const dur = t?.duration ?? 15
                      const n = Math.max(1, Math.floor(dur / minutesPerQuestion))
                      return `${n} ${tr('câu', 'questions')}`
                    })()}
                  </div>
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
                  {tr('Chọn giáo trình (đã mở + của bạn + giáo viên khác)', 'Select curricula (opened + yours + other teachers)')}
                </label>
                {browseLoading ? (
                  <div className="flex items-center gap-2 py-2 text-muted-foreground text-sm">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    {tr('Đang tải...', 'Loading...')}
                  </div>
                ) : curriculaList.length === 0 && openedCurriculaList.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    {tr('Chưa có giáo trình cho môn/lớp này. ', 'No curricula for this subject/grade. ')}
                    <Link href="/tao-giao-trinh" className="text-primary hover:underline">
                      {tr('Tạo giáo trình', 'Create curriculum')}
                    </Link>
                    {tr(' trước, hoặc để trống để lấy câu hỏi chung.', ' first, or leave empty for general questions.')}
                  </p>
                ) : (
                  <>
                    <Input
                      placeholder={tr('Tìm theo tên bài học và chủ đề...', 'Search by lesson name and topic...')}
                      value={curriculumSearch}
                      onChange={(e) => setCurriculumSearch(e.target.value)}
                      className="text-sm h-8"
                    />
                    <div className="max-h-48 overflow-y-auto space-y-2 rounded border p-2 bg-muted/30">
                      {(() => {
                        const q = curriculumSearch.trim().toLowerCase()
                        const filterFn = (c: { topic: string; subject_id: string; grade_level_id: string }) =>
                          !q || c.topic.toLowerCase().includes(q) || c.subject_id.toLowerCase().includes(q) || c.grade_level_id.toLowerCase().includes(q)
                        const openedFiltered = openedCurriculaList.filter(filterFn)
                        const openedIds = new Set(openedFiltered.map((c) => c.id))
                        const allFiltered = q ? curriculaList.filter(filterFn) : curriculaList
                        const mine = allFiltered.filter((c) => c.isOwn && !openedIds.has(c.id))
                        const others = allFiltered.filter((c) => !c.isOwn && !openedIds.has(c.id))
                        return (
                          <>
                            {openedFiltered.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-xs font-medium text-primary">{tr('Giáo trình đã mở', 'Recently opened curricula')}</p>
                                {openedFiltered.map((c) => (
                                  <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                                    <input type="checkbox" checked={selectedCurriculumIds.has(c.id)} onChange={() => toggleCurriculum(c.id)} className="rounded" />
                                    <span className="text-sm truncate flex-1 min-w-0">{c.topic}</span>
                                    <span className="text-xs text-muted-foreground shrink-0">{c.subject_id} · {c.grade_level_id}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                            {mine.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-xs font-medium text-primary">{tr('Giáo trình của bạn', 'Your curricula')}</p>
                                {mine.map((c) => (
                                  <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                                    <input type="checkbox" checked={selectedCurriculumIds.has(c.id)} onChange={() => toggleCurriculum(c.id)} className="rounded" />
                                    <span className="text-sm truncate flex-1 min-w-0">{c.topic}</span>
                                    <span className="text-xs text-muted-foreground shrink-0">{c.subject_id} · {c.grade_level_id}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                            {others.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground">{tr('Giáo trình giáo viên khác', 'Other teachers\' curricula')}</p>
                                {others.map((c) => (
                                  <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                                    <input type="checkbox" checked={selectedCurriculumIds.has(c.id)} onChange={() => toggleCurriculum(c.id)} className="rounded" />
                                    <span className="text-sm truncate flex-1 min-w-0">{c.topic}</span>
                                    <span className="text-xs text-muted-foreground shrink-0">{c.subject_id} · {c.grade_level_id}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                            {openedFiltered.length === 0 && mine.length === 0 && others.length === 0 && (
                              <p className="text-xs text-muted-foreground py-2">{tr('Không tìm thấy giáo trình phù hợp.', 'No matching curricula.')}</p>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  </>
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
