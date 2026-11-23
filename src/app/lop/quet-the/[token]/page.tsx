import { notFound } from 'next/navigation'
import { AnswerCardSchemaError, focusAnswerCardByPhoneTokenPg, loadAnswerCardPhoneViewPg } from '@/lib/db/answer-card-pg'
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
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { token } = await params
  const { q } = await searchParams
  if (!isAnswerCardPhoneToken(token)) notFound()
  const { t } = await getServerDictionary()
  const questionIndex = Number(q)
  try {
    if (q != null && q !== '' && Number.isInteger(questionIndex) && questionIndex >= 0) {
      await focusAnswerCardByPhoneTokenPg(token, questionIndex)
    }
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
