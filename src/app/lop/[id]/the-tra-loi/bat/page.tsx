import { notFound, redirect } from 'next/navigation'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getLopViewer } from '@/lib/lop/lop-viewer'
import {
  AnswerCardSchemaError,
  createAnswerCardRoundPg,
  teacherMayScanClassPg,
} from '@/lib/db/answer-card-pg'
import { getServerDictionary } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Cửa sổ học sinh: tạo buổi quét rồi mở danh sách đủ câu của đề. */
export default async function BatQuetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ kind?: string; source?: string }>
}) {
  const { id } = await params
  const query = await searchParams
  const user = await getLopViewer(id)
  if (!user) redirectToLogin()
  if (!UUID_RE.test(id)) notFound()
  const source = String(query.source ?? '').trim()
  const kind = query.kind === 'worksheet' ? 'worksheet' : query.kind === 'exam' ? 'exam' : null
  const { t } = getServerDictionary()
  if (!kind || !UUID_RE.test(source)) {
    return <p className="p-6 text-sm text-muted-foreground">{t.classes.answerCardsLoadError}</p>
  }
  const allowed = await teacherMayScanClassPg(id, user.id)
  if (!allowed) redirect(`/lop/${id}`)
  let created: Awaited<ReturnType<typeof createAnswerCardRoundPg>> | 'schema' = null
  try {
    created = await createAnswerCardRoundPg({
      classId: id,
      teacherId: user.id,
      sourceKind: kind,
      sourceId: source,
    })
  } catch (error) {
    created = error instanceof AnswerCardSchemaError ? 'schema' : null
  }
  if (created && created !== 'no_mcq' && created !== 'not_found' && created !== 'schema') {
    redirect(`/lop/${id}/the-tra-loi/chieu/${created.id}`)
  }
  const message = created === 'no_mcq'
    ? t.classes.answerCardsNoMcq
    : created === 'schema'
      ? t.classes.answerCardsSchema
      : t.classes.answerCardsLoadError
  return <p className="p-6 text-sm text-muted-foreground">{message}</p>
}
