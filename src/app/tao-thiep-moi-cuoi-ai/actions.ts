'use server'

import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai'
import { getUserForCreditAction } from '@/lib/auth'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import { GEMINI_3_PRO_IMAGE } from '@/lib/gemini-config'
import { ensureBunnyWritableBeforeImageModel } from '@/lib/storage/partner-bunny-cdn'
import {
  attachWeddingLibraryBackground,
  attachWeddingPrivateBackground,
  completeWeddingAiImage,
  createWeddingCardDraft,
  deleteWeddingCardForUser,
  ensureWeddingCardOwnerProfile,
  failWeddingAiImage,
  getLatestWeddingCardForUser,
  getWeddingCardForUser,
  listWeddingCardSummariesForUser,
  saveWeddingCardSectionConfig,
  insertWeddingAiImageProcessing,
  listWeddingBackgroundLibrary,
  listWeddingCoverFrameLibrary,
  listWeddingImages,
  listWeddingMusicLibrary,
  listWeddingRsvps,
  saveWeddingBackgroundToLibrary,
  saveWeddingCoverFrameToLibrary,
  saveWeddingMusicToLibrary,
  weddingMusicLibraryHasUrl,
  publishWeddingCard,
  updateWeddingCardBrief,
  updateWeddingCardSideInviteSettings,
  type WeddingCard,
  type WeddingImageType,
} from '@/lib/db/wedding-cards-pg'
import { deductUserCredits, refundUserCredits } from '@/lib/music/deduct-user-credits'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { buildWeddingPrompt } from '@/lib/wedding/build-wedding-image-prompt'
import { buildWeddingCoverFramePrompt, readWeddingCoverFrameOpening } from '@/lib/wedding/build-wedding-cover-frame-prompt'
import { measureCoverFrameHole } from '@/lib/wedding/measure-cover-frame-hole'
import { getWeddingStylePreset } from '@/lib/wedding/wedding-style-presets'
import {
  chargedCreditsForLogoCreate,
  requiredCreditsForLogoCreate,
  stripLogoBackgroundToTransparentPng,
} from '@/lib/remove-background-png'
import { parseWeddingMusicTimeToSeconds } from '@/lib/wedding/parse-music-play-time'
import { isWeddingMusicSeedUrl, weddingMusicTitleFromFileName } from '@/lib/wedding/wedding-music-library'
import { normalizeWeddingDateToIso } from '@/lib/wedding/wedding-date-normalize'
import { normalizeGuestInviteVenue } from '@/lib/wedding/wedding-guest-invite-venue'
import { normalizeInvitationOccasion } from '@/lib/wedding/invitation-occasion'
import { mergeWeddingSectionConfig, parseWeddingSectionConfig } from '@/lib/wedding/wedding-section-config'
import { requireGoogleApiKeyForUser } from '@/lib/ai/google-api-key-resolver'
import {
  isWeddingPolishField,
  polishWeddingTextWithDeepseek,
  type WeddingPolishField,
} from '@/lib/wedding/wedding-text-polish-deepseek'
import {
  WEDDING_TEXT_POLISH_CREDIT,
  weddingPolishFieldCostsCredit,
} from '@/lib/wedding/wedding-text-polish-credit'

const COST = 1
const MAX_TEXT = 2000

function clean(value: FormDataEntryValue | null, max = 300): string {
  return String(value ?? '').trim().slice(0, max)
}

function boolValue(value: FormDataEntryValue | null): boolean {
  return value === 'true' || value === 'on' || value === '1'
}

async function uploadWeddingReferenceImage(
  userId: string,
  cardId: string,
  role: 'groom' | 'bride' | 'cover',
  file: FormDataEntryValue | null,
) {
  if (!(file instanceof File) || file.size <= 0) return null
  if (!file.type.startsWith('image/')) {
    const roleLabel = role === 'groom' ? 'chú rể' : role === 'bride' ? 'cô dâu' : 'vỏ thiệp'
    throw new Error(`Ảnh ${roleLabel} phải là file ảnh hợp lệ.`)
  }
  const ext = file.type.includes('jpeg') || file.type.includes('jpg') ? 'jpg' : 'png'
  const path = `uploads/${userId}/wedding_${cardId}_${role}_${Date.now()}.${ext}`
  const { publicUrl } = await uploadTryOnImagePublic(path, file, { contentType: file.type || 'image/png', upsert: true })
  return publicUrl
}

