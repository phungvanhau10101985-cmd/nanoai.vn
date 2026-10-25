'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  confirmWorksheetQuestionReview,
  getWorksheetQuestionReviewItem,
  saveWorksheetQuestionPersonalEdit,
} from '@/app/tao-giao-trinh/actions'
import { latexToReadable } from '@/app/tao-giao-trinh/lib/latex-to-readable'
import { WORKSHEET_REVIEW_AGREES } from '@/app/tao-giao-trinh/lib/worksheet-review-count'

type ReviewItem = {
  questionId: string
  usingBlock: string
  otherBlock: string | null
  otherIsOriginal: boolean
  agreeCount: number
  rejectCount: number
  editCount: number
  authorIsMe: boolean
  pending: boolean
}

type Labels = {
  title: string
  close: string
  problem: string
  solution: string
  noProblem: string
  noSolution: string
  edit: string
  save: string
  confirm: string
  disagree: string
  usingEdit: string
  usingOriginal: string
  originalCompare: string
  editCompare: string
  counts: string
  rule: string
  editShort: string
  editBad: string
}

function showText(markdown: string) {
  return latexToReadable(markdown)
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*\[([^\]]+)\]\*\*/g, '[$1]')
    .replace(/\*\*/g, '')
    .trim()
}

function fillTpl(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''))
}

export function ExamQuestionQuickView({
  questionId,
  fallbackProblem,
  fallbackSolution,
  labels,
  onClose,
}: {
  questionId: string
  fallbackProblem: string
  fallbackSolution: string
  labels: Labels
  onClose: () => void
}) {
  const [item, setItem] = useState<ReviewItem | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const result = await getWorksheetQuestionReviewItem(questionId)
    if (!result || 'error' in result) {
      setError(result && 'error' in result && result.error ? result.error : labels.editBad)
      return
    }
    setItem(result)
    setError('')
  }, [labels.editBad, questionId])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    if (draft.trim().length < 3) {
      setError(labels.editShort)
      return
    }
    setBusy(true)
    setError('')
    try {
      const saved = await saveWorksheetQuestionPersonalEdit(questionId, draft)
      if (saved && 'error' in saved && saved.error) {
        setError(saved.error)
        return
      }
      setEditing(false)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const confirm = async (choice: 'agree' | 'reject') => {
    setBusy(true)
    setError('')
    try {
      const result = await confirmWorksheetQuestionReview(questionId, choice)
      if (result && 'error' in result && result.error) {
        setError(result.error)
        return
      }
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6">
      <div className="flex h-[min(92vh,920px)] w-full max-w-5xl flex-col overflow-hidden rounded-lg border bg-background shadow-xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-background px-4 py-3">
          <p className="text-sm font-semibold">{labels.title}</p>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>{labels.close}</Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          <p className="shrink-0 text-xs text-muted-foreground">{labels.rule}</p>
          {editing ? (
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="min-h-[48vh] w-full flex-1 resize-y rounded-md border bg-background p-3 text-sm leading-relaxed"
              spellCheck={false}
            />
          ) : item ? (
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-xs font-medium text-emerald-700">
                  {item.pending && item.otherIsOriginal ? labels.usingEdit : labels.usingOriginal}
                </p>
                <pre className="whitespace-pre-wrap rounded border bg-muted/30 p-3 text-sm leading-relaxed">{showText(item.usingBlock)}</pre>
              </div>
              {item.otherBlock ? (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    {item.otherIsOriginal ? labels.originalCompare : labels.editCompare}
                  </p>
                  <pre className="whitespace-pre-wrap rounded border bg-muted/20 p-3 text-sm leading-relaxed text-muted-foreground">{showText(item.otherBlock)}</pre>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{labels.problem}</p>
                <div className="rounded border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{fallbackProblem || labels.noProblem}</div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{labels.solution}</p>
                <div className="rounded border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{fallbackSolution || labels.noSolution}</div>
              </div>
            </div>
          )}
          {item ? (
            <p className="text-xs text-muted-foreground">
              {fillTpl(labels.counts, {
                agree: item.agreeCount,
                reject: item.rejectCount,
                need: WORKSHEET_REVIEW_AGREES,
                edits: item.editCount,
              })}
            </p>
          ) : null}
          {error ? <p className="shrink-0 text-sm text-destructive">{error}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t px-4 py-3">
            {editing ? (
              <Button type="button" size="sm" disabled={busy} onClick={() => void save()}>{labels.save}</Button>
            ) : (
              <>
                <Button type="button" size="sm" disabled={busy || !item} onClick={() => void confirm('agree')}>
                  {labels.confirm}
                </Button>
                {item?.pending && !item.authorIsMe ? (
                  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void confirm('reject')}>
                    {labels.disagree}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || !item}
                  onClick={() => {
                    setDraft(item?.usingBlock ?? '')
                    setEditing(true)
                  }}
                >
                  {labels.edit}
                </Button>
              </>
            )}
        </div>
      </div>
    </div>
  )
}
