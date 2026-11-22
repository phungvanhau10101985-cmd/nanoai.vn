import { notFound } from 'next/navigation'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getLopViewer } from '@/lib/lop/lop-viewer'
import { AnswerCardSchemaError, loadAnswerCardRoundForTeacherPg } from '@/lib/db/answer-card-pg'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import { ChieuTheTraLoiClient } from './chieu-client'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<ReturnType<typeof buildMetadata>> {
  const { t } = getServerDictionary()
  return buildMetadata({
    title: t.classes.answerCardsTitle,
    description: t.classes.answerCardsLead,
    path: '/lop/the-tra-loi/chieu',
    noIndex: true,
  })
}

export default async function ChieuTheTraLoiPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; roundId: string }>
  searchParams: Promise<{ subject?: string; teacher?: string }>
}) {
  const { id, roundId } = await params
  const user = await getLopViewer(id)
  if (!user) redirectToLogin()
  const { t } = getServerDictionary()
  let view = null
  try {
    view = await loadAnswerCardRoundForTeacherPg(roundId, user.id)
  } catch (error) {
    if (error instanceof AnswerCardSchemaError) {
      return <p className="p-6 text-sm">{t.classes.answerCardsSchema}</p>
    }
    throw error
  }
  if (!view || view.classId !== id) notFound()
  const sp = await searchParams
  const subjectQuery = sp.subject && sp.teacher
    ? `subject=${encodeURIComponent(sp.subject)}&teacher=${encodeURIComponent(sp.teacher)}`
    : ''
  return <ChieuTheTraLoiClient initial={view} subjectQuery={subjectQuery} t={t.classes} />
}
