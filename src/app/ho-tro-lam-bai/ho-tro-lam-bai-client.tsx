'use client'

import { useState } from 'react'
import { Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { WebLocale } from '@/lib/i18n/config'
import { compressEssayImageForUpload } from '@/lib/exam-essay-client-image'
import { homeworkHelpCopy } from '@/lib/homework-help/homework-help-copy'
import type { HomeworkGuide, HomeworkProblem, HomeworkReview } from '@/lib/homework-help/homework-help-guide'
import { explainHomeworkPhoto, reviewHomeworkWork } from '@/app/ho-tro-lam-bai/actions'

const MAX_IMAGES = 3

type Props = {
  locale: WebLocale
}

export default function HoTroLamBaiClient({ locale }: Props) {
  const copy = homeworkHelpCopy(locale)
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [guide, setGuide] = useState<HomeworkGuide | null>(null)
  const [reading, setReading] = useState(false)
  const [error, setError] = useState('')

  function replacePreviews(next: string[]) {
    setPreviews((current) => {
      for (const url of current) URL.revokeObjectURL(url)
      return next
    })
  }

  async function addFiles(list: FileList | null) {
    if (!list?.length) return
    const picked = [...list].slice(0, MAX_IMAGES - files.length)
    if (!picked.length) {
      setError(copy.errors.too_many)
      return
    }
    const compressed = await Promise.all(picked.map((file) => compressEssayImageForUpload(file)))
    const nextFiles = [...files, ...compressed].slice(0, MAX_IMAGES)
    setFiles(nextFiles)
    replacePreviews(nextFiles.map((file) => URL.createObjectURL(file)))
    setGuide(null)
    setError('')
  }

  function removeAt(index: number) {
    const nextFiles = files.filter((_, i) => i !== index)
    setFiles(nextFiles)
    replacePreviews(nextFiles.map((file) => URL.createObjectURL(file)))
  }

  async function readPhoto() {
    if (!files.length) {
      setError(copy.errors.missing_image)
      return
    }
    setReading(true)
    setError('')
    setGuide(null)
    const formData = new FormData()
    formData.set('locale', locale)
    for (const file of files) formData.append('images', file)
    const result = await explainHomeworkPhoto(formData)
    setReading(false)
    if (!result.ok) {
      setError(copy.errors[result.code] ?? copy.errors.unreadable)
      return
    }
    setGuide(result.data)
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <p className="text-sm leading-6 text-muted-foreground">{copy.intro}</p>

      <div className="flex flex-wrap gap-2">
        <input
          id="homework-help-gallery"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={(event) => {
            void addFiles(event.target.files)
            event.target.value = ''
          }}
        />
        <Button type="button" variant="outline" asChild>
          <label htmlFor="homework-help-gallery" className="cursor-pointer">
            {copy.pickPhoto}
          </label>
        </Button>
        <div className="inline-flex md:hidden">
          <input
            id="homework-help-camera"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              void addFiles(event.target.files)
              event.target.value = ''
            }}
          />
          <Button type="button" variant="outline" asChild>
            <label htmlFor="homework-help-camera" className="cursor-pointer">
              <Camera className="mr-1.5 h-4 w-4" aria-hidden />
              {copy.takePhoto}
            </label>
          </Button>
        </div>
        <Button type="button" onClick={() => void readPhoto()} disabled={reading || !files.length}>
          {reading ? copy.reading : copy.readButton}
        </Button>
      </div>

      {previews.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {previews.map((url, index) => (
            <div key={url} className="relative h-28 w-28 overflow-hidden rounded-lg border bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                className="absolute right-1 top-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium shadow"
                onClick={() => removeAt(index)}
              >
                {copy.removeImage}
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {guide && guide.problems.length === 0 ? (
        <p className="rounded-lg border bg-card px-4 py-3 text-sm">{guide.note || copy.emptyPhoto}</p>
      ) : null}

      {guide?.problems.map((problem, index) => (
        <ProblemCard
          key={`${index}-${problem.statement.slice(0, 24)}`}
          locale={locale}
          problem={problem}
          index={index}
        />
      ))}

      {guide && guide.problems.length > 0 ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setFiles([])
            replacePreviews([])
            setGuide(null)
            setError('')
          }}
        >
          {copy.anotherPhoto}
        </Button>
      ) : null}
    </div>
  )
}

