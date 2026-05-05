import { getPgPool, isPgConfigured } from '@/lib/db/pool'

export type WeddingCard = {
  id: string
  userId: string
  slug: string
  groomName: string
  brideName: string
  weddingDate: string | null
  weddingTime: string
  venue: string
  mapUrl: string
  invitationText: string
  invitationTextEn: string
  guestName: string
  storyText: string
  albumImageUrls: string[]
  groomParents: string
  brideParents: string
  groomImageUrl: string
  brideImageUrl: string
  musicUrl: string
  musicPlayStartSec: number | null
  musicPlayEndSec: number | null
  selectedStyleId: string
  colorPalette: string
  masterImageId: string | null
  rsvpEnabled: boolean
  giftQrEnabled: boolean
  giftQrImageUrl: string
  groomGiftBankId: string
  groomGiftAccountNo: string
  groomGiftAccountName: string
  brideGiftBankId: string
  brideGiftAccountNo: string
  brideGiftAccountName: string
  isPublished: boolean
  publishedAt: string | null
  masterImageUrl: string | null
}

export type WeddingAiImage = {
  id: string
  type: string
  prompt: string
  referenceImageId: string | null
  imageUrl: string
  creditCost: number
  status: string
  errorMessage: string
  createdAt: string
}

export type WeddingRsvp = {
  id: string
  guestName: string
  attending: boolean
  guestCount: number
  message: string
  createdAt: string
}

export type WeddingWish = {
  id: string
  guestName: string
  message: string
  isApproved: boolean
  createdAt: string
}

export const WEDDING_IMAGE_TYPES = ['master', 'cover', 'invitation', 'event', 'rsvp', 'album', 'gift_qr', 'thanks'] as const
export type WeddingImageType = (typeof WEDDING_IMAGE_TYPES)[number]

function requirePg() {
  if (!isPgConfigured()) throw new Error('DATABASE_URL is not set')
}

function mapCard(row: Record<string, unknown>): WeddingCard {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    slug: String(row.slug),
    groomName: String(row.groom_name ?? ''),
    brideName: String(row.bride_name ?? ''),
    weddingDate: row.wedding_date ? String(row.wedding_date).slice(0, 10) : null,
    weddingTime: String(row.wedding_time ?? ''),
    venue: String(row.venue ?? ''),
    mapUrl: String(row.map_url ?? ''),
    invitationText: String(row.invitation_text ?? ''),
    invitationTextEn: String(row.invitation_text_en ?? ''),
    guestName: String(row.guest_name ?? ''),
    storyText: String(row.story_text ?? ''),
    albumImageUrls: Array.isArray(row.album_image_urls) ? row.album_image_urls.map(String) : [],
    groomParents: String(row.groom_parents ?? ''),
    brideParents: String(row.bride_parents ?? ''),
    groomImageUrl: String(row.groom_image_url ?? ''),
    brideImageUrl: String(row.bride_image_url ?? ''),
    musicUrl: String(row.music_url ?? ''),
    ...(() => {
      let musicPlayStartSec =
        row.music_play_start_sec != null && Number.isFinite(Number(row.music_play_start_sec))
          ? Number(row.music_play_start_sec)
          : null
      const musicPlayEndSec =
        row.music_play_end_sec != null && Number.isFinite(Number(row.music_play_end_sec))
          ? Number(row.music_play_end_sec)
          : null
      if (musicPlayEndSec == null && musicPlayStartSec === 0) {
        musicPlayStartSec = null
      }
      return { musicPlayStartSec, musicPlayEndSec }
    })(),
    selectedStyleId: String(row.selected_style_id ?? 'luxury'),
    colorPalette: String(row.color_palette ?? ''),
    masterImageId: row.master_image_id ? String(row.master_image_id) : null,
    rsvpEnabled: Boolean(row.rsvp_enabled),
    giftQrEnabled: Boolean(row.gift_qr_enabled),
    giftQrImageUrl: String(row.gift_qr_image_url ?? ''),
    groomGiftBankId: String(row.groom_gift_bank_id ?? ''),
    groomGiftAccountNo: String(row.groom_gift_account_no ?? ''),
    groomGiftAccountName: String(row.groom_gift_account_name ?? ''),
    brideGiftBankId: String(row.bride_gift_bank_id ?? ''),
    brideGiftAccountNo: String(row.bride_gift_account_no ?? ''),
    brideGiftAccountName: String(row.bride_gift_account_name ?? ''),
    isPublished: Boolean(row.is_published),
    publishedAt: row.published_at ? String(row.published_at) : null,
    masterImageUrl: row.master_image_url ? String(row.master_image_url) : null,
  }
}

function mapImage(row: Record<string, unknown>): WeddingAiImage {
  return {
    id: String(row.id),
    type: String(row.type),
    prompt: String(row.prompt ?? ''),
    referenceImageId: row.reference_image_id ? String(row.reference_image_id) : null,
    imageUrl: String(row.image_url ?? ''),
    creditCost: Number(row.credit_cost ?? 1),
    status: String(row.status ?? 'processing'),
    errorMessage: String(row.error_message ?? ''),
    createdAt: String(row.created_at),
  }
}

