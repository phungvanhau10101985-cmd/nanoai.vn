import { notFound } from 'next/navigation'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { fetchClassNameByIdPg } from '@/lib/db/classes-pg'
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
  const className = await fetchClassNameByIdPg(id)
  return buildMetadata({
    title: className ? `${className} — ${t.classes.students}` : t.classes.students,
    description: t.classes.classHubCardStudentsDesc,
    path: `/lop/${id}/hoc-sinh`,
    keywords: [t.classes.title, t.classes.students],
  })
}

export default async function LopHocSinhPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()

  const payload = await loadClassDetailPayload(id, user.id)
  if (!payload) notFound()

  return <LopClassDetailView payload={payload} currentHref={`/lop/${id}/hoc-sinh`} pageMode="roster" />
}
