'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { AttachExamToClassDialog } from '@/components/exam/attach-exam-to-class-dialog'
import { BookOpen, Copy, ExternalLink, Link2 } from 'lucide-react'

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
  t,
  examUi,
}: {
  classId: string
  sessions: ClassHomeworkSession[]
  t: Dictionary['classes']
  examUi: Dictionary['createExamPage']
}) {
  const { toast } = useToast()
  const [attachOpen, setAttachOpen] = useState(false)
  const [attachSessionId, setAttachSessionId] = useState<string | null>(null)
  const [attachSessionTitle, setAttachSessionTitle] = useState<string>('')

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
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
