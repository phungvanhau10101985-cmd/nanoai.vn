'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Sparkles, Copy, FileDown, RefreshCw, FileSpreadsheet, QrCode, FolderOpen, BookOpen, FileText, Presentation, Trash2, Upload, ImageIcon, FileQuestion } from 'lucide-react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { exportWorksheetToPdf, exportWorksheetToWord } from './lib/worksheet-export'
import { latexToReadable } from './lib/latex-to-readable'
import { curriculumToSlidesMarkdown, parseCurriculumToSlides, parseContentToBlocks } from './lib/curriculum-to-slides'
import { SlideVersionDialog, type SlideVersionChoice } from './components/slide-version-dialog'
import type { AISlideData } from './lib/curriculum-to-slides'
import { SUBJECTS, GRADE_LEVELS, GRADE_LEVEL_GROUPS, TEXTBOOK_SETS } from './lib/curriculum-subjects'
import { createCurriculum, createWorksheet, saveCurriculum, saveTextbookLessonFromImage, listCurricula, getCurriculumById, getWorksheetById, getWorksheetsByCurriculumId, deleteCurriculum, saveSlidesToCurriculum, getSlidesByCurriculumId, getOriginalSlides, getUserCustomizedSlides, saveOriginalSlidesIfNotExists, checkCurriculumExists, recordCurriculumOpen, clearCurriculumDerivedData } from './actions'
import { extractEditRegions } from './lib/curriculum-region-extract'
import { highlightMatchInCurriculum } from './components/curriculum-edit-sheet'

type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