async function uploadWeddingMusic(userId: string, cardId: string, file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size <= 0) return null
  if (!file.type.startsWith('audio/')) throw new Error('File nhạc phải là audio hợp lệ.')
  const ext = file.type.includes('mpeg') || file.type.includes('mp3') ? 'mp3' : file.type.includes('wav') ? 'wav' : 'm4a'
  const path = `uploads/${userId}/wedding_${cardId}_music_${Date.now()}.${ext}`
  const { publicUrl } = await uploadTryOnImagePublic(path, file, { contentType: file.type || 'audio/mpeg', upsert: true })
  return publicUrl
}

async function uploadWeddingAlbumImages(userId: string, cardId: string, files: FormDataEntryValue[]) {
  const urls: string[] = []
  for (const [index, file] of files.entries()) {
    if (!(file instanceof File) || file.size <= 0) continue
    if (!file.type.startsWith('image/')) throw new Error('Ảnh album phải là file ảnh hợp lệ.')
    const ext = file.type.includes('jpeg') || file.type.includes('jpg') ? 'jpg' : 'png'
    const path = `uploads/${userId}/wedding_${cardId}_album_${Date.now()}_${index}.${ext}`
    const { publicUrl } = await uploadTryOnImagePublic(path, file, { contentType: file.type || 'image/png', upsert: true })
    urls.push(publicUrl)
  }
  return urls
}

async function getReferenceImagePart(referenceUrl: string | null) {
  if (!referenceUrl) return null
  const res = await fetch(referenceUrl)
  if (!res.ok) return null
  const contentType = res.headers.get('content-type') || 'image/png'
  const buffer = Buffer.from(await res.arrayBuffer())
  return { inlineData: { data: buffer.toString('base64'), mimeType: contentType } }
}

async function getReferenceImagePartFromFile(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size <= 0) return null
  if (!file.type.startsWith('image/')) {
    throw new Error('Ảnh tham khảo tùy chỉnh phải là file ảnh hợp lệ.')
  }
  const buffer = Buffer.from(await file.arrayBuffer())
  return { inlineData: { data: buffer.toString('base64'), mimeType: file.type || 'image/png' } }
}

async function weddingCardWorkspace(ownerUserId: string, card: WeddingCard) {
  const [images, rsvps, library, frameLibrary, musicLibrary, cards] = await Promise.all([
    listWeddingImages(card.id),
    listWeddingRsvps(card.id, ownerUserId),
    listWeddingBackgroundLibrary(),
    listWeddingCoverFrameLibrary(),
    listWeddingMusicLibrary(),
    listWeddingCardSummariesForUser(ownerUserId),
  ])
  return { card, images, rsvps, library, frameLibrary, musicLibrary, cards }
}

export async function loadWeddingCardWorkspace(cardId?: string) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const ownerUserId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const requested = String(cardId || '').trim()
  let card = requested ? await getWeddingCardForUser(requested, ownerUserId) : null
  if (!card) card = await getLatestWeddingCardForUser(ownerUserId)
  if (!card) card = await createWeddingCardDraft(ownerUserId)
  return weddingCardWorkspace(ownerUserId, card)
}

export async function getOrCreateWeddingCard() {
  return loadWeddingCardWorkspace()
}

export async function createNewWeddingCard(occasionKey?: string) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const ownerUserId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const card = await createWeddingCardDraft(ownerUserId, 'luxury', occasionKey)
  return weddingCardWorkspace(ownerUserId, card)
}

export async function deleteWeddingCard(cardId: string) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const ownerUserId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const existing = await getWeddingCardForUser(cardId, ownerUserId)
  if (!existing) return { error: 'Không tìm thấy thiệp.' }
  const deleted = await deleteWeddingCardForUser(cardId, ownerUserId)
  if (!deleted) return { error: 'Không xóa được thiệp.' }
  if (existing.slug) revalidatePath(`/thiep-moi-cuoi/${existing.slug}`)
  const cards = await listWeddingCardSummariesForUser(ownerUserId)
  return { cards }
}

