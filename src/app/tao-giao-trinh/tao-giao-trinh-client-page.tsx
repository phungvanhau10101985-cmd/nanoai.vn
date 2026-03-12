'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
import { createCurriculum, createWorksheet, saveCurriculum, saveTextbookLessonFromImage, listCurricula, getCurriculumById, getWorksheetById, getWorksheetsByCurriculumId, deleteCurriculum, saveSlidesToCurriculum, getSlidesByCurriculumId, getOriginalSlides, getUserCustomizedSlides, saveOriginalSlidesIfNotExists, checkCurriculumExists, recordCurriculumOpen } from './actions'

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

type Step = 'INPUT' | 'GENERATING' | 'RESULT'
export default function TaoGiaoTrinhClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [step, setStep] = useState<Step>('INPUT')
  const [subjectId, setSubjectId] = useState('toan')
  const [gradeLevelId, setGradeLevelId] = useState('lop-12')
  const [textbookSetId, setTextbookSetId] = useState('ket-noi-tri-thuc')
  const [textbookVolume, setTextbookVolume] = useState<string>('')
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
  const [curriculaList, setCurriculaList] = useState<Array<{ id: string; topic: string; subject_id: string; grade_level_id: string; textbook_set_id?: string; lesson_type_id?: string; num_lessons?: number; lesson_duration_minutes?: number; created_at: string }>>([])
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
  const [checkLoading, setCheckLoading] = useState(false)
  const [lessonImages, setLessonImages] = useState<File[]>([])
  const lessonImageInputRef = useRef<HTMLInputElement>(null)
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
      })
    } catch {
      return ''
    }
  }

  const displayTopic = topic.trim() || `Bài ${lessonNumber}`

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
        if (curRes && 'items' in curRes) setCurriculaList(curRes.items)
        else setCurriculaList([])
      })
      .catch(() => setCurriculaList([]))
      .finally(() => setBrowseLoading(false))
  }, [showBrowse, browseSubjectFilter, browseGradeFilter])

  useEffect(() => {
    const num = parseInt(lessonNumber, 10)
    if (!num || num < 1 || num > 999) {
      setCurriculumExists(null)
      setExistingCurriculumId(null)
      setExistingCurriculumTopic(null)
      return
    }
    let cancelled = false
    setCheckLoading(true)
    checkCurriculumExists({
      subjectId,
      gradeLevelId,
      textbookSetId,
      lessonNumber: num,
      numLessons,
      lessonDurationMinutes,
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
      })
      .catch(() => {
        if (!cancelled) {
          setCurriculumExists(null)
          setExistingCurriculumId(null)
          setExistingCurriculumTopic(null)
        }
      })
      .finally(() => {
        if (!cancelled) setCheckLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [subjectId, gradeLevelId, textbookSetId, lessonNumber, numLessons, lessonDurationMinutes])

  const handleLoadExistingCurriculum = async () => {
    if (!existingCurriculumId) return
    await handleLoadCurriculum(existingCurriculumId)
  }

  const handleSubmitFromImage = async () => {
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
      const finalLessonNum = typeof extractedNum === 'number' && extractedNum >= 1 && extractedNum <= 999 ? String(extractedNum) : lessonNumber
      const finalTopic = t || extractedTitle || `Bài ${finalLessonNum}`
      setCurriculumMarkdown(md)
      setTopic(finalTopic)
      const saveFd = new FormData()
      saveFd.append('curriculumMarkdown', md)
      saveFd.append('topic', finalTopic)
      saveFd.append('subjectId', subjectId)
      saveFd.append('gradeLevelId', gradeLevelId)
      saveFd.append('textbookSetId', textbookSetId)
      saveFd.append('textbookVolume', '')
      saveFd.append('lessonNumber', finalLessonNum)
      saveFd.append('lessonTypeId', 'hinh-thanh-kien-thuc')
      saveFd.append('numLessons', String(numLessons))
      saveFd.append('lessonDurationMinutes', String(lessonDurationMinutes))
      saveFd.append('goals', goals)
      const saveRes = await saveCurriculum(saveFd)
      if (saveRes?.success && saveRes.curriculumId) {
        setCurriculumId(saveRes.curriculumId)
        setStep('RESULT')
        toast({ title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'), description: tr('Giáo trình và giáo án đã tạo từ ảnh.', 'Curriculum and slides created from image.', '已从图片创建课程和教案。', '画像からカリキュラムとスライドを作成しました。', '이미지에서 교육과정과 슬라이드 생성됨.'), duration: 3000 })
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
    const num = parseInt(lessonNumber, 10)
    if (!num || num < 1 || num > 999) {
      toast({
        title: tr('Thiếu thông tin', 'Missing information', '缺少信息', '情報不足', '정보 누락'),
        description: tr('Vui lòng nhập bài số (1–999).', 'Please enter lesson number (1–999).', '请输入课号（1–999）。', '課番号（1–999）を入力してください。', '차시 번호(1–999)를 입력해 주세요.'),
        variant: 'destructive',
      })
      return
    }
    if (curriculumExists && existingCurriculumId) {
      await handleLoadExistingCurriculum()
      return
    }
    if (curriculumExists === false) {
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
    setStep('GENERATING')
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const formData = new FormData()
    formData.append('subjectId', subjectId)
    formData.append('gradeLevelId', gradeLevelId)
    formData.append('textbookSetId', textbookSetId)
    formData.append('textbookVolume', textbookVolume.trim())
    formData.append('lessonNumber', lessonNumber.trim())
    formData.append('lessonTypeId', lessonTypeId)
    formData.append('topic', displayTopic)
    formData.append('numLessons', String(numLessons))
    formData.append('lessonDurationMinutes', String(lessonDurationMinutes))
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
      const newCurriculumId = result.curriculumId ?? null
      setCurriculumId(newCurriculumId)
      setStep('RESULT')
      if (result.matched) {
        toast({
          title: tr('Đã tìm thấy giáo trình tương ứng', 'Matching curriculum found', '找到匹配课程', '一致するカリキュラムを発見', '일치하는 교육과정 발견'),
          description: tr('Sử dụng bản có sẵn trong kho.', 'Using existing curriculum from library.', '使用库中现有课程。', 'ライブラリの既存を使用。', '라이브러리 기존 사용.'),
          duration: 3000,
        })
      } else if (result.saveFailed) {
        toast({
          title: tr('Giáo trình đã tạo', 'Curriculum created', '课程已创建', 'カリキュラム作成', '교육과정 생성'),
          description: tr('Chưa lưu vào kho. Bấm "Lưu vào kho" để lưu.', 'Not saved to library. Click "Save to library" to save.', '未保存到库。点击"保存到库"保存。', 'ライブラリに未保存。「保存」をクリック。', '라이브러리에 미저장. "저장" 클릭.'),
          variant: 'default',
          duration: 5000,
        })
      } else {
        toast({
          title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'),
          description: tr('Giáo trình đã được tạo và lưu.', 'Curriculum created and saved.', '课程已创建并保存。', 'カリキュラムを作成・保存しました。', '교육과정 생성 및 저장됨.'),
          duration: 3000,
        })
      }
      // Tự động tạo slide và lưu DB – giáo viên sau mở sẵn, không cần gọi AI
      if (newCurriculumId && !result.matched) {
        void (async () => {
          try {
            const res = await fetch('/api/curriculum-analyze-slides', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                curriculumMarkdown: result.curriculumMarkdown,
                topic: displayTopic,
              }),
            })
            const data = await res.json().catch(() => ({}))
            if (res.ok && Array.isArray(data?.slides) && data.slides.length > 0) {
              const slides = data.slides as AISlideData[]
              setCurriculumSlides(slides)
              await saveSlidesToCurriculum({
                curriculumId: newCurriculumId,
                topic: displayTopic,
                subjectId,
                gradeLevelId,
                slides,
              })
              await saveOriginalSlidesIfNotExists({ curriculumId: newCurriculumId, slides })
            }
          } catch (e) {
            console.warn('[auto-slides] Lỗi:', e)
          }
        })()
      }
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

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== 'request-curriculum') return
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
  }, [curriculumMarkdown, displayTopic, curriculumId, aiSlides, curriculumSlides, slideVersionChoice, originalSlides, sharedSlides])

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
    setWorksheetMarkdown('')
    setWorksheetId(null)
    setWorksheetQrDataUrl(null)
    setCurriculumWorksheets([])
    setCurriculumSlides(null)
    setAiSlides(null)
    setLessonImages([])
    if (lessonImageInputRef.current) lessonImageInputRef.current.value = ''
  }

  const [saveCurriculumLoading, setSaveCurriculumLoading] = useState(false)
  const handleSaveCurriculum = async () => {
    if (!curriculumMarkdown.trim()) return
    setSaveCurriculumLoading(true)
    const formData = new FormData()
    formData.append('curriculumMarkdown', curriculumMarkdown)
    formData.append('topic', displayTopic)
    formData.append('subjectId', subjectId)
    formData.append('gradeLevelId', gradeLevelId)
    formData.append('textbookSetId', textbookSetId)
    formData.append('textbookVolume', textbookVolume.trim())
    formData.append('lessonNumber', lessonNumber.trim())
    formData.append('lessonTypeId', lessonTypeId)
    formData.append('numLessons', String(numLessons))
    formData.append('lessonDurationMinutes', String(lessonDurationMinutes))
    formData.append('goals', goals)
    const result = await saveCurriculum(formData)
    setSaveCurriculumLoading(false)
    if (result.error) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: result.error, variant: 'destructive' })
    } else if (result.success && result.curriculumId) {
      const newId = result.curriculumId
      setCurriculumId(newId)
      if (curriculumSlides && curriculumSlides.length > 0) {
        saveSlidesToCurriculum({ curriculumId: newId, topic: displayTopic, subjectId, gradeLevelId, slides: curriculumSlides }).catch(() => {})
      }
      toast({ title: tr('Đã lưu vào kho', 'Saved to library', '已保存到库', 'ライブラリに保存', '라이브러리에 저장됨'), duration: 2000 })
    }
  }

  const handleLoadCurriculum = async (id: string) => {
    const result = await getCurriculumById(id)
    if (result.error) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: result.error, variant: 'destructive' })
      return
    }
    if (result.success && result.curriculum) {
      const c = result.curriculum as { id?: string; topic?: string; subject_id?: string; grade_level_id?: string; textbook_set_id?: string; textbook_volume?: string | null; lesson_number?: number | null; lesson_type_id?: string; num_lessons?: number; lesson_duration_minutes?: number; goals?: string; content_markdown?: string }
      setSubjectId(c.subject_id ?? 'toan')
      setGradeLevelId(normalizeGradeLevelId(c.grade_level_id ?? 'lop-12'))
      setTextbookSetId(c.textbook_set_id ?? 'ket-noi-tri-thuc')
      setTextbookVolume(c.textbook_volume ?? '')
      setTopic(c.topic ?? '')
      setLessonNumber(c.lesson_number != null ? String(c.lesson_number) : '1')
      setLessonTypeId(c.lesson_type_id ?? 'hinh-thanh-kien-thuc')
      setNumLessons(c.num_lessons ?? 3)
      setLessonDurationMinutes(c.lesson_duration_minutes ?? 45)
      setGoals(c.goals ?? '')
      setCurriculumMarkdown(c.content_markdown ?? '')
      setCurriculumId(c.id ?? null)
      setWorksheetMarkdown('')
      setWorksheetId(null)
      setWorksheetQrDataUrl(null)
      setStep('RESULT')
      setShowBrowse(false)
      setAiSlides(null)
      const wsRes = await getWorksheetsByCurriculumId(id)
      if (wsRes && 'items' in wsRes) setCurriculumWorksheets(wsRes.items)
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
          const c = curRes.curriculum as { textbook_set_id?: string; textbook_volume?: string | null; lesson_number?: number | null; lesson_type_id?: string; num_lessons?: number; lesson_duration_minutes?: number; goals?: string; content_markdown?: string; topic?: string }
          setTextbookSetId(c.textbook_set_id ?? 'ket-noi-tri-thuc')
          setTextbookVolume(c.textbook_volume ?? '')
          setTopic(c.topic ?? '')
          setLessonNumber(c.lesson_number != null ? String(c.lesson_number) : '1')
          setLessonTypeId(c.lesson_type_id ?? 'hinh-thanh-kien-thuc')
          setNumLessons(c.num_lessons ?? 3)
          setLessonDurationMinutes(c.lesson_duration_minutes ?? 45)
          setGoals(c.goals ?? '')
          setCurriculumMarkdown(c.content_markdown ?? '')
        }
        if (wsRes && 'items' in wsRes) setCurriculumWorksheets(wsRes.items)
        else setCurriculumWorksheets([])
        if (slidesRes?.success && slidesRes.slides) setCurriculumSlides(slidesRes.slides)
        else setCurriculumSlides(null)
      } else {
        setCurriculumMarkdown('')
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
        if (wsRes && 'items' in wsRes) setCurriculumWorksheets(wsRes.items)
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
                {tr('Chọn môn, lớp, sách, bài số (1–100). AI tạo giáo trình Markdown.', 'Select subject, grade, textbook, lesson number (1–100). AI generates Markdown curriculum.', '选择科目、年级、教材、课号（1–100）。AI 生成 Markdown 课程。', '科目・学年・教科書・課番号（1–100）を選択。AIがMarkdownカリキュラムを生成。', '과목·학년·교과서·차시(1–100) 선택. AI가 Markdown 교육과정 생성.')}
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
                <label className="text-xs font-medium text-muted-foreground">{tr('Mục tiêu bổ sung (tùy chọn)', 'Additional goals (optional)', '补充目标（可选）', '追加目標（任意）', '추가 목표 (선택)')}</label>
                <Textarea
                  placeholder={tr('Mô tả mục tiêu, yêu cầu đặc biệt...', 'Describe goals, special requirements...', '描述目标、特殊要求...', '目標・特別な要件を記述...', '목표, 특별 요구사항 설명...')}
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  className="bg-white/80 min-h-[80px] resize-y"
                />
              </div>
              {curriculumExists === true && existingCurriculumTopic && (
                <div className="space-y-2 rounded-lg border border-emerald-300 dark:border-emerald-700 p-4 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                    {tr('Bài học có sẵn:', 'Lesson available:', '已有课程：', 'レッスンあり：', '수업 있음:')}
                  </p>
                  <p className="text-base font-semibold text-emerald-900 dark:text-emerald-100">
                    {existingCurriculumTopic}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tr('Chọn nút bên dưới để xem giáo trình.', 'Click the button below to view curriculum.', '点击下方按钮查看课程。', '下のボタンをクリックしてカリキュラムを表示。', '아래 버튼을 클릭하여 교육과정 보기.')}
                  </p>
                </div>
              )}
              {curriculumExists === false && (
                <div className="space-y-2 rounded-lg border border-dashed border-violet-300 dark:border-violet-700 p-4 bg-violet-50/50 dark:bg-violet-950/20">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <ImageIcon className="h-4 w-4" />
                    {tr('Gửi ảnh bài học', 'Upload lesson image', '上传课程图片', '授業画像をアップロード', '수업 이미지 업로드')}
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {tr('Chưa có giáo trình trong kho. Chụp/gửi ảnh trang sách (tối đa 10 ảnh).', 'No curriculum in library. Upload photo(s) of the textbook page(s) (max 10).', '库中无课程。请上传教材页面照片（最多10张）。', 'ライブラリにありません。教科書のページ写真をアップロード（最大10枚）。', '라이브러리에 없습니다. 교과서 페이지 사진 업로드 (최대 10개).')}
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
              <Button
                onClick={() => void handleSubmit()}
                disabled={step === 'GENERATING' || checkLoading || curriculumExists === null || (curriculumExists === false && lessonImages.length === 0)}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {checkLoading
                  ? tr('Đang kiểm tra...', 'Checking...', '正在检查...', '確認中...', '확인 중...')
                  : curriculumExists
                    ? tr('Xem giáo trình', 'View curriculum', '查看课程', 'カリキュラムを見る', '교육과정 보기')
                    : tr('Tạo giáo trình', 'Create curriculum', '创建课程', 'カリキュラムを作成', '교육과정 생성')}
              </Button>
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
                <CardTitle className="text-base">{tr('Giáo trình đã tạo', 'Generated curriculum', '已创建课程', '作成したカリキュラム', '생성된 교육과정')}</CardTitle>
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
                <div className="rounded-lg border bg-slate-50 dark:bg-slate-900/50 p-4 overflow-auto max-h-[60vh]">
                  <textarea
                    ref={curriculumTextareaRef}
                    value={curriculumMarkdown}
                    onChange={(e) => setCurriculumMarkdown(e.target.value)}
                    readOnly={!!curriculumId}
                    className={`w-full min-h-[200px] text-sm font-sans leading-relaxed prose prose-slate dark:prose-invert max-w-none bg-transparent border-0 resize-y focus:outline-none focus:ring-0 ${curriculumId ? 'cursor-not-allowed opacity-95' : ''}`}
                    placeholder={tr('Nội dung giáo trình...', 'Curriculum content...', '课程内容...', 'カリキュラム内容...', '교육과정 내용...')}
                    spellCheck={false}
                    title={curriculumId ? tr('Giáo trình đã lưu, không cho sửa.', 'Curriculum saved, editing disabled.', '课程已保存，不可编辑。', '保存済み、編集不可。', '저장됨, 편집 불가.') : undefined}
                  />
                </div>
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
                  <div className="rounded-lg border bg-slate-50 dark:bg-slate-900/50 p-4 overflow-auto max-h-[60vh]">
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
