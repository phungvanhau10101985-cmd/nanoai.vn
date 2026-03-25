'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { formatSessionIsoDateTime } from '@/lib/datetime/format-session-iso-local'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import {
  Copy,
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FileText,
  Images,
  Link2,
  Loader2,
  Pencil,
  PenLine,
  QrCode,
  ScrollText,
  Sparkles,
  Table2,
  Trash2,
  UserMinus,
  UserRound,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { WebLocale } from '@/lib/i18n/config'
import {
  getExamAttemptFeedbackWithMeta,
  parseExamGradingMeta,
  type ExamGradingMeta,
} from '@/lib/exam-feedback'
import {
  EXAM_ESSAY_IMAGE_RETENTION_DAYS,
  formatExamEssayImageExpireAtForUi,
} from '@/lib/exam-essay-config'
import {
  removeClassMember,
  updateClassStudentFacingInfo,
  updateStudentDisplayNameInClass,
} from '../actions'
import { ClassGradebookSection } from './class-gradebook-section'
import { latexToReadable } from '@/app/tao-giao-trinh/lib/latex-to-readable'
import { AttachExamToClassDialog } from '@/components/exam/attach-exam-to-class-dialog'

function countClassExamSubmissionStats(
  attempts: ExamAttempt[],
  enrolledStudentIds: Set<string>
): { submitted: number; notSubmitted: number } {
  const submittedIds = new Set<string>()
  for (const a of attempts) {
    const uid = a.userId?.trim()
    if (uid && enrolledStudentIds.has(uid)) submittedIds.add(uid)
  }
  const enrolled = enrolledStudentIds.size
  return {
    submitted: submittedIds.size,
    notSubmitted: Math.max(0, enrolled - submittedIds.size),
  }
}

function formatExamSessionRosterReport(
  template: string,
  submitted: number,
  notSubmitted: number
): string {
  return template
    .replace(/\{submitted\}/g, String(submitted))
    .replace(/\{notSubmitted\}/g, String(notSubmitted))
}

function fillExamTeacherSummaryTemplate(template: string, vars: Record<string, string | number>): string {
  let out = template
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(String(v))
  }
  return out
}

function attemptEssaySubmissionHasImages(
  sub: Record<string, { text?: string; imageUrls?: string[] }>
): boolean {
  for (const v of Object.values(sub)) {
    const arr = v?.imageUrls
    if (!Array.isArray(arr)) continue
    if (arr.some((u) => typeof u === 'string' && u.trim().length > 0)) return true
  }
  return false
}

function formatExamScaleShort(n: number): string {
  if (!Number.isFinite(n)) return '0'
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

function examAttemptSortGrade10(s: ExamAttempt): number {
  const gm = s.gradingMeta
  if (gm && gm.quizTotal > 0 && gm.essayPointsMax > 0 && gm.quizPointsMax > 0) {
    return Math.round((gm.quizPoints / gm.quizPointsMax) * 100) / 10
  }
  const total = Math.max(0, Number(s.maxScore || 0))
  return total > 0 ? (Number(s.score || 0) / total) * 10 : 0
}

/** Học sinh có trong danh sách lớp (có tài khoản) chưa có lượt nộp nào gắn user_id trong phiên này */
function listEnrolledNotSubmittedForSession(
  attempts: ExamAttempt[],
  membersList: Member[]
): Member[] {
  const submittedIds = new Set<string>()
  for (const a of attempts) {
    const uid = a.userId?.trim()
    if (uid) submittedIds.add(uid)
  }
  const enrolled = membersList.filter(
    (m) => m.kind === 'student' && !m.userId.startsWith('exam-attempt:')
  )
  return enrolled
    .filter((m) => !submittedIds.has(m.userId))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

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
type ExamAttempt = {
  id: string
  sessionId: string
  examCode: string
  examTitle: string
  studentName: string
  /** Có khi nộp đã đăng nhập — dùng thống kê đã nộp/chưa nộp theo roster lớp */
  userId: string | null
  score: number
  maxScore: number
  submittedAt: string
  gradingMeta?: ExamGradingMeta | null
  /** Phiên bài tập về nhà — tách hiển thị với bài thi có điểm */
  practiceHomework?: boolean
}
type ExamSessionRow = {
  id: string
  code: string
  title: string
  createdAt?: string | null
  status?: string
  practiceHomework?: boolean
}

type LopDetailPageMode =
  | 'hub'
  | 'exams-index'
  | 'exam-session'
  | 'roster'
  | 'gradebook'
  | 'student-worksheets'

/** Bài có phần TL và GV chưa chấm (không có mốc essayGradedAt). */
function attemptNeedsBulkAiEssayGrading(a: ExamAttempt): boolean {
  const gm = a.gradingMeta
  if (!gm || gm.essayPointsMax <= 0) return false
  if (gm.essayGradedAt) return false
  return true
}

/** Phiên thi có ít nhất một bài nộp kèm meta phần tự luận (để hiện nút chấm hàng loạt). */
function sessionHasEssaySection(attempts: ExamAttempt[]): boolean {
  return attempts.some((a) => (a.gradingMeta?.essayPointsMax ?? 0) > 0)
}

/** Một dòng phiên đề (thi hoặc bài tập về nhà) trong danh sách học sinh */
function StudentClassExamOrHomeworkSessionRow({
  session,
  attempt,
  t,
  examStudentDoPath,
  webLocale,
}: {
  session: ExamSessionRow
  attempt: ExamAttempt | null
  t: Dictionary['classes']
  examStudentDoPath: (code: string) => string
  webLocale: WebLocale
}) {
  const isClosed = String(session.status ?? 'active').toLowerCase() !== 'active'
  const canOpenLamBai = Boolean(session.code?.trim()) && (!isClosed || Boolean(attempt))
  const isHw = Boolean(session.practiceHomework)
  const fb =
    attempt && !isHw
      ? getExamAttemptFeedbackWithMeta(
          Number(attempt.score),
          Number(attempt.maxScore),
          attempt.gradingMeta ?? null
        )
      : null
  const timeStr = attempt ? formatSessionIsoDateTime(attempt.submittedAt, webLocale) : ''
  const sessionCreatedDisplay = formatSessionIsoDateTime(session.createdAt, webLocale)
  return (
    <li className="px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-sm leading-snug">{session.title}</p>
          {isHw ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200">
              {t.classSessionBadgeHomework}
            </span>
          ) : null}
          {isClosed ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {t.studentClassExamBadgeClosed}
            </span>
          ) : null}
        </div>
        {sessionCreatedDisplay ? (
          <p className="text-xs text-muted-foreground">
            {fillExamTeacherSummaryTemplate(t.examSessionCreatedAt, { time: sessionCreatedDisplay })}
          </p>
        ) : null}
        {attempt ? (
          <>
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              {t.studentClassExamSubmitted}
            </p>
            {isHw ? (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t.studentClassHomeworkSubmittedCaption}
              </p>
            ) : fb ? (
              <p className="text-xs text-muted-foreground tabular-nums">
                {fillExamTeacherSummaryTemplate(t.studentClassExamProgressScores, {
                  score100: formatExamScaleShort(fb.scoreOn100),
                  grade10: formatExamScaleShort(fb.grade10),
                })}
              </p>
            ) : null}
            {timeStr ? (
              <p className="text-[11px] text-muted-foreground">
                {fillExamTeacherSummaryTemplate(t.studentClassExamSubmittedAt, { time: timeStr })}
              </p>
            ) : null}
          </>
        ) : isClosed ? (
          <p className="text-xs text-amber-800 dark:text-amber-200">{t.studentClassExamClosedMissed}</p>
        ) : (
          <p className="text-xs text-muted-foreground">{t.studentClassExamNotStarted}</p>
        )}
      </div>
      <div className="shrink-0 flex flex-wrap gap-2 sm:pt-0.5">
        {canOpenLamBai ? (
          <Button type="button" size="sm" variant={attempt ? 'outline' : 'default'} asChild>
            <Link href={examStudentDoPath(session.code)}>
              {attempt ? t.studentClassExamCtaViewResult : t.studentClassExamCtaStart}
            </Link>
          </Button>
        ) : null}
      </div>
    </li>
  )
}

