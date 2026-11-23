'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  fillAnswerCardText,
  summarizeAnswerPicks,
  type AnswerChoice,
} from '@/lib/lop/answer-card'
import { phoneOpenableUrl } from '@/app/tao-giao-trinh/lib/phone-remote-client'
import type { AnswerCardRosterEntry, AnswerCardRoundView, AnswerCardShot } from '@/lib/db/answer-card-pg'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { SCORE_BANDS, ScoreSpread, bandOf, scoreOn100 } from '@/components/lop/score-spread'

const CHOICE_COLOR: Record<AnswerChoice, string> = {
  A: 'bg-rose-500',
  B: 'bg-sky-500',
  C: 'bg-amber-500',
  D: 'bg-emerald-500',
}

type Filter = 'all' | 'miss' | AnswerChoice

export function ChieuTheTraLoiClient({
  initial,
  subjectQuery,
  t,
  onClose,
}: {
  initial: AnswerCardRoundView
  subjectQuery: string
  t: Dictionary['classes']
  onClose?: () => void
}) {
  const [view, setView] = useState(initial)
  const [connectOpen, setConnectOpen] = useState(false)
  const [qr, setQr] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [hideNames, setHideNames] = useState(false)
  const [busy, setBusy] = useState(false)
  const revealedIndex = Number(initial.revealedQuestionIndex)
  const hasReveal = Boolean(initial.revealedAt) && Number.isInteger(revealedIndex)
  const [scanIndex, setScanIndex] = useState<number | null>(
    hasReveal ? revealedIndex : (initial.sourceKind === 'exam' ? initial.questionIndex : null)
  )
  const [summaryMode, setSummaryMode] = useState(initial.showSummary)
  const [statsModal, setStatsModal] = useState(false)
  const summaryModeRef = useRef(summaryMode)
  summaryModeRef.current = summaryMode
  const [reviewingQuestion, setReviewingQuestion] = useState(false)
  const followedIndex = useRef(hasReveal ? revealedIndex : initial.questionIndex)
  const followedSummary = useRef(initial.showSummary)
  const followedReveal = useRef(initial.revealedAt ?? '')
  const followedPaper = useRef(initial.openPaperAt ?? '')
  const backHref = `/lop/${view.classId}/the-tra-loi${subjectQuery ? `?${subjectQuery}` : ''}`

  useEffect(() => {
    let stop = false
    let pending = false
    const tick = async () => {
      if (pending || stop) return
      pending = true
      try {
        const res = await fetch(`/api/lop/answer-cards/rounds/${view.id}`, { cache: 'no-store' })
        if (!res.ok || stop) return
        const data = (await res.json()) as AnswerCardRoundView
        if (!stop && data?.id) setView(data)
      } finally {
        pending = false
      }
    }
    void tick()
    const timer = window.setInterval(() => { void tick() }, 1000)
    return () => {
      stop = true
      window.clearInterval(timer)
    }
  }, [view.id])

  useEffect(() => {
    if (view.phoneConnected) setConnectOpen(false)
  }, [view.phoneConnected])

  useEffect(() => {
    if (!view.showSummary) {
      followedSummary.current = false
      if (!summaryModeRef.current) setSummaryMode(false)
      return
    }
    if (view.revealedAt && view.revealedAt !== followedReveal.current) return
    if (followedSummary.current) return
    followedSummary.current = true
    setReviewingQuestion(false)
    setStatsModal(false)
    setSummaryMode(true)
  }, [view.showSummary, view.revealedAt])

  useEffect(() => {
    const at = view.revealedAt ? String(view.revealedAt) : ''
    const index = Number(view.revealedQuestionIndex)
    if (!at || !Number.isInteger(index)) return
    if (at === followedReveal.current) return
    followedReveal.current = at
    followedSummary.current = false
    followedIndex.current = index
    setReviewingQuestion(false)
    setScanIndex(index)
    setFilter('all')
    if (summaryModeRef.current) setStatsModal(true)
    else {
      setStatsModal(false)
      setSummaryMode(false)
    }
  }, [view.revealedAt, view.revealedQuestionIndex])

  useEffect(() => {
    const at = view.openPaperAt ? String(view.openPaperAt) : ''
    const code = view.examCode?.trim() ?? ''
    if (!at || !code || at === followedPaper.current) return
    followedPaper.current = at
    const params = new URLSearchParams({
      vong: view.id,
      lop: view.classId,
    })
    window.location.assign(`/giao-trinh/giao-vien/mo-de/${encodeURIComponent(code)}?${params.toString()}`)
  }, [view.examCode, view.openPaperAt])

  const showConnectQr = connectOpen

  useEffect(() => {
    if (!showConnectQr) return
    let cancel = false
    void (async () => {
      const url = await phoneOpenableUrl(view.phonePath)
      if (!url.startsWith('https://') || cancel) return
      const QRCode = (await import('qrcode')).default
      const next = await QRCode.toDataURL(url, { margin: 1, width: 320 })
      if (!cancel) setQr(next)
    })()
    return () => {
      cancel = true
    }
  }, [showConnectQr, view.phonePath])

  async function act(action: 'show' | 'hide' | 'end') {
    setBusy(true)
    try {
      const res = await fetch(`/api/lop/answer-cards/rounds/${view.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) return
      const data = (await res.json()) as AnswerCardRoundView
      if (data?.id) {
        setView(data)
        setFilter('all')
      }
    } finally {
      setBusy(false)
    }
  }

  async function focusQuestion(index: number) {
    setBusy(true)
    try {
      const res = await fetch(`/api/lop/answer-cards/rounds/${view.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'focus', questionIndex: index }),
      })
      if (!res.ok) return
      const data = (await res.json()) as AnswerCardRoundView
      if (!data?.id) return
      followedIndex.current = index
      setView(data)
      setScanIndex(index)
      setFilter('all')
    } finally {
      setBusy(false)
    }
  }

  const question = scanIndex == null ? undefined : view.questions[scanIndex]
  const picks = scanIndex == null ? [] : view.picks.filter((pick) => pick.questionIndex === scanIndex)
  const summary = question
    ? summarizeAnswerPicks(view.roster.map((student) => student.userId), picks, question.correct)
    : null
  const pickByUser = new Map(picks.map((pick) => [pick.userId, pick.choice]))
  const saved = summary?.answered ?? 0
  const total = view.roster.length
  const percent = summary && summary.answered > 0 ? Math.round((summary.correct / summary.answered) * 100) : 0
  const letters = (question?.choices ?? []).map((_, index) => 'ABCD'[index] as AnswerChoice)
  const maxCount = Math.max(1, ...letters.map((letter) => summary?.byChoice[letter] ?? 0))
  const pointsByUser = new Map<string, number>()
  const choiceByStudentQuestion = new Map<string, AnswerChoice>()
  for (const pick of view.picks) {
    choiceByStudentQuestion.set(`${pick.userId}:${pick.questionIndex}`, pick.choice)
    const item = view.questions[pick.questionIndex]
    if (!item || pick.choice !== item.correct) continue
    pointsByUser.set(pick.userId, (pointsByUser.get(pick.userId) ?? 0) + 1)
  }
  const attemptedIds = new Set<string>(view.picks.map((pick) => pick.userId))
  for (const userId of view.submittedUserIds ?? []) attemptedIds.add(userId)
  async function openQuestionStats(index: number) {
    followedSummary.current = true
    followedIndex.current = index
    setScanIndex(index)
    setFilter('all')
    setReviewingQuestion(true)
    setStatsModal(true)
    setBusy(true)
    try {
      const res = await fetch(`/api/lop/answer-cards/rounds/${view.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'review', questionIndex: index }),
      })
      if (!res.ok) return
      const data = (await res.json()) as AnswerCardRoundView
      if (data?.id) setView(data)
    } finally {
      setBusy(false)
    }
  }

  const questionCorrectPercent = view.questions.map((item, index) => {
    let attempted = 0
    let correct = 0
    for (const student of view.roster) {
      if (!attemptedIds.has(student.userId)) continue
      attempted += 1
      if (choiceByStudentQuestion.get(`${student.userId}:${index}`) === item.correct) correct += 1
    }
    if (attempted === 0) return null
    return Math.round((correct / attempted) * 100)
  })
  const pointTotal = view.questions.length
  const visibleRoster = view.roster.filter((student) => {
    const choice = pickByUser.get(student.userId)
    if (filter === 'all') return true
    if (filter === 'miss') return !choice
    return choice === filter
  })
  const rosterCount = visibleRoster.length
  const rosterCols = rosterCount <= 8 ? 2 : rosterCount <= 18 ? 3 : rosterCount <= 32 ? 4 : 5
  const rosterRows = Math.max(1, Math.ceil(rosterCount / rosterCols) || 1)
  const rosterText = rosterRows >= 10 ? 'text-[10px]' : rosterRows >= 7 ? 'text-[11px]' : 'text-xs'

  const connectDialog = connectOpen ? (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#101828] p-6 text-center text-white">
        <h2 className="text-xl font-semibold">{t.answerCardsConnect}</h2>
        <p className="mt-2 text-sm text-white/75">{t.answerCardsConnectLead}</p>
        <div className="mx-auto mt-4 w-fit rounded-xl bg-white p-3">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="" className="h-56 w-56" />
          ) : (
            <div className="h-56 w-56 bg-slate-100" />
          )}
        </div>
        <p className="mt-3 text-sm text-amber-300">{view.phoneConnected ? t.answerCardsPhoneReady : t.answerCardsWaitingPhone}</p>
        <p className="mt-1 text-xs text-white/50">{t.answerCardsConnectOnce}</p>
        <button type="button" className="mt-4 rounded-full bg-amber-400 px-4 py-1.5 text-sm font-semibold text-slate-900" onClick={() => setConnectOpen(false)}>
          {t.answerCardsClose}
        </button>
      </div>
    </div>
  ) : null

  const exam = view.sourceKind === 'exam'
  const ranked = [...view.roster].sort((a, b) => {
    const aDone = attemptedIds.has(a.userId)
    const bDone = attemptedIds.has(b.userId)
    if (aDone !== bDone) return aDone ? -1 : 1
    const score = (pointsByUser.get(b.userId) ?? 0) - (pointsByUser.get(a.userId) ?? 0)
    return score || a.cardNo - b.cardNo
  })

  let sheet: ReactNode = null
  if (summaryMode) {
    const rosterMid = Math.ceil(ranked.length / 2)
    const rosterColumns = ranked.length > 1
      ? [ranked.slice(0, rosterMid), ranked.slice(rosterMid)]
      : [ranked]
    const rosterTable = (students: AnswerCardRosterEntry[]) => (
      <SummaryRosterTable
        students={students}
        questions={view.questions}
        questionCorrectPercent={questionCorrectPercent}
        openQuestionLabel={t.answerCardsOpenQuestionStats}
        onOpenQuestion={openQuestionStats}
        choiceByStudentQuestion={choiceByStudentQuestion}
        pointsByUser={pointsByUser}
        pointTotal={pointTotal}
        scoreHeading={t.answerCardsExamSummary}
        nameHeading={t.answerCardsStudentColumn}
        notDoneLabel={t.answerCardsNotDone}
        attemptedIds={attemptedIds}
      />
    )
    sheet = (
      <div className="fixed inset-0 z-[80] flex flex-col overflow-hidden bg-white text-slate-900">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-3 py-2">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold leading-tight">
              {t.answerCardsExamSummary}
              <span className="ml-2 font-normal text-slate-500">{view.className} · {view.title}</span>
            </h1>
            <p className="truncate text-xs text-slate-500">{t.answerCardsScoreboardLead}</p>
          </div>
          {onClose ? (
            <button
              type="button"
              aria-label={t.answerCardsBack}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 text-lg leading-none"
              onClick={onClose}
            >
              ×
            </button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-2 py-1">
          <div className="lg:hidden">{rosterTable(ranked)}</div>
          <div className="hidden lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-4">
            {rosterColumns.map((students, index) => (
              <div key={index} className="min-w-0">{rosterTable(students)}</div>
            ))}
          </div>
          <div className="mt-3 flex justify-center">
            <ScoreSpread
              grades={ranked.filter((student) => attemptedIds.has(student.userId)).map((student) => scoreOn100(pointsByUser.get(student.userId) ?? 0, pointTotal))}
              notDone={ranked.filter((student) => !attemptedIds.has(student.userId)).length}
              notDoneLabel={t.answerCardsNotDone}
              title={t.answerCardsScoreSpread}
              scaleLabel={t.answerCardsScoreScale100}
              bandLabel={t.answerCardsScoreBand}
              countLabel={t.answerCardsScoreStudents}
              shareLabel={t.answerCardsScoreShare}
            />
          </div>
          <AnswerShotStrip
            roundId={view.id}
            shots={view.shots ?? []}
            questionIndex={null}
            title={t.answerCardsShots}
            closeLabel={t.answerCardsClose}
          />
        </div>
      </div>
    )
  }

  if (!summaryMode && scanIndex == null) {
    return (
      <div className="fixed inset-0 z-[80] overflow-auto bg-white text-slate-900">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-6 sm:px-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            {onClose ? (
              <button type="button" className="text-slate-500 hover:text-slate-900" onClick={onClose}>{t.answerCardsBack}</button>
            ) : (
              <Link href={backHref} className="text-slate-500 hover:text-slate-900">{t.answerCardsBack}</Link>
            )}
            <p className="min-w-0 truncate font-medium">{view.className} · {view.title}</p>
            <div className="flex items-center gap-2">
              <button type="button" className="rounded-full bg-slate-900 px-3 py-1 text-xs text-white" onClick={() => setConnectOpen(true)}>
                {view.phoneConnected ? t.answerCardsPhoneReady : t.answerCardsConnect}
              </button>
              {view.status === 'live' ? (
                <button type="button" className="rounded-full border border-slate-300 px-3 py-1 text-xs" disabled={busy} onClick={() => void act('end')}>
                  {t.answerCardsEnd}
                </button>
              ) : (
                <span className="text-xs text-slate-500">{t.answerCardsEnded}</span>
              )}
            </div>
          </div>
          <p className="mb-5 text-sm text-slate-500">{t.answerCardsListHint}</p>
          <AnswerShotStrip
            roundId={view.id}
            shots={view.shots ?? []}
            questionIndex={null}
            title={t.answerCardsShots}
            closeLabel={t.answerCardsClose}
          />
          <ol className="space-y-5 pb-10">
            {view.questions.map((item, index) => {
              const collected = view.picks.filter((pick) => pick.questionIndex === index).length
              return (
                <li key={index} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-base font-medium leading-relaxed">
                      <span className="font-semibold">{fillAnswerCardText(t.answerCardsQuestionWord, { n: index + 1 })}. </span>
                      {item.prompt}
                    </p>
                    <button
                      type="button"
                      className="shrink-0 rounded-full bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                      disabled={busy}
                      onClick={() => { void focusQuestion(index) }}
                    >
                      {t.answerScanNow}
                    </button>
                  </div>
                  <ul className="mt-3 space-y-1 text-sm leading-relaxed">
                    {item.choices.map((choice, choiceIndex) => (
                      <li key={`${index}-${choiceIndex}`}>
                        {'ABCD'[choiceIndex]}. {choice || '—'}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-slate-500">
                    {fillAnswerCardText(t.answerCardsSavedOf, { saved: collected, total: view.roster.length })}
                  </p>
                </li>
              )
            })}
          </ol>
        </div>
        {connectDialog}
      </div>
    )
  }

  const statsAsModal = summaryMode && statsModal
  const resultsOpen = Boolean((view.showResults || exam || reviewingQuestion || statsAsModal) && question && summary)
  const showStats = scanIndex != null && (!summaryMode || statsModal)

  if (!showStats || scanIndex == null) return sheet

  return (
    <>
      {sheet}
      <div className={`fixed inset-0 ${statsAsModal ? 'z-[140]' : 'z-[80]'} flex h-dvh flex-col overflow-hidden bg-[#071425] text-white`}>
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col px-3 py-2">
        <div className="mb-1.5 flex shrink-0 items-center justify-between gap-3 text-xs">
          {statsAsModal || onClose ? (
            <span className="w-8" />
          ) : exam ? (
            <Link href={backHref} className="text-white/70 hover:text-white">{t.answerCardsBack}</Link>
          ) : (
            <button type="button" className="text-white/70 hover:text-white" onClick={() => setScanIndex(null)}>
              {t.answerCardsBackToList}
            </button>
          )}
          <p className="truncate text-white/80">{view.className} · {view.title}</p>
          {statsAsModal || onClose ? (
            <button
              type="button"
              aria-label={t.answerCardsBack}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-lg leading-none"
              onClick={() => (statsAsModal ? setStatsModal(false) : onClose?.())}
            >
              ×
            </button>
          ) : (
            <span className="w-16" />
          )}
        </div>

        <div className={`grid min-h-0 flex-1 gap-2 ${resultsOpen ? 'lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]' : ''}`}>
          <section className="flex min-h-0 flex-col overflow-hidden">
            {question ? (
              <article className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-white p-3 text-slate-900 shadow-xl">
                <p className="inline-flex w-fit shrink-0 rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">
                  {fillAnswerCardText(t.answerCardsQuestionWord, { n: scanIndex + 1 })}
                </p>
                <p className="mt-2 min-h-0 flex-1 overflow-y-auto text-sm font-medium leading-snug">{question.prompt}</p>
                <div className="mt-2 grid shrink-0 gap-1.5 sm:grid-cols-2">
                  {question.choices.map((choice, index) => {
                    const letter = 'ABCD'[index] as AnswerChoice
                    const revealed = (view.showResults || exam) && letter === question.correct
                    return (
                      <div key={letter} className={`flex items-start gap-1.5 rounded-lg border px-2 py-1 ${revealed ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
                        <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white ${CHOICE_COLOR[letter]}`}>{letter}</span>
                        <span className="text-xs leading-snug">{choice || '—'}</span>
                      </div>
                    )
                  })}
                </div>
                <p className="mt-1.5 shrink-0 text-[10px] text-slate-500">{t.answerCardsRaiseHint}</p>
              </article>
            ) : (
              <p>{t.answerCardsNotFound}</p>
            )}
            <AnswerShotStrip
              roundId={view.id}
              shots={view.shots ?? []}
              questionIndex={scanIndex}
              title={t.answerCardsShots}
              closeLabel={t.answerCardsClose}
              dark
              compact
            />
          </section>

          {resultsOpen && question && summary ? (
            <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-amber-300/70 bg-[#140b24] p-2.5 shadow-[0_0_0_2px_rgba(251,191,36,0.35)]">
              <div className="flex shrink-0 items-end justify-between gap-2">
                <div className="min-w-0">
                  {saved >= total && total > 0 ? <p className="text-[11px] font-semibold text-amber-200">{t.answerCardsAllScanned}</p> : null}
                  <p className="text-[11px] text-white/70">{fillAnswerCardText(t.answerCardsCorrectIs, { letter: question.correct })}</p>
                  <p className="text-3xl font-black leading-none">{percent}%</p>
                  <p className="text-[11px] text-white/80">
                    {fillAnswerCardText(t.answerCardsCorrectRatio, { correct: summary.correct, answered: summary.answered })}
                  </p>
                </div>
                <p className="shrink-0 text-[11px] text-white/70">{fillAnswerCardText(t.answerCardsSavedOf, { saved, total })}</p>
              </div>
              <div className="mt-1.5 grid shrink-0 grid-cols-4 items-end gap-1">
                {letters.map((letter) => {
                  const count = summary.byChoice[letter]
                  const share = summary.answered > 0 ? Math.round((count / summary.answered) * 100) : 0
                  const height = 6 + (count / maxCount) * 36
                  return (
                    <div key={letter} className="min-w-0 text-center">
                      <div className="flex h-12 items-end justify-center">
                        <div className={`w-6 rounded-t ${CHOICE_COLOR[letter]} ${letter === question.correct ? 'ring-2 ring-white' : ''}`} style={{ height }} />
                      </div>
                      <p className="text-[10px] font-semibold leading-tight">{letter} {share}%</p>
                      <p className="truncate text-[10px] leading-tight text-white/60">{question.choices['ABCD'.indexOf(letter)]}</p>
                    </div>
                  )
                })}
              </div>
              <div className="mt-1.5 flex shrink-0 flex-wrap items-center gap-1 text-[10px]">
                <span className="rounded-full bg-emerald-600 px-1.5 py-0.5">{t.answerCardsCorrect} {summary.correct}</span>
                <span className="rounded-full bg-rose-600 px-1.5 py-0.5">{t.answerCardsWrong} {summary.wrong}</span>
                <span className="rounded-full bg-slate-600 px-1.5 py-0.5">{t.answerCardsUnanswered} {summary.unanswered}</span>
                {(['all', 'A', 'B', 'C', 'D', 'miss'] as Filter[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`rounded-full px-1.5 py-0.5 ${filter === item ? 'bg-white text-slate-900' : 'bg-white/10'}`}
                    onClick={() => setFilter(item)}
                  >
                    {item === 'all' ? t.answerCardsAll : item === 'miss' ? t.answerCardsUnanswered : item}
                  </button>
                ))}
                <button type="button" className="rounded-full bg-white/10 px-1.5 py-0.5" onClick={() => setHideNames((value) => !value)}>
                  {hideNames ? t.answerCardsShowNames : t.answerCardsHideNames}
                </button>
                <span className="text-white/50">{t.answerCardsReviewHint}</span>
              </div>
              <div
                className="mt-1.5 grid min-h-0 flex-1 gap-1 overflow-hidden"
                style={{
                  gridTemplateColumns: `repeat(${rosterCols}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${rosterRows}, minmax(0, 1fr))`,
                }}
              >
                {visibleRoster.map((student) => {
                  const choice = pickByUser.get(student.userId)
                  const points = pointsByUser.get(student.userId) ?? 0
                  const tone = !choice ? 'bg-slate-700' : choice === question.correct ? 'bg-emerald-600' : 'bg-rose-600'
                  const scoreLabel = attemptedIds.has(student.userId)
                    ? fillAnswerCardText(t.answerCardsScore, { points, total: pointTotal })
                    : t.answerCardsNotDone
                  return (
                    <div key={student.userId} className={`flex min-h-0 items-center gap-1 overflow-hidden rounded px-1.5 ${rosterText} ${tone}`} title={scoreLabel}>
                      <span className="shrink-0 font-semibold tabular-nums">{String(student.cardNo).padStart(2, '0')}</span>
                      {hideNames ? <span className="min-w-0 flex-1" /> : <span className="min-w-0 flex-1 truncate">{student.shortName}</span>}
                      <span className="shrink-0 font-semibold tabular-nums">
                        {attemptedIds.has(student.userId) ? `${points}/${pointTotal}` : t.answerCardsNotDone}
                      </span>
                      {choice ? <span className="w-3 shrink-0 text-center font-bold">{choice}</span> : null}
                    </div>
                  )
                })}
              </div>
            </section>
          ) : null}
        </div>

        <div className="mt-1.5 flex shrink-0 justify-center">
          <div className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl bg-[#101828] px-2 py-1 text-xs shadow-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-slate-900">T</span>
              <span className="font-semibold">{fillAnswerCardText(t.answerCardsQuestionWord, { n: scanIndex + 1 })}</span>
              <span className="text-emerald-300">● {fillAnswerCardText(t.answerCardsSavedCount, { saved, total })}</span>
            </div>
            {exam || statsAsModal ? null : (
              <div className="flex flex-wrap gap-1">
                <button type="button" className="rounded-full bg-white/10 px-2.5 py-1 text-xs" onClick={() => setScanIndex(null)}>
                  {t.answerCardsBackToList}
                </button>
                <button
                  type="button"
                  className="rounded-full bg-amber-400 px-2.5 py-1 text-xs font-semibold text-slate-900 disabled:opacity-50"
                  disabled={busy || view.status === 'closed'}
                  onClick={() => void act(view.showResults ? 'hide' : 'show')}
                >
                  {view.showResults ? t.answerCardsHideResult : t.answerCardsResult}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {connectDialog}
      </div>
    </>
  )
}

function SummaryRosterTable({
  students,
  questions,
  questionCorrectPercent,
  openQuestionLabel,
  onOpenQuestion,
  choiceByStudentQuestion,
  pointsByUser,
  pointTotal,
  scoreHeading,
  nameHeading,
  notDoneLabel,
  attemptedIds,
}: {
  students: AnswerCardRosterEntry[]
  questions: AnswerCardRoundView['questions']
  questionCorrectPercent: Array<number | null>
  openQuestionLabel: string
  onOpenQuestion: (index: number) => void
  choiceByStudentQuestion: Map<string, AnswerChoice>
  pointsByUser: Map<string, number>
  pointTotal: number
  scoreHeading: string
  nameHeading: string
  notDoneLabel: string
  attemptedIds: Set<string>
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs leading-tight">
        <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="w-8 px-1.5 py-1 font-medium">#</th>
            <th className="px-1.5 py-1 font-medium">{nameHeading}</th>
            {questions.map((item, index) => (
              <th key={index} className="px-1 py-1 text-center font-medium normal-case tracking-normal">
                <button
                  type="button"
                  className="rounded-md px-1 py-0.5 hover:bg-white"
                  title={fillAnswerCardText(openQuestionLabel, { n: index + 1 })}
                  onClick={() => onOpenQuestion(index)}
                >
                  <span className="block tabular-nums text-slate-500">{index + 1}</span>
                  <span className="block font-semibold text-emerald-600">{item.correct}✓</span>
                  <span className="block font-semibold tabular-nums text-slate-900">
                    {questionCorrectPercent[index] == null ? '—' : `${questionCorrectPercent[index]}%`}
                  </span>
                </button>
              </th>
            ))}
            <th className="px-1.5 py-1 text-right font-medium">{scoreHeading}</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr key={student.userId} className="border-t border-slate-100">
              <td className="px-1.5 py-0.5 font-semibold tabular-nums">{String(student.cardNo).padStart(2, '0')}</td>
              <td className="max-w-[11rem] truncate px-1.5 py-0.5" title={student.name}>{student.name}</td>
              {questions.map((item, index) => {
                const choice = choiceByStudentQuestion.get(`${student.userId}:${index}`)
                if (!choice) {
                  return <td key={index} className="px-1 py-0.5 text-center text-slate-300">—</td>
                }
                const ok = choice === item.correct
                return (
                  <td key={index} className={`whitespace-nowrap px-1 py-0.5 text-center font-semibold tabular-nums ${ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {choice}{ok ? '✓' : '×'}
                  </td>
                )
              })}
              <td className={`whitespace-nowrap px-1.5 py-0.5 text-right font-semibold tabular-nums ${attemptedIds.has(student.userId) ? SCORE_BANDS[bandOf(scoreOn100(pointsByUser.get(student.userId) ?? 0, pointTotal))].text : 'font-medium text-slate-400'}`}>
                {attemptedIds.has(student.userId) ? `${pointsByUser.get(student.userId) ?? 0}/${pointTotal}` : notDoneLabel}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AnswerShotStrip({
  roundId,
  shots,
  questionIndex,
  title,
  closeLabel,
  dark = false,
  compact = false,
}: {
  roundId: string
  shots: AnswerCardShot[]
  questionIndex: number | null
  title: string
  closeLabel: string
  dark?: boolean
  compact?: boolean
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const rows = (questionIndex == null ? shots : shots.filter((shot) => shot.questionIndex === questionIndex))
    .slice()
    .sort((a, b) => a.takenAt.localeCompare(b.takenAt))
  if (rows.length === 0) return null
  const open = rows.find((shot) => shot.id === openId) ?? null
  return (
    <section className={`${dark ? 'text-white' : ''} ${compact ? 'mt-1 shrink-0' : ''}`}>
      <h2 className={`text-xs font-semibold ${dark ? 'text-white/80' : 'text-slate-700'}`}>{title}</h2>
      <div className="mt-1 flex gap-1.5 overflow-x-auto pb-0.5">
        {rows.map((shot) => (
          <button key={shot.id} type="button" className="shrink-0" onClick={() => setOpenId(shot.id)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/lop/answer-cards/rounds/${roundId}/shots/${shot.id}`}
              alt=""
              className={`rounded-lg bg-slate-200 object-cover ${compact ? 'h-10 w-16' : 'h-28 w-44 rounded-xl'}`}
            />
          </button>
        ))}
      </div>
      {open ? (
        <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-black/80 p-4" onClick={() => setOpenId(null)}>
          <div className="max-h-full w-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/lop/answer-cards/rounds/${roundId}/shots/${open.id}`}
              alt=""
              className="max-h-[78vh] w-full rounded-2xl object-contain"
            />
            <button
              type="button"
              className="mt-3 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900"
              onClick={() => setOpenId(null)}
            >
              {closeLabel}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
