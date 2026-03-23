'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Copy, LogOut, QrCode, Trash2, UserMinus } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { leaveClass, removeClassMember } from '../actions'

function matchesDestructiveConfirm(input: string, phrase: string): boolean {
  const norm = (s: string) =>
    s
      .normalize('NFC')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()
  return norm(input) === norm(phrase)
}

function formatBirthDisplay(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

type Member = {
  userId: string
  name: string
  birthDate: string | null
  kind: 'student' | 'teacher_member'
  removable: boolean
}
type Submission = { id: string; worksheetId: string; worksheetTopic: string; studentName: string; quizScore: number; quizTotal: number; submittedAt: string }
type ExamAttempt = { id: string; sessionId: string; examCode: string; examTitle: string; studentName: string; score: number; maxScore: number; submittedAt: string }
type ExamSessionRow = { id: string; code: string; title: string }

export default function LopDetailClient({
  cls,
  isTeacher,
  canLeaveClass = false,
  members = [],
  initialSubmissions = [],
  initialExamAttempts = [],
  initialExamSessions = [],
  t,
}: {
  cls: { id: string; name: string; join_code: string; gradeLevelId: string | null; schoolName: string; subjectNames?: string[] }
  isTeacher: boolean
  /** HS có bản ghi class_members — hiện nút tự rời lớp */
  canLeaveClass?: boolean
  members?: Member[]
  initialSubmissions?: Submission[]
  initialExamAttempts?: ExamAttempt[]
  /** Phiên đề thi gắn lớp (luôn hiển thị, kể cả chưa có bài nộp) */
  initialExamSessions?: ExamSessionRow[]
  t: Dictionary['classes']
}) {
  const subjectNames = cls.subjectNames ?? []
  const [membersList, setMembersList] = useState<Member[]>(members ?? [])
  const [removeMemberTarget, setRemoveMemberTarget] = useState<Member | null>(null)
  const [removingMember, setRemovingMember] = useState(false)
  const [submissions, setSubmissions] = useState<Submission[]>(initialSubmissions ?? [])
  const [examAttempts, setExamAttempts] = useState<ExamAttempt[]>(initialExamAttempts ?? [])
  const [examSessionsList, setExamSessionsList] = useState<ExamSessionRow[]>(initialExamSessions ?? [])
  const [deleteExamTarget, setDeleteExamTarget] = useState<{
    sessionId: string
    code: string
    title: string
  } | null>(null)
  const [deletingExam, setDeletingExam] = useState(false)
  const [deleteExamConfirmInput, setDeleteExamConfirmInput] = useState('')
  const [className, setClassName] = useState(cls.name)
  const [savedClassName, setSavedClassName] = useState(cls.name)
  const [editingClassName, setEditingClassName] = useState(false)
  const [renamingClass, setRenamingClass] = useState(false)
  const [expandedExamSessionId, setExpandedExamSessionId] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteClassConfirmInput, setDeleteClassConfirmInput] = useState('')
  const [deletingClass, setDeletingClass] = useState(false)
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false)
  const [leavingClass, setLeavingClass] = useState(false)
  /** GV: hộp thoại QR + link — không điều hướng sang /lam-bai */
  const [examShare, setExamShare] = useState<{ code: string; title: string } | null>(null)
  const [shareQrDataUrl, setShareQrDataUrl] = useState<string | null>(null)
  const router = useRouter()
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
    const attemptsBySession = new Map<string, ExamAttempt[]>()
    for (const item of sortedExamAttempts) {
      const list = attemptsBySession.get(item.sessionId)
      if (list) list.push(item)
      else attemptsBySession.set(item.sessionId, [item])
    }
    const sessions = examSessionsList ?? []
    if (sessions.length > 0) {
      return sessions.map((s) => ({
        sessionId: s.id,
        examCode: s.code,
        examTitle: s.title || 'Bài thi',
        attempts: attemptsBySession.get(s.id) ?? [],
      }))
    }
    return Array.from(attemptsBySession.entries()).map(([sessionId, attempts]) => ({
      sessionId,
      examCode: attempts[0]?.examCode ?? '',
      examTitle: attempts[0]?.examTitle ?? 'Bài thi',
      attempts,
    }))
  }, [examSessionsList, sortedExamAttempts])

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
    setMembersList(members ?? [])
  }, [members])

  useEffect(() => {
    setExamAttempts(initialExamAttempts ?? [])
  }, [initialExamAttempts])

  useEffect(() => {
    setExamSessionsList(initialExamSessions ?? [])
  }, [initialExamSessions])

  useEffect(() => {
    setDeleteExamConfirmInput('')
  }, [deleteExamTarget])

  useEffect(() => {
    if (!examShare?.code) {
      setShareQrDataUrl(null)
      return
    }
    const code = examShare.code.trim()
    if (!code) {
      setShareQrDataUrl(null)
      return
    }
    const url =
      typeof window === 'undefined' ? '' : `${window.location.origin}${examStudentDoPath(code)}`
    let cancelled = false
    setShareQrDataUrl(null)
    void import('qrcode')
      .then((QR) =>
        QR.default.toDataURL(url, { width: 220, margin: 2 })
      )
      .then((dataUrl) => {
        if (!cancelled) setShareQrDataUrl(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setShareQrDataUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [examShare])

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

  function examStudentDoPath(examCode: string) {
    return `/lam-bai/${encodeURIComponent(examCode.trim())}`
  }

  function examStudentDoAbsoluteUrl(examCode: string) {
    const path = examStudentDoPath(examCode)
    if (typeof window === 'undefined') return path
    return `${window.location.origin}${path}`
  }

  function copyExamStudentLink(examCode: string) {
    const c = examCode.trim()
    if (!c) return
    void navigator.clipboard.writeText(examStudentDoAbsoluteUrl(c))
    toast({ description: t.examStudentDoLinkCopied })
  }

  return (
    <>
      <Toaster />
      <header className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{className}</h1>
        {!isTeacher && canLeaveClass && (
          <div className="mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setLeaveDialogOpen(true)}
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              {t.leaveClass}
            </Button>
          </div>
        )}
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
              <>
                <Button variant="outline" size="sm" onClick={() => setEditingClassName(true)}>
                  {t.renameClass}
                </Button>
                {/* Xóa lớp: chỉ khi isTeacher (= user trùng teacher_id trên server), đồng bộ DELETE /api/lop/[id] */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    setDeleteClassConfirmInput('')
                    setDeleteDialogOpen(true)
                  }}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  {t.deleteClass}
                </Button>
              </>
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
        {isTeacher ? (
          <div className="mt-4 md:hidden">
            <Button variant="secondary" className="h-auto w-full touch-manipulation py-3 text-sm font-semibold shadow-sm" asChild>
              <Link href="/tao-bai-thi">{t.mobileCreateExam}</Link>
            </Button>
          </div>
        ) : null}
      </header>

      <section className="mb-6">
        <h2 className="text-sm font-medium text-muted-foreground mb-2">{t.students}</h2>
        {membersList.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noStudents}</p>
        ) : (
          <ul className="rounded-xl border border-input divide-y divide-input">
            {membersList.map((m) => (
              <li key={m.userId} className="px-4 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <span className="font-medium">{m.name}</span>
                    {m.birthDate ? (
                      <span className="text-[11px] text-muted-foreground">
                        {t.memberBirthDateLabel}: {formatBirthDisplay(m.birthDate)}
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        'text-[11px] px-2 py-0.5 rounded-full font-medium',
                        m.kind === 'teacher_member'
                          ? 'bg-primary/12 text-primary'
                          : 'bg-sky-500/12 text-sky-800 dark:text-sky-200'
                      )}
                    >
                      {m.kind === 'teacher_member' ? t.memberRoleTeacher : t.memberRoleStudent}
                    </span>
                    {cls.schoolName && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {cls.schoolName}
                      </span>
                    )}
                  </div>
                  {m.removable && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10"
                      onClick={() => setRemoveMemberTarget(m)}
                    >
                      <UserMinus className="mr-1 h-3.5 w-3.5" aria-hidden />
                      {t.removeStudentFromClass}
                    </Button>
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
          {examGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.noExamsForClass}</p>
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
                        <div className="flex flex-wrap items-center gap-2">
                          {g.examCode ? (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setExamShare({ code: g.examCode, title: g.examTitle })
                                }
                              >
                                <QrCode className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                                {t.examStudentDoLinkOpen}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                aria-label={t.examStudentDoLinkCopy}
                                onClick={() => copyExamStudentLink(g.examCode)}
                              >
                                <Copy className="h-4 w-4" aria-hidden />
                              </Button>
                              <Button type="button" variant="secondary" size="sm" asChild>
                                <Link
                                  href={`/giao-trinh/giao-vien/de-thi/${encodeURIComponent(g.examCode)}?t=${Date.now()}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {t.examReviewAction}
                                </Link>
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                disabled={!g.examCode.trim()}
                                onClick={() =>
                                  setDeleteExamTarget({
                                    sessionId: g.sessionId,
                                    code: g.examCode,
                                    title: g.examTitle,
                                  })
                                }
                              >
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                                {t.examDeleteAction}
                              </Button>
                            </>
                          ) : null}
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
                      {expanded &&
                        (g.attempts.length === 0 ? (
                          <p className="mt-3 rounded-lg border border-input bg-background/60 px-3 py-3 text-sm text-muted-foreground">
                            {t.examSessionNoAttemptsYet}
                          </p>
                        ) : (
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
                        ))}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </section>
      )}

      <AlertDialog
        open={deleteExamTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteExamTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.examDeleteConfirmTitle}</AlertDialogTitle>
            {deleteExamTarget ? (
              <>
                <p className="text-sm text-foreground">
                  <span className="font-medium">{deleteExamTarget.title}</span>
                  {deleteExamTarget.code.trim() ? (
                    <>
                      {' '}
                      <span className="font-mono text-muted-foreground">
                        ({deleteExamTarget.code.trim()})
                      </span>
                    </>
                  ) : null}
                </p>
                <AlertDialogDescription>{t.examDeleteConfirmDescription}</AlertDialogDescription>
              </>
            ) : null}
          </AlertDialogHeader>
          {deleteExamTarget ? (
            <div className="space-y-2 rounded-md border-2 border-border bg-muted/30 p-3">
              <p className="text-sm text-muted-foreground">{t.examDeleteConfirmTypeHint}</p>
              <p className="rounded-md border-2 border-muted-foreground/50 bg-background px-3 py-2 text-center font-mono text-sm font-semibold text-foreground shadow-sm">
                {t.examDeleteConfirmPhrase}
              </p>
              <Input
                value={deleteExamConfirmInput}
                onChange={(e) => setDeleteExamConfirmInput(e.target.value)}
                autoComplete="off"
                autoFocus
                className={cn(
                  'h-10 bg-background font-mono text-sm shadow-sm',
                  'border-2 border-muted-foreground/55',
                  'focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/50'
                )}
                aria-label={t.examDeleteConfirmTypeHint}
              />
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingExam}>{t.cancelAction}</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={
                deletingExam ||
                !deleteExamTarget?.code.trim() ||
                !matchesDestructiveConfirm(deleteExamConfirmInput, t.examDeleteConfirmPhrase)
              }
              onClick={async () => {
                if (!deleteExamTarget) return
                const code = deleteExamTarget.code.trim().toUpperCase()
                if (!code) return
                setDeletingExam(true)
                const res = await fetch('/api/exam-session/mine', {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ code }),
                })
                const data = (await res.json().catch(() => ({}))) as { error?: string }
                setDeletingExam(false)
                if (!res.ok) {
                  toast({
                    variant: 'destructive',
                    description: typeof data?.error === 'string' ? data.error : t.examDeleteFailed,
                  })
                  return
                }
                const sid = deleteExamTarget.sessionId
                setExamSessionsList((prev) => prev.filter((s) => s.id !== sid))
                setExamAttempts((prev) => prev.filter((a) => a.sessionId !== sid))
                setExamShare((prev) =>
                  prev && prev.code.trim().toUpperCase() === code ? null : prev
                )
                setDeleteExamTarget(null)
                toast({ description: t.examDeleteSuccess })
                router.refresh()
              }}
            >
              {deletingExam ? t.examDeleting : t.examDeleteConfirmAction}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={examShare !== null}
        onOpenChange={(open) => {
          if (!open) setExamShare(null)
        }}
      >
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.examStudentShareDialogTitle}</DialogTitle>
            {examShare ? (
              <p className="pt-1 text-sm font-medium text-foreground">{examShare.title}</p>
            ) : null}
            <DialogDescription>{t.examStudentShareDialogDescription}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {shareQrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL từ thư viện qrcode
              <img
                src={shareQrDataUrl}
                alt=""
                width={220}
                height={220}
                className="rounded-lg border border-border bg-white p-1"
              />
            ) : (
              <div
                className="h-[220px] w-[220px] animate-pulse rounded-lg bg-muted"
                aria-hidden
              />
            )}
            <div className="w-full space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{t.examStudentShareUrlLabel}</p>
              <div className="flex gap-2">
                <div className="min-w-0 flex-1 rounded-md border border-input bg-muted/40 px-3 py-2 font-mono text-xs break-all text-foreground">
                  {examShare ? examStudentDoAbsoluteUrl(examShare.code) : ''}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  aria-label={t.examStudentDoLinkCopy}
                  disabled={!examShare?.code}
                  onClick={() => examShare && copyExamStudentLink(examShare.code)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={removeMemberTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveMemberTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.removeStudentConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {removeMemberTarget ? (
                <>
                  <span className="font-medium text-foreground">{removeMemberTarget.name}</span>
                  {' — '}
                  {t.removeStudentConfirmDescription}
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingMember}>{t.cancelAction}</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={removingMember || !removeMemberTarget}
              onClick={async () => {
                if (!removeMemberTarget) return
                setRemovingMember(true)
                const res = await removeClassMember(cls.id, removeMemberTarget.userId)
                setRemovingMember(false)
                if ('error' in res) {
                  toast({ variant: 'destructive', description: res.error })
                  return
                }
                setMembersList((prev) => prev.filter((x) => x.userId !== removeMemberTarget.userId))
                setRemoveMemberTarget(null)
                toast({ description: t.removeStudentSuccess })
                router.refresh()
              }}
            >
              {removingMember ? t.removeStudentRemoving : t.removeStudentConfirmAction}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={leaveDialogOpen}
        onOpenChange={(open) => {
          if (!open) setLeaveDialogOpen(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.leaveClassConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.leaveClassConfirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leavingClass}>{t.cancelAction}</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={leavingClass}
              onClick={async () => {
                setLeavingClass(true)
                const res = await leaveClass(cls.id)
                setLeavingClass(false)
                if ('error' in res) {
                  toast({ variant: 'destructive', description: res.error ?? t.leaveClassFailed })
                  return
                }
                setLeaveDialogOpen(false)
                toast({ description: t.leaveClassSuccess })
                router.push('/lop')
                router.refresh()
              }}
            >
              {leavingClass ? t.leaveClassLeaving : t.leaveClassConfirmAction}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) setDeleteClassConfirmInput('')
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteClassConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.deleteClassConfirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 rounded-md border-2 border-border bg-muted/30 p-3">
            <p className="text-sm text-muted-foreground">{t.deleteClassConfirmTypeHint}</p>
            <p className="rounded-md border-2 border-muted-foreground/50 bg-background px-3 py-2 text-center font-mono text-sm font-semibold text-foreground shadow-sm">
              {t.deleteClassConfirmPhrase}
            </p>
            <Input
              value={deleteClassConfirmInput}
              onChange={(e) => setDeleteClassConfirmInput(e.target.value)}
              autoComplete="off"
              autoFocus
              className={cn(
                'h-10 bg-background font-mono text-sm shadow-sm',
                'border-2 border-muted-foreground/55',
                'focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/50'
              )}
              aria-label={t.deleteClassConfirmTypeHint}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingClass}>{t.cancelAction}</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={
                deletingClass ||
                !matchesDestructiveConfirm(deleteClassConfirmInput, t.deleteClassConfirmPhrase)
              }
              onClick={async () => {
                setDeletingClass(true)
                const res = await fetch(`/api/lop/${cls.id}`, { method: 'DELETE' })
                const data = await res.json().catch(() => ({}))
                setDeletingClass(false)
                if (!res.ok) {
                  toast({
                    variant: 'destructive',
                    description: typeof data?.error === 'string' ? data.error : t.deleteClassFailed,
                  })
                  return
                }
                setDeleteDialogOpen(false)
                toast({ description: t.deleteClassSuccess })
                router.push('/lop')
                router.refresh()
              }}
            >
              {deletingClass ? t.deleteClassDeleting : t.deleteClassConfirmAction}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