type TeacherClassExamGroup = {
  sessionId: string
  examCode: string
  examTitle: string
  attempts: ExamAttempt[]
  practiceHomework: boolean
  createdAt: string | null
}

function TeacherClassExamGroupListItem({
  g,
  classId,
  t,
  webLocale,
  enrolledStudentIds,
  copyExamStudentLink,
  setExamShare,
  setDeleteExamTarget,
  setAttachExamTarget,
  setNotSubmittedSessionId,
}: {
  g: TeacherClassExamGroup
  classId: string
  t: Dictionary['classes']
  webLocale: WebLocale
  enrolledStudentIds: Set<string>
  copyExamStudentLink: (code: string) => void
  setExamShare: (next: { code: string; title: string } | null) => void
  setDeleteExamTarget: (next: { sessionId: string; code: string; title: string } | null) => void
  setAttachExamTarget: (next: { sessionId: string; title: string } | null) => void
  setNotSubmittedSessionId: (id: string | null) => void
}) {
  const roster = countClassExamSubmissionStats(g.attempts, enrolledStudentIds)
  const createdAtDisplay = formatSessionIsoDateTime(g.createdAt, webLocale)
  return (
    <li className="px-4 py-3">
      <div className="flex flex-col gap-2.5">
        <p className="font-medium text-sm leading-snug">{g.examTitle}</p>
        {createdAtDisplay ? (
          <p className="text-xs text-muted-foreground">
            {fillExamTeacherSummaryTemplate(t.examSessionCreatedAt, { time: createdAtDisplay })}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {g.examCode ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setExamShare({ code: g.examCode, title: g.examTitle })}
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
              <Button type="button" variant="secondary" size="sm" className="shrink-0" asChild>
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
                className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
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
            className="shrink-0 gap-1.5"
            onClick={() => setAttachExamTarget({ sessionId: g.sessionId, title: g.examTitle })}
          >
            <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t.examAttachToOtherClassButton}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="default" size="sm" className="shrink-0" asChild>
            <Link href={`/lop/${classId}/bai-thi/${g.sessionId}`}>{t.classExamGoToSession}</Link>
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 tabular-nums whitespace-nowrap text-muted-foreground">
            {formatExamSessionRosterReport(t.examSessionRosterReport, roster.submitted, roster.notSubmitted)}
          </span>
          <span className="text-muted-foreground/45 select-none" aria-hidden>
            ·
          </span>
          <span className="whitespace-nowrap tabular-nums">
            {g.attempts.length} {t.examAttemptCount}
          </span>
          {g.examCode ? (
            <>
              <span className="text-muted-foreground/45 select-none" aria-hidden>
                ·
              </span>
              <code className="rounded-md bg-muted/70 px-1.5 py-0.5 font-mono text-[11px] text-foreground/90">
                {g.examCode}
              </code>
            </>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 gap-1 px-2 text-xs"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setNotSubmittedSessionId(g.sessionId)
            }}
          >
            <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t.examSessionShowNotSubmitted}
          </Button>
        </div>
      </div>
    </li>
  )
}

