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
    title: data?.name ? `${data.name} — ${t.classes.worksheetSubmissionsSection}` : t.classes.worksheetSubmissionsSection,
    description: t.classes.classHubCardWorksheetsDesc,
    path: `/lop/${id}/nop-phieu`,
    keywords: [t.classes.title, t.classes.worksheetSubmissionsSection],
  })
}

export default async function LopNopPhieuPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirectToLogin()

  const payload = await loadClassDetailPayload(supabase, id, user.id)
  if (!payload) notFound()

  if (!payload.isTeacher) {
    redirect(`/lop/${id}`)
  }

  return <LopClassDetailView payload={payload} currentHref={`/lop/${id}/nop-phieu`} pageMode="worksheets" />
}
