'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { getCurriculumById } from '@/app/tao-giao-trinh/actions'
import { formatCurriculumCredits } from '@/app/tao-giao-trinh/lib/curriculum-credit-costs'
import { quoteWorksheetQuestionBatch } from '@/app/tao-giao-trinh/lib/worksheet-ai-quota'

type Kind = 'quiz' | 'essay'

const QUIZ_LEVELS = ['easy', 'medium', 'hard'] as const
const ESSAY_LEVELS = ['nhan-biet', 'thong-hieu', 'van-dung-thap', 'van-dung-cao', 'thuc-te'] as const

type Labels = {
  title: string
  count: string
  lesson: string
  addType: string
  removeType: string
  submit: string
  charge: string
  chargeMixed: string
  running: string
  done: string
  reportTitle: string
  reportCreated: string
  reportFailed: string
  reportCredits: string
  reportFree: string
  reportMixed: string
  reportPlace: string
  reportClose: string
  difficulty: string
  levels: Record<string, string>
  error: string
}

type CreateReport = {
  requested: number
  created: number
  free: number
  credits: number
  lesson: string
  error: string
}

type Row = { id: string; difficulty: string; count: number }

function fillTpl(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''))
}

async function pollJob(jobId: string): Promise<{ ok: boolean; created: number; error: string; worksheetId: string }> {
  for (let i = 0; i < 90; i++) {
    await new Promise((resolve) => window.setTimeout(resolve, 2000))
    const res = await fetch(`/api/worksheet-job-status?jobId=${encodeURIComponent(jobId)}`, { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, created: 0, error: String(data?.error ?? res.statusText), worksheetId: '' }
    const status = String(data?.status ?? '')
    if (status === 'completed') {
      const result = data?.result as { created?: number; questionIds?: string[]; worksheetId?: string } | null
      const created = Number(result?.created ?? result?.questionIds?.length ?? 0)
      return {
        ok: true,
        created: Number.isFinite(created) ? created : 0,
        error: '',
        worksheetId: typeof result?.worksheetId === 'string' ? result.worksheetId : '',
      }
    }
    if (status === 'failed' || status === 'error') {
      return { ok: false, created: 0, error: String(data?.error ?? 'failed'), worksheetId: '' }
    }
  }
  return { ok: false, created: 0, error: 'timeout', worksheetId: '' }
}

async function verifyCreatedSheet(worksheetId: string, markdown: string) {
  if (!worksheetId) return
  try {
    await fetch('/api/worksheet-verify-background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worksheetId, curriculumMarkdown: markdown }),
    })
  } catch {
    /* Câu vẫn vào ngân hàng. Lần tạo đề duyệt lại câu chưa có verified_at. */
  }
}

