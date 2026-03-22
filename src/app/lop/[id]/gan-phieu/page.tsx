import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import Link from 'next/link'
import GanPhieuClient from './gan-phieu-client'
import { listWorksheets } from '@/app/tao-giao-trinh/actions'

export const metadata = buildMetadata({
  title: 'Gán phiếu bài tập',
  description: 'Gán phiếu bài tập cho lớp.',
  path: '/lop/[id]/gan-phieu',
  keywords: ['gán phiếu', 'lớp học'],
})

export default async function GanPhieuPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: classId } = await params
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const { data: cls } = await supabase
    .from('classes')
    .select('id, name, teacher_id')
    .eq('id', classId)
    .single()

  if (!cls || cls.teacher_id !== user.id) notFound()

  const { data: assigned } = await supabase
    .from('class_worksheets')
    .select('worksheet_id, worksheet_worksheets(id, topic)')
    .eq('class_id', classId)

  const wsRes = await listWorksheets({ limit: 100 })
  const allWorksheets = (wsRes && 'items' in wsRes ? (wsRes.items ?? []) : []).map(
    (w: { id: string; topic: string }) => ({ id: w.id, topic: w.topic })
  )

  const { t } = await getServerDictionary()

  return (
    <div className="app-shell min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href={`/lop/${classId}`} className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
          ← {t.classes.backToList}
        </Link>
        <h1 className="text-xl font-bold text-foreground mb-2">{t.classes.assignWorksheet}</h1>
        <p className="text-sm text-muted-foreground mb-6">{cls.name}</p>
        <GanPhieuClient
          classId={classId}
          assignedIds={(assigned ?? [])
            .filter((a: { worksheet_worksheets: unknown }) => a.worksheet_worksheets)
            .map((a: { worksheet_id: string }) => a.worksheet_id)}
          worksheets={allWorksheets}
          t={t.classes}
        />
      </div>
    </div>
  )
}
