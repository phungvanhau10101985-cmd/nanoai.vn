'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Copy } from 'lucide-react'
import Link from 'next/link'
import type { Dictionary } from '@/lib/i18n/dictionaries'

type Member = { userId: string; name: string }
type Submission = { id: string; worksheetId: string; worksheetTopic: string; studentName: string; quizScore: number; quizTotal: number; submittedAt: string }
type ExamAttempt = { id: string; sessionId: string; examCode: string; examTitle: string; studentName: string; score: number; maxScore: number; submittedAt: string }

export default function LopDetailClient({
  cls,
  isTeacher,
  members = [],
  initialSubmissions = [],
  initialExamAttempts = [],
  t,
}: {
  cls: { id: string; name: string; join_code: string; gradeLevelId: string | null; schoolName: string; subjectNames?: string[] }
  isTeacher: boolean
  members?: Member[]
  initialSubmissions?: Submission[]
  initialExamAttempts?: ExamAttempt[]
  t: Dictionary['classes']
}) {
  const subjectNames = cls.subjectNames ?? []
  const [submissions, setSubmissions] = useState<Submission[]>(initialSubmissions ?? [])
  const [examAttempts] = useState<ExamAttempt[]>(initialExamAttempts ?? [])
  const [className, setClassName] = useState(cls.name)
  const [savedClassName, setSavedClassName] = useState(cls.name)
  const [editingClassName, setEditingClassName] = useState(false)
  const [renamingClass, setRenamingClass] = useState(false)
  const [expandedExamSessionId, setExpandedExamSessionId] = useState<string | null>(null)
  const { toast } = useToast()
  const sortedExamAttempts = useMemo(
    () =>
      [...examAttempts].sort((a, b) => {
        const aTotal = Math.max(0, Number(a.maxScore || 0))
        const bTotal = Math.max(0, Number(b.maxScore || 0))
        const aGrade = aTotal > 0 ? (Number(a.score || 0) / aTotal) * 10 : 0
        const bGrade = bTotal > 0 ? (Number(b.score || 0) / bTotal) * 10 : 0
        if (aGrade !== bGrade) return aGrade - bGrade
        return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
      }),
    [examAttempts]
  )
  const lowScoreCount = useMemo(
    () =>
      sortedExamAttempts.filter((s) => {
        const total = Math.max(0, Number(s.maxScore || 0))
        const grade = total > 0 ? (Number(s.score || 0) / total) * 10 : 0
        return grade < 5
      }).length,
    [sortedExamAttempts]
  )
  const examGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        sessionId: string
        examCode: string
        examTitle: string
        attempts: ExamAttempt[]
      }
    >()
    for (const item of sortedExamAttempts) {
      const existing = map.get(item.sessionId)
      if (existing) {
        existing.attempts.push(item)
      } else {
        map.set(item.sessionId, {
          sessionId: item.sessionId,
          examCode: item.examCode,
          examTitle: item.examTitle,
          attempts: [item],
        })
      }
    }
    return Array.from(map.values())
  }, [sortedExamAttempts])

  useEffect(() => {
    if (examGroups.length === 0) {
      setExpandedExamSessionId(null)
      return
    }
    setExpandedExamSessionId((prev) => {
      if (prev && examGroups.some((g) => g.sessionId === prev)) return prev
      return examGroups[0].sessionId
    })
  }, [examGroups])

  useEffect(() => {
    if (!isTeacher) return
    const poll = () => {
      fetch(`/api/lop/${cls.id}/submissions`)
        .then((r) => r.json())
        .then((data) => {
          if (data.items) setSubmissions(data.items)
        })
        .catch(() => {})
    }
    const id = setInterval(poll, 8000)
    return () => clearInterval(id)
  }, [isTeacher, cls.id])

  function copyCode() {
    navigator.clipboard.writeText(cls.join_code)
    toast({ description: t.copied })
  }

  return (
    <>
      <Toaster />
      <header className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{className}</h1>
        {isTeacher && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {editingClassName ? (
              <>
                <input
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const newName = className.trim()
                    if (!newName) return
                    setRenamingClass(true)
                    const res = await fetch(`/api/lop/${cls.id}/rename`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: newName }),
                    })
                    const data = await res.json().catch(() => ({}))
                    setRenamingClass(false)
                    if (!res.ok) {
                      toast({ variant: 'destructive', description: data?.error ?? t.renameClassFailed })
                      return
                    }
                    setSavedClassName(newName)
                    setEditingClassName(false)
                    toast({ description: t.renameClassSuccess })
                  }}
                  disabled={renamingClass}
                >
                  {renamingClass ? '...' : t.saveClassName}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setClassName(savedClassName)
                    setEditingClassName(false)
                  }}
                >
                  {t.cancelAction}
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setEditingClassName(true)}>
                {t.renameClass}
              </Button>
            )}
          </div>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {cls.schoolName && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {t.schoolLabel}: {cls.schoolName}
            </span>
          )}
          {cls.gradeLevelId && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {t.gradeLevelLabel}: {cls.gradeLevelId}
            </span>
          )}
          {subjectNames.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {t.subjectLabel}: {subjectNames.join(', ')}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t.joinCode}:</span>
          <code className="px-2 py-1 rounded bg-muted font-mono text-sm tracking-wider">{cls.join_code}</code>
          <Button variant="ghost" size="icon" onClick={copyCode} className="h-8 w-8">
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <section className="mb-6">
        <h2 className="text-sm font-medium text-muted-foreground mb-2">{t.students}</h2>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noStudents}</p>
        ) : (
          <ul className="rounded-xl border border-input divide-y divide-input">
            {members.map((m) => (
              <li key={m.userId} className="px-4 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span>{m.name}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {className}
                  </span>
                  {cls.schoolName && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {cls.schoolName}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isTeacher && submissions.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">{t.worksheetSubmissionsSection}</h2>
          <ul className="rounded-xl border border-input divide-y divide-input">
            {submissions.map((s) => (
              <li key={s.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="font-medium text-sm">{s.studentName}</span>
                  <span className="text-muted-foreground text-sm ml-2">– {s.worksheetTopic}</span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {className}
                    </span>
                    {cls.schoolName && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {cls.schoolName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {s.quizScore}/{s.quizTotal} • {new Date(s.submittedAt).toLocaleString('vi-VN')}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {isTeacher && (
        <section className="mt-8">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">{t.examSubmissions}</h2>
          {sortedExamAttempts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.noExamSubmissions}</p>
          ) : (
            <>
              {lowScoreCount > 0 && (
                <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {t.lowScoreWarningPrefix} {lowScoreCount} {t.lowScoreWarningSuffix}
                </div>
              )}
              <ul className="rounded-xl border border-input divide-y divide-input">
                {examGroups.map((g) => {
                  const expanded = expandedExamSessionId === g.sessionId
                  return (
                    <li key={g.sessionId} className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setExpandedExamSessionId(expanded ? null : g.sessionId)}
                          className="text-left hover:opacity-85 transition-opacity"
                        >
                          <p className="font-medium text-sm">{g.examTitle}</p>
                          <p className="text-xs text-muted-foreground">
                            {g.attempts.length} {t.examAttemptCount}
                            {g.examCode ? ` • ${g.examCode}` : ''}
                          </p>
                        </button>
                        <div className="flex items-center gap-2">
                          {g.examCode && (
                            <Button type="button" variant="secondary" size="sm" asChild>
                              <Link
                                href={`/giao-trinh/giao-vien/de-thi/${encodeURIComponent(g.examCode)}?t=${Date.now()}`}
                                target="_blank"
                              >
                                {t.examReviewAction}
                              </Link>
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setExpandedExamSessionId(expanded ? null : g.sessionId)}
                          >
                            {expanded ? t.hideStudentsAction : t.showStudentsAction}
                          </Button>
                        </div>
                      </div>
                      {expanded && (
                        <ul className="mt-3 rounded-lg border border-input divide-y divide-input bg-background/60">
                          {g.attempts.map((s) => (
                            <li key={s.id} className="px-3 py-2 flex items-center justify-between gap-3">
                              <div>
                                <p className="font-medium text-sm">{s.studentName}</p>
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                    {className}
                                  </span>
                                  {cls.schoolName && (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                      {cls.schoolName}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {(() => {
                                  const correct = Math.max(0, Number(s.score || 0))
                                  const total = Math.max(0, Number(s.maxScore || 0))
                                  const wrong = Math.max(0, total - correct)
                                  const grade10 = total > 0 ? Math.round((correct / total) * 100) / 10 : 0
                                  return `${t.correctLabel} ${correct} ${t.questionSuffix}, ${t.wrongLabel} ${wrong} ${t.questionSuffix}, ${t.scoreLabel} ${grade10}/10 • ${new Date(s.submittedAt).toLocaleString('vi-VN')}`
                                })()}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </section>
      )}
    </>
  )
}
