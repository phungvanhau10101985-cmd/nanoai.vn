import Link from 'next/link'
import { redirect } from 'next/navigation'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import ThamGiaForm from './tham-gia-form'
import { VaoMaForm } from './vao-ma-form'
import { fetchClassIdByJoinCodePg } from '@/lib/db/classes-pg'
import { fetchStudentIdentity } from '@/lib/db/student-identity-pg'
import { normalizeClassJoinCode } from '@/lib/lop/join-code'
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
  const initialCode = normalizeClassJoinCode(String(sp.code ?? ''))
  const nextPath = examReturnPath(sp.next)
  const way = sp.way === 'google' || sp.way === 'identity' ? sp.way : ''
  if (initialCode && !way) {
    const nextQuery = nextPath ? `&next=${encodeURIComponent(nextPath)}` : ''
    redirect(`/lop/chon-vao?code=${encodeURIComponent(initialCode)}${nextQuery}`)
  }

  const { t } = await getServerDictionary()
  const choiceQuery = new URLSearchParams()
  if (initialCode) choiceQuery.set('code', initialCode)
  if (nextPath) choiceQuery.set('next', nextPath)
  const choiceBase = choiceQuery.toString()

  if (!way) {
    const googleHref = `/lop/tham-gia?way=google${choiceBase ? `&${choiceBase}` : ''}`
    const identityHref = `/lop/tham-gia?way=identity${choiceBase ? `&${choiceBase}` : ''}`
    return (
      <div className="app-shell min-h-screen">
        <div className="mx-auto max-w-md px-4 py-8 lg:max-w-lg lg:px-6 lg:py-10">
          <BrowserBackTextButton
            fallbackHref="/lop"
            className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground lg:mb-5 lg:text-[15px]"
          >
            ← {t.classes.backToList}
          </BrowserBackTextButton>
          <h1 className="text-xl font-bold text-foreground lg:text-2xl lg:tracking-tight">{t.classes.joinClass}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.classes.joinWayLead}</p>
          <div className="mt-6 space-y-3">
            <Link
              href={googleHref}
              className="block rounded-xl border-2 border-foreground bg-foreground px-4 py-4 text-background"
            >
              <span className="text-xs font-medium uppercase tracking-wide opacity-80">
                {t.classes.joinChoiceRecommended}
              </span>
              <span className="mt-1 block text-base font-semibold">{t.classes.joinChoiceGmail}</span>
              <span className="mt-1 block text-sm opacity-80">{t.classes.joinChoiceGmailHint}</span>
            </Link>
            <Link
              href={identityHref}
              className="block rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-4 transition-colors hover:bg-emerald-100 dark:border-emerald-400/45 dark:bg-emerald-950/45 dark:hover:bg-emerald-950/70"
            >
              <span className="block text-base font-semibold text-foreground">{t.classes.joinChoiceIdentity}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{t.classes.joinWayIdentityHint}</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (way === 'identity') {
    return (
      <div className="app-shell min-h-screen">
        <div className="mx-auto max-w-md px-4 py-8 lg:max-w-lg lg:px-6 lg:py-10">
          <BrowserBackTextButton
            fallbackHref={`/lop/tham-gia${choiceBase ? `?${choiceBase}` : ''}`}
            className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground lg:mb-5 lg:text-[15px]"
          >
            ← {t.classes.joinClass}
          </BrowserBackTextButton>
          <h1 className="mb-6 text-xl font-bold text-foreground lg:mb-7 lg:text-2xl lg:tracking-tight">
            {t.classes.joinChoiceIdentity}
          </h1>
          <VaoMaForm t={t.classes} initialCode={initialCode} returnPath={nextPath} />
        </div>
      </div>
    )
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

  const identity = await fetchStudentIdentity(user.id)

  return (
    <div className="app-shell min-h-screen">
      <div className="mx-auto max-w-md px-4 py-8 lg:max-w-lg lg:px-6 lg:py-10">
        <BrowserBackTextButton
          fallbackHref={`/lop/tham-gia${choiceBase ? `?${choiceBase}` : ''}`}
          className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground lg:mb-5 lg:text-[15px]"
        >
          ← {t.classes.joinClass}
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
