import { BrowserBackTextButton } from '@/components/navigation/browser-back-control'
import { ChevronRight } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import { GAN_PHIEU_RELATED } from '@/lib/creation-tool-sidebar-config'
import { StudentSubjectScoreList } from '@/components/lop/student-subject-score-list'
import { listSubjectItemOpenedAt } from '@/lib/lop/class-subject-item-opens'
import { loadClassReviewAccess } from '@/lib/lop/class-review-access'
import { listStudentSubjectScoresPg } from '@/lib/lop/student-subject-scores'
import { classSubjectScopeFromSearch } from '../lop-class-detail-view'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<ReturnType<typeof buildMetadata>> {
  const { id } = await params
  const { t } = getServerDictionary()
  return buildMetadata({
    title: t.classes.studentMyScoresTitle,
    description: t.classes.studentMyScoresLead,
    path: `/lop/${id}/diem`,
    keywords: [t.classes.title, t.classes.studentMyScoresTitle],
  })
}

function formatScore10(score: number): string {
  const rounded = Math.round(score * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

export default async function StudentSubjectScoresPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ subject?: string; teacher?: string }>
}) {
  const { id: classId } = await params
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()
  const focus = classSubjectScopeFromSearch(await searchParams)
  if (!focus) redirect(`/lop/${classId}`)
  const access = await loadClassReviewAccess(classId, user.id, focus.subjectId, focus.teacherId)
  if (!access) notFound()
  if (access.payload.isTeacher) {
    redirect(
      `/lop/${classId}/ket-qua?subject=${encodeURIComponent(focus.subjectId)}&teacher=${encodeURIComponent(focus.teacherId)}`
    )
  }

  const [rows, openedAtByKey] = await Promise.all([
    listStudentSubjectScoresPg({
      classId,
      teacherId: focus.teacherId,
      subjectId: focus.subjectId,
      studentUserId: user.id,
    }),
    listSubjectItemOpenedAt(user.id, classId),
  ])
  const { t } = getServerDictionary()
  const backHref = `/lop/${classId}?subject=${encodeURIComponent(focus.subjectId)}&teacher=${encodeURIComponent(focus.teacherId)}`
  const list = rows ?? []

  return (
    <div className="app-shell min-h-screen">
      <CreationToolPageShell currentHref={`/lop/${classId}/diem`} relatedLinks={GAN_PHIEU_RELATED}>
        <div className="mx-auto max-w-2xl px-4 py-8">
          <BrowserBackTextButton
            fallbackHref={backHref}
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4 shrink-0 rotate-180" aria-hidden />
            {t.classes.classSubjectBack}
          </BrowserBackTextButton>
          <h1 className="mb-2 text-xl font-bold text-foreground">{t.classes.studentMyScoresTitle}</h1>
          <p className="mb-1 text-sm text-muted-foreground">{access.payload.cls.name}</p>
          <p className="mb-6 text-sm text-muted-foreground">{t.classes.studentMyScoresLead}</p>
          {list.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              {t.classes.studentMyScoresEmpty}
            </p>
          ) : (
            <StudentSubjectScoreList
              classId={classId}
              subjectId={focus.subjectId}
              teacherId={focus.teacherId}
              newLabel={t.classes.subjectItemNew}
              openedAtByKey={openedAtByKey}
              rows={list.map((row) => ({
                id: row.id,
                title: row.title,
                kindLabel: row.homework ? t.classes.studentMyScoresHomework : t.classes.studentMyScoresExam,
                status: row.homework
                  ? row.submitted
                    ? t.classes.studentMyScoresSubmitted
                    : t.classes.studentMyScoresNotSubmitted
                  : row.score10 == null
                    ? t.classes.studentMyScoresNotSubmitted
                    : t.classes.studentMyScoresPoints.replace('{score}', formatScore10(row.score10)),
                createdAt: row.createdAt,
                submittedAt: row.submittedAt,
              }))}
            />
          )}
        </div>
      </CreationToolPageShell>
    </div>
  )
}
