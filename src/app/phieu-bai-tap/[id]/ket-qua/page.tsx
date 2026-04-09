import { notFound } from 'next/navigation'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import KetQuaClient from './ket-qua-client'
import { worksheetDisplayMarkdownFromDb } from '@/app/tao-giao-trinh/lib/merge-worksheet-content'
import { isPgConfigured } from '@/lib/db/pool'
import {
  fetchWorksheetSheetMinimalByIdFromPg,
  fetchWorksheetSubmissionForUserInClassFromPg,
  fetchWorksheetTopicByIdFromPg,
} from '@/lib/db/worksheet-pg'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<ReturnType<typeof import('@/lib/seo').buildMetadata>> {
  const { id } = await params
  let titleTopic: string | null = null
  if (isPgConfigured()) {
    titleTopic = await fetchWorksheetTopicByIdFromPg(id)
  }
  return buildMetadata({
    title: titleTopic ? `Kết quả: ${titleTopic}` : 'Kết quả',
    description: 'Xem kết quả bài làm',
    path: `/phieu-bai-tap/${id}/ket-qua`,
    noIndex: true,
  })
}

export default async function KetQuaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ classId?: string }>
}) {
  const { id: worksheetId } = await params
  const { classId } = await searchParams
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()
  if (!classId) notFound()
  if (!isPgConfigured()) notFound()

  const submission = await fetchWorksheetSubmissionForUserInClassFromPg(worksheetId, classId, user.id)
  if (!submission) notFound()

  const worksheet = await fetchWorksheetSheetMinimalByIdFromPg(worksheetId)
  if (!worksheet) notFound()

  const questionIds = worksheet.question_ids
  const displayMarkdown =
    questionIds.length > 0
      ? await worksheetDisplayMarkdownFromDb(worksheet.content_markdown ?? '', questionIds)
      : (worksheet.content_markdown ?? '')

  const { t } = await getServerDictionary()

  return (
    <div className="min-h-screen bg-background">
      <KetQuaClient
        worksheet={{
          id: worksheet.id,
          topic: worksheet.topic,
          content_markdown: displayMarkdown,
        }}
        submission={submission}
        t={t.classes}
        questionBadge={t.worksheetSolutionPage.questionBadge}
      />
    </div>
  )
}
