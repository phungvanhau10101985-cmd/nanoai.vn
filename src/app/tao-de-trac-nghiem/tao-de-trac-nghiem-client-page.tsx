'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Sparkles, Copy, FileDown, RefreshCw, FileQuestion } from 'lucide-react'
import { SUBJECTS, GRADE_LEVELS, TEXTBOOK_SETS, QUESTION_TYPES } from './lib/exam-config'
import { createExam } from './actions'
import { exportWorksheetToPdf, exportWorksheetToWord } from '@/app/tao-giao-trinh/lib/worksheet-export'
import { latexToReadable } from '@/app/tao-giao-trinh/lib/latex-to-readable'

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

export default function TaoDeTracNghiemClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [step, setStep] = useState<Step>('INPUT')
  const [subjectId, setSubjectId] = useState('toan')
  const [gradeLevelId, setGradeLevelId] = useState('lop-12')
  const [textbookSetId, setTextbookSetId] = useState('ket-noi-tri-thuc')
  const [topic, setTopic] = useState('')
  const [numQuestions, setNumQuestions] = useState(15)
  const [questionTypeId, setQuestionTypeId] = useState('trac-nghiem')
  const [modelProvider, setModelProvider] = useState<'gemini' | 'deepseek'>('gemini')
  const [examMarkdown, setExamMarkdown] = useState('')
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

  const handleSubmit = async () => {
    if (!topic.trim()) {
      toast({
        title: tr('Thiếu thông tin', 'Missing information', '缺少信息', '情報不足', '정보 누락'),
        description: tr('Vui lòng nhập chủ đề / nội dung đề thi.', 'Please enter topic/exam content.', '请输入主题/考试内容。', '主題・試験内容を入力してください。', '주제/시험 내용을 입력해 주세요.'),
        variant: 'destructive',
      })
      return
    }
    setStep('GENERATING')
    const formData = new FormData()
    formData.append('subjectId', subjectId)
    formData.append('gradeLevelId', gradeLevelId)
    formData.append('textbookSetId', textbookSetId)
    formData.append('topic', topic.trim())
    formData.append('numQuestions', String(numQuestions))
    formData.append('questionTypeId', questionTypeId)
    formData.append('modelProvider', modelProvider)
    const result = await createExam(formData)
    if (result.error) {
      setStep('INPUT')
      toast({
        title: tr('Tạo đề thi thất bại', 'Create exam failed', '创建考试失败', '試験作成に失敗', '시험 생성 실패'),
        description: result.error,
        variant: 'destructive',
        duration: 5000,
      })
    } else if (result.success && result.examMarkdown) {
      setExamMarkdown(result.examMarkdown)
      setStep('RESULT')
      toast({
        title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'),
        description: tr('Đề thi đã được tạo.', 'Exam has been created.', '考试已创建。', '試験を作成しました。', '시험이 생성되었습니다.'),
        duration: 3000,
      })
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(examMarkdown)
    toast({ title: tr('Đã sao chép', 'Copied', '已复制', 'コピーしました', '복사됨'), duration: 2000 })
  }

  const handleDownloadMd = () => {
    const blob = new Blob([examMarkdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `de-thi-${topic.slice(0, 25).replace(/\s+/g, '-')}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: tr('Đã tải xuống', 'Downloaded', '已下载', 'ダウンロードしました', '다운로드됨'), duration: 2000 })
  }

  const handleExportPdf = () => {
    const name = `de-thi-${topic.slice(0, 25).replace(/\s+/g, '-')}.pdf`
    exportWorksheetToPdf(examMarkdown, name, null).then(() => {
      toast({ title: tr('Đã tải PDF', 'PDF downloaded', '已下载PDF', 'PDFをダウンロード', 'PDF 다운로드됨'), duration: 2000 })
    }).catch(() => {
      toast({ title: tr('Xuất PDF thất bại', 'PDF export failed', 'PDF导出失败', 'PDFエクスポート失敗', 'PDF 내보내기 실패'), variant: 'destructive' })
    })
  }

  const handleExportWord = () => {
    const name = `de-thi-${topic.slice(0, 25).replace(/\s+/g, '-')}.docx`
    exportWorksheetToWord(examMarkdown, name).then(() => {
      toast({ title: tr('Đã tải Word', 'Word downloaded', '已下载Word', 'Wordをダウンロード', 'Word 다운로드됨'), duration: 2000 })
    }).catch(() => {
      toast({ title: tr('Xuất Word thất bại', 'Word export failed', 'Word导出失败', 'Wordエクスポート失敗', 'Word 내보내기 실패'), variant: 'destructive' })
    })
  }

  const handleReset = () => {
    setStep('INPUT')
    setExamMarkdown('')
  }

  return (
    <>
      <Toaster />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">
            {tr('Tạo đề trắc nghiệm theo format 2025', 'Create exam (format 2025)', '创建2025格式试题', '2025形式試験作成', '2025 형식 시험 생성')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {tr(
              'AI tạo đề thi bám sát cấu trúc THPT 2025. Ma trận nhận thức, trắc nghiệm, đúng/sai, trả lời ngắn.',
              'AI creates exams following THPT 2025 structure. Cognitive matrix, multiple choice, true/false, short answer.',
              'AI 生成符合 2025 格式的试题。认知矩阵、选择题、判断题、简答题。',
              'AIが2025形式の試験を作成。認知マトリックス、選択、真偽、短答。',
              'AI가 2025 형식 시험 생성. 인지 매트릭스, 객관식, O/X, 단답형.'
            )}
          </p>
        </div>

        {step === 'INPUT' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-violet-200/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileQuestion className="h-4 w-4 text-violet-600" />
                {tr('Thông tin đề thi', 'Exam info', '考试信息', '試験情報', '시험 정보')}
              </CardTitle>
              <CardDescription>
                {tr('Chọn môn, cấp độ, chủ đề. AI tạo đề theo format Bộ Giáo dục.', 'Select subject, grade, topic. AI generates exam per Ministry format.', '选择科目、年级、主题。AI 按教育部格式生成。', '科目・学年・主題を選択。AIが省形式で生成。', '과목·학년·주제 선택. AI가 교육부 형식으로 생성.')}
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
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{tr('Bộ sách giáo khoa', 'Textbook set', '教材', '教科書', '교과서')}</label>
                <select
                  value={textbookSetId}
                  onChange={(e) => setTextbookSetId(e.target.value)}
                  className="w-full sm:max-w-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  {TEXTBOOK_SETS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {uiLocale === 'en' ? t.labelEn : t.labelVi}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  {tr('Chủ đề / Nội dung đề thi', 'Topic / Exam content', '主题/考试内容', '主題・試験内容', '주제/시험 내용')} <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder={tr('VD: Hàm số, Cơ học, Động lực học...', 'e.g. Functions, Mechanics, Dynamics...', '例如：函数、力学、动力学...', '例: 関数、力学、力学...', '예: 함수, 역학, 동역학...')}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="bg-white/80"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Số câu (5–50)', 'Questions (5–50)', '题数 (5–50)', '問題数 (5–50)', '문항 수 (5–50)')}</label>
                  <Input
                    type="number"
                    min={5}
                    max={50}
                    value={numQuestions}
                    onChange={(e) => setNumQuestions(Math.min(50, Math.max(5, parseInt(e.target.value, 10) || 5)))}
                    className="w-24 bg-white/80"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Loại câu hỏi', 'Question type', '题型', '問題タイプ', '문항 유형')}</label>
                  <select
                    value={questionTypeId}
                    onChange={(e) => setQuestionTypeId(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm bg-white/80"
                  >
                    {QUESTION_TYPES.map((q) => (
                      <option key={q.id} value={q.id}>
                        {uiLocale === 'en' ? q.labelEn : q.labelVi}
                      </option>
                    ))}
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
              <Button onClick={() => void handleSubmit()} disabled={false} className="w-full bg-violet-600 hover:bg-violet-700 text-white">
                <Sparkles className="h-4 w-4 mr-2" />
                {tr('Tạo đề thi', 'Create exam', '创建考试', '試験を作成', '시험 생성')}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'GENERATING' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-violet-200/60">
            <CardContent className="flex flex-col items-center py-12">
              <RefreshCw className="h-12 w-12 text-violet-500 animate-spin" />
              <p className="text-sm text-muted-foreground mt-4">{tr('AI đang tạo đề thi...', 'AI is creating exam...', 'AI 正在创建考试...', 'AIが試験を作成中...', 'AI가 시험 생성 중...')}</p>
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && examMarkdown && (
          <Card className="border shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">{tr('Đề thi đã tạo', 'Generated exam', '已创建考试', '作成した試験', '생성된 시험')}</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="h-3.5 w-3.5 mr-1" /> {tr('Sao chép', 'Copy', '复制', 'コピー', '복사')}
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadMd}>
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
            <CardContent>
              <div className="rounded-lg border bg-slate-50 dark:bg-slate-900/50 p-4 overflow-auto max-h-[60vh]">
                <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed prose prose-slate dark:prose-invert max-w-none">
                  {latexToReadable(examMarkdown)}
                </pre>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
