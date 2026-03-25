'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { WebLocale } from '@/lib/i18n/config'
import { formatSessionIsoDateTime } from '@/lib/datetime/format-session-iso-local'
import { fillI18nTemplate } from '@/lib/i18n/fill-template'
import { AttachExamToClassDialog } from '@/components/exam/attach-exam-to-class-dialog'
import { BookOpen, Copy, ExternalLink, Link2, RefreshCw, Trash2 } from 'lucide-react'

export type ClassHomeworkSession = {
  id: string
  code: string
  title: string
  status: string
  createdAt: string
}

export default function GanPhieuClient({
  classId,
  sessions,
  webLocale,
  t,
  examUi,
  /** Chỉ chủ lớp — học sinh không được hiện nút xóa (server cũng phải chặn truy cập trang). */
  canDeleteHomework,
}: {
  classId: string
  sessions: ClassHomeworkSession[]
  webLocale: WebLocale
  t: Dictionary['classes']
  examUi: Dictionary['createExamPage']
  canDeleteHomework: boolean
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [attachOpen, setAttachOpen] = useState(false)
  const [attachSessionId, setAttachSessionId] = useState<string | null>(null)
  const [attachSessionTitle, setAttachSessionTitle] = useState<string>('')
  const [homeworkDeletingCode, setHomeworkDeletingCode] = useState<string | null>(null)

  const openAttachDialog = (session: ClassHomeworkSession) => {
    setAttachSessionId(session.id)
    setAttachSessionTitle(session.title || examUi.examTitle)
    setAttachOpen(true)
  }

  const handleAttachDialogOpenChange = (open: boolean) => {
    setAttachOpen(open)
    if (!open) {
      setAttachSessionId(null)
      setAttachSessionTitle('')
    }
  }

  const buildReviewUrl = (code: string) =>
    `/giao-trinh/giao-vien/de-thi/${encodeURIComponent(code)}?t=${Date.now()}`

  const studentUrl = (code: string) => {
    if (typeof window === 'undefined') return `/lam-bai/${encodeURIComponent(code)}`
    return `${window.location.origin}/lam-bai/${encodeURIComponent(code)}`
  }

  const copyStudentLink = async (code: string) => {
    const url = studentUrl(code)
    try {
      await navigator.clipboard.writeText(url)
      toast({ description: t.copied })
    } catch {
      toast({ variant: 'destructive', description: examUi.error })
    }
  }

  const handleDeleteHomework = async (code: string) => {
    const ok =
      typeof window !== 'undefined' ? window.confirm(examUi.homeworkDeleteConfirm) : true
    if (!ok) return
    setHomeworkDeletingCode(code)
    try {
      const res = await fetch('/api/exam-session/mine', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          title: examUi.error,
          description: String(data?.error ?? res.statusText),
          variant: 'destructive',
        })
        return
      }
      toast({
        title: examUi.homeworkDeleted,
        description: examUi.homeworkDeletedDesc,
      })
      router.refresh()
    } catch (e) {
      toast({
        title: examUi.error,
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      })
    } finally {
      setHomeworkDeletingCode(null)
    }
  }

  if (sessions.length === 0) {
    return (
      <>
        <Toaster />
        <p className="text-sm text-muted-foreground">{t.classHomeworkListEmpty}</p>
        <Button type="button" variant="secondary" className="mt-4" asChild>
          <Link href="/tao-bai-tap-ve-nha">{t.classHomeworkListCreateCta}</Link>
        </Button>
      </>
    )
  }

  return (
    <>
      <Toaster />
      <AttachExamToClassDialog
        open={attachOpen && Boolean(attachSessionId)}
        onOpenChange={handleAttachDialogOpenChange}
        sourceSessionId={attachSessionId ?? ''}
        excludeClassId={classId}
        examTitle={attachSessionTitle}
        tc={t}
        copyOverrides={{
          pickTitle: t.classHomeworkAttachPickTitle,
          pickDescription: t.classHomeworkAttachPickDescription,
          sessionLabel: t.classHomeworkAttachSessionLabel,
        }}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/tao-bai-tap-ve-nha">{t.classHomeworkListCreateCta}</Link>
        </Button>
      </div>
      <ul className="space-y-3">
        {sessions.map((s) => {
          const closed = String(s.status).toLowerCase() === 'closed'
          const lamPath = `/lam-bai/${encodeURIComponent(s.code)}`
          const createdLine = (() => {
            const time = formatSessionIsoDateTime(s.createdAt, webLocale)
            if (!time) return null
            return fillI18nTemplate(t.examSessionCreatedAt, { time })
          })()
          return (
            <li
              key={s.id}
              className="rounded-lg border border-input bg-card px-4 py-3 space-y-2"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{s.title || examUi.examTitle}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {examUi.examCode}: <span className="font-mono font-medium text-foreground">{s.code}</span>
                    {closed ? (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                        {t.studentClassExamBadgeClosed}
                      </span>
                    ) : null}
                  </p>
                  {createdLine ? (
                    <p className="text-xs text-muted-foreground mt-0.5">{createdLine}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" variant="secondary" size="sm" className="gap-1.5" asChild>
                  <Link href={lamPath} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    {t.classHomeworkOpenLamBai}
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => void copyStudentLink(s.code)}
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                  {examUi.copyLink}
                </Button>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
                  <Link href={buildReviewUrl(s.code)} target="_blank" rel="noopener noreferrer">
                    <BookOpen className="h-3.5 w-3.5" aria-hidden />
                    {examUi.reviewSlides}
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => openAttachDialog(s)}
                >
                  <Link2 className="h-3.5 w-3.5" aria-hidden />
                  {t.classHomeworkAttachOtherClassButton}
                </Button>
                {canDeleteHomework ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => void handleDeleteHomework(s.code)}
                    disabled={homeworkDeletingCode === s.code}
                  >
                    {homeworkDeletingCode === s.code ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {examUi.delete}
                  </Button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
