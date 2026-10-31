'use server'

import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai'
import { getUserForCreditAction } from '@/lib/auth'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import { getProfileRoleWithFallback } from '@/lib/db/read-user-dashboard-pg'
import { deleteWeddingOrnamentLayout, listWeddingOrnamentLayouts, saveWeddingOrnamentLayout } from '@/lib/db/wedding-ornament-layouts-pg'
import { deleteWeddingSharedFrame, listWeddingSharedFrames, saveWeddingShellLayout, saveWeddingSharedFrame } from '@/lib/db/wedding-shell-layouts-pg'
import {
  canEditWeddingCardOrnaments,
  canEditWeddingOrnaments,
  isWeddingOrnamentLayoutKey,
  parseWeddingOrnamentList,
  weddingCardOrnamentLayoutKey,
  weddingOrnamentDeviceKey,
  weddingOrnamentLayoutKey,
  weddingOrnamentSaveKey,
  type WeddingOrnamentDevice,
} from '@/lib/wedding/wedding-background-ornament-store'
import { findWeddingBackgroundPreset } from '@/lib/wedding/wedding-background-presets'
import { findWeddingSampleCard, weddingSampleSharedLayoutKey } from '@/lib/wedding/wedding-sample-cards'
import { isWeddingSharedFrameKey, parseWeddingSharedFrame, weddingSharedFrameKey, type WeddingSharedFrame } from '@/lib/wedding/wedding-shared-frame'
import { imageChargeFromForm } from '@/lib/ai/image-engine'
import { runImageContent, type GeminiShaped } from '@/lib/ai/gpt-image'
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
  getWeddingCardOwner,
  listWeddingCardSummariesForUser,
  patchWeddingCardPreview,
  saveWeddingCardSectionConfig,
  insertWeddingAiImageProcessing,
  listWeddingBackgroundLibrary,
  listWeddingCoverFrameLibrary,
  listWeddingImages,
  deleteWeddingMusicFromLibrary,
  listWeddingMusicLibrary,
  listWeddingRsvps,
  resolveWeddingLibraryReferenceUrl,
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
import { removeTryOnStorageFromPublicUrls, uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import {
  WEDDING_BACKGROUND_ASPECT_RATIO,
  WEDDING_GPT_BACKGROUND_SIZE,
  buildWeddingPrompt,
} from '@/lib/wedding/build-wedding-image-prompt'
import { buildWeddingCoverFramePrompt, readWeddingCoverFrameOpening } from '@/lib/wedding/build-wedding-cover-frame-prompt'
import { measureCoverFrameHole } from '@/lib/wedding/measure-cover-frame-hole'
import { getWeddingStylePreset } from '@/lib/wedding/wedding-style-presets'
import {
  chargedCreditsForLogoCreate,
  requiredCreditsForLogoCreate,
  stripLogoBackgroundToTransparentPng,
} from '@/lib/remove-background-png'
import { parseWeddingMusicTimeToSeconds } from '@/lib/wedding/parse-music-play-time'
import {
  findWeddingMusicInLibrary,
  isWeddingMusicSeedUrl,
  WEDDING_LIBRARY_MUSIC_MAX_BYTES,
  weddingLibraryMusicFileError,
  weddingMusicTitleFromFileName,
} from '@/lib/wedding/wedding-music-library'
import { normalizeWeddingDateToIso } from '@/lib/wedding/wedding-date-normalize'
import { normalizeGuestInviteVenue } from '@/lib/wedding/wedding-guest-invite-venue'
import { invitationOccasionShape, normalizeInvitationOccasion } from '@/lib/wedding/invitation-occasion'
import { applyClientWeddingSectionConfig, applyWeddingFrameChoice, clearWeddingFrameChoice, forgetPrivateDeviceShell, mergeWeddingSectionConfig, parseWeddingDeviceShell, parseWeddingSectionConfig, readHeroPhotoLayout, readTextStyles, stringifyWeddingSectionConfig } from '@/lib/wedding/wedding-section-config'
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
import { composeWeddingSampleCopyWithDeepseek } from '@/lib/wedding/wedding-sample-compose-deepseek'
import {
  WEDDING_SAMPLE_COMPOSE_CREDIT,
  type WeddingSampleComposeCopy,
} from '@/lib/wedding/wedding-sample-compose'

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
  const nameLooksLikeImage = /\.(jpe?g|png|webp|gif|heic|heif|bmp|avif)$/i.test(file.name)
  if (!file.type.startsWith('image/') && !nameLooksLikeImage) {
    const roleLabel = role === 'groom' ? 'chú rể' : role === 'bride' ? 'cô dâu' : 'vỏ thiệp'
    throw new Error(`Ảnh ${roleLabel} phải là file ảnh hợp lệ.`)
  }
  const ext = file.type.includes('jpeg') || file.type.includes('jpg') ? 'jpg' : 'png'
  const path = `uploads/${userId}/wedding_${cardId}_${role}_${Date.now()}.${ext}`
  const { publicUrl } = await uploadTryOnImagePublic(path, file, { contentType: file.type || 'image/png', upsert: true })
  return publicUrl
}

