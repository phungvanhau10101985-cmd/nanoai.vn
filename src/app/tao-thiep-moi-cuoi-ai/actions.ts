'use server'

import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai'
import { getUserForCreditAction } from '@/lib/auth'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import { GEMINI_3_PRO_IMAGE } from '@/lib/gemini-config'
import {
  completeWeddingAiImage,
  createWeddingCardDraft,
  ensureWeddingCardOwnerProfile,
  failWeddingAiImage,
  getLatestWeddingCardForUser,
  getWeddingCardForUser,
  insertWeddingAiImageProcessing,
  listWeddingImages,
  listWeddingRsvps,
  publishWeddingCard,
  updateWeddingCardBrief,
  WEDDING_IMAGE_TYPES,
  type WeddingCard,
  type WeddingImageType,
} from '@/lib/db/wedding-cards-pg'
import { deductUserCredits, refundUserCredits } from '@/lib/music/deduct-user-credits'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { buildWeddingPrompt } from '@/lib/wedding/build-wedding-image-prompt'
import { parseWeddingMusicTimeToSeconds } from '@/lib/wedding/parse-music-play-time'
import { normalizeWeddingDateToIso } from '@/lib/wedding/wedding-date-normalize'
import { normalizeGuestInviteVenue } from '@/lib/wedding/wedding-guest-invite-venue'
import { isTwinVietGiftReady } from '@/lib/wedding/wedding-gift-vietqr'
import { mergeWeddingSectionConfig, parseWeddingSectionConfig } from '@/lib/wedding/wedding-section-config'
import { requireGoogleApiKeyForUser } from '@/lib/ai/google-api-key-resolver'
import {
  isWeddingPolishField,
  polishWeddingTextWithDeepseek,
  type WeddingPolishField,
} from '@/lib/wedding/wedding-text-polish-deepseek'

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

export async function getOrCreateWeddingCard() {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const ownerUserId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const existing = await getLatestWeddingCardForUser(ownerUserId)
  const card = existing ?? (await createWeddingCardDraft(ownerUserId))
  const images = await listWeddingImages(card.id)
  const rsvps = await listWeddingRsvps(card.id, ownerUserId)
  return { card, images, rsvps }
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
  let albumImageUrls = clean(formData.get('albumImageUrls'), 5000)
    .split('\n')
    .map((url) => url.trim())
    .filter(Boolean)
  if (albumImageUrls.length === 0) albumImageUrls = existing.albumImageUrls
  let uploadedCover: string | null = null
  try {
    groomImageUrl = (await uploadWeddingReferenceImage(ownerUserId, cardId, 'groom', formData.get('groomImage'))) ?? groomImageUrl
    brideImageUrl = (await uploadWeddingReferenceImage(ownerUserId, cardId, 'bride', formData.get('brideImage'))) ?? brideImageUrl
    uploadedCover = await uploadWeddingReferenceImage(ownerUserId, cardId, 'cover', formData.get('coverImage'))
    const uploadedMusic = await uploadWeddingMusic(ownerUserId, cardId, formData.get('musicFile'))
    if (uploadedMusic) {
      musicUrl = uploadedMusic
    } else if (boolValue(formData.get('musicClear'))) {
      musicUrl = ''
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

  let sectionConfig = clean(formData.get('sectionConfig'), 3000) || '{}'
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
  }
  const giftCheckCard: WeddingCard = {
    ...existing,
    giftQrEnabled,
    giftQrImageUrl,
    groomGiftBankId,
    groomGiftAccountNo,
    groomGiftAccountName,
    brideGiftBankId,
    brideGiftAccountNo,
    brideGiftAccountName,
  }
  if (giftQrEnabled && !isTwinVietGiftReady(giftCheckCard) && !giftQrImageUrl.trim()) {
    return {
      error:
        'Đã bật QR mừng cưới: nhập đủ thông tin VietQR cho cả chú rể và cô dâu (ngân hàng, STK, tên chủ TK), hoặc nhập URL ảnh QR.',
    }
  }

  const card = await updateWeddingCardBrief(draftForGift)
  if (!card) return { error: 'Không tìm thấy thiệp.' }
  revalidatePath('/tao-thiep-moi-cuoi-ai')
  revalidatePath(`/thiep-moi-cuoi/${card.slug}`)
  return { card }
}

export async function generateWeddingCardImage(formData: FormData) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const userId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const cardId = clean(formData.get('cardId'), 80)
  const typeRaw = clean(formData.get('type'), 40) as WeddingImageType
  const type = WEDDING_IMAGE_TYPES.includes(typeRaw) ? typeRaw : 'master'
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
      Boolean(card.groomImageUrl || card.brideImageUrl) ||
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
      getReferenceImagePart(card.groomImageUrl || null),
      getReferenceImagePart(card.brideImageUrl || null),
      getReferenceImagePart(customReferenceImageUrl || null),
      getReferenceImagePartFromFile(customReferenceImageFile),
    ])
    referenceParts.filter(Boolean).forEach((part) => parts.push(part as object))
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
    const charge = await deductUserCredits(userId, COST)
    if (!charge.ok) {
      throw new Error(charge.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credit để hoàn tất.' : charge.error)
    }
    charged = true
    await completeWeddingAiImage({ imageId, userId, imageUrl: publicUrl, makeMaster: type === 'master' })
    revalidatePath('/tao-thiep-moi-cuoi-ai')
    return { success: true, imageId, imageUrl: publicUrl }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (typeof charged !== 'undefined' && charged) {
      await refundUserCredits(userId, COST).catch(() => undefined)
    }
    await failWeddingAiImage(imageId, userId, message).catch(() => undefined)
    return { error: `Tạo ảnh thất bại, credit chưa bị trừ nếu AI chưa ra ảnh: ${message}` }
  }
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

  const result = await polishWeddingTextWithDeepseek({
    field,
    draft,
    groomName: clean(formData.get('groomName'), 200),
    brideName: clean(formData.get('brideName'), 200),
    weddingDate: clean(formData.get('weddingDate'), 120),
    venue: clean(formData.get('venue'), 500),
    userId: auth.user.id,
  })

  if ('error' in result) return { error: result.error }
  return { text: result.text.slice(0, maxLen) }
}
