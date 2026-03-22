import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import Link from 'next/link'
import LopClientPage from './lop-client-page'

export const metadata = buildMetadata({
  title: 'Lớp học',
  description: 'Quản lý lớp học, tạo lớp, tham gia lớp qua mã.',
  path: '/lop',
  keywords: ['lớp học', 'quản lý lớp', 'tham gia lớp'],
})

export default async function LopPage() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const { data: myClasses } = await supabase
    .from('classes')
    .select('id, name, join_code, created_at, grade_level_id, schools(name)')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false })

  const { data: memberClasses } = await supabase
    .from('class_members')
    .select(`
      class_id,
      classes (id, name, join_code, grade_level_id, schools(name))
    `)
    .eq('user_id', user.id)

  const { t } = await getServerDictionary()

  return (
    <div className="app-shell min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-foreground">{t.classes.myClasses}</h1>
          <div className="flex gap-2">
            <Link
              href="/lop/tham-gia"
              className="px-4 py-2 rounded-lg border border-input bg-background hover:bg-accent text-sm font-medium"
            >
              {t.classes.joinClass}
            </Link>
            <Link
              href="/lop/tao"
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium"
            >
              {t.classes.createClass}
            </Link>
          </div>
        </header>

        <LopClientPage
          t={t.classes}
          myClasses={myClasses ?? []}
          memberClasses={
            (memberClasses ?? [])
              .filter((m) => m.classes != null)
              .map((m) => {
                const c = Array.isArray(m.classes) ? m.classes[0] : m.classes
                return c
                  ? {
                    id: c.id,
                    name: c.name,
                    join_code: c.join_code,
                    grade_level_id: c.grade_level_id ?? null,
                    schools: c.schools ?? null,
                  }
                  : null
              })
              .filter((x): x is { id: string; name: string; join_code: string; grade_level_id?: string | null; schools?: { name?: string | null } | Array<{ name?: string | null }> | null } => x != null)
          }
        />
      </div>
    </div>
  )
}
