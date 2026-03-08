'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Sparkles, Copy, FileDown, RefreshCw, FileSpreadsheet, QrCode, FolderOpen, BookOpen, FileText, Presentation } from 'lucide-react'
import QRCode from 'qrcode'
import { exportWorksheetToPdf, exportWorksheetToWord } from './lib/worksheet-export'
import { latexToReadable } from './lib/latex-to-readable'
import { curriculumToSlidesMarkdown } from './lib/curriculum-to-slides'
import { GammaSlideViewer } from './components/gamma-slide-viewer'
import { SUBJECTS, GRADE_LEVELS, TEXTBOOK_SETS, LESSON_TYPES } from './lib/curriculum-subjects'
import { createCurriculum, createWorksheet, listCurricula, listWorksheets, getCurriculumById, getWorksheetById } from './actions'

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

type Step = 'INPUT' | 'GENERATING' | 'RESULT'

export default function TaoGiaoTrinhClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [step, setStep] = useState<Step>('INPUT')
  const [subjectId, setSubjectId] = useState('toan')
  const [gradeLevelId, setGradeLevelId] = useState('lop-6')
  const [textbookSetId, setTextbookSetId] = useState('ket-noi-tri-thuc')
  const [lessonTypeId, setLessonTypeId] = useState('hinh-thanh-kien-thuc')
  const [topic, setTopic] = useState('')
  const [numLessons, setNumLessons] = useState(5)
  const [lessonDurationMinutes, setLessonDurationMinutes] = useState(45)
  const [modelProvider, setModelProvider] = useState<'gemini' | 'deepseek'>('gemini')
  const [goals, setGoals] = useState('')
  const [curriculumMarkdown, setCurriculumMarkdown] = useState('')
  const [worksheetMarkdown, setWorksheetMarkdown] = useState('')
  const [worksheetId, setWorksheetId] = useState<string | null>(null)
  const [worksheetQrDataUrl, setWorksheetQrDataUrl] = useState<string | null>(null)
  const [worksheetLoading, setWorksheetLoading] = useState(false)
  const [showBrowse, setShowBrowse] = useState(false)
  const [curriculaList, setCurriculaList] = useState<Array<{ id: string; topic: string; subject_id: string; grade_level_id: string; textbook_set_id?: string; lesson_type_id?: string; num_lessons?: number; lesson_duration_minutes?: number; created_at: string }>>([])
  const [worksheetsList, setWorksheetsList] = useState<Array<{ id: string; topic: string; subject_id: string; grade_level_id: string; created_at: string }>>([])
  const [browseLoading, setBrowseLoading] = useState(false)
  const [showSlideViewer, setShowSlideViewer] = useState(false)
  const { toast } = useToast()

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
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!showBrowse) return
    setBrowseLoading(true)
    Promise.all([
      listCurricula({ subjectId: subjectId || undefined, gradeLevelId: gradeLevelId || undefined }),
      listWorksheets({ subjectId: subjectId || undefined, gradeLevelId: gradeLevelId || undefined }),
    ]).then(([curRes, wsRes]) => {
      if (curRes && 'items' in curRes) setCurriculaList(curRes.items)
      else setCurriculaList([])
      if (wsRes && 'items' in wsRes) setWorksheetsList(wsRes.items)
      else setWorksheetsList([])
    }).catch(() => {
      setCurriculaList([])
      setWorksheetsList([])
    }).finally(() => setBrowseLoading(false))
  }, [showBrowse, subjectId, gradeLevelId])

  const handleSubmit = async () => {
    if (!topic.trim()) {
      toast({
        title: tr('Thiếu thông tin', 'Missing information', '缺少信息', '情報不足', '정보 누락'),
        description: tr('Vui lòng nhập chủ đề / bài học.', 'Please enter topic/lesson.', '请输入主题/课程。', '主題・授業を入力してください。', '주제/수업을 입력해 주세요.'),
        variant: 'destructive',
      })
      return
    }
    setStep('GENERATING')
    const formData = new FormData()
    formData.append('subjectId', subjectId)
    formData.append('gradeLevelId', gradeLevelId)
    formData.append('textbookSetId', textbookSetId)
    formData.append('lessonTypeId', lessonTypeId)
    formData.append('topic', topic.trim())
    formData.append('numLessons', String(numLessons))
    formData.append('lessonDurationMinutes', String(lessonDurationMinutes))
    formData.append('modelProvider', modelProvider)
    formData.append('goals', goals.trim())
    const result = await createCurriculum(formData)
    if (result.error) {
      setStep('INPUT')
      toast({
        title: tr('Tạo giáo trình thất bại', 'Create curriculum failed', '创建课程失败', 'カリキュラム作成に失敗', '교육과정 생성 실패'),
        description: result.error,
        variant: 'destructive',
        duration: 5000,
      })
    } else if (result.success && result.curriculumMarkdown) {
      setCurriculumMarkdown(result.curriculumMarkdown)
      setStep('RESULT')
      toast({
        title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'),
        description: tr('Giáo trình đã được tạo.', 'Curriculum has been created.', '课程已创建。', 'カリキュラムを作成しました。', '교육과정이 생성되었습니다.'),
        duration: 3000,
      })
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(curriculumMarkdown)
    toast({ title: tr('Đã sao chép', 'Copied', '已复制', 'コピーしました', '복사됨'), duration: 2000 })
  }

  const handleDownload = () => {
    const blob = new Blob([curriculumMarkdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `giao-trinh-${topic.slice(0, 30).replace(/\s+/g, '-')}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: tr('Đã tải xuống', 'Downloaded', '已下载', 'ダウンロードしました', '다운로드됨'), duration: 2000 })
  }

  const handleOpenSlides = () => {
    setShowSlideViewer(true)
  }

  const handleDownloadSlides = () => {
    const slidesMd = curriculumToSlidesMarkdown(curriculumMarkdown, topic.trim() || 'Bài giảng')
    const blob = new Blob([slidesMd], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `slide-bai-giang-${topic.slice(0, 25).replace(/\s+/g, '-')}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: tr('Đã tải slide', 'Slides downloaded', '已下载幻灯片', 'スライドをダウンロード', '슬라이드 다운로드됨'), duration: 2000 })
  }

  const handleReset = () => {
    setStep('INPUT')
    setCurriculumMarkdown('')
    setWorksheetMarkdown('')
    setWorksheetId(null)
    setWorksheetQrDataUrl(null)
  }

  const handleLoadCurriculum = async (id: string) => {
    const result = await getCurriculumById(id)
    if (result.error) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: result.error, variant: 'destructive' })
      return
    }
    if (result.success && result.curriculum) {
      const c = result.curriculum
      setTopic(c.topic ?? '')
      setSubjectId(c.subject_id ?? 'toan')
      setGradeLevelId(c.grade_level_id ?? 'lop-6')
      setTextbookSetId(c.textbook_set_id ?? 'ket-noi-tri-thuc')
      setLessonTypeId(c.lesson_type_id ?? 'hinh-thanh-kien-thuc')
      setNumLessons(c.num_lessons ?? 5)
      setLessonDurationMinutes(c.lesson_duration_minutes ?? 45)
      setGoals(c.goals ?? '')
      setCurriculumMarkdown(c.content_markdown ?? '')
      setWorksheetMarkdown('')
      setWorksheetId(null)
      setWorksheetQrDataUrl(null)
      setStep('RESULT')
      setShowBrowse(false)
      toast({ title: tr('Đã tải giáo trình', 'Curriculum loaded', '已加载课程', 'カリキュラムを読み込み', '교육과정 로드됨'), duration: 2000 })
    }
  }

  const handleLoadWorksheet = async (id: string) => {
    const result = await getWorksheetById(id)
    if (result.error) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: result.error, variant: 'destructive' })
      return
    }
    if (result.success && result.worksheet) {
      const w = result.worksheet
      setTopic(w.topic ?? '')
      setSubjectId(w.subject_id ?? 'toan')
      setGradeLevelId(w.grade_level_id ?? 'lop-6')
      setWorksheetMarkdown(w.content_markdown ?? '')
      setWorksheetId(w.id)
      setCurriculumMarkdown('')
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
      QRCode.toDataURL(`${baseUrl}/phieu-bai-tap/${w.id}`, { width: 180, margin: 2 }).then(setWorksheetQrDataUrl).catch(() => setWorksheetQrDataUrl(null))
      setStep('RESULT')
      setShowBrowse(false)
      toast({ title: tr('Đã tải phiếu bài tập', 'Worksheet loaded', '已加载练习', 'ワークシートを読み込み', '워크시트 로드됨'), duration: 2000 })
    }
  }

  const handleCreateWorksheet = async () => {
    setWorksheetLoading(true)
    const formData = new FormData()
    formData.append('curriculumMarkdown', curriculumMarkdown)
    formData.append('topic', topic.trim())
    formData.append('subjectId', subjectId)
    formData.append('gradeLevelId', gradeLevelId)
    formData.append('modelProvider', modelProvider)
    const result = await createWorksheet(formData)
    setWorksheetLoading(false)
    if (result.error) {
      toast({
        title: tr('Tạo phiếu bài tập thất bại', 'Create worksheet failed', '创建练习失败', 'ワークシート作成に失敗', '워크시트 생성 실패'),
        description: result.error,
        variant: 'destructive',
        duration: 5000,
      })
    } else if (result.success && result.worksheetMarkdown) {
      setWorksheetMarkdown(result.worksheetMarkdown)
      setWorksheetId(result.worksheetId ?? null)
      if (result.worksheetId) {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
        const url = `${baseUrl}/phieu-bai-tap/${result.worksheetId}`
        QRCode.toDataURL(url, { width: 180, margin: 2 }).then(setWorksheetQrDataUrl).catch(() => {})
      } else {
        setWorksheetQrDataUrl(null)
      }
      toast({
        title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'),
        description: tr('Phiếu bài tập đã được tạo.', 'Worksheet has been created.', '练习已创建。', 'ワークシートを作成しました。', '워크시트가 생성되었습니다.'),
        duration: 3000,
      })
    }
  }

  const handleCopyWorksheet = () => {
    navigator.clipboard.writeText(worksheetMarkdown)
    toast({ title: tr('Đã sao chép', 'Copied', '已复制', 'コピーしました', '복사됨'), duration: 2000 })
  }

  const handleDownloadWorksheet = () => {
    const blob = new Blob([worksheetMarkdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `phieu-bai-tap-${topic.slice(0, 25).replace(/\s+/g, '-')}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: tr('Đã tải xuống', 'Downloaded', '已下载', 'ダウンロードしました', '다운로드됨'), duration: 2000 })
  }

  const handleExportPdf = () => {
    const name = `phieu-bai-tap-${topic.slice(0, 25).replace(/\s+/g, '-')}.pdf`
    exportWorksheetToPdf(worksheetMarkdown, name, null).then(() => {
      toast({ title: tr('Đã tải PDF', 'PDF downloaded', '已下载PDF', 'PDFをダウンロード', 'PDF 다운로드됨'), duration: 2000 })
    }).catch(() => {
      toast({ title: tr('Xuất PDF thất bại', 'PDF export failed', 'PDF导出失败', 'PDFエクスポート失敗', 'PDF 내보내기 실패'), variant: 'destructive' })
    })
  }

  const handleExportWord = () => {
    const name = `phieu-bai-tap-${topic.slice(0, 25).replace(/\s+/g, '-')}.docx`
    exportWorksheetToWord(worksheetMarkdown, name).then(() => {
      toast({ title: tr('Đã tải Word', 'Word downloaded', '已下载Word', 'Wordをダウンロード', 'Word 다운로드됨'), duration: 2000 })
    }).catch(() => {
      toast({ title: tr('Xuất Word thất bại', 'Word export failed', 'Word导出失败', 'Wordエクスポート失敗', 'Word 내보내기 실패'), variant: 'destructive' })
    })
  }

  return (
    <>
      <Toaster />
      {showSlideViewer && curriculumMarkdown && (
        <GammaSlideViewer
          curriculumMarkdown={curriculumMarkdown}
          topic={topic.trim() || 'Bài giảng'}
          onClose={() => setShowSlideViewer(false)}
        />
      )}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">
            {tr('Tạo giáo trình bằng AI', 'AI Curriculum Creator', 'AI 课程创建', 'AI カリキュラム作成', 'AI 교육과정 생성')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {tr(
              'Chọn môn học, cấp độ, nhập chủ đề. AI tạo giáo trình chi tiết cho giáo viên.',
              'Select subject, grade level, enter topic. AI creates detailed curriculum for teachers.',
              '选择科目、年级，输入主题。AI 为教师创建详细课程。',
              '科目・学年を選択し、主題を入力。AIが教師向けの詳細カリキュラムを作成。',
              '과목, 학년 선택, 주제 입력. AI가 교사를 위한 상세 교육과정 생성.'
            )}
          </p>
        </div>

        <Card className="border shadow-sm border-slate-200/80 dark:border-slate-700/50">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-violet-600" />
                {tr('Kho giáo trình & phiếu bài tập', 'Curriculum & worksheet library', '课程与练习库', 'カリキュラム・ワークシートライブラリ', '교육과정·워크시트 라이브러리')}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowBrowse(!showBrowse)}>
                {showBrowse ? tr('Thu gọn', 'Collapse', '收起', '閉じる', '접기') : tr('Xem kho', 'Browse library', '浏览库', 'ライブラリを見る', '라이브러리 보기')}
              </Button>
            </div>
            <CardDescription className="text-xs">
              {tr('Dùng lại giáo trình hoặc phiếu bài tập đã tạo bởi bạn hoặc giáo viên khác.', 'Reuse curricula or worksheets created by you or other teachers.', '重用您或其他教师创建的课程或练习。', '自分や他の教師が作成したカリキュラム・ワークシートを再利用。', '본인 또는 다른 교사가 만든 교육과정·워크시트 재사용.')}
            </CardDescription>
          </CardHeader>
          {showBrowse && (
            <CardContent className="pt-0 space-y-4">
              {browseLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-8 w-8 text-violet-500 animate-spin" />
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5" />
                      {tr('Giáo trình', 'Curricula', '课程', 'カリキュラム', '교육과정')} ({curriculaList.length})
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-1 rounded border p-2 bg-slate-50/50 dark:bg-slate-900/30">
                      {curriculaList.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">{tr('Chưa có giáo trình nào.', 'No curricula yet.', '暂无课程。', 'カリキュラムがありません。', '교육과정이 없습니다.')}</p>
                      ) : (
                        curriculaList.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => void handleLoadCurriculum(c.id)}
                            className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors"
                          >
                            <span className="font-medium truncate block">{c.topic}</span>
                            <span className="text-xs text-muted-foreground">{c.subject_id} · {c.grade_level_id}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      {tr('Phiếu bài tập', 'Worksheets', '练习', 'ワークシート', '워크시트')} ({worksheetsList.length})
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-1 rounded border p-2 bg-slate-50/50 dark:bg-slate-900/30">
                      {worksheetsList.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">{tr('Chưa có phiếu bài tập nào.', 'No worksheets yet.', '暂无练习。', 'ワークシートがありません。', '워크시트가 없습니다.')}</p>
                      ) : (
                        worksheetsList.map((w) => (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => void handleLoadWorksheet(w.id)}
                            className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                          >
                            <span className="font-medium truncate block">{w.topic}</span>
                            <span className="text-xs text-muted-foreground">{w.subject_id} · {w.grade_level_id}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          )}
        </Card>

        {step === 'INPUT' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-violet-200/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-violet-600" />
                {tr('Thông tin giáo trình', 'Curriculum info', '课程信息', 'カリキュラム情報', '교육과정 정보')}
              </CardTitle>
              <CardDescription>
                {tr('Chọn môn, cấp độ, nhập chủ đề và mục tiêu. AI tạo giáo trình Markdown.', 'Select subject, grade, enter topic and goals. AI generates Markdown curriculum.', '选择科目、年级，输入主题和目标。AI 生成 Markdown 课程。', '科目・学年を選択、主題と目標を入力。AIがMarkdownカリキュラムを生成。', '과목·학년 선택, 주제·목표 입력. AI가 Markdown 교육과정 생성.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Môn học', 'Subject', '科目', '科目', '과목')}</label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    {SUBJECTS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {uiLocale === 'en' ? s.labelEn : s.labelVi}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Cấp độ', 'Grade level', '年级', '学年', '학년')}</label>
                  <select
                    value={gradeLevelId}
                    onChange={(e) => setGradeLevelId(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    {GRADE_LEVELS.map((g) => (
                      <option key={g.id} value={g.id}>
                        {uiLocale === 'en' ? g.labelEn : g.labelVi}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Bộ sách giáo khoa', 'Textbook set', '教材', '教科書', '교과서')}</label>
                  <select
                    value={textbookSetId}
                    onChange={(e) => setTextbookSetId(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    {TEXTBOOK_SETS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {uiLocale === 'en' ? t.labelEn : t.labelVi}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Loại bài học', 'Lesson type', '课程类型', '授業タイプ', '수업 유형')}</label>
                  <select
                    value={lessonTypeId}
                    onChange={(e) => setLessonTypeId(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    {LESSON_TYPES.map((l) => (
                      <option key={l.id} value={l.id}>
                        {uiLocale === 'en' ? l.labelEn : l.labelVi}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  {tr('Chủ đề / Bài học', 'Topic / Lesson', '主题/课程', '主題・授業', '주제/수업')} <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder={tr('VD: Phân số, Truyện ngắn, Động từ bất quy tắc...', 'e.g. Fractions, Short story, Irregular verbs...', '例如：分数、短篇小说、不规则动词...', '例: 分数、短編小説、不規則動詞...', '예: 분수, 단편소설, 불규칙 동사...')}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="bg-white/80"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Số tiết (1–10)', 'Lessons (1–10)', '课时 (1–10)', '時限 (1–10)', '차시 (1–10)')}</label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={numLessons}
                    onChange={(e) => setNumLessons(Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                    className="w-24 bg-white/80"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Thời gian mỗi tiết', 'Duration per lesson', '每课时长', '1時限の時間', '차시당 시간')}</label>
                  <select
                    value={lessonDurationMinutes}
                    onChange={(e) => setLessonDurationMinutes(parseInt(e.target.value, 10))}
                    className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm bg-white/80"
                  >
                    <option value={35}>35 {tr('phút', 'min', '分钟', '分', '분')}</option>
                    <option value={40}>40 {tr('phút', 'min', '分钟', '分', '분')}</option>
                    <option value={45}>45 {tr('phút', 'min', '分钟', '分', '분')}</option>
                    <option value={60}>60 {tr('phút', 'min', '分钟', '分', '분')}</option>
                    <option value={90}>90 {tr('phút', 'min', '分钟', '分', '분')}</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{tr('Mô hình AI', 'AI model', 'AI 模型', 'AIモデル', 'AI 모델')}</label>
                <select
                  value={modelProvider}
                  onChange={(e) => setModelProvider(e.target.value as 'gemini' | 'deepseek')}
                  className="w-full sm:max-w-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-sm bg-white/80"
                >
                  <option value="gemini">{tr('Gemini 2.0 Flash', 'Gemini 2.0 Flash', 'Gemini 2.0 Flash', 'Gemini 2.0 Flash', 'Gemini 2.0 Flash')}</option>
                  <option value="deepseek">{tr('DeepSeek V3', 'DeepSeek V3', 'DeepSeek V3', 'DeepSeek V3', 'DeepSeek V3')}</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{tr('Mục tiêu bổ sung (tùy chọn)', 'Additional goals (optional)', '补充目标（可选）', '追加目標（任意）', '추가 목표 (선택)')}</label>
                <Textarea
                  placeholder={tr('Mô tả mục tiêu, yêu cầu đặc biệt...', 'Describe goals, special requirements...', '描述目标、特殊要求...', '目標・特別な要件を記述...', '목표, 특별 요구사항 설명...')}
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  className="bg-white/80 min-h-[80px] resize-y"
                />
              </div>
              <Button onClick={() => void handleSubmit()} disabled={step === 'GENERATING'} className="w-full bg-violet-600 hover:bg-violet-700 text-white">
                <Sparkles className="h-4 w-4 mr-2" />
                {tr('Tạo giáo trình', 'Create curriculum', '创建课程', 'カリキュラムを作成', '교육과정 생성')}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'GENERATING' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-violet-200/60">
            <CardContent className="flex flex-col items-center py-12">
              <RefreshCw className="h-12 w-12 text-violet-500 animate-spin" />
              <p className="text-sm text-muted-foreground mt-4">{tr('AI đang tạo giáo trình...', 'AI is creating curriculum...', 'AI 正在创建课程...', 'AIがカリキュラムを作成中...', 'AI가 교육과정 생성 중...')}</p>
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && (curriculumMarkdown || worksheetMarkdown) && (
          <>
            {curriculumMarkdown && (
            <Card className="border shadow-sm overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">{tr('Giáo trình đã tạo', 'Generated curriculum', '已创建课程', '作成したカリキュラム', '생성된 교육과정')}</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    <Copy className="h-3.5 w-3.5 mr-1" /> {tr('Sao chép', 'Copy', '复制', 'コピー', '복사')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    <FileDown className="h-3.5 w-3.5 mr-1" /> {tr('Tải .md', 'Download .md', '下载 .md', '.md をダウンロード', '.md 다운로드')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleOpenSlides} className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-300 dark:hover:bg-amber-950/30">
                    <Presentation className="h-3.5 w-3.5 mr-1" /> {tr('Xem slide (Gamma)', 'View slides (Gamma)', '查看幻灯片', 'スライド表示', '슬라이드 보기')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleDownloadSlides} className="text-amber-600 hover:text-amber-700">
                    .md
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => void handleCreateWorksheet()}
                    disabled={worksheetLoading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
                    {worksheetLoading
                      ? tr('Đang tạo...', 'Creating...', '创建中...', '作成中...', '생성 중...')
                      : tr('Tạo Phiếu bài tập đi kèm', 'Create worksheet', '创建练习', 'ワークシート作成', '워크시트 생성')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    {tr('Tạo mới', 'Create new', '新建', '新規作成', '새로 만들기')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border bg-slate-50 dark:bg-slate-900/50 p-4 overflow-auto max-h-[60vh]">
                  <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed prose prose-slate dark:prose-invert max-w-none">
                    {latexToReadable(curriculumMarkdown)}
                  </pre>
                </div>
              </CardContent>
            </Card>
            )}

            {worksheetMarkdown && (
              <Card className="border shadow-sm overflow-hidden border-emerald-200/60">
                <div className="bg-violet-100 dark:bg-violet-950/50 px-4 py-4 border-b-2 border-violet-300 dark:border-violet-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">
                    {tr('Phiếu bài tập đã sẵn sàng. Nhấn nút bên dưới để tải:', 'Worksheet ready. Click below to download:', '练习已就绪。点击下方下载：', 'ワークシート準備完了。下のボタンでダウンロード：', '워크시트 준비됨. 아래 버튼으로 다운로드:')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="default" onClick={handleDownloadWorksheet} className="bg-white border-2 border-violet-500 text-violet-700 hover:bg-violet-50 dark:bg-violet-900/50 dark:border-violet-400 dark:text-violet-200 dark:hover:bg-violet-800/50">
                      <FileDown className="h-4 w-4 mr-2" /> {tr('Tải .md', 'Download .md', '下载 .md', '.md をダウンロード', '.md 다운로드')}
                    </Button>
                    <Button size="default" onClick={handleExportPdf} className="bg-violet-600 hover:bg-violet-700 text-white border-2 border-violet-600">
                      <FileDown className="h-4 w-4 mr-2" /> {tr('Tải PDF', 'Download PDF', '下载 PDF', 'PDF をダウンロード', 'PDF 다운로드')}
                    </Button>
                    <Button size="default" onClick={handleExportWord} className="bg-violet-600 hover:bg-violet-700 text-white border-2 border-violet-600">
                      <FileDown className="h-4 w-4 mr-2" /> {tr('Tải Word', 'Download Word', '下载 Word', 'Word をダウンロード', 'Word 다운로드')}
                    </Button>
                  </div>
                </div>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    {tr('Phiếu bài tập', 'Worksheet', '练习', 'ワークシート', '워크시트')}
                  </CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopyWorksheet}>
                      <Copy className="h-3.5 w-3.5 mr-1" /> {tr('Sao chép', 'Copy', '复制', 'コピー', '복사')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownloadWorksheet}>
                      <FileDown className="h-3.5 w-3.5 mr-1" /> .md
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportPdf}>
                      <FileDown className="h-3.5 w-3.5 mr-1" /> PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportWord}>
                      <FileDown className="h-3.5 w-3.5 mr-1" /> Word
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleReset}>
                      {tr('Tạo mới', 'Create new', '新建', '新規作成', '새로 만들기')}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {worksheetQrDataUrl && worksheetId && (
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60">
                      <img src={worksheetQrDataUrl} alt="QR" className="w-[120px] h-[120px] rounded border bg-white p-1" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200 flex items-center gap-1">
                          <QrCode className="h-4 w-4" />
                          {tr('Quét mã QR xem lời giải', 'Scan QR to view answers', '扫码查看答案', 'QRで解答を表示', 'QR로 정답 보기')}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {tr('In phiếu kèm QR, học sinh quét bằng điện thoại để xem đáp án chi tiết.', 'Print worksheet with QR, students scan with phone to view detailed answers.', '打印带QR的练习，学生用手机扫码查看详细答案。', 'QR付きで印刷、生徒がスマホでスキャンして解答を表示。', 'QR 포함 인쇄 후 학생이 휴대폰으로 스캔해 정답 확인.')}
                        </p>
                        <a
                          href={`/phieu-bai-tap/${worksheetId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-emerald-600 hover:underline mt-1 inline-block truncate max-w-full"
                        >
                          /phieu-bai-tap/{worksheetId.slice(0, 8)}...
                        </a>
                      </div>
                    </div>
                  )}
                  <div className="rounded-lg border bg-slate-50 dark:bg-slate-900/50 p-4 overflow-auto max-h-[60vh]">
                    <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed prose prose-slate dark:prose-invert max-w-none">
                      {latexToReadable(worksheetMarkdown)}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  )
}
