import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import { loadClassDetailPayload } from '@/lib/lop/load-class-detail-payload'
import { LopClassDetailView } from '../lop-class-detail-view'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<ReturnType<typeof buildMetadata>> {
  const { id } = await params
  const { t } = getServerDictionary()
  const supabase = createClient()
  const { data } = await supabase.from('classes').select('name').eq('id', id).single()
  return buildMetadata({
    title: data?.name ? `${data.name} — ${t.classes.assignWorksheet}` : t.classes.assignWorksheet,
    description: t.classes.classHubCardStudentWorksheetsDesc,
    path: `/lop/${id}/phieu-bai-tap`,
    keywords: [t.classes.title, t.classes.assignWorksheet],
  })
}

export default async function LopPhieuBaiTapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirectToLogin()

  const payload = await loadClassDetailPayload(supabase, id, user.id)
  if (!payload) notFound()

  const isMember = payload.members.some((m) => m.userId === user.id)
  if (!isMember) notFound()

  if (payload.isTeacher) {
    redirect(`/lop/${id}/gan-phieu`)
  }

  return (
    <LopClassDetailView
      payload={payload}
      currentHref={`/lop/${id}/phieu-bai-tap`}
      pageMode="student-worksheets"
    />
  )
}
