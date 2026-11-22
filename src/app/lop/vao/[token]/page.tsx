import { notFound, redirect } from 'next/navigation'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import { classMemberExistsPg, fetchClassJoinCodeByIdPg } from '@/lib/db/classes-pg'
import { lookupClassByEntryTokenPg } from '@/lib/db/class-entry-pg'
import { buildMetadata } from '@/lib/seo'
import { getServerDictionary } from '@/lib/i18n/server'
import { pgQueryOne } from '@/lib/db/pg-query'
import { examReturnPath } from '@/lib/lop/exam-return-path'
import { resumeClassEntry } from '@/lib/lop/resume-class-entry'
import { StudentEntryForm } from './student-entry-form'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<ReturnType<typeof buildMetadata>> {
  const { t } = getServerDictionary()
  return buildMetadata({
    title: t.classes.entryLinkTitle,
    description: t.classes.entryPageLead,
    path: '/lop/vao',
    keywords: [t.classes.title],
  })
}

export default async function StudentEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ next?: string; way?: string }>
}) {
  const { token } = await params
  const query = await searchParams
  const returnPath = examReturnPath(query.next)
  const found = await lookupClassByEntryTokenPg(token)
  if (!found || found === 'schema') notFound()
  const destination = await resumeClassEntry(found.classId, returnPath)
  if (destination) redirect(destination)
  if (query.way !== 'identity') {
    const joinCode = await fetchClassJoinCodeByIdPg(found.classId)
    if (joinCode) {
      const nextQuery = returnPath ? `&next=${encodeURIComponent(returnPath)}` : ''
      redirect(`/lop/chon-vao?code=${encodeURIComponent(joinCode)}${nextQuery}`)
    }
  }
  const { t } = getServerDictionary()
  const session = await getEmailSessionUser()
  const member = session ? await classMemberExistsPg(found.classId, session.id) : false
  let rememberedName: string | null = null
  if (session && member) {
    const row = await pgQueryOne<{ name: string | null }>(
      `select coalesce(nullif(btrim(m.member_display_name), ''), nullif(btrim(p.full_name), '')) as name
       from public.class_members m
       left join public.profiles p on p.id = m.user_id
       where m.class_id = $1::uuid and m.user_id = $2::uuid
       limit 1`,
      [found.classId, session.id]
    )
    rememberedName = String(row?.name ?? '').trim() || null
  }

  return (
    <div className="app-shell min-h-screen">
      <div className="mx-auto max-w-md px-4 py-8">
        <StudentEntryForm
          token={token}
          className={found.className}
          classId={found.classId}
          rememberedName={rememberedName}
          returnPath={returnPath}
          t={t.classes}
        />
      </div>
    </div>
  )
}
