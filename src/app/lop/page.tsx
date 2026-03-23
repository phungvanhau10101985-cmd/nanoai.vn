import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import Link from 'next/link'
import LopClientPage, { type ClassItem } from './lop-client-page'

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
      <div className="mx-auto max-w-2xl px-4 py-8 lg:max-w-3xl lg:px-6 lg:py-10">
        <header className="mb-6 flex items-center justify-between lg:mb-8">
          <h1 className="text-xl font-bold text-foreground lg:text-2xl lg:tracking-tight">{t.classes.myClasses}</h1>
          <div className="flex gap-2 lg:gap-3">
            <Link
              href="/lop/tham-gia"
              className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent lg:rounded-xl lg:px-5 lg:py-2.5 lg:shadow-sm lg:transition-shadow lg:hover:shadow-md"
            >
              {t.classes.joinClass}
            </Link>
            <Link
              href="/lop/tao"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 lg:rounded-xl lg:px-5 lg:py-2.5 lg:shadow-md lg:transition-shadow lg:hover:shadow-lg"
            >
              {t.classes.createClass}
            </Link>
          </div>
        </header>

        <LopClientPage
          t={t.classes}
          myClasses={myClasses ?? []}
          memberClasses={(() => {
            const out: ClassItem[] = []
            for (const m of memberClasses ?? []) {
              const raw = m.classes
              const c = raw == null ? null : Array.isArray(raw) ? raw[0] : raw
              if (!c) continue
              out.push({
                id: c.id,
                name: c.name,
                join_code: c.join_code,
                grade_level_id: c.grade_level_id ?? null,
                schools: c.schools ?? null,
              })
            }
            return out
          })()}
        />
      </div>
    </div>
  )
}
