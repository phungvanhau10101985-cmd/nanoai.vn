'use client'

import { useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { WebLocale } from '@/lib/i18n/config'
import type { HomeworkHelpCopy } from '@/lib/homework-help/homework-help-copy'
import { HOMEWORK_SOLUTION_CREDIT_COST } from '@/lib/homework-help/homework-help-solution-cost'
import type { TutorAnswer, TutorLabel } from '@/lib/ai-tutor/ai-tutor-types'
import {
  knowledgeLinesAsTags,
  type HomeworkModelMark,
  type HomeworkProblem,
} from '@/lib/homework-help/homework-help-guide'
import { openHomeworkKnowledgeTag, openHomeworkSolution } from '@/app/ho-tro-lam-bai/actions'
import { StudyCacheMark } from '@/components/student-study/study-cache-mark'
import { HomeworkPlotFigure } from '@/components/student-study/homework-plot-figure'
import { StudyFormulaText } from '@/components/student-study/study-formula-text'

function ModelMark({ mark }: { mark: HomeworkModelMark }) {
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-muted px-1 text-[10px] font-bold leading-none text-muted-foreground">
      {mark}
    </span>
  )
}

export function HomeworkProblemCard({
  locale,
  copy,
  problem,
  solutionPaid,
  onSolutionPaid,
  onPaymentRequired,
}: {
  locale: WebLocale
  copy: HomeworkHelpCopy
  problem: HomeworkProblem
  solutionPaid: boolean
  onSolutionPaid: (statement: string) => void
  onPaymentRequired: () => void
}) {
  const [shownHints, setShownHints] = useState(0)
  const [answerOpen, setAnswerOpen] = useState(false)
  const [solution, setSolution] = useState('')
  const [solutionCached, setSolutionCached] = useState(false)
  const [solutionBusy, setSolutionBusy] = useState(false)
  const [solutionError, setSolutionError] = useState('')
  const [tagOpen, setTagOpen] = useState<TutorLabel | null>(null)
  const [tagAnswer, setTagAnswer] = useState<TutorAnswer | null>(null)
  const [tagBusy, setTagBusy] = useState(false)
  const [tagError, setTagError] = useState('')
  const tagRequestRef = useRef(0)
  const hintsLeft = shownHints < problem.hints.length
  const tags = problem.tags.length > 0 ? problem.tags : knowledgeLinesAsTags(problem.knowledge)
  const guideMark: HomeworkModelMark = problem.guideMark === 'G' || problem.answerMark === 'G' ? 'G' : 'D'
  const canShowAnswer = Boolean(problem.answer) && !hintsLeft && !answerOpen
  const creditText =
    locale === 'vi'
      ? String(HOMEWORK_SOLUTION_CREDIT_COST).replace('.', ',')
      : String(HOMEWORK_SOLUTION_CREDIT_COST)
  const solutionLabel = solutionPaid
    ? copy.showSolutionOwned
    : copy.showSolution.replace('{credits}', creditText)

  async function openSolution() {
    setSolutionBusy(true)
    setSolutionError('')
    try {
      const result = await openHomeworkSolution({
        locale,
        statement: problem.statement,
        answer: problem.answer,
      })
      if (!result.ok) {
        if (result.code === 'payment_required') onPaymentRequired()
        else setSolutionError(copy.errors[result.code] ?? copy.errors.ai_unavailable)
        return
      }
      setSolution(result.data.solution)
      setSolutionCached(result.data.cached)
      onSolutionPaid(problem.statement)
    } catch {
      setSolutionError(copy.errors.ai_unavailable)
    } finally {
      setSolutionBusy(false)
    }
  }

  async function openTag(tag: TutorLabel) {
    const request = tagRequestRef.current + 1
    tagRequestRef.current = request
    setTagOpen(tag)
    setTagAnswer(null)
    setTagError('')
    setTagBusy(true)
    try {
      const result = await openHomeworkKnowledgeTag({
        locale,
        labelKey: tag.key,
        title: tag.title,
      })
      if (request !== tagRequestRef.current) return
      if (!result.ok) {
        if (result.code === 'payment_required') onPaymentRequired()
        else setTagError(copy.errors[result.code] ?? copy.errors.ai_unavailable)
        return
      }
      setTagAnswer(result.data)
    } catch {
      if (request !== tagRequestRef.current) return
      setTagError(copy.errors.ai_unavailable)
    } finally {
      if (request === tagRequestRef.current) setTagBusy(false)
    }
  }

  function closeTag() {
    tagRequestRef.current += 1
    setTagOpen(null)
    setTagBusy(false)
  }

  return (
    <article className="max-w-[92%] space-y-3 rounded-xl border bg-background p-4">
      <section className="space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.statement}</h3>
          {problem.statementMark ? <ModelMark mark={problem.statementMark} /> : null}
          {problem.cached ? <StudyCacheMark label={copy.cachedFromDb} /> : null}
        </div>
        <h2 className="text-base font-normal leading-7">
          <StudyFormulaText text={problem.statement} />
        </h2>
      </section>

      {problem.knowledge.length > 0 || tags.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.knowledge}</h3>
            <ModelMark mark={guideMark} />
          </div>
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Button
                  key={`${tag.key}-${tag.title}`}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={tagBusy}
                  onClick={() => void openTag(tag)}
                >
                  <StudyFormulaText text={tag.title} />
                </Button>
              ))}
            </div>
          ) : null}
          {problem.knowledge.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm leading-6">
              {problem.knowledge.map((item) => (
                <li key={item}>
                  <StudyFormulaText text={item} />
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : !problem.answer ? (
        <p className="text-sm leading-6 text-muted-foreground">{copy.knowledgeHeld}</p>
      ) : null}

      {problem.thinking.length > 0 ? (
        <section className="space-y-1 rounded-lg bg-muted p-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.thinking}</h3>
            <ModelMark mark={guideMark} />
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-sm leading-6">
            {problem.thinking.map((item) => (
              <li key={item}>
                <StudyFormulaText text={item} />
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <HomeworkPlotFigure statement={problem.statement} title={copy.figure} locale={locale} />

      {shownHints > 0 ? (
        <div className="space-y-1">
          <ModelMark mark={guideMark} />
          <ol className="list-decimal space-y-1 pl-5 text-sm leading-6" start={problem.thinking.length + 1}>
            {problem.hints.slice(0, shownHints).map((item) => (
              <li key={item}>
                <StudyFormulaText text={item} />
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {hintsLeft ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setShownHints((count) => count + 1)}>
          {copy.nextHint}
        </Button>
      ) : null}
      {canShowAnswer ? (
        <div className="space-y-2">
          <p className="rounded-lg bg-muted px-3 py-2 text-sm leading-6">{copy.answerEncourage}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setAnswerOpen(true)}>
            {copy.showAnswer}
          </Button>
        </div>
      ) : null}

      {!problem.answer && !hintsLeft ? (
        <p className="text-sm leading-6 text-muted-foreground">{copy.answerHeld}</p>
      ) : null}

      {answerOpen && problem.answer ? (
        <section className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.answer}</h3>
            {problem.answerMark ? <ModelMark mark={problem.answerMark} /> : null}
          </div>
          <p className="text-sm leading-7">
            <StudyFormulaText text={problem.answer} />
          </p>
        </section>
      ) : null}

      {answerOpen && problem.answer ? (
        <section className="space-y-2">
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm leading-6">
            {copy.solutionWarning}
          </p>
          {solution ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {copy.solutionTitle}
                </h3>
                <ModelMark mark="D" />
                {solutionCached ? <StudyCacheMark label={copy.cachedFromDb} /> : null}
              </div>
              <p className="text-sm leading-7">
                <StudyFormulaText text={solution} />
              </p>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => void openSolution()} disabled={solutionBusy}>
              {solutionBusy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {copy.solutionOpening}
                </span>
              ) : (
                solutionLabel
              )}
            </Button>
          )}
          {solutionError ? <p className="text-sm text-destructive">{solutionError}</p> : null}
        </section>
      ) : null}

      <Dialog
        open={tagOpen != null}
        onOpenChange={(open) => {
          if (!open) closeTag()
        }}
      >
        <DialogContent
          className="z-[80] flex max-h-[min(32rem,85dvh)] w-[calc(100%-1.5rem)] max-w-md flex-col gap-3 overflow-hidden p-4 sm:p-6 [&>button]:z-20 [&>button]:bg-background"
          overlayClassName="z-[70]"
        >
          <DialogHeader className="shrink-0 pr-8 text-left">
            <DialogTitle>{tagAnswer?.title || tagOpen?.title}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tagBusy ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {copy.tagLoading}
              </p>
            ) : null}
            {tagError ? <p className="text-sm text-destructive">{tagError}</p> : null}
            {tagAnswer ? (
              <div className="space-y-3">
                {tagAnswer.share !== 'private' ? <StudyCacheMark label={copy.cachedFromDb} /> : null}
                <section className="space-y-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.explain}</h3>
                  <p className="text-sm leading-7">
                    <StudyFormulaText text={tagAnswer.explanation} />
                  </p>
                </section>
                {tagAnswer.practice ? (
                  <section className="space-y-1 rounded-lg bg-muted p-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.practice}</h3>
                    <p className="text-sm leading-7">
                      <StudyFormulaText text={tagAnswer.practice} />
                    </p>
                  </section>
                ) : null}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </article>
  )
}
