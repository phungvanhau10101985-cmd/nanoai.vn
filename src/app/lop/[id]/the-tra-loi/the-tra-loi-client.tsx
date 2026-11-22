'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { fillAnswerCardText } from '@/lib/lop/answer-card'
import type { AnswerCardRoundSummary, AnswerCardSource, AnswerCardStudent } from '@/lib/db/answer-card-pg'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { Button } from '@/components/ui/button'
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
  const router = useRouter()
  const [startingId, setStartingId] = useState('')
  const [error, setError] = useState('')
  const backHref = subjectQuery ? `/lop/${classId}?${subjectQuery}` : `/lop/${classId}`
  const scope = subjectQuery ? `?${subjectQuery}` : ''

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
      router.push(`/lop/${classId}/the-tra-loi/chieu/${data.id}${scope}`)
    } catch {
      setError(t.answerCardsLoadError)
    } finally {
      setStartingId('')
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
        <Link href={backHref} className="inline-flex text-sm text-muted-foreground hover:text-foreground">
          ← {t.classPageBackToClass}
        </Link>
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
                  <Link
                    href={`/lop/${classId}/the-tra-loi/chieu/${round.id}${scope}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm hover:bg-muted/40"
                  >
                    <span>
                      <span className="font-medium">{round.title}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {fillAnswerCardText(t.answerCardsMcqCount, { n: round.questionCount })}
                        {' · '}
                        {round.status === 'live' ? t.answerCardsLive : t.answerCardsEnded}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">{t.answerCardsRoundOpen}</span>
                  </Link>
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
    </div>
  )
}
