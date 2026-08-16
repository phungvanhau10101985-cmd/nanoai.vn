import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { JsonLd } from '@/components/seo-json-ld'
import { buildMetadata, SITE_URL } from '@/lib/seo'
import {
  getPublishedInvitedGuestPersonalInvite,
  getPublishedWeddingCardBySlug,
  listPublishedWeddingImages,
  listPublishedWeddingWishes,
} from '@/lib/db/wedding-cards-pg'
import { normalizeGuestInviteVenue } from '@/lib/wedding/wedding-guest-invite-venue'
import {
  buildWeddingPublicDescription,
  buildWeddingPublicJsonLd,
  weddingPublicOgImage,
} from '@/lib/wedding/wedding-public-seo'
import WeddingPublicClient from './wedding-public-client'

type Props = {
  params: { slug: string }
  searchParams?: { guest?: string; venue?: string }
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const path = `/thiep-moi-cuoi/${params.slug}`
  const personalized = Boolean(String(searchParams?.guest ?? '').trim())
  const card = await getPublishedWeddingCardBySlug(params.slug).catch(() => null)
  if (!card) {
    return buildMetadata({
      title: 'Thiệp mời cưới',
      description: 'Thiệp mời cưới online.',
      path,
      noIndex: true,
    })
  }
  const couple = `${card.groomName} & ${card.brideName}`.trim()
  return buildMetadata({
    title: `Thiệp mời cưới ${couple}`,
    description: buildWeddingPublicDescription(card),
    path,
    keywords: ['thiệp mời cưới', 'thiệp cưới online', 'thiệp cưới điện tử', card.groomName, card.brideName].filter(Boolean),
    ogImage: weddingPublicOgImage(card),
    noIndex: personalized,
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
  const jsonLd = buildWeddingPublicJsonLd(card, `${SITE_URL}/thiep-moi-cuoi/${card.slug}`)
  return (
    <>
      <JsonLd data={jsonLd} />
      <WeddingPublicClient
        card={card}
        wishes={wishes}
        images={images}
        initialGuestDisplayName={guestDisplayName}
        initialGuestInviteVenue={inviteVenue}
        initialPersonalInvite={personalInvite}
      />
    </>
  )
}
