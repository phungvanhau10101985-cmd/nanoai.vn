'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  fillAnswerCardText,
  summarizeAnswerPicks,
  type AnswerChoice,
} from '@/lib/lop/answer-card'
import { phoneRemoteLoginOrigin } from '@/app/tao-giao-trinh/lib/phone-remote-client'
import type { AnswerCardRoundView } from '@/lib/db/answer-card-pg'
import type { Dictionary } from '@/lib/i18n/dictionaries'

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
}: {
  initial: AnswerCardRoundView
  subjectQuery: string
  t: Dictionary['classes']
}) {
  const [view, setView] = useState(initial)
  const [connectOpen, setConnectOpen] = useState(false)
  const [qr, setQr] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [hideNames, setHideNames] = useState(false)
  const [busy, setBusy] = useState(false)
  const [scanIndex, setScanIndex] = useState<number | null>(initial.sourceKind === 'exam' ? initial.questionIndex : null)
  const [summaryMode, setSummaryMode] = useState(false)
  const [summaryDismissed, setSummaryDismissed] = useState(false)
  const followedIndex = useRef(initial.questionIndex)
  const followedResults = useRef(initial.showResults)
  const summaryAnnounced = useRef(false)
  const backHref = `/lop/${view.classId}/the-tra-loi${subjectQuery ? `?${subjectQuery}` : ''}`

  useEffect(() => {
    let stop = false
    const tick = async () => {
      const res = await fetch(`/api/lop/answer-cards/rounds/${view.id}`, { cache: 'no-store' })
      if (!res.ok || stop) return
      const data = (await res.json()) as AnswerCardRoundView
      if (!stop && data?.id) setView(data)
    }
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
    if (view.questionIndex === followedIndex.current) return
    followedIndex.current = view.questionIndex
    setSummaryMode(false)
    setScanIndex(view.questionIndex)
    setFilter('all')
  }, [view.questionIndex])

  useEffect(() => {
    if (summaryAnnounced.current || summaryDismissed || view.sourceKind !== 'exam') return
    if (view.roster.length === 0 || view.questions.length === 0) return
    const done = view.questions.every((_, index) => (
      view.picks.filter((pick) => pick.questionIndex === index).length >= view.roster.length
    ))
    if (!done) return
    summaryAnnounced.current = true
    setSummaryMode(true)
  }, [summaryDismissed, view])

  useEffect(() => {
    const opened = view.showResults && !followedResults.current
    followedResults.current = view.showResults
    if (!opened) return
    followedIndex.current = view.questionIndex
    setScanIndex(view.questionIndex)
    setFilter('all')
  }, [view.showResults, view.questionIndex])

  const showConnectQr = connectOpen || (view.sourceKind === 'exam' && !view.phoneConnected)

  useEffect(() => {
    if (!showConnectQr) return
    let cancel = false
    void (async () => {
      const QRCode = (await import('qrcode')).default
      const origin = await phoneRemoteLoginOrigin()
      const url = `${origin}${view.phonePath}`
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
  for (const pick of view.picks) {
    const item = view.questions[pick.questionIndex]
    if (!item || pick.choice !== item.correct) continue
    pointsByUser.set(pick.userId, (pointsByUser.get(pick.userId) ?? 0) + 1)
  }
  const pointTotal = view.questions.length
  const visibleRoster = view.roster.filter((student) => {
    const choice = pickByUser.get(student.userId)
    if (filter === 'all') return true
    if (filter === 'miss') return !choice
    return choice === filter
  })

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
    const score = (pointsByUser.get(b.userId) ?? 0) - (pointsByUser.get(a.userId) ?? 0)
    return score || a.cardNo - b.cardNo
  })

  if (exam && summaryMode) {
    return (
      <div className="fixed inset-0 z-[80] overflow-auto bg-white text-slate-900">
        <div className="mx-auto w-full max-w-5xl px-4 py-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">{t.answerCardsExamSummary}</h1>
              <p className="mt-1 text-sm text-slate-500">{view.className} · {view.title}</p>
              <p className="mt-1 text-sm text-slate-500">{t.answerCardsExamSummaryLead}</p>
            </div>
            <button
              type="button"
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => {
                setSummaryDismissed(true)
                setSummaryMode(false)
              }}
            >
              {fillAnswerCardText(t.answerCardsQuestionWord, { n: (scanIndex ?? 0) + 1 })}
            </button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2" />
                  {view.questions.map((_, index) => (
                    <th key={index} className="px-2 py-2 text-center">{index + 1}</th>
                  ))}
                  <th className="px-3 py-2 text-right">{t.answerCardsExamSummary}</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((student) => (
                  <tr key={student.userId} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-semibold">{String(student.cardNo).padStart(2, '0')}</td>
                    <td className="px-3 py-2">{student.name}</td>
                    {view.questions.map((item, index) => {
                      const choice = view.picks.find((pick) => pick.userId === student.userId && pick.questionIndex === index)?.choice
                      const mark = !choice ? '—' : choice === item.correct ? '✓' : '×'
                      const tone = !choice ? 'text-slate-400' : choice === item.correct ? 'text-emerald-600' : 'text-rose-600'
                      return <td key={index} className={`px-2 py-2 text-center font-semibold ${tone}`}>{mark}</td>
                    })}
                    <td className="px-3 py-2 text-right font-semibold">
                      {fillAnswerCardText(t.answerCardsScore, { points: pointsByUser.get(student.userId) ?? 0, total: pointTotal })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  if (scanIndex == null) {
    return (
      <div className="fixed inset-0 z-[80] overflow-auto bg-white text-slate-900">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-6 sm:px-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <Link href={backHref} className="text-slate-500 hover:text-slate-900">{t.answerCardsBack}</Link>
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

  return (
    <div className="fixed inset-0 z-[80] overflow-auto bg-[#071425] text-white">
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-4 py-4">
        <div className="mb-3 flex items-center justify-between gap-3 text-sm">
          {exam ? (
            <Link href={backHref} className="text-white/70 hover:text-white">{t.answerCardsBack}</Link>
          ) : (
            <button type="button" className="text-white/70 hover:text-white" onClick={() => setScanIndex(null)}>
              {t.answerCardsBackToList}
            </button>
          )}
          <p className="truncate text-white/80">{view.className} · {view.title}</p>
          {view.status === 'live' ? (
            <button type="button" className="rounded-full bg-white/10 px-3 py-1" disabled={busy} onClick={() => void act('end')}>
              {t.answerCardsEnd}
            </button>
          ) : (
            <span className="text-white/60">{t.answerCardsEnded}</span>
          )}
        </div>

        {exam && !view.phoneConnected ? (
          <section className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl bg-white p-4 text-slate-900">
            <div className="rounded-xl bg-white p-2">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="" className="h-40 w-40" />
              ) : (
                <div className="h-40 w-40 bg-slate-100" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold">{t.answerCardsPhoneScan}</h2>
              <p className="mt-1 text-sm text-slate-600">{t.answerCardsConnectLead}</p>
              <p className="mt-2 text-sm font-medium text-amber-700">{t.answerCardsWaitingPhone}</p>
            </div>
          </section>
        ) : null}

        <div className={`grid flex-1 gap-4 ${view.showResults || exam ? 'lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]' : ''}`}>
          <section className="flex flex-col justify-center">
            {question ? (
              <article className="rounded-2xl bg-white p-5 text-slate-900 shadow-xl">
                <p className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white">
                  {fillAnswerCardText(t.answerCardsQuestionWord, { n: scanIndex + 1 })}
                </p>
                <p className="mt-4 text-lg font-medium leading-relaxed">{question.prompt}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {question.choices.map((choice, index) => {
                    const letter = 'ABCD'[index] as AnswerChoice
                    const revealed = (view.showResults || exam) && letter === question.correct
                    return (
                      <div key={letter} className={`flex items-start gap-2 rounded-xl border px-3 py-2 ${revealed ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
                        <span className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white ${CHOICE_COLOR[letter]}`}>{letter}</span>
                        <span className="text-sm">{choice || '—'}</span>
                      </div>
                    )
                  })}
                </div>
                <p className="mt-4 text-xs text-slate-500">{t.answerCardsRaiseHint}</p>
              </article>
            ) : (
              <p>{t.answerCardsNotFound}</p>
            )}
          </section>

          {(view.showResults || exam) && question && summary ? (
            <section className="rounded-2xl border border-amber-300/70 bg-[#140b24] p-4 shadow-[0_0_0_3px_rgba(251,191,36,0.35)]">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  {saved >= total && total > 0 ? <p className="text-sm font-semibold text-amber-200">{t.answerCardsAllScanned}</p> : null}
                  <p className="text-sm text-white/70">{fillAnswerCardText(t.answerCardsCorrectIs, { letter: question.correct })}</p>
                  <p className="mt-1 text-4xl font-black">{percent}%</p>
                  <p className="text-sm text-white/80">
                    {fillAnswerCardText(t.answerCardsCorrectRatio, { correct: summary.correct, answered: summary.answered })}
                  </p>
                </div>
                <p className="text-sm text-white/70">{fillAnswerCardText(t.answerCardsSavedOf, { saved, total })}</p>
              </div>
              <div className="mt-4 grid grid-cols-4 items-end gap-2">
                {letters.map((letter) => {
                  const count = summary.byChoice[letter]
                  const share = summary.answered > 0 ? Math.round((count / summary.answered) * 100) : 0
                  const height = 16 + (count / maxCount) * 96
                  return (
                    <div key={letter} className="text-center">
                      <div className="flex h-32 items-end justify-center">
                        <div className={`w-10 rounded-t-md ${CHOICE_COLOR[letter]} ${letter === question.correct ? 'ring-2 ring-white' : ''}`} style={{ height }} />
                      </div>
                      <p className="mt-1 text-xs font-semibold">{letter} {share}%</p>
                      <p className="line-clamp-2 text-[10px] text-white/60">{question.choices['ABCD'.indexOf(letter)]}</p>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-emerald-600 px-2 py-1">{t.answerCardsCorrect} {summary.correct}</span>
                <span className="rounded-full bg-rose-600 px-2 py-1">{t.answerCardsWrong} {summary.wrong}</span>
                <span className="rounded-full bg-slate-600 px-2 py-1">{t.answerCardsUnanswered} {summary.unanswered}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {(['all', 'A', 'B', 'C', 'D', 'miss'] as Filter[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`rounded-full px-2 py-1 text-xs ${filter === item ? 'bg-white text-slate-900' : 'bg-white/10'}`}
                    onClick={() => setFilter(item)}
                  >
                    {item === 'all' ? t.answerCardsAll : item === 'miss' ? t.answerCardsUnanswered : item}
                  </button>
                ))}
                <button type="button" className="rounded-full bg-white/10 px-2 py-1 text-xs" onClick={() => setHideNames((value) => !value)}>
                  {hideNames ? t.answerCardsShowNames : t.answerCardsHideNames}
                </button>
              </div>
              <p className="mt-2 text-xs text-white/60">{t.answerCardsReviewHint}</p>
              <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {visibleRoster.map((student) => {
                  const choice = pickByUser.get(student.userId)
                  const tone = !choice ? 'bg-slate-700' : choice === question.correct ? 'bg-emerald-600' : 'bg-rose-600'
                  return (
                    <div key={student.userId} className={`rounded-lg px-2 py-1.5 text-xs ${tone}`}>
                      <div className="flex items-center gap-1">
                        <span className="font-semibold">{String(student.cardNo).padStart(2, '0')}</span>
                        {hideNames ? <span className="min-w-0 flex-1" /> : <span className="min-w-0 flex-1 truncate">{student.shortName}</span>}
                        <span className="shrink-0 font-semibold">
                          {fillAnswerCardText(t.answerCardsScore, { points: pointsByUser.get(student.userId) ?? 0, total: pointTotal })}
                        </span>
                      </div>
                      {choice ? <p className="mt-0.5 text-right font-bold">{choice} {choice === question.correct ? '✓' : '×'}</p> : null}
                    </div>
                  )
                })}
              </div>
            </section>
          ) : null}
        </div>

        <div className="sticky bottom-3 mt-4 flex justify-center">
          <div className={`w-full max-w-5xl rounded-2xl bg-white p-1 shadow-2xl ${view.phoneConnected && view.status === 'live' ? 'ring-2 ring-emerald-300' : ''}`}>
            <div className="flex flex-wrap items-center gap-1 rounded-t-xl bg-[#101828] px-3 py-2">
              <button
                type="button"
                className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
                disabled={busy || scanIndex <= 0}
                onClick={() => { void focusQuestion(scanIndex - 1) }}
              >
                {scanIndex > 0
                  ? fillAnswerCardText(t.answerCardsQuestionWord, { n: scanIndex })
                  : t.answerCardsPrev}
              </button>
              <div className="flex min-w-0 flex-1 flex-wrap justify-center gap-1">
                {view.questions.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-current={index === scanIndex ? 'true' : undefined}
                    aria-label={fillAnswerCardText(t.answerCardsQuestionWord, { n: index + 1 })}
                    className={`h-8 min-w-8 rounded-full px-2 text-sm font-semibold ${index === scanIndex ? 'bg-amber-400 text-slate-900' : 'bg-white/10'}`}
                    disabled={busy}
                    onClick={() => { if (index !== scanIndex) void focusQuestion(index) }}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
                disabled={busy || (!exam && scanIndex >= view.questions.length - 1)}
                onClick={() => {
                  if (scanIndex >= view.questions.length - 1) {
                    if (exam) {
                      setSummaryDismissed(false)
                      setSummaryMode(true)
                    }
                    return
                  }
                  void focusQuestion(scanIndex + 1)
                }}
              >
                {scanIndex < view.questions.length - 1
                  ? fillAnswerCardText(t.answerCardsQuestionWord, { n: scanIndex + 2 })
                  : exam
                    ? t.answerCardsExamSummary
                    : t.answerCardsNext}
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-b-xl bg-[#101828] px-3 py-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 font-black text-slate-900">T</span>
                <span className="font-semibold">{fillAnswerCardText(t.answerCardsQuestionWord, { n: scanIndex + 1 })}</span>
                <span className="text-emerald-300">● {fillAnswerCardText(t.answerCardsSavedCount, { saved, total })}</span>
                <button type="button" className="rounded-full bg-white/10 px-2 py-1 text-xs" onClick={() => setConnectOpen(true)}>
                  {view.phoneConnected ? t.answerCardsPhoneReady : exam ? t.answerCardsPhoneScan : t.answerCardsConnect}
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {exam ? (
                  <button
                    type="button"
                    className="rounded-full bg-amber-400 px-3 py-1.5 text-sm font-semibold text-slate-900"
                    onClick={() => {
                      setSummaryDismissed(false)
                      setSummaryMode(true)
                    }}
                  >
                    {t.answerCardsExamSummary}
                  </button>
                ) : (
                  <>
                    <button type="button" className="rounded-full bg-white/10 px-3 py-1.5 text-sm" onClick={() => setScanIndex(null)}>
                      {t.answerCardsBackToList}
                    </button>
                    <button
                      type="button"
                      className="rounded-full bg-amber-400 px-3 py-1.5 text-sm font-semibold text-slate-900 disabled:opacity-50"
                      disabled={busy || view.status === 'closed'}
                      onClick={() => void act(view.showResults ? 'hide' : 'show')}
                    >
                      {view.showResults ? t.answerCardsHideResult : t.answerCardsResult}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {connectDialog}
    </div>
  )
}
