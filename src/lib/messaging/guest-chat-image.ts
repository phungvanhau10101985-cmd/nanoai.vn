import type { Json } from '@/types/database.types'
import { fetchImageWith1688Bypass, is1688ImageUrl, normalizeAlicdnImageUrl } from '@/lib/fetch-image-1688'
import { tryOnObjectExistsByPath, uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'

export const GUEST_CHAT_IMAGE_MAX_BYTES = 10 * 1024 * 1024

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

/** Tránh SSRF khi server tải ảnh từ URL shop (ctx_image). */
function isPublicHttpUrlSafeForServerFetch(raw: string): boolean {
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
    const host = parsed.hostname.toLowerCase()
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return false
    if (host.startsWith('[')) return false
    const oct = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
    if (oct) {
      const a = Number(oct[1])
      const b = Number(oct[2])
      if (a === 10) return false
      if (a === 127) return false
      if (a === 0) return false
      if (a === 172 && b >= 16 && b <= 31) return false
      if (a === 192 && b === 168) return false
      if (a === 169 && b === 254) return false
    }
    return true
  } catch {
    return false
  }
}

function sniffImageMimeFromMagic(buf: Buffer): string | null {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif'
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'image/webp'
  }
  return null
}

/**
 * Tải ảnh HTTPS công khai (link sản phẩm) → bucket guest — cùng đường như khách upload ảnh tư vấn.
 * Dùng khi POST có `pageContext.imageUrl` mà không có `imageStoragePath`.
 */
export async function fetchRemoteProductImageIntoGuestStorage(
  partnerId: string,
  imageUrl: string
): Promise<{ path: string; publicUrl: string } | { error: string }> {
  const trimmed = normalizeAlicdnImageUrl(imageUrl.trim())
  if (!/^https?:\/\//i.test(trimmed)) {
    return { error: 'Image URL must be http(s).' }
  }
  if (!isPublicHttpUrlSafeForServerFetch(trimmed)) {
    return { error: 'Invalid image URL.' }
  }
  try {
    let buf: Buffer
    if (is1688ImageUrl(trimmed)) {
      buf = await fetchImageWith1688Bypass(trimmed)
    } else {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 25_000)
      try {
        const res = await fetch(trimmed, {
          redirect: 'follow',
          signal: ctrl.signal,
          headers: { Accept: 'image/*', 'User-Agent': 'NanoAI-Widget/1.0' },
        })
        if (!res.ok) {
          return { error: `Could not download image (${res.status}).` }
        }
        buf = Buffer.from(await res.arrayBuffer())
      } finally {
        clearTimeout(timer)
      }
    }
    if (buf.length > GUEST_CHAT_IMAGE_MAX_BYTES) {
      return { error: 'Image too large.' }
    }
    if (buf.length < 32) {
      return { error: 'Invalid image.' }
    }
    let mime = sniffImageMimeFromMagic(buf) ?? ''
    if (!mime || !isAllowedGuestImageMime(mime)) {
      return { error: 'Unsupported image type.' }
    }
    return uploadGuestChatImageBuffer(partnerId, buf, mime)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: msg || 'Download failed.' }
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

/** Tin widget có ảnh khách upload — không dùng nhánh «SP đã tư vấn»; carousel phải là kết quả tìm theo ảnh. */
export function inboundBodyHasCustomerUploadedImage(body: string): boolean {
  return /\[Customer image:\s*https?:\/\//i.test(body)
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
  page_context?: {
    sku?: string
    inventory_id?: string
    image_url?: string
    product_url?: string
    source?: string
  }
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
  const pc = pl?.page_context
  const pageAnchorSku =
    pc && typeof pc === 'object' && !Array.isArray(pc) && typeof pc.sku === 'string'
      ? pc.sku.trim().slice(0, 128)
      : ''
  const pageAnchorInvRaw =
    pc && typeof pc === 'object' && !Array.isArray(pc) && typeof pc.inventory_id === 'string'
      ? pc.inventory_id.trim()
      : ''
  const pageAnchorInventoryId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pageAnchorInvRaw) ? pageAnchorInvRaw : ''
  const suppressVisionMatchBecausePageAnchored =
    Boolean(pageAnchorSku.length >= 2) || Boolean(pageAnchorInventoryId)
  const sid = pl?.vision_selected_inventory_id?.trim()
  const label = pl?.vision_selected_product_label?.trim()
  if (sid && label && !suppressVisionMatchBecausePageAnchored) {
    t += `\n[Customer confirmed product from image match: ${label} (inventory id: ${sid})]`
  }
  if (pc && typeof pc === 'object' && !Array.isArray(pc)) {
    const hintLines: string[] = []
    const sku = typeof pc.sku === 'string' ? pc.sku.trim().slice(0, 128) : ''
    if (sku) hintLines.push(`[Customer product SKU: ${sku}]`)
    const productUrl = typeof pc.product_url === 'string' ? pc.product_url.trim() : ''
    if (productUrl && /^https?:\/\//i.test(productUrl)) {
      hintLines.push(`[Customer product URL: ${productUrl}]`)
    }
    const productImg = typeof pc.image_url === 'string' ? pc.image_url.trim() : ''
    if (productImg && /^https?:\/\//i.test(productImg) && !url) {
      hintLines.push(`[Customer product image: ${productImg}]`)
    }
    if (hintLines.length) t = [t, ...hintLines].filter(Boolean).join('\n')
  }
  return t
}