function weddingAudioExt(file: File) {
  if (file.type.includes('mpeg') || file.type.includes('mp3') || /\.mp3$/i.test(file.name)) return 'mp3'
  if (file.type.includes('wav') || /\.wav$/i.test(file.name)) return 'wav'
  if (file.type.includes('aac') || /\.aac$/i.test(file.name)) return 'aac'
  if (file.type.includes('ogg') || /\.ogg$/i.test(file.name)) return 'ogg'
  return 'm4a'
}

async function uploadWeddingMusic(userId: string, cardId: string, file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size <= 0) return null
  if (!file.type.startsWith('audio/') && !/\.(mp3|m4a|wav|aac|ogg)$/i.test(file.name)) {
    throw new Error('File nhạc phải là audio hợp lệ.')
  }
  if (file.size > WEDDING_LIBRARY_MUSIC_MAX_BYTES) {
    throw new Error('Mỗi bài nhạc tối đa 13 MB.')
  }
  const ext = weddingAudioExt(file)
  const path = `uploads/${userId}/wedding_${cardId}_music_${Date.now()}.${ext}`
  const { publicUrl } = await uploadTryOnImagePublic(path, file, { contentType: file.type || 'audio/mpeg', upsert: true })
  return publicUrl
}

async function uploadWeddingLibraryMusicFile(userId: string, file: File) {
  const ext = weddingAudioExt(file)
  const suffix = Math.random().toString(36).slice(2, 8)
  const path = `uploads/${userId}/wedding_library_music_${Date.now()}_${suffix}.${ext}`
  const { publicUrl } = await uploadTryOnImagePublic(path, file, { contentType: file.type || 'audio/mpeg', upsert: true })
  if (!publicUrl) throw new Error('upload_failed')
  return publicUrl
}

export async function uploadWeddingLibraryTrack(formData: FormData) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const ownerUserId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const file = formData.get('musicFile')
  if (!(file instanceof File)) return { error: 'invalid_type' as const }
  const problem = weddingLibraryMusicFileError(file)
  if (problem) return { error: problem }
  const libraryNow = await listWeddingMusicLibrary()
  const existing = findWeddingMusicInLibrary(libraryNow, file.name)
  if (existing) return { musicLibrary: libraryNow, audioUrl: existing.audioUrl, already: true as const }
  let audioUrl = ''
  try {
    audioUrl = await uploadWeddingLibraryMusicFile(ownerUserId, file)
    const title = weddingMusicTitleFromFileName(clean(formData.get('musicTitle'), 120) || file.name)
    await saveWeddingMusicToLibrary({ title, audioUrl })
    const musicLibrary = await listWeddingMusicLibrary()
    return { musicLibrary, audioUrl }
  } catch {
    if (audioUrl) await removeTryOnStorageFromPublicUrls([audioUrl]).catch(() => undefined)
    return { error: 'upload_failed' as const }
  }
}

export async function deleteWeddingLibraryTrack(audioUrl: string) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const role = await getProfileRoleWithFallback(auth.user.id).catch(() => null)
  if (!canEditWeddingOrnaments({ role, email: auth.user.email })) return { error: 'denied' as const }
  const url = String(audioUrl || '').trim()
  if (!url || isWeddingMusicSeedUrl(url) || url.startsWith('/wedding-music/')) return { error: 'denied' as const }
  try {
    const removed = await deleteWeddingMusicFromLibrary(url)
    if (!removed.deleted) return { error: 'missing' as const }
    await removeTryOnStorageFromPublicUrls([url])
    for (const slug of removed.slugs) revalidatePath(`/thiep-moi-cuoi/${slug}`)
    revalidatePath('/tao-thiep-moi-cuoi-ai')
    const musicLibrary = await listWeddingMusicLibrary()
    return { musicLibrary }
  } catch {
    return { error: 'missing' as const }
  }
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

async function weddingCardWorkspace(ownerUserId: string, card: WeddingCard, email?: string | null) {
  const [images, rsvps, library, frameLibrary, musicLibrary, cards, ornamentLayouts, sharedFrames, role] = await Promise.all([
    listWeddingImages(card.id),
    listWeddingRsvps(card.id, ownerUserId),
    listWeddingBackgroundLibrary(),
    listWeddingCoverFrameLibrary(),
    listWeddingMusicLibrary(),
    listWeddingCardSummariesForUser(ownerUserId),
    listWeddingOrnamentLayouts().catch(() => ({})),
    listWeddingSharedFrames().catch(() => ({})),
    getProfileRoleWithFallback(ownerUserId).catch(() => null),
  ])
  return {
    card,
    images,
    rsvps,
    library,
    frameLibrary,
    musicLibrary,
    cards,
    ornamentLayouts,
    sharedFrames,
    ornamentAdmin: canEditWeddingOrnaments({ role, email }),
  }
}

