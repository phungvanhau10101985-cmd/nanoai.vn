import { notFound, redirect } from 'next/navigation'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getLopViewer } from '@/lib/lop/lop-viewer'
import { loadClassScoreboardPg } from '@/lib/db/answer-card-pg'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import { ClassScoreboardSheet } from '@/components/lop/class-scoreboard'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>
}): Promise<ReturnType<typeof buildMetadata>> {
  const { id, sessionId } = await params
  const { t } = getServerDictionary()
  return buildMetadata({
    title: t.classes.answerCardsExamSummary,
    description: t.classes.answerCardsScoreboardLead,
    path: `/lop/${id}/bang-diem/${sessionId}`,
    keywords: [t.classes.title, t.classes.answerCardsExamSummary],
  })
}

export default async function ClassScoreboardPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>
}) {
  const { id, sessionId } = await params
  const user = await getLopViewer(id)
  if (!user) redirectToLogin()
  const board = await loadClassScoreboardPg(id, sessionId, user.id)
  if (!board) notFound()
  const { t } = getServerDictionary()
  return <ClassScoreboardSheet classId={id} board={board} t={t.classes} />
}
