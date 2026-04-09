import { notFound } from 'next/navigation'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import LamBaiClient from './lam-bai-client'
import { worksheetDisplayMarkdownFromDb } from '@/app/tao-giao-trinh/lib/merge-worksheet-content'
import { isPgConfigured } from '@/lib/db/pool'
import { classMemberExistsPg, classWorksheetLinkExistsPg } from '@/lib/db/classes-pg'
import { fetchWorksheetSheetMinimalByIdFromPg, fetchWorksheetTopicByIdFromPg } from '@/lib/db/worksheet-pg'

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ classId?: string }>
}): Promise<ReturnType<typeof import('@/lib/seo').buildMetadata>> {
  const { id } = await params
  const { classId } = await searchParams
  if (!classId) {
    return buildMetadata({
      title: 'Làm bài',
      description: 'Làm bài tập',
      path: `/phieu-bai-tap/${id}/lam-bai`,
      noIndex: true,
    })
  }
  let titleTopic: string | null = null
  if (isPgConfigured()) {
    titleTopic = await fetchWorksheetTopicByIdFromPg(id)
  }
  return buildMetadata({
    title: titleTopic ? `Làm bài: ${titleTopic}` : 'Làm bài',
    description: 'Làm bài tập',
    path: `/phieu-bai-tap/${id}/lam-bai`,
    noIndex: true,
  })
}

export default async function LamBaiPage({
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

  const memberOk = await classMemberExistsPg(classId, user.id)
  if (memberOk !== true) notFound()

  const linkOk = await classWorksheetLinkExistsPg(classId, worksheetId)
  if (linkOk !== true) notFound()

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
      <LamBaiClient
        worksheet={{
          id: worksheet.id,
          topic: worksheet.topic,
          content_markdown: displayMarkdown,
        }}
        classId={classId}
        t={t.classes}
      />
    </div>
  )
}
