import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import ThamGiaForm from './tham-gia-form'
import { StudentIdentityGate } from '@/components/lop/student-identity-form'
import { fetchStudentIdentity } from '@/lib/db/student-identity-pg'
import { BrowserBackTextButton } from '@/components/navigation/browser-back-control'

export const metadata = buildMetadata({
  title: 'Tham gia lớp',
  description: 'Tham gia lớp học bằng mã.',
  path: '/lop/tham-gia',
  keywords: ['tham gia lớp', 'mã lớp'],
})

export default async function ThamGiaPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()

  const sp = await searchParams
  const initialCode = String(sp.code ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12)

  const { t } = await getServerDictionary()
  const identity = await fetchStudentIdentity(user.id)

  return (
    <div className="app-shell min-h-screen">
      <div className="mx-auto max-w-md px-4 py-8 lg:max-w-lg lg:px-6 lg:py-10">
        <BrowserBackTextButton className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground lg:mb-5 lg:text-[15px]">
          ← {t.classes.backToList}
        </BrowserBackTextButton>
        <h1 className="mb-6 text-xl font-bold text-foreground lg:mb-7 lg:text-2xl lg:tracking-tight">{t.classes.joinClass}</h1>
        {identity.complete && identity.gender ? (
          <ThamGiaForm
            t={t.classes}
            initialCode={initialCode}
            givenName={identity.givenName}
            birthDate={identity.birthDate}
            gender={identity.gender}
          />
        ) : (
          <StudentIdentityGate
            t={t.classes}
            initialName={identity.givenName}
            initialGender={identity.gender}
            initialBirthDate={identity.birthDate}
          />
        )}
      </div>
    </div>
  )
}
