import { BrowserBackTextButton } from '@/components/navigation/browser-back-control'
import { redirect } from 'next/navigation'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import { getServerDictionary } from '@/lib/i18n/server'
import { loadStudentSubjectInbox } from '@/lib/lop/class-subject-item-opens'
import type { ClassDetailPayload } from '@/lib/lop/load-class-detail-payload'
import LopDetailClient from './lop-detail-client'

export type LopDetailPageMode =
  | 'hub'
  | 'exams-index'
  | 'exam-session'
  | 'roster'
  | 'gradebook'
  | 'student-worksheets'

export function classSubjectScopeFromSearch(sp: { subject?: string; teacher?: string } | undefined) {
  const subjectId = String(sp?.subject ?? '').trim().slice(0, 40)
  const teacherId = String(sp?.teacher ?? '').trim()
  if (!subjectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teacherId)) {
    return null
  }
  return { subjectId, teacherId }
}

export async function LopClassDetailView({
  payload,
  currentHref,
  pageMode,
  focusSessionId,
  focusSubject = null,
}: {
  payload: ClassDetailPayload
  currentHref: string
  pageMode: LopDetailPageMode
  focusSessionId?: string
  focusSubject?: { subjectId: string; teacherId: string } | null
}) {
  const { locale, t } = getServerDictionary()
  const {
    cls,
    isTeacher,
    isOwner,
    viewerUserId,
    viewerTeacherPublicName,
    viewerTeacherGivenName,
    viewerTeacherGender,
    classSubjects,
    members,
    initialExamAttempts,
    initialExamSessions,
    schoolName,
    subjectNames,
  } = payload

  if (isTeacher && focusSubject && focusSubject.teacherId !== viewerUserId) {
    redirect(`/lop/${cls.id}`)
  }

  const subjectInbox =
    !isTeacher &&
    focusSubject &&
    (pageMode === 'hub' || pageMode === 'exams-index' || pageMode === 'student-worksheets')
      ? await loadStudentSubjectInbox({
          userId: viewerUserId,
          classId: cls.id,
          teacherId: focusSubject.teacherId,
          subjectId: focusSubject.subjectId,
        })
      : null

  return (
    <div className="app-shell min-h-screen">
      <CreationToolPageShell currentHref={currentHref}>
        <div className="mx-auto w-full max-w-2xl pb-8 lg:max-w-3xl lg:pb-10">
          {pageMode === 'hub' && isTeacher && !focusSubject ? (
            <BrowserBackTextButton
              fallbackHref="/lop"
              className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              ← {t.creationSidebar.back}
            </BrowserBackTextButton>
          ) : null}
          <LopDetailClient
            cls={{
              id: cls.id,
              name: cls.name,
              join_code: cls.join_code,
              gradeLevelId: cls.grade_level_id,
              schoolName,
              subjectNames,
              subjectLabel: cls.subject_label,
              teacherDisplayName: cls.teacher_display_name,
            }}
            isTeacher={isTeacher}
            isOwner={isOwner}
            viewerUserId={viewerUserId}
            viewerTeacherPublicName={viewerTeacherPublicName}
            viewerTeacherGivenName={viewerTeacherGivenName}
            viewerTeacherGender={viewerTeacherGender}
            classSubjects={classSubjects}
            members={members}
            initialExamAttempts={initialExamAttempts}
            initialExamSessions={initialExamSessions}
            pageMode={pageMode}
            focusSessionId={focusSessionId}
            showClassHomeLink={pageMode !== 'hub'}
            focusSubject={focusSubject}
            subjectInbox={subjectInbox}
            webLocale={locale}
            t={t.classes}
          />
        </div>
      </CreationToolPageShell>
    </div>
  )
}
