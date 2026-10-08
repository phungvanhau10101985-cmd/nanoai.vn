import { pgQueryOne } from '@/lib/db/pg-query'
import { deliverUserNotificationPg } from '@/lib/notifications/deliver-user-notification-pg'
import { weddingDateFromPg } from '@/lib/wedding/wedding-date-normalize'
import {
  latestWeddingCeremonyIso,
  weddingCardExpiredBody,
  weddingGuestPackPurchaseBody,
} from '@/lib/wedding/wedding-card-retention'

const CARD_HREF = '/tao-thiep-moi-cuoi-ai'

async function loadCardNotice(cardId: string, userId: string) {
  const row = await pgQueryOne<{
    groom_name: string | null
    bride_name: string | null
    wedding_date: unknown
    groom_invite_wedding_date: unknown
    bride_invite_wedding_date: unknown
  }>(
    `select groom_name, bride_name, wedding_date, groom_invite_wedding_date, bride_invite_wedding_date
     from public.wedding_cards
     where id = $1::uuid and user_id = $2::uuid
     limit 1`,
    [cardId, userId],
  )
  return {
    groomName: row?.groom_name ?? '',
    brideName: row?.bride_name ?? '',
    ceremonyIso: latestWeddingCeremonyIso([
      weddingDateFromPg(row?.wedding_date),
      weddingDateFromPg(row?.groom_invite_wedding_date),
      weddingDateFromPg(row?.bride_invite_wedding_date),
    ]),
  }
}

export async function notifyWeddingGuestPackPurchased(input: {
  userId: string
  cardId: string
  side?: 'groom' | 'bride'
}): Promise<void> {
  const card = await loadCardNotice(input.cardId, input.userId)
  const sideLabel = input.side === 'bride' ? 'nhà gái' : input.side === 'groom' ? 'nhà trai' : ''
  await deliverUserNotificationPg({
    user_id: input.userId,
    type: 'wedding_guest_pack',
    title: sideLabel ? `Đã mở gói khách mời ${sideLabel}` : 'Đã mở gói khách mời',
    body: weddingGuestPackPurchaseBody(card),
    meta: {
      push_url: CARD_HREF,
      wedding_card_id: input.cardId,
    },
  })
}

export async function notifyWeddingCardExpired(input: {
  userId: string
  cardId: string
  groomName: string
  brideName: string
  ceremonyIso: string | null
}): Promise<void> {
  await deliverUserNotificationPg({
    user_id: input.userId,
    type: 'wedding_card_expired',
    title: 'Thiệp đã được gỡ',
    body: weddingCardExpiredBody(input),
    meta: {
      push_url: CARD_HREF,
      wedding_card_id: input.cardId,
    },
  })
}
