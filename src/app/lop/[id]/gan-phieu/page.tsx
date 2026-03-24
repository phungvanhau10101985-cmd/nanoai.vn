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
import GanPhieuClient, { type ClassHomeworkSession } from './gan-phieu-client'

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

  const { data: sessionRows } = await supabase
    .from('exam_sessions')
    .select('id, code, title, status, created_at, is_practice_homework')
    .eq('class_id', classId)
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false })

  const sessions: ClassHomeworkSession[] = (sessionRows ?? [])
    .filter((row) => Boolean((row as { is_practice_homework?: boolean | null }).is_practice_homework))
    .map((row) => {
      const r = row as {
        id: string
        code: string
        title: string | null
        status: string | null
        created_at: string
      }
      return {
        id: r.id,
        code: String(r.code ?? '').toUpperCase(),
        title: String(r.title ?? '').trim(),
        status: String(r.status ?? 'active'),
        createdAt: r.created_at,
      }
    })

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
            sessions={sessions}
            t={t.classes}
            examUi={t.createExamPage}
          />
        </div>
      </CreationToolPageShell>
    </div>
  )
}
