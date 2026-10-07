import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { JsonLd } from '@/components/seo-json-ld'
import { buildMetadata, SITE_URL } from '@/lib/seo'
import {
  getPublishedInvitedGuestPersonalInvite,
  getPublishedInvitedGuestRsvp,
  getPublishedWeddingCardBySlug,
  listPublishedSideGuestWishes,
} from '@/lib/db/wedding-cards-pg'
import { normalizeGuestInviteVenue } from '@/lib/wedding/wedding-guest-invite-venue'
import { invitationOccasionShape, invitationSeoCopy, normalizeInvitationOccasion } from '@/lib/wedding/invitation-occasion'
import { buildWeddingPublicDescription, buildWeddingPublicJsonLd, buildWeddingPublicTitle } from '@/lib/wedding/wedding-public-seo'
import { weddingPublicShareImageUrl } from '@/lib/wedding/wedding-share-preview'
import WeddingPublicClient from './wedding-public-client'

type Props = {
  params: { slug: string }
  searchParams?: { guest?: string; venue?: string; view?: string }
}

function letterViewFromSearch(viewRaw: string | undefined, venue: ReturnType<typeof normalizeGuestInviteVenue>) {
  if (venue === 'groom_home') return 'groom' as const
  if (venue === 'bride_home') return 'bride' as const
  const view = String(viewRaw ?? '').trim().toLowerCase()
  if (view === 'groom' || view === 'nha-trai') return 'groom' as const
  if (view === 'bride' || view === 'nha-gai') return 'bride' as const
  return null
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
  return buildMetadata({
    title: buildWeddingPublicTitle(card),
    description: buildWeddingPublicDescription(card),
    path,
    keywords: (normalizeInvitationOccasion(card.occasionKey) === 'wedding'
      ? ['thiệp mời cưới', 'thiệp cưới online', 'thiệp cưới điện tử', card.groomName, card.brideName]
      : [invitationSeoCopy(card.occasionKey).title, card.groomName, card.brideName]
    ).filter(Boolean),
    ogImage: weddingPublicShareImageUrl(SITE_URL, card, searchParams?.guest),
    noIndex: personalized,
  })
}

export default async function WeddingPublicPage({ params, searchParams }: Props) {
  const card = await getPublishedWeddingCardBySlug(params.slug).catch(() => null)
  if (!card) notFound()
  const guestDisplayName = String(searchParams?.guest ?? '').trim()
  const inviteVenue = normalizeGuestInviteVenue(searchParams?.venue)
  const letterView = letterViewFromSearch(searchParams?.view, inviteVenue)
  const singleOccasion = invitationOccasionShape(card.occasionKey) === 'single'
  const displayVenue =
    inviteVenue || (letterView === 'groom' ? 'groom_home' : letterView === 'bride' ? 'bride_home' : '')
  const personalInvite =
    guestDisplayName && inviteVenue
      ? await getPublishedInvitedGuestPersonalInvite({
          cardId: card.id,
          guestDisplayName,
          inviteVenue,
        }).catch(() => '')
      : ''
  const guestRsvp = guestDisplayName
    ? await getPublishedInvitedGuestRsvp({
        cardId: card.id,
        guestDisplayName,
        inviteVenue,
      }).catch(() => null)
    : null
  const sideWishes = await listPublishedSideGuestWishes(card.id)
  const jsonLd = buildWeddingPublicJsonLd(card, `${SITE_URL}/thiep-moi-cuoi/${card.slug}`)
  return (
    <>
      <JsonLd data={jsonLd} />
      <WeddingPublicClient
        card={card}
        sideWishes={sideWishes}
        initialGuestDisplayName={guestDisplayName}
        initialGuestInviteVenue={displayVenue}
        initialLetterView={singleOccasion ? 'groom' : letterView ?? 'groom'}
        askLetterView={!singleOccasion && letterView == null}
        initialPersonalInvite={personalInvite}
        initialGuestRsvp={guestRsvp}
      />
    </>
  )
}
