import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ensureClassEntryTokenPg } from '@/lib/db/class-entry-pg'
import { fetchClassJoinPreviewByJoinCodeFromPg } from '@/lib/db/classes-pg'
import { readTutoringJoinBlock } from '@/lib/db/tutoring-package-pg'
import { getServerDictionary } from '@/lib/i18n/server'
import { examReturnPath } from '@/lib/lop/exam-return-path'
import { resumeClassEntry } from '@/lib/lop/resume-class-entry'
import { buildMetadata } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<ReturnType<typeof buildMetadata>> {
  const { t } = getServerDictionary()
  return buildMetadata({
    title: t.classes.joinChoiceTitle,
    description: t.classes.joinChoiceLead,
    path: '/lop/chon-vao',
    keywords: [t.classes.joinClass, t.classes.joinChoiceGmail, t.classes.joinChoiceIdentity],
  })
}

function joinCodeFromQuery(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
}

export default async function ChonVaoPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; next?: string }>
}) {
  const { t } = getServerDictionary()
  const query = await searchParams
  const code = joinCodeFromQuery(String(query.code ?? ''))
  const nextPath = examReturnPath(query.next)
  const preview = code.length >= 4 ? await fetchClassJoinPreviewByJoinCodeFromPg(code) : null
  let className = ''
  let identityPath: string | null = null
  if (preview) {
    const block = await readTutoringJoinBlock(preview.id)
    if (block !== 'closed' && block !== 'dissolved') {
      className = String(preview.name ?? '').trim()
      const destination = await resumeClassEntry(preview.id, nextPath)
      if (destination) redirect(destination)
      const token = await ensureClassEntryTokenPg(preview.id)
      if (typeof token === 'string') identityPath = `/lop/vao/${encodeURIComponent(token)}`
    }
  }
  const nextQuery = nextPath ? `&next=${encodeURIComponent(nextPath)}` : ''
  const gmailPath = `/lop/tham-gia?code=${encodeURIComponent(code)}&way=google${nextQuery}`

  return (
    <div className="app-shell min-h-screen">
      <div className="mx-auto max-w-md px-4 py-8">
        <h1 className="text-xl font-bold text-foreground">{t.classes.joinChoiceTitle}</h1>
        {className ? (
          <p className="mt-1 text-sm font-medium text-foreground">{className}</p>
        ) : null}
        <p className="mt-2 text-sm text-muted-foreground">
          {nextPath ? t.classes.joinChoiceExamLead : t.classes.joinChoiceLead}
        </p>
        {className ? (
          <div className="mt-6 space-y-3">
            <Link
              href={gmailPath}
              className="block rounded-xl border-2 border-foreground bg-foreground px-4 py-4 text-background"
            >
              <span className="text-xs font-medium uppercase tracking-wide opacity-80">
                {t.classes.joinChoiceRecommended}
              </span>
              <span className="mt-1 block text-base font-semibold">{t.classes.joinChoiceGmail}</span>
              <span className="mt-1 block text-sm opacity-80">{t.classes.joinChoiceGmailHint}</span>
            </Link>
            {identityPath ? (
              <Link
                href={`${identityPath}?way=identity${nextPath ? `&next=${encodeURIComponent(nextPath)}` : ''}`}
                className="block rounded-xl border border-border bg-background px-4 py-4 hover:bg-muted/40"
              >
                <span className="block text-base font-semibold text-foreground">{t.classes.joinChoiceIdentity}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{t.classes.joinChoiceIdentityHint}</span>
              </Link>
            ) : null}
          </div>
        ) : (
          <p className="mt-6 text-sm text-destructive">{t.classes.joinChoiceNotFound}</p>
        )}
      </div>
    </div>
  )
}
