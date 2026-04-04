/**
 * Google Cloud Vision API – shared client.
 * Dùng cho face detection (thử đồ) và document OCR (dịch ảnh tài liệu).
 */

import fs from 'fs'
import path from 'path'
import { getGoogleAccessToken } from '@/lib/google-sa-token'
import { trackApiUsage } from '@/lib/track-ai-usage'

const VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate'
const VISION_SCOPE = 'https://www.googleapis.com/auth/cloud-vision'

/** Kiểm tra đã cấu hình Vision API chưa – chỉ service account (OAuth2), API key không hỗ trợ. */
export function hasVisionConfig(): boolean {
  return !!(
    process.env.VISION_CREDENTIALS_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    fs.existsSync(path.join(process.cwd(), 'gcp-credentials.json'))
  )
}

/** Lấy access token qua JWT – dùng chung cho mọi Vision API call */
export async function getVisionAccessToken(): Promise<string> {
  return getGoogleAccessToken([VISION_SCOPE])
}

/** Ghi `api_usage_log` sau khi annotate thành công (1 unit / request — Vision không trả token). */
export type VisionUsageLog = {
  userId?: string | null
  feature: string
}

/** Gọi Vision API annotate – 1 ảnh, 1 hoặc nhiều feature. Chỉ OAuth2 (service account). */
export async function visionAnnotate(
  imageBuffer: Buffer,
  features: Array<{ type: string; maxResults?: number }>,
  usage?: VisionUsageLog | null
): Promise<unknown> {
  const token = await getVisionAccessToken()
  const res = await fetch(VISION_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      requests: [{
        image: { content: imageBuffer.toString('base64').replace(/\s/g, '') },
        features,
      }],
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    if (res.status === 403 && (errText.includes('has not been used') || errText.includes('disabled'))) {
      throw new Error('Cloud Vision API chưa bật. Bật tại: https://console.cloud.google.com/apis/library/vision.googleapis.com')
    }
    throw new Error(`Vision API lỗi (HTTP ${res.status}): ${errText.slice(0, 200)}`)
  }

  const data = (await res.json()) as { responses?: Array<{ error?: { message: string } }> }
  const r = data.responses?.[0]
  if (r?.error) throw new Error(`Vision API: ${r.error.message}`)
  if (usage?.feature) {
    void trackApiUsage({
      userId: usage.userId ?? null,
      model: 'google-cloud-vision',
      feature: usage.feature,
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 1,
    })
  }
  return data
}
