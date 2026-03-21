import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import Link from 'next/link'
import ThamGiaForm from './tham-gia-form'

export const metadata = buildMetadata({
  title: 'Tham gia lớp',
  description: 'Tham gia lớp học bằng mã.',
  path: '/lop/tham-gia',
  keywords: ['tham gia lớp', 'mã lớp'],
})

export default async function ThamGiaPage() {
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
        <h1 className="text-xl font-bold text-foreground mb-6">{t.classes.joinClass}</h1>
        <ThamGiaForm t={t.classes} />
      </div>
    </div>
  )
}