export async function loadWeddingCardWorkspace(cardId?: string) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const ownerUserId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const requested = String(cardId || '').trim()
  let card = requested ? await getWeddingCardForUser(requested, ownerUserId) : null
  if (!card) card = await getLatestWeddingCardForUser(ownerUserId)
  if (!card) card = await createWeddingCardDraft(ownerUserId)
  if (card && !card.isPublished && (card.groomName.trim() || card.brideName.trim())) {
    card = (await publishWeddingCard(card.id, ownerUserId)) ?? card
    if (card.slug) revalidatePath(`/thiep-moi-cuoi/${card.slug}`)
  }
  return weddingCardWorkspace(ownerUserId, card, auth.user.email)
}

/** Đọc thiệp đã có để bê tên và nội dung sang mẫu mới. Không xuất bản. */
export async function loadWeddingCardFacts(cardId: string) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const ownerUserId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const card = await getWeddingCardForUser(String(cardId || '').trim(), ownerUserId)
  if (!card) return { error: 'missing' as const }
  return { card }
}

export async function saveWeddingBackgroundOrnaments(layoutKey: string, ornaments: unknown) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const userId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const role = await getProfileRoleWithFallback(userId)
  if (!canEditWeddingOrnaments({ role, email: auth.user.email })) return { error: 'denied' as const }
  const key = layoutKey.trim()
  if (key.startsWith('card:') || !isWeddingOrnamentLayoutKey(key)) return { error: 'invalid' as const }
  const parsed = parseWeddingOrnamentList(ornaments)
  if (!parsed) return { error: 'invalid' as const }
  try {
    await saveWeddingOrnamentLayout({ layoutKey: key, ornaments: parsed, userId })
  } catch {
    return { error: 'unavailable' as const }
  }
  return { ok: true as const, ornaments: parsed }
}

async function assertWeddingCardOrnamentEditor(cardId: string) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const userId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const role = await getProfileRoleWithFallback(userId)
  const owner = await getWeddingCardOwner(cardId)
  if (!owner || !canEditWeddingCardOrnaments({ role, email: auth.user.email, userId, ownerId: owner.userId })) {
    return { error: 'denied' as const }
  }
  return {
    userId,
    ownerUserId: owner.userId,
    slug: owner.slug,
    templateEditor: canEditWeddingOrnaments({ role, email: auth.user.email }),
  }
}

async function weddingSharedBaseKey(cardId: string, ownerUserId: string): Promise<string> {
  const card = await getWeddingCardForUser(cardId, ownerUserId)
  if (!card) return ''
  const section = parseWeddingSectionConfig(card.sectionConfig)
  return weddingOrnamentLayoutKey({
    backgroundPresetId: section.backgroundPresetId,
    backgroundKitStyleId: section.backgroundKitStyleId,
    masterImageUrl: card.masterImageUrl,
  })
}

function weddingCardDeviceLayoutKey(cardId: string, device: WeddingOrnamentDevice): string {
  if (device !== 'desktop' && device !== 'mobile') return ''
  return weddingOrnamentDeviceKey(weddingCardOrnamentLayoutKey(cardId), device)
}

/** Khách ghi hoa vào đúng thiệp của mình. Quản trị ghi mẫu chung của nền, và gỡ bản riêng của thiệp đang mở để thiệp đó cũng dùng mẫu. */
export async function saveWeddingCardOrnaments(cardId: string, device: WeddingOrnamentDevice, ornaments: unknown) {
  const access = await assertWeddingCardOrnamentEditor(cardId)
  if ('error' in access) return { error: access.error }
  const parsed = parseWeddingOrnamentList(ornaments)
  if (!parsed) return { error: 'invalid' as const }
  const sharedBase = access.templateEditor ? await weddingSharedBaseKey(cardId, access.ownerUserId) : ''
  const key = weddingOrnamentSaveKey({
    templateEditor: access.templateEditor,
    cardId,
    device,
    sharedBaseKey: sharedBase,
  })
  if (!isWeddingOrnamentLayoutKey(key)) return { error: 'invalid' as const }
  try {
    await saveWeddingOrnamentLayout({ layoutKey: key, ornaments: parsed, userId: access.userId })
    if (access.templateEditor && !key.startsWith('card:')) {
      const cardKey = weddingCardDeviceLayoutKey(cardId, device)
      if (cardKey && cardKey !== key) await deleteWeddingOrnamentLayout(cardKey)
    }
  } catch {
    return { error: 'unavailable' as const }
  }
  if (access.slug) revalidatePath(`/thiep-moi-cuoi/${access.slug}`)
  return { ok: true as const, ornaments: parsed, template: access.templateEditor && !key.startsWith('card:') }
}

