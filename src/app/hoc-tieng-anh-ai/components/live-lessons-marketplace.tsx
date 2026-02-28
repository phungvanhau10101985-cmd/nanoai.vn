'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import {
  assistLiveLessonWord,
  chatWithCoach,
  createLiveLessonFromSession,
  getHistorySessions,
  getLiveLessonDetail,
  listLiveLessons,
  matchLiveLessonTurn,
  pickRandomLiveLesson,
  publishLiveLesson,
  purchaseLiveLesson,
  validateLiveLessonPublish,
} from '../services/english-coach-api'
import { LIVE_GOAL_OPTIONS, LIVE_TOPIC_OPTIONS } from '../constants/live-topic-catalog'

type LessonItem = {
  id: string
  title: string
  topicId?: string
  topicLabel?: string
  targetLanguage?: string
  nativeLanguage?: string
  teacherGender?: 'male' | 'female' | 'unknown'
  teacherLabel?: string
  teacherLocale?: string
  qualityScore: number
  priceCredits: number
  turnsCount: number
  status: 'draft' | 'published' | 'archived'
  approved?: boolean
  salesCount?: number
  purchased?: boolean
  isOwner?: boolean
}

type LessonTurn = {
  turnIndex: number
  sourceStudentText?: string
  expectedStudentText: string
  teacherReplyText: string
  teacherAudioUrl?: string
  teacherCorrectionNote?: string
  teacherMainSentence?: string
  teacherIntentAnswer?: string
  teacherTranslation?: string
  teacherTokensJson?: string
  teacherWritingTaskJson?: string
}

type HistorySessionItem = {
  sessionId: string
}

function toLanguageCode(language: string): 'en' | 'vi' | 'zh' | 'ja' | 'ko' | 'th' | 'hi' {
  const normalized = String(language || '').toLowerCase()
  if (normalized.includes('vietnam')) return 'vi'
  if (normalized.includes('chinese') || normalized.includes('mandarin')) return 'zh'
  if (normalized.includes('japanese')) return 'ja'
  if (normalized.includes('korean')) return 'ko'
  if (normalized.includes('thai')) return 'th'
  if (normalized.includes('hindi')) return 'hi'
  return 'en'
}