export async function saveWeddingCardBrief(formData: FormData) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const ownerUserId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const cardId = clean(formData.get('cardId'), 80)
  const existing = await getWeddingCardForUser(cardId, ownerUserId)
  if (!existing) return { error: 'Không tìm thấy thiệp.' }
  let groomImageUrl = clean(formData.get('groomImageUrl'), 1000) || existing.groomImageUrl
  let brideImageUrl = clean(formData.get('brideImageUrl'), 1000) || existing.brideImageUrl
  let musicUrl = existing.musicUrl
  const albumField = formData.get('albumImageUrls')
  let albumImageUrls =
    typeof albumField === 'string'
      ? clean(albumField, 5000)
          .split('\n')
          .map((url) => url.trim())
          .filter(Boolean)
      : existing.albumImageUrls
  let uploadedCover: string | null = null
  try {
    uploadedCover = await uploadWeddingReferenceImage(ownerUserId, cardId, 'cover', formData.get('coverImage'))
    const uploadedGroom = await uploadWeddingReferenceImage(ownerUserId, cardId, 'groom', formData.get('groomImage'))
    const uploadedBride = await uploadWeddingReferenceImage(ownerUserId, cardId, 'bride', formData.get('brideImage'))
    if (uploadedGroom) groomImageUrl = uploadedGroom
    else if (boolValue(formData.get('groomImageClear'))) groomImageUrl = ''
    if (uploadedBride) brideImageUrl = uploadedBride
    else if (boolValue(formData.get('brideImageClear'))) brideImageUrl = ''
    const uploadedFile = formData.get('musicFile')
    const uploadedMusic = await uploadWeddingMusic(ownerUserId, cardId, uploadedFile)
    if (uploadedMusic) {
      musicUrl = uploadedMusic
      const rawTitle = clean(formData.get('musicTitle'), 120)
      const title = weddingMusicTitleFromFileName(
        rawTitle || (uploadedFile instanceof File ? uploadedFile.name : 'Nhạc thiệp'),
      )
      await saveWeddingMusicToLibrary({ title, audioUrl: uploadedMusic })
    } else if (boolValue(formData.get('musicClear'))) {
      musicUrl = ''
    } else {
      const libraryPick = clean(formData.get('musicLibraryUrl'), 2000)
      if (libraryPick && (isWeddingMusicSeedUrl(libraryPick) || (await weddingMusicLibraryHasUrl(libraryPick)))) {
        musicUrl = libraryPick
      }
    }
    const uploadedAlbum = await uploadWeddingAlbumImages(ownerUserId, cardId, formData.getAll('albumImages'))
    albumImageUrls = [...albumImageUrls, ...uploadedAlbum].slice(0, 30)
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
  const musicPlayStartRaw = parseWeddingMusicTimeToSeconds(String(formData.get('musicPlayStartSec') ?? ''))
  const musicPlayEndRaw = parseWeddingMusicTimeToSeconds(String(formData.get('musicPlayEndSec') ?? ''))
  let musicPlayStartSec: number | null = musicPlayStartRaw
  let musicPlayEndSec: number | null = musicPlayEndRaw
  if (!musicUrl || boolValue(formData.get('musicClear'))) {
    musicPlayStartSec = null
    musicPlayEndSec = null
  } else if (musicPlayStartSec != null && musicPlayEndSec != null && musicPlayEndSec <= musicPlayStartSec) {
    musicPlayEndSec = null
  }
  // Không chọn đoạn: chỉ có 0 (= đầu file) và không có điểm kết thúc → giống để trống (phát nguyên bản cả bài).
  if (
    musicUrl &&
    !boolValue(formData.get('musicClear')) &&
    musicPlayEndSec == null &&
    musicPlayStartSec === 0
  ) {
    musicPlayStartSec = null
  }

  const giftQrEnabled = boolValue(formData.get('giftQrEnabled'))
  const giftQrImageUrl = clean(formData.get('giftQrImageUrl'), 1000)
  const groomGiftBankId = clean(formData.get('groomGiftBankId'), 32)
  const groomGiftAccountNo = clean(formData.get('groomGiftAccountNo'), 40)
  const groomGiftAccountName = clean(formData.get('groomGiftAccountName'), 120)
  const brideGiftBankId = clean(formData.get('brideGiftBankId'), 32)
  const brideGiftAccountNo = clean(formData.get('brideGiftAccountNo'), 40)
  const brideGiftAccountName = clean(formData.get('brideGiftAccountName'), 120)

  let sectionConfig = clean(formData.get('sectionConfig'), 8000) || '{}'
  if (uploadedCover) {
    sectionConfig = mergeWeddingSectionConfig(sectionConfig, { coverPhotoUrl: uploadedCover })
  } else if (boolValue(formData.get('coverClear'))) {
    sectionConfig = mergeWeddingSectionConfig(sectionConfig, { coverPhotoUrl: '' })
  } else {
    const parsedSection = parseWeddingSectionConfig(sectionConfig)
    sectionConfig = mergeWeddingSectionConfig(existing.sectionConfig, parsedSection)
  }

  const draftForGift: Parameters<typeof updateWeddingCardBrief>[0] = {
    cardId,
    userId: ownerUserId,
    groomName: clean(formData.get('groomName')),
    brideName: clean(formData.get('brideName')),
    weddingDate: normalizeWeddingDateToIso(clean(formData.get('weddingDate'), 120)),
    weddingTime: clean(formData.get('weddingTime'), 80),
    partyStartTime: clean(formData.get('partyStartTime'), 80),
    venue: clean(formData.get('venue'), 500),
    mapUrl: clean(formData.get('mapUrl'), 1000),
    invitationText: clean(formData.get('invitationText'), MAX_TEXT),
    invitationTextEn: clean(formData.get('invitationTextEn'), MAX_TEXT),
    guestName: clean(formData.get('guestName'), 200),
    guestInviteVenue: normalizeGuestInviteVenue(formData.get('guestInviteVenue')),
    storyText: clean(formData.get('storyText'), MAX_TEXT),
    coupleIntro: clean(formData.get('coupleIntro'), MAX_TEXT),
    loveQuote: clean(formData.get('loveQuote'), 600),
    eventTimeline: clean(formData.get('eventTimeline'), MAX_TEXT),
    dressCode: clean(formData.get('dressCode'), 600),
    thankYouText: clean(formData.get('thankYouText'), MAX_TEXT),
    sectionConfig,
    albumImageUrls,
    groomParents: clean(formData.get('groomParents'), 500),
    brideParents: clean(formData.get('brideParents'), 500),
    groomHometown: clean(formData.get('groomHometown'), 500),
    brideHometown: clean(formData.get('brideHometown'), 500),
    groomImageUrl,
    brideImageUrl,
    musicUrl,
    musicPlayStartSec,
    musicPlayEndSec,
    selectedStyleId: clean(formData.get('selectedStyleId'), 80) || 'luxury',
    colorPalette: clean(formData.get('colorPalette'), 200),
    rsvpEnabled: boolValue(formData.get('rsvpEnabled')),
    giftQrEnabled,
    giftQrImageUrl,
    groomGiftBankId,
    groomGiftAccountNo,
    groomGiftAccountName,
    brideGiftBankId,
    brideGiftAccountNo,
    brideGiftAccountName,
    effectsEnabled: formData.has('effectsEnabled') ? boolValue(formData.get('effectsEnabled')) : true,
    occasionKey: normalizeInvitationOccasion(formData.get('occasionKey') ?? existing.occasionKey),
  }

  const briefCard = await updateWeddingCardBrief(draftForGift)
  if (!briefCard) return { error: 'Không tìm thấy thiệp.' }
  const card = formData.has('groomInviteAddress')
    ? await updateWeddingCardSideInviteSettings({
        cardId,
        userId: ownerUserId,
        groomInviteAddress: clean(formData.get('groomInviteAddress'), 500),
        groomInviteMapUrl: clean(formData.get('groomInviteMapUrl'), 500),
        groomInviteReceptionTime: clean(formData.get('groomInviteReceptionTime'), 80),
        groomInvitePartyStartTime: clean(formData.get('groomInvitePartyStartTime'), 80),
        groomInviteWeddingDate: clean(formData.get('groomInviteWeddingDate'), 20),
        groomInviteText: clean(formData.get('groomInviteText'), 4000),
        groomInviteTextEn: clean(formData.get('groomInviteTextEn'), 4000),
        groomInviteEventTimeline: clean(formData.get('groomInviteEventTimeline'), 4000),
        groomInviteDressCode: clean(formData.get('groomInviteDressCode'), 600),
        groomInviteContact: clean(formData.get('groomInviteContact'), 120),
        groomInviteCoverImageUrl: clean(formData.get('groomInviteCoverImageUrl'), 1000),
        groomInviteDefaultPersonalMessage: clean(formData.get('groomInviteDefaultPersonalMessage'), 1000),
        groomInviteThankYouText: clean(formData.get('groomInviteThankYouText'), 2000),
        brideInviteAddress: clean(formData.get('brideInviteAddress'), 500),
        brideInviteMapUrl: clean(formData.get('brideInviteMapUrl'), 500),
        brideInviteReceptionTime: clean(formData.get('brideInviteReceptionTime'), 80),
        brideInvitePartyStartTime: clean(formData.get('brideInvitePartyStartTime'), 80),
        brideInviteWeddingDate: clean(formData.get('brideInviteWeddingDate'), 20),
        brideInviteText: clean(formData.get('brideInviteText'), 4000),
        brideInviteTextEn: clean(formData.get('brideInviteTextEn'), 4000),
        brideInviteEventTimeline: clean(formData.get('brideInviteEventTimeline'), 4000),
        brideInviteDressCode: clean(formData.get('brideInviteDressCode'), 600),
        brideInviteContact: clean(formData.get('brideInviteContact'), 120),
        brideInviteCoverImageUrl: clean(formData.get('brideInviteCoverImageUrl'), 1000),
        brideInviteDefaultPersonalMessage: clean(formData.get('brideInviteDefaultPersonalMessage'), 1000),
        brideInviteThankYouText: clean(formData.get('brideInviteThankYouText'), 2000),
        groomParents: briefCard.groomParents,
        brideParents: briefCard.brideParents,
      })
    : briefCard
  if (!card) return { error: 'Không lưu được phần nhà trai / nhà gái.' }
  revalidatePath('/tao-thiep-moi-cuoi-ai')
  revalidatePath('/tao-thiep-moi-cuoi-ai/khach-moi')
  revalidatePath(`/thiep-moi-cuoi/${card.slug}`)
  const musicLibrary = await listWeddingMusicLibrary()
  return { card, musicLibrary }
}

