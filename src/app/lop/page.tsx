import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { fetchClassesAsMemberForUserPg, fetchClassesMineListForTeacherPg } from '@/lib/db/classes-pg'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import Link from 'next/link'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import LopClientPage, { type ClassItem } from './lop-client-page'

export const metadata = buildMetadata({
  title: 'Lớp học',
  description: 'Quản lý lớp học, tạo lớp, tham gia lớp qua mã.',
  path: '/lop',
  keywords: ['lớp học', 'quản lý lớp', 'tham gia lớp'],
})

function mapMineToClassItem(
  c: NonNullable<Awaited<ReturnType<typeof fetchClassesMineListForTeacherPg>>>[number]
): ClassItem {
  return {
    id: c.id,
    name: c.name,
    join_code: c.join_code,
    grade_level_id: c.grade_level_id,
    subject_label: c.subject_label,
    teacher_display_name: c.teacher_display_name,
    schools: c.school_name ? { name: c.school_name } : null,
  }
}

export default async function LopPage() {
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()

  const myRows = await fetchClassesMineListForTeacherPg(user.id)
  const memberRows = await fetchClassesAsMemberForUserPg(user.id)

  const myClasses: ClassItem[] = (myRows ?? []).map(mapMineToClassItem)
  const memberClasses: ClassItem[] = (memberRows ?? []).map(mapMineToClassItem)

  const { t } = await getServerDictionary()

  return (
    <div className="app-shell min-h-screen">
      <CreationToolPageShell currentHref="/lop">
        <div className="mx-auto w-full max-w-2xl pb-8 lg:max-w-3xl lg:pb-10">
          <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:mb-8">
            <h1 className="text-xl font-bold text-foreground lg:text-2xl lg:tracking-tight">{t.classes.myClasses}</h1>
            <div className="flex flex-wrap gap-2 lg:gap-3">
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

          {myClasses.length > 0 ? (
            <div className="mb-6 grid gap-2 md:hidden sm:grid-cols-2">
              <Link
                href="/tao-bai-thi"
                className="flex w-full touch-manipulation items-center justify-center rounded-lg border border-input bg-secondary px-4 py-3 text-center text-sm font-semibold text-secondary-foreground shadow-sm transition-colors hover:bg-secondary/90 active:bg-secondary/80"
              >
                {t.classes.mobileCreateExam}
              </Link>
              <Link
                href="/tao-bai-tap-ve-nha"
                className="flex w-full touch-manipulation items-center justify-center rounded-lg border border-input bg-background px-4 py-3 text-center text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted/60 active:bg-muted/80"
              >
                {t.classes.mobileCreateHomework}
              </Link>
            </div>
          ) : null}

          <LopClientPage t={t.classes} myClasses={myClasses} memberClasses={memberClasses} />
        </div>
      </CreationToolPageShell>
    </div>
  )
}
