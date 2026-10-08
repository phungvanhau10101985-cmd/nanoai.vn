import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import { getUserOrBypass } from '@/lib/auth'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import {
  ensureWeddingCardOwnerProfile,
  getLatestWeddingCardForUser,
  getWeddingCardForUser,
  getWeddingRsvpNotifyRowForOwner,
  loadWeddingAttendanceSources,
} from '@/lib/db/wedding-cards-pg'
import { invitationEditorCopy, invitationOccasionShape } from '@/lib/wedding/invitation-occasion'
import { summarizeWeddingAttendanceSources, emptyWeddingAttendanceBucket } from '@/lib/wedding/wedding-attendance-summary'
import { buildMetadata } from '@/lib/seo'
import WeddingAttendanceClientPage from './wedding-attendance-client-page'

export const metadata: Metadata = buildMetadata({
  title: 'Kết quả khách đi thiệp cưới',
  description: 'Xem số khách đi, số người đi và số người không đi riêng từng nhà, và nhận email thông báo.',
  path: '/tao-thiep-moi-cuoi-ai/ket-qua',
  noIndex: true,
})

type Props = {
  searchParams: Promise<{ cardId?: string }>
}

export default async function WeddingAttendancePage({ searchParams }: Props) {
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()

  const params = await searchParams
  const ownerUserId = await ensureWeddingCardOwnerProfile(user.id, user.email ?? '')
  let cardId = params.cardId?.trim() ?? ''
  if (!cardId) {
    const latest = await getLatestWeddingCardForUser(ownerUserId)
    if (!latest) redirect('/tao-thiep-moi-cuoi-ai')
    cardId = latest.id
  }

  const card = await getWeddingCardForUser(cardId, ownerUserId)
  if (!card) redirect('/tao-thiep-moi-cuoi-ai')

  const [sources, settings] = await Promise.all([
    loadWeddingAttendanceSources(card.id, ownerUserId),
    getWeddingRsvpNotifyRowForOwner(card.id, ownerUserId),
  ])
  const summary = sources
    ? summarizeWeddingAttendanceSources(sources.guests, sources.rsvps)
    : {
        total: emptyWeddingAttendanceBucket(),
        groom: emptyWeddingAttendanceBucket(),
        bride: emptyWeddingAttendanceBucket(),
        outside: emptyWeddingAttendanceBucket(),
      }
  const copy = invitationEditorCopy(card.occasionKey)
  const couple = [card.groomName.trim(), card.brideName.trim()].filter(Boolean).join(' & ')

  return (
    <div className="mx-auto w-full max-w-5xl px-2 pb-4 pt-0 sm:px-4 sm:pb-6 lg:px-6">
      <CreationToolPageShell currentHref="/tao-thiep-moi-cuoi-ai" wide>
        <WeddingAttendanceClientPage
          cardId={card.id}
          couple={couple || copy.label}
          coupleShape={invitationOccasionShape(card.occasionKey) === 'couple'}
          primaryLabel={copy.primaryFamily}
          secondaryLabel={copy.secondaryFamily}
          primaryRole={copy.primaryRole}
          secondaryRole={copy.secondaryRole}
          summary={summary}
          groomEmail={settings?.groomEmail ?? ''}
          brideEmail={settings?.brideEmail ?? ''}
          notify={Boolean(settings?.daily || settings?.onIncrease)}
        />
      </CreationToolPageShell>
    </div>
  )
}
