import { MEETING_RECORDINGS_BUCKET } from '@/lib/meeting-recording-config'
import { bunnyStorageConfigured } from '@/lib/storage/try-on-public-upload'

function requireMeetingBunnyStorage(): void {
  if (!bunnyStorageConfigured()) {
    throw new Error(
      'Thiếu Bunny Storage (BUNNY_STORAGE_ZONE, BUNNY_STORAGE_API_KEY, BUNNY_STORAGE_PUBLIC_BASE_URL).'
    )
  }
}

/** Khóa object trên Bunny: `meeting-recordings` + từng segment encode. */
export function meetingRecordingBunnyStorageKey(logicalPath: string): string {
  const clean = logicalPath.replace(/^\/+/, '')
  const parts = [MEETING_RECORDINGS_BUCKET, ...clean.split('/').filter(Boolean)]
  return parts.map((s) => encodeURIComponent(s)).join('/')
}

function bunnyGetPutUrls(logicalPath: string): { zone: string; accessKey: string; remoteKey: string } {
  const zone = process.env.BUNNY_STORAGE_ZONE!.trim()
  const accessKey = process.env.BUNNY_STORAGE_API_KEY!.trim()
  const remoteKey = meetingRecordingBunnyStorageKey(logicalPath)
  return { zone, accessKey, remoteKey }
}

/** PUT lên Bunny (script migrate / nội bộ). */
export async function uploadMeetingRecordingToBunnyOnly(
  logicalPath: string,
  buf: Buffer,
  mimeType: string
): Promise<void> {
  if (!bunnyStorageConfigured()) {
    throw new Error('Thiếu BUNNY_STORAGE_ZONE / BUNNY_STORAGE_API_KEY / BUNNY_STORAGE_PUBLIC_BASE_URL')
  }
  const clean = logicalPath.replace(/^\/+/, '')
  const { zone, accessKey, remoteKey } = bunnyGetPutUrls(clean)
  const putUrl = `https://storage.bunnycdn.com/${encodeURIComponent(zone)}/${remoteKey}`
  const res = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      AccessKey: accessKey,
      'Content-Type': mimeType.split(';')[0].trim() || 'application/octet-stream',
    },
    body: new Uint8Array(buf),
  })
  if (!res.ok) {
    const hint = await res.text().catch(() => '')
    throw new Error(`Bunny meeting-recording upload failed (${res.status}): ${hint.slice(0, 240)}`)
  }
}

export async function uploadMeetingRecordingObject(
  logicalPath: string,
  buf: Buffer,
  mimeType: string
): Promise<void> {
  const clean = logicalPath.replace(/^\/+/, '')
  requireMeetingBunnyStorage()
  await uploadMeetingRecordingToBunnyOnly(clean, buf, mimeType)
}

/** Đọc file bản ghi từ Bunny (Storage API, AccessKey). */
export async function downloadMeetingRecordingBuffer(logicalPath: string): Promise<Buffer> {
  requireMeetingBunnyStorage()
  const clean = logicalPath.replace(/^\/+/, '')
  const { zone, accessKey, remoteKey } = bunnyGetPutUrls(clean)
  const getUrl = `https://storage.bunnycdn.com/${encodeURIComponent(zone)}/${remoteKey}`
  const res = await fetch(getUrl, { headers: { AccessKey: accessKey } })
  if (!res.ok) {
    const hint = await res.text().catch(() => '')
    throw new Error(`Bunny meeting download failed (${res.status}): ${hint.slice(0, 240)}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

/** Xóa object trên Bunny. */
export async function removeMeetingRecordingObjects(logicalPaths: string[]): Promise<void> {
  requireMeetingBunnyStorage()
  const uniq = [...new Set(logicalPaths.map((p) => p.replace(/^\/+/, '').trim()).filter(Boolean))]
  if (uniq.length === 0) return

  const zone = process.env.BUNNY_STORAGE_ZONE!.trim()
  const accessKey = process.env.BUNNY_STORAGE_API_KEY!.trim()
  for (const path of uniq) {
    const remoteKey = meetingRecordingBunnyStorageKey(path)
    const delUrl = `https://storage.bunnycdn.com/${encodeURIComponent(zone)}/${remoteKey}`
    try {
      const res = await fetch(delUrl, { method: 'DELETE', headers: { AccessKey: accessKey } })
      if (!res.ok && res.status !== 404) {
        const hint = await res.text().catch(() => '')
        console.warn('[removeMeetingRecordingObjects] Bunny DELETE', path, res.status, hint.slice(0, 200))
      }
    } catch (e) {
      console.warn('[removeMeetingRecordingObjects] Bunny DELETE error', path, e)
    }
  }
}
