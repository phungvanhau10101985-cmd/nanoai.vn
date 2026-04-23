'use client'

export type LiveIceConfig = {
  rtcConfig: RTCConfiguration
  hasTurn: boolean
}

function parseCsv(value: string | undefined): string[] {
  return String(value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

function parseJsonIceServers(raw: string | undefined): RTCIceServer[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((row) => row && typeof row === 'object')
      .map((row) => row as RTCIceServer)
      .filter((row) => {
        const urls = row.urls
        if (typeof urls === 'string') return urls.trim().length > 0
        if (Array.isArray(urls)) return urls.some((u) => typeof u === 'string' && u.trim().length > 0)
        return false
      })
  } catch {
    return []
  }
}

function normalizeIceServers(list: RTCIceServer[]): RTCIceServer[] {
  const seen = new Set<string>()
  const out: RTCIceServer[] = []
  for (const row of list) {
    const urls = row.urls
    const urlsArr = typeof urls === 'string' ? [urls] : Array.isArray(urls) ? urls : []
    const cleaned = urlsArr
      .map((u) => String(u || '').trim())
      .filter(Boolean)
    if (cleaned.length <= 0) continue
    const key = JSON.stringify([
      cleaned.sort(),
      typeof row.username === 'string' ? row.username : '',
      typeof row.credential === 'string' ? row.credential : '',
    ])
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      urls: cleaned,
      ...(typeof row.username === 'string' ? { username: row.username } : {}),
      ...(typeof row.credential === 'string' ? { credential: row.credential } : {}),
    })
  }
  return out
}

function hasTurnUrl(server: RTCIceServer): boolean {
  const urls = typeof server.urls === 'string' ? [server.urls] : Array.isArray(server.urls) ? server.urls : []
  return urls.some((u) => /^turns?:/i.test(String(u || '').trim()))
}

/**
 * Ưu tiên cấu hình từ env:
 * 1) NEXT_PUBLIC_WEBRTC_ICE_SERVERS_JSON (JSON array RTCIceServer)
 * 2) NEXT_PUBLIC_TURN_URLS + NEXT_PUBLIC_TURN_USERNAME + NEXT_PUBLIC_TURN_CREDENTIAL
 * Fallback mặc định: STUN Google.
 */
export function getLiveIceConfig(options?: { preferRelay?: boolean }): LiveIceConfig {
  const fromJson = parseJsonIceServers(process.env.NEXT_PUBLIC_WEBRTC_ICE_SERVERS_JSON)
  const turnUrls = parseCsv(process.env.NEXT_PUBLIC_TURN_URLS)
  const turnUsername = String(process.env.NEXT_PUBLIC_TURN_USERNAME || '').trim()
  const turnCredential = String(process.env.NEXT_PUBLIC_TURN_CREDENTIAL || '').trim()

  const merged: RTCIceServer[] = [
    ...fromJson,
    ...(turnUrls.length > 0
      ? [
          {
            urls: turnUrls,
            ...(turnUsername ? { username: turnUsername } : {}),
            ...(turnCredential ? { credential: turnCredential } : {}),
          } as RTCIceServer,
        ]
      : []),
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]

  const iceServers = normalizeIceServers(merged)
  const hasTurn = iceServers.some(hasTurnUrl)
  const preferRelay = options?.preferRelay === true && hasTurn
  return {
    hasTurn,
    rtcConfig: {
      iceServers,
      iceCandidatePoolSize: 2,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      ...(preferRelay ? { iceTransportPolicy: 'relay' as RTCIceTransportPolicy } : {}),
    },
  }
}
