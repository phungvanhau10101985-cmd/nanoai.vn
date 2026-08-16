import type { WeddingCard } from '@/lib/db/wedding-cards-pg'

export type WeddingPublicSeoCard = Pick<
  WeddingCard,
  | 'groomName'
  | 'brideName'
  | 'weddingDate'
  | 'weddingTime'
  | 'venue'
  | 'mapUrl'
  | 'invitationText'
  | 'masterImageUrl'
  | 'groomImageUrl'
  | 'brideImageUrl'
>

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/
const CLOCK_HH_MM = /^\d{2}:\d{2}$/

function weddingDateIso(raw: string | null | undefined): string | undefined {
  const s = String(raw || '').trim()
  return DATE_ISO.test(s) ? s : undefined
}

function weddingClockHhMm(raw: string): string {
  const match = String(raw || '').match(/\b(\d{1,2}):(\d{2})\b/)
  if (!match) return ''
  const hh = Number(match[1])
  const mm = Number(match[2])
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh > 23 || mm > 59) return ''
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function formatViDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  if (!year || !month || !day) return iso
  return `${day}/${month}/${year}`
}

export function weddingPlainText(raw: string, maxLen = 160): string {
  const text = String(raw || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return ''
  if (text.length <= maxLen) return text
  const cut = text.slice(0, Math.max(1, maxLen - 1))
  const sp = cut.lastIndexOf(' ')
  return `${(sp > 80 ? cut.slice(0, sp) : cut).trim()}…`
}

export function weddingPublicOgImage(
  card: Pick<WeddingPublicSeoCard, 'masterImageUrl' | 'groomImageUrl' | 'brideImageUrl'>,
): string | undefined {
  const candidates = [card.masterImageUrl, card.groomImageUrl, card.brideImageUrl]
  for (const raw of candidates) {
    const url = String(raw || '').trim()
    if (/^https?:\/\//i.test(url) || url.startsWith('/')) return url
  }
  return undefined
}

export function buildWeddingPublicDescription(
  card: Pick<WeddingPublicSeoCard, 'groomName' | 'brideName' | 'weddingDate' | 'venue' | 'invitationText'>,
): string {
  const fromInvite = weddingPlainText(card.invitationText, 140)
  if (fromInvite) return fromInvite
  const couple = `${card.groomName} và ${card.brideName}`.trim()
  const dateIso = weddingDateIso(card.weddingDate)
  const datePart = dateIso ? ` vào ${formatViDate(dateIso)}` : ''
  const venue = String(card.venue || '').trim()
  const venuePart = venue ? ` tại ${venue}` : ''
  return weddingPlainText(`Trân trọng kính mời bạn đến dự lễ cưới của ${couple}${datePart}${venuePart}.`, 160)
}

export function buildWeddingPublicJsonLd(card: WeddingPublicSeoCard, url: string): Record<string, unknown> {
  const name = `Lễ cưới ${card.groomName} & ${card.brideName}`.trim()
  const description = buildWeddingPublicDescription(card)
  const image = weddingPublicOgImage(card)
  const dateIso = weddingDateIso(card.weddingDate)
  const clock = weddingClockHhMm(card.weddingTime || '')
  const startDate = dateIso && CLOCK_HH_MM.test(clock) ? `${dateIso}T${clock}:00` : dateIso || undefined
  const venue = String(card.venue || '').trim()

  if (!startDate) {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: `Thiệp mời cưới ${card.groomName} & ${card.brideName}`.trim(),
      description,
      url,
      ...(image ? { primaryImageOfPage: { '@type': 'ImageObject', url: image } } : {}),
    }
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name,
    description,
    url,
    startDate,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    organizer: {
      '@type': 'Person',
      name: `${card.groomName} & ${card.brideName}`.trim(),
    },
    ...(image ? { image: [image] } : {}),
    ...(venue
      ? {
          location: {
            '@type': 'Place',
            name: venue,
            address: venue,
            ...(card.mapUrl?.trim() ? { hasMap: card.mapUrl.trim() } : {}),
          },
        }
      : {}),
  }
}