function ProblemCard({
  locale,
  problem,
  index,
}: {
  locale: WebLocale
  problem: HomeworkProblem
  index: number
}) {
  const copy = homeworkHelpCopy(locale)
  const [shownHints, setShownHints] = useState(0)
  const [answerOpen, setAnswerOpen] = useState(false)
  const [attempt, setAttempt] = useState('')
  const [review, setReview] = useState<HomeworkReview | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [error, setError] = useState('')
  const hintsLeft = shownHints < problem.hints.length
  const canShowAnswer = Boolean(problem.answer) && !hintsLeft && !answerOpen

  async function checkWork() {
    setReviewing(true)
    setError('')
    const result = await reviewHomeworkWork({
      locale,
      statement: problem.statement,
      attempt,
    })
    setReviewing(false)
    if (!result.ok) {
      setError(copy.errors[result.code] ?? copy.errors.ai_unavailable)
      return
    }
    setReview(result.data)
  }

  return (
    <article className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      <section className="space-y-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.statement}</h2>
        <p className="text-sm leading-6">{problem.statement}</p>
      </section>

      {problem.knowledge.length > 0 ? (
        <section className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.knowledge}</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6">
            {problem.knowledge.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-sm leading-6 text-muted-foreground">{copy.knowledgeHeld}</p>
      )}

      {problem.thinking.length > 0 ? (
        <section className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.thinking}</h3>
          <ol className="list-decimal space-y-1 pl-5 text-sm leading-6">
            {problem.thinking.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>
      ) : null}

      {shownHints > 0 ? (
        <ol className="list-decimal space-y-1 pl-5 text-sm leading-6" start={problem.thinking.length + 1}>
          {problem.hints.slice(0, shownHints).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      ) : null}

      {hintsLeft ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setShownHints((count) => count + 1)}>
          {copy.nextHint}
        </Button>
      ) : null}

      {canShowAnswer ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setAnswerOpen(true)}>
          {copy.showAnswer}
        </Button>
      ) : null}

      {!problem.answer && !hintsLeft ? (
        <p className="text-sm leading-6 text-muted-foreground">{copy.answerHeld}</p>
      ) : null}

      {answerOpen && problem.answer ? (
        <section className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.answer}</h3>
          <p className="text-sm leading-6">{problem.answer}</p>
        </section>
      ) : null}

      <section className="space-y-2 border-t pt-4">
        <label
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          htmlFor={`homework-attempt-${index}`}
        >
          {copy.attemptLabel}
        </label>
        <Textarea
          id={`homework-attempt-${index}`}
          value={attempt}
          placeholder={copy.attemptPlaceholder}
          onChange={(event) => setAttempt(event.target.value)}
          rows={4}
        />
        <Button type="button" size="sm" onClick={() => void checkWork()} disabled={reviewing || !attempt.trim()}>
          {reviewing ? copy.reviewing : copy.reviewButton}
        </Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {review ? (
          <div className="space-y-2 text-sm leading-6">
            <ul className="space-y-2">
              {review.checks.map((check) => (
                <li key={`${check.label}-${check.note}`}>
                  <span className="font-medium">{check.ok ? copy.checkOk : copy.checkBad}.</span> {check.label}
                  {check.note ? ` — ${check.note}` : ''}
                </li>
              ))}
            </ul>
            {review.gap ? (
              <p>
                <span className="font-medium">{copy.gap}.</span> {review.gap}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
    </article>
  )
}
