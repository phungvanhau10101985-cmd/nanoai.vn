import { BrowserBackTextButton } from '@/components/navigation/browser-back-control'
import { ChevronRight } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import {
  fetchClassGateForGanPhieuPg,
  fetchHomeworkExamSessionsForGanPhieuPg,
  teacherCanTeachInClassPg,
} from '@/lib/db/classes-pg'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import { GAN_PHIEU_RELATED } from '@/lib/creation-tool-sidebar-config'
import { classSubjectScopeFromSearch } from '../lop-class-detail-view'
import GanPhieuClient, { type ClassHomeworkSession } from './gan-phieu-client'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<ReturnType<typeof buildMetadata>> {
  const { id } = await params
  const { t } = getServerDictionary()
  return buildMetadata({
    title: t.classes.assignWorksheet,
    description: t.classes.classHubCardAssignWorksheetDesc,
    path: `/lop/${id}/gan-phieu`,
    keywords: [t.classes.title, t.classes.assignWorksheet],
  })
}

export default async function GanPhieuPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ subject?: string; teacher?: string }>
}) {
  const { id: classId } = await params
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()

  const cls = await fetchClassGateForGanPhieuPg(classId)
  const canTeach = cls ? await teacherCanTeachInClassPg(classId, user.id) : false
  if (!cls || canTeach !== true) notFound()

  const focusSubject = classSubjectScopeFromSearch(await searchParams)
  if (focusSubject && focusSubject.teacherId !== user.id) {
    redirect(`/lop/${classId}`)
  }
  const sessionRows = await fetchHomeworkExamSessionsForGanPhieuPg(classId, user.id)
  if (sessionRows === null) notFound()

  const sessions: ClassHomeworkSession[] = sessionRows
    .filter(
      (r) =>
        !focusSubject ||
        (r.subject_id === focusSubject.subjectId && r.teacher_id === focusSubject.teacherId)
    )
    .map((r) => ({
      id: r.id,
      code: String(r.code ?? '').toUpperCase(),
      title: String(r.title ?? '').trim(),
      status: String(r.status ?? 'active'),
      createdAt: r.created_at,
    }))
  const backHref = focusSubject
    ? `/lop/${classId}?subject=${encodeURIComponent(focusSubject.subjectId)}&teacher=${encodeURIComponent(focusSubject.teacherId)}`
    : `/lop/${classId}`

  const { locale, t } = getServerDictionary()

  return (
    <div className="app-shell min-h-screen">
      <CreationToolPageShell
        currentHref={`/lop/${classId}/gan-phieu`}
        relatedLinks={GAN_PHIEU_RELATED}
      >
        <div className="mx-auto max-w-2xl px-4 py-8">
          <BrowserBackTextButton
            fallbackHref={backHref}
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4 shrink-0 rotate-180" aria-hidden />
            {focusSubject ? t.classes.classSubjectBack : t.classes.classPageBackToClass}
          </BrowserBackTextButton>
          <h1 className="text-xl font-bold text-foreground mb-2">{t.classes.assignWorksheet}</h1>
          <p className="text-sm text-muted-foreground mb-6">{cls.name}</p>
          <GanPhieuClient
            classId={classId}
            backHref={backHref}
            sessions={sessions}
            webLocale={locale}
            t={t.classes}
            examUi={t.createExamPage}
            canDeleteHomework
            subjectId={focusSubject?.subjectId ?? ''}
          />
        </div>
      </CreationToolPageShell>
    </div>
  )
}