export async function generateWeddingCardImage(formData: FormData) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const userId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const cardId = clean(formData.get('cardId'), 80)
  const typeRaw = clean(formData.get('type'), 40) as WeddingImageType
  if (typeRaw !== 'master') return { error: 'Chỉ tạo một ảnh nền chính cho cả thiệp.' }
  const type = 'master' as const
  const extraPrompt = clean(formData.get('extraPrompt'), 800)
  const customReferenceImageUrl = clean(formData.get('customReferenceImageUrl'), 1000)
  const customReferenceImageFile = formData.get('customReferenceImage')
  const card = await getWeddingCardForUser(cardId, userId)
  if (!card) return { error: 'Không tìm thấy thiệp.' }

  const balance = await getCreditBalanceByUserId(userId)
  if (balance < COST) return { error: `Không đủ credit. Cần ${COST} credit để tạo ảnh AI.` }

  const hasCustomReference =
    Boolean(customReferenceImageUrl) ||
    (customReferenceImageFile instanceof File && customReferenceImageFile.size > 0)

  const prompt = buildWeddingPrompt({
    type,
    style: card.selectedStyleId,
    palette: card.colorPalette,
    groomName: card.groomName,
    brideName: card.brideName,
    venue: card.venue,
    extraPrompt,
    hasReference:
      (type !== 'master' && Boolean(card.masterImageUrl)) ||
      hasCustomReference,
    hasCustomReference,
  })
  const imageId = await insertWeddingAiImageProcessing({
    userId,
    cardId,
    type,
    prompt,
    referenceImageId: type === 'master' ? null : card.masterImageId,
  })

  let charged = false
  try {
    const genAI = new GoogleGenerativeAI((await requireGoogleApiKeyForUser(userId)).apiKey)
    const model = genAI.getGenerativeModel({
      model: GEMINI_3_PRO_IMAGE.model,
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { imageSize: '2K', aspectRatio: '3:4' },
      },
    })
    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    ]
    const parts: (string | object)[] = [prompt]
    const referenceParts = await Promise.all([
      type !== 'master' ? getReferenceImagePart(card.masterImageUrl) : null,
      getReferenceImagePart(customReferenceImageUrl || null),
      getReferenceImagePartFromFile(customReferenceImageFile),
    ])
    referenceParts.filter(Boolean).forEach((part) => parts.push(part as object))
    const bunnyReady = await ensureBunnyWritableBeforeImageModel()
    if (!bunnyReady.ok) throw new Error(bunnyReady.error)
    const genResult = await model.generateContent(parts as never, { safetySettings } as never)
    const response = genResult.response
    trackFromUsageMetadata(response.usageMetadata, GEMINI_3_PRO_IMAGE.model, 'tao-thiep-moi-cuoi-ai', userId, '2K')
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      throw new Error('AI không trả về ảnh hợp lệ.')
    }
    const resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
    const resultPath = `results/${userId}/wedding_${cardId}_${type}_${Date.now()}.png`
    const { publicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })
    const charge = await deductUserCredits(userId, COST, 'tao-thiep-moi-cuoi-ai')
    if (!charge.ok) {
      throw new Error(charge.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credit để hoàn tất.' : charge.error)
    }
    charged = true
    await completeWeddingAiImage({ imageId, userId, imageUrl: publicUrl, makeMaster: type === 'master' })
    await saveWeddingBackgroundToLibrary({ imageUrl: publicUrl, imageType: type }).catch(() => undefined)
    revalidatePath('/tao-thiep-moi-cuoi-ai')
    return { success: true, imageId, imageUrl: publicUrl }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (typeof charged !== 'undefined' && charged) {
      await refundUserCredits(userId, COST, 'tao-thiep-moi-cuoi-ai').catch(() => undefined)
    }
    await failWeddingAiImage(imageId, userId, message).catch(() => undefined)
    return { error: `Tạo ảnh thất bại, credit chưa bị trừ nếu AI chưa ra ảnh: ${message}` }
  }
}