function normalizeGradeLevelId(id: string): string {
  const map: Record<string, string> = { 'tieu-hoc': 'lop-1', thcs: 'lop-6', thpt: 'lop-12' }
  return map[id] ?? id
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

function splitWorksheetSections(markdown: string): { quiz: string; essay: string } {
  const text = (markdown ?? '').trim()
  if (!text) return { quiz: '', essay: '' }

  const lines = text.split('\n')
  let mode: 'none' | 'quiz' | 'essay' = 'none'
  const quizLines: string[] = []
  const essayLines: string[] = []

  for (const line of lines) {
    const normalized = line.toLowerCase()
    const isHeading = /^#{2,4}\s+/.test(line)
    if (isHeading) {
      if (
        /(trắc nghiệm|quiz|multiple choice|nhận biết)/i.test(normalized) ||
        /^#{2,4}\s*1[\).:\-]/.test(normalized)
      ) {
        mode = 'quiz'
      } else if (
        /(tự luận|thông hiểu|vận dụng|đáp án|lời giải|essay|short answer|solution|answer)/i.test(normalized) ||
        /^#{2,4}\s*[2-9][\).:\-]/.test(normalized)
      ) {
        mode = 'essay'
      }
    }

    if (mode === 'quiz') quizLines.push(line)
    else if (mode === 'essay') essayLines.push(line)
    else {
      // Header/introduction before numbered sections: keep in essay to avoid losing content.
      essayLines.push(line)
    }
  }

  const quiz = quizLines.join('\n').trim()
  const essay = essayLines.join('\n').trim()
  if (!quiz && essay) return { quiz: '', essay }
  if (!essay && quiz) return { quiz, essay: '' }
  return { quiz, essay }
}

type Step = 'INPUT' | 'GENERATING' | 'RESULT'
export default function TaoGiaoTrinhClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [step, setStep] = useState<Step>('INPUT')
  const [subjectId, setSubjectId] = useState('toan')
  const [gradeLevelId, setGradeLevelId] = useState('lop-12')
  const [textbookSetId, setTextbookSetId] = useState('ket-noi-tri-thuc')
  const [textbookVolume, setTextbookVolume] = useState<string>('')
  const [bookIsbn, setBookIsbn] = useState('')
  const [lessonNumber, setLessonNumber] = useState<string>('1')
  const [lessonTypeId, setLessonTypeId] = useState('hinh-thanh-kien-thuc')
  const [topic, setTopic] = useState('')
  const [numLessons, setNumLessons] = useState(3)
  const [lessonDurationMinutes, setLessonDurationMinutes] = useState(45)
  const [goals, setGoals] = useState('')
  const [curriculumMarkdown, setCurriculumMarkdown] = useState('')
  const [curriculumId, setCurriculumId] = useState<string | null>(null)
  const [worksheetMarkdown, setWorksheetMarkdown] = useState('')
  const [worksheetId, setWorksheetId] = useState<string | null>(null)
  const [worksheetQrDataUrl, setWorksheetQrDataUrl] = useState<string | null>(null)
  const [worksheetLoading, setWorksheetLoading] = useState(false)
  const [showBrowse, setShowBrowse] = useState(true)
  const [curriculaList, setCurriculaList] = useState<Array<{ id: string; topic: string; subject_id: string; grade_level_id: string; textbook_set_id?: string; textbook_volume?: string | null; lesson_number?: number | null; lesson_type_id?: string; num_lessons?: number; lesson_duration_minutes?: number; created_at: string }>>([])
  const [curriculumWorksheets, setCurriculumWorksheets] = useState<Array<{ id: string; topic: string; subject_id: string; grade_level_id: string; content_markdown: string; created_at: string }>>([])
  const [browseLoading, setBrowseLoading] = useState(false)
  const [browseSubjectFilter, setBrowseSubjectFilter] = useState<string>('')
  const [browseGradeFilter, setBrowseGradeFilter] = useState<string>('')
  const [aiSlides, setAiSlides] = useState<AISlideData[] | null>(null)
  const [curriculumSlides, setCurriculumSlides] = useState<AISlideData[] | null>(null)
  const [slideAnalysisLoading, setSlideAnalysisLoading] = useState(false)
  const [showSlideVersionDialog, setShowSlideVersionDialog] = useState(false)
  const [slideVersionChoice, setSlideVersionChoice] = useState<SlideVersionChoice | null>(null)
  const [sharedSlides, setSharedSlides] = useState<AISlideData[] | null>(null)
  const [originalSlides, setOriginalSlides] = useState<AISlideData[] | null>(null)
  const [personalSlides, setPersonalSlides] = useState<AISlideData[] | null>(null)
  const [curriculumExists, setCurriculumExists] = useState<boolean | null>(null)
  const [existingCurriculumId, setExistingCurriculumId] = useState<string | null>(null)
  const [existingCurriculumTopic, setExistingCurriculumTopic] = useState<string | null>(null)
  const [similarTopicCurricula, setSimilarTopicCurricula] = useState<Array<{ id: string; topic: string; score: number }>>([])
  const [checkLoading, setCheckLoading] = useState(false)
  const [overwriteFromExistingLoading, setOverwriteFromExistingLoading] = useState(false)
  const [lastOverwriteAt, setLastOverwriteAt] = useState<string | null>(null)
  const [lessonImages, setLessonImages] = useState<File[]>([])
  const lessonImageInputRef = useRef<HTMLInputElement>(null)
  const [createMode, setCreateMode] = useState<'textbook' | 'topic'>('textbook')
  const { toast } = useToast()
  const curriculumResultRef = useRef<HTMLDivElement>(null)

  const formatCreatedAt = (iso: string) => {
    try {
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return ''
      const localeMap: Record<UiLocale, string> = { vi: 'vi-VN', en: 'en-GB', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR' }
      return d.toLocaleDateString(localeMap[uiLocale] ?? 'vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      })
    } catch {
      return ''
    }
  }

  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  const displayTopic = topic.trim() || (lessonNumber ? `Bài ${lessonNumber}` : tr('Chủ đề', 'Topic', '主题', '主題', '주제'))

  useEffect(() => {
    const syncLocale = () => setUiLocale(getWebLocaleFromCookie())
    syncLocale()
    const timer = window.setInterval(syncLocale, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (step === 'GENERATING' || step === 'RESULT') {
      curriculumResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [step])

  useEffect(() => {
    if (!showBrowse) return
    setBrowseLoading(true)
    listCurricula({
      subjectId: browseSubjectFilter || undefined,
      gradeLevelId: browseGradeFilter || undefined,
      limit: 200,
    })
      .then((curRes) => {
        if (curRes && 'items' in curRes) setCurriculaList(curRes.items ?? [])
        else setCurriculaList([])
      })
      .catch(() => setCurriculaList([]))
      .finally(() => setBrowseLoading(false))
  }, [showBrowse, browseSubjectFilter, browseGradeFilter])

  useEffect(() => {
    if (createMode === 'topic' && (!topic.trim() || topic.trim().length < 2)) {
      setCurriculumExists(null)
      setExistingCurriculumId(null)
      setExistingCurriculumTopic(null)
      setSimilarTopicCurricula([])
      setCheckLoading(false)
      return
    }
    const num = parseInt(lessonNumber, 10)
    if (createMode !== 'topic' && (!num || num < 1 || num > 999)) {
      setCurriculumExists(null)
      setExistingCurriculumId(null)
      setExistingCurriculumTopic(null)
      setSimilarTopicCurricula([])
      return
    }
    if (textbookSetId === 'khac' && !bookIsbn.trim()) {
      setCurriculumExists(false)
      setExistingCurriculumId(null)
      setExistingCurriculumTopic(null)
      setCheckLoading(false)
      return
    }
    let cancelled = false
    setCheckLoading(true)
    checkCurriculumExists({
      createMode,
      topic: createMode === 'topic' ? topic.trim() : undefined,
      subjectId,
      gradeLevelId,
      textbookSetId,
      textbookVolume: textbookVolume.trim() || undefined,
      bookIsbn: textbookSetId === 'khac' ? bookIsbn.trim() : undefined,
      lessonNumber: createMode === 'topic' ? undefined : num,
      numLessons,
      lessonDurationMinutes,
      lessonTypeId,
    })
      .then((res) => {
        if (cancelled) return
        if (res && 'exists' in res && res.exists) {
          setCurriculumExists(true)
          setExistingCurriculumId(res.curriculumId ?? null)
          setExistingCurriculumTopic(res.topic ?? null)
        } else {
          setCurriculumExists(false)
          setExistingCurriculumId(null)
          setExistingCurriculumTopic(null)
        }
        if (res && 'similarItems' in res && Array.isArray(res.similarItems)) {
          setSimilarTopicCurricula(res.similarItems as Array<{ id: string; topic: string; score: number }>)
        } else {
          setSimilarTopicCurricula([])
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCurriculumExists(null)
          setExistingCurriculumId(null)
          setExistingCurriculumTopic(null)
          setSimilarTopicCurricula([])
        }
      })
      .finally(() => {
        if (!cancelled) setCheckLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [createMode, topic, subjectId, gradeLevelId, textbookSetId, textbookVolume, bookIsbn, lessonNumber, numLessons, lessonDurationMinutes, lessonTypeId])

  const handleSubmitFromImage = async (opts?: { forceOverwrite?: boolean }) => {
    const forceOverwrite = !!opts?.forceOverwrite
    const num = parseInt(lessonNumber, 10)
    if (!num || num < 1 || num > 999 || lessonImages.length === 0) return
    setStep('GENERATING')
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    try {
      const fd = new FormData()
      for (const img of lessonImages) fd.append('images', img)
      fd.append('subjectId', subjectId)
      fd.append('gradeLevelId', gradeLevelId)
      fd.append('textbookSetId', textbookSetId)
      fd.append('lessonNumber', lessonNumber)
      fd.append('numLessons', String(numLessons))
      fd.append('lessonDurationMinutes', String(lessonDurationMinutes))
      const res = await fetch('/api/curriculum-from-image', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStep('INPUT')
        toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: data?.error || res.statusText, variant: 'destructive' })
        return
      }
      const { curriculumMarkdown: md, topic: t, lessonNumber: extractedNum, lessonTitle: extractedTitle } = data
      if (!md) {
        setStep('INPUT')
        toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('AI không trả về nội dung.', 'AI did not return content.', 'AI未返回内容。', 'AIがコンテンツを返しませんでした。', 'AI가 내용을 반환하지 않았습니다.'), variant: 'destructive' })
        return
      }
      const extractedNumParsed =
        typeof extractedNum === 'number'
          ? extractedNum
          : typeof extractedNum === 'string'
            ? parseInt(extractedNum, 10)
            : NaN
      const hasExtractedLessonNum = Number.isFinite(extractedNumParsed) && extractedNumParsed >= 1 && extractedNumParsed <= 999
      const extractedLessonNum = hasExtractedLessonNum ? String(extractedNumParsed) : null
      if (extractedLessonNum && extractedLessonNum !== lessonNumber.trim()) {
        setStep('INPUT')
        toast({
          title: tr('Không khớp số bài', 'Lesson number mismatch', '课号不匹配', '課番号が不一致です', '차시 번호 불일치'),
          description: tr(
            `Ảnh là Bài ${extractedLessonNum} nhưng bạn nhập Bài ${lessonNumber}. Vui lòng sửa lại số bài đã nhập hoặc upload ảnh đúng với số bài đã nhập.`,
            `Image shows lesson ${extractedLessonNum} but you entered lesson ${lessonNumber}. Please correct the entered lesson number or upload the correct image for your entered lesson number.`,
            `图片显示第 ${extractedLessonNum} 课，但您输入的是第 ${lessonNumber} 课。请修改输入课号或上传与输入课号一致的图片。`,
            `画像は${extractedLessonNum}課ですが、入力は${lessonNumber}課です。入力した課番号を修正するか、入力番号に合う画像をアップロードしてください。`,
            `이미지는 ${extractedLessonNum}차시인데 입력은 ${lessonNumber}차시입니다. 입력한 차시 번호를 수정하거나 입력 번호와 일치하는 이미지를 업로드해 주세요.`
          ),
          variant: 'destructive',
          duration: 6000,
        })
        return
      }
      const finalLessonNum = extractedLessonNum ?? lessonNumber
      const finalTopic = t || extractedTitle || `Bài ${finalLessonNum}`

      let overwriteCurriculumId: string | null = null
      const checkByExtracted = await checkCurriculumExists({
        createMode: 'textbook',
        subjectId,
        gradeLevelId,
        textbookSetId,
        textbookVolume: textbookVolume.trim() || undefined,
        bookIsbn: textbookSetId === 'khac' ? bookIsbn.trim() : undefined,
        lessonNumber: parseInt(finalLessonNum, 10),
        numLessons,
        lessonDurationMinutes,
        lessonTypeId,
      })
      const existingIdByExtracted =
        checkByExtracted && 'exists' in checkByExtracted && checkByExtracted.exists
          ? (checkByExtracted.curriculumId ?? null)
          : null
      const existingTopicByExtracted =
        checkByExtracted && 'exists' in checkByExtracted && checkByExtracted.exists
          ? (checkByExtracted.topic ?? null)
          : null
      const existingMarkdownByExtracted =
        checkByExtracted && 'exists' in checkByExtracted && checkByExtracted.exists
          ? (checkByExtracted.curriculumMarkdown ?? '')
          : ''

      if (forceOverwrite && existingIdByExtracted) {
        const normalizeForCompare = (s: string) =>
          String(s || '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim()
        if (normalizeForCompare(existingMarkdownByExtracted) === normalizeForCompare(md)) {
          const sameOk = confirm(
            tr(
              'Nội dung mới gần như trùng bản hiện tại. Bạn vẫn muốn ghi đè không?',
              'New content is almost identical to current version. Do you still want to overwrite?',
              '新内容与当前版本几乎一致。仍要覆盖吗？',
              '新しい内容は現行版とほぼ同一です。上書きしますか？',
              '새 내용이 현재 버전과 거의 동일합니다. 그래도 덮어쓸까요?'
            )
          )
          if (!sameOk) {
            setStep('INPUT')
            return
          }
        }
        const ok = confirm(
          tr(
            'Tạo lại sẽ xóa worksheet/slide/lịch sử chỉnh sửa cũ của giáo trình này trước khi lưu bản mới. Tiếp tục?',
            'Recreate will delete old worksheets/slides/edit history of this curriculum before saving new content. Continue?',
            '重新创建会先删除该课程旧的练习/幻灯片/编辑历史，再保存新内容。继续吗？',
            '再作成すると、このカリキュラムの旧ワークシート/スライド/編集履歴を削除してから新規保存します。続行しますか？',
            '다시 만들기를 진행하면 기존 워크시트/슬라이드/편집 기록을 삭제한 뒤 새 내용으로 저장합니다. 계속할까요?'
          )
        )
        if (!ok) {
          setStep('INPUT')
          return
        }
        const clearRes = await clearCurriculumDerivedData(existingIdByExtracted)
        if (clearRes?.error) {
          setStep('INPUT')
          toast({ title: tr('Xóa dữ liệu cũ thất bại', 'Failed to clear old data', '清除旧数据失败', '旧データ削除に失敗', '기존 데이터 삭제 실패'), description: clearRes.error, variant: 'destructive' })
          return
        }
        overwriteCurriculumId = existingIdByExtracted
      }

      setCurriculumMarkdown(md)
      setTopic(finalTopic)
      const saveFd = new FormData()
      saveFd.append('curriculumMarkdown', md)
      saveFd.append('topic', finalTopic)
      if (overwriteCurriculumId) saveFd.append('curriculumId', overwriteCurriculumId)
      saveFd.append('subjectId', subjectId)
      saveFd.append('gradeLevelId', gradeLevelId)
      saveFd.append('textbookSetId', textbookSetId)
      saveFd.append('textbookVolume', textbookVolume.trim())
      saveFd.append('lessonNumber', finalLessonNum)
      saveFd.append('lessonTypeId', lessonTypeId)
      saveFd.append('numLessons', String(numLessons))
      saveFd.append('lessonDurationMinutes', String(lessonDurationMinutes))
      saveFd.append('goals', goals)
      saveFd.append('bookIsbn', textbookSetId === 'khac' ? bookIsbn.trim() : '')
      const saveRes = await saveCurriculum(saveFd)
      if (saveRes?.success && saveRes.curriculumId) {
        setCurriculumId(saveRes.curriculumId)
        setStep('RESULT')
        if (overwriteCurriculumId) setLastOverwriteAt(new Date().toISOString())
        toast({
          title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'),
          description: overwriteCurriculumId
            ? tr('Đã tạo lại và ghi đè giáo trình cũ theo dữ liệu từ ảnh.', 'Recreated and overwritten existing curriculum using image data.', '已根据图片数据重建并覆盖旧课程。', '画像データに基づき既存カリキュラムを再作成・上書きしました。', '이미지 데이터를 기준으로 기존 교육과정을 다시 만들고 덮어썼습니다.')
            : existingIdByExtracted
              ? tr(`Đã tạo mới theo Bài ${finalLessonNum}. Nếu muốn dùng bản có sẵn "${existingTopicByExtracted ?? ''}" hãy bấm Mở giáo trình có sẵn.`, `Created a new curriculum for lesson ${finalLessonNum}. To use existing "${existingTopicByExtracted ?? ''}", open existing curriculum.`, `已按第 ${finalLessonNum} 课新建。若要使用已有课程“${existingTopicByExtracted ?? ''}”，请点击“打开已有课程”。`, `${finalLessonNum}課として新規作成しました。既存「${existingTopicByExtracted ?? ''}」を使う場合は既存を開いてください。`, `${finalLessonNum}차시 기준으로 새로 생성했습니다. 기존 "${existingTopicByExtracted ?? ''}"를 사용하려면 기존 교육과정을 여세요.`)
              : tr('Giáo trình và giáo án đã tạo từ ảnh.', 'Curriculum and slides created from image.', '已从图片创建课程和教案。', '画像からカリキュラムとスライドを作成しました。', '이미지에서 교육과정과 슬라이드 생성됨.'),
          duration: 3800,
        })
        await saveTextbookLessonFromImage({ subjectId, gradeLevelId, textbookSetId, lessonNumber: parseInt(finalLessonNum, 10), lessonTitle: finalTopic })
        const slidesFromApi = Array.isArray(data?.slides) && data.slides.length > 0 ? (data.slides as AISlideData[]) : null
        if (slidesFromApi) {
          setCurriculumSlides(slidesFromApi)
          await saveSlidesToCurriculum({ curriculumId: saveRes.curriculumId!, topic: finalTopic, subjectId, gradeLevelId, slides: slidesFromApi })
          await saveOriginalSlidesIfNotExists({ curriculumId: saveRes.curriculumId!, slides: slidesFromApi })
        } else {
          void (async () => {
            try {
              const slideRes = await fetch('/api/curriculum-analyze-slides', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ curriculumMarkdown: md, topic: finalTopic }),
              })
              const slideData = await slideRes.json().catch(() => ({}))
              if (slideRes.ok && Array.isArray(slideData?.slides) && slideData.slides.length > 0) {
                const slides = slideData.slides as AISlideData[]
                setCurriculumSlides(slides)
                await saveSlidesToCurriculum({ curriculumId: saveRes.curriculumId!, topic: finalTopic, subjectId, gradeLevelId, slides })
                await saveOriginalSlidesIfNotExists({ curriculumId: saveRes.curriculumId!, slides })
              }
            } catch (e) {
              console.warn('[auto-slides]', e)
            }
          })()
        }
      } else {
        setCurriculumId(null)
        setStep('RESULT')
        toast({ title: tr('Giáo trình đã tạo', 'Curriculum created', '课程已创建', 'カリキュラム作成', '교육과정 생성'), description: saveRes?.error || tr('Chưa lưu vào kho.', 'Not saved to library.', '未保存到库。', 'ライブラリに未保存。', '라이브러리에 미저장.'), variant: 'default' })
      }
    } catch (e) {
      setStep('INPUT')
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: e instanceof Error ? e.message : String(e), variant: 'destructive' })
    }
  }

  const handleSubmit = async () => {
    if (createMode === 'topic') {
      if (!topic.trim() || topic.trim().length < 2) {
        toast({
          title: tr('Thiếu thông tin', 'Missing information', '缺少信息', '情報不足', '정보 누락'),
          description: tr('Vui lòng nhập chủ đề (ít nhất 2 ký tự).', 'Please enter topic (at least 2 characters).', '请输入主题（至少2个字符）。', '主題を入力してください（2文字以上）。', '주제를 입력해 주세요 (최소 2자).'),
          variant: 'destructive',
        })
        return
      }
      setStep('GENERATING')
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const formData = new FormData()
      formData.append('createMode', 'topic')
      formData.append('subjectId', subjectId)
      formData.append('gradeLevelId', gradeLevelId)
      formData.append('textbookSetId', 'khac')
      formData.append('textbookVolume', '')
      formData.append('topic', topic.trim())
      formData.append('lessonTypeId', lessonTypeId)
      formData.append('numLessons', String(numLessons))
      formData.append('lessonDurationMinutes', String(lessonDurationMinutes))
      formData.append('goals', goals.trim())
      formData.append('bookIsbn', '')
      const result = await createCurriculum(formData)
      if (result.error) {
        setStep('INPUT')
        toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: result.error, variant: 'destructive', duration: 5000 })
        return
      }
      if (result.success && result.curriculumMarkdown) {
        setCurriculumMarkdown(result.curriculumMarkdown)
        setCurriculumId(result.curriculumId ?? null)
        setStep('RESULT')
        toast({ title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'), description: tr('Giáo trình đã được tạo.', 'Curriculum created.', '课程已创建并保存。', 'カリキュラムを作成しました。', '교육과정 생성됨.'), duration: 3000 })
        if (result.curriculumId) {
          void (async () => {
            try {
              const res = await fetch('/api/curriculum-analyze-slides', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ curriculumMarkdown: result.curriculumMarkdown, topic: topic.trim() }),
              })
              const data = await res.json().catch(() => ({}))
              if (res.ok && Array.isArray(data?.slides) && data.slides.length > 0) {
                const slides = data.slides as AISlideData[]
                setCurriculumSlides(slides)
                await saveSlidesToCurriculum({ curriculumId: result.curriculumId!, topic: topic.trim(), subjectId, gradeLevelId, slides })
                await saveOriginalSlidesIfNotExists({ curriculumId: result.curriculumId!, slides })
              }
            } catch (e) {
              console.warn('[auto-slides] Lỗi:', e)
            }
          })()
        }
      }
      return
    }

    const num = parseInt(lessonNumber, 10)
    if (!num || num < 1 || num > 999) {
      toast({
        title: tr('Thiếu thông tin', 'Missing information', '缺少信息', '情報不足', '정보 누락'),
        description: tr('Vui lòng nhập bài số (1–999).', 'Please enter lesson number (1–999).', '请输入课号（1–999）。', '課番号（1–999）を入力してください。', '차시 번호(1–999)를 입력해 주세요.'),
        variant: 'destructive',
      })
      return
    }
    if (createMode === 'textbook') {
      if (textbookSetId === 'khac' && !bookIsbn.trim()) {
        toast({
          title: tr('Thiếu thông tin', 'Missing information', '缺少信息', '情報不足', '정보 누락'),
          description: tr('Vui lòng nhập ISBN cho sách Khác / Sách khác NXB.', 'Please enter ISBN for Other publisher textbook.', '请选择“其他出版社”时请输入ISBN。', '「その他出版社」の場合はISBNを入力してください。', '기타 출판사 선택 시 ISBN을 입력해 주세요.'),
          variant: 'destructive',
        })
        return
      }
      if (lessonImages.length === 0) {
        toast({
          title: tr('Cần gửi ảnh bài học', 'Upload lesson image required', '需要上传课程图片', '授業画像のアップロードが必要', '수업 이미지 업로드 필요'),
          description: tr('Vui lòng gửi ảnh trang sách để tạo giáo trình.', 'Please upload a textbook page image to create curriculum.', '请上传教材页面图片以创建课程。', '教科書のページ画像をアップロードしてください。', '교과서 페이지 이미지를 업로드해 주세요.'),
          variant: 'destructive',
        })
        return
      }
      await handleSubmitFromImage()
      return
    }
  }

  const handleOverwriteFromExisting = async () => {
    if (!existingCurriculumId) return
    if (lessonImages.length === 0) {
      toast({
        title: tr('Cần gửi ảnh bài học', 'Upload lesson image required', '需要上传课程图片', '授業画像のアップロードが必要', '수업 이미지 업로드 필요'),
        description: tr('Vui lòng gửi ảnh trang sách rồi bấm Tạo lại giáo trình.', 'Please upload textbook page image(s) before recreating curriculum.', '请先上传教材页面图片，再重建课程。', '教科書ページ画像をアップロードしてから再作成してください。', '교과서 페이지 이미지를 업로드한 뒤 다시 만들기를 진행해 주세요.'),
        variant: 'destructive',
      })
      return
    }
    setOverwriteFromExistingLoading(true)
    try {
      await handleSubmitFromImage({ forceOverwrite: true })
    } finally {
      setOverwriteFromExistingLoading(false)
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
    a.download = `giao-trinh-${displayTopic.slice(0, 30).replace(/\s+/g, '-')}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: tr('Đã tải xuống', 'Downloaded', '已下载', 'ダウンロードしました', '다운로드됨'), duration: 2000 })
  }

  const openGiaoVienWindow = useCallback(
    (slidesToUse: AISlideData[] | null, mode: SlideVersionChoice | null = null) => {
      const slides =
        slidesToUse && slidesToUse.length > 0
          ? slidesToUse.map((s) => ({
              title: s.title,
              blocks: s.blocks ?? [],
              teacherNotes: '',
              imageUrl: s.imageUrl,
              visualEmbed: s.visualEmbed,
              visualLayout: s.visualLayout,
              visualCells: s.visualCells,
            }))
          : parseCurriculumToSlides(curriculumMarkdown).map((s) => ({
              title: s.title,
              blocks: parseContentToBlocks(s.content ?? ''),
              teacherNotes: '',
            }))
      const sw = typeof screen !== 'undefined' ? screen.width : 1920
      const sh = typeof screen !== 'undefined' ? screen.height : 1080
      const w = window.open(
        '/tao-giao-trinh/giao-vien?t=' + Date.now(),
        'giao-vien-' + Date.now(),
        `width=${sw},height=${sh},scrollbars=yes,left=0,top=0`
      )
      if (w) {
        const send = () => {
          try {
            if (!w.closed) {
              w.postMessage(
                {
                  type: 'curriculum-data',
                  content: curriculumMarkdown,
                  topic: displayTopic,
                  currentIndex: 0,
                  curriculumId: curriculumId ?? null,
                  slideMode: mode === 'personal' ? 'personal' : mode === 'shared' ? 'shared' : mode === 'original' ? 'original' : null,
                  personalViewSubMode: 'current',
                  hasOriginalSlides: !!(originalSlides?.length || sharedSlides?.length),
                  slides,
                  teacherTimerSeconds: 0,
                  teacherTimerRunning: false,
                },
                window.location.origin
              )
            }
          } catch {
            /* ignore */
          }
        }
        setTimeout(send, 200)
        setTimeout(send, 700)
      }
    },
    [curriculumMarkdown, displayTopic, curriculumId, originalSlides, sharedSlides]
  )

  const refreshPersonalSlides = useCallback(async () => {
    if (!curriculumId) return
    const res = await getUserCustomizedSlides(curriculumId)
    if (res?.success && res.slides?.length) setPersonalSlides(res.slides)
    else setPersonalSlides(null)
  }, [curriculumId])

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'refresh-personal-after-reset') {
        void refreshPersonalSlides()
        return
      }
      if (e.data?.type !== 'request-curriculum') return
      const target = e.source as Window | null
      if (!target) return
      const slidesToUse = aiSlides ?? curriculumSlides ?? null
      const slides =
        slidesToUse && slidesToUse.length > 0
          ? slidesToUse.map((s) => ({
              title: s.title,
              blocks: s.blocks ?? [],
              teacherNotes: '',
              imageUrl: s.imageUrl,
              visualEmbed: s.visualEmbed,
              visualLayout: s.visualLayout,
              visualCells: s.visualCells,
            }))
          : parseCurriculumToSlides(curriculumMarkdown).map((s) => ({
              title: s.title,
              blocks: parseContentToBlocks(s.content ?? ''),
              teacherNotes: '',
            }))
      try {
        target.postMessage(
          {
            type: 'curriculum-data',
            content: curriculumMarkdown,
            topic: displayTopic,
            currentIndex: 0,
            curriculumId: curriculumId ?? null,
            slideMode: slideVersionChoice ?? null,
            personalViewSubMode: 'current',
            hasOriginalSlides: !!(originalSlides?.length || sharedSlides?.length),
            slides,
            teacherTimerSeconds: 0,
            teacherTimerRunning: false,
          },
          window.location.origin
        )
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [curriculumMarkdown, displayTopic, curriculumId, aiSlides, curriculumSlides, slideVersionChoice, originalSlides, sharedSlides, refreshPersonalSlides])

  const handleOpenSlides = async () => {
    if (!curriculumMarkdown.trim()) return
    if (curriculumId) {
      const [sharedRes, originalRes, personalRes] = await Promise.all([
        getSlidesByCurriculumId(curriculumId),
        getOriginalSlides(curriculumId),
        getUserCustomizedSlides(curriculumId),
      ])
      const shared = sharedRes?.success && sharedRes.slides?.length ? sharedRes.slides : null
      const original = originalRes?.success && originalRes.slides?.length ? originalRes.slides : null
      const personal = personalRes?.success && personalRes.slides?.length ? personalRes.slides : null
      setSharedSlides(shared)
      setOriginalSlides(original)
      setPersonalSlides(personal)
      if (shared || original) {
        setShowSlideVersionDialog(true)
        return
      }
    }
    if (curriculumSlides && curriculumSlides.length > 0 && !curriculumId) {
      setAiSlides(curriculumSlides)
      setSlideVersionChoice(null)
      openGiaoVienWindow(curriculumSlides, null)
      return
    }
    setSlideAnalysisLoading(true)
    try {
      const res = await fetch('/api/curriculum-analyze-slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          curriculumMarkdown,
          topic: displayTopic,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        console.error('[curriculum-analyze-slides] API lỗi:', res.status, data)
      }
      if (res.ok && Array.isArray(data?.slides) && data.slides.length > 0) {
        const slides = data.slides as AISlideData[]
        setCurriculumSlides(slides)
        if (curriculumId) {
          const saveRes = await saveSlidesToCurriculum({
            curriculumId,
            topic: displayTopic,
            subjectId,
            gradeLevelId,
            slides,
          })
          if (saveRes?.error) {
            toast({ title: tr('Lưu slide thất bại', 'Save slides failed', '保存幻灯片失败', 'スライド保存失敗', '슬라이드 저장 실패'), description: saveRes.error, variant: 'destructive' })
          }
          await saveOriginalSlidesIfNotExists({ curriculumId, slides })
          const [sharedRes, originalRes, personalRes] = await Promise.all([
            getSlidesByCurriculumId(curriculumId),
            getOriginalSlides(curriculumId),
            getUserCustomizedSlides(curriculumId),
          ])
          setSharedSlides(sharedRes?.success && sharedRes.slides?.length ? sharedRes.slides : null)
          setOriginalSlides(originalRes?.success && originalRes.slides?.length ? originalRes.slides : null)
          setPersonalSlides(personalRes?.success && personalRes.slides?.length ? personalRes.slides : null)
          setShowSlideVersionDialog(true)
        } else {
          setAiSlides(slides)
          setSlideVersionChoice(null)
          openGiaoVienWindow(slides, null)
        }
      } else {
        setAiSlides(null)
        setSlideVersionChoice(null)
        openGiaoVienWindow(null, null)
        if (!res.ok) {
          toast({
            title: tr('Tạo nội dung giảng thất bại', 'Teaching content generation failed', '生成教学内容失败', '授業内容生成失敗', '수업 내용 생성 실패'),
            description: data?.error || tr('Dùng slide parse từ Markdown.', 'Using Markdown parsing.', '使用Markdown解析。', 'Markdown解析を使用。', 'Markdown 파싱 사용.'),
            variant: 'destructive',
          })
        }
      }
    } catch (err) {
      console.error('[curriculum-analyze-slides] Fetch lỗi:', err)
      setAiSlides(null)
      setSlideVersionChoice(null)
      openGiaoVienWindow(null, null)
      toast({
        title: tr('Lỗi kết nối', 'Connection error', '连接错误', '接続エラー', '연결 오류'),
        description: err instanceof Error ? err.message : tr('Dùng nội dung parse từ Markdown.', 'Using Markdown parsing.', '使用Markdown解析。', 'Markdown解析を使用。', 'Markdown 파싱 사용.'),
        variant: 'destructive',
      })
    } finally {
      setSlideAnalysisLoading(false)
    }
  }

  const handleSlideVersionChoose = (choice: SlideVersionChoice) => {
    setSlideVersionChoice(choice)
    const slides =
      choice === 'original'
        ? originalSlides ?? sharedSlides ?? []
        : choice === 'shared'
          ? sharedSlides ?? originalSlides ?? []
          : personalSlides ?? []
    setAiSlides(slides)
    openGiaoVienWindow(slides.length > 0 ? slides : null, choice)
  }

  const handleDownloadSlides = () => {
    const slidesMd = curriculumToSlidesMarkdown(curriculumMarkdown, displayTopic)
    const blob = new Blob([slidesMd], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `slide-bai-giang-${displayTopic.slice(0, 25).replace(/\s+/g, '-')}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: tr('Đã tải slide', 'Slides downloaded', '已下载幻灯片', 'スライドをダウンロード', '슬라이드 다운로드됨'), duration: 2000 })
  }

  const handleReset = () => {
    setStep('INPUT')
    setCurriculumMarkdown('')
    setCurriculumId(null)
    setCurriculumEditMode(false)
    setEditOriginalText('')
    setEditEditedText('')
    setEditMatchStatus('idle')
    setEditMatchCount(0)
    setEditCompareResult(null)
    setEditCompareErrors([])
    setRegionPreview(null)
    setRegionCharCount(null)
    setRegionCompareResult(null)
    setRegionCheckErrors([])
    setWorksheetMarkdown('')
    setWorksheetId(null)
    setWorksheetQrDataUrl(null)
    setCurriculumWorksheets([])
    setCurriculumSlides(null)
    setAiSlides(null)
    setLastOverwriteAt(null)
    setSimilarTopicCurricula([])
    setBookIsbn('')
    setLessonImages([])
    setPastedContent('')
    if (lessonImageInputRef.current) lessonImageInputRef.current.value = ''
  }

  const [saveCurriculumLoading, setSaveCurriculumLoading] = useState(false)
  const [escalateLoading, setEscalateLoading] = useState(false)
  const [curriculumEditMode, setCurriculumEditMode] = useState(false)
  const [regionCheckLoading, setRegionCheckLoading] = useState(false)
  const [regionCheckErrors, setRegionCheckErrors] = useState<string[]>([])
  const [regionPreview, setRegionPreview] = useState<{ original: string; edited: string } | null>(null)
  const [regionCharCount, setRegionCharCount] = useState<number | null>(null)
  const [regionCompareResult, setRegionCompareResult] = useState<{
    correctVersion: string
    originalReason: string | null
    editedReason: string | null
    explanation: string
    bothAgree?: boolean
    model1Version?: string
    model2Version?: string
  } | null>(null)
  const [editOriginalText, setEditOriginalText] = useState('')
  const [editEditedText, setEditEditedText] = useState('')
  const [editMatchStatus, setEditMatchStatus] = useState<'idle' | 'found' | 'not_found' | 'multiple'>('idle')
  const [editMatchCount, setEditMatchCount] = useState(0)
  const editMatchIndexRef = useRef<number>(-1)
  const [editCompareLoading, setEditCompareLoading] = useState(false)
  const [editCompareResult, setEditCompareResult] = useState<{ correctVersion: string; originalReason: string | null; editedReason: string | null; explanation: string; bothAgree: boolean; reasonSaved: string | null; reasonNotSaved: string | null; model1Version?: string; model2Version?: string } | null>(null)
  const [editCompareErrors, setEditCompareErrors] = useState<string[]>([])
  const editCompareTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const prevContentRef = useRef<string>('')
  const regionCheckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSaveCurriculum = async () => {
    if (!curriculumMarkdown.trim()) return
    setSaveCurriculumLoading(true)
    try {
      const formData = new FormData()
      formData.append('curriculumMarkdown', curriculumMarkdown)
      formData.append('topic', displayTopic)
      if (curriculumId) formData.append('curriculumId', curriculumId)
      formData.append('subjectId', subjectId)
      formData.append('gradeLevelId', gradeLevelId)
      formData.append('textbookSetId', textbookSetId)
      formData.append('textbookVolume', textbookVolume.trim())
      formData.append('lessonNumber', createMode === 'topic' ? '' : lessonNumber.trim())
      formData.append('lessonTypeId', lessonTypeId)
      formData.append('numLessons', String(numLessons))
      formData.append('lessonDurationMinutes', String(lessonDurationMinutes))
      formData.append('goals', goals)
      formData.append('bookIsbn', textbookSetId === 'khac' ? bookIsbn.trim() : '')
      const result = await saveCurriculum(formData)
      if (result.error) {
        toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: result.error, variant: 'destructive' })
      } else if (result.success && result.curriculumId) {
        const newId = result.curriculumId
        setCurriculumId(newId)
        setCurriculumEditMode(false)
        if (curriculumSlides && curriculumSlides.length > 0 && !curriculumId) {
          saveSlidesToCurriculum({ curriculumId: newId, topic: displayTopic, subjectId, gradeLevelId, slides: curriculumSlides }).catch(() => {})
        }
        toast({ title: curriculumId ? tr('Đã cập nhật', 'Updated', '已更新', '更新しました', '업데이트됨') : tr('Đã lưu vào kho', 'Saved to library', '已保存到库', 'ライブラリに保存', '라이브러리에 저장됨'), duration: 2000 })
      }
    } finally {
      setSaveCurriculumLoading(false)
    }
  }

  const runRegionCheck = useCallback(
    async (prevContent: string, newContent: string, cursorPos: number) => {
      const regions = extractEditRegions(prevContent, newContent, cursorPos)
      if (!regions) {
        setRegionCheckLoading(false)
        return
      }
      setRegionPreview({ original: regions.originalRegion, edited: regions.editedRegion })
      setRegionCharCount(regions.charCount)
      setRegionCompareResult(null)
      setRegionCheckLoading(true)
      setRegionCheckErrors([])
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 120000)
      try {
        const res = await fetch('/api/curriculum-edit-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalRegion: regions.originalRegion,
            editedRegion: regions.editedRegion,
          }),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        const data = await res.json().catch(() => ({}))
        const rc = data.regionCompare
        if (rc) {
          const bothAgree = !!data.bothAgree
          setRegionCompareResult({
            correctVersion: rc.correctVersion || 'edited',
            originalReason: rc.originalReason || null,
            editedReason: rc.editedReason || null,
            explanation: rc.explanation || '',
            bothAgree,
          })
          setRegionCheckErrors(Array.isArray(data.errors) ? data.errors : [])
          const useOriginal = rc.correctVersion === 'original'
          if (useOriginal) {
            const corrected = newContent.slice(0, regions.editedStart) + regions.originalRegion + newContent.slice(regions.editedEnd)
            setCurriculumMarkdown(corrected)
            prevContentRef.current = corrected
            setAutoSaveStatus('saving')
            const s = autoSaveStateRef.current
            const topicVal = s.topic.trim() || (s.lessonNumber ? `Bài ${s.lessonNumber}` : '')
            if (topicVal) {
              const formData = new FormData()
              formData.append('curriculumMarkdown', corrected)
              formData.append('topic', topicVal)
              if (s.curriculumId) formData.append('curriculumId', s.curriculumId)
              formData.append('subjectId', s.subjectId)
              formData.append('gradeLevelId', s.gradeLevelId)
              formData.append('textbookSetId', s.textbookSetId)
              formData.append('textbookVolume', s.textbookVolume)
              formData.append('lessonNumber', s.createMode === 'topic' ? '' : s.lessonNumber)
              formData.append('lessonTypeId', s.lessonTypeId)
              formData.append('numLessons', String(s.numLessons))
              formData.append('lessonDurationMinutes', String(s.lessonDurationMinutes))
              formData.append('goals', s.goals)
              formData.append('bookIsbn', s.textbookSetId === 'khac' ? s.bookIsbn.trim() : '')
              const result = await saveCurriculum(formData)
              if (result.success && result.curriculumId) {
                setCurriculumId(result.curriculumId)
                if (!s.curriculumId) setCurriculumEditMode(true)
                if (autoSaveTimeoutRef.current) {
                  clearTimeout(autoSaveTimeoutRef.current)
                  autoSaveTimeoutRef.current = null
                }
                toast({
                  title: tr('Đã sửa và lưu', 'Corrected and saved', '已修正并保存', '修正して保存', '수정 후 저장'),
                  description: rc.explanation || tr('AI đã so sánh và lưu bản đúng.', 'AI compared and saved the correct version.', 'AI已比较并保存正确版本。', 'AIが比較して正しい版を保存。', 'AI가 비교 후 올바른 버전 저장.'),
                  duration: 4000,
                })
              }
            }
            setAutoSaveStatus('idle')
          }
        } else if (data.ok) {
          setRegionCheckErrors([])
        } else {
          setRegionCheckErrors(Array.isArray(data.errors) ? data.errors : [])
        }
      } catch (err) {
        setRegionCheckErrors([])
        if (err instanceof Error && err.name === 'AbortError') {
          toast({
            title: tr('Hết thời gian kiểm tra', 'Check timed out', '检查超时', 'タイムアウト', '타임아웃'),
            description: tr('AI phản hồi chậm. Thử sửa lại hoặc bấm Lưu.', 'AI response slow. Try editing again or click Save.', 'AI响应慢。请重试或点击保存。', 'AI応答が遅い。再試行または保存をクリック。', 'AI 응답 지연. 다시 시도하거나 저장 클릭.'),
            variant: 'destructive',
          })
        }
      } finally {
        clearTimeout(timeoutId)
        setRegionCheckLoading(false)
        setRegionCharCount(null)
      }
    },
    [tr, toast]
  )

  const autoSaveStateRef = useRef({
    curriculumMarkdown: '',
    topic: '',
    lessonNumber: '',
    displayTopic: '',
    curriculumId: null as string | null,
    subjectId: '',
    gradeLevelId: '',
    textbookSetId: '',
    textbookVolume: '',
    bookIsbn: '',
    createMode: 'topic' as 'textbook' | 'topic',
    lessonTypeId: '',
    numLessons: 3,
    lessonDurationMinutes: 45,
    goals: '',
  })
  useEffect(() => {
    autoSaveStateRef.current = {
      curriculumMarkdown,
      topic,
      lessonNumber,
      displayTopic,
      curriculumId,
      subjectId,
      gradeLevelId,
      textbookSetId,
      textbookVolume,
      bookIsbn,
      createMode,
      lessonTypeId,
      numLessons,
      lessonDurationMinutes,
      goals,
    }
  })

  const performAutoSave = useCallback(async () => {
    const s = autoSaveStateRef.current
    if (!s.curriculumMarkdown.trim() || s.curriculumMarkdown.length < 30) return
    const topicVal = s.topic.trim() || (s.lessonNumber ? `Bài ${s.lessonNumber}` : '')
    if (!topicVal) return

    setAutoSaveStatus('saving')
    const formData = new FormData()
    formData.append('curriculumMarkdown', s.curriculumMarkdown)
    formData.append('topic', topicVal)
    if (s.curriculumId) formData.append('curriculumId', s.curriculumId)
    formData.append('subjectId', s.subjectId)
    formData.append('gradeLevelId', s.gradeLevelId)
    formData.append('textbookSetId', s.textbookSetId)
    formData.append('textbookVolume', s.textbookVolume)
    formData.append('lessonNumber', s.createMode === 'topic' ? '' : s.lessonNumber)
    formData.append('lessonTypeId', s.lessonTypeId)
    formData.append('numLessons', String(s.numLessons))
    formData.append('lessonDurationMinutes', String(s.lessonDurationMinutes))
    formData.append('goals', s.goals)
    formData.append('bookIsbn', s.textbookSetId === 'khac' ? s.bookIsbn.trim() : '')

    const result = await saveCurriculum(formData)
    if (result.error) {
      setAutoSaveStatus('idle')
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: result.error, variant: 'destructive' })
    } else if (result.success && result.curriculumId) {
      setCurriculumId(result.curriculumId)
      if (!s.curriculumId) setCurriculumEditMode(true)
      setAutoSaveStatus('saved')
      toast({ title: tr('Đã lưu tự động', 'Auto-saved', '已自动保存', '自動保存しました', '자동 저장됨'), duration: 1500 })
      setTimeout(() => setAutoSaveStatus('idle'), 2000)
    } else {
      setAutoSaveStatus('idle')
    }
  }, [tr, toast])

  const handleCurriculumChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newVal = e.target.value
      const cursorPos = e.target.selectionStart ?? newVal.length
      const prev = prevContentRef.current
      setCurriculumMarkdown(newVal)
      prevContentRef.current = newVal

      if (regionCheckTimeoutRef.current) {
        clearTimeout(regionCheckTimeoutRef.current)
        setRegionCheckLoading(false)
      }
      const canEdit = curriculumEditMode || !curriculumId
      if (!canEdit || newVal.length < 15) return

      setRegionCheckLoading(true)
      const prevSnapshot = prev
      regionCheckTimeoutRef.current = setTimeout(() => {
        regionCheckTimeoutRef.current = null
        runRegionCheck(prevSnapshot, curriculumTextareaRef.current?.value ?? newVal, curriculumTextareaRef.current?.selectionStart ?? cursorPos)
      }, 350)

      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
      if (newVal.length >= 30 && step === 'RESULT') {
        autoSaveTimeoutRef.current = setTimeout(() => {
          autoSaveTimeoutRef.current = null
          void performAutoSave()
        }, 1000)
      }
    },
    [curriculumEditMode, curriculumId, runRegionCheck, step, performAutoSave]
  )

  useEffect(() => {
    prevContentRef.current = curriculumMarkdown
    return () => {
      if (regionCheckTimeoutRef.current) clearTimeout(regionCheckTimeoutRef.current)
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
      if (editCompareTimeoutRef.current) clearTimeout(editCompareTimeoutRef.current)
    }
  }, [curriculumMarkdown])

  useEffect(() => {
    const t = editOriginalText.trim()
    if (!t || t.length < 3 || !curriculumMarkdown) {
      setEditMatchStatus('idle')
      setEditMatchCount(0)
      editMatchIndexRef.current = -1
      return
    }
    let pos = 0
    const indices: number[] = []
    while ((pos = curriculumMarkdown.indexOf(t, pos)) >= 0) {
      indices.push(pos)
      pos += 1
    }
    if (indices.length === 0) {
      setEditMatchStatus('not_found')
      setEditMatchCount(0)
      editMatchIndexRef.current = -1
    } else if (indices.length === 1) {
      setEditMatchStatus('found')
      setEditMatchCount(1)
      editMatchIndexRef.current = indices[0]
    } else {
      setEditMatchStatus('multiple')
      setEditMatchCount(indices.length)
      editMatchIndexRef.current = -1
    }
  }, [editOriginalText, curriculumMarkdown])

  const handleApplyEditFromSheet = useCallback(
    (originalText: string, editedText: string) => {
      const orig = originalText.trim()
      if (!orig || !curriculumMarkdown.includes(orig)) return
      const idx = curriculumMarkdown.indexOf(orig)
      if (idx < 0) return
      const newContent = curriculumMarkdown.slice(0, idx) + editedText.trim() + curriculumMarkdown.slice(idx + orig.length)
      setCurriculumMarkdown(newContent)
      prevContentRef.current = newContent
      setAutoSaveStatus('saving')
      const formData = new FormData()
      formData.append('curriculumMarkdown', newContent)
      formData.append('topic', displayTopic)
      if (curriculumId) formData.append('curriculumId', curriculumId)
      formData.append('subjectId', subjectId)
      formData.append('gradeLevelId', gradeLevelId)
      formData.append('textbookSetId', textbookSetId)
      formData.append('textbookVolume', textbookVolume.trim())
      formData.append('lessonNumber', createMode === 'topic' ? '' : lessonNumber.trim())
      formData.append('lessonTypeId', lessonTypeId)
      formData.append('numLessons', String(numLessons))
      formData.append('lessonDurationMinutes', String(lessonDurationMinutes))
      formData.append('goals', goals)
      formData.append('bookIsbn', textbookSetId === 'khac' ? bookIsbn.trim() : '')
      saveCurriculum(formData).then((result) => {
        if (result.success && result.curriculumId) {
          setCurriculumId(result.curriculumId)
          setAutoSaveStatus('saved')
          setTimeout(() => setAutoSaveStatus('idle'), 2000)
        } else {
          setAutoSaveStatus('idle')
        }
      })
    },
    [curriculumMarkdown, displayTopic, curriculumId, subjectId, gradeLevelId, textbookSetId, textbookVolume, createMode, lessonNumber, lessonTypeId, numLessons, lessonDurationMinutes, goals, bookIsbn]
  )

  const runEditCompare = useCallback(async () => {
    const orig = editOriginalText.trim()
    const edited = editEditedText.trim()
    if (!orig || orig.length < 5) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Dữ liệu cần sửa quá ngắn.', 'Data to edit is too short.', '要编辑的数据太短。', '編集するデータが短すぎます。', '편집할 데이터가 너무 짧습니다.'), variant: 'destructive' })
      return
    }
    if (editMatchStatus === 'multiple') {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Tìm thấy nhiều đoạn trùng. Gõ thêm nội dung để đoạn cần sửa là duy nhất.', 'Multiple matches found. Add more content so the segment to edit is unique.', '找到多个相同段落。请添加更多内容使要编辑的段落唯一。', '複数一致。編集する段落が一意になるよう内容を追加してください。', '여러 개 일치. 편집할 단락이 고유하도록 내용을 추가하세요.'), variant: 'destructive' })
      return
    }
    if (editMatchStatus !== 'found') {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Không tìm thấy dữ liệu cần sửa trong giáo trình.', 'Data to edit not found in curriculum.', '在课程中未找到要编辑的数据。', '教材内に編集するデータが見つかりません。', '교육과정에서 편집할 데이터를 찾을 수 없습니다.'), variant: 'destructive' })
      return
    }
    if (!edited) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Nhập nội dung sẽ sửa thành.', 'Enter the replacement content.', '请输入替换内容。', '置換後の内容を入力してください。', '대체할 내용을 입력하세요.'), variant: 'destructive' })
      return
    }
    setEditCompareLoading(true)
    setEditCompareResult(null)
    setEditCompareErrors([])
    const idx = editMatchIndexRef.current >= 0 ? editMatchIndexRef.current : curriculumMarkdown.indexOf(orig)
    const CONTEXT_CHARS = 250
    const start = Math.max(0, idx - CONTEXT_CHARS)
    const end = Math.min(curriculumMarkdown.length, idx + orig.length + CONTEXT_CHARS)
    const originalRegion = curriculumMarkdown.slice(start, end)
    const editedRegion = curriculumMarkdown.slice(start, idx) + edited + curriculumMarkdown.slice(idx + orig.length, end)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000)
    try {
      const res = await fetch('/api/curriculum-edit-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalRegion, editedRegion }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      const data = await res.json().catch(() => ({}))
      const rc = data.regionCompare
      const reasonSaved = typeof data.reasonSaved === 'string' ? data.reasonSaved : null
      const reasonNotSaved = typeof data.reasonNotSaved === 'string' ? data.reasonNotSaved : null
      if (rc) {
        setEditCompareResult({
          correctVersion: rc.correctVersion || 'edited',
          originalReason: rc.originalReason || null,
          editedReason: rc.editedReason || null,
          explanation: rc.explanation || '',
          bothAgree: !!data.bothAgree,
          reasonSaved,
          reasonNotSaved,
          model1Version: data.model1Version,
          model2Version: data.model2Version,
        })
        setEditCompareErrors(Array.isArray(data.errors) ? data.errors : [])
        if (data.ok && rc.correctVersion === 'edited') {
          handleApplyEditFromSheet(orig, edited)
          setEditOriginalText('')
          setEditEditedText('')
          setEditMatchStatus('idle')
          setEditMatchCount(0)
          toast({
            title: tr('Đã lưu', 'Saved', '已保存', '保存しました', '저장됨'),
            description: reasonSaved || rc.explanation || tr('Lý do đã lưu: 2 AI (Gemini Pro + DeepSeek) đồng ý bản sửa đúng.', 'Reason saved: 2 AIs agree the edit is correct.', '已保存原因：2个AI同意修改正确。', '保存理由：2つのAIが編集が正しいと同意。', '저장 이유: 2개 AI가 편집이 맞다고 동의.'),
            duration: 3000,
          })
        } else if (data.bothAgree && rc.correctVersion === 'original') {
          toast({
            title: tr('Chưa lưu – Giữ bản gốc', 'Not saved – Keep original', '未保存–保留原文', '保存せず–元のまま', '저장 안 함–원본 유지'),
            description: (reasonNotSaved || rc.explanation || tr('Lý do chưa lưu được: 2 AI đồng ý bản gốc đúng.', 'Reason not saved: 2 AIs agree the original is correct.', '未保存原因：2个AI同意原文正确。', '保存しない理由：2つのAIが元が正しいと同意。', '저장 안 함 이유: 2개 AI가 원본이 맞다고 동의.')) + ' ' + tr('Sửa lại và thử tiếp.', 'Edit and try again.', '请修改后重试。', '編集して再試行してください。', '수정 후 다시 시도하세요.'),
            variant: 'destructive',
            duration: 5000,
          })
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        toast({ title: tr('Hết thời gian', 'Timeout', '超时', 'タイムアウト', '타임아웃'), description: tr('AI phản hồi chậm. Thử lại.', 'AI response slow. Try again.', 'AI响应慢。请重试。', 'AI応答が遅い。再試行。', 'AI 응답 지연. 다시 시도.'), variant: 'destructive' })
      }
    } finally {
      clearTimeout(timeoutId)
      setEditCompareLoading(false)
    }
  }, [editOriginalText, editEditedText, editMatchStatus, curriculumMarkdown, handleApplyEditFromSheet, tr, toast])


  const handleEscalateToAdmin = async (errorsToSend?: string[]) => {
    const errs = errorsToSend ?? regionCheckErrors
    if (!curriculumMarkdown.trim()) return
    setEscalateLoading(true)
    try {
      const res = await fetch('/api/curriculum-edit-escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          curriculumId,
          topic: displayTopic,
          subjectId,
          gradeLevelId,
          textbookSetId,
          textbookVolume: textbookVolume.trim(),
          lessonNumber: createMode === 'topic' ? '' : lessonNumber.trim(),
          lessonTypeId,
          numLessons,
          lessonDurationMinutes,
          goals,
          contentMarkdown: curriculumMarkdown,
          aiErrors: errs,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        setCurriculumEditMode(true)
        toast({
          title: tr('Đã gửi admin', 'Sent to admin', '已发送给管理员', '管理者に送信しました', '관리자에게 전송됨'),
          description: tr('Admin sẽ xem xét và phản hồi. Bạn có thể tiếp tục sửa.', 'Admin will review and respond. You can continue editing.', '管理员将审核并回复。您可以继续编辑。', '管理者が確認して返答します。編集を続けられます。', '관리자가 검토 후 답변합니다. 편집을 계속할 수 있습니다.'),
          duration: 4000,
        })
      } else {
        toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: data?.error || 'Gửi thất bại.', variant: 'destructive' })
      }
    } finally {
      setEscalateLoading(false)
    }
  }

  const handleLoadCurriculum = async (id: string) => {
    const result = await getCurriculumById(id)
    if (result.error) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: result.error, variant: 'destructive' })
      return
    }
    if (result.success && result.curriculum) {
      const c = result.curriculum as { id?: string; topic?: string; subject_id?: string; grade_level_id?: string; textbook_set_id?: string; textbook_volume?: string | null; textbook_isbn?: string | null; lesson_number?: number | null; lesson_type_id?: string; num_lessons?: number; lesson_duration_minutes?: number; goals?: string; content_markdown?: string }
      setSubjectId(c.subject_id ?? 'toan')
      setGradeLevelId(normalizeGradeLevelId(c.grade_level_id ?? 'lop-12'))
      setTextbookSetId(c.textbook_set_id ?? 'ket-noi-tri-thuc')
      setTextbookVolume(c.textbook_volume ?? '')
      setBookIsbn(c.textbook_isbn ?? '')
      setTopic(c.topic ?? '')
      setLessonNumber(c.lesson_number != null ? String(c.lesson_number) : '')
      setCreateMode(c.lesson_number != null ? 'textbook' : 'topic')
      setLessonTypeId(c.lesson_type_id ?? 'hinh-thanh-kien-thuc')
      setNumLessons(c.num_lessons ?? 3)
      setLessonDurationMinutes(c.lesson_duration_minutes ?? 45)
      setGoals(c.goals ?? '')
      setCurriculumMarkdown(c.content_markdown ?? '')
      setCurriculumId(c.id ?? null)
      setCurriculumEditMode(true)
      setEditOriginalText('')
      setEditEditedText('')
      setEditMatchStatus('idle')
      setEditMatchCount(0)
      setEditCompareResult(null)
      setEditCompareErrors([])
      setRegionPreview(null)
      setRegionCharCount(null)
      setRegionCompareResult(null)
      setRegionCheckErrors([])
      setWorksheetMarkdown('')
      setWorksheetId(null)
      setWorksheetQrDataUrl(null)
      setStep('RESULT')
      setShowBrowse(false)
      setAiSlides(null)
      const wsRes = await getWorksheetsByCurriculumId(id)
      if (wsRes && 'items' in wsRes) setCurriculumWorksheets((wsRes.items ?? []) as Array<{ id: string; topic: string; subject_id: string; grade_level_id: string; content_markdown: string; created_at: string }>)
      else setCurriculumWorksheets([])
      const slidesRes = await getSlidesByCurriculumId(id)
      if (slidesRes?.success && slidesRes.slides) setCurriculumSlides(slidesRes.slides)
      else setCurriculumSlides(null)
      void recordCurriculumOpen(id)
      toast({ title: tr('Đã tải giáo trình', 'Curriculum loaded', '已加载课程', 'カリキュラムを読み込み', '교육과정 로드됨'), duration: 2000 })
    }
  }

  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null)
  const curriculumTextareaRef = useRef<HTMLTextAreaElement>(null)
  const worksheetTextareaRef = useRef<HTMLTextAreaElement>(null)

  const handleDeleteCurriculum = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm(tr('Xóa giáo trình này? Phiếu bài tập thuộc giáo trình sẽ không bị xóa.', 'Delete this curriculum? Worksheets in it will not be deleted.', '删除此课程？其中的练习不会被删除。', 'このカリキュラムを削除しますか？ワークシートは削除されません。', '이 교육과정을 삭제할까요? 워크시트는 삭제되지 않습니다.'))) return
    setDeleteLoadingId(id)
    const result = await deleteCurriculum(id)
    setDeleteLoadingId(null)
    if (result.error) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: result.error, variant: 'destructive' })
    } else {
      setCurriculaList((prev) => prev.filter((c) => c.id !== id))
      if (curriculumId === id) handleReset()
      toast({ title: tr('Đã xóa giáo trình', 'Curriculum deleted', '课程已删除', 'カリキュラムを削除', '교육과정 삭제됨'), duration: 2000 })
    }
  }

  const handleLoadWorksheetFromCurriculum = (w: { id: string; topic: string; content_markdown: string }) => {
    setWorksheetMarkdown(w.content_markdown)
    setWorksheetId(w.id)
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    QRCode.toDataURL(`${baseUrl}/phieu-bai-tap/${w.id}`, { width: 180, margin: 2 }).then(setWorksheetQrDataUrl).catch(() => setWorksheetQrDataUrl(null))
  }

  const handleLoadWorksheet = async (id: string) => {
    const result = await getWorksheetById(id)
    if (result.error) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: result.error, variant: 'destructive' })
      return
    }
    if (result.success && result.worksheet) {
      const w = result.worksheet as { id: string; topic: string; subject_id: string; grade_level_id: string; content_markdown: string; curriculum_id?: string }
      const curriculumIdFromWs = w.curriculum_id
      setTopic(w.topic ?? '')
      setSubjectId(w.subject_id ?? 'toan')
      setGradeLevelId(normalizeGradeLevelId(w.grade_level_id ?? 'lop-6'))
      setWorksheetMarkdown(w.content_markdown ?? '')
      setWorksheetId(w.id)
      setCurriculumId(curriculumIdFromWs ?? null)
      setCurriculumEditMode(false)
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
      QRCode.toDataURL(`${baseUrl}/phieu-bai-tap/${w.id}`, { width: 180, margin: 2 }).then(setWorksheetQrDataUrl).catch(() => setWorksheetQrDataUrl(null))
      setStep('RESULT')
      setShowBrowse(false)
      if (curriculumIdFromWs) {
        const [curRes, wsRes, slidesRes] = await Promise.all([
          getCurriculumById(curriculumIdFromWs),
          getWorksheetsByCurriculumId(curriculumIdFromWs),
          getSlidesByCurriculumId(curriculumIdFromWs),
        ])
        if (curRes?.success && curRes.curriculum) {
          const c = curRes.curriculum as { textbook_set_id?: string; textbook_volume?: string | null; textbook_isbn?: string | null; lesson_number?: number | null; lesson_type_id?: string; num_lessons?: number; lesson_duration_minutes?: number; goals?: string; content_markdown?: string; topic?: string }
          setTextbookSetId(c.textbook_set_id ?? 'ket-noi-tri-thuc')
          setTextbookVolume(c.textbook_volume ?? '')
          setBookIsbn(c.textbook_isbn ?? '')
          setTopic(c.topic ?? '')
          setLessonNumber(c.lesson_number != null ? String(c.lesson_number) : '1')
          setLessonTypeId(c.lesson_type_id ?? 'hinh-thanh-kien-thuc')
          setNumLessons(c.num_lessons ?? 3)
          setLessonDurationMinutes(c.lesson_duration_minutes ?? 45)
          setGoals(c.goals ?? '')
          setCurriculumMarkdown(c.content_markdown ?? '')
        }
        if (wsRes && 'items' in wsRes) setCurriculumWorksheets((wsRes.items ?? []) as Array<{ id: string; topic: string; subject_id: string; grade_level_id: string; content_markdown: string; created_at: string }>)
        else setCurriculumWorksheets([])
        if (slidesRes?.success && slidesRes.slides) setCurriculumSlides(slidesRes.slides)
        else setCurriculumSlides(null)
      } else {
        setCurriculumMarkdown('')
        setBookIsbn('')
        setCurriculumWorksheets([])
        setCurriculumSlides(null)
      }
      toast({ title: tr('Đã tải phiếu bài tập', 'Worksheet loaded', '已加载练习', 'ワークシートを読み込み', '워크시트 로드됨'), duration: 2000 })
    }
  }

  const handleCreateWorksheet = async () => {
    setWorksheetLoading(true)
    const formData = new FormData()
    formData.append('curriculumMarkdown', curriculumMarkdown)
    if (curriculumId) formData.append('curriculumId', curriculumId)
    formData.append('topic', displayTopic)
    formData.append('subjectId', subjectId)
    formData.append('gradeLevelId', gradeLevelId)
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
      if (curriculumId) {
        const wsRes = await getWorksheetsByCurriculumId(curriculumId)
        if (wsRes && 'items' in wsRes) setCurriculumWorksheets((wsRes.items ?? []) as Array<{ id: string; topic: string; subject_id: string; grade_level_id: string; content_markdown: string; created_at: string }>)
      }
      toast({
        title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'),
        description: result.fromCache
          ? tr('Đã lấy phiếu bài tập có sẵn từ kho dữ liệu.', 'Loaded existing worksheet from database.', '已从数据库加载现有练习。', '既存ワークシートをDBから読み込みました。', 'DB에서 기존 워크시트를 불러왔습니다.')
          : tr('Phiếu bài tập đã được tạo và lưu vào kho dữ liệu.', 'Worksheet has been created and saved to database.', '练习已创建并保存到数据库。', 'ワークシートを作成しDBに保存しました。', '워크시트를 생성하고 DB에 저장했습니다.'),
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
    a.download = `phieu-bai-tap-${displayTopic.slice(0, 25).replace(/\s+/g, '-')}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: tr('Đã tải xuống', 'Downloaded', '已下载', 'ダウンロードしました', '다운로드됨'), duration: 2000 })
  }

  const handleExportPdf = () => {
    const name = `phieu-bai-tap-${displayTopic.slice(0, 25).replace(/\s+/g, '-')}.pdf`
    exportWorksheetToPdf(worksheetMarkdown, name, null).then(() => {
      toast({ title: tr('Đã tải PDF', 'PDF downloaded', '已下载PDF', 'PDFをダウンロード', 'PDF 다운로드됨'), duration: 2000 })
    }).catch(() => {
      toast({ title: tr('Xuất PDF thất bại', 'PDF export failed', 'PDF导出失败', 'PDFエクスポート失敗', 'PDF 내보내기 실패'), variant: 'destructive' })
    })
  }

  const handleExportWord = () => {
    const name = `phieu-bai-tap-${displayTopic.slice(0, 25).replace(/\s+/g, '-')}.docx`
    exportWorksheetToWord(worksheetMarkdown, name).then(() => {
      toast({ title: tr('Đã tải Word', 'Word downloaded', '已下载Word', 'Wordをダウンロード', 'Word 다운로드됨'), duration: 2000 })
    }).catch(() => {
      toast({ title: tr('Xuất Word thất bại', 'Word export failed', 'Word导出失败', 'Wordエクスポート失敗', 'Word 내보내기 실패'), variant: 'destructive' })
    })
  }

  const worksheetParts = useMemo(() => splitWorksheetSections(worksheetMarkdown), [worksheetMarkdown])

  return (
    <>
      <Toaster />
      <SlideVersionDialog
        open={showSlideVersionDialog}
        onOpenChange={setShowSlideVersionDialog}
        hasPersonal={!!personalSlides?.length}
        onChoose={handleSlideVersionChoose}
        tr={tr}
      />
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
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            <Link href="/tao-bai-thi">
              <Button variant="outline" size="sm" className="gap-1.5">
                <FileQuestion className="h-4 w-4" />
                {tr('Tạo bài thi', 'Create exam', '创建测验', 'テスト作成', '시험 생성')}
              </Button>
            </Link>
          </div>
        </div>

        <Card className="border shadow-sm border-slate-200/80 dark:border-slate-700/50">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-violet-600" />
                {tr('Kho giáo trình', 'Curriculum library', '课程库', 'カリキュラムライブラリ', '교육과정 라이브러리')}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowBrowse(!showBrowse)}>
                {showBrowse ? tr('Thu gọn', 'Collapse', '收起', '閉じる', '접기') : tr('Xem kho', 'Browse library', '浏览库', 'ライブラリを見る', '라이브러리 보기')}
              </Button>
            </div>
            <CardDescription className="text-xs">
              {tr('Danh sách đầy đủ giáo trình. Lọc theo môn học và lớp bên dưới. Mỗi giáo trình gồm: nội dung, phiếu bài tập, slide bài giảng.', 'Full curriculum list. Filter by subject and grade below. Each curriculum includes: content, worksheets, slides.', '完整课程列表。下方按科目和年级筛选。每个课程包含：内容、练习、幻灯片。', '全カリキュラム一覧。下で科目・学年でフィルター。各カリキュラムに：内容・ワークシート・スライド。', '전체 교육과정 목록. 아래에서 과목·학년으로 필터. 각 교육과정: 내용·워크시트·슬라이드.')}
            </CardDescription>
          </CardHeader>
          {showBrowse && (
            <CardContent className="pt-0 space-y-4">
              {browseLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-8 w-8 text-violet-500 animate-spin" />
                </div>
              ) : (
                <div>
                  <div className="flex flex-wrap gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                        {tr('Lọc môn', 'Filter subject', '筛选科目', '科目でフィルター', '과목 필터')}:
                      </label>
                      <select
                        value={browseSubjectFilter}
                        onChange={(e) => setBrowseSubjectFilter(e.target.value)}
                        className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs min-w-[120px]"
                      >
                        <option value="">{tr('Tất cả', 'All', '全部', 'すべて', '전체')}</option>
                        {SUBJECTS.map((s) => (
                          <option key={s.id} value={s.id}>
                            {uiLocale === 'en' ? s.labelEn : s.labelVi}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                        {tr('Lọc lớp', 'Filter grade', '筛选年级', '学年でフィルター', '학년 필터')}:
                      </label>
                      <select
                        value={browseGradeFilter}
                        onChange={(e) => setBrowseGradeFilter(e.target.value)}
                        className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs min-w-[120px]"
                      >
                        <option value="">{tr('Tất cả', 'All', '全部', 'すべて', '전체')}</option>
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
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <BookOpen className="h-3.5 w-3.5" />
                    {tr('Giáo trình', 'Curricula', '课程', 'カリキュラム', '교육과정')} ({curriculaList.length})
                    {(browseSubjectFilter || browseGradeFilter) && (
                      <span className="text-muted-foreground/80">
                        — {tr('đang lọc', 'filtered', '已筛选', 'フィルター中', '필터됨')}
                      </span>
                    )}
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-1 rounded border p-2 bg-slate-50/50 dark:bg-slate-900/30">
                    {curriculaList.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">
                        {browseSubjectFilter || browseGradeFilter
                          ? tr('Không có giáo trình phù hợp bộ lọc. Thử bỏ lọc hoặc tạo mới.', 'No curricula match filter. Try removing filter or create new.', '没有符合筛选的课程。尝试移除筛选或新建。', 'フィルターに一致するカリキュラムがありません。', '필터에 맞는 교육과정 없음. 필터 해제 또는 새로 만들기.')
                          : tr('Chưa có giáo trình nào. Tạo mới bên dưới.', 'No curricula yet. Create new below.', '暂无课程。在下方新建。', 'カリキュラムがありません。下で新規作成。', '교육과정이 없습니다. 아래에서 새로 만들기.')}
                      </p>
                    ) : (
                      curriculaList.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center gap-2 group"
                        >
                          <button
                            type="button"
                            onClick={() => void handleLoadCurriculum(c.id)}
                            className="flex-1 min-w-0 text-left text-sm px-2 py-1.5 rounded hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors"
                          >
                            <span className="font-medium truncate block">{c.topic}</span>
                            <span className="text-xs text-muted-foreground block">
                              {c.subject_id} · {c.grade_level_id}
                              {c.created_at && (
                                <span className="ml-1.5">· {formatCreatedAt(c.created_at)}</span>
                              )}
                            </span>
                          </button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 opacity-60 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                            onClick={(e) => void handleDeleteCurriculum(e, c.id)}
                            disabled={deleteLoadingId === c.id}
                            title={tr('Xóa giáo trình', 'Delete curriculum', '删除课程', 'カリキュラムを削除', '교육과정 삭제')}
                          >
                            {deleteLoadingId === c.id ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
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
                {tr('Chọn môn, lớp. Tạo theo SGK (gửi ảnh sách) hoặc theo chủ đề. AI tạo giáo trình Markdown.', 'Select subject, grade. Create by textbook (upload book images) or by topic. AI generates Markdown curriculum.', '选择科目、年级。按教材（上传教材图片）或主题创建。AI 生成 Markdown 课程。', '科目・学年を選択。教科書（画像アップロード）・主題で作成。AIがMarkdownカリキュラムを生成。', '과목·학년 선택. 교과서(이미지 업로드)·주제로 생성. AI가 Markdown 교육과정 생성.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{tr('Cách tạo', 'Create mode', '创建方式', '作成方法', '생성 방식')}</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="createMode"
                      checked={createMode === 'textbook'}
                      onChange={() => {
                        setCreateMode('textbook')
                        setSimilarTopicCurricula([])
                        if (textbookSetId === 'khac') {
                          setTextbookSetId('ket-noi-tri-thuc')
                          setBookIsbn('')
                        }
                      }}
                      className="rounded-full border-input"
                    />
                    <span className="text-sm">{tr('Theo SGK (bài số)', 'By textbook (lesson #)', '按教材（课号）', '教科書（課番号）', '교과서(차시)')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="createMode"
                      checked={createMode === 'topic'}
                      onChange={() => {
                        setCreateMode('topic')
                        setTextbookSetId('khac')
                        setSimilarTopicCurricula([])
                        setBookIsbn('')
                        setLessonImages([])
                      }}
                      className="rounded-full border-input"
                    />
                    <span className="text-sm">{tr('Theo chủ đề', 'By topic', '按主题', '主題で', '주제로')}</span>
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  {createMode === 'textbook'
                    ? tr('Chọn bộ sách, nhập bài số. Gửi ảnh trang sách (bắt buộc) – AI lấy sơ đồ, hình minh họa từ ảnh.', 'Select textbook set, enter lesson #. Upload page image (required) – AI extracts diagrams, figures from images.', '选择教材、输入课号。上传教材页面（必填）– AI 从图片提取图表、示意图。', '教科書・課番号を入力。ページ画像をアップロード（必須）– AIが画像から図表を抽出。', '교과서·차시 입력. 페이지 이미지 업로드 (필수) – AI가 이미지에서 도표·그림 추출.')
                    : tr('Chỉ cần nhập chủ đề. Không cần bài số hay ảnh. Có thể gửi ảnh để AI bám sát hơn.', 'Just enter topic. No lesson # or image required. Optional: upload image for better accuracy.', '只需输入主题。无需课号或图片。可选：上传图片提高准确性。', '主題のみ入力。課番号・画像不要。任意：画像で精度向上。', '주제만 입력. 차시·이미지 불필요. 선택: 이미지로 정확도 향상.')}
                </p>
              </div>
              {createMode === 'topic' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    {tr('Chủ đề', 'Topic', '主题', '主題', '주제')} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    placeholder={tr('Ví dụ: Nguyên hàm, Tích phân, Phương trình bậc hai...', 'e.g. Antiderivative, Integral, Quadratic equation...', '例如：原函数、积分、一元二次方程...', '例：原始関数、積分、二次方程式...', '예: 부정적분, 적분, 이차방정식...')}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="bg-white/80"
                  />
                </div>
              )}
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
              {createMode === 'textbook' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Bộ sách giáo khoa', 'Textbook set', '教材', '教科書', '교과서')}</label>
                  <select
                    value={textbookSetId}
                    onChange={(e) => {
                      const next = e.target.value
                      setTextbookSetId(next)
                      if (next !== 'khac') setBookIsbn('')
                    }}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    {TEXTBOOK_SETS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {uiLocale === 'en' ? t.labelEn : t.labelVi}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {createMode === 'textbook' && textbookSetId === 'khac' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    {tr('ISBN sách', 'Book ISBN', '教材 ISBN', '教科書 ISBN', '교과서 ISBN')} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    placeholder={tr('Nhập ISBN-10 hoặc ISBN-13', 'Enter ISBN-10 or ISBN-13', '请输入 ISBN-10 或 ISBN-13', 'ISBN-10 または ISBN-13 を入力', 'ISBN-10 또는 ISBN-13 입력')}
                    value={bookIsbn}
                    onChange={(e) => setBookIsbn(e.target.value)}
                    className="w-full h-9 bg-white/80"
                  />
                  <p className="text-xs text-muted-foreground">
                    {tr('Bắt buộc để đối chiếu đúng sách trong DB, tránh gộp nhầm sách khác nhau.', 'Required for accurate DB matching, to avoid mixing different books.', '用于准确匹配数据库教材，避免不同教材被误判为同一教材。', 'DBで正確に照合し、別教材の誤統合を防ぐため必須です。', 'DB 정확 매칭을 위해 필수이며, 다른 교재가 합쳐지는 것을 방지합니다.')}
                  </p>
                </div>
              )}
              {createMode === 'textbook' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    {tr('Bài số', 'Lesson number', '课号', '課番号', '차시 번호')} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    placeholder={tr('Nhập số bài (ví dụ: 1, 2, 3...)', 'Enter lesson number (e.g. 1, 2, 3...)', '输入课号（如：1、2、3...）', '課番号を入力（例：1、2、3...）', '차시 번호 입력 (예: 1, 2, 3...)')}
                    value={lessonNumber}
                    onChange={(e) => setLessonNumber(e.target.value)}
                    className="w-24 h-9 bg-white/80"
                  />
                </div>
              )}
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
              {createMode === 'topic' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Mục tiêu bổ sung (tùy chọn)', 'Additional goals (optional)', '补充目标（可选）', '追加目標（任意）', '추가 목표 (선택)')}</label>
                  <Textarea
                    placeholder={tr('Mô tả mục tiêu, yêu cầu đặc biệt...', 'Describe goals, special requirements...', '描述目标、特殊要求...', '目標・特別な要件を記述...', '목표, 특별 요구사항 설명...')}
                    value={goals}
                    onChange={(e) => setGoals(e.target.value)}
                    className="bg-white/80 min-h-[80px] resize-y"
                  />
                </div>
              )}
              {curriculumExists === true && existingCurriculumTopic && createMode === 'textbook' && (
                <div className="space-y-2 rounded-lg border border-emerald-300 dark:border-emerald-700 p-4 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                    {tr('Bài học có sẵn:', 'Lesson available:', '已有课程：', 'レッスンあり：', '수업 있음:')}
                  </p>
                  <p className="text-base font-semibold text-emerald-900 dark:text-emerald-100">
                    {existingCurriculumTopic}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tr('Nếu tên bài khớp, mở bản có sẵn. Nếu không khớp, gửi ảnh rồi bấm "Tạo lại giáo trình (ghi đè)".', 'If lesson title matches, open existing. If not, upload image and click "Recreate curriculum (overwrite)".', '若课名匹配，请打开已有课程；若不匹配，请上传图片后点击“重建课程（覆盖）”。', '題名が一致すれば既存を開き、不一致なら画像をアップロードして「再作成（上書き）」を押してください。', '제목이 맞으면 기존을 열고, 맞지 않으면 이미지 업로드 후 "다시 만들기(덮어쓰기)"를 누르세요.')}
                  </p>
                </div>
              )}
              {createMode === 'topic' && similarTopicCurricula.length > 0 && (
                <div className="space-y-2 rounded-lg border border-amber-300 dark:border-amber-700 p-4 bg-amber-50/60 dark:bg-amber-950/20">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    {tr('Có giáo trình gần giống chủ đề này:', 'Similar curricula found for this topic:', '发现与该主题相近的课程：', 'この主題に近いカリキュラムがあります：', '이 주제와 유사한 교육과정이 있습니다:')}
                  </p>
                  <div className="space-y-1">
                    {similarTopicCurricula.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => void handleLoadCurriculum(item.id)}
                        className="w-full text-left text-sm rounded border border-amber-200 dark:border-amber-800 bg-white/80 dark:bg-slate-900/50 px-3 py-2 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                      >
                        <div className="font-medium truncate">{item.topic}</div>
                        <div className="text-xs text-muted-foreground">
                          {tr('Độ gần:', 'Similarity:', '相似度：', '類似度：', '유사도:')} {Math.round(item.score * 100)}%
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tr('Bạn có thể mở giáo trình gần giống để dùng ngay, hoặc vẫn bấm "Tạo giáo trình" để tạo mới.', 'You can open a similar curriculum now, or still click "Create curriculum" to create a new one.', '您可以先打开相近课程，或继续点击“创建课程”新建。', '近いカリキュラムを開くか、そのまま「作成」を押して新規作成できます。', '유사 교육과정을 열거나, 그대로 "교육과정 생성"으로 새로 만들 수 있습니다.')}
                  </p>
                </div>
              )}
              {createMode === 'textbook' && (
              <div className="space-y-2 rounded-lg border border-dashed border-violet-300 dark:border-violet-700 p-4 bg-violet-50/50 dark:bg-violet-950/20">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <ImageIcon className="h-4 w-4" />
                  {tr('Gửi ảnh bài học', 'Upload lesson image', '上传课程图片', '授業画像をアップロード', '수업 이미지 업로드')}
                  <span className="text-red-500 font-medium">*</span>
                </label>
                <p className="text-xs text-muted-foreground">
                  {tr('Chụp/gửi ảnh trang sách (tối đa 10 ảnh) – bắt buộc. AI lấy sơ đồ, hình minh họa từ ảnh.', 'Upload photo(s) of the textbook page(s) (max 10) – required. AI extracts diagrams, figures from images.', '上传教材页面照片（最多10张）– 必填。AI 从图片提取图表、示意图。', '教科書のページ写真をアップロード（最大10枚）– 必須。AIが画像から図表を抽出。', '교과서 페이지 사진 업로드 (최대 10개) – 필수. AI가 이미지에서 도표·그림 추출.')}
                </p>
                <input
                  ref={lessonImageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const list = Array.from(e.target.files ?? [])
                    setLessonImages(list.slice(0, 10))
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => lessonImageInputRef.current?.click()}
                  className="border-violet-400 text-violet-700 hover:bg-violet-100 dark:border-violet-600 dark:text-violet-300"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {lessonImages.length > 0
                    ? `${tr('Đã chọn', 'Selected', '已选', '選択済み', '선택됨')} ${lessonImages.length} ${tr('ảnh', 'image(s)', '张图片', '枚の画像', '개 이미지')}`
                    : tr('Chọn ảnh, có thể nhiều', 'Choose image(s)', '选择图片（可多选）', '画像を選択（複数可）', '이미지 선택 여러 개')}
                </Button>
                {lessonImages.length > 1 && (
                  <ul className="text-xs text-muted-foreground mt-2 space-y-0.5 max-h-24 overflow-y-auto">
                    {lessonImages.map((f, i) => (
                      <li key={i} className="truncate">• {f.name}</li>
                    ))}
                  </ul>
                )}
              </div>
              )}
              {createMode === 'textbook' && curriculumExists === true && (
                <p className="w-full text-sm text-red-600 dark:text-red-400">
                  {tr('Nếu tên bài khớp, mở bản có sẵn. Nếu không khớp, gửi ảnh rồi bấm "Tạo lại giáo trình (ghi đè)".', 'If lesson title matches, open existing. If not, upload image then click "Recreate curriculum (overwrite)".', '若课名匹配，请打开已有课程；若不匹配，请上传图片后点击“重建课程（覆盖）”。', '題名が一致すれば既存を開き、不一致なら画像をアップロードして「再作成（上書き）」を押してください。', '제목이 맞으면 기존을 열고, 맞지 않으면 이미지를 업로드한 뒤 "다시 만들기(덮어쓰기)"를 누르세요.')}
                </p>
              )}
              {createMode === 'textbook' && curriculumExists === true ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => existingCurriculumId && void handleLoadCurriculum(existingCurriculumId)}
                    disabled={!existingCurriculumId}
                    className="w-full border-violet-400 text-violet-700 hover:bg-violet-100 dark:border-violet-600 dark:text-violet-300"
                  >
                    {tr('Mở giáo trình có sẵn', 'Open existing curriculum', '打开已有课程', '既存カリキュラムを開く', '기존 교육과정 열기')}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleOverwriteFromExisting()}
                    disabled={overwriteFromExistingLoading || (step as Step) === 'GENERATING' || lessonImages.length === 0}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {overwriteFromExistingLoading
                      ? tr('Đang tạo lại...', 'Recreating...', '正在重建...', '再作成中...', '다시 만드는 중...')
                      : tr('Tạo lại giáo trình (ghi đè)', 'Recreate curriculum (overwrite)', '重建课程（覆盖）', 'カリキュラム再作成（上書き）', '교육과정 다시 만들기(덮어쓰기)')}
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => void handleSubmit()}
                  disabled={
                    (step as Step) === 'GENERATING' ||
                    overwriteFromExistingLoading ||
                    (createMode === 'topic'
                      ? !topic.trim() || topic.trim().length < 2
                      : checkLoading || curriculumExists === null || lessonImages.length === 0 || (textbookSetId === 'khac' && !bookIsbn.trim()))
                  }
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {createMode === 'topic'
                    ? tr('Tạo giáo trình', 'Create curriculum', '创建课程', 'カリキュラムを作成', '교육과정 생성')
                    : checkLoading
                      ? tr('Đang kiểm tra...', 'Checking...', '正在检查...', '確認中...', '확인 중...')
                      : tr('Tạo giáo trình', 'Create curriculum', '创建课程', 'カリキュラムを作成', '교육과정 생성')}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <div ref={curriculumResultRef}>
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
                <CardTitle className="text-base flex items-center gap-2">
                  {tr('Giáo trình đã tạo', 'Generated curriculum', '已创建课程', '作成したカリキュラム', '생성된 교육과정')}
                  {lastOverwriteAt && (
                    <span className="text-xs font-normal text-amber-700 dark:text-amber-300">
                      {tr('Đã cập nhật từ ảnh', 'Updated from image', '已由图片更新', '画像から更新済み', '이미지로 업데이트됨')}
                    </span>
                  )}
                  {autoSaveStatus === 'saving' && (
                    <span className="text-xs font-normal text-muted-foreground animate-pulse">
                      {tr('Đang lưu...', 'Saving...', '保存中...', '保存中...', '저장 중...')}
                    </span>
                  )}
                  {autoSaveStatus === 'saved' && (
                    <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">
                      {tr('Đã lưu', 'Saved', '已保存', '保存済み', '저장됨')}
                    </span>
                  )}
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    <Copy className="h-3.5 w-3.5 mr-1" /> {tr('Sao chép', 'Copy', '复制', 'コピー', '복사')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    <FileDown className="h-3.5 w-3.5 mr-1" /> {tr('Tải .md', 'Download .md', '下载 .md', '.md をダウンロード', '.md 다운로드')}
                  </Button>
                  {!curriculumId && (
                    <Button variant="outline" size="sm" onClick={() => void handleSaveCurriculum()} disabled={saveCurriculumLoading} className="border-emerald-400 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-600 dark:text-emerald-300">
                      {saveCurriculumLoading ? tr('Đang lưu...', 'Saving...', '保存中...', '保存中...', '저장 중...') : tr('Lưu vào kho', 'Save to library', '保存到库', 'ライブラリに保存', '라이브러리에 저장')}
                    </Button>
                  )}
                  {curriculumId && !curriculumEditMode && (
                    <Button variant="outline" size="sm" onClick={() => { setCurriculumEditMode(true); setEditOriginalText(''); setEditEditedText(''); setEditMatchStatus('idle'); setEditMatchCount(0); setEditCompareResult(null); setEditCompareErrors([]); setRegionPreview(null); setRegionCharCount(null); setRegionCompareResult(null); setRegionCheckErrors([]) }} className="border-amber-400 text-amber-700 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-300">
                      {tr('Sửa giáo trình', 'Edit curriculum', '编辑课程', '教材を編集', '교육과정 편집')}
                    </Button>
                  )}
                  {curriculumEditMode && (
                    <Button variant="ghost" size="sm" onClick={() => { setCurriculumEditMode(false); setEditOriginalText(''); setEditEditedText(''); setEditMatchStatus('idle'); setEditMatchCount(0); setEditCompareResult(null); setEditCompareErrors([]) }}>
                      {tr('Hủy', 'Cancel', '取消', 'キャンセル', '취소')}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => void handleOpenSlides()} disabled={slideAnalysisLoading} className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-300 dark:hover:bg-amber-950/30">
                    <Presentation className="h-3.5 w-3.5 mr-1" />
                    {slideAnalysisLoading ? tr('Đang tạo nội dung giảng...', 'Generating teaching content...', '正在生成教学内容...', '授業内容を生成中...', '수업 내용 생성 중...') : tr('Xem slide (NanoAI)', 'View slides (NanoAI)', '查看幻灯片 (NanoAI)', 'スライド表示 (NanoAI)', '슬라이드 보기 (NanoAI)')}
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
                {curriculumId && curriculumEditMode && (
                  <div className="mb-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium block mb-1 text-amber-700 dark:text-amber-300">
                          {tr('Dữ liệu cần sửa', 'Data to edit', '要编辑的数据', '編集するデータ', '편집할 데이터')}
                        </label>
                        <Textarea
                          value={editOriginalText}
                          onChange={(e) => {
                            setEditOriginalText(e.target.value)
                            setEditEditedText('')
                            setEditCompareResult(null)
                            setEditCompareErrors([])
                          }}
                          placeholder={tr('Gõ đoạn ngắn để tìm...', 'Type short segment to find...', '输入短段落查找...', '短い段落を入力...', '짧은 단락 입력...')}
                          className="min-h-[60px] text-sm border border-amber-400/80 dark:border-amber-500/80 rounded-md px-2.5 py-2 bg-amber-50/40 dark:bg-amber-950/20"
                          spellCheck={false}
                        />
                        {editMatchStatus === 'found' && (
                          <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">✓ {tr('Đã tìm thấy 1 đoạn (bôi màu)', 'Found 1 segment (highlighted)', '已找到1段（高亮）', '1箇所見つかりました', '1개 찾음 (강조)')}</p>
                        )}
                        {editMatchStatus === 'multiple' && (
                          <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">⚠ {editMatchCount} {tr('đoạn trùng', 'matches', '个相同', '箇所一致', '개 일치')}</p>
                        )}
                        {editMatchStatus === 'not_found' && editOriginalText.trim().length >= 3 && (
                          <p className="mt-0.5 text-xs text-destructive">✗ {tr('Không tìm thấy', 'Not found', '未找到', '見つかりません', '찾을 수 없음')}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs font-medium block mb-1 text-emerald-700 dark:text-emerald-300">
                          {tr('Dữ liệu sẽ sửa thành', 'Data to replace with', '将替换为', '置換後', '다음으로 수정')}
                        </label>
                        <Textarea
                          value={editEditedText}
                          onChange={(e) => {
                            setEditEditedText(e.target.value)
                            setEditCompareResult(null)
                            setEditCompareErrors([])
                          }}
                          placeholder={tr('Gõ nội dung mới...', 'Type new content...', '输入新内容...', '新しい内容を入力...', '새 내용 입력...')}
                          className="min-h-[60px] text-sm border border-emerald-400/80 dark:border-emerald-500/80 rounded-md px-2.5 py-2 bg-emerald-50/40 dark:bg-emerald-950/20"
                          spellCheck={false}
                          disabled={editMatchStatus !== 'found' || editMatchCount !== 1}
                        />
                        {(editMatchStatus !== 'found' || editMatchCount !== 1) && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{tr('Tìm thấy 1 đoạn trước', 'Find 1 segment first', '先找到1段', '1箇所見つけてから', '1개 찾은 후')}</p>
                        )}
                      </div>
                    </div>
                    {editCompareLoading && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 animate-pulse">{tr('Đang hỏi 2 AI...', 'Asking 2 AIs...', '正在请2个AI...', '2つのAIに依頼中...', '2개 AI 요청 중...')}</p>
                    )}
                    {editCompareResult && editCompareResult.bothAgree === true && (
                      <div className={`rounded-md border p-2 text-xs ${editCompareResult.correctVersion === 'edited' ? 'border-emerald-400/80 bg-emerald-50/60 dark:bg-emerald-950/20' : 'border-amber-400/80 bg-amber-50/60 dark:bg-amber-950/20'}`}>
                        <span className={`font-medium ${editCompareResult.correctVersion === 'edited' ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                          {editCompareResult.correctVersion === 'edited' ? tr('Đã lưu', 'Saved', '已保存', '保存しました', '저장됨') : tr('Chưa lưu – Giữ bản gốc', 'Not saved – Keep original', '未保存–保留原文', '保存せず–元のまま', '저장 안 함–원본 유지')}
                        </span>
                        <span className={`ml-1 ${editCompareResult.correctVersion === 'edited' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {editCompareResult.correctVersion === 'edited' ? (editCompareResult.reasonSaved || editCompareResult.explanation || '') : (editCompareResult.reasonNotSaved || editCompareResult.explanation || '')}
                        </span>
                      </div>
                    )}
                    {editCompareResult && editCompareResult.bothAgree === false && (
                      <div className="rounded-md border border-amber-400/80 p-2 bg-amber-50/60 dark:bg-amber-950/20">
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">
                          {tr('Mỗi AI ý kiến khác – cần admin', 'Each AI different – admin needed', '各AI意见不同–需管理员', '各AI異なる–管理者必要', '각 AI 다름–관리자 필요')}
                        </p>
                        {(editCompareResult.model1Version || editCompareResult.model2Version) && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400 mb-1">Gemini: {editCompareResult.model1Version || '–'} · DeepSeek: {editCompareResult.model2Version || '–'}</p>
                        )}
                        {editCompareErrors.length > 0 && (
                          <ul className="text-xs text-amber-700 dark:text-amber-300 list-disc list-inside mb-2 space-y-0.5">
                            {editCompareErrors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        )}
                        <Button variant="outline" size="sm" onClick={() => void handleEscalateToAdmin(editCompareErrors)} disabled={escalateLoading} className="h-7 text-xs border-amber-500/80">
                          {escalateLoading ? tr('Đang gửi...', 'Sending...', '发送中...', '送信中...', '전송 중...') : tr('Gửi admin xem xét', 'Send to admin', '发送给管理员', '管理者に送信', '관리자 검토 요청')}
                        </Button>
                      </div>
                    )}
                    <Button
                      onClick={() => void runEditCompare()}
                      disabled={editCompareLoading || editMatchStatus !== 'found' || editMatchCount !== 1 || !editEditedText.trim()}
                      className="w-full h-9 text-sm bg-amber-600 hover:bg-amber-700"
                    >
                      {editCompareLoading ? tr('Đang kiểm tra...', 'Checking...', '正在检查...', '確認中...', '확인 중...') : tr('Áp dụng sửa', 'Apply edit', '应用修改', '編集を適用', '편집 적용')}
                    </Button>
                  </div>
                )}
                <div className="rounded-md border bg-slate-50 dark:bg-slate-900/50 p-3 overflow-auto max-h-[50vh]">
                  {curriculumId && curriculumEditMode ? (
                    <pre className="w-full min-h-[120px] text-sm font-sans leading-relaxed whitespace-pre-wrap break-words bg-transparent">
                      {(() => {
                        const { parts } = highlightMatchInCurriculum(curriculumMarkdown, editOriginalText)
                        return parts.map((p, i) =>
                          p.highlight ? (
                            <mark key={i} className="bg-amber-300/70 dark:bg-amber-500/50 rounded px-0.5">
                              {p.text}
                            </mark>
                          ) : (
                            <span key={i}>{p.text}</span>
                          )
                        )
                      })()}
                    </pre>
                  ) : (
                    <textarea
                      ref={curriculumTextareaRef}
                      value={curriculumMarkdown}
                      onChange={handleCurriculumChange}
                      readOnly={!!curriculumId && !curriculumEditMode}
                      className={`w-full min-h-[120px] text-sm font-sans leading-relaxed prose prose-slate dark:prose-invert max-w-none bg-transparent border-0 resize-y focus:outline-none focus:ring-0 ${curriculumId && !curriculumEditMode ? 'cursor-not-allowed opacity-95' : ''}`}
                      placeholder={tr('Nội dung giáo trình...', 'Curriculum content...', '课程内容...', 'カリキュラム内容...', '교육과정 내용...')}
                      spellCheck={false}
                      title={curriculumId && !curriculumEditMode ? tr('Bấm "Sửa giáo trình" để chỉnh sửa.', 'Click "Edit curriculum" to edit.', '点击"编辑课程"进行编辑。', '「教材を編集」をクリックして編集。', '"교육과정 편집" 클릭하여 편집.') : undefined}
                    />
                  )}
                </div>
                {!curriculumEditMode && (regionPreview || regionCheckLoading || regionCompareResult) && (
                  <div className="mt-2 rounded-md border border-amber-300/80 dark:border-amber-600/80 bg-amber-50/50 dark:bg-amber-950/20 p-2">
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">
                      {regionCheckLoading
                        ? regionCharCount != null
                          ? tr(`Đang gửi ~${regionCharCount} ký tự quanh vị trí con trỏ...`, `Sending ~${regionCharCount} chars around cursor...`, `正在发送光标位置~${regionCharCount}字符...`, `カーソル位置~${regionCharCount}文字を送信中...`, `커서 위치 ~${regionCharCount}자 전송 중...`)
                          : tr('Đang kiểm tra đoạn vừa sửa...', 'Checking edited region...', '正在检查编辑区域...', '編集箇所を確認中...', '편집 영역 확인 중...')
                        : tr('Kết quả so sánh AI:', 'AI comparison result:', 'AI比较结果：', 'AI比較結果：', 'AI 비교 결과:')}
                    </p>
                    {regionCompareResult && (
                      <div className="space-y-2 text-sm mb-2">
                        {regionCompareResult.originalReason && (
                          <p className="text-amber-700 dark:text-amber-300">
                            <span className="font-medium">{tr('Bản gốc sai:', 'Original wrong:', '原文错误：', '元が誤り：', '원본 오류:')}</span> {regionCompareResult.originalReason}
                          </p>
                        )}
                        {regionCompareResult.editedReason && (
                          <p className="text-amber-700 dark:text-amber-300">
                            <span className="font-medium">{tr('Bản sửa sai:', 'Edited wrong:', '修改错误：', '編集が誤り：', '수정 오류:')}</span> {regionCompareResult.editedReason}
                          </p>
                        )}
                        {regionCompareResult.explanation && (
                          <p className="text-emerald-700 dark:text-emerald-300 font-medium">
                            {regionCompareResult.explanation}
                          </p>
                        )}
                      </div>
                    )}
                    {regionPreview && (
                      <div className="grid gap-2 text-xs">
                        {regionPreview.original && (
                          <div>
                            <span className="text-muted-foreground">{tr('Gốc:', 'Original:', '原文：', '元：', '원본:')}</span>
                            <pre className="mt-0.5 rounded bg-white/80 dark:bg-black/20 p-2 max-h-20 overflow-y-auto whitespace-pre-wrap break-words">
                              {regionPreview.original.slice(0, 200)}
                              {regionPreview.original.length > 200 ? '...' : ''}
                            </pre>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground">{tr('Mới sửa:', 'Edited:', '修改后：', '編集後：', '수정:')}</span>
                          <pre className="mt-0.5 rounded bg-amber-100/80 dark:bg-amber-900/30 p-2 max-h-20 overflow-y-auto whitespace-pre-wrap break-words">
                            {regionPreview.edited.slice(0, 200)}
                            {regionPreview.edited.length > 200 ? '...' : ''}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {!curriculumEditMode && regionCheckErrors.length > 0 && regionCompareResult?.bothAgree === false && (
                  <div className="mt-2 rounded-md border border-amber-400/80 p-2 bg-amber-50/80 dark:bg-amber-950/30">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                      {tr('Mỗi AI đưa ra ý kiến khác nhau – cần admin xem xét', 'Each AI gave different opinion – admin review needed', '每个AI意见不同–需管理员审核', '各AIが異なる意見–管理者確認必要', '각 AI가 다른 의견–관리자 검토 필요')}
                    </p>
                    {(regionCompareResult.model1Version || regionCompareResult.model2Version) && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                        Gemini: {regionCompareResult.model1Version === 'original' ? tr('bản gốc', 'original', '原文', '元', '원본') : regionCompareResult.model1Version === 'edited' ? tr('bản sửa', 'edited', '修改', '編集', '수정') : regionCompareResult.model1Version || '–'} · DeepSeek: {regionCompareResult.model2Version === 'original' ? tr('bản gốc', 'original', '原文', '元', '원본') : regionCompareResult.model2Version === 'edited' ? tr('bản sửa', 'edited', '修改', '編集', '수정') : regionCompareResult.model2Version || '–'}
                      </p>
                    )}
                    <ul className="text-sm text-amber-700 dark:text-amber-300 list-disc list-inside space-y-1 mb-3">
                      {regionCheckErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleEscalateToAdmin(regionCheckErrors)}
                      disabled={escalateLoading}
                      className="border-amber-500 text-amber-700 hover:bg-amber-100 dark:border-amber-400 dark:text-amber-300 dark:hover:bg-amber-900/50"
                    >
                      {escalateLoading ? tr('Đang gửi...', 'Sending...', '发送中...', '送信中...', '전송 중...') : tr('Gửi admin xem xét', 'Send to admin for review', '发送给管理员审核', '管理者に送信して確認', '관리자에게 검토 요청')}
                    </Button>
                  </div>
                )}
              </CardContent>
              {curriculumWorksheets.length > 0 && (
                <CardContent className="pt-0 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    {tr('Phiếu bài tập thuộc giáo trình', 'Worksheets in this curriculum', '本课程练习', 'このカリキュラムのワークシート', '이 교육과정의 워크시트')} ({curriculumWorksheets.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {curriculumWorksheets.map((w) => (
                      <Button
                        key={w.id}
                        variant={worksheetId === w.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleLoadWorksheetFromCurriculum(w)}
                        className={worksheetId === w.id ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
                        {w.topic}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              )}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-lg border bg-violet-50/70 dark:bg-violet-950/25 p-3">
                      <p className="text-xs font-semibold mb-2 text-violet-700 dark:text-violet-300">
                        {tr('Phần trắc nghiệm', 'Quiz section', '选择题部分', 'クイズ部分', '퀴즈 섹션')}
                      </p>
                      <Textarea
                        value={worksheetParts.quiz}
                        readOnly
                        className="w-full min-h-[180px] text-sm font-sans leading-relaxed bg-transparent border-0 resize-y focus:outline-none focus:ring-0"
                        placeholder={tr('Chưa có phần trắc nghiệm', 'No quiz section', '暂无选择题部分', 'クイズ部分がありません', '퀴즈 섹션 없음')}
                        spellCheck={false}
                      />
                    </div>
                    <div className="rounded-lg border bg-emerald-50/70 dark:bg-emerald-950/20 p-3">
                      <p className="text-xs font-semibold mb-2 text-emerald-700 dark:text-emerald-300">
                        {tr('Phần tự luận', 'Essay section', '主观题部分', '記述式部分', '서술형 섹션')}
                      </p>
                      <Textarea
                        value={worksheetParts.essay}
                        readOnly
                        className="w-full min-h-[180px] text-sm font-sans leading-relaxed bg-transparent border-0 resize-y focus:outline-none focus:ring-0"
                        placeholder={tr('Chưa có phần tự luận', 'No essay section', '暂无主观题部分', '記述式部分がありません', '서술형 섹션 없음')}
                        spellCheck={false}
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border bg-slate-50 dark:bg-slate-900/50 p-4 overflow-auto max-h-[60vh]">
                    <p className="text-xs font-semibold mb-2 text-slate-600 dark:text-slate-300">
                      {tr('Toàn bộ phiếu bài tập (có thể chỉnh sửa)', 'Full worksheet (editable)', '完整练习（可编辑）', 'ワークシート全体（編集可）', '전체 워크시트(편집 가능)')}
                    </p>
                    <textarea
                      ref={worksheetTextareaRef}
                      value={worksheetMarkdown}
                      onChange={(e) => setWorksheetMarkdown(e.target.value)}
                      className="w-full min-h-[200px] text-sm font-sans leading-relaxed prose prose-slate dark:prose-invert max-w-none bg-transparent border-0 resize-y focus:outline-none focus:ring-0"
                      placeholder={tr('Nội dung phiếu bài tập...', 'Worksheet content...', '练习内容...', 'ワークシート内容...', '워크시트 내용...')}
                      spellCheck={false}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

          </>
        )}
        </div>
      </div>
    </>
  )
}
