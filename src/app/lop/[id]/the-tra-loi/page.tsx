import { notFound, redirect } from 'next/navigation'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getLopViewer } from '@/lib/lop/lop-viewer'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import {
  AnswerCardSchemaError,
  ensureClassAnswerCardsPg,
  listAnswerCardRoundsPg,
  listAnswerCardSourcesPg,
} from '@/lib/db/answer-card-pg'
import { fetchClassNameByIdPg } from '@/lib/db/classes-pg'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import { listRosterLoginCodesPg, provisionRosterLoginsPg } from '@/lib/db/class-entry-pg'
import { loadClassDetailPayload } from '@/lib/lop/load-class-detail-payload'
import { classSubjectScopeFromSearch } from '../lop-class-detail-view'
import { TheTraLoiClient } from './the-tra-loi-client'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<ReturnType<typeof buildMetadata>> {
  const { id } = await params
  const { t } = getServerDictionary()
  const className = await fetchClassNameByIdPg(id)
  return buildMetadata({
    title: className ? `${className} — ${t.classes.answerCardsTitle}` : t.classes.answerCardsTitle,
    description: t.classes.answerCardsHubDesc,
    path: `/lop/${id}/the-tra-loi`,
    keywords: [t.classes.title, t.classes.answerCardsTitle],
    noIndex: true,
  })
}

export default async function TheTraLoiPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ subject?: string; teacher?: string }>
}) {
  const { id } = await params
  const user = await getLopViewer(id)
  if (!user) redirectToLogin()
  const payload = await loadClassDetailPayload(id, user.id)
  if (!payload) notFound()
  if (!payload.isTeacher) redirect(`/lop/${id}`)

  const focus = classSubjectScopeFromSearch(await searchParams)
  if (focus && focus.teacherId !== user.id) redirect(`/lop/${id}`)
  const subjectId = focus?.subjectId ?? null
  const subjectQuery = focus ? `subject=${encodeURIComponent(focus.subjectId)}&teacher=${encodeURIComponent(focus.teacherId)}` : ''

  let schemaMissing = false
  let loadError = false
  let cards: Awaited<ReturnType<typeof ensureClassAnswerCardsPg>> = []
  let sources: Awaited<ReturnType<typeof listAnswerCardSourcesPg>> = []
  let rounds: Awaited<ReturnType<typeof listAnswerCardRoundsPg>> = []
  try {
    await provisionRosterLoginsPg(id)
    const ensured = await ensureClassAnswerCardsPg(id)
    if (!ensured) loadError = true
    else {
      const codes = await listRosterLoginCodesPg(id)
      const byUser = new Map(
        Array.isArray(codes) ? codes.filter((row) => row.userId).map((row) => [row.userId as string, row]) : []
      )
      cards = ensured.map((card) => {
        const row = byUser.get(card.userId)
        return { ...card, loginCode: row?.loginCode, studentCode: row?.studentCode }
      })
    }
    if (!loadError) {
      sources = (await listAnswerCardSourcesPg(id, user.id, subjectId)) ?? []
      rounds = (await listAnswerCardRoundsPg(id, user.id, subjectId)) ?? []
    }
  } catch (error) {
    if (error instanceof AnswerCardSchemaError) schemaMissing = true
    else {
      console.error('[the-tra-loi]', error)
      loadError = true
    }
  }

  const { t } = getServerDictionary()
  return (
    <div className="app-shell min-h-screen">
      <CreationToolPageShell currentHref={`/lop/${id}/the-tra-loi`} hideAside>
        <div className="mx-auto w-full max-w-3xl pb-10">
          <TheTraLoiClient
            classId={id}
            className={payload.cls.name}
            schoolName={payload.schoolName}
            subjectQuery={subjectQuery}
            cards={cards ?? []}
            sources={sources ?? []}
            rounds={rounds ?? []}
            schemaMissing={schemaMissing}
            loadError={loadError}
            t={t.classes}
          />
        </div>
      </CreationToolPageShell>
    </div>
  )
}
