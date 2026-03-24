import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import { loadClassDetailPayload } from '@/lib/lop/load-class-detail-payload'
import { LopClassDetailView } from '../../lop-class-detail-view'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>
}): Promise<ReturnType<typeof buildMetadata>> {
  const { id, sessionId } = await params
  const { t } = getServerDictionary()
  const supabase = createClient()
  const { data } = await supabase.from('classes').select('name').eq('id', id).single()
  return buildMetadata({
    title: data?.name ? `${data.name} — ${t.classes.classExamSessionPageTitle}` : t.classes.classExamSessionPageTitle,
    description: t.classes.classHubCardExamsDesc,
    path: `/lop/${id}/bai-thi/${sessionId}`,
    keywords: [t.classes.title, t.classes.classExamSessionPageTitle],
  })
}

export default async function LopBaiThiSessionPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>
}) {
  const { id, sessionId } = await params
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirectToLogin()

  const payload = await loadClassDetailPayload(supabase, id, user.id)
  if (!payload) notFound()

  if (!payload.isTeacher) {
    redirect(`/lop/${id}/bai-thi`)
  }

  const sessionOk = payload.initialExamSessions.some((s) => s.id === sessionId)
  if (!sessionOk) notFound()

  return (
    <LopClassDetailView
      payload={payload}
      currentHref={`/lop/${id}/bai-thi/${sessionId}`}
      pageMode="exam-session"
      focusSessionId={sessionId}
    />
  )
}
