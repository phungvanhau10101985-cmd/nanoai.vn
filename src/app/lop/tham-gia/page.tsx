import { redirect } from 'next/navigation'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import ThamGiaForm from './tham-gia-form'
import { fetchClassIdByJoinCodePg } from '@/lib/db/classes-pg'
import { fetchStudentIdentity } from '@/lib/db/student-identity-pg'
import { examReturnPath } from '@/lib/lop/exam-return-path'
import { resumeClassEntry } from '@/lib/lop/resume-class-entry'
import { BrowserBackTextButton } from '@/components/navigation/browser-back-control'

export const dynamic = 'force-dynamic'

export const metadata = buildMetadata({
  title: 'Tham gia lớp',
  description: 'Tham gia lớp học bằng mã.',
  path: '/lop/tham-gia',
  keywords: ['tham gia lớp', 'mã lớp'],
})

export default async function ThamGiaPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; next?: string; way?: string }>
}) {
  const sp = await searchParams
  const initialCode = String(sp.code ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12)
  const nextPath = examReturnPath(sp.next)
  if (initialCode && sp.way !== 'google') {
    const nextQuery = nextPath ? `&next=${encodeURIComponent(nextPath)}` : ''
    redirect(`/lop/chon-vao?code=${encodeURIComponent(initialCode)}${nextQuery}`)
  }

  const user = await getUserOrBypass()
  if (!user) redirectToLogin()

  if (initialCode) {
    const classId = await fetchClassIdByJoinCodePg(initialCode)
    if (classId) {
      const destination = await resumeClassEntry(classId, nextPath)
      if (destination) redirect(destination)
    }
  }

  const { t } = await getServerDictionary()
  const identity = await fetchStudentIdentity(user.id)

  return (
    <div className="app-shell min-h-screen">
      <div className="mx-auto max-w-md px-4 py-8 lg:max-w-lg lg:px-6 lg:py-10">
        <BrowserBackTextButton
          fallbackHref="/lop"
          className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground lg:mb-5 lg:text-[15px]"
        >
          ← {t.classes.backToList}
        </BrowserBackTextButton>
        <h1 className="mb-6 text-xl font-bold text-foreground lg:mb-7 lg:text-2xl lg:tracking-tight">{t.classes.joinClass}</h1>
        <ThamGiaForm
          t={t.classes}
          initialCode={initialCode}
          givenName={identity.givenName}
          birthDate={identity.birthDate}
          gender={identity.gender}
          studentCode={identity.studentCode}
          returnPath={examReturnPath(sp.next)}
        />
      </div>
    </div>
  )
}
