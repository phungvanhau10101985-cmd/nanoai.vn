import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import EnterClassForm from '../enter-class-form'

export const metadata = buildMetadata({
  title: 'Tạo lớp',
  description: 'Tạo lớp học mới.',
  path: '/lop/tao',
  keywords: ['tạo lớp', 'lớp học'],
})

export default async function TaoLopPage() {
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()

  const { locale, t } = await getServerDictionary()

  return (
    <div className="app-shell min-h-screen">
      <CreationToolPageShell currentHref="/lop/tao">
        <div className="mx-auto max-w-md px-4 py-8">
          <h1 className="text-xl font-bold text-foreground mb-6">{t.classes.createClass}</h1>
          <EnterClassForm t={t.classes} locale={locale} />
        </div>
      </CreationToolPageShell>
    </div>
  )
}