const COVER_AI_FRAME_PANEL = '#fffaf2'

export async function generateWeddingCoverFrame(formData: FormData) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const userId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const cardId = clean(formData.get('cardId'), 80)
  const extraPrompt = clean(formData.get('extraPrompt'), 800)
  const openingShape = readWeddingCoverFrameOpening(formData.get('openingShape'))
  const card = await getWeddingCardForUser(cardId, userId)
  if (!card) return { error: 'Không tìm thấy thiệp.' }

  const frameCost = requiredCreditsForLogoCreate(COST, true)
  const balance = await getCreditBalanceByUserId(userId)
  if (balance < frameCost) {
    return { error: `Không đủ credit. Cần ${frameCost} credit để tạo khung và xóa nền.` }
  }

  const style = getWeddingStylePreset(card.selectedStyleId)
  const prompt = buildWeddingCoverFramePrompt({
    styleLabel: style.label.en,
    palette: card.colorPalette.trim() || style.palette,
    extraPrompt,
    openingShape,
  })
  const clientConfig = String(formData.get('sectionConfig') ?? '').trim()
  let baseConfig = card.sectionConfig
  if (clientConfig.startsWith('{')) {
    try {
      JSON.parse(clientConfig)
      baseConfig = clientConfig
    } catch {
      baseConfig = card.sectionConfig
    }
  }

  let charged = false
  try {
    const genAI = new GoogleGenerativeAI((await requireGoogleApiKeyForUser(userId)).apiKey)
    const model = genAI.getGenerativeModel({
      model: GEMINI_3_PRO_IMAGE.model,
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { imageSize: '2K', aspectRatio: '3:4' },
      },
    })
    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    ]
    const bunnyReady = await ensureBunnyWritableBeforeImageModel()
    if (!bunnyReady.ok) throw new Error(bunnyReady.error)
    const genResult = await model.generateContent([prompt] as never, { safetySettings } as never)
    const response = genResult.response
    trackFromUsageMetadata(response.usageMetadata, GEMINI_3_PRO_IMAGE.model, 'tao-thiep-moi-cuoi-ai', userId, '2K')
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      throw new Error('AI không trả về ảnh hợp lệ.')
    }
    const drawn = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
    const stripped = await stripLogoBackgroundToTransparentPng({
      apiKey: (await requireGoogleApiKeyForUser(userId)).apiKey,
      userId,
      feature: 'tao-thiep-moi-cuoi-ai',
      imageBuffer: drawn,
    })
    if (!stripped.removed) {
      return { error: 'Xóa nền không ra khung trong suốt. Credit chưa bị trừ.' }
    }
    const hole = await measureCoverFrameHole(stripped.buffer)
    if (!hole) {
      return { error: 'Khung không có lỗ giữa đủ lớn để đặt ảnh. Credit chưa bị trừ.' }
    }
    const resultPath = `results/${userId}/wedding_${cardId}_cover_frame_${Date.now()}.png`
    const { publicUrl } = await uploadTryOnImagePublic(resultPath, stripped.buffer, {
      contentType: 'image/png',
      upsert: true,
    })
    const chargeAmount = chargedCreditsForLogoCreate(COST, true)
    const charge = await deductUserCredits(userId, chargeAmount, 'tao-thiep-moi-cuoi-ai')
    if (!charge.ok) {
      throw new Error(charge.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credit để hoàn tất.' : charge.error)
    }
    charged = true
    const sectionConfig = mergeWeddingSectionConfig(baseConfig, {
      coverAiFrameUrl: publicUrl,
      coverAiFrameHole: hole,
      coverAiFramePanel: COVER_AI_FRAME_PANEL,
      coverAiFrameInk: 'dark',
    })
    const saved = await saveWeddingCardSectionConfig(cardId, userId, sectionConfig)
    if (!saved) throw new Error('Không lưu được khung vào thiệp.')
    const libraryItem = await saveWeddingCoverFrameToLibrary({
      imageUrl: publicUrl,
      hole,
      panel: COVER_AI_FRAME_PANEL,
      ink: 'dark',
    }).catch(() => null)
    revalidatePath('/tao-thiep-moi-cuoi-ai')
    revalidatePath(`/thiep-moi-cuoi/${saved.slug}`)
    return {
      success: true as const,
      imageUrl: publicUrl,
      hole,
      panel: COVER_AI_FRAME_PANEL,
      ink: 'dark' as const,
      libraryItem,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (charged) {
      await refundUserCredits(userId, chargedCreditsForLogoCreate(COST, true), 'tao-thiep-moi-cuoi-ai').catch(() => undefined)
    }
    return { error: `Tạo khung thất bại, credit chưa bị trừ: ${message}` }
  }
}

