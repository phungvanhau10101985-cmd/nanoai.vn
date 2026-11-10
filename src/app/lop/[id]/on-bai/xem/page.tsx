import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import { fetchReviewSlidesJsonPg, lessonIsTaughtInClassPg } from '@/lib/db/class-taught-lessons-pg'
import { loadClassReviewAccess } from '@/lib/lop/class-review-access'
import { reviewMarkdownFromSlides, reviewSlidesFromStoredJson } from '@/lib/lop/review-lesson-slides'
import { markSubjectItemOpenedForUser } from '@/lib/lop/class-subject-item-opens'
import { reviewLessonItemId } from '@/lib/lop/subject-item-open'
import { classSubjectScopeFromSearch } from '../../lop-class-detail-view'
import { ReviewSlideClient } from '../review-slide-client'

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
    path: `/lop/${id}/on-bai/xem`,
    keywords: [t.classes.title, t.classes.classReviewTitle],
  })
}

export default async function ClassReviewSlidePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ subject?: string; teacher?: string; curriculum?: string; lesson?: string }>
}) {
  const { id: classId } = await params
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()
  const sp = await searchParams
  const focus = classSubjectScopeFromSearch(sp)
  const curriculumId = String(sp.curriculum ?? '').trim()
  const lessonNo = Math.floor(Number(sp.lesson))
  if (!focus || !curriculumId || lessonNo < 1) redirect(`/lop/${classId}`)
  const access = await loadClassReviewAccess(classId, user.id, focus.subjectId, focus.teacherId)
  if (!access) notFound()
  const taught = await lessonIsTaughtInClassPg({
    classId,
    teacherId: focus.teacherId,
    subjectId: focus.subjectId,
    curriculumId,
    lessonNo,
  })
  if (!taught) notFound()
  if (!access.payload.isTeacher) {
    await markSubjectItemOpenedForUser(user.id, {
      classId,
      subjectId: focus.subjectId,
      teacherId: focus.teacherId,
      kind: 'review',
      itemId: reviewLessonItemId(curriculumId, lessonNo),
    }).catch((error) => {
      console.error('[on-bai/xem] mark opened', error)
    })
  }

  const stored = await fetchReviewSlidesJsonPg(curriculumId, lessonNo)
  const slides = reviewSlidesFromStoredJson(stored.slidesJson)
  const { t, locale } = getServerDictionary()
  const listHref = `/lop/${classId}/on-bai?subject=${encodeURIComponent(focus.subjectId)}&teacher=${encodeURIComponent(focus.teacherId)}`
  const topic = stored.lessonTitle || stored.topic || t.classes.classReviewLesson.replace('{n}', String(lessonNo))

  if (slides.length === 0) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md space-y-3 text-center">
          <p className="text-sm text-muted-foreground">{t.classes.classReviewNoSlides}</p>
          <Link href={listHref} className="inline-flex text-sm font-medium text-foreground underline">
            {t.classes.classReviewTitle}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <ReviewSlideClient
      slides={slides}
      markdown={reviewMarkdownFromSlides(slides)}
      topic={topic}
      backHref={listHref}
      locale={locale}
    />
  )
}
