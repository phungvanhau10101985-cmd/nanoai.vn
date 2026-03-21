import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import Link from 'next/link'
import TaoLopForm from './tao-lop-form'

export const metadata = buildMetadata({
  title: 'Tạo lớp',
  description: 'Tạo lớp học mới.',
  path: '/lop/tao',
  keywords: ['tạo lớp', 'lớp học'],
})

export default async function TaoLopPage() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const { t } = await getServerDictionary()

  return (
    <div className="app-shell min-h-screen">
      <div className="max-w-md mx-auto px-4 py-8">
        <Link href="/lop" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
          ← {t.classes.backToList}
        </Link>
        <h1 className="text-xl font-bold text-foreground mb-6">{t.classes.createClass}</h1>
        <TaoLopForm t={t.classes} />
      </div>
    </div>
  )
}
