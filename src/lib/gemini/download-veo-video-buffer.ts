import { readFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomBytes } from 'crypto'
import type { GoogleGenAI, Video } from '@google/genai'

const GEMINI_FILE_DOWNLOAD_BASE = 'https://generativelanguage.googleapis.com/v1beta/files'

/**
 * Lấy id tài nguyên `files/*` từ URI Gemini (ổn định hơn cách trích trong SDK khi id có dấu `-` hoặc path lạ).
 */
function extractGeminiFileIdFromUri(uri: string): string | null {
  const i = uri.indexOf('/files/')
  if (i < 0) return null
  const rest = uri.slice(i + '/files/'.length)
  const id = rest.split(/[/?#:]/)[0]?.trim()
  return id && id.length > 0 ? id : null
}

async function downloadViaGeminiFilesApi(fileId: string, apiKey: string): Promise<Buffer | null> {
  const url = `${GEMINI_FILE_DOWNLOAD_BASE}/${encodeURIComponent(fileId)}:download?alt=media`
  const r = await fetch(url, { headers: { 'x-goog-api-key': apiKey } })
  if (!r.ok) return null
  return Buffer.from(await r.arrayBuffer())
}

/**
 * Tải MP4 từ object video trả về sau generateVideos / extend.
 * Thứ tự: videoBytes → SDK `files.download` → REST `files/{id}:download` → fetch URI + key.
 */
export async function downloadVeoVideoToBuffer(
  ai: GoogleGenAI,
  video: Pick<Video, 'uri' | 'videoBytes'>,
  apiKey: string
): Promise<Buffer> {
  if (video.videoBytes && video.videoBytes.length > 0) {
    return Buffer.from(video.videoBytes, 'base64')
  }
  const uri = typeof video.uri === 'string' && video.uri.length > 0 ? video.uri : null
  if (!uri) {
    throw new Error('Không lấy được dữ liệu video.')
  }

  const tmp = join(tmpdir(), `veo_${Date.now()}_${randomBytes(8).toString('hex')}.mp4`)
  let sdkErr = ''
  try {
    await ai.files.download({ file: video as Video, downloadPath: tmp })
    const buf = await readFile(tmp)
    if (buf.length > 0) return buf
    sdkErr = 'File tải về rỗng.'
  } catch (e) {
    sdkErr = e instanceof Error ? e.message : String(e)
  } finally {
    await unlink(tmp).catch(() => {})
  }

  const fileId = extractGeminiFileIdFromUri(uri)
  if (fileId) {
    const viaApi = await downloadViaGeminiFilesApi(fileId, apiKey)
    if (viaApi && viaApi.length > 0) return viaApi
  }

  let downloadUrl = uri
  try {
    const u = new URL(uri)
    if (!u.searchParams.has('key')) u.searchParams.set('key', apiKey)
    downloadUrl = u.toString()
  } catch {
    /* giữ nguyên uri */
  }
  const downloadResp = await fetch(downloadUrl, {
    headers: { 'x-goog-api-key': apiKey },
  })
  if (downloadResp.ok) {
    const buf = Buffer.from(await downloadResp.arrayBuffer())
    if (buf.length > 0) return buf
    throw new Error('Không tải được video: phản hồi rỗng.')
  }

  const status = downloadResp.status
  if (status === 502 || status === 503 || status === 504) {
    throw new Error(
      'Không tải được video từ Google (dịch vụ tạm bận). Hãy thử lại sau vài phút.'
    )
  }
  const brief =
    status === 403 || status === 401
      ? 'Từ chối truy cập (kiểm tra API key / hạn mức).'
      : status === 404
        ? 'Liên kết video không còn hợp lệ (có thể đã hết hạn).'
        : `Mã HTTP ${status}.`
  const sdkTail = (() => {
    const s = sdkErr.trim()
    if (!s) return ''
    if (s.includes('{"error"') || s.length > 200) return ''
    return ` (${s})`
  })()
  throw new Error(`Không tải được video. ${brief}${sdkTail}`)
}
