import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import LamBaiClient from './lam-bai-client'
import { worksheetDisplayMarkdownFromDb } from '@/app/tao-giao-trinh/lib/merge-worksheet-content'

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
    return buildMetadata({ title: 'Làm bài', description: 'Làm bài tập', path: `/phieu-bai-tap/${id}/lam-bai`, noIndex: true })
  }
  const supabase = createClient()
  const { data } = await supabase
    .from('worksheet_worksheets')
    .select('topic')
    .eq('id', id)
    .single()
  return buildMetadata({
    title: data?.topic ? `Làm bài: ${data.topic}` : 'Làm bài',
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
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  if (!classId) notFound()

  const { data: member } = await supabase
    .from('class_members')
    .select('id')
    .eq('class_id', classId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) notFound()

  const { data: cw } = await supabase
    .from('class_worksheets')
    .select('id')
    .eq('class_id', classId)
    .eq('worksheet_id', worksheetId)
    .maybeSingle()

  if (!cw) notFound()

  const { data: worksheet, error } = await supabase
    .from('worksheet_worksheets')
    .select('id, topic, content_markdown, question_ids')
    .eq('id', worksheetId)
    .single()

  if (error || !worksheet) notFound()

  const questionIds = (worksheet.question_ids ?? []) as string[]
  const displayMarkdown =
    questionIds.length > 0
      ? await worksheetDisplayMarkdownFromDb(supabase, worksheet.content_markdown ?? '', questionIds)
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