export function LiveLessonsMarketplace() {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const [historySessions, setHistorySessions] = useState<HistorySessionItem[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [lessonTitle, setLessonTitle] = useState('')
  const [lessonPrice, setLessonPrice] = useState('1')

  const [myLessons, setMyLessons] = useState<LessonItem[]>([])
  const [marketLessons, setMarketLessons] = useState<LessonItem[]>([])
  const [studyMode, setStudyMode] = useState<'sample' | 'ai'>('sample')
  const [filterTopicId, setFilterTopicId] = useState(LIVE_TOPIC_OPTIONS[0].id)
  const [useCustomTopic, setUseCustomTopic] = useState(false)
  const [customTopicId, setCustomTopicId] = useState('')
  const [customTopicLabel, setCustomTopicLabel] = useState('')
  const [filterTargetLanguage, setFilterTargetLanguage] = useState('English')
  const [filterNativeLanguage, setFilterNativeLanguage] = useState('Vietnamese')
  const [filterLearnerLevel, setFilterLearnerLevel] = useState<'0' | '1' | '2' | '3' | '4'>('1')
  const [filterGoalType, setFilterGoalType] = useState(LIVE_GOAL_OPTIONS[0].id)
  const [filterDurationBucket, setFilterDurationBucket] = useState<'short' | 'medium' | 'long'>('medium')

  const [selectedLessonId, setSelectedLessonId] = useState('')
  const [selectedLesson, setSelectedLesson] = useState<(LessonItem & { locked?: boolean }) | null>(null)
  const [selectedTurns, setSelectedTurns] = useState<LessonTurn[]>([])

  const [currentTurnIndex, setCurrentTurnIndex] = useState(0)
  const [answerText, setAnswerText] = useState('')
  const [matchInfo, setMatchInfo] = useState<{ matched: boolean; similarity: number } | null>(null)
  const [teacherReply, setTeacherReply] = useState('')
  const [matchedTeacherDetail, setMatchedTeacherDetail] = useState<{
    correctionNote?: string
    mainSentence?: string
    intentAnswer?: string
  } | null>(null)
  const [assistWord, setAssistWord] = useState('')
  const [assistResult, setAssistResult] = useState<{
    source: string
    meaning: string
    pronunciation?: string
    exampleTarget?: string
    exampleNative?: string
  } | null>(null)
  const [publishIssuesByLessonId, setPublishIssuesByLessonId] = useState<Record<string, string[]>>({})
  const effectiveTopicId = useMemo(() => {
    if (useCustomTopic) return customTopicId.trim()
    return filterTopicId
  }, [useCustomTopic, customTopicId, filterTopicId])
  const effectiveTopicLabel = useMemo(() => {
    if (useCustomTopic) return customTopicLabel.trim() || customTopicId.trim()
    const option = LIVE_TOPIC_OPTIONS.find((x) => x.id === filterTopicId)
    return option?.label || filterTopicId
  }, [useCustomTopic, customTopicLabel, customTopicId, filterTopicId])

  const refresh = useCallback(async () => {
    const [historyRes, mineRes, marketRes] = await Promise.all([
      getHistorySessions(30),
      listLiveLessons({ limit: 30, mine: true }),
      listLiveLessons({
        limit: 40,
        topicId: effectiveTopicId,
        targetLanguage: filterTargetLanguage,
        nativeLanguage: filterNativeLanguage,
        learnerLevel: Number(filterLearnerLevel),
        goalType: filterGoalType,
        durationBucket: filterDurationBucket,
      }),
    ])

    if (historyRes.ok) {
      const items = Array.isArray(historyRes.data?.sessions) ? (historyRes.data.sessions as HistorySessionItem[]) : []
      setHistorySessions(items)
      if (!selectedSessionId && items[0]?.sessionId) setSelectedSessionId(String(items[0].sessionId))
    }
    if (mineRes.ok) {
      setMyLessons((Array.isArray(mineRes.data?.items) ? mineRes.data.items : []) as LessonItem[])
    }
    if (marketRes.ok) {
      setMarketLessons((Array.isArray(marketRes.data?.items) ? marketRes.data.items : []) as LessonItem[])
    }
  }, [selectedSessionId, effectiveTopicId, filterTargetLanguage, filterNativeLanguage, filterLearnerLevel, filterGoalType, filterDurationBucket])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const selectedTurn = useMemo(() => selectedTurns.find((x) => x.turnIndex === currentTurnIndex) || null, [selectedTurns, currentTurnIndex])

  const openLesson = useCallback(async (lessonId: string) => {
    setBusy(true)
    setMatchInfo(null)
    setTeacherReply('')
    setMatchedTeacherDetail(null)
    setAssistResult(null)
    try {
      const res = await getLiveLessonDetail(lessonId)
      if (!res.ok) throw new Error(res.data?.error || 'Không tải được bài Live.')
      const lesson = (res.data?.lesson || null) as (LessonItem & { locked?: boolean }) | null
      const turns = (Array.isArray(res.data?.turns) ? res.data.turns : []) as LessonTurn[]
      setSelectedLessonId(lessonId)
      setSelectedLesson(lesson)
      setSelectedTurns(turns)
      setCurrentTurnIndex(0)
      setAnswerText('')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Lỗi không xác định.'
      toast({ title: 'Lỗi mở bài Live', description: message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }, [toast])

  const createFromSession = useCallback(async () => {
    if (!selectedSessionId) {
      toast({ title: 'Thiếu session', description: 'Bạn cần chọn buổi học đã lưu trước.', variant: 'destructive' })
      return
    }
    setBusy(true)
    try {
      const res = await createLiveLessonFromSession({
        sessionId: selectedSessionId,
        title: lessonTitle.trim() || undefined,
        topicLabel: effectiveTopicLabel || undefined,
        topicId: effectiveTopicId || undefined,
        targetLanguage: filterTargetLanguage.trim() || undefined,
        nativeLanguage: filterNativeLanguage.trim() || undefined,
        learnerLevel: Number(filterLearnerLevel),
        goalType: filterGoalType.trim() || undefined,
        durationBucket: filterDurationBucket,
        priceCredits: Number(lessonPrice) || 1,
      })
      if (!res.ok) throw new Error(res.data?.error || 'Không tạo được bài Live.')
      toast({
        title: 'Đã tạo bài Live',
        description: `Quality score: ${String(res.data?.qualityScore ?? 'N/A')}.`,
      })
      await refresh()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Lỗi không xác định.'
      toast({ title: 'Lỗi tạo bài Live', description: message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }, [
    selectedSessionId,
    lessonTitle,
    lessonPrice,
    filterTopicId,
    effectiveTopicId,
    effectiveTopicLabel,
    filterTargetLanguage,
    filterNativeLanguage,
    filterLearnerLevel,
    filterGoalType,
    filterDurationBucket,
    toast,
    refresh,
  ])

  const publishLesson = useCallback(async (lessonId: string) => {
    setBusy(true)
    try {
      const res = await publishLiveLesson(lessonId)
      if (!res.ok) throw new Error(res.data?.error || 'Không publish được bài Live.')
      setPublishIssuesByLessonId((prev) => ({ ...prev, [lessonId]: [] }))
      toast({ title: 'Đã publish', description: 'Bài Live đã mở bán trong marketplace.' })
      await refresh()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Lỗi không xác định.'
      toast({ title: 'Publish thất bại', description: message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }, [toast, refresh])

  const validatePublish = useCallback(async (lessonId: string) => {
    setBusy(true)
    try {
      const res = await validateLiveLessonPublish(lessonId)
      if (!res.ok) throw new Error(res.data?.error || 'Không kiểm tra được điều kiện publish.')
      const issues = Array.isArray(res.data?.issues) ? (res.data.issues as string[]) : []
      setPublishIssuesByLessonId((prev) => ({ ...prev, [lessonId]: issues }))
      if (Boolean(res.data?.ok)) {
        toast({ title: 'Bài đạt chuẩn publish', description: 'Bạn có thể bấm Publish ngay.' })
      } else {
        toast({ title: 'Bài chưa đạt chuẩn', description: `${issues.length} vấn đề cần sửa trước khi publish.` })
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Lỗi không xác định.'
      toast({ title: 'Lỗi kiểm tra publish', description: message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }, [toast])

  const buyLesson = useCallback(async (lessonId: string) => {
    setBusy(true)
    try {
      const res = await purchaseLiveLesson(lessonId)
      if (!res.ok) throw new Error(res.data?.error || 'Mua bài Live thất bại.')
      toast({ title: 'Mua thành công', description: 'Bạn có thể mở bài và học ngay.' })
      await refresh()
      await openLesson(lessonId)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Lỗi không xác định.'
      toast({ title: 'Không mua được bài Live', description: message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }, [toast, refresh, openLesson])

  const submitTurn = useCallback(async () => {
    if (!selectedLesson || !selectedTurn || !answerText.trim()) return
    const topicId = String(selectedLesson.topicId || '').trim()
    const targetLanguage = String(selectedLesson.targetLanguage || '').trim()
    const nativeLanguage = String(selectedLesson.nativeLanguage || '').trim()
    const teacherGender = (selectedLesson.teacherGender || 'unknown') as 'male' | 'female' | 'unknown'
    const teacherVoice = String(selectedLesson.teacherLabel || selectedLesson.teacherLocale || '').trim()
    if (!topicId || !targetLanguage || !nativeLanguage || (!teacherVoice && teacherGender === 'unknown')) {
      toast({
        title: 'Thieu metadata replay',
        description: 'Bai nay chua du thong tin topic/teacher/language de replay DB. Hay hoc voi AI live.',
        variant: 'destructive',
      })
      return
    }
    setBusy(true)
    try {
      const res = await matchLiveLessonTurn({
        lessonId: selectedLesson.id,
        turnIndex: selectedTurn.turnIndex,
        answerText,
        topicId,
        targetLanguage,
        nativeLanguage,
        teacherGender,
        teacherVoice,
        matchMode: 'soft',
      })
      if (!res.ok) throw new Error(res.data?.error || 'So khớp thất bại.')
      if (Boolean(res.data?.useAiDirect)) {
        const reason = String(res.data?.reason || 'unknown')
        const targetCode = toLanguageCode(targetLanguage)
        const nativeCode = toLanguageCode(nativeLanguage)
        const aiRes = await chatWithCoach({
          sessionId: selectedLesson.id,
          studentText: answerText,
          history: [
            { role: 'teacher', text: String(selectedTurn.teacherReplyText || '').trim() },
            { role: 'student', text: answerText },
          ],
          targetLanguage,
          nativeLanguage,
          targetLanguageCode: targetCode,
          nativeLanguageCode: nativeCode,
          teacherLabel: selectedLesson.teacherLabel || 'Teacher',
          teacherLocale: selectedLesson.teacherLocale || '',
          mode: 'chat',
        })
        if (!aiRes.ok) throw new Error(aiRes.data?.error || 'AI direct that bai.')
        const aiReply = String(aiRes.data?.reply || '').trim()
        setTeacherReply(aiReply)
        setMatchedTeacherDetail({
          correctionNote: String(aiRes.data?.correctionNote || '').trim() || undefined,
          mainSentence: String(aiRes.data?.mainSentence || '').trim() || undefined,
          intentAnswer: String(aiRes.data?.intentAnswer || '').trim() || undefined,
        })
        setMatchInfo({
          matched: false,
          similarity: Number(res.data?.similarity || 0),
        })
        toast({
          title: 'AI xu ly truc tiep',
          description:
            reason === 'metadata_mismatch'
              ? 'Metadata khong khop voi kho bai mau. Da chuyen sang AI live cho luot nay.'
              : 'Do tuong dong < 90%. Da chuyen sang AI live cho luot nay.',
        })
        return
      }
      const matched = Boolean(res.data?.matched)
      const similarity = Number(res.data?.similarity || 0)
      setMatchInfo({ matched, similarity })
      if (matched) {
        setTeacherReply(String(res.data?.teacherReplyText || ''))
        setMatchedTeacherDetail({
          correctionNote: String(res.data?.teacherCorrectionNote || '').trim() || undefined,
          mainSentence: String(res.data?.teacherMainSentence || '').trim() || undefined,
          intentAnswer: String(res.data?.teacherIntentAnswer || '').trim() || undefined,
        })
        const audioUrl = String(res.data?.teacherAudioUrl || '').trim()
        if (audioUrl) {
          const audio = new Audio(audioUrl)
          void audio.play().catch(() => undefined)
        }
        const isLastTurn = Boolean(res.data?.isLastTurn)
        if (!isLastTurn) {
          setCurrentTurnIndex((prev) => prev + 1)
          setAnswerText('')
        }
      } else {
        setTeacherReply('')
        setMatchedTeacherDetail(null)
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Lỗi không xác định.'
      toast({ title: 'Lỗi so khớp', description: message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }, [selectedLesson, selectedTurn, answerText, toast])

  const handleAssistWord = useCallback(async () => {
    if (!selectedLesson || !assistWord.trim()) return
    setBusy(true)
    try {
      const res = await assistLiveLessonWord({
        lessonId: selectedLesson.id,
        word: assistWord.trim(),
        contextSentence: selectedTurn?.expectedStudentText || '',
      })
      if (!res.ok) throw new Error(res.data?.error || 'Không hỗ trợ được từ này.')
      setAssistResult({
        source: String(res.data?.source || 'unknown'),
        meaning: String(res.data?.meaning || '').trim(),
        pronunciation: String(res.data?.pronunciation || '').trim(),
        exampleTarget: String(res.data?.exampleTarget || '').trim(),
        exampleNative: String(res.data?.exampleNative || '').trim(),
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Lỗi không xác định.'
      toast({ title: 'Lỗi trợ giúp từ mới', description: message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }, [selectedLesson, assistWord, selectedTurn, toast])

  const startBySelectedMode = useCallback(async () => {
    if (studyMode === 'ai') {
      toast({
        title: 'Hoc voi AI live',
        description: 'Ban da chon mode AI. Hay bat dau buoi hoc o khung AI phia tren.',
      })
      return
    }
    setBusy(true)
    try {
      const res = await pickRandomLiveLesson({
        topicId: effectiveTopicId,
        targetLanguage: filterTargetLanguage,
        nativeLanguage: filterNativeLanguage,
        learnerLevel: Number(filterLearnerLevel),
        goalType: filterGoalType,
        durationBucket: filterDurationBucket,
      })
      if (!res.ok) throw new Error(res.data?.error || 'Khong mo duoc bai mau phu hop.')
      if (!Boolean(res.data?.found)) {
        toast({
          title: 'Khong co bai mau phu hop',
          description: String(res.data?.message || 'De xuat chuyen sang hoc voi AI live.'),
        })
        return
      }
      const lessonId = String((res.data?.lesson as { id?: string } | undefined)?.id || '').trim()
      if (!lessonId) throw new Error('Khong lay duoc lesson id.')
      await openLesson(lessonId)
      toast({
        title: 'Da mo bai mau ngau nhien',
        description: `Pool: ${String(res.data?.poolSize || 'N/A')} bai`,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Loi khong xac dinh.'
      toast({ title: 'Loi mo bai theo tieu chi', description: message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }, [studyMode, effectiveTopicId, filterTargetLanguage, filterNativeLanguage, filterLearnerLevel, filterGoalType, filterDurationBucket, openLesson, toast])

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="section-surface">
        <CardHeader>
          <CardTitle>Tao Live lesson tu session</CardTitle>
          <CardDescription>Lay buoi hoc chat AI da xong, chuan hoa thanh bai co the ban lai.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            className="w-full rounded-md border bg-white px-3 py-2 text-sm"
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            disabled={busy}
          >
            <option value="">Chon session da luu</option>
            {historySessions.map((s) => (
              <option key={s.sessionId} value={s.sessionId}>
                {s.sessionId}
              </option>
            ))}
          </select>
          <Input
            value={lessonTitle}
            onChange={(e) => setLessonTitle(e.target.value)}
            placeholder="Tieu de bai Live (tu chon)"
            disabled={busy}
          />
          <Input
            value={lessonPrice}
            onChange={(e) => setLessonPrice(e.target.value)}
            placeholder="Gia credits, vi du 1"
            disabled={busy}
          />
          <Button type="button" onClick={() => void createFromSession()} disabled={busy || !selectedSessionId}>
            Tao bai Live
          </Button>
          <div className="space-y-2 rounded-md border p-2">
            <p className="text-sm font-semibold">Bai Live cua toi</p>
            {myLessons.length === 0 ? (
              <p className="text-xs text-slate-500">Chua co bai.</p>
            ) : (
              myLessons.map((x) => (
                <div key={x.id} className="rounded border bg-slate-50 p-2 text-xs">
                  <p className="font-medium">{x.title}</p>
                  <p>Score: {x.qualityScore} • Turns: {x.turnsCount} • Price: {x.priceCredits}</p>
                  <p>Status: {x.status}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => void openLesson(x.id)} disabled={busy}>
                      Mo
                    </Button>
                    {x.status !== 'published' ? (
                      <>
                        <Button type="button" size="sm" variant="outline" onClick={() => void validatePublish(x.id)} disabled={busy}>
                          Kiem tra publish
                        </Button>
                        <Button type="button" size="sm" onClick={() => void publishLesson(x.id)} disabled={busy}>
                          Publish
                        </Button>
                      </>
                    ) : null}
                  </div>
                  {Array.isArray(publishIssuesByLessonId[x.id]) && publishIssuesByLessonId[x.id].length > 0 ? (
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-rose-700">
                      {publishIssuesByLessonId[x.id].map((issue, idx) => (
                        <li key={`${x.id}-issue-${idx}`}>{issue}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="section-surface">
        <CardHeader>
          <CardTitle>Live lesson marketplace</CardTitle>
          <CardDescription>Chon tieu chi hoc xong chon kieu hoc: AI live hoac bai mau co san.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-border/70 bg-slate-50/80 p-3 sm:p-4">
            <p className="text-sm font-semibold">Buoc 1: Chon tieu chi bai hoc</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <div className="space-y-2">
                <select
                  className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                  value={useCustomTopic ? '__custom__' : filterTopicId}
                  onChange={(e) => {
                    const next = e.target.value
                    if (next === '__custom__') {
                      setUseCustomTopic(true)
                      return
                    }
                    setUseCustomTopic(false)
                    setFilterTopicId(next)
                  }}
                >
                  {LIVE_TOPIC_OPTIONS.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.label}
                    </option>
                  ))}
                  <option value="__custom__">Chu de tuy chinh</option>
                </select>
                {useCustomTopic ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    <Input
                      value={customTopicId}
                      onChange={(e) => setCustomTopicId(e.target.value)}
                      placeholder="custom topic id, vd: startup-pitch"
                    />
                    <Input
                      value={customTopicLabel}
                      onChange={(e) => setCustomTopicLabel(e.target.value)}
                      placeholder="Nhan chu de hien thi"
                    />
                  </div>
                ) : null}
              </div>
              <Input value={filterTargetLanguage} onChange={(e) => setFilterTargetLanguage(e.target.value)} placeholder="Target language" />
              <Input value={filterNativeLanguage} onChange={(e) => setFilterNativeLanguage(e.target.value)} placeholder="Native language" />
              <select
                className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                value={filterLearnerLevel}
                onChange={(e) => setFilterLearnerLevel((e.target.value as '0' | '1' | '2' | '3' | '4') || '1')}
              >
                <option value="0">Level 0</option>
                <option value="1">Level 1</option>
                <option value="2">Level 2</option>
                <option value="3">Level 3</option>
                <option value="4">Level 4</option>
              </select>
              <select
                className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                value={filterGoalType}
                onChange={(e) => setFilterGoalType(e.target.value)}
              >
                {LIVE_GOAL_OPTIONS.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.label}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                value={filterDurationBucket}
                onChange={(e) => setFilterDurationBucket((e.target.value as 'short' | 'medium' | 'long') || 'medium')}
              >
                <option value="short">short</option>
                <option value="medium">medium</option>
                <option value="long">long</option>
              </select>
            </div>
            <p className="mt-3 text-sm font-semibold">Buoc 2: Chon kieu hoc</p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Button type="button" variant={studyMode === 'sample' ? 'default' : 'outline'} onClick={() => setStudyMode('sample')}>
                Bai mau co san
              </Button>
              <Button type="button" variant={studyMode === 'ai' ? 'default' : 'outline'} onClick={() => setStudyMode('ai')}>
                Hoc voi AI live
              </Button>
              <Button type="button" onClick={() => void startBySelectedMode()} disabled={busy}>
                Mo theo lua chon
              </Button>
            </div>
            {useCustomTopic && !effectiveTopicId ? (
              <p className="mt-2 text-xs text-amber-700">Hay nhap custom topic id truoc khi mo bai.</p>
            ) : null}
          </div>
          <div className="max-h-56 space-y-2 overflow-auto rounded-xl border border-border/70 p-2">
            {marketLessons.length === 0 ? (
              <p className="text-xs text-slate-500">Chua co bai da publish.</p>
            ) : (
              marketLessons.map((x) => (
                <div key={x.id} className={`rounded-xl border p-2.5 text-xs ${selectedLessonId === x.id ? 'border-indigo-200 bg-indigo-50' : 'border-border/70 bg-background/90'}`}>
                  <p className="font-medium">{x.title}</p>
                  <p>
                    Score {x.qualityScore} • Turns {x.turnsCount} • Price {x.priceCredits} • Sold {x.salesCount || 0}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => void openLesson(x.id)} disabled={busy}>
                      Xem
                    </Button>
                    {!x.isOwner && !x.purchased && x.priceCredits > 0 ? (
                      <Button type="button" size="sm" onClick={() => void buyLesson(x.id)} disabled={busy}>
                        Mua
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>

          {selectedLesson ? (
            <div className="rounded-xl border border-border/70 p-3 text-sm">
              <p className="font-semibold">{selectedLesson.title}</p>
              <p className="text-xs text-slate-600">
                {selectedLesson.turnsCount} turns • Price {selectedLesson.priceCredits} • {selectedLesson.locked ? 'Locked' : 'Unlocked'}
              </p>
              {selectedLesson.locked ? (
                <p className="mt-2 text-xs text-amber-700">Bai nay dang khoa. Bam "Mua" de mo khoa.</p>
              ) : selectedTurn ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-slate-500">Turn {selectedTurn.turnIndex + 1}</p>
                  <p className="rounded bg-slate-50 p-2 text-xs">
                    <span className="font-semibold">Can noi (AI chuan hoa):</span> {selectedTurn.expectedStudentText}
                  </p>
                  {selectedTurn.sourceStudentText ? (
                    <p className="rounded border border-slate-200 bg-white p-2 text-xs">
                      <span className="font-semibold">Cau goc hoc vien truoc:</span> {selectedTurn.sourceStudentText}
                    </p>
                  ) : null}
                  <div className="flex gap-2">
                    <Input value={answerText} onChange={(e) => setAnswerText(e.target.value)} placeholder="Nhap hoac noi cau cua ban..." />
                    <Button type="button" onClick={() => void submitTurn()} disabled={busy || !answerText.trim()}>
                      Match
                    </Button>
                  </div>
                  {matchInfo ? (
                    <p className={`text-xs ${matchInfo.matched ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {matchInfo.matched ? 'Khop thanh cong' : 'Chua khop'} • Similarity {Math.round(matchInfo.similarity * 100)}%
                    </p>
                  ) : null}
                  {teacherReply ? (
                    <div className="space-y-1 rounded border border-indigo-200 bg-indigo-50 p-2 text-xs">
                      <p><span className="font-semibold">Teacher (full):</span> {teacherReply}</p>
                      {matchedTeacherDetail?.correctionNote ? (
                        <p><span className="font-semibold">Y 1 - Sua loi:</span> {matchedTeacherDetail.correctionNote}</p>
                      ) : null}
                      {matchedTeacherDetail?.mainSentence ? (
                        <p><span className="font-semibold">Y 2 - Cau chuan:</span> {matchedTeacherDetail.mainSentence}</p>
                      ) : null}
                      {matchedTeacherDetail?.intentAnswer ? (
                        <p><span className="font-semibold">Y 3 - Tra loi tu nhien:</span> {matchedTeacherDetail.intentAnswer}</p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="rounded border border-slate-200 bg-white p-2">
                    <p className="text-xs font-semibold">Tro ly tu moi (khong pha timeline bai mau)</p>
                    <div className="mt-2 flex gap-2">
                      <Input
                        value={assistWord}
                        onChange={(e) => setAssistWord(e.target.value)}
                        placeholder="Nhap 1 tu ban muon hoi them..."
                      />
                      <Button type="button" variant="outline" onClick={() => void handleAssistWord()} disabled={busy || !assistWord.trim()}>
                        Ho tro AI
                      </Button>
                    </div>
                    {assistResult ? (
                      <div className="mt-2 space-y-1 text-xs">
                        <p>
                          <span className="font-semibold">Nguon:</span>{' '}
                          {assistResult.source === 'daily_words'
                            ? 'DB tu moi cua ban'
                            : assistResult.source === 'vocab_cache'
                              ? 'DB cache dung chung'
                              : 'AI fallback'}
                        </p>
                        <p><span className="font-semibold">Nghia:</span> {assistResult.meaning || 'N/A'}</p>
                        {assistResult.pronunciation ? <p><span className="font-semibold">Phat am:</span> {assistResult.pronunciation}</p> : null}
                        {assistResult.exampleTarget ? <p><span className="font-semibold">Vi du:</span> {assistResult.exampleTarget}</p> : null}
                        {assistResult.exampleNative ? <p><span className="font-semibold">Dich:</span> {assistResult.exampleNative}</p> : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">Bai nay chua co turn du lieu.</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Chon mot bai de xem chi tiet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
