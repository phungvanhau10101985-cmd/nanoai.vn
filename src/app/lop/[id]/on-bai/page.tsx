import { BrowserBackTextButton } from '@/components/navigation/browser-back-control'
import { ChevronRight } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import { GAN_PHIEU_RELATED } from '@/lib/creation-tool-sidebar-config'
import { ReviewLessonRow } from '@/components/lop/review-lesson-open-link'
import { listTaughtLessonsPg } from '@/lib/db/class-taught-lessons-pg'
import { listSubjectItemOpenedAt } from '@/lib/lop/class-subject-item-opens'
import { loadClassReviewAccess } from '@/lib/lop/class-review-access'
import { isSubjectItemUnopened, reviewLessonItemId, subjectItemKey } from '@/lib/lop/subject-item-open'
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
  const openedAtByKey = access.payload.isTeacher ? {} : await listSubjectItemOpenedAt(user.id, classId)
  const { t } = getServerDictionary()
  const backHref = `/lop/${classId}?subject=${encodeURIComponent(focus.subjectId)}&teacher=${encodeURIComponent(focus.teacherId)}`

  return (
    <div className="app-shell min-h-screen">
      <CreationToolPageShell currentHref={`/lop/${classId}/on-bai`} relatedLinks={GAN_PHIEU_RELATED}>
        <div className="mx-auto max-w-2xl px-4 py-8">
          <BrowserBackTextButton
            fallbackHref={backHref}
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4 shrink-0 rotate-180" aria-hidden />
            {t.classes.classSubjectBack}
          </BrowserBackTextButton>
          <h1 className="mb-2 text-xl font-bold text-foreground">{t.classes.classReviewTitle}</h1>
          <p className="mb-1 text-sm text-muted-foreground">{access.payload.cls.name}</p>
          <p className="mb-6 text-sm text-muted-foreground">{t.classes.classReviewLead}</p>
          {lessons.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              {t.classes.classReviewEmpty}
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {lessons.map((lesson) => {
                const href = `/lop/${classId}/on-bai/xem?subject=${encodeURIComponent(focus.subjectId)}&teacher=${encodeURIComponent(focus.teacherId)}&curriculum=${encodeURIComponent(lesson.curriculumId)}&lesson=${lesson.lessonNo}`
                const name = lesson.title || lesson.topic
                const itemId = reviewLessonItemId(lesson.curriculumId, lesson.lessonNo)
                const unopened =
                  !access.payload.isTeacher &&
                  isSubjectItemUnopened(openedAtByKey[subjectItemKey('review', itemId)], lesson.taughtAt)
                return (
                  <ReviewLessonRow
                    key={itemId}
                    href={href}
                    title={`${t.classes.classReviewLesson.replace('{n}', String(lesson.lessonNo))}${name ? ` · ${name}` : ''}`}
                    openLabel={t.classes.classReviewOpen}
                    newLabel={t.classes.subjectItemNew}
                    unopened={unopened}
                    mark={
                      unopened
                        ? {
                            classId,
                            subjectId: focus.subjectId,
                            teacherId: focus.teacherId,
                            kind: 'review',
                            itemId,
                          }
                        : null
                    }
                  />
                )
              })}
            </ul>
          )}
        </div>
      </CreationToolPageShell>
    </div>
  )
}
