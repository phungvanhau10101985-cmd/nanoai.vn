'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ClassScoreboard } from '@/lib/db/answer-card-pg'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import {
  answerCardShortName,
  fillAnswerCardText,
  summarizeAnswerPicks,
  type AnswerChoice,
} from '@/lib/lop/answer-card'
import { SCORE_BANDS, ScoreSpread, bandOf, scoreOn100 } from '@/components/lop/score-spread'

const CHOICE_COLOR: Record<AnswerChoice, string> = {
  A: 'bg-rose-500',
  B: 'bg-sky-500',
  C: 'bg-amber-500',
  D: 'bg-emerald-500',
}

type Filter = 'all' | 'miss' | AnswerChoice

export function ClassScoreboardSheet({
  classId,
  board,
  t,
}: {
  classId: string
  board: ClassScoreboard
  t: Dictionary['classes']
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const ranked = [...board.students].sort((a, b) => {
    if (a.attempted !== b.attempted) return a.attempted ? -1 : 1
    return b.points - a.points || a.cardNo - b.cardNo
  })
  const pointTotal = board.questions.length
  const attemptedCount = ranked.filter((student) => student.attempted).length
  const percents = board.questions.map((question, index) => {
    if (attemptedCount === 0) return null
    let correct = 0
    for (const student of ranked) {
      if (!student.attempted) continue
      if (student.choices[index] === question.correct) correct += 1
    }
    return Math.round((correct / attemptedCount) * 100)
  })
  const mid = Math.ceil(ranked.length / 2)
  const columns = ranked.length > 1 ? [ranked.slice(0, mid), ranked.slice(mid)] : [ranked]
  const table = (students: ClassScoreboard['students']) => (
    <table className="w-full border-collapse text-left text-xs leading-tight">
      <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
        <tr>
          <th className="w-8 px-1.5 py-1 font-medium">#</th>
          <th className="px-1.5 py-1 font-medium">{t.answerCardsStudentColumn}</th>
          {board.questions.map((question, index) => (
            <th key={index} className="px-1 py-1 text-center font-medium normal-case tracking-normal">
              <button
                type="button"
                className="rounded-md px-1 py-0.5 hover:bg-white"
                title={fillAnswerCardText(t.answerCardsOpenQuestionStats, { n: index + 1 })}
                onClick={() => setOpenIndex(index)}
              >
                <span className="block tabular-nums text-slate-500">{index + 1}</span>
                <span className="block font-semibold text-emerald-600">{question.correct}✓</span>
                <span className="block font-semibold tabular-nums text-slate-900">
                  {percents[index] == null ? '—' : `${percents[index]}%`}
                </span>
              </button>
            </th>
          ))}
          <th className="px-1.5 py-1 text-right font-medium">{t.answerCardsExamSummary}</th>
        </tr>
      </thead>
      <tbody>
        {students.map((student) => (
          <tr key={student.userId} className="border-t border-slate-100">
            <td className="px-1.5 py-0.5 font-semibold tabular-nums">{String(student.cardNo).padStart(2, '0')}</td>
            <td className="max-w-[11rem] truncate px-1.5 py-0.5" title={student.name}>{student.name}</td>
            {board.questions.map((question, index) => {
              const choice = student.choices[index]
              if (!choice) return <td key={index} className="px-1 py-0.5 text-center text-slate-300">—</td>
              const ok = choice === question.correct
              return (
                <td key={index} className={`px-1 py-0.5 text-center font-semibold ${ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {choice}{ok ? '✓' : '×'}
                </td>
              )
            })}
            <td className={`whitespace-nowrap px-1.5 py-0.5 text-right font-semibold tabular-nums ${student.attempted ? SCORE_BANDS[bandOf(scoreOn100(student.points, pointTotal))].text : 'font-medium text-slate-400'}`}>
              {student.attempted ? `${student.points}/${pointTotal}` : t.answerCardsNotDone}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
  const question = openIndex == null ? null : board.questions[openIndex]
  return (
    <div className="fixed inset-0 z-[80] flex flex-col overflow-hidden bg-white text-slate-900">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-3 py-2">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold leading-tight">
            {t.answerCardsExamSummary}
            <span className="ml-2 font-normal text-slate-500">{board.className} · {board.title}</span>
          </h1>
          <p className="truncate text-xs text-slate-500">{t.answerCardsScoreboardLead}</p>
        </div>
        <Link href={`/lop/${classId}`} className="shrink-0 text-xs text-slate-500 hover:text-slate-900">
          {t.classPageBackToClass}
        </Link>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 py-1">
        <div className="lg:hidden">{table(ranked)}</div>
        <div className="hidden lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-4">
          {columns.map((students, index) => (
            <div key={index} className="min-w-0">{table(students)}</div>
          ))}
        </div>
        <div className="mt-3 flex justify-center pb-4">
          <ScoreSpread
            grades={ranked.filter((student) => student.attempted).map((student) => scoreOn100(student.points, pointTotal))}
            notDone={ranked.filter((student) => !student.attempted).length}
            notDoneLabel={t.answerCardsNotDone}
            title={t.answerCardsScoreSpread}
            scaleLabel={t.answerCardsScoreScale100}
            bandLabel={t.answerCardsScoreBand}
            countLabel={t.answerCardsScoreStudents}
            shareLabel={t.answerCardsScoreShare}
          />
        </div>
      </div>
      {question && openIndex != null ? (
        <QuestionStatsModal
          question={question}
          questionIndex={openIndex}
          students={ranked}
          pointTotal={pointTotal}
          t={t}
          onClose={() => setOpenIndex(null)}
        />
      ) : null}
    </div>
  )
}

function QuestionStatsModal({
  question,
  questionIndex,
  students,
  pointTotal,
  t,
  onClose,
}: {
  question: ClassScoreboard['questions'][number]
  questionIndex: number
  students: ClassScoreboard['students']
  pointTotal: number
  t: Dictionary['classes']
  onClose: () => void
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [hideNames, setHideNames] = useState(false)
  const picks = students.flatMap((student) => {
    const choice = student.choices[questionIndex]
    return choice ? [{ userId: student.userId, choice }] : []
  })
  const summary = summarizeAnswerPicks(students.map((student) => student.userId), picks, question.correct)
  const letters = question.choices.map((_, index) => 'ABCD'[index] as AnswerChoice)
  const maxCount = Math.max(1, ...letters.map((letter) => summary.byChoice[letter] ?? 0))
  const percent = summary.answered > 0 ? Math.round((summary.correct / summary.answered) * 100) : 0
  const visible = students.filter((student) => {
    const choice = student.choices[questionIndex]
    if (filter === 'all') return true
    if (filter === 'miss') return !choice
    return choice === filter
  })
  const rosterCols = Math.max(1, Math.min(8, Math.ceil(Math.sqrt(Math.max(visible.length, 1)))))
  const rosterRows = Math.max(1, Math.ceil(visible.length / rosterCols))
  const rosterText = visible.length > 80 ? 'text-[10px]' : 'text-xs'
  return (
    <div className="fixed inset-0 z-[140] flex h-dvh flex-col overflow-hidden bg-[#071425] text-white">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col px-3 py-2">
        <div className="mb-1.5 flex shrink-0 items-center justify-between gap-3 text-xs">
          <span className="w-8" />
          <p className="truncate text-white/80">
            {fillAnswerCardText(t.answerCardsQuestionWord, { n: questionIndex + 1 })}
          </p>
          <button
            type="button"
            aria-label={t.answerCardsBack}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-lg leading-none"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
          <article className="flex min-h-0 flex-col overflow-hidden rounded-xl bg-white p-3 text-slate-900 shadow-xl">
            <p className="inline-flex w-fit shrink-0 rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">
              {fillAnswerCardText(t.answerCardsQuestionWord, { n: questionIndex + 1 })}
            </p>
            <p className="mt-2 min-h-0 flex-1 overflow-y-auto text-sm font-medium leading-snug">{question.prompt}</p>
            <div className="mt-2 grid shrink-0 gap-1.5 sm:grid-cols-2">
              {question.choices.map((choice, index) => {
                const letter = 'ABCD'[index] as AnswerChoice
                const revealed = letter === question.correct
                return (
                  <div key={letter} className={`flex items-start gap-1.5 rounded-lg border px-2 py-1 ${revealed ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
                    <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white ${CHOICE_COLOR[letter]}`}>{letter}</span>
                    <span className="text-xs leading-snug">{choice || '—'}</span>
                  </div>
                )
              })}
            </div>
          </article>
          <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-amber-300/70 bg-[#140b24] p-2.5">
            <div className="flex shrink-0 items-end justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] text-white/70">{fillAnswerCardText(t.answerCardsCorrectIs, { letter: question.correct })}</p>
                <p className="text-3xl font-black leading-none">{percent}%</p>
                <p className="text-[11px] text-white/80">
                  {fillAnswerCardText(t.answerCardsCorrectRatio, { correct: summary.correct, answered: summary.answered })}
                </p>
              </div>
              <p className="shrink-0 text-[11px] text-white/70">
                {fillAnswerCardText(t.answerCardsSavedOf, { saved: summary.answered, total: students.length })}
              </p>
            </div>
            <div className="mt-1.5 grid shrink-0 grid-cols-4 items-end gap-1">
              {letters.map((letter) => {
                const count = summary.byChoice[letter] ?? 0
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
            </div>
            <div
              className="mt-1.5 grid min-h-0 flex-1 gap-1 overflow-hidden"
              style={{
                gridTemplateColumns: `repeat(${rosterCols}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${rosterRows}, minmax(0, 1fr))`,
              }}
            >
              {visible.map((student) => {
                const choice = student.choices[questionIndex]
                const tone = !choice ? 'bg-slate-700' : choice === question.correct ? 'bg-emerald-600' : 'bg-rose-600'
                return (
                  <div key={student.userId} className={`flex min-h-0 items-center gap-1 overflow-hidden rounded px-1.5 ${rosterText} ${tone}`}>
                    <span className="shrink-0 font-semibold tabular-nums">{String(student.cardNo).padStart(2, '0')}</span>
                    {hideNames ? <span className="min-w-0 flex-1" /> : <span className="min-w-0 flex-1 truncate">{answerCardShortName(student.name)}</span>}
                    <span className="shrink-0 font-semibold tabular-nums">
                      {student.attempted ? `${student.points}/${pointTotal}` : t.answerCardsNotDone}
                    </span>
                    {choice ? <span className="w-3 shrink-0 text-center font-bold">{choice}</span> : null}
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