export async function createWeddingCardDraft(userId: string, styleId = 'luxury'): Promise<WeddingCard> {
  requirePg()
  const slug = `thiep-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  const res = await getPgPool().query(
    `insert into public.wedding_cards (user_id, slug, selected_style_id)
     values ($1::uuid, $2, $3)
     returning *, null::text as master_image_url`,
    [userId, slug, styleId]
  )
  return mapCard(res.rows[0])
}

export async function getLatestWeddingCardForUser(userId: string): Promise<WeddingCard | null> {
  requirePg()
  const res = await getPgPool().query(
    `select c.*, i.image_url as master_image_url
     from public.wedding_cards c
     left join public.wedding_card_ai_images i on i.id = c.master_image_id
     where c.user_id = $1::uuid
     order by c.updated_at desc
     limit 1`,
    [userId]
  )
  return res.rows[0] ? mapCard(res.rows[0]) : null
}

export async function getWeddingCardForUser(cardId: string, userId: string): Promise<WeddingCard | null> {
  requirePg()
  const res = await getPgPool().query(
    `select c.*, i.image_url as master_image_url
     from public.wedding_cards c
     left join public.wedding_card_ai_images i on i.id = c.master_image_id
     where c.id = $1::uuid and c.user_id = $2::uuid
     limit 1`,
    [cardId, userId]
  )
  return res.rows[0] ? mapCard(res.rows[0]) : null
}

export async function getPublishedWeddingCardBySlug(slug: string): Promise<WeddingCard | null> {
  requirePg()
  const res = await getPgPool().query(
    `select c.*, i.image_url as master_image_url
     from public.wedding_cards c
     left join public.wedding_card_ai_images i on i.id = c.master_image_id
     where c.slug = $1 and c.is_published = true
     limit 1`,
    [slug]
  )
  return res.rows[0] ? mapCard(res.rows[0]) : null
}

export async function updateWeddingCardBrief(input: {
  cardId: string
  userId: string
  groomName: string
  brideName: string
  weddingDate: string
  weddingTime: string
  venue: string
  mapUrl: string
  invitationText: string
  invitationTextEn: string
  guestName: string
  storyText: string
  albumImageUrls: string[]
  groomParents: string
  brideParents: string
  groomImageUrl: string
  brideImageUrl: string
  musicUrl: string
  musicPlayStartSec: number | null
  musicPlayEndSec: number | null
  selectedStyleId: string
  colorPalette: string
  rsvpEnabled: boolean
  giftQrEnabled: boolean
  giftQrImageUrl: string
  groomGiftBankId: string
  groomGiftAccountNo: string
  groomGiftAccountName: string
  brideGiftBankId: string
  brideGiftAccountNo: string
  brideGiftAccountName: string
}): Promise<WeddingCard | null> {
  requirePg()
  const res = await getPgPool().query(
    `update public.wedding_cards
     set groom_name = $3,
         bride_name = $4,
         wedding_date = nullif($5, '')::date,
         wedding_time = $6,
         venue = $7,
         map_url = $8,
         invitation_text = $9,
         invitation_text_en = $10,
         guest_name = $11,
         story_text = $12,
         album_image_urls = $13::text[],
         groom_parents = $14,
         bride_parents = $15,
         groom_image_url = $16,
         bride_image_url = $17,
         music_url = $18,
         music_play_start_sec = $19::double precision,
         music_play_end_sec = $20::double precision,
         selected_style_id = $21,
         color_palette = $22,
         rsvp_enabled = $23,
         gift_qr_enabled = $24,
         gift_qr_image_url = $25,
         groom_gift_bank_id = $26,
         groom_gift_account_no = $27,
         groom_gift_account_name = $28,
         bride_gift_bank_id = $29,
         bride_gift_account_no = $30,
         bride_gift_account_name = $31,
         updated_at = timezone('utc'::text, now())
     where id = $1::uuid and user_id = $2::uuid
     returning *, (select image_url from public.wedding_card_ai_images where id = wedding_cards.master_image_id) as master_image_url`,
    [
      input.cardId,
      input.userId,
      input.groomName,
      input.brideName,
      input.weddingDate,
      input.weddingTime,
      input.venue,
      input.mapUrl,
      input.invitationText,
      input.invitationTextEn,
      input.guestName,
      input.storyText,
      input.albumImageUrls,
      input.groomParents,
      input.brideParents,
      input.groomImageUrl,
      input.brideImageUrl,
      input.musicUrl,
      input.musicPlayStartSec,
      input.musicPlayEndSec,
      input.selectedStyleId,
      input.colorPalette,
      input.rsvpEnabled,
      input.giftQrEnabled,
      input.giftQrImageUrl,
      input.groomGiftBankId,
      input.groomGiftAccountNo,
      input.groomGiftAccountName,
      input.brideGiftBankId,
      input.brideGiftAccountNo,
      input.brideGiftAccountName,
    ]
  )
  return res.rows[0] ? mapCard(res.rows[0]) : null
}

export async function insertWeddingAiImageProcessing(input: {
  userId: string
  cardId: string
  type: WeddingImageType
  prompt: string
  referenceImageId?: string | null
}): Promise<string> {
  requirePg()
  const res = await getPgPool().query<{ id: string }>(
    `insert into public.wedding_card_ai_images
       (user_id, wedding_card_id, type, prompt, reference_image_id, credit_cost, status)
     values ($1::uuid, $2::uuid, $3, $4, $5::uuid, 1, 'processing')
     returning id::text`,
    [input.userId, input.cardId, input.type, input.prompt, input.referenceImageId ?? null]
  )
  return res.rows[0].id
}

export async function completeWeddingAiImage(input: {
  imageId: string
  userId: string
  imageUrl: string
  makeMaster: boolean
}): Promise<void> {
  requirePg()
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `update public.wedding_card_ai_images
       set image_url = $3, status = 'completed', error_message = '', updated_at = timezone('utc'::text, now())
       where id = $1::uuid and user_id = $2::uuid`,
      [input.imageId, input.userId, input.imageUrl]
    )
    if (input.makeMaster) {
      await client.query(
        `update public.wedding_cards
         set master_image_id = $1::uuid, updated_at = timezone('utc'::text, now())
         where id = (select wedding_card_id from public.wedding_card_ai_images where id = $1::uuid) and user_id = $2::uuid`,
        [input.imageId, input.userId]
      )
    }
    await client.query(
      `insert into public.transactions (user_id, amount, type, status, description)
       values ($1::uuid, 1, 'usage', 'completed', $2)`,
      [input.userId, 'Tạo ảnh AI cho thiệp mời cưới']
    )
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw e
  } finally {
    client.release()
  }
}

export async function failWeddingAiImage(imageId: string, userId: string, message: string): Promise<void> {
  requirePg()
  await getPgPool().query(
    `update public.wedding_card_ai_images
     set status = 'failed', error_message = $3, updated_at = timezone('utc'::text, now())
     where id = $1::uuid and user_id = $2::uuid`,
    [imageId, userId, message.slice(0, 1000)]
  )
}

export async function listWeddingImages(cardId: string): Promise<WeddingAiImage[]> {
  requirePg()
  const res = await getPgPool().query(
    `select * from public.wedding_card_ai_images
     where wedding_card_id = $1::uuid
     order by created_at desc`,
    [cardId]
  )
  return res.rows.map(mapImage)
}

export async function publishWeddingCard(cardId: string, userId: string): Promise<WeddingCard | null> {
  requirePg()
  const res = await getPgPool().query(
    `update public.wedding_cards
     set is_published = true,
         published_at = coalesce(published_at, timezone('utc'::text, now())),
         updated_at = timezone('utc'::text, now())
     where id = $1::uuid and user_id = $2::uuid
     returning *, (select image_url from public.wedding_card_ai_images where id = wedding_cards.master_image_id) as master_image_url`,
    [cardId, userId]
  )
  return res.rows[0] ? mapCard(res.rows[0]) : null
}

export async function createWeddingRsvp(input: {
  cardId: string
  guestName: string
  attending: boolean
  guestCount: number
  message: string
}) {
  requirePg()
  await getPgPool().query(
    `insert into public.wedding_card_rsvps (wedding_card_id, guest_name, attending, guest_count, message)
     values ($1::uuid, $2, $3, $4, $5)`,
    [input.cardId, input.guestName, input.attending, input.guestCount, input.message]
  )
}

export async function createWeddingWish(input: { cardId: string; guestName: string; message: string }) {
  requirePg()
  await getPgPool().query(
    `insert into public.wedding_card_wishes (wedding_card_id, guest_name, message)
     values ($1::uuid, $2, $3)`,
    [input.cardId, input.guestName, input.message]
  )
}

export async function listWeddingRsvps(cardId: string, userId: string): Promise<WeddingRsvp[]> {
  requirePg()
  const res = await getPgPool().query(
    `select r.*
     from public.wedding_card_rsvps r
     join public.wedding_cards c on c.id = r.wedding_card_id
     where r.wedding_card_id = $1::uuid and c.user_id = $2::uuid
     order by r.created_at desc`,
    [cardId, userId]
  )
  return res.rows.map((row) => ({
    id: String(row.id),
    guestName: String(row.guest_name ?? ''),
    attending: Boolean(row.attending),
    guestCount: Number(row.guest_count ?? 0),
    message: String(row.message ?? ''),
    createdAt: String(row.created_at),
  }))
}

export async function listPublishedWeddingWishes(cardId: string): Promise<WeddingWish[]> {
  requirePg()
  const res = await getPgPool().query(
    `select *
     from public.wedding_card_wishes
     where wedding_card_id = $1::uuid and is_approved = true
     order by created_at desc
     limit 50`,
    [cardId]
  )
  return res.rows.map((row) => ({
    id: String(row.id),
    guestName: String(row.guest_name ?? ''),
    message: String(row.message ?? ''),
    isApproved: Boolean(row.is_approved),
    createdAt: String(row.created_at),
  }))
}
