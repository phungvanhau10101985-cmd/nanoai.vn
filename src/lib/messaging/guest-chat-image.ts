import type { Json } from '@/types/database.types'
import { tryOnObjectExistsByPath, uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'

export const GUEST_CHAT_IMAGE_MAX_BYTES = 3 * 1024 * 1024

export const GUEST_CHAT_IMAGE_BUCKET = 'try-on-images'

const MIME_TO_EXT = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
])

export function guestImageMimeToExt(mime: string): string | null {
  return MIME_TO_EXT.get(mime) ?? null
}

export function isAllowedGuestImageMime(mime: string): boolean {
  return MIME_TO_EXT.has(mime)
}

export function buildGuestMessagingStoragePath(partnerId: string, ext: string): string {
  const clean = ext.replace(/^\./, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const id = crypto.randomUUID()
  return `messaging-guest/${partnerId}/${id}.${clean}`
}

/** Ảnh shop gửi khách (dashboard) — cùng bucket public như ảnh khách. */
export function buildPartnerMessagingStoragePath(partnerId: string, ext: string): string {
  const clean = ext.replace(/^\./, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const id = crypto.randomUUID()
  return `messaging-partner/${partnerId}/${id}.${clean}`
}

export function isPartnerMessagingStoragePathForPartner(path: string, partnerId: string): boolean {
  const prefix = `messaging-partner/${partnerId}/`
  if (!path.startsWith(prefix) || path.length > 480) return false
  if (path.includes('..') || path.includes('//')) return false
  return true
}

export function isGuestMessagingStoragePathForPartner(path: string, partnerId: string): boolean {
  const prefix = `messaging-guest/${partnerId}/`
  if (!path.startsWith(prefix) || path.length > 480) return false
  if (path.includes('..') || path.includes('//')) return false
  return true
}

export function mimeFromGuestImagePath(path: string): string {
  const lower = path.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}

export async function guestImageObjectExists(path: string): Promise<boolean> {
  return tryOnObjectExistsByPath(path)
}

export async function uploadGuestChatImageBuffer(
  partnerId: string,
  buffer: Buffer,
  mime: string
): Promise<{ path: string; publicUrl: string } | { error: string }> {
  const ext = guestImageMimeToExt(mime)
  if (!ext) return { error: 'Unsupported image type.' }
  if (buffer.length > GUEST_CHAT_IMAGE_MAX_BYTES) {
    return { error: 'Image too large.' }
  }
  const path = buildGuestMessagingStoragePath(partnerId, ext)
  try {
    const { publicUrl } = await uploadTryOnImagePublic(path, buffer, { contentType: mime })
    return { path, publicUrl }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Upload failed.' }
  }
}

export async function uploadPartnerChatImageBuffer(
  partnerId: string,
  buffer: Buffer,
  mime: string
): Promise<{ path: string; publicUrl: string } | { error: string }> {
  const ext = guestImageMimeToExt(mime)
  if (!ext) return { error: 'Unsupported image type.' }
  if (buffer.length > GUEST_CHAT_IMAGE_MAX_BYTES) {
    return { error: 'Image too large.' }
  }
  const path = buildPartnerMessagingStoragePath(partnerId, ext)
  try {
    const { publicUrl } = await uploadTryOnImagePublic(path, buffer, { contentType: mime })
    return { path, publicUrl }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Upload failed.' }
  }
}

export type GuestMediaRawPayload = {
  guest_media: {
    kind: 'image'
    url: string
    storage_path: string
    mime: string
  }
}

export function buildGuestMediaPayload(
  publicUrl: string,
  storagePath: string,
  mime: string
): GuestMediaRawPayload {
  return {
    guest_media: {
      kind: 'image',
      url: publicUrl,
      storage_path: storagePath,
      mime,
    },
  }
}

/** Cùng cấu trúc guest_media; key riêng để phân biệt nguồn khi debug. */
export type PartnerMediaRawPayload = {
  partner_media: {
    kind: 'image'
    url: string
    storage_path: string
    mime: string
  }
}

export function buildPartnerMediaPayload(
  publicUrl: string,
  storagePath: string,
  mime: string
): PartnerMediaRawPayload {
  return {
    partner_media: {
      kind: 'image',
      url: publicUrl,
      storage_path: storagePath,
      mime,
    },
  }
}

export function guestMediaPayloadToJson(p: GuestMediaRawPayload): Json {
  return p as unknown as Json
}

export function partnerMediaPayloadToJson(p: PartnerMediaRawPayload): Json {
  return p as unknown as Json
}

/** Plain text cho FAQ / AI (kèm URL ảnh nếu có). */
export function inboundTextForPartnerAi(textBody: string, imagePublicUrl?: string | null): string {
  const caption = textBody.replace(/^📷\s*/u, '').trim()
  if (imagePublicUrl) {
    const parts = [caption, `[Customer image: ${imagePublicUrl}]`].filter(Boolean)
    return parts.join('\n')
  }
  return textBody
}

type VisionPickRaw = {
  guest_media?: { kind?: string; url?: string }
  image_caption?: string
  vision_selected_inventory_id?: string
  vision_selected_product_label?: string
}

const VISION_SELECTED_HINT_PREFIX = '[Customer confirmed product from image match:'

export function inboundTextHasVisionSelectionHint(textBody: string): boolean {
  return textBody.includes(VISION_SELECTED_HINT_PREFIX)
}

/** FAQ + LLM: kèm URL ảnh và (nếu có) sản phẩm khách chọn sau Vision Warehouse / tìm theo ảnh. */
export function latestInboundTextForPartnerAi(textBody: string, rawPayload: Json | null): string {
  const pl = rawPayload as VisionPickRaw | null
  const url = pl?.guest_media?.kind === 'image' ? pl.guest_media.url : undefined
  const payloadCaption = typeof pl?.image_caption === 'string' ? pl.image_caption.trim() : ''
  const normalizedTextBody =
    textBody.trim() === '📷' && payloadCaption
      ? `📷 ${payloadCaption}`
      : textBody
  let t = inboundTextForPartnerAi(normalizedTextBody, url ?? null)
  const sid = pl?.vision_selected_inventory_id?.trim()
  const label = pl?.vision_selected_product_label?.trim()
  if (sid && label) {
    t += `\n[Customer confirmed product from image match: ${label} (inventory id: ${sid})]`
  }
  return t
}
