import { notFound, redirect } from 'next/navigation'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { fetchClassNameByIdPg } from '@/lib/db/classes-pg'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import { loadClassDetailPayload } from '@/lib/lop/load-class-detail-payload'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<ReturnType<typeof buildMetadata>> {
  const { id } = await params
  const { t } = getServerDictionary()
  const className = await fetchClassNameByIdPg(id)
  return buildMetadata({
    title: className ? `${className} — ${t.classes.title}` : t.classes.title,
    description: t.classes.classDetailSeoDescription,
    path: `/lop/${id}`,
    keywords: [t.classes.title],
  })
}

export default async function LopNopPhieuPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()

  const payload = await loadClassDetailPayload(id, user.id)
  if (!payload) notFound()

  redirect(`/lop/${id}`)
}
