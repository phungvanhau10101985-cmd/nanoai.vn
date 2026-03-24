import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import { getServerDictionary } from '@/lib/i18n/server'
import type { ClassDetailPayload } from '@/lib/lop/load-class-detail-payload'
import LopDetailClient from './lop-detail-client'

export type LopDetailPageMode = 'hub' | 'exams-index' | 'exam-session' | 'roster' | 'gradebook' | 'worksheets'

export function LopClassDetailView({
  payload,
  currentHref,
  pageMode,
  focusSessionId,
}: {
  payload: ClassDetailPayload
  currentHref: string
  pageMode: LopDetailPageMode
  focusSessionId?: string
}) {
  const { t } = getServerDictionary()
  const { cls, isTeacher, members, initialSubmissions, initialExamAttempts, initialExamSessions, schoolName, subjectNames } =
    payload

  return (
    <div className="app-shell min-h-screen">
      <CreationToolPageShell currentHref={currentHref}>
        <div className="mx-auto w-full max-w-2xl pb-8 lg:max-w-3xl lg:pb-10">
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
            members={members}
            initialSubmissions={initialSubmissions}
            initialExamAttempts={initialExamAttempts}
            initialExamSessions={initialExamSessions}
            pageMode={pageMode}
            focusSessionId={focusSessionId}
            showClassHomeLink={pageMode !== 'hub'}
            t={t.classes}
          />
        </div>
      </CreationToolPageShell>
    </div>
  )
}
