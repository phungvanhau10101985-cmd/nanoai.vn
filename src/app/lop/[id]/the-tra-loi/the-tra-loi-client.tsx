'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { ChieuTheTraLoiClient } from '@/app/lop/[id]/the-tra-loi/chieu/[roundId]/chieu-client'
import { fillAnswerCardText } from '@/lib/lop/answer-card'
import type { AnswerCardRoundSummary, AnswerCardRoundView, AnswerCardSource, AnswerCardStudent } from '@/lib/db/answer-card-pg'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { Button } from '@/components/ui/button'
import { ClassNameTag } from '../class-name-tag'
import {
  AnswerCardClassFileButtons,
  AnswerCardExportError,
  AnswerCardExportHint,
  AnswerCardExportProvider,
  AnswerCardSelectBox,
  AnswerCardStudentButton,
} from '../answer-card-downloads'

export function TheTraLoiClient({
  classId,
  className,
  schoolName = '',
  subjectQuery,
  cards,
  sources,
  rounds,
  schemaMissing,
  loadError,
  t,
}: {
  classId: string
  className: string
  schoolName?: string
  subjectQuery: string
  cards: AnswerCardStudent[]
  sources: AnswerCardSource[]
  rounds: AnswerCardRoundSummary[]
  schemaMissing: boolean
  loadError: boolean
  t: Dictionary['classes']
}) {
  const [startingId, setStartingId] = useState('')
  const [openingId, setOpeningId] = useState('')
  const [board, setBoard] = useState<AnswerCardRoundView | null>(null)
  const [error, setError] = useState('')
  const backHref = subjectQuery ? `/lop/${classId}?${subjectQuery}` : `/lop/${classId}`

  async function start(source: AnswerCardSource) {
    setStartingId(source.id)
    setError('')
    try {
      const res = await fetch(`/api/lop/${classId}/answer-cards/rounds`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceKind: source.kind, sourceId: source.id }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.id) {
        setError(data?.error === 'no_mcq' ? t.answerCardsNoMcq : data?.error === 'schema' ? t.answerCardsSchema : t.answerCardsLoadError)
        return
      }
      await openBoard(String(data.id))
    } catch {
      setError(t.answerCardsLoadError)
    } finally {
      setStartingId('')
    }
  }

  async function openBoard(id: string) {
    setOpeningId(id)
    setError('')
    try {
      const res = await fetch(`/api/lop/answer-cards/rounds/${id}`, { cache: 'no-store' })
      const data = await res.json().catch(() => null) as AnswerCardRoundView | null
      if (!res.ok || !data?.id) {
        setError(t.answerCardsLoadError)
        return
      }
      setBoard(data)
    } catch {
      setError(t.answerCardsLoadError)
    } finally {
      setOpeningId('')
    }
  }

  const kindLabel = {
    exam: t.answerCardsKindExam,
    homework: t.answerCardsKindHomework,
    worksheet: t.answerCardsKindWorksheet,
  }

  const exportItems = cards.map((card) => ({
    cardNo: card.cardNo,
    name: card.name,
    token: card.token,
    studentCodeLabel: card.studentCode ? `${t.studentIdentityCodeLabel} ${card.studentCode}` : undefined,
    loginCodeLabel: card.loginCode ? t.entryLoginCodeOnCard.replace('{code}', card.loginCode) : undefined,
  }))

  return (
    <div>
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={backHref} className="inline-flex text-sm text-muted-foreground hover:text-foreground">
            ← {t.classPageBackToClass}
          </Link>
          <ClassNameTag name={className} school={schoolName} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t.answerCardsTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{className}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.answerCardsLead}</p>
        </div>
        {schemaMissing ? <p className="text-sm text-destructive">{t.answerCardsSchema}</p> : null}
        {loadError ? <p className="text-sm text-destructive">{t.answerCardsLoadError}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {schemaMissing || loadError ? null : (
        <>
        <section className="rounded-xl border border-border/70 bg-background/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">{t.answerCardsSourcesTitle}</h2>
          </div>
          {sources.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t.answerCardsEmptySources}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {sources.map((source) => (
                <li key={`${source.kind}-${source.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{source.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {kindLabel[source.label]} · {fillAnswerCardText(t.answerCardsMcqCount, { n: source.mcqCount })}
                    </p>
                  </div>
                  <Button type="button" size="sm" disabled={startingId === source.id} onClick={() => void start(source)}>
                    {startingId === source.id ? '…' : t.answerCardsStart}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border/70 bg-background/60 p-4">
          <h2 className="text-base font-semibold">{t.answerCardsRoundsTitle}</h2>
          {rounds.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t.answerCardsNoRounds}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {rounds.map((round) => (
                <li key={round.id}>
                  <button
                    type="button"
                    disabled={openingId === round.id}
                    onClick={() => void openBoard(round.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-left text-sm transition-colors hover:bg-teal-100 disabled:opacity-60 dark:border-teal-400/45 dark:bg-teal-950/45 dark:hover:bg-teal-950/70"
                  >
                    <span>
                      <span className="font-medium">{round.title}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {fillAnswerCardText(t.answerCardsMcqCount, { n: round.questionCount })}
                        {' · '}
                        {round.status === 'live' ? t.answerCardsLive : t.answerCardsEnded}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">{openingId === round.id ? '…' : t.answerCardsRoundOpen}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <AnswerCardExportProvider className={className} schoolName={schoolName} t={t}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">{t.answerCardsPrint}</h2>
              <p className="text-sm text-muted-foreground">{t.answerCardsPrintHint}</p>
              <AnswerCardExportHint />
              <p className="text-xs text-muted-foreground">{fillAnswerCardText(t.answerCardsRosterCount, { n: cards.length })}</p>
            </div>
            <AnswerCardClassFileButtons cards={exportItems} />
          </div>
          <AnswerCardExportError />
          {cards.length === 0 ? <p className="text-sm text-muted-foreground">{t.answerCardsEmptyStudents}</p> : (
            <ul className="divide-y divide-border/80 overflow-hidden rounded-xl border border-border/70 bg-card">
              {exportItems.map((card, index) => (
                <li key={cards[index]?.userId ?? card.token} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <AnswerCardSelectBox token={card.token} name={card.name} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">#{card.cardNo} · {card.name}</span>
                      {card.studentCodeLabel || card.loginCodeLabel ? (
                        <span className="block truncate font-mono text-[11px] text-muted-foreground">
                          {[card.studentCodeLabel, card.loginCodeLabel].filter(Boolean).join(' · ')}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <AnswerCardStudentButton card={card} />
                </li>
              ))}
            </ul>
          )}
        </AnswerCardExportProvider>
        </>
        )}
      </div>
      {board && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[220]">
              <ChieuTheTraLoiClient
                initial={board}
                subjectQuery={subjectQuery}
                t={t}
                onClose={() => setBoard(null)}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
