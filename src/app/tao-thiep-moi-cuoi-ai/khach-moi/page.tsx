import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import { getUserOrBypass } from '@/lib/auth'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { buildMetadata } from '@/lib/seo'
import { getLatestWeddingCardForUser, ensureWeddingCardOwnerProfile } from '@/lib/db/wedding-cards-pg'
import WeddingInvitedGuestsClientPage from './wedding-invited-guests-client-page'

export const metadata: Metadata = buildMetadata({
  title: 'Danh sách khách mời thiệp cưới',
  description: 'Quản lý khách mời, trạng thái tham dự và link thiệp cá nhân cho từng khách.',
  path: '/tao-thiep-moi-cuoi-ai/khach-moi',
  noIndex: true,
})

type Props = {
  searchParams: Promise<{ cardId?: string }>
}

export default async function WeddingInvitedGuestsPage({ searchParams }: Props) {
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

  return (
    <div className="mx-auto w-full max-w-[100rem] px-2 pb-4 pt-0 sm:px-4 sm:pb-6 lg:px-6">
      <CreationToolPageShell currentHref="/tao-thiep-moi-cuoi-ai" wide>
        <WeddingInvitedGuestsClientPage cardId={cardId} />
      </CreationToolPageShell>
    </div>
  )
}