/** Khách xóa hoa riêng của thiệp để thấy lại mẫu. Quản trị xóa mẫu chung và bản riêng của thiệp đang mở. */
export async function resetWeddingCardOrnaments(cardId: string, device: WeddingOrnamentDevice) {
  const access = await assertWeddingCardOrnamentEditor(cardId)
  if ('error' in access) return { error: access.error }
  const sharedBase = access.templateEditor ? await weddingSharedBaseKey(cardId, access.ownerUserId) : ''
  const key = weddingOrnamentSaveKey({
    templateEditor: access.templateEditor,
    cardId,
    device,
    sharedBaseKey: sharedBase,
  })
  if (!isWeddingOrnamentLayoutKey(key)) return { error: 'invalid' as const }
  try {
    await deleteWeddingOrnamentLayout(key)
    if (access.templateEditor && !key.startsWith('card:')) {
      const cardKey = weddingCardDeviceLayoutKey(cardId, device)
      if (cardKey && cardKey !== key) await deleteWeddingOrnamentLayout(cardKey)
    }
  } catch {
    return { error: 'unavailable' as const }
  }
  if (access.slug) revalidatePath(`/thiep-moi-cuoi/${access.slug}`)
  return { ok: true as const }
}

function previewSectionConfig(
  existingRaw: string | null | undefined,
  patch: { sectionConfig?: string; textStyles?: unknown },
  templateEditor: boolean,
) {
  const frameSection =
    typeof patch.sectionConfig !== 'string'
      ? undefined
      : templateEditor
        ? applyWeddingFrameChoice(existingRaw, patch.sectionConfig)
        : applyClientWeddingSectionConfig(existingRaw, patch.sectionConfig)
  const styles = readTextStyles(patch.textStyles)
  if (!styles) return frameSection
  return mergeWeddingSectionConfig(frameSection ?? existingRaw, { textStyles: styles })
}

function clipPreviewText(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : undefined
}

/** Quản trị ghi vị trí vỏ thành mẫu của nền. Thiệp đang mở bỏ vỏ riêng của máy đó để dùng mẫu. Thiệp khách khác đã tự sửa thì giữ nguyên. */
export async function saveWeddingTemplateShell(cardId: string, device: WeddingOrnamentDevice, shell: unknown) {
  const access = await assertWeddingCardOrnamentEditor(cardId)
  if ('error' in access || !access.templateEditor) return { error: 'denied' as const }
  const parsed = parseWeddingDeviceShell(shell)
  if (!parsed || (device !== 'desktop' && device !== 'mobile')) return { error: 'invalid' as const }
  const sharedBase = await weddingSharedBaseKey(cardId, access.ownerUserId)
  const key = weddingOrnamentDeviceKey(sharedBase, device)
  if (!key || !isWeddingOrnamentLayoutKey(key)) return { error: 'invalid' as const }
  const existing = await getWeddingCardForUser(cardId, access.ownerUserId)
  if (!existing) return { error: 'denied' as const }
  try {
    await saveWeddingShellLayout({ layoutKey: key, shell: parsed, userId: access.userId })
    const forgotten = stringifyWeddingSectionConfig(forgetPrivateDeviceShell(parseWeddingSectionConfig(existing.sectionConfig), device))
    await saveWeddingCardSectionConfig(cardId, access.ownerUserId, forgotten)
  } catch {
    return { error: 'unavailable' as const }
  }
  if (access.slug) revalidatePath(`/thiep-moi-cuoi/${access.slug}`)
  return { ok: true as const, shell: parsed }
}

/** Quản trị ghi khung mặc định của nền. Thiệp đang sửa bỏ lựa chọn riêng của vị trí đó để theo mẫu. Không đưa khung vào kho AI. */
export async function saveWeddingTemplateFrame(
  cardId: string,
  frame: unknown,
  side: 'cover' | 'groom' | 'bride' | 'pair',
  sectionConfig?: string,
) {
  const access = await assertWeddingCardOrnamentEditor(cardId)
  if ('error' in access || !access.templateEditor) return { error: 'denied' as const }
  if (side !== 'cover' && side !== 'groom' && side !== 'bride' && side !== 'pair') return { error: 'invalid' as const }
  const sharedBase = await weddingSharedBaseKey(cardId, access.ownerUserId)
  const key = weddingSharedFrameKey(sharedBase)
  if (!key || !isWeddingSharedFrameKey(key)) return { error: 'invalid' as const }
  const parsed: WeddingSharedFrame | null = frame == null ? null : parseWeddingSharedFrame(frame)
  if (frame != null && !parsed) return { error: 'invalid' as const }
  const existing = await getWeddingCardForUser(cardId, access.ownerUserId)
  if (!existing) return { error: 'denied' as const }
  const source = typeof sectionConfig === 'string' ? sectionConfig : existing.sectionConfig
  try {
    if (parsed) await saveWeddingSharedFrame({ layoutKey: key, frame: parsed, userId: access.userId })
    else await deleteWeddingSharedFrame(key)
    const cleared = clearWeddingFrameChoice(source, side)
    const kept = applyWeddingFrameChoice(existing.sectionConfig, cleared)
    await saveWeddingCardSectionConfig(cardId, access.ownerUserId, kept)
  } catch {
    return { error: 'unavailable' as const }
  }
  if (access.slug) revalidatePath(`/thiep-moi-cuoi/${access.slug}`)
  return { ok: true as const, frame: parsed }
}

