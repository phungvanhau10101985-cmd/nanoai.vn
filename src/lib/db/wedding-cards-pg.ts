import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { weddingDateFromPg } from '@/lib/wedding/wedding-date-normalize'
import { normalizeGuestInviteVenue, type WeddingGuestInviteVenue } from '@/lib/wedding/wedding-guest-invite-venue'
import { normalizeGuestNameKey } from '@/lib/wedding/wedding-guest-invite-link'

export type WeddingCard = {
  id: string
  userId: string
  slug: string
  groomName: string
  brideName: string
  weddingDate: string | null
  weddingTime: string
  partyStartTime: string
  venue: string
  mapUrl: string
  invitationText: string
  invitationTextEn: string
  guestName: string
  guestInviteVenue: WeddingGuestInviteVenue
  storyText: string
  coupleIntro: string
  loveQuote: string
  eventTimeline: string
  dressCode: string
  thankYouText: string
  sectionConfig: string
  albumImageUrls: string[]
  groomParents: string
  brideParents: string
  groomHometown: string
  brideHometown: string
  groomInviteAddress: string
  groomInviteMapUrl: string
  groomInviteReceptionTime: string
  groomInvitePartyStartTime: string
  brideInviteAddress: string
  brideInviteMapUrl: string
  brideInviteReceptionTime: string
  brideInvitePartyStartTime: string
  groomInviteWeddingDate: string | null
  groomInviteText: string
  groomInviteTextEn: string
  groomInviteEventTimeline: string
  groomInviteDressCode: string
  groomInviteContact: string
  groomInviteCoverImageUrl: string
  groomInviteDefaultPersonalMessage: string
  groomInviteThankYouText: string
  brideInviteWeddingDate: string | null
  brideInviteText: string
  brideInviteTextEn: string
  brideInviteEventTimeline: string
  brideInviteDressCode: string
  brideInviteContact: string
  brideInviteCoverImageUrl: string
  brideInviteDefaultPersonalMessage: string
  brideInviteThankYouText: string
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
  effectsEnabled: boolean
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

export type WeddingInvitedGuestStatus = 'pending' | 'attending' | 'declined'

export type WeddingReminder = {
  id: string
  cardId: string
  guestEmail: string
  guestName: string
  inviteVenue: WeddingGuestInviteVenue
  daysBefore: number
  locale: string
  sentAt: string | null
  createdAt: string
}

export type WeddingReminderDueRow = WeddingReminder & {
  slug: string
  groomName: string
  brideName: string
  weddingDate: string | null
  groomInviteWeddingDate: string | null
  brideInviteWeddingDate: string | null
}

export type WeddingInvitedGuest = {
  id: string
  guestHonorific: string
  guestName: string
  inviteVenue: WeddingGuestInviteVenue
  personalInvite: string
  status: WeddingInvitedGuestStatus
  guestCount: number
  wishMessage: string
  notes: string
  createdAt: string
  updatedAt: string
}

export const WEDDING_IMAGE_TYPES = ['master', 'cover', 'invitation', 'event', 'rsvp', 'album', 'gift_qr', 'thanks'] as const
export type WeddingImageType = (typeof WEDDING_IMAGE_TYPES)[number]

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeGuestInviteVenueRow(raw: unknown): WeddingGuestInviteVenue {
  return normalizeGuestInviteVenue(raw)
}

function requirePg() {
  if (!isPgConfigured()) throw new Error('DATABASE_URL is not set')
}

async function ensureProfileAndCredits(userId: string): Promise<boolean> {
  if (!UUID_RE.test(userId)) return false
  try {
    await getPgPool().query(
      `insert into public.profiles (id, updated_at)
       values ($1::uuid, now())
       on conflict (id) do nothing`,
      [userId],
    )
    await getPgPool().query(
      `insert into public.credits (user_id, balance)
       values ($1::uuid, 0)
       on conflict (user_id) do nothing`,
      [userId],
    )
    return true
  } catch {
    return false
  }
}

export async function ensureWeddingCardOwnerProfile(userId: string, email?: string | null): Promise<string> {
  requirePg()
  const cleanUserId = userId.trim()
  if (await ensureProfileAndCredits(cleanUserId)) return cleanUserId

  const cleanEmail = String(email ?? '').trim().toLowerCase()
  if (cleanEmail) {
    const res = await getPgPool().query<{ id: string }>(
      `select (public.nanoai_ensure_user_by_email($1::text))::text as id`,
      [cleanEmail],
    )
    const canonicalId = String(res.rows[0]?.id ?? '').trim()
    if (await ensureProfileAndCredits(canonicalId)) return canonicalId
  }

  throw new Error('Không thể khởi tạo hồ sơ người dùng để tạo thiệp cưới.')
}

function mapCard(row: Record<string, unknown>): WeddingCard {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    slug: String(row.slug),
    groomName: String(row.groom_name ?? ''),
    brideName: String(row.bride_name ?? ''),
    weddingDate: weddingDateFromPg(row.wedding_date),
    weddingTime: String(row.wedding_time ?? ''),
    partyStartTime: String(row.party_start_time ?? ''),
    venue: String(row.venue ?? ''),
    mapUrl: String(row.map_url ?? ''),
    invitationText: String(row.invitation_text ?? ''),
    invitationTextEn: String(row.invitation_text_en ?? ''),
    guestName: String(row.guest_name ?? ''),
    guestInviteVenue: normalizeGuestInviteVenueRow(row.guest_invite_venue),
    storyText: String(row.story_text ?? ''),
    coupleIntro: String(row.couple_intro ?? ''),
    loveQuote: String(row.love_quote ?? ''),
    eventTimeline: String(row.event_timeline ?? ''),
    dressCode: String(row.dress_code ?? ''),
    thankYouText: String(row.thank_you_text ?? ''),
    sectionConfig:
      typeof row.section_config === 'string'
        ? String(row.section_config ?? '{}')
        : JSON.stringify(row.section_config ?? {}),
    albumImageUrls: Array.isArray(row.album_image_urls) ? row.album_image_urls.map(String) : [],
    groomParents: String(row.groom_parents ?? ''),
    brideParents: String(row.bride_parents ?? ''),
    groomHometown: String(row.groom_hometown ?? ''),
    brideHometown: String(row.bride_hometown ?? ''),
    groomInviteAddress: String(row.groom_invite_address ?? ''),
    groomInviteMapUrl: String(row.groom_invite_map_url ?? ''),
    groomInviteReceptionTime: String(row.groom_invite_reception_time ?? ''),
    groomInvitePartyStartTime: String(row.groom_invite_party_start_time ?? ''),
    brideInviteAddress: String(row.bride_invite_address ?? ''),
    brideInviteMapUrl: String(row.bride_invite_map_url ?? ''),
    brideInviteReceptionTime: String(row.bride_invite_reception_time ?? ''),
    brideInvitePartyStartTime: String(row.bride_invite_party_start_time ?? ''),
    groomInviteWeddingDate: weddingDateFromPg(row.groom_invite_wedding_date),
    groomInviteText: String(row.groom_invite_text ?? ''),
    groomInviteTextEn: String(row.groom_invite_text_en ?? ''),
    groomInviteEventTimeline: String(row.groom_invite_event_timeline ?? ''),
    groomInviteDressCode: String(row.groom_invite_dress_code ?? ''),
    groomInviteContact: String(row.groom_invite_contact ?? ''),
    groomInviteCoverImageUrl: String(row.groom_invite_cover_image_url ?? ''),
    groomInviteDefaultPersonalMessage: String(row.groom_invite_default_personal_message ?? ''),
    groomInviteThankYouText: String(row.groom_invite_thank_you_text ?? ''),
    brideInviteWeddingDate: weddingDateFromPg(row.bride_invite_wedding_date),
    brideInviteText: String(row.bride_invite_text ?? ''),
    brideInviteTextEn: String(row.bride_invite_text_en ?? ''),
    brideInviteEventTimeline: String(row.bride_invite_event_timeline ?? ''),
    brideInviteDressCode: String(row.bride_invite_dress_code ?? ''),
    brideInviteContact: String(row.bride_invite_contact ?? ''),
    brideInviteCoverImageUrl: String(row.bride_invite_cover_image_url ?? ''),
    brideInviteDefaultPersonalMessage: String(row.bride_invite_default_personal_message ?? ''),
    brideInviteThankYouText: String(row.bride_invite_thank_you_text ?? ''),
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
    effectsEnabled: row.effects_enabled == null ? true : Boolean(row.effects_enabled),
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
  partyStartTime: string
  venue: string
  mapUrl: string
  invitationText: string
  invitationTextEn: string
  guestName: string
  guestInviteVenue: WeddingGuestInviteVenue
  storyText: string
  coupleIntro: string
  loveQuote: string
  eventTimeline: string
  dressCode: string
  thankYouText: string
  sectionConfig: string
  albumImageUrls: string[]
  groomParents: string
  brideParents: string
  groomHometown: string
  brideHometown: string
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
  effectsEnabled: boolean
}): Promise<WeddingCard | null> {
  requirePg()
  const res = await getPgPool().query(
    `update public.wedding_cards
     set groom_name = $3,
         bride_name = $4,
         wedding_date = nullif($5, '')::date,
         wedding_time = $6,
         party_start_time = $7,
         venue = $8,
         map_url = $9,
         invitation_text = $10,
         invitation_text_en = $11,
         guest_name = $12,
         story_text = $13,
         couple_intro = $14,
         love_quote = $15,
         event_timeline = $16,
         dress_code = $17,
         thank_you_text = $18,
         section_config = coalesce(nullif($19, '')::jsonb, '{}'::jsonb),
         album_image_urls = $20::text[],
         groom_parents = $21,
         bride_parents = $22,
         groom_image_url = $23,
         bride_image_url = $24,
         music_url = $25,
         music_play_start_sec = $26::double precision,
         music_play_end_sec = $27::double precision,
         selected_style_id = $28,
         color_palette = $29,
         rsvp_enabled = $30,
         gift_qr_enabled = $31,
         gift_qr_image_url = $32,
         groom_gift_bank_id = $33,
         groom_gift_account_no = $34,
         groom_gift_account_name = $35,
         bride_gift_bank_id = $36,
         bride_gift_account_no = $37,
         bride_gift_account_name = $38,
         guest_invite_venue = $39,
         effects_enabled = $40,
         groom_hometown = $41,
         bride_hometown = $42,
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
      input.partyStartTime,
      input.venue,
      input.mapUrl,
      input.invitationText,
      input.invitationTextEn,
      input.guestName,
      input.storyText,
      input.coupleIntro,
      input.loveQuote,
      input.eventTimeline,
      input.dressCode,
      input.thankYouText,
      input.sectionConfig,
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
      normalizeGuestInviteVenue(input.guestInviteVenue),
      input.effectsEnabled,
      input.groomHometown,
      input.brideHometown,
    ]
  )
  return res.rows[0] ? mapCard(res.rows[0]) : null
}

export async function updateWeddingCardSideInviteSettings(input: {
  cardId: string
  userId: string
  groomInviteAddress: string
  groomInviteMapUrl: string
  groomInviteReceptionTime: string
  groomInvitePartyStartTime: string
  groomInviteWeddingDate: string
  groomInviteText: string
  groomInviteTextEn: string
  groomInviteEventTimeline: string
  groomInviteDressCode: string
  groomInviteContact: string
  groomInviteCoverImageUrl: string
  groomInviteDefaultPersonalMessage: string
  groomInviteThankYouText: string
  brideInviteAddress: string
  brideInviteMapUrl: string
  brideInviteReceptionTime: string
  brideInvitePartyStartTime: string
  brideInviteWeddingDate: string
  brideInviteText: string
  brideInviteTextEn: string
  brideInviteEventTimeline: string
  brideInviteDressCode: string
  brideInviteContact: string
  brideInviteCoverImageUrl: string
  brideInviteDefaultPersonalMessage: string
  brideInviteThankYouText: string
}): Promise<WeddingCard | null> {
  requirePg()
  const res = await getPgPool().query(
    `update public.wedding_cards
     set groom_invite_address = $3,
         groom_invite_map_url = $4,
         groom_invite_reception_time = $5,
         groom_invite_party_start_time = $6,
         groom_invite_wedding_date = nullif($7, '')::date,
         groom_invite_text = $8,
         groom_invite_text_en = $9,
         groom_invite_event_timeline = $10,
         groom_invite_dress_code = $11,
         groom_invite_contact = $12,
         groom_invite_cover_image_url = $13,
         groom_invite_default_personal_message = $14,
         groom_invite_thank_you_text = $15,
         bride_invite_address = $16,
         bride_invite_map_url = $17,
         bride_invite_reception_time = $18,
         bride_invite_party_start_time = $19,
         bride_invite_wedding_date = nullif($20, '')::date,
         bride_invite_text = $21,
         bride_invite_text_en = $22,
         bride_invite_event_timeline = $23,
         bride_invite_dress_code = $24,
         bride_invite_contact = $25,
         bride_invite_cover_image_url = $26,
         bride_invite_default_personal_message = $27,
         bride_invite_thank_you_text = $28,
         updated_at = timezone('utc'::text, now())
     where id = $1::uuid and user_id = $2::uuid
     returning *, (select image_url from public.wedding_card_ai_images where id = wedding_cards.master_image_id) as master_image_url`,
    [
      input.cardId,
      input.userId,
      input.groomInviteAddress.slice(0, 500),
      input.groomInviteMapUrl.slice(0, 500),
      input.groomInviteReceptionTime.slice(0, 80),
      input.groomInvitePartyStartTime.slice(0, 80),
      input.groomInviteWeddingDate.slice(0, 20),
      input.groomInviteText.slice(0, 4000),
      input.groomInviteTextEn.slice(0, 4000),
      input.groomInviteEventTimeline.slice(0, 4000),
      input.groomInviteDressCode.slice(0, 600),
      input.groomInviteContact.slice(0, 120),
      input.groomInviteCoverImageUrl.slice(0, 1000),
      input.groomInviteDefaultPersonalMessage.slice(0, 1000),
      input.groomInviteThankYouText.slice(0, 2000),
      input.brideInviteAddress.slice(0, 500),
      input.brideInviteMapUrl.slice(0, 500),
      input.brideInviteReceptionTime.slice(0, 80),
      input.brideInvitePartyStartTime.slice(0, 80),
      input.brideInviteWeddingDate.slice(0, 20),
      input.brideInviteText.slice(0, 4000),
      input.brideInviteTextEn.slice(0, 4000),
      input.brideInviteEventTimeline.slice(0, 4000),
      input.brideInviteDressCode.slice(0, 600),
      input.brideInviteContact.slice(0, 120),
      input.brideInviteCoverImageUrl.slice(0, 1000),
      input.brideInviteDefaultPersonalMessage.slice(0, 1000),
      input.brideInviteThankYouText.slice(0, 2000),
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

export async function listPublishedWeddingImages(cardId: string): Promise<WeddingAiImage[]> {
  requirePg()
  const res = await getPgPool().query(
    `select i.*
     from public.wedding_card_ai_images i
     join public.wedding_cards c on c.id = i.wedding_card_id
     where i.wedding_card_id = $1::uuid
       and i.status = 'completed'
       and c.is_published = true
     order by i.created_at desc`,
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

function mapInvitedGuest(row: Record<string, unknown>): WeddingInvitedGuest {
  const statusRaw = String(row.status ?? 'pending')
  const status: WeddingInvitedGuestStatus =
    statusRaw === 'attending' || statusRaw === 'declined' ? statusRaw : 'pending'
  return {
    id: String(row.id),
    guestHonorific: String(row.guest_honorific ?? ''),
    guestName: String(row.guest_name ?? ''),
    inviteVenue: normalizeGuestInviteVenueRow(row.invite_venue),
    personalInvite: String(row.personal_invite ?? ''),
    status,
    guestCount: Number(row.guest_count ?? 1),
    wishMessage: String(row.wish_message ?? ''),
    notes: String(row.notes ?? ''),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export async function listWeddingInvitedGuests(cardId: string, userId: string): Promise<WeddingInvitedGuest[]> {
  requirePg()
  const res = await getPgPool().query(
    `select g.*
     from public.wedding_card_invited_guests g
     join public.wedding_cards c on c.id = g.wedding_card_id
     where g.wedding_card_id = $1::uuid and c.user_id = $2::uuid
     order by g.created_at asc, g.guest_name asc`,
    [cardId, userId],
  )
  return res.rows.map(mapInvitedGuest)
}

export async function createWeddingInvitedGuest(input: {
  cardId: string
  userId: string
  guestHonorific: string
  guestName: string
  inviteVenue: WeddingGuestInviteVenue
  personalInvite: string
  status: WeddingInvitedGuestStatus
  guestCount: number
  wishMessage: string
  notes: string
}): Promise<WeddingInvitedGuest | null> {
  requirePg()
  const name = input.guestName.trim()
  if (!name) return null
  const res = await getPgPool().query(
    `insert into public.wedding_card_invited_guests (
       wedding_card_id, guest_honorific, guest_name, invite_venue, personal_invite, status, guest_count, wish_message, notes
     )
     select $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9
     from public.wedding_cards c
     where c.id = $1::uuid and c.user_id = $10::uuid
     returning *`,
    [
      input.cardId,
      input.guestHonorific.trim().slice(0, 80),
      name,
      normalizeGuestInviteVenue(input.inviteVenue),
      input.personalInvite,
      input.status,
      input.guestCount,
      input.wishMessage,
      input.notes,
      input.userId,
    ],
  )
  return res.rows[0] ? mapInvitedGuest(res.rows[0]) : null
}

export async function updateWeddingInvitedGuest(input: {
  guestId: string
  cardId: string
  userId: string
  guestHonorific: string
  guestName: string
  inviteVenue: WeddingGuestInviteVenue
  personalInvite: string
  status: WeddingInvitedGuestStatus
  guestCount: number
  wishMessage: string
  notes: string
}): Promise<WeddingInvitedGuest | null> {
  requirePg()
  const name = input.guestName.trim()
  if (!name) return null
  const res = await getPgPool().query(
    `update public.wedding_card_invited_guests g
     set guest_honorific = $4,
         guest_name = $5,
         invite_venue = $6,
         personal_invite = $7,
         status = $8,
         guest_count = $9,
         wish_message = $10,
         notes = $11,
         updated_at = timezone('utc'::text, now())
     from public.wedding_cards c
     where g.id = $1::uuid
       and g.wedding_card_id = $2::uuid
       and c.id = g.wedding_card_id
       and c.user_id = $3::uuid
     returning g.*`,
    [
      input.guestId,
      input.cardId,
      input.userId,
      input.guestHonorific.trim().slice(0, 80),
      name,
      normalizeGuestInviteVenue(input.inviteVenue),
      input.personalInvite,
      input.status,
      input.guestCount,
      input.wishMessage,
      input.notes,
    ],
  )
  return res.rows[0] ? mapInvitedGuest(res.rows[0]) : null
}

export async function deleteWeddingInvitedGuest(guestId: string, cardId: string, userId: string): Promise<boolean> {
  requirePg()
  const res = await getPgPool().query(
    `delete from public.wedding_card_invited_guests g
     using public.wedding_cards c
     where g.id = $1::uuid
       and g.wedding_card_id = $2::uuid
       and c.id = g.wedding_card_id
       and c.user_id = $3::uuid`,
    [guestId, cardId, userId],
  )
  return (res.rowCount ?? 0) > 0
}

/** Lấy lời mời cá nhân đã lưu cho khách trên thiệp đã xuất bản (theo tên hiển thị + venue). */
export async function getPublishedInvitedGuestPersonalInvite(input: {
  cardId: string
  guestDisplayName: string
  inviteVenue: WeddingGuestInviteVenue
}): Promise<string> {
  requirePg()
  const key = normalizeGuestNameKey(input.guestDisplayName)
  if (!key) return ''
  const venue = normalizeGuestInviteVenue(input.inviteVenue)
  const res = await getPgPool().query(
    `select g.personal_invite
     from public.wedding_card_invited_guests g
     join public.wedding_cards c on c.id = g.wedding_card_id
     where g.wedding_card_id = $1::uuid
       and c.is_published = true
       and lower(trim(regexp_replace(
         case when trim(coalesce(g.guest_honorific, '')) <> ''
           then trim(g.guest_honorific) || ' ' || trim(g.guest_name)
           else trim(g.guest_name)
         end,
         '\\s+', ' ', 'g'))) = $2
       and ($3 = '' or g.invite_venue = $3)
     order by g.updated_at desc
     limit 1`,
    [input.cardId, key, venue],
  )
  return String(res.rows[0]?.personal_invite ?? '').trim()
}

/** Cập nhật khách trong danh sách mời khi có RSVP trùng tên (nếu có). */
export async function syncInvitedGuestFromRsvp(input: {
  cardId: string
  guestName: string
  attending: boolean
  guestCount: number
  message: string
}) {
  requirePg()
  const key = normalizeGuestNameKey(input.guestName)
  if (!key) return
  await getPgPool().query(
    `update public.wedding_card_invited_guests g
     set status = $3,
         guest_count = $4,
         wish_message = case when $5 <> '' then $5 else g.wish_message end,
         updated_at = timezone('utc'::text, now())
     where g.wedding_card_id = $1::uuid
       and lower(trim(regexp_replace(
         case when trim(coalesce(g.guest_honorific, '')) <> ''
           then trim(g.guest_honorific) || ' ' || trim(g.guest_name)
           else trim(g.guest_name)
         end,
         '\\s+', ' ', 'g'))) = $2`,
    [
      input.cardId,
      key,
      input.attending ? 'attending' : 'declined',
      input.guestCount,
      input.message,
    ],
  )
}

function mapReminder(row: Record<string, unknown>): WeddingReminder {
  return {
    id: String(row.id),
    cardId: String(row.wedding_card_id),
    guestEmail: String(row.guest_email ?? ''),
    guestName: String(row.guest_name ?? ''),
    inviteVenue: normalizeGuestInviteVenue(row.invite_venue),
    daysBefore: Number(row.days_before ?? 1),
    locale: String(row.locale ?? 'vi'),
    sentAt: row.sent_at ? String(row.sent_at) : null,
    createdAt: String(row.created_at),
  }
}

export async function upsertWeddingReminder(input: {
  cardId: string
  guestEmail: string
  guestName: string
  inviteVenue: WeddingGuestInviteVenue
  daysBefore: number
  locale: string
}): Promise<WeddingReminder> {
  requirePg()
  const res = await getPgPool().query(
    `insert into public.wedding_card_reminders (
       wedding_card_id, guest_email, guest_name, invite_venue, days_before, locale
     )
     values ($1::uuid, $2, $3, $4, $5, $6)
     on conflict (wedding_card_id, guest_email, days_before)
       where sent_at is null
     do update set
       guest_name = excluded.guest_name,
       invite_venue = excluded.invite_venue,
       locale = excluded.locale
     returning *`,
    [
      input.cardId,
      input.guestEmail,
      input.guestName,
      input.inviteVenue,
      input.daysBefore,
      input.locale,
    ],
  )
  return mapReminder(res.rows[0])
}

export async function listWeddingRemindersDueToday(): Promise<WeddingReminderDueRow[]> {
  requirePg()
  const res = await getPgPool().query(
    `select r.*,
            c.slug,
            c.groom_name,
            c.bride_name,
            c.wedding_date,
            c.groom_invite_wedding_date,
            c.bride_invite_wedding_date
     from public.wedding_card_reminders r
     join public.wedding_cards c on c.id = r.wedding_card_id
     where r.sent_at is null
       and c.is_published = true
       and (
         case
           when r.invite_venue = 'groom_home' then coalesce(c.groom_invite_wedding_date, c.wedding_date)
           when r.invite_venue = 'bride_home' then coalesce(c.bride_invite_wedding_date, c.wedding_date)
           else c.wedding_date
         end
       ) is not null
       and (
         case
           when r.invite_venue = 'groom_home' then coalesce(c.groom_invite_wedding_date, c.wedding_date)
           when r.invite_venue = 'bride_home' then coalesce(c.bride_invite_wedding_date, c.wedding_date)
           else c.wedding_date
         end - r.days_before
       ) = current_date`,
  )
  return res.rows.map((row) => ({
    ...mapReminder(row),
    slug: String(row.slug ?? ''),
    groomName: String(row.groom_name ?? ''),
    brideName: String(row.bride_name ?? ''),
    weddingDate: weddingDateFromPg(row.wedding_date),
    groomInviteWeddingDate: weddingDateFromPg(row.groom_invite_wedding_date),
    brideInviteWeddingDate: weddingDateFromPg(row.bride_invite_wedding_date),
  }))
}

export async function markWeddingReminderSent(reminderId: string): Promise<void> {
  requirePg()
  await getPgPool().query(
    `update public.wedding_card_reminders
     set sent_at = timezone('utc'::text, now())
     where id = $1::uuid and sent_at is null`,
    [reminderId],
  )
}
