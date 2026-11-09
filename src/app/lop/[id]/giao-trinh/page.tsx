import Link from 'next/link'
import { BrowserBackTextButton } from '@/components/navigation/browser-back-control'
import { ChevronRight } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import { GAN_PHIEU_RELATED } from '@/lib/creation-tool-sidebar-config'
import {
  listClassTeacherCurricula,
  listTeacherCurriculaNotInClass,
  syncTeacherSubjectCurriculaIntoClass,
  type ClassSavedCurriculumRow,
} from '@/lib/db/class-teacher-curricula-pg'
import { loadClassDetailPayload } from '@/lib/lop/load-class-detail-payload'
import { GRADE_LEVELS, SUBJECTS } from '@/app/tao-giao-trinh/lib/curriculum-subjects'
import { createFromClassHref } from '@/lib/lop/create-from-class-href'
import { classSubjectScopeFromSearch } from '../lop-class-detail-view'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<ReturnType<typeof buildMetadata>> {
  const { id } = await params
  const { t } = getServerDictionary()
  return buildMetadata({
    title: t.classes.classHubCardCurriculaTitle,
    description: t.classes.classHubCardCurriculaDesc,
    path: `/lop/${id}/giao-trinh`,
    keywords: [t.classes.title, t.classes.classHubCardCurriculaTitle],
  })
}

function openHref(classId: string, subjectId: string, curriculumId: string) {
  const q = new URLSearchParams()
  q.set('openCurriculum', curriculumId)
  q.set('classId', classId)
  if (subjectId) q.set('subject', subjectId)
  return `/giao-trinh?${q.toString()}`
}

function curriculumMeta(row: ClassSavedCurriculumRow, locale: string, lessonLabel: string) {
  const vi = locale === 'vi'
  const subject = SUBJECTS.find((s) => s.id === row.subjectId)
  const grade = GRADE_LEVELS.find((g) => g.id === row.gradeLevelId)
  const parts = [
    subject ? (vi ? subject.labelVi : subject.labelEn) : row.subjectId,
    grade ? (vi ? grade.labelVi : grade.labelEn) : row.gradeLevelId,
  ].filter(Boolean)
  if (row.lessonNumber != null && row.lessonNumber > 0) {
    parts.push(lessonLabel.replace('{n}', String(row.lessonNumber)))
  }
  return parts.join(' · ')
}

function CurriculumList({
  rows,
  classId,
  subjectId,
  openLabel,
  locale,
  lessonLabel,
}: {
  rows: ClassSavedCurriculumRow[]
  classId: string
  subjectId: string
  openLabel: string
  locale: string
  lessonLabel: string
}) {
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{row.topic}</p>
            <p className="truncate text-xs text-muted-foreground">{curriculumMeta(row, locale, lessonLabel)}</p>
          </div>
          <Link
            href={openHref(classId, subjectId, row.id)}
            className="shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/40"
          >
            {openLabel}
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default async function ClassCurriculaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ subject?: string; teacher?: string }>
}) {
  const { id: classId } = await params
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()

  const payload = await loadClassDetailPayload(classId, user.id)
  if (!payload?.isTeacher) notFound()

  const focusSubject = classSubjectScopeFromSearch(await searchParams)
  if (focusSubject && focusSubject.teacherId !== user.id) {
    redirect(`/lop/${classId}`)
  }
  const subjectId = focusSubject?.subjectId ?? ''
  const gradeLevelId = String(payload.cls.grade_level_id ?? '').trim()
  if (subjectId && gradeLevelId) {
    await syncTeacherSubjectCurriculaIntoClass({
      classId,
      teacherId: user.id,
      subjectId,
      gradeLevelId,
    })
  }
  const saved = await listClassTeacherCurricula({
    classId,
    teacherId: user.id,
    subjectId,
    gradeLevelId,
  })
  const others =
    saved.length === 0
      ? await listTeacherCurriculaNotInClass({
          classId,
          teacherId: user.id,
          subjectId,
          gradeLevelId,
        })
      : []

  const backHref = focusSubject
    ? `/lop/${classId}?subject=${encodeURIComponent(focusSubject.subjectId)}&teacher=${encodeURIComponent(focusSubject.teacherId)}`
    : `/lop/${classId}`
  const { locale, t } = getServerDictionary()

  return (
    <div className="app-shell min-h-screen">
      <CreationToolPageShell currentHref={`/lop/${classId}/giao-trinh`} relatedLinks={GAN_PHIEU_RELATED}>
        <div className="mx-auto max-w-2xl px-4 py-8">
          <BrowserBackTextButton
            fallbackHref={backHref}
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4 shrink-0 rotate-180" aria-hidden />
            {focusSubject ? t.classes.classSubjectBack : t.classes.classPageBackToClass}
          </BrowserBackTextButton>
          <h1 className="mb-2 text-xl font-bold text-foreground">{t.classes.classHubCardCurriculaTitle}</h1>
          <p className="mb-1 text-sm text-muted-foreground">{payload.cls.name}</p>
          <p className="mb-6 text-sm text-muted-foreground">{t.classes.classHubCardCurriculaDesc}</p>
          {saved.length > 0 ? (
            <CurriculumList
              rows={saved}
              classId={classId}
              subjectId={subjectId}
              openLabel={t.classes.classCurriculaOpen}
              locale={locale}
              lessonLabel={t.classes.classCurriculaLesson}
            />
          ) : others.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t.classes.classCurriculaOther}</p>
              <CurriculumList
                rows={others}
                classId={classId}
                subjectId={subjectId}
                openLabel={t.classes.classCurriculaOpen}
                locale={locale}
                lessonLabel={t.classes.classCurriculaLesson}
              />
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              {t.classes.classCurriculaEmpty}
            </p>
          )}
          <Link
            href={createFromClassHref('/giao-trinh', {
              classId,
              subjectId,
              gradeLevelId: payload.cls.grade_level_id,
            })}
            className="mt-4 inline-flex rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
          >
            {t.classes.classCurriculaCreate}
          </Link>
        </div>
      </CreationToolPageShell>
    </div>
  )
}
