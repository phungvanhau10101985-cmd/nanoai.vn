/**
 * OAuth2 access token từ service account (JWT) — dùng chung Vision, Storage JSON API, v.v.
 */

import fs from 'fs'
import path from 'path'
import * as jose from 'jose'

const cache = new Map<string, { token: string; exp: number }>()

function resolveCredentialsPath(): string {
  const credPath =
    process.env.VISION_CREDENTIALS_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.join(process.cwd(), 'gcp-credentials.json')
  return path.isAbsolute(credPath) ? credPath : path.resolve(process.cwd(), credPath)
}

export function hasGoogleSaCredentialsFile(): boolean {
  try {
    return fs.existsSync(resolveCredentialsPath())
  } catch {
    return false
  }
}

/**
 * @param scopes — ví dụ ['https://www.googleapis.com/auth/cloud-vision']
 */
export async function getGoogleAccessToken(scopes: string[]): Promise<string> {
  const scopeKey = [...scopes].sort().join(' ')
  const hit = cache.get(scopeKey)
  if (hit && hit.exp > Date.now() + 60_000) return hit.token

  const resolvedPath = resolveCredentialsPath()
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`GCP: Không tìm thấy file credentials: ${resolvedPath}`)
  }

  const raw = fs.readFileSync(resolvedPath, 'utf8').replace(/^\uFEFF/, '')
  const cred = JSON.parse(raw) as { private_key?: string; client_email?: string }
  const privateKey = (cred.private_key || '')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim()
  if (!privateKey || !cred.client_email) {
    throw new Error('GCP: File credentials thiếu client_email hoặc private_key')
  }
  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    throw new Error('GCP: private_key không đúng format PEM')
  }

  let key: Awaited<ReturnType<typeof jose.importPKCS8>>
  try {
    key = await jose.importPKCS8(privateKey, 'RS256')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`GCP: Lỗi đọc private key: ${msg}`)
  }

  const now = Math.floor(Date.now() / 1000)
  const jwt = await new jose.SignJWT({ scope: scopeKey })
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
    throw new Error(`GCP auth failed: ${res.status} ${err}`)
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }
  const entry = { token: data.access_token, exp: Date.now() + data.expires_in * 1000 }
  cache.set(scopeKey, entry)
  return entry.token
}

export function readGcpProjectIdFromEnvOrCredentials(): string {
  const fromEnv = process.env.GOOGLE_CLOUD_PROJECT_ID?.trim()
  if (fromEnv) return fromEnv
  try {
    const resolvedPath = resolveCredentialsPath()
    if (!fs.existsSync(resolvedPath)) return ''
    const raw = fs.readFileSync(resolvedPath, 'utf8').replace(/^\uFEFF/, '')
    const cred = JSON.parse(raw) as { project_id?: string }
    return cred.project_id?.trim() ?? ''
  } catch {
    return ''
  }
}
