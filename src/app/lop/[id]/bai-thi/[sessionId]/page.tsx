import { notFound, redirect } from 'next/navigation'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { fetchClassNameByIdPg } from '@/lib/db/classes-pg'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import { loadClassDetailPayload } from '@/lib/lop/load-class-detail-payload'
import { classSubjectScopeFromSearch, LopClassDetailView } from '../../lop-class-detail-view'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>
}): Promise<ReturnType<typeof buildMetadata>> {
  const { id, sessionId } = await params
  const { t } = getServerDictionary()
  const className = await fetchClassNameByIdPg(id)
  return buildMetadata({
    title: className ? `${className} — ${t.classes.classExamSessionPageTitle}` : t.classes.classExamSessionPageTitle,
    description: t.classes.classHubCardExamsDesc,
    path: `/lop/${id}/bai-thi/${sessionId}`,
    keywords: [t.classes.title, t.classes.classExamSessionPageTitle],
  })
}

export default async function LopBaiThiSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; sessionId: string }>
  searchParams: Promise<{ subject?: string; teacher?: string }>
}) {
  const { id, sessionId } = await params
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()

  const payload = await loadClassDetailPayload(id, user.id)
  if (!payload) notFound()

  if (!payload.isTeacher) {
    redirect(`/lop/${id}/bai-thi`)
  }

  const focusSubject = classSubjectScopeFromSearch(await searchParams)
  const sessionOk = payload.initialExamSessions.some((s) => {
    if (s.id !== sessionId) return false
    if (!focusSubject) return true
    return s.teacherId === focusSubject.teacherId && s.subjectId === focusSubject.subjectId
  })
  if (!sessionOk) notFound()

  return (
    <LopClassDetailView
      payload={payload}
      currentHref={`/lop/${id}/bai-thi/${sessionId}`}
      pageMode="exam-session"
      focusSessionId={sessionId}
      focusSubject={focusSubject}
    />
  )
}