const PRIVATE_BACKGROUND_MAX_BYTES = 8 * 1024 * 1024

export async function uploadWeddingPrivateBackground(formData: FormData) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const userId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const cardId = clean(formData.get('cardId'), 80)
  const typeRaw = clean(formData.get('type'), 40) as WeddingImageType
  if (typeRaw !== 'master') return { error: 'Chỉ gắn ảnh nền chính cho cả thiệp.' }
  const type = 'master' as const
  const card = await getWeddingCardForUser(cardId, userId)
  if (!card) return { error: 'Không tìm thấy thiệp.' }
  const file = formData.get('file')
  if (!(file instanceof File) || file.size <= 0) return { error: 'Chọn một file ảnh.' }
  if (!file.type.startsWith('image/')) return { error: 'File phải là ảnh.' }
  if (file.size > PRIVATE_BACKGROUND_MAX_BYTES) return { error: 'Ảnh quá lớn. Tối đa 8 MB.' }
  const ext = file.type.includes('png')
    ? 'png'
    : file.type.includes('webp')
      ? 'webp'
      : file.type.includes('gif')
        ? 'gif'
        : 'jpg'
  const path = `uploads/${userId}/wedding_${card.id}_private_bg_${type}_${Date.now()}.${ext}`
  const { publicUrl } = await uploadTryOnImagePublic(path, file, {
    contentType: file.type || 'image/jpeg',
    upsert: true,
  })
  const attached = await attachWeddingPrivateBackground({
    userId,
    cardId: card.id,
    imageUrl: publicUrl,
    type,
  })
  if (!attached) return { error: 'Không gắn được ảnh vào thiệp.' }
  revalidatePath('/tao-thiep-moi-cuoi-ai')
  revalidatePath(`/thiep-moi-cuoi/${card.slug}`)
  return { ok: true as const, imageUrl: publicUrl }
}

