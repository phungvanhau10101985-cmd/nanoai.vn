import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import Link from 'next/link'
import EnterClassForm from '../enter-class-form'
import { TeacherIdentityGate } from '@/components/lop/teacher-identity-form'
import { fetchTeacherIdentity } from '@/lib/db/teacher-identity-pg'

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
  const identity = await fetchTeacherIdentity(user.id, locale)
  if (!identity.publicName) {
    return (
      <div className="app-shell min-h-screen">
        <CreationToolPageShell currentHref="/lop/tao">
          <div className="mx-auto max-w-md px-4 py-8">
            <Link
              href="/lop"
              className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              ← {t.creationSidebar.back}
            </Link>
            <TeacherIdentityGate t={t.classes} initialName={identity.givenName} initialGender={identity.gender} />
          </div>
        </CreationToolPageShell>
      </div>
    )
  }

  return (
    <div className="app-shell min-h-screen">
      <CreationToolPageShell currentHref="/lop/tao">
        <div className="mx-auto max-w-md px-4 py-8">
          <Link
            href="/lop"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            ← {t.creationSidebar.back}
          </Link>
          <h1 className="text-xl font-bold text-foreground mb-2">{t.classes.createClass}</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            {t.classes.teacherIdentityShownAs.replace('{name}', identity.publicName)}
          </p>
          <EnterClassForm t={t.classes} locale={locale} />
        </div>
      </CreationToolPageShell>
    </div>
  )
}
