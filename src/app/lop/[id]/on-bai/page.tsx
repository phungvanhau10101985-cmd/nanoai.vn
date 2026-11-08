import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import { GAN_PHIEU_RELATED } from '@/lib/creation-tool-sidebar-config'
import { listTaughtLessonsPg } from '@/lib/db/class-taught-lessons-pg'
import { loadClassReviewAccess } from '@/lib/lop/class-review-access'
import { classSubjectScopeFromSearch } from '../lop-class-detail-view'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<ReturnType<typeof buildMetadata>> {
  const { id } = await params
  const { t } = getServerDictionary()
  return buildMetadata({
    title: t.classes.classReviewTitle,
    description: t.classes.classReviewLead,
    path: `/lop/${id}/on-bai`,
    keywords: [t.classes.title, t.classes.classReviewTitle],
  })
}

export default async function ClassReviewLessonsPage({
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

  const lessons = await listTaughtLessonsPg({
    classId,
    teacherId: focus.teacherId,
    subjectId: focus.subjectId,
  })
  const { t } = getServerDictionary()
  const backHref = `/lop/${classId}?subject=${encodeURIComponent(focus.subjectId)}&teacher=${encodeURIComponent(focus.teacherId)}`

  return (
    <div className="app-shell min-h-screen">
      <CreationToolPageShell currentHref={`/lop/${classId}/on-bai`} relatedLinks={GAN_PHIEU_RELATED}>
        <div className="mx-auto max-w-2xl px-4 py-8">
          <Link
            href={backHref}
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4 shrink-0 rotate-180" aria-hidden />
            {t.classes.classSubjectBack}
          </Link>
          <h1 className="mb-2 text-xl font-bold text-foreground">{t.classes.classReviewTitle}</h1>
          <p className="mb-1 text-sm text-muted-foreground">{access.payload.cls.name}</p>
          <p className="mb-6 text-sm text-muted-foreground">{t.classes.classReviewLead}</p>
          {lessons.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              {t.classes.classReviewEmpty}
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {lessons.map((lesson) => {
                const href = `/lop/${classId}/on-bai/xem?subject=${encodeURIComponent(focus.subjectId)}&teacher=${encodeURIComponent(focus.teacherId)}&curriculum=${encodeURIComponent(lesson.curriculumId)}&lesson=${lesson.lessonNo}`
                const name = lesson.title || lesson.topic
                return (
                  <li key={`${lesson.curriculumId}:${lesson.lessonNo}`} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {t.classes.classReviewLesson.replace('{n}', String(lesson.lessonNo))}
                        {name ? ` · ${name}` : ''}
                      </p>
                    </div>
                    <Link
                      href={href}
                      className="shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/40"
                    >
                      {t.classes.classReviewOpen}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </CreationToolPageShell>
    </div>
  )
}
