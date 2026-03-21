import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import KetQuaClient from './ket-qua-client'
import { worksheetDisplayMarkdownFromDb } from '@/app/tao-giao-trinh/lib/merge-worksheet-content'

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ classId?: string }>
}): Promise<ReturnType<typeof import('@/lib/seo').buildMetadata>> {
  const { id } = await params
  const supabase = createClient()
  const { data } = await supabase
    .from('worksheet_worksheets')
    .select('topic')
    .eq('id', id)
    .single()
  return buildMetadata({
    title: data?.topic ? `Kết quả: ${data.topic}` : 'Kết quả',
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
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  if (!classId) notFound()

  const { data: submission } = await supabase
    .from('worksheet_submissions')
    .select('*')
    .eq('worksheet_id', worksheetId)
    .eq('class_id', classId)
    .eq('user_id', user.id)
    .single()

  if (!submission) notFound()

  const { data: worksheet } = await supabase
    .from('worksheet_worksheets')
    .select('id, topic, content_markdown, question_ids')
    .eq('id', worksheetId)
    .single()

  if (!worksheet) notFound()

  const questionIds = (worksheet.question_ids ?? []) as string[]
  const displayMarkdown =
    questionIds.length > 0
      ? await worksheetDisplayMarkdownFromDb(supabase, worksheet.content_markdown ?? '', questionIds)
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
        classId={classId}
        t={t.classes}
        questionBadge={t.worksheetSolutionPage.questionBadge}
      />
    </div>
  )
}