export default function LopDetailClient({
  cls,
  isTeacher,
  members = [],
  initialExamAttempts = [],
  initialExamSessions = [],
  pageMode = 'hub',
  focusSessionId: focusSessionIdProp,
  showClassHomeLink = false,
  webLocale,
  t,
}: {
  cls: {
    id: string
    name: string
    join_code: string
    gradeLevelId: string | null
    schoolName: string
    subjectNames?: string[]
    subjectLabel?: string | null
    teacherDisplayName?: string | null
  }
  isTeacher: boolean
  members?: Member[]
  initialExamAttempts?: ExamAttempt[]
  /** Phiên đề thi gắn lớp (luôn hiển thị, kể cả chưa có bài nộp) */
  initialExamSessions?: ExamSessionRow[]
  pageMode?: LopDetailPageMode
  focusSessionId?: string
  showClassHomeLink?: boolean
  webLocale: WebLocale
  t: Dictionary['classes']
}) {
  const subjectNames = cls.subjectNames ?? []
  const [membersList, setMembersList] = useState<Member[]>(members ?? [])
  const [removeMemberTarget, setRemoveMemberTarget] = useState<Member | null>(null)
  const [removingMember, setRemovingMember] = useState(false)
  const [editMemberTarget, setEditMemberTarget] = useState<Member | null>(null)
  const [editMemberNameInput, setEditMemberNameInput] = useState('')
  const [savingMemberName, setSavingMemberName] = useState(false)
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteClassConfirmInput, setDeleteClassConfirmInput] = useState('')
  const [deletingClass, setDeletingClass] = useState(false)
  /** GV: hộp thoại QR + link — không điều hướng sang /lam-bai */
  const [examShare, setExamShare] = useState<{ code: string; title: string } | null>(null)
  const [shareQrDataUrl, setShareQrDataUrl] = useState<string | null>(null)
  const [attachExamTarget, setAttachExamTarget] = useState<{ sessionId: string; title: string } | null>(null)
  const [notSubmittedSessionId, setNotSubmittedSessionId] = useState<string | null>(null)
  const [facingSubject, setFacingSubject] = useState(() => String(cls.subjectLabel ?? '').trim())
  const [facingTeacher, setFacingTeacher] = useState(() => String(cls.teacherDisplayName ?? '').trim())
  const [saveFacingDefaults, setSaveFacingDefaults] = useState(false)
  const [savingFacing, setSavingFacing] = useState(false)
  const [gradeEssayTarget, setGradeEssayTarget] = useState<ExamAttempt | null>(null)
  const [gradeEssayOpen, setGradeEssayOpen] = useState(false)
  const [gradeEssayLoading, setGradeEssayLoading] = useState(false)
  const [gradeEssayDetail, setGradeEssayDetail] = useState<{
    examTitle: string
    attempt: {
      answers: Record<string, unknown>
      essaySubmission: Record<string, { text?: string; imageUrls?: string[] }>
    }
    /** Meta từ API detail (ưu tiên cho mốc hết hạn ảnh so với bản trong danh sách lớp). */
    gradingMeta: ExamGradingMeta | null
    questions: Array<{ id: string; index: number; questionText: string; isEssay: boolean }>
  } | null>(null)
  const [essayPointsInput, setEssayPointsInput] = useState('')
  const [essayAiLoading, setEssayAiLoading] = useState(false)
  const [essayAiRationale, setEssayAiRationale] = useState('')
  const [savingEssayGrade, setSavingEssayGrade] = useState(false)
  const [bulkEssayAiSessionId, setBulkEssayAiSessionId] = useState<string | null>(null)
  const [bulkEssayAiProgress, setBulkEssayAiProgress] = useState<{ current: number; total: number } | null>(
    null
  )
  const router = useRouter()
  const { toast } = useToast()
  const sortedExamAttempts = useMemo(
    () =>
      [...examAttempts].sort((a, b) => {
        const aGrade = examAttemptSortGrade10(a)
        const bGrade = examAttemptSortGrade10(b)
        if (aGrade !== bGrade) return aGrade - bGrade
        return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
      }),
    [examAttempts]
  )
  const lowScoreCount = useMemo(
    () =>
      sortedExamAttempts.filter(
        (s) => !s.practiceHomework && examAttemptSortGrade10(s) < 5
      ).length,
    [sortedExamAttempts]
  )
  /** Học sinh trong lớp (thành viên có tài khoản), không tính dòng ẩn danh exam-attempt:… */
  const enrolledStudentIds = useMemo(() => {
    const ids = new Set<string>()
    for (const m of membersList) {
      if (m.kind !== 'student') continue
      if (m.userId.startsWith('exam-attempt:')) continue
      ids.add(m.userId)
    }
    return ids
  }, [membersList])
  const studentClassExamRows = useMemo(() => {
    if (isTeacher) return []
    const bySession = new Map<string, ExamAttempt>()
    for (const a of examAttempts) {
      bySession.set(a.sessionId, a)
    }
    return [...examSessionsList]
      .slice()
      .sort((a, b) => {
        const ta = a.createdAt ? Date.parse(a.createdAt) : 0
        const tb = b.createdAt ? Date.parse(b.createdAt) : 0
        return tb - ta
      })
      .map((s) => ({ session: s, attempt: bySession.get(s.id) ?? null }))
  }, [isTeacher, examSessionsList, examAttempts])

  const studentClassExamRowsExamsOnly = useMemo(
    () => studentClassExamRows.filter(({ session }) => !session.practiceHomework),
    [studentClassExamRows]
  )
  const studentClassHomeworkSessionRows = useMemo(
    () => studentClassExamRows.filter(({ session }) => Boolean(session.practiceHomework)),
    [studentClassExamRows]
  )

  const examGroups = useMemo(() => {
    const attemptsBySession = new Map<string, ExamAttempt[]>()
    for (const item of sortedExamAttempts) {
      const list = attemptsBySession.get(item.sessionId)
      if (list) list.push(item)
      else attemptsBySession.set(item.sessionId, [item])
    }
    const examSessionNewestFirst = (
      sessionId: string,
      attempts: ExamAttempt[],
      sessionCreatedAt?: string | null
    ): number => {
      const fromSession = sessionCreatedAt ? Date.parse(sessionCreatedAt) : NaN
      if (!Number.isNaN(fromSession)) return fromSession
      let max = 0
      for (const a of attempts) {
        const t = Date.parse(a.submittedAt)
        if (!Number.isNaN(t) && t > max) max = t
      }
      return max
    }
    const sessions = examSessionsList ?? []
    const createdAtBySessionId = new Map(sessions.map((s) => [s.id, s.createdAt ?? null]))
    if (sessions.length > 0) {
      const groups = sessions.map((s) => ({
        sessionId: s.id,
        examCode: s.code,
        examTitle: s.title || 'Bài thi',
        attempts: attemptsBySession.get(s.id) ?? [],
        practiceHomework: Boolean(s.practiceHomework),
        createdAt: s.createdAt ?? null,
      }))
      return groups.sort(
        (a, b) =>
          examSessionNewestFirst(b.sessionId, b.attempts, createdAtBySessionId.get(b.sessionId)) -
          examSessionNewestFirst(a.sessionId, a.attempts, createdAtBySessionId.get(a.sessionId))
      )
    }
    const fallback = Array.from(attemptsBySession.entries()).map(([sessionId, attempts]) => ({
      sessionId,
      examCode: attempts[0]?.examCode ?? '',
      examTitle: attempts[0]?.examTitle ?? 'Bài thi',
      attempts,
      practiceHomework: Boolean(attempts[0]?.practiceHomework),
      createdAt: null as string | null,
    }))
    return fallback.sort(
      (a, b) => examSessionNewestFirst(b.sessionId, b.attempts) - examSessionNewestFirst(a.sessionId, a.attempts)
    )
  }, [examSessionsList, sortedExamAttempts])

  const examGroupsGraded = useMemo(
    () => examGroups.filter((g) => !g.practiceHomework),
    [examGroups]
  )

  const notSubmittedDialogList = useMemo(() => {
    if (!notSubmittedSessionId) return []
    const g = examGroups.find((x) => x.sessionId === notSubmittedSessionId)
    if (!g) return []
    return listEnrolledNotSubmittedForSession(g.attempts, membersList)
  }, [notSubmittedSessionId, examGroups, membersList])

  const notSubmittedDialogExamTitle = useMemo(() => {
    if (!notSubmittedSessionId) return ''
    return examGroups.find((x) => x.sessionId === notSubmittedSessionId)?.examTitle ?? ''
  }, [notSubmittedSessionId, examGroups])

  useEffect(() => {
    if (
      notSubmittedSessionId &&
      !examGroups.some((g) => g.sessionId === notSubmittedSessionId)
    ) {
      setNotSubmittedSessionId(null)
    }
  }, [examGroups, notSubmittedSessionId])

  useEffect(() => {
    setFacingSubject(String(cls.subjectLabel ?? '').trim())
    setFacingTeacher(String(cls.teacherDisplayName ?? '').trim())
  }, [cls.subjectLabel, cls.teacherDisplayName])

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
    if (editMemberTarget) {
      const n = editMemberTarget.name.trim()
      setEditMemberNameInput(n === '—' ? '' : editMemberTarget.name)
    } else {
      setEditMemberNameInput('')
    }
  }, [editMemberTarget])

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

  const openGradeEssayDialog = useCallback(
    (s: ExamAttempt) => {
      setGradeEssayTarget(s)
      setGradeEssayOpen(true)
      setGradeEssayDetail(null)
      setEssayAiRationale('')
      const cur = s.gradingMeta?.essayPointsAwarded
      setEssayPointsInput(
        cur !== undefined && Number.isFinite(Number(cur)) ? String(cur) : ''
      )
      setGradeEssayLoading(true)
      void fetch(`/api/exam-session/attempt/${encodeURIComponent(s.id)}/detail`)
        .then(async (r) => {
          const data = await r.json().catch(() => ({}))
          return { ok: r.ok, data }
        })
        .then(({ ok, data }) => {
          if (!ok) {
            throw new Error(String(data?.error ?? t.examGradeEssayLoadFailed))
          }
          setGradeEssayDetail({
            examTitle: String(data.examTitle ?? ''),
            attempt: {
              answers:
                data.attempt?.answers && typeof data.attempt.answers === 'object'
                  ? (data.attempt.answers as Record<string, unknown>)
                  : {},
              essaySubmission:
                data.attempt?.essaySubmission && typeof data.attempt.essaySubmission === 'object'
                  ? (data.attempt.essaySubmission as Record<string, { text?: string; imageUrls?: string[] }>)
                  : {},
            },
            gradingMeta: parseExamGradingMeta(data.attempt?.gradingMeta),
            questions: Array.isArray(data.questions) ? data.questions : [],
          })
        })
        .catch((e) => {
          toast({
            variant: 'destructive',
            description: e instanceof Error ? e.message : t.examGradeEssayLoadFailed,
          })
          setGradeEssayOpen(false)
          setGradeEssayTarget(null)
        })
        .finally(() => setGradeEssayLoading(false))
    },
    [t, toast]
  )

  const applyEssayGradeToAttempt = useCallback(
    async (
      attemptId: string,
      essayPointsAwarded: number
    ): Promise<{ ok: true } | { ok: false; error: string }> => {
      const res = await fetch(`/api/exam-session/attempt/${encodeURIComponent(attemptId)}/essay-grade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ essayPointsAwarded }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        return { ok: false, error: String(data?.error ?? t.examGradeEssaySaveFailed) }
      }
      const newMeta = parseExamGradingMeta(data.gradingMeta)
      setExamAttempts((prev) =>
        prev.map((a) =>
          a.id === attemptId
            ? {
                ...a,
                score: Number(data.score ?? a.score),
                maxScore: Number(data.maxScore ?? a.maxScore),
                gradingMeta: newMeta ?? a.gradingMeta,
              }
            : a
        )
      )
      return { ok: true }
    },
    [t.examGradeEssaySaveFailed]
  )

  const saveEssayGrade = useCallback(async () => {
    if (!gradeEssayTarget) return
    const n = Number(essayPointsInput)
    if (!Number.isFinite(n) || n < 0) {
      toast({ variant: 'destructive', description: t.examGradeEssaySaveFailed })
      return
    }
    setSavingEssayGrade(true)
    try {
      const r = await applyEssayGradeToAttempt(gradeEssayTarget.id, n)
      if (!r.ok) {
        toast({ variant: 'destructive', description: r.error })
        return
      }
      toast({ description: t.examGradeEssaySaved })
      setGradeEssayOpen(false)
      setGradeEssayTarget(null)
      router.refresh()
    } finally {
      setSavingEssayGrade(false)
    }
  }, [gradeEssayTarget, essayPointsInput, t, toast, router, applyEssayGradeToAttempt])

  const runEssayAiSuggest = useCallback(async () => {
    if (!gradeEssayTarget) return
    setEssayAiLoading(true)
    setEssayAiRationale('')
    try {
      const res = await fetch(
        `/api/exam-session/attempt/${encodeURIComponent(gradeEssayTarget.id)}/essay-ai-suggest`,
        { method: 'POST' }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ variant: 'destructive', description: data?.error ?? t.examGradeEssayAiFailed })
        return
      }
      const sp = Number(data.suggestedPoints)
      if (Number.isFinite(sp)) setEssayPointsInput(String(sp))
      setEssayAiRationale(String(data.rationale ?? ''))
    } finally {
      setEssayAiLoading(false)
    }
  }, [gradeEssayTarget, t, toast])

  const runBulkEssayAiForSession = useCallback(
    async (sessionId: string) => {
      const pending = examAttempts
        .filter((a) => a.sessionId === sessionId && attemptNeedsBulkAiEssayGrading(a))
        .slice()
        .sort((a, b) => {
          const c = a.studentName.localeCompare(b.studentName, 'vi', { sensitivity: 'base' })
          if (c !== 0) return c
          return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
        })
      if (pending.length === 0) {
        toast({ description: t.examGradeAllEssayAiNonePending })
        return
      }
      setBulkEssayAiSessionId(sessionId)
      setBulkEssayAiProgress({ current: 1, total: pending.length })
      let ok = 0
      let fail = 0
      try {
        for (let i = 0; i < pending.length; i++) {
          const att = pending[i]!
          setBulkEssayAiProgress({ current: i + 1, total: pending.length })
          const sugRes = await fetch(
            `/api/exam-session/attempt/${encodeURIComponent(att.id)}/essay-ai-suggest`,
            { method: 'POST' }
          )
          const sug = await sugRes.json().catch(() => ({}))
          if (!sugRes.ok) {
            fail++
            toast({
              variant: 'destructive',
              description: `${att.studentName}: ${String(sug?.error ?? t.examGradeEssayAiFailed)}`,
            })
            continue
          }
          const sp = Number(sug.suggestedPoints)
          if (!Number.isFinite(sp) || sp < 0) {
            fail++
            toast({
              variant: 'destructive',
              description: `${att.studentName}: ${t.examGradeEssayAiFailed}`,
            })
            continue
          }
          const applied = await applyEssayGradeToAttempt(att.id, sp)
          if (!applied.ok) {
            fail++
            toast({ variant: 'destructive', description: `${att.studentName}: ${applied.error}` })
            continue
          }
          ok++
        }
        if (fail === 0) {
          toast({
            description: fillExamTeacherSummaryTemplate(t.examGradeAllEssayAiSummarySuccess, {
              n: String(ok),
            }),
          })
        } else {
          toast({
            variant: ok > 0 ? 'default' : 'destructive',
            description: fillExamTeacherSummaryTemplate(t.examGradeAllEssayAiSummaryPartial, {
              ok: String(ok),
              fail: String(fail),
            }),
          })
        }
        if (ok > 0) router.refresh()
      } finally {
        setBulkEssayAiSessionId(null)
        setBulkEssayAiProgress(null)
      }
    },
    [examAttempts, t, toast, applyEssayGradeToAttempt, router]
  )

  const essayGradeDialogImageExpireIso =
    gradeEssayDetail?.gradingMeta?.essayImageUrlsExpireAt ??
    gradeEssayTarget?.gradingMeta?.essayImageUrlsExpireAt

  const teacherExamSessionGroups = useMemo(() => {
    if (pageMode !== 'exam-session' || !focusSessionIdProp) return []
    return examGroups.filter((g) => g.sessionId === focusSessionIdProp)
  }, [pageMode, focusSessionIdProp, examGroups])

  const pageSectionCard =
    'overflow-hidden rounded-2xl border border-border/90 bg-card shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]'
  const pageSectionHead =
    'flex flex-wrap items-center gap-2.5 border-b border-border/80 bg-gradient-to-r from-muted/55 via-muted/35 to-transparent px-4 py-3 sm:px-5'
  const pageSectionTitle = 'text-base font-semibold tracking-tight text-foreground'
  const pageHero =
    'overflow-hidden rounded-2xl border border-border/90 bg-gradient-to-br from-primary/[0.08] via-card to-muted/30 p-4 shadow-md ring-1 ring-black/[0.04] dark:from-primary/[0.12] dark:to-muted/20 dark:ring-white/[0.06] sm:p-5'

  const studentFacingPreviewLine = useMemo(() => {
    const subj = facingSubject.trim()
    const teach = facingTeacher.trim()
    if (!subj && !teach) return t.classPageStudentFacingNotSet
    return [subj, teach].filter(Boolean).join(' — ')
  }, [facingSubject, facingTeacher, t.classPageStudentFacingNotSet])

  return (
    <>
      <Toaster />
      <header className={cn(pageMode === 'hub' ? 'mb-5' : 'mb-8')}>
        <div className={cn(pageHero, pageMode === 'hub' && 'p-3 sm:p-4')}>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">{className}</h1>
              <span
                className={cn(
                  'inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-medium',
                  isTeacher
                    ? 'border-sky-500/35 bg-sky-500/10 text-sky-900 dark:border-sky-400/30 dark:bg-sky-950/40 dark:text-sky-100'
                    : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-950/40 dark:text-emerald-100'
                )}
              >
                {isTeacher ? t.memberRoleTeacher : t.memberRoleStudent}
              </span>
              {isTeacher && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {editingClassName ? (
                    <>
                      <input
                        value={className}
                        onChange={(e) => setClassName(e.target.value)}
                        className="h-8 max-w-[12rem] rounded-md border border-input bg-background px-2 text-sm sm:max-w-xs"
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
                      <Button variant="outline" size="sm" className="h-8" onClick={() => setEditingClassName(true)}>
                        {t.renameClass}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
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
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground">
            {cls.schoolName ? (
              <span className="rounded-md bg-muted/80 px-2 py-0.5 text-muted-foreground">
                {t.schoolLabel}: <span className="text-foreground/90">{cls.schoolName}</span>
              </span>
            ) : null}
            {cls.gradeLevelId ? (
              <span className="rounded-md bg-muted/80 px-2 py-0.5 text-muted-foreground">
                {t.gradeLevelLabel}: <span className="text-foreground/90">{cls.gradeLevelId}</span>
              </span>
            ) : null}
            {subjectNames.length > 0 ? (
              <span className="rounded-md bg-muted/80 px-2 py-0.5 text-muted-foreground">
                {t.subjectLabel}: <span className="text-foreground/90">{subjectNames.join(', ')}</span>
              </span>
            ) : null}
            {cls.schoolName || cls.gradeLevelId || subjectNames.length > 0 ? (
              <span
                className="hidden h-3.5 w-px shrink-0 bg-border/80 sm:inline-block sm:self-center"
                aria-hidden
              />
            ) : null}
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/80 px-2 py-0.5 font-mono text-[11px] tabular-nums tracking-wide text-foreground sm:text-xs">
              <span className="font-sans text-muted-foreground">
                {t.joinCode}:
              </span>
              {cls.join_code}
              <Button variant="ghost" size="icon" onClick={copyCode} className="h-6 w-6 shrink-0" aria-label={t.copyCode}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </span>
          </div>

          {!isTeacher && (cls.subjectLabel?.trim() || cls.teacherDisplayName?.trim()) ? (
            <p className="mt-2 text-sm font-medium text-foreground leading-snug">
              {[cls.name, String(cls.subjectLabel ?? '').trim(), String(cls.teacherDisplayName ?? '').trim()]
                .filter(Boolean)
                .join(' — ')}
            </p>
          ) : null}

          {isTeacher ? (
            <details className="mt-3 overflow-hidden rounded-xl border border-border/70 bg-background/40 shadow-sm dark:bg-background/25">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-left text-sm outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-foreground">{t.classPageStudentFacingTitle}</span>
                  <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
                    {studentFacingPreviewLine}
                  </span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </summary>
              <div className="space-y-3 border-t border-border/60 px-3 py-3 sm:px-4">
                <p className="text-xs text-muted-foreground leading-relaxed">{t.createClassFacingFieldsHint}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label htmlFor="class-facing-subject" className="text-xs font-medium text-foreground">
                      {t.createClassFacingSubjectLabel}
                    </label>
                    <Input
                      id="class-facing-subject"
                      value={facingSubject}
                      onChange={(e) => setFacingSubject(e.target.value)}
                      placeholder={t.createClassFacingSubjectPlaceholder}
                      maxLength={120}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="class-facing-teacher" className="text-xs font-medium text-foreground">
                      {t.createClassFacingTeacherLabel}
                    </label>
                    <Input
                      id="class-facing-teacher"
                      value={facingTeacher}
                      onChange={(e) => setFacingTeacher(e.target.value)}
                      placeholder={t.createClassFacingTeacherPlaceholder}
                      maxLength={120}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
                <label className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-3.5 w-3.5 rounded border-input"
                    checked={saveFacingDefaults}
                    onChange={(e) => setSaveFacingDefaults(e.target.checked)}
                  />
                  <span>{t.updateClassFacingSaveAsDefaults}</span>
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={savingFacing}
                  className="touch-manipulation"
                  onClick={async () => {
                    setSavingFacing(true)
                    const res = await updateClassStudentFacingInfo({
                      classId: cls.id,
                      subjectLabel: facingSubject,
                      teacherDisplayName: facingTeacher,
                      saveAsDefaults: saveFacingDefaults,
                    })
                    setSavingFacing(false)
                    if ('error' in res && res.error) {
                      toast({ variant: 'destructive', description: res.error })
                      return
                    }
                    toast({ description: t.updateClassFacingSuccess })
                    setSaveFacingDefaults(false)
                    router.refresh()
                  }}
                >
                  {savingFacing ? '…' : t.updateClassFacingSave}
                </Button>
              </div>
            </details>
          ) : null}

          {isTeacher ? (
            <div className="mt-3 grid gap-2 md:hidden sm:grid-cols-2">
              <Button
                variant="secondary"
                className="h-auto w-full touch-manipulation py-2.5 text-sm font-semibold shadow-sm"
                asChild
              >
                <Link href="/tao-bai-thi">{t.mobileCreateExam}</Link>
              </Button>
              <Button
                variant="outline"
                className="h-auto w-full touch-manipulation py-2.5 text-sm font-semibold shadow-sm"
                asChild
              >
                <Link href="/tao-bai-tap-ve-nha">{t.mobileCreateHomework}</Link>
              </Button>
            </div>
          ) : null}
        </div>
      </header>

      {showClassHomeLink ? (
        <div className="mb-6">
          <Button variant="ghost" size="sm" className="h-9 gap-1 px-2 text-muted-foreground" asChild>
            <Link href={`/lop/${cls.id}`}>
              <ChevronRight className="h-4 w-4 rotate-180" aria-hidden />
              {t.classPageBackToClass}
            </Link>
          </Button>
        </div>
      ) : null}

      {pageMode === 'hub' ? (
        <section className="mb-8" aria-labelledby="class-hub-heading">
          <h2 id="class-hub-heading" className="sr-only">
            {className}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {isTeacher ? (
              <div className={cn(pageSectionCard, 'flex flex-col gap-3 p-4')}>
                <Link
                  href={`/lop/${cls.id}/bai-thi`}
                  className="group flex flex-col gap-2 rounded-lg outline-none ring-offset-background transition-colors hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ScrollText className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                      <span className={pageSectionTitle}>{t.classExamsIndexTitle}</span>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  </div>
                  <p className="text-sm text-muted-foreground leading-snug">{t.classHubCardExamsDesc}</p>
                </Link>
                <Button variant="secondary" size="sm" className="w-full touch-manipulation sm:w-auto" asChild>
                  <Link href="/tao-bai-thi">{t.classHubCardCreateExamButton}</Link>
                </Button>
              </div>
            ) : (
              <Link
                href={`/lop/${cls.id}/bai-thi`}
                className={cn(
                  pageSectionCard,
                  'flex flex-col gap-2 p-4 transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ScrollText className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                    <span className={pageSectionTitle}>{t.studentClassExamsTitle}</span>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                </div>
                <p className="text-sm text-muted-foreground leading-snug">{t.classHubCardExamsDescStudent}</p>
              </Link>
            )}
            {!isTeacher ? (
              <Link
                href={`/lop/${cls.id}/phieu-bai-tap`}
                className={cn(
                  pageSectionCard,
                  'flex flex-col gap-2 p-4 transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ScrollText className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
                    <span className={pageSectionTitle}>{t.assignWorksheet}</span>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                </div>
                <p className="text-sm text-muted-foreground leading-snug">{t.classHubCardStudentWorksheetsDesc}</p>
              </Link>
            ) : null}
            <Link
              href={`/lop/${cls.id}/hoc-sinh`}
              className={cn(
                pageSectionCard,
                'flex flex-col gap-2 p-4 transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <span className={pageSectionTitle}>
                    {isTeacher ? t.students : t.classHubCardRosterTitleStudent}
                  </span>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              </div>
              <p className="text-sm text-muted-foreground leading-snug">
                {isTeacher ? t.classHubCardStudentsDesc : t.classHubCardStudentsDescStudent}
              </p>
            </Link>
            {isTeacher ? (
              <>
                <div className={cn(pageSectionCard, 'flex flex-col gap-3 p-4')}>
                  <Link
                    href={`/lop/${cls.id}/gan-phieu`}
                    className="group flex flex-col gap-2 rounded-lg outline-none ring-offset-background transition-colors hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FilePlus2 className="h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
                        <span className={pageSectionTitle}>{t.assignWorksheet}</span>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                    </div>
                    <p className="text-sm text-muted-foreground leading-snug">{t.classHubCardAssignWorksheetDesc}</p>
                  </Link>
                  <Button variant="secondary" size="sm" className="w-full touch-manipulation sm:w-auto" asChild>
                    <Link href="/tao-bai-tap-ve-nha">{t.classHubCardCreateHomeworkButton}</Link>
                  </Button>
                </div>
                <Link
                  href={`/lop/${cls.id}/ket-qua`}
                  className={cn(
                    pageSectionCard,
                    'flex flex-col gap-2 p-4 transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Table2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                      <span className={pageSectionTitle}>{t.gradebookTitle}</span>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  </div>
                  <p className="text-sm text-muted-foreground leading-snug">{t.classHubCardGradebookDesc}</p>
                </Link>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      {isTeacher && pageMode === 'exams-index' && (
        <section className="mb-8" aria-labelledby="class-exam-submissions-heading">
          <div className={pageSectionCard}>
            <div className={pageSectionHead}>
              <ScrollText className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <h2 id="class-exam-submissions-heading" className={pageSectionTitle}>
                {t.classExamsIndexTitle}
              </h2>
            </div>
            <div className="space-y-3 bg-muted/10 p-3 sm:p-4">
          {examGroupsGraded.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.noExamsForClass}</p>
          ) : (
            <>
              {lowScoreCount > 0 ? (
                <div className="rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-100">
                  {t.lowScoreWarningPrefix} {lowScoreCount} {t.lowScoreWarningSuffix}
                </div>
              ) : null}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">{t.classExamsSubsectionGraded}</p>
                <ul className="divide-y divide-border/80 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
                  {examGroupsGraded.map((g) => (
                    <TeacherClassExamGroupListItem
                      key={g.sessionId}
                      g={g}
                      classId={cls.id}
                      t={t}
                      webLocale={webLocale}
                      enrolledStudentIds={enrolledStudentIds}
                      copyExamStudentLink={copyExamStudentLink}
                      setExamShare={setExamShare}
                      setDeleteExamTarget={setDeleteExamTarget}
                      setAttachExamTarget={setAttachExamTarget}
                      setNotSubmittedSessionId={setNotSubmittedSessionId}
                    />
                  ))}
                </ul>
              </div>
            </>
          )}
            </div>
          </div>
        </section>
      )}

      {isTeacher && pageMode === 'exam-session' && (
        <section className="mb-8" aria-labelledby="class-exam-session-detail-heading">
          <div className={pageSectionCard}>
            <div className={pageSectionHead}>
              <ScrollText className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <h2 id="class-exam-session-detail-heading" className={pageSectionTitle}>
                {t.classExamSessionPageTitle}
              </h2>
            </div>
            <div className="space-y-3 bg-muted/10 p-3 sm:p-4">
              {teacherExamSessionGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.noExamsForClass}</p>
              ) : (
                <ul className="divide-y divide-border/80 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
                  {teacherExamSessionGroups.map((g) => {
                    const roster = countClassExamSubmissionStats(g.attempts, enrolledStudentIds)
                    const sessionCreatedAtDisplay = formatSessionIsoDateTime(g.createdAt, webLocale)
                    return (
                      <li key={g.sessionId} className="px-4 py-3">
                        <div className="flex flex-col gap-2.5">
                          <p className="font-medium text-sm leading-snug">{g.examTitle}</p>
                          {sessionCreatedAtDisplay ? (
                            <p className="text-xs text-muted-foreground">
                              {fillExamTeacherSummaryTemplate(t.examSessionCreatedAt, {
                                time: sessionCreatedAtDisplay,
                              })}
                            </p>
                          ) : null}
                          <div className="flex flex-wrap items-center gap-2">
                            {g.examCode ? (
                              <>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="shrink-0"
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
                                <Button type="button" variant="secondary" size="sm" className="shrink-0" asChild>
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
                                  className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
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
                              className="shrink-0 gap-1.5"
                              onClick={() => setAttachExamTarget({ sessionId: g.sessionId, title: g.examTitle })}
                            >
                              <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              {t.examAttachToOtherClassButton}
                            </Button>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {sessionHasEssaySection(g.attempts) ? (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="shrink-0 gap-1 border border-primary/25 bg-primary/10 text-foreground hover:bg-primary/15 dark:border-primary/35 dark:bg-primary/15 disabled:opacity-60"
                                title={
                                  !g.attempts.some(attemptNeedsBulkAiEssayGrading)
                                    ? t.examGradeAllEssayAiNonePending
                                    : undefined
                                }
                                disabled={
                                  bulkEssayAiSessionId !== null ||
                                  !g.attempts.some(attemptNeedsBulkAiEssayGrading)
                                }
                                onClick={() => void runBulkEssayAiForSession(g.sessionId)}
                              >
                                {bulkEssayAiSessionId === g.sessionId ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                                    <span className="max-w-[min(100%,14rem)] truncate sm:max-w-[18rem]">
                                      {bulkEssayAiProgress
                                        ? fillExamTeacherSummaryTemplate(t.examGradeAllEssayAiRunning, {
                                            current: String(bulkEssayAiProgress.current),
                                            total: String(bulkEssayAiProgress.total),
                                          })
                                        : t.examGradeEssayAiRunning}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                                    {t.examGradeAllEssayAiButton}
                                  </>
                                )}
                              </Button>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 tabular-nums whitespace-nowrap text-muted-foreground">
                              {formatExamSessionRosterReport(
                                t.examSessionRosterReport,
                                roster.submitted,
                                roster.notSubmitted
                              )}
                            </span>
                            <span className="text-muted-foreground/45 select-none" aria-hidden>
                              ·
                            </span>
                            <span className="whitespace-nowrap tabular-nums">
                              {g.attempts.length} {t.examAttemptCount}
                            </span>
                            {g.examCode ? (
                              <>
                                <span className="text-muted-foreground/45 select-none" aria-hidden>
                                  ·
                                </span>
                                <code className="rounded-md bg-muted/70 px-1.5 py-0.5 font-mono text-[11px] text-foreground/90">
                                  {g.examCode}
                                </code>
                              </>
                            ) : null}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 shrink-0 gap-1 px-2 text-xs"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setNotSubmittedSessionId(g.sessionId)
                              }}
                            >
                              <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              {t.examSessionShowNotSubmitted}
                            </Button>
                          </div>
                        </div>
                        {g.attempts.length === 0 ? (
                            <p className="mt-3 rounded-lg border border-input bg-background/60 px-3 py-3 text-sm text-muted-foreground">
                              {t.examSessionNoAttemptsYet}
                            </p>
                          ) : (
                            <ul className="mt-3 divide-y divide-border/80 overflow-hidden rounded-lg border border-border/70 bg-background/60">
                              {g.attempts.map((s) => (
                                <li key={s.id} className="flex flex-col gap-3 px-3 py-3">
                                  <div className="min-w-0">
                                    <p className="font-medium text-sm">{s.studentName}</p>
                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
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
                                  {s.gradingMeta && s.gradingMeta.essayPointsMax > 0 ? (
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      className="h-8 w-fit self-start"
                                      onClick={() => openGradeEssayDialog(s)}
                                    >
                                      {t.examGradeEssayAction}
                                      {s.gradingMeta.essayGradedAt ? (
                                        <span className="ml-1.5 text-[10px] font-normal opacity-80">
                                          ({t.examGradeEssayGradedBadge})
                                        </span>
                                      ) : (
                                        <span className="ml-1.5 text-[10px] font-normal opacity-80">
                                          ({t.examGradeEssayPendingBadge})
                                        </span>
                                      )}
                                    </Button>
                                  ) : null}
                                  <div className="min-w-0 text-sm leading-relaxed text-muted-foreground break-words">
                                    {(() => {
                                      const gm = s.gradingMeta
                                      const time = formatSessionIsoDateTime(s.submittedAt, webLocale)
                                      const score = Math.max(0, Number(s.score || 0))
                                      const max = Math.max(0, Number(s.maxScore || 0))
                                      if (gm && gm.quizTotal > 0 && gm.essayPointsMax > 0) {
                                        const correct = Math.max(0, gm.quizCorrect)
                                        const total = Math.max(0, gm.quizTotal)
                                        const wrong = Math.max(0, total - correct)
                                        const grade10 =
                                          gm.quizPointsMax > 0
                                            ? Math.round((gm.quizPoints / gm.quizPointsMax) * 100) / 10
                                            : 0
                                        return fillExamTeacherSummaryTemplate(t.examTeacherAttemptMixedSummary, {
                                          correct,
                                          wrong,
                                          total,
                                          grade10,
                                          score,
                                          max,
                                          essayMax: gm.essayPointsMax,
                                          time,
                                        })
                                      }
                                      if (gm && gm.quizTotal === 0 && gm.essayPointsMax > 0) {
                                        return fillExamTeacherSummaryTemplate(t.examTeacherAttemptEssayOnlySummary, {
                                          score,
                                          max,
                                          essayMax: gm.essayPointsMax,
                                          time,
                                        })
                                      }
                                      const correct = Math.max(0, Number(s.score || 0))
                                      const totalQ = Math.max(0, Number(s.maxScore || 0))
                                      const wrong = Math.max(0, totalQ - correct)
                                      const grade10 =
                                        totalQ > 0 ? Math.round((correct / totalQ) * 100) / 10 : 0
                                      return `${t.correctLabel} ${correct} ${t.questionSuffix}, ${t.wrongLabel} ${wrong} ${t.questionSuffix}, ${t.scoreLabel} ${grade10}/10 • ${time}`
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
              )}
            </div>
          </div>
        </section>
      )}

      {!isTeacher && pageMode === 'exams-index' ? (
        <section className="mb-8" aria-labelledby="student-class-exams-heading">
          <div className={pageSectionCard}>
            <div className={pageSectionHead}>
              <ScrollText className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
              <h2 id="student-class-exams-heading" className={pageSectionTitle}>
                {t.studentClassExamsTitle}
              </h2>
            </div>
            <div className="bg-muted/10 p-3 sm:p-4">
          {studentClassExamRowsExamsOnly.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.noExamsForClass}</p>
          ) : (
            <ul className="divide-y divide-border/80 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
              {studentClassExamRowsExamsOnly.map(({ session, attempt }) => (
                <StudentClassExamOrHomeworkSessionRow
                  key={session.id}
                  session={session}
                  attempt={attempt}
                  t={t}
                  webLocale={webLocale}
                  examStudentDoPath={examStudentDoPath}
                />
              ))}
            </ul>
          )}
            </div>
          </div>
        </section>
      ) : null}

      {!isTeacher && pageMode === 'student-worksheets' ? (
        <section className="mb-8" aria-labelledby="student-class-homework-sessions-heading">
          <div className={pageSectionCard}>
            <div className={pageSectionHead}>
              <ScrollText className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
              <h2 id="student-class-homework-sessions-heading" className={pageSectionTitle}>
                {t.assignWorksheet}
              </h2>
            </div>
            <div className="bg-muted/10 p-3 sm:p-4">
              {studentClassHomeworkSessionRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.classStudentHomeworkSessionsEmpty}</p>
              ) : (
                <ul className="divide-y divide-border/80 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
                  {studentClassHomeworkSessionRows.map(({ session, attempt }) => (
                    <StudentClassExamOrHomeworkSessionRow
                      key={session.id}
                      session={session}
                      attempt={attempt}
                      t={t}
                      webLocale={webLocale}
                      examStudentDoPath={examStudentDoPath}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {pageMode === 'roster' ? (
      <section className="mb-8" aria-labelledby="class-roster-heading">
        <div className={pageSectionCard}>
          <div className={pageSectionHead}>
            <Users className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <h2 id="class-roster-heading" className={pageSectionTitle}>
              {t.students}
            </h2>
          </div>
          <div className="bg-muted/10 p-3 sm:p-4">
        {membersList.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noStudents}</p>
        ) : (
          <ul className="divide-y divide-border/80 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
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
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {isTeacher &&
                    m.kind === 'student' &&
                    !m.userId.startsWith('exam-attempt:') ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0"
                        onClick={() => setEditMemberTarget(m)}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden />
                        {t.teacherEditStudentNameButton}
                      </Button>
                    ) : null}
                    {m.removable ? (
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
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
          </div>
        </div>
      </section>
      ) : null}

      {pageMode === 'gradebook' && isTeacher ? <ClassGradebookSection classId={cls.id} t={t} /> : null}

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
                if (pageMode === 'exam-session') {
                  router.push(`/lop/${cls.id}/bai-thi`)
                } else {
                  router.refresh()
                }
              }}
            >
              {deletingExam ? t.examDeleting : t.examDeleteConfirmAction}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={notSubmittedSessionId !== null}
        onOpenChange={(open) => {
          if (!open) setNotSubmittedSessionId(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.examSessionNotSubmittedTitle}</DialogTitle>
            {notSubmittedDialogExamTitle ? (
              <DialogDescription className="text-foreground/90">
                {notSubmittedDialogExamTitle}
              </DialogDescription>
            ) : null}
          </DialogHeader>
          {notSubmittedDialogList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {enrolledStudentIds.size === 0
                ? t.examSessionNotSubmittedNoRoster
                : t.examSessionNotSubmittedAllSubmitted}
            </p>
          ) : (
            <ul className="max-h-[min(55vh,22rem)] overflow-y-auto rounded-lg border border-input divide-y divide-input">
              {notSubmittedDialogList.map((m) => (
                <li key={m.userId} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2.5 text-sm">
                  <span className="font-medium">{m.name}</span>
                  {m.birthDate ? (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {t.memberBirthDateLabel}: {formatBirthDisplay(m.birthDate)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

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

      <AttachExamToClassDialog
        open={attachExamTarget !== null}
        onOpenChange={(o) => {
          if (!o) setAttachExamTarget(null)
        }}
        sourceSessionId={attachExamTarget?.sessionId ?? ''}
        excludeClassId={cls.id}
        examTitle={attachExamTarget?.title}
        tc={t}
        onSuccess={() => router.refresh()}
      />

      <Dialog
        open={editMemberTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditMemberTarget(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.teacherEditStudentNameTitle}</DialogTitle>
            <DialogDescription>{t.teacherEditStudentNameHint}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="lop-edit-member-name">{t.joinStudentDisplayName}</Label>
            <Input
              id="lop-edit-member-name"
              value={editMemberNameInput}
              onChange={(e) => setEditMemberNameInput(e.target.value)}
              maxLength={120}
              autoComplete="name"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditMemberTarget(null)}
              disabled={savingMemberName}
            >
              {t.cancelAction}
            </Button>
            <Button
              type="button"
              disabled={savingMemberName}
              onClick={async () => {
                const trimmed = editMemberNameInput.replace(/\s+/g, ' ').trim()
                if (trimmed.length < 2) {
                  toast({ variant: 'destructive', description: t.joinNameTooShort })
                  return
                }
                if (trimmed.length > 120) {
                  toast({ variant: 'destructive', description: t.teacherEditStudentNameTooLong })
                  return
                }
                if (!editMemberTarget) return
                setSavingMemberName(true)
                const res = await updateStudentDisplayNameInClass(cls.id, editMemberTarget.userId, trimmed)
                setSavingMemberName(false)
                if ('error' in res && res.error) {
                  toast({ variant: 'destructive', description: res.error })
                  return
                }
                const uid = editMemberTarget.userId
                setMembersList((prev) =>
                  prev.map((x) => (x.userId === uid ? { ...x, name: trimmed } : x))
                )
                setEditMemberTarget(null)
                toast({ description: t.teacherEditStudentNameSuccess })
                router.refresh()
              }}
            >
              {savingMemberName ? '…' : t.saveClassName}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={gradeEssayOpen}
        onOpenChange={(open) => {
          setGradeEssayOpen(open)
          if (!open) {
            setGradeEssayTarget(null)
            setGradeEssayDetail(null)
            setEssayAiRationale('')
            setEssayPointsInput('')
          }
        }}
      >
        <DialogContent className="flex h-[min(95dvh,1000px)] max-h-[95dvh] w-[calc(100vw-0.5rem)] max-w-[min(100vw-0.5rem,96rem)] flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100vw-1rem)]">
          {gradeEssayLoading ? (
            <div className="flex flex-1 items-center px-3 py-4 sm:px-5">
              <p className="text-sm text-muted-foreground">{t.examGradeEssayLoadingDetail}</p>
            </div>
          ) : gradeEssayDetail ? (
            <>
              {/* Hai cột: trái = meta + chấm điểm (mỏng), phải = đề/ảnh (tối đa không gian) */}
              <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[min(17.5rem,30vw)_1fr]">
                <aside className="flex max-h-[min(26dvh,200px)] min-h-0 shrink-0 flex-col gap-1 overflow-y-auto overscroll-contain border-b border-border bg-muted/20 px-2 py-1 pr-10 text-left md:max-h-none md:gap-1.5 md:border-b-0 md:border-r md:py-1.5 md:pr-2">
                  <DialogHeader className="space-y-0.5 p-0 text-left">
                    <DialogTitle className="text-sm font-semibold leading-tight sm:text-base">
                      {t.examGradeEssayDialogTitle}
                    </DialogTitle>
                    <DialogDescription className="text-[11px] leading-snug text-muted-foreground">
                      {gradeEssayTarget
                        ? `${gradeEssayTarget.studentName} · ${gradeEssayTarget.examTitle}`
                        : '\u00a0'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-1 rounded border border-border/50 bg-background/70 px-1.5 py-1 text-[10px] leading-tight text-muted-foreground sm:text-[11px]">
                    <p className="flex items-start gap-1">
                      <Sparkles
                        className="mt-0.5 h-3 w-3 shrink-0 text-amber-600/80 dark:text-amber-400/90"
                        aria-hidden
                      />
                      <span>{t.examGradeEssayAiNote}</span>
                    </p>
                    {attemptEssaySubmissionHasImages(gradeEssayDetail.attempt.essaySubmission ?? {}) ? (
                      <p className="flex items-start gap-1 border-t border-border/40 pt-1 text-[10px] leading-tight text-amber-900 dark:text-amber-100 sm:text-[11px]">
                        <Images className="mt-0.5 h-3 w-3 shrink-0 opacity-80" aria-hidden />
                        <span>
                          {essayGradeDialogImageExpireIso
                            ? fillExamTeacherSummaryTemplate(t.examGradeEssayImageRetentionTeacher, {
                                days: String(EXAM_ESSAY_IMAGE_RETENTION_DAYS),
                                expiresAt: formatExamEssayImageExpireAtForUi(essayGradeDialogImageExpireIso),
                              })
                            : fillExamTeacherSummaryTemplate(t.examGradeEssayImageRetentionTeacherFallback, {
                                days: String(EXAM_ESSAY_IMAGE_RETENTION_DAYS),
                              })}
                        </span>
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-1 border-t border-border/60 pt-1.5">
                    <Label htmlFor="essay-points-input" className="text-[11px] font-medium leading-none">
                      {t.examGradeEssayPointsLabel}
                    </Label>
                    <p className="text-[10px] leading-tight text-muted-foreground">
                      {fillExamTeacherSummaryTemplate(t.examGradeEssayPointsMaxHint, {
                        max: gradeEssayTarget?.gradingMeta?.essayPointsMax ?? 0,
                      })}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Input
                        id="essay-points-input"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        max={gradeEssayTarget?.gradingMeta?.essayPointsMax}
                        value={essayPointsInput}
                        onChange={(e) => setEssayPointsInput(e.target.value)}
                        className="h-8 max-w-[6.5rem] px-2 text-sm font-semibold tabular-nums"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0 gap-1 px-2 text-xs"
                        disabled={essayAiLoading || bulkEssayAiSessionId !== null}
                    onClick={() => void runEssayAiSuggest()}
                      >
                        <Sparkles className="h-3 w-3 opacity-70" aria-hidden />
                        {essayAiLoading ? t.examGradeEssayAiRunning : t.examGradeEssayAiSuggest}
                      </Button>
                    </div>
                    {essayAiRationale ? (
                      <div className="max-h-[min(18dvh,140px)] overflow-y-auto overscroll-contain whitespace-pre-wrap rounded border border-border/60 bg-background/80 p-1.5 text-[10px] leading-snug text-muted-foreground sm:max-h-[min(22dvh,160px)] sm:text-[11px] sm:leading-snug">
                        <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-foreground sm:text-[11px]">
                          <Sparkles className="h-3 w-3 text-amber-600/90 dark:text-amber-400" aria-hidden />
                          {t.examGradeEssayAiRationaleHeading}
                        </p>
                        {essayAiRationale}
                      </div>
                    ) : null}
                  </div>
                </aside>

                <div className="min-h-0 min-w-0 overflow-y-auto overscroll-contain bg-muted/15 px-2 py-2 sm:px-4 sm:py-3">
                <div className="flex w-full max-w-none flex-col gap-5 sm:gap-7">
                  {gradeEssayDetail.questions
                    .filter((q) => q.isEssay)
                    .sort((a, b) => a.index - b.index)
                    .map((q) => {
                      const sub = gradeEssayDetail.attempt.essaySubmission[q.id] ?? {}
                      const txt = typeof sub.text === 'string' ? sub.text.trim() : ''
                      const imgs = Array.isArray(sub.imageUrls)
                        ? sub.imageUrls.filter(
                            (u): u is string => typeof u === 'string' && u.trim().length > 0
                          )
                        : []
                      const stemReadable = latexToReadable(q.questionText)
                      const stemIsTable = /[┌┐└┘│├┤┬┴┼─]/.test(stemReadable)
                      return (
                        <section
                          key={q.id}
                          className="scroll-mt-4 w-full min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-md ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
                        >
                          <div className="border-b border-border/80 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-3 py-2.5 sm:px-4 sm:py-3">
                            <h3 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
                              {fillExamTeacherSummaryTemplate(t.examGradeEssayQuestionLabel, { index: q.index })}
                            </h3>
                          </div>
                          <div className="space-y-4 p-3 sm:space-y-5 sm:p-4">
                            <div className="flex gap-3 rounded-xl border border-dashed border-primary/20 bg-muted/30 p-3 sm:gap-3.5 sm:p-4">
                              <FileText
                                className="mt-1 h-5 w-5 shrink-0 text-primary/75 sm:h-5 sm:w-5"
                                aria-hidden
                              />
                              <div
                                className={cn(
                                  'min-w-0 flex-1 text-[15px] leading-relaxed text-foreground sm:text-base sm:leading-relaxed',
                                  stemIsTable &&
                                    'whitespace-pre-wrap font-sans text-sm leading-snug sm:text-[15px] sm:leading-snug'
                                )}
                              >
                                {stemReadable}
                              </div>
                            </div>
                            <div className="min-w-0 space-y-2">
                              <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground sm:text-sm">
                                <PenLine className="h-4 w-4 shrink-0 text-primary/70" aria-hidden />
                                {t.examGradeEssayStudentText}
                              </p>
                              <p className="min-h-[2.5rem] w-full min-w-0 whitespace-pre-wrap break-words rounded-xl border border-border/60 bg-background p-3 text-[15px] leading-relaxed shadow-inner sm:p-3.5 sm:text-base">
                                {txt || t.examGradeEssayNoText}
                              </p>
                            </div>
                            {imgs.length > 0 ? (
                              <div className="space-y-3">
                                <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground sm:text-sm">
                                  <Images className="h-4 w-4 shrink-0 text-primary/75" aria-hidden />
                                  {t.examGradeEssayStudentImages}
                                </p>
                                <div className="flex flex-col gap-3 sm:gap-4">
                                  {imgs.map((url) => (
                                    <a
                                      key={url}
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title={t.examGradeEssayImageOpenHint}
                                      className="group block overflow-hidden rounded-xl border-2 border-border bg-muted/30 shadow-sm ring-offset-background transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={url.trim()}
                                        alt=""
                                        className="mx-auto h-auto w-full max-h-[min(52dvh,560px)] object-contain object-top transition-transform duration-200 group-hover:scale-[1.01] md:max-h-[min(58dvh,640px)]"
                                      />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </section>
                      )
                    })}
                </div>
                </div>
              </div>
            </>
          ) : gradeEssayOpen && !gradeEssayLoading ? (
            <div className="flex flex-1 items-center px-3 py-4 sm:px-5">
              <p className="text-sm text-muted-foreground">{t.examGradeEssayLoadFailed}</p>
            </div>
          ) : null}

          <DialogFooter className="shrink-0 gap-2 border-t border-border px-3 py-2 sm:gap-0 sm:px-4 sm:py-2">
            <Button type="button" variant="outline" onClick={() => setGradeEssayOpen(false)}>
              {t.cancelAction}
            </Button>
            <Button
              type="button"
              disabled={savingEssayGrade || gradeEssayLoading || !gradeEssayDetail}
              onClick={() => void saveEssayGrade()}
            >
              {savingEssayGrade ? '…' : t.examGradeEssaySave}
            </Button>
          </DialogFooter>
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