async function assertWeddingPresetEditor(presetId: string) {
  const sample = findWeddingSampleCard(presetId)
  const preset = sample?.aiStyleId ? undefined : findWeddingBackgroundPreset(presetId)
  const base = sample ? weddingSampleSharedLayoutKey(sample) : preset ? weddingOrnamentLayoutKey({ backgroundPresetId: preset.id }) : ''
  if (!base) return { error: 'invalid' as const }
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const userId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const role = await getProfileRoleWithFallback(userId)
  if (!canEditWeddingOrnaments({ role, email: auth.user.email })) return { error: 'denied' as const }
  return { userId, base, presetId: sample?.id || preset?.id || presetId }
}

/** Quản trị sửa thiệp mẫu thì ghi hoa vào mẫu dùng chung, không cần một thiệp khách. */
export async function saveWeddingPresetOrnaments(presetId: string, device: WeddingOrnamentDevice, ornaments: unknown) {
  const access = await assertWeddingPresetEditor(presetId)
  if ('error' in access) return access
  const parsed = parseWeddingOrnamentList(ornaments)
  if (!parsed || (device !== 'desktop' && device !== 'mobile')) return { error: 'invalid' as const }
  const key = weddingOrnamentDeviceKey(access.base, device)
  if (!isWeddingOrnamentLayoutKey(key)) return { error: 'invalid' as const }
  try {
    await saveWeddingOrnamentLayout({ layoutKey: key, ornaments: parsed, userId: access.userId })
  } catch {
    return { error: 'unavailable' as const }
  }
  revalidatePath(`/thiep-mau/${access.presetId}`)
  return { ok: true as const, ornaments: parsed, template: true as const }
}

export async function resetWeddingPresetOrnaments(presetId: string, device: WeddingOrnamentDevice) {
  const access = await assertWeddingPresetEditor(presetId)
  if ('error' in access) return access
  if (device !== 'desktop' && device !== 'mobile') return { error: 'invalid' as const }
  const key = weddingOrnamentDeviceKey(access.base, device)
  if (!isWeddingOrnamentLayoutKey(key)) return { error: 'invalid' as const }
  try {
    await deleteWeddingOrnamentLayout(key)
  } catch {
    return { error: 'unavailable' as const }
  }
  revalidatePath(`/thiep-mau/${access.presetId}`)
  return { ok: true as const }
}

export async function saveWeddingPresetShell(presetId: string, device: WeddingOrnamentDevice, shell: unknown) {
  const access = await assertWeddingPresetEditor(presetId)
  if ('error' in access) return access
  const parsed = parseWeddingDeviceShell(shell)
  if (!parsed || (device !== 'desktop' && device !== 'mobile')) return { error: 'invalid' as const }
  const key = weddingOrnamentDeviceKey(access.base, device)
  if (!isWeddingOrnamentLayoutKey(key)) return { error: 'invalid' as const }
  try {
    await saveWeddingShellLayout({ layoutKey: key, shell: parsed, userId: access.userId })
  } catch {
    return { error: 'unavailable' as const }
  }
  revalidatePath(`/thiep-mau/${access.presetId}`)
  return { ok: true as const, shell: parsed }
}

export async function saveWeddingPresetFrame(
  presetId: string,
  frame: unknown,
  side: 'cover' | 'groom' | 'bride' | 'pair',
) {
  const access = await assertWeddingPresetEditor(presetId)
  if ('error' in access) return access
  if (side !== 'cover' && side !== 'groom' && side !== 'bride' && side !== 'pair') return { error: 'invalid' as const }
  const key = weddingSharedFrameKey(access.base)
  if (!key || !isWeddingSharedFrameKey(key)) return { error: 'invalid' as const }
  const parsed: WeddingSharedFrame | null = frame == null ? null : parseWeddingSharedFrame(frame)
  if (frame != null && !parsed) return { error: 'invalid' as const }
  try {
    if (parsed) await saveWeddingSharedFrame({ layoutKey: key, frame: parsed, userId: access.userId })
    else await deleteWeddingSharedFrame(key)
  } catch {
    return { error: 'unavailable' as const }
  }
  revalidatePath(`/thiep-mau/${access.presetId}`)
  return { ok: true as const, frame: parsed }
}

