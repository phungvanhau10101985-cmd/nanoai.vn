'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Copy } from 'lucide-react'
import Link from 'next/link'
import type { Dictionary } from '@/lib/i18n/dictionaries'

type Member = { userId: string; name: string }
type Worksheet = { id: string; topic: string }
type Submission = { id: string; worksheetId: string; worksheetTopic: string; studentName: string; quizScore: number; quizTotal: number; submittedAt: string }
type ExamAttempt = { id: string; examTitle: string; studentName: string; score: number; maxScore: number; submittedAt: string }

export default function LopDetailClient({
  cls,
  isTeacher,
  members,
  worksheets,
  initialSubmissions,
  initialExamAttempts,
  t,
}: {
  cls: { id: string; name: string; join_code: string; gradeLevelId: string | null; schoolName: string }
  isTeacher: boolean
  members: Member[]
  worksheets: Worksheet[]
  initialSubmissions: Submission[]
  initialExamAttempts: ExamAttempt[]
  t: Dictionary['classes']
}) {
  const [submissions, setSubmissions] = useState<Submission[]>(initialSubmissions)
  const [examAttempts] = useState<ExamAttempt[]>(initialExamAttempts)
  const [className, setClassName] = useState(cls.name)
  const [savedClassName, setSavedClassName] = useState(cls.name)
  const [editingClassName, setEditingClassName] = useState(false)
  const [renamingClass, setRenamingClass] = useState(false)
  const { toast } = useToast()

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

      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-2">{t.worksheets}</h2>
        {worksheets.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noWorksheets}</p>
        ) : (
          <ul className="space-y-2">
            {worksheets.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/phieu-bai-tap/${w.id}/lam-bai?classId=${cls.id}`}
                  className="block rounded-lg border border-input bg-card px-4 py-3 hover:bg-accent/50 text-sm font-medium"
                >
                  {w.topic}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {isTeacher && (
          <Button variant="outline" className="mt-4" asChild>
            <Link href={`/lop/${cls.id}/gan-phieu`}>{t.assignWorksheet}</Link>
          </Button>
        )}
      </section>

      {isTeacher && (
        <section className="mt-8">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">{t.submissions}</h2>
          {submissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.noSubmissions}</p>
          ) : (
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
          )}
        </section>
      )}
      {isTeacher && (
        <section className="mt-8">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">{t.examSubmissions}</h2>
          {examAttempts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.noExamSubmissions}</p>
          ) : (
            <ul className="rounded-xl border border-input divide-y divide-input">
              {examAttempts.map((s) => (
                <li key={s.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <span className="font-medium text-sm">{s.studentName}</span>
                    <span className="text-muted-foreground text-sm ml-2">– {s.examTitle}</span>
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
                    {s.score}/{s.maxScore} • {new Date(s.submittedAt).toLocaleString('vi-VN')}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  )
}
