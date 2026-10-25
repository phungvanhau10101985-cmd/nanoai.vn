'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { BookOpen, FileDown, FileText, RefreshCw } from 'lucide-react'
import { latexToReadable } from '../tao-giao-trinh/lib/latex-to-readable'
import { buildExamPaperMarkdown, exportExamPaperPdf, exportExamPaperWord } from './lib/exam-paper-export'

type PresetItem = {
  id: string
  title: string
  questionCount: number
  totalPoints: number
  durationMinutes: number
}

type PresetQuestion = {
  index: number
  type: 'quiz' | 'essay'
  questionText: string
  options: string[]
  points: number
  minutes: number
  solution: string
  correctLabel: string | null
}

type PresetDetail = {
  id: string
  title: string
  durationMinutes: number
  questionCount: number
  totalPoints: number
  totalMinutes: number
  questions: PresetQuestion[]
}

type PresetText = {
  presetExamsTitle: string
  presetExamsHint: string
  presetExamsEmpty: string
  presetExamsLoading: string
  presetUseThis: string
  presetReviewExam: string
  presetQuestionMeta: string
  exportPdf: string
  exportWord: string
  problem: string
  solution: string
  noSolution: string
  badgeQuiz: string
  badgeEssay: string
  questions: string
  points: string
  minutes: string
  error: string
}

function fillTpl(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''))
}

export function ExamPresetPanel({
  subjectId,
  gradeLevelId,
  durationMinutes,
  topics,
  tx,
  busy,
  onUse,
  onError,
  onMarkTeacher,
  allowTeacherActions,
}: {
  subjectId: string
  gradeLevelId: string
  durationMinutes: number
  topics: string[]
  tx: PresetText
  busy: boolean
  onUse: (sourceId: string, openReview: boolean) => void
  onError: (message: string) => void
  /** Bấm mở đề có sẵn thì đánh dấu người đó là giáo viên. */
  onMarkTeacher?: () => void
  allowTeacherActions?: boolean
}) {
  const topicKey = topics.map((t) => t.trim()).filter(Boolean).join('\n')
  const [items, setItems] = useState<PresetItem[]>([])
  const [loading, setLoading] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [detail, setDetail] = useState<PresetDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [exporting, setExporting] = useState<'pdf' | 'word' | null>(null)
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  useEffect(() => {
    if (!topicKey || durationMinutes <= 0) {
      setItems([])
      setOpenId(null)
      setDetail(null)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true)
      const params = new URLSearchParams({
        subjectId,
        gradeLevelId,
        durationMinutes: String(durationMinutes),
        topics: topicKey,
      })
      fetch(`/api/exam-session/presets?${params.toString()}`, { cache: 'no-store' })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(String(data?.error ?? res.statusText))
          if (cancelled) return
          setItems(Array.isArray(data?.items) ? data.items : [])
          setOpenId(null)
          setDetail(null)
        })
        .catch((e) => {
          if (!cancelled) onErrorRef.current(e instanceof Error ? e.message : String(e))
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [subjectId, gradeLevelId, durationMinutes, topicKey])

  const openPreset = async (id: string) => {
    if (openId === id) {
      setOpenId(null)
      setDetail(null)
      return
    }
    onMarkTeacher?.()
    setOpenId(id)
    setDetail(null)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/exam-session/presets/${encodeURIComponent(id)}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(String(data?.error ?? res.statusText))
      setDetail(data as PresetDetail)
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
      setOpenId(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const exportPaper = async (kind: 'pdf' | 'word') => {
    if (!detail) return
    setExporting(kind)
    try {
      const md = buildExamPaperMarkdown({
        title: detail.title,
        durationMinutes: detail.durationMinutes,
        questions: detail.questions,
      })
      const safe = detail.title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || 'de-thi'
      if (kind === 'pdf') await exportExamPaperPdf(md, `${safe}.pdf`)
      else await exportExamPaperWord(md, `${safe}.docx`)
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-2 rounded border p-3">
      <p className="text-sm font-semibold">{tx.presetExamsTitle}</p>
      <p className="text-xs text-muted-foreground">{tx.presetExamsHint}</p>
      {loading ? (
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          {tx.presetExamsLoading}
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{tx.presetExamsEmpty}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const opened = openId === item.id
            return (
              <div key={item.id} className={`rounded border p-2 ${opened ? 'border-violet-400 bg-violet-50/60' : ''}`}>
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => void openPreset(item.id)}
                >
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.questionCount} {tx.questions} · {item.totalPoints} {tx.points} · {item.durationMinutes} {tx.minutes}
                  </p>
                </button>
                {opened ? (
                  <div className="mt-2 space-y-2">
                    {detailLoading || !detail ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        {tx.presetExamsLoading}
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" disabled={busy} onClick={() => onUse(item.id, false)}>
                            {tx.presetUseThis}
                          </Button>
                          {allowTeacherActions ? (
                            <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => onUse(item.id, true)} className="gap-1.5">
                              <BookOpen className="h-3.5 w-3.5" />
                              {tx.presetReviewExam}
                            </Button>
                          ) : null}
                          <Button type="button" size="sm" variant="outline" disabled={exporting !== null} onClick={() => void exportPaper('pdf')} className="gap-1.5">
                            {exporting === 'pdf' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                            {tx.exportPdf}
                          </Button>
                          <Button type="button" size="sm" variant="outline" disabled={exporting !== null} onClick={() => void exportPaper('word')} className="gap-1.5">
                            {exporting === 'word' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                            {tx.exportWord}
                          </Button>
                        </div>
                        <div className="max-h-[28rem] space-y-2 overflow-y-auto rounded border bg-background p-2">
                          {detail.questions.map((q) => (
                            <div key={`${detail.id}-${q.index}`} className="rounded border p-2 space-y-1">
                              <div className="flex flex-wrap gap-1.5 text-[11px]">
                                <span className="rounded bg-violet-100 px-1.5 py-0.5 text-violet-800">
                                  {fillTpl(tx.presetQuestionMeta, { n: q.index, points: q.points, minutes: q.minutes })}
                                </span>
                                <span className={`rounded px-1.5 py-0.5 ${q.type === 'quiz' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                  {q.type === 'quiz' ? tx.badgeQuiz : tx.badgeEssay}
                                </span>
                              </div>
                              <p className="text-xs font-medium text-muted-foreground">{tx.problem}</p>
                              <p className="whitespace-pre-wrap text-sm">{latexToReadable(q.questionText)}</p>
                              {q.options.length > 0 ? (
                                <ul className="space-y-0.5 text-sm">
                                  {q.options.map((opt, i) => (
                                    <li key={`${q.index}-opt-${i}`}>
                                      {String.fromCharCode(65 + i)}. {latexToReadable(opt)}
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                              <p className="text-xs font-medium text-muted-foreground">{tx.solution}</p>
                              <p className="whitespace-pre-wrap text-sm">
                                {q.solution
                                  ? `${q.correctLabel ? `${q.correctLabel}. ` : ''}${latexToReadable(q.solution)}`
                                  : tx.noSolution}
                              </p>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
