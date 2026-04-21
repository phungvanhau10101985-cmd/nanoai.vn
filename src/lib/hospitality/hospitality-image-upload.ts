import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'

export const HOSPITALITY_IMAGE_MAX_BYTES = 10 * 1024 * 1024

const MIME_TO_EXT = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
])

export function isAllowedHospitalityImageMime(mime: string): boolean {
  return MIME_TO_EXT.has(mime)
}

export function hospitalityImageMimeToExt(mime: string): string | null {
  return MIME_TO_EXT.get(mime) ?? null
}

export function buildHospitalityRoomImageStoragePath(
  partnerId: string,
  roomId: string,
  ext: string
): string {
  const clean = ext.replace(/^\./, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const id = crypto.randomUUID()
  return `hospitality/${partnerId}/rooms/${roomId}/${id}.${clean}`
}

export async function uploadHospitalityRoomImageBuffer(
  partnerId: string,
  roomId: string,
  buffer: Buffer,
  mime: string
): Promise<{ path: string; publicUrl: string } | { error: string }> {
  const ext = hospitalityImageMimeToExt(mime)
  if (!ext) return { error: 'Unsupported image type.' }
  if (buffer.length > HOSPITALITY_IMAGE_MAX_BYTES) {
    return { error: 'Image too large.' }
  }
  const path = buildHospitalityRoomImageStoragePath(partnerId, roomId, ext)
  try {
    const { publicUrl } = await uploadTryOnImagePublic(path, buffer, { contentType: mime })
    return { path, publicUrl }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Upload failed.' }
  }
}
