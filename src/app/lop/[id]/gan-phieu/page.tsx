import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import { GAN_PHIEU_RELATED } from '@/lib/creation-tool-sidebar-config'
import GanPhieuClient from './gan-phieu-client'
import { listWorksheets } from '@/app/tao-giao-trinh/actions'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<ReturnType<typeof buildMetadata>> {
  const { id } = await params
  const { t } = getServerDictionary()
  return buildMetadata({
    title: t.classes.assignWorksheet,
    description: t.classes.classHubCardAssignWorksheetDesc,
    path: `/lop/${id}/gan-phieu`,
    keywords: [t.classes.title, t.classes.assignWorksheet],
  })
}

export default async function GanPhieuPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: classId } = await params
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirectToLogin()

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
      <CreationToolPageShell
        currentHref={`/lop/${classId}/gan-phieu`}
        relatedLinks={GAN_PHIEU_RELATED}
      >
        <div className="mx-auto max-w-2xl px-4 py-8">
          <Link
            href={`/lop/${classId}`}
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4 shrink-0 rotate-180" aria-hidden />
            {t.classes.classPageBackToClass}
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
      </CreationToolPageShell>
    </div>
  )
}
