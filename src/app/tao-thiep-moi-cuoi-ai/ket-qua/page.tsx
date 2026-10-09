import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import {
  ensureWeddingCardOwnerProfile,
  getLatestWeddingCardForUser,
  getWeddingCardForUser,
} from '@/lib/db/wedding-cards-pg'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Khách mời & Kết quả khách đi thiệp cưới',
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

  redirect(`/tao-thiep-moi-cuoi-ai/khach-moi?cardId=${encodeURIComponent(card.id)}`)
}