export async function applyWeddingBackgroundFromLibrary(formData: FormData) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const userId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const cardId = clean(formData.get('cardId'), 80)
  const libraryId = clean(formData.get('libraryId'), 80)
  const typeRaw = clean(formData.get('type'), 40) as WeddingImageType
  if (typeRaw !== 'master') return { error: 'Kho chỉ gắn vào ảnh nền chính.' }
  const type = 'master' as const
  const card = await getWeddingCardForUser(cardId, userId)
  if (!card) return { error: 'Không tìm thấy thiệp.' }
  const attached = await attachWeddingLibraryBackground({ userId, cardId: card.id, libraryId, type })
  if (!attached) return { error: 'Không tìm thấy ảnh trong kho.' }
  revalidatePath('/tao-thiep-moi-cuoi-ai')
  revalidatePath(`/thiep-moi-cuoi/${card.slug}`)
  return { ok: true as const }
}

export async function publishCurrentWeddingCard(cardId: string) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const ownerUserId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const card = await publishWeddingCard(cardId, ownerUserId)
  if (!card) return { error: 'Không tìm thấy thiệp.' }
  revalidatePath('/tao-thiep-moi-cuoi-ai')
  revalidatePath(`/thiep-moi-cuoi/${card.slug}`)
  return { card }
}