/** Ghi chữ ngay trên bản xem thử. Vỏ riêng chỉ ghi khi người sửa là khách của thiệp. */
export async function saveWeddingPreviewEdit(
  cardId: string,
  patch: {
    groomName?: string
    brideName?: string
    coupleIntro?: string
    storyText?: string
    thankYouText?: string
    groomInviteAddress?: string
    brideInviteAddress?: string
    groomInviteReceptionTime?: string
    brideInviteReceptionTime?: string
    groomInviteWeddingDate?: string
    brideInviteWeddingDate?: string
    sectionConfig?: string
    textStyles?: unknown
  },
) {
  const access = await assertWeddingCardOrnamentEditor(cardId)
  if ('error' in access) return { error: access.error }
  const existing = await getWeddingCardForUser(cardId, access.ownerUserId)
  if (!existing) return { error: 'denied' as const }
  const date = (value: unknown) => {
    const text = clipPreviewText(value, 10)
    if (text === undefined) return undefined
    return /^\d{4}-\d{2}-\d{2}$/.test(text) || text === '' ? text : undefined
  }
  const next = {
    groomName: clipPreviewText(patch.groomName, 120),
    brideName: clipPreviewText(patch.brideName, 120),
    coupleIntro: clipPreviewText(patch.coupleIntro, 4000),
    storyText: clipPreviewText(patch.storyText, 4000),
    thankYouText: clipPreviewText(patch.thankYouText, 4000),
    groomInviteAddress: clipPreviewText(patch.groomInviteAddress, 500),
    brideInviteAddress: clipPreviewText(patch.brideInviteAddress, 500),
    groomInviteReceptionTime: clipPreviewText(patch.groomInviteReceptionTime, 40),
    brideInviteReceptionTime: clipPreviewText(patch.brideInviteReceptionTime, 40),
    groomInviteWeddingDate: date(patch.groomInviteWeddingDate),
    brideInviteWeddingDate: date(patch.brideInviteWeddingDate),
    sectionConfig: previewSectionConfig(existing.sectionConfig, patch, access.templateEditor),
  }
  try {
    const saved = await patchWeddingCardPreview(cardId, access.ownerUserId, next)
    if (!saved) return { error: 'unavailable' as const }
  } catch {
    return { error: 'unavailable' as const }
  }
  if (access.slug) revalidatePath(`/thiep-moi-cuoi/${access.slug}`)
  return { ok: true as const }
}

export async function resetWeddingBackgroundOrnaments(layoutKey: string) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const userId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const role = await getProfileRoleWithFallback(userId)
  if (!canEditWeddingOrnaments({ role, email: auth.user.email })) return { error: 'denied' as const }
  const key = layoutKey.trim()
  if (key.startsWith('card:') || !isWeddingOrnamentLayoutKey(key)) return { error: 'invalid' as const }
  try {
    await deleteWeddingOrnamentLayout(key)
  } catch {
    return { error: 'unavailable' as const }
  }
  return { ok: true as const }
}

export async function getOrCreateWeddingCard() {
  return loadWeddingCardWorkspace()
}

