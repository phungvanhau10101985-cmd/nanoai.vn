import { notFound } from 'next/navigation'
import { AnswerCardSchemaError, loadAnswerCardPhoneViewPg } from '@/lib/db/answer-card-pg'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import { isAnswerCardPhoneToken } from '@/lib/lop/answer-card'
import { QuetTheClient } from './quet-the-client'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<ReturnType<typeof buildMetadata>> {
  const { t } = getServerDictionary()
  return buildMetadata({
    title: t.classes.answerCardsTitle,
    description: t.classes.answerCardsRaiseHint,
    path: '/lop/quet-the',
    noIndex: true,
  })
}

export default async function QuetThePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  if (!isAnswerCardPhoneToken(token)) notFound()
  const { t } = getServerDictionary()
  try {
    const view = await loadAnswerCardPhoneViewPg(token)
    if (!view) notFound()
    return <QuetTheClient token={token} initial={view} t={t.classes} />
  } catch (error) {
    if (error instanceof AnswerCardSchemaError) {
      return <p className="p-6 text-sm text-white">{t.classes.answerCardsSchema}</p>
    }
    throw error
  }
}