export async function polishWeddingCardText(formData: FormData) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)

  const fieldRaw = clean(formData.get('field'), 40)
  if (!isWeddingPolishField(fieldRaw)) return { error: 'Loại nội dung không hợp lệ.' }

  const draft = clean(formData.get('draft'), MAX_TEXT)
  if (!draft) return { error: 'Nhập nội dung sơ bộ trước khi tối ưu bằng AI.' }

  const field = fieldRaw as WeddingPolishField
  const maxLen = field === 'loveQuote' || field === 'dressCode' ? 600 : MAX_TEXT
  if (draft.length > maxLen) {
    return { error: `Nội dung quá dài (tối đa ${maxLen} ký tự).` }
  }

  const cost = weddingPolishFieldCostsCredit(field) ? WEDDING_TEXT_POLISH_CREDIT : 0
  let chargedAmount = 0
  if (cost > 0) {
    const charge = await deductUserCredits(auth.user.id, cost, 'wedding-card-text-polish')
    if (!charge.ok) {
      return {
        error:
          charge.code === 'INSUFFICIENT_CREDITS'
            ? 'Không đủ credit. Mỗi lần cải thiện tốn 0,1 credit.'
            : charge.error,
      }
    }
    chargedAmount = charge.charged
  }

  const result = await polishWeddingTextWithDeepseek({
    field,
    draft,
    groomName: clean(formData.get('groomName'), 200),
    brideName: clean(formData.get('brideName'), 200),
    weddingDate: clean(formData.get('weddingDate'), 120),
    venue: clean(formData.get('venue'), 500),
    userId: auth.user.id,
  })

  if ('error' in result) {
    if (chargedAmount > 0) {
      await refundUserCredits(auth.user.id, chargedAmount, 'wedding-card-text-polish').catch(() => undefined)
    }
    return { error: result.error }
  }
  return { text: result.text.slice(0, maxLen), charged: chargedAmount }
}
