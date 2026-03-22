/**
 * Google Cloud Vision API – shared client.
 * Dùng cho face detection (thử đồ) và document OCR (dịch ảnh tài liệu).
 */

import fs from 'fs'
import path from 'path'
import * as jose from 'jose'

const VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate'

let cachedToken: { token: string; exp: number } | null = null

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
  if (cachedToken && cachedToken.exp > Date.now() + 60000) {
    return cachedToken.token
  }

  const credPath =
    process.env.VISION_CREDENTIALS_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.join(process.cwd(), 'gcp-credentials.json')

  const resolvedPath = path.isAbsolute(credPath) ? credPath : path.resolve(process.cwd(), credPath)

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Vision: Không tìm thấy file credentials: ${resolvedPath}`)
  }

  const raw = fs.readFileSync(resolvedPath, 'utf8').replace(/^\uFEFF/, '')
  const cred = JSON.parse(raw)
  const privateKey = (cred.private_key || '')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim()
  if (!privateKey || !cred.client_email) {
    throw new Error('Vision: File credentials thiếu client_email hoặc private_key')
  }
  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    throw new Error('Vision: private_key không đúng format PEM')
  }

  let key: Awaited<ReturnType<typeof jose.importPKCS8>>
  try {
    key = await jose.importPKCS8(privateKey, 'RS256')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`Vision: Lỗi đọc private key: ${msg}`)
  }

  const now = Math.floor(Date.now() / 1000)
  const jwt = await new jose.SignJWT({ scope: 'https://www.googleapis.com/auth/cloud-vision' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(cred.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .setSubject(cred.client_email)
    .sign(key)

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Vision auth failed: ${res.status} ${err}`)
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = { token: data.access_token, exp: Date.now() + data.expires_in * 1000 }
  return cachedToken.token
}

/** Gọi Vision API annotate – 1 ảnh, 1 hoặc nhiều feature. Chỉ OAuth2 (service account). */
export async function visionAnnotate(
  imageBuffer: Buffer,
  features: Array<{ type: string; maxResults?: number }>
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
  return data
}
