import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import {
  getPublishedInvitedGuestPersonalInvite,
  getPublishedWeddingCardBySlug,
  listPublishedWeddingImages,
  listPublishedWeddingWishes,
} from '@/lib/db/wedding-cards-pg'
import { normalizeGuestInviteVenue } from '@/lib/wedding/wedding-guest-invite-venue'
import WeddingPublicClient from './wedding-public-client'

type Props = {
  params: { slug: string }
  searchParams?: { guest?: string; venue?: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const card = await getPublishedWeddingCardBySlug(params.slug).catch(() => null)
  if (!card) return buildMetadata({ title: 'Thiệp mời cưới', description: 'Thiệp mời cưới online.', path: `/thiep-moi-cuoi/${params.slug}` })
  return buildMetadata({
    title: `Thiệp mời cưới ${card.groomName} & ${card.brideName}`,
    description: `Trân trọng kính mời bạn đến dự lễ cưới của ${card.groomName} và ${card.brideName}.`,
    path: `/thiep-moi-cuoi/${params.slug}`,
  })
}

export default async function WeddingPublicPage({ params, searchParams }: Props) {
  const card = await getPublishedWeddingCardBySlug(params.slug).catch(() => null)
  if (!card) notFound()
  const guestDisplayName = String(searchParams?.guest ?? '').trim()
  const inviteVenue = normalizeGuestInviteVenue(searchParams?.venue)
  const personalInvite =
    guestDisplayName && inviteVenue
      ? await getPublishedInvitedGuestPersonalInvite({
          cardId: card.id,
          guestDisplayName,
          inviteVenue,
        }).catch(() => '')
      : ''
  const [wishes, images] = await Promise.all([
    listPublishedWeddingWishes(card.id),
    listPublishedWeddingImages(card.id),
  ])
  return (
    <WeddingPublicClient
      card={card}
      wishes={wishes}
      images={images}
      initialGuestDisplayName={guestDisplayName}
      initialGuestInviteVenue={inviteVenue}
      initialPersonalInvite={personalInvite}
    />
  )
}