function nextId(): string {
  return `row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function ExamCreateQuestions({
  kind,
  curricula,
  subjectId,
  gradeLevelId,
  labels,
  onDone,
  onError,
}: {
  kind: Kind
  curricula: Array<{ id: string; topic: string }>
  subjectId: string
  gradeLevelId: string
  labels: Labels
  onDone: (curriculumId: string, created: number) => void
  onError: (message: string) => void
}) {
  const levels = kind === 'quiz' ? QUIZ_LEVELS : ESSAY_LEVELS
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Row[]>(() => [
    { id: 'row-1', difficulty: levels[1] ?? levels[0], count: 1 },
  ])
  const [curriculumId, setCurriculumId] = useState(curricula[0]?.id ?? '')
  const [running, setRunning] = useState(false)
  const [report, setReport] = useState<CreateReport | null>(null)
  const [createdSoFar, setCreatedSoFar] = useState<number | null>(null)
  const [quotaNonce, setQuotaNonce] = useState(0)
  const maxCount = kind === 'quiz' ? 20 : 10
  const selectedId = curricula.some((c) => c.id === curriculumId) ? curriculumId : (curricula[0]?.id ?? '')
  const used = new Set(rows.map((row) => row.difficulty))
  const canAdd = levels.some((level) => !used.has(level))
  const requested = rows.reduce(
    (sum, row) => sum + Math.max(1, Math.min(maxCount, Math.floor(row.count) || 1)),
    0
  )
  const quote = createdSoFar == null
    ? null
    : quoteWorksheetQuestionBatch({
      requested,
      curriculumCreated: createdSoFar,
      hasCurriculum: Boolean(selectedId),
    })
  const chargeText = quote && quote.credits > 0
    ? (quote.free > 0
      ? fillTpl(labels.chargeMixed, { free: quote.free, credits: formatCurriculumCredits(quote.credits) })
      : fillTpl(labels.charge, { credits: formatCurriculumCredits(quote.credits) }))
    : ''

  useEffect(() => {
    if (!open || !selectedId) return
    const ac = new AbortController()
    setCreatedSoFar(null)
    fetch(`/api/worksheet-ai-quote?curriculumId=${encodeURIComponent(selectedId)}`, {
      signal: ac.signal,
      cache: 'no-store',
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.ok) return
        const raw = kind === 'quiz' ? data.quizCurriculumCreated : data.essayCurriculumCreated
        const n = Number(raw)
        setCreatedSoFar(Number.isFinite(n) ? n : 0)
      })
      .catch(() => {})
    return () => ac.abort()
  }, [open, selectedId, kind, quotaNonce])

  const addRow = () => {
    const difficulty = levels.find((level) => !used.has(level))
    if (!difficulty) return
    setRows((prev) => [...prev, { id: nextId(), difficulty, count: 1 }])
  }

  const create = async () => {
    const lesson = curricula.find((c) => c.id === selectedId)
    if (!lesson) {
      onError(labels.lesson)
      return
    }
    const plan = rows
      .map((row) => ({
        difficulty: row.difficulty,
        count: Math.max(1, Math.min(maxCount, Math.floor(row.count) || 1)),
      }))
      .filter((row) => row.count > 0)
    if (plan.length === 0) return
    const requested = plan.reduce((sum, row) => sum + row.count, 0)
    const quotaBefore = createdSoFar
    setRunning(true)
    let created = 0
    let error = ''
    let markdown = ''
    const sheetIds = new Set<string>()
    try {
      const loaded = await getCurriculumById(lesson.id)
      markdown = String(loaded?.curriculum?.content_markdown ?? '').trim()
      if (!loaded || 'error' in loaded || !markdown) {
        onError(typeof loaded?.error === 'string' ? loaded.error : labels.error)
        return
      }
      const curriculum = loaded.curriculum as { lesson_topics?: unknown }
      const lessonTopics = Array.isArray(curriculum.lesson_topics)
        ? curriculum.lesson_topics.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        : undefined
      for (const row of plan) {
        const res = await fetch('/api/worksheet-submit-job', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: kind,
            count: row.count,
            curriculumMarkdown: markdown,
            topic: lesson.topic,
            subjectId,
            gradeLevelId,
            curriculumId: lesson.id,
            lessonTopics,
            difficulty: row.difficulty,
            createdIn: 'exam',
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data?.jobId) {
          error = String(data?.error ?? res.statusText)
          break
        }
        const job = await pollJob(String(data.jobId))
        if (!job.ok) {
          error = job.error || labels.error
          break
        }
        created += job.created
        if (job.worksheetId) sheetIds.add(job.worksheetId)
      }
      const billed = quoteWorksheetQuestionBatch({
        requested: created,
        curriculumCreated: quotaBefore ?? 0,
        hasCurriculum: quotaBefore != null,
      })
      setReport({
        requested,
        created,
        free: quotaBefore == null ? 0 : billed.free,
        credits: quotaBefore == null ? 0 : billed.credits,
        lesson: lesson.topic,
        error,
      })
      if (created > 0) {
        for (const worksheetId of sheetIds) await verifyCreatedSheet(worksheetId, markdown)
        onDone(lesson.id, created)
      }
    } catch (e) {
      const billed = quoteWorksheetQuestionBatch({
        requested: created,
        curriculumCreated: quotaBefore ?? 0,
        hasCurriculum: quotaBefore != null,
      })
      setReport({
        requested,
        created,
        free: quotaBefore == null ? 0 : billed.free,
        credits: quotaBefore == null ? 0 : billed.credits,
        lesson: lesson.topic,
        error: e instanceof Error ? e.message : String(e),
      })
      if (created > 0) {
        for (const worksheetId of sheetIds) await verifyCreatedSheet(worksheetId, markdown)
        onDone(lesson.id, created)
      }
    } finally {
      setQuotaNonce((n) => n + 1)
      setRunning(false)
    }
  }

  if (curricula.length === 0) return null

  return (
    <div className="rounded border border-dashed p-2 space-y-2">
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen((v) => !v)} disabled={running}>
        {labels.title}
      </Button>
      {open ? (
        <div className="space-y-2">
          {rows.map((row, index) => {
            const options = levels.filter((level) => level === row.difficulty || !used.has(level))
            return (
              <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_5.5rem_auto] gap-2 items-end">
                <label className="space-y-1 text-xs text-muted-foreground">
                  <span>{index === 0 ? labels.difficulty : <span className="sr-only">{labels.difficulty}</span>}</span>
                  <select
                    value={row.difficulty}
                    disabled={running}
                    onChange={(e) => {
                      const difficulty = e.target.value
                      setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, difficulty } : item)))
                    }}
                    className="h-8 w-full rounded-md border bg-background px-2 text-sm text-foreground"
                  >
                    {options.map((level) => (
                      <option key={level} value={level}>{labels.levels[level] ?? level}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                  <span>{index === 0 ? labels.count : <span className="sr-only">{labels.count}</span>}</span>
                  <Input
                    type="number"
                    min={1}
                    max={maxCount}
                    value={row.count}
                    disabled={running}
                    onChange={(e) => {
                      const count = Math.max(1, Math.min(maxCount, Math.floor(Number(e.target.value) || 1)))
                      setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, count } : item)))
                    }}
                    className="h-8"
                  />
                </label>
                {rows.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={running}
                    title={labels.removeType}
                    onClick={() => setRows((prev) => prev.filter((item) => item.id !== row.id))}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">{labels.removeType}</span>
                  </Button>
                ) : (
                  <span className="h-8 w-8" aria-hidden />
                )}
              </div>
            )
          })}
          <div className="flex flex-wrap items-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={addRow} disabled={running || !canAdd} className="gap-1">
              <Plus className="h-3.5 w-3.5" />
              {labels.addType}
            </Button>
            <label className="min-w-[12rem] flex-1 space-y-1 text-xs text-muted-foreground">
              <span>{labels.lesson}</span>
              <select
                value={selectedId}
                disabled={running}
                onChange={(e) => setCurriculumId(e.target.value)}
                className="h-8 w-full rounded-md border bg-background px-2 text-sm text-foreground"
              >
                {curricula.map((c) => (
                  <option key={c.id} value={c.id}>{c.topic}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={() => void create()}
              disabled={running}
              className="h-8 max-w-full gap-0 px-3 shadow-none"
            >
              {running ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              <span className="shrink-0">{running ? labels.running : labels.submit}</span>
              {!running && chargeText ? (
                <span className="ml-2 border-l border-primary-foreground/30 pl-2 text-[11px] font-normal text-primary-foreground/75">
                  {chargeText}
                </span>
              ) : null}
            </Button>
          </div>
        </div>
      ) : null}
      <Dialog open={report != null} onOpenChange={(open) => { if (!open) setReport(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{labels.reportTitle}</DialogTitle>
          </DialogHeader>
          {report ? (
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">{report.lesson}</p>
              <p>{fillTpl(labels.reportCreated, { created: report.created, requested: report.requested })}</p>
              {report.requested > report.created ? (
                <p>{fillTpl(labels.reportFailed, { n: report.requested - report.created })}</p>
              ) : null}
              <p>
                {report.credits > 0 && report.free > 0
                  ? fillTpl(labels.reportMixed, { free: report.free, credits: formatCurriculumCredits(report.credits) })
                  : report.credits > 0
                    ? fillTpl(labels.reportCredits, { credits: formatCurriculumCredits(report.credits) })
                    : labels.reportFree}
              </p>
              <p>{labels.reportPlace}</p>
              {report.error ? <p className="text-destructive">{report.error}</p> : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" size="sm" onClick={() => setReport(null)}>{labels.reportClose}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function fillCreateDone(template: string, n: number): string {
  return fillTpl(template, { n })
}