export async function createNewWeddingCard(occasionKey?: string, heroPhotoLayout?: string) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const ownerUserId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const draft = await createWeddingCardDraft(ownerUserId, 'luxury', occasionKey)
  const stack =
    readHeroPhotoLayout(heroPhotoLayout) === 'stack' && invitationOccasionShape(occasionKey) === 'couple'
  const seeded = stack
    ? (await saveWeddingCardSectionConfig(
        draft.id,
        ownerUserId,
        stringifyWeddingSectionConfig({ heroPhotoLayout: 'stack' }),
      )) ?? draft
    : draft
  const card = (await publishWeddingCard(seeded.id, ownerUserId)) ?? seeded
  if (card.slug) revalidatePath(`/thiep-moi-cuoi/${card.slug}`)
  return weddingCardWorkspace(ownerUserId, card, auth.user.email)
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
    if (uploadedFile instanceof File && uploadedFile.size > 0) {
      const existingTrack = findWeddingMusicInLibrary(await listWeddingMusicLibrary(), uploadedFile.name)
      if (existingTrack) {
        musicUrl = existingTrack.audioUrl
      } else {
        const uploadedMusic = await uploadWeddingMusic(ownerUserId, cardId, uploadedFile)
        if (uploadedMusic) {
          musicUrl = uploadedMusic
          const rawTitle = clean(formData.get('musicTitle'), 120)
          const title = weddingMusicTitleFromFileName(rawTitle || uploadedFile.name)
          await saveWeddingMusicToLibrary({ title, audioUrl: uploadedMusic })
        }
      }
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
    sectionConfig = applyClientWeddingSectionConfig(existing.sectionConfig, sectionConfig)
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
  const published = card.isPublished ? card : await publishWeddingCard(card.id, ownerUserId)
  const saved = published ?? card
  revalidatePath('/tao-thiep-moi-cuoi-ai')
  revalidatePath('/tao-thiep-moi-cuoi-ai/khach-moi')
  revalidatePath(`/thiep-moi-cuoi/${saved.slug}`)
  const musicLibrary = await listWeddingMusicLibrary()
  return { card: saved, musicLibrary }
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

  const priced = imageChargeFromForm(formData, COST)
  if (priced.error) return { error: priced.error }
  if (priced.engine !== 'gpt') {
    return { error: 'Nền thiệp chỉ tạo bằng GPT Image.' }
  }
  if (priced.gptQuality === 'low') {
    return { error: 'Nền thiệp chỉ dùng GPT medium hoặc high.' }
  }
  const imageCost = priced.cost
  const balance = await getCreditBalanceByUserId(userId)
  if (balance < imageCost) {
    return {
      error: `Không đủ credit. Cần ${imageCost} credit để tạo ảnh AI.`,
      code: 'INSUFFICIENT_CREDITS' as const,
    }
  }

  const hasCustomReference =
    Boolean(customReferenceImageUrl) ||
    (customReferenceImageFile instanceof File && customReferenceImageFile.size > 0)

  const chosenStyle = getWeddingStylePreset(clean(formData.get('styleId'), 80) || 'luxury')
  const prompt = buildWeddingPrompt({
    type,
    style: hasCustomReference ? card.selectedStyleId : chosenStyle.id,
    palette: hasCustomReference ? card.colorPalette : chosenStyle.palette,
    groomName: card.groomName,
    brideName: card.brideName,
    venue: card.venue,
    extraPrompt,
    hasReference:
      (type !== 'master' && Boolean(card.masterImageUrl)) ||
      hasCustomReference,
    hasCustomReference,
    canvasLabel: `${WEDDING_GPT_BACKGROUND_SIZE} (1:3)`,
    applyStyle: !hasCustomReference,
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
    const parts: (string | object)[] = [prompt]
    const referenceParts = await Promise.all([
      type !== 'master' ? getReferenceImagePart(card.masterImageUrl) : null,
      getReferenceImagePart(customReferenceImageUrl || null),
      getReferenceImagePartFromFile(customReferenceImageFile),
    ])
    referenceParts.filter(Boolean).forEach((part) => parts.push(part as object))
    const bunnyReady = await ensureBunnyWritableBeforeImageModel()
    if (!bunnyReady.ok) throw new Error(bunnyReady.error)
    const genResult = await runImageContent<GeminiShaped>({
      engine: 'gpt',
      gptQuality: priced.gptQuality,
      aspectRatio: WEDDING_BACKGROUND_ASPECT_RATIO,
      gptSize: WEDDING_GPT_BACKGROUND_SIZE,
      parts,
      gemini: async () => {
        throw new Error('Nền thiệp chỉ tạo bằng GPT Image.')
      },
    })
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
    const charge = await deductUserCredits(userId, imageCost, 'tao-thiep-moi-cuoi-ai')
    if (!charge.ok) {
      if (charge.code === 'INSUFFICIENT_CREDITS') {
        await failWeddingAiImage(imageId, userId, 'Không đủ credit.').catch(() => undefined)
        return { error: 'Không đủ credit để hoàn tất.', code: 'INSUFFICIENT_CREDITS' as const }
      }
      throw new Error(charge.error)
    }
    charged = true
    await completeWeddingAiImage({ imageId, userId, imageUrl: publicUrl, makeMaster: type === 'master' })
    const referenceImageUrl =
      customReferenceImageFile instanceof File && customReferenceImageFile.size > 0
        ? ''
        : await resolveWeddingLibraryReferenceUrl(customReferenceImageUrl, 'frame')
    await saveWeddingBackgroundToLibrary({ imageUrl: publicUrl, imageType: type, referenceImageUrl }).catch(() => undefined)
    revalidatePath('/tao-thiep-moi-cuoi-ai')
    return { success: true, imageId, imageUrl: publicUrl }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (typeof charged !== 'undefined' && charged) {
      await refundUserCredits(userId, imageCost, 'tao-thiep-moi-cuoi-ai').catch(() => undefined)
    }
    await failWeddingAiImage(imageId, userId, message).catch(() => undefined)
    if (/không đủ credit/i.test(message)) {
      return { error: message, code: 'INSUFFICIENT_CREDITS' as const }
    }
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
  const customReferenceImageUrl = clean(formData.get('customReferenceImageUrl'), 1000)
  const customReferenceImageFile = formData.get('customReferenceImage')
  const hasCustomReference =
    Boolean(customReferenceImageUrl) ||
    (customReferenceImageFile instanceof File && customReferenceImageFile.size > 0)
  const card = await getWeddingCardForUser(cardId, userId)
  if (!card) return { error: 'Không tìm thấy thiệp.' }

  const priced = imageChargeFromForm(formData, COST)
  if (priced.error) return { error: priced.error }
  const imageCost = priced.cost
  const frameCost = requiredCreditsForLogoCreate(imageCost, true)
  const balance = await getCreditBalanceByUserId(userId)
  if (balance < frameCost) {
    return {
      error: `Không đủ credit. Cần ${frameCost} credit để vẽ khung và đục lỗ.`,
      code: 'INSUFFICIENT_CREDITS' as const,
    }
  }

  const frameStyle = getWeddingStylePreset(clean(formData.get('styleId'), 80) || 'luxury')
  const prompt = buildWeddingCoverFramePrompt({
    styleLabel: hasCustomReference ? '' : frameStyle.label.en,
    palette: hasCustomReference ? '' : frameStyle.palette,
    extraPrompt,
    openingShape,
    hasReference: hasCustomReference,
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
    let model: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null = null
    if (priced.engine !== 'gpt') {
      const genAI = new GoogleGenerativeAI((await requireGoogleApiKeyForUser(userId)).apiKey)
      model = genAI.getGenerativeModel({
        model: GEMINI_3_PRO_IMAGE.model,
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: { imageSize: '2K', aspectRatio: '3:4' },
        },
      })
    }
    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    ]
    const bunnyReady = await ensureBunnyWritableBeforeImageModel()
    if (!bunnyReady.ok) throw new Error(bunnyReady.error)
    const parts: (string | object)[] = [prompt]
    const referenceParts = await Promise.all([
      getReferenceImagePart(customReferenceImageUrl || null),
      getReferenceImagePartFromFile(customReferenceImageFile),
    ])
    referenceParts.filter(Boolean).forEach((part) => parts.push(part as object))
    const genResult = await runImageContent({
      engine: priced.engine,
      gptQuality: priced.gptQuality,
      aspectRatio: '3:4',
      parts,
      gemini: () => model!.generateContent(parts as never, { safetySettings } as never),
    })
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
    const chargeAmount = chargedCreditsForLogoCreate(imageCost, true)
    const charge = await deductUserCredits(userId, chargeAmount, 'tao-thiep-moi-cuoi-ai')
    if (!charge.ok) {
      if (charge.code === 'INSUFFICIENT_CREDITS') {
        return { error: 'Không đủ credit để hoàn tất.', code: 'INSUFFICIENT_CREDITS' as const }
      }
      throw new Error(charge.error)
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
    const referenceImageUrl =
      customReferenceImageFile instanceof File && customReferenceImageFile.size > 0
        ? ''
        : await resolveWeddingLibraryReferenceUrl(customReferenceImageUrl, 'background')
    const libraryItem = await saveWeddingCoverFrameToLibrary({
      imageUrl: publicUrl,
      hole,
      panel: COVER_AI_FRAME_PANEL,
      ink: 'dark',
      referenceImageUrl,
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
      creditsCharged: chargeAmount,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (charged) {
      await refundUserCredits(userId, chargedCreditsForLogoCreate(imageCost, true), 'tao-thiep-moi-cuoi-ai').catch(() => undefined)
    }
    if (/không đủ credit/i.test(message)) {
      return { error: message, code: 'INSUFFICIENT_CREDITS' as const }
    }
    return { error: `Tạo khung thất bại, credit chưa bị trừ: ${message}` }
  }
}

const PRIVATE_BACKGROUND_MAX_BYTES = 8 * 1024 * 1024

export async function uploadWeddingOrnamentImage(formData: FormData) {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  const userId = await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)
  const file = formData.get('file')
  if (!(file instanceof File) || file.size <= 0) return { error: 'Chọn một file ảnh hoa văn.' }
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return { error: 'File phải là ảnh hoa văn (PNG, JPG, WEBP).' }
  if (file.size > PRIVATE_BACKGROUND_MAX_BYTES) return { error: 'Ảnh quá lớn. Tối đa 8 MB.' }
  const ext = file.type.includes('png')
    ? 'png'
    : file.type.includes('webp')
      ? 'webp'
      : file.type.includes('gif')
        ? 'gif'
        : 'jpg'
  const path = `uploads/${userId}/wedding_ornament_${Date.now()}.${ext}`
  const { publicUrl } = await uploadTryOnImagePublic(path, file, {
    contentType: file.type || 'image/png',
    upsert: true,
  })
  return { ok: true as const, url: publicUrl }
}

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
            ? 'Không đủ credit. Mỗi lần Tối ưu AI tốn 0,1 credit.'
            : charge.error,
        ...(charge.code === 'INSUFFICIENT_CREDITS' ? { code: 'INSUFFICIENT_CREDITS' as const } : {}),
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

export async function composeWeddingSampleCopy(formData: FormData): Promise<
  | ({ charged: number } & WeddingSampleComposeCopy)
  | { error: string; code?: 'INSUFFICIENT_CREDITS' }
> {
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { error: auth.error }
  await ensureWeddingCardOwnerProfile(auth.user.id, auth.user.email)

  const occasionKey = normalizeInvitationOccasion(clean(formData.get('occasionKey'), 40))
  const groomName = clean(formData.get('groomName'), 120)
  const brideName = clean(formData.get('brideName'), 120)
  const storyNotes = clean(formData.get('storyNotes'), MAX_TEXT)
  if (occasionKey === 'wedding') {
    if (!groomName || !brideName) return { error: 'Điền đủ tên cô dâu và chú rể.' }
  } else if (!groomName) {
    return { error: 'Điền tên người được ghi trên thiệp.' }
  }

  const charge = await deductUserCredits(auth.user.id, WEDDING_SAMPLE_COMPOSE_CREDIT, 'wedding-card-sample-compose')
  if (!charge.ok) {
    return {
      error:
        charge.code === 'INSUFFICIENT_CREDITS'
          ? 'Không đủ credit.'
          : charge.error,
      ...(charge.code === 'INSUFFICIENT_CREDITS' ? { code: 'INSUFFICIENT_CREDITS' as const } : {}),
    }
  }

  const result = await composeWeddingSampleCopyWithDeepseek({
    groomName,
    brideName,
    storyNotes,
    weddingDate: clean(formData.get('weddingDate'), 120),
    occasionKey,
    userId: auth.user.id,
  })
  if ('error' in result) {
    if (charge.charged > 0) {
      await refundUserCredits(auth.user.id, charge.charged, 'wedding-card-sample-compose').catch(() => undefined)
    }
    return { error: result.error }
  }
  return { ...result.copy, charged: charge.charged }
}
