/**
 * Bunny Storage trả 401 khi PUT/DELETE đúng mật khẩu nhưng sai hostname vùng.
 * Frankfurt = storage.bunnycdn.com. Ổ shop mặc định SG = sg.storage.bunnycdn.com.
 * https://docs.bunny.net/storage/http
 */

const REGION_HOSTS: Record<string, string> = {
  DE: 'storage.bunnycdn.com',
  FALKENSTEIN: 'storage.bunnycdn.com',
  FRANKFURT: 'storage.bunnycdn.com',
  UK: 'uk.storage.bunnycdn.com',
  LONDON: 'uk.storage.bunnycdn.com',
  NY: 'ny.storage.bunnycdn.com',
  LA: 'la.storage.bunnycdn.com',
  SG: 'sg.storage.bunnycdn.com',
  SINGAPORE: 'sg.storage.bunnycdn.com',
  SE: 'se.storage.bunnycdn.com',
  STOCKHOLM: 'se.storage.bunnycdn.com',
  BR: 'br.storage.bunnycdn.com',
  JH: 'jh.storage.bunnycdn.com',
  SYD: 'syd.storage.bunnycdn.com',
  SYDNEY: 'syd.storage.bunnycdn.com',
  MI: 'mi.storage.bunnycdn.com',
}

const FALLBACK_HOSTS = [
  'sg.storage.bunnycdn.com',
  'storage.bunnycdn.com',
  'uk.storage.bunnycdn.com',
  'ny.storage.bunnycdn.com',
  'la.storage.bunnycdn.com',
  'se.storage.bunnycdn.com',
  'br.storage.bunnycdn.com',
  'jh.storage.bunnycdn.com',
  'syd.storage.bunnycdn.com',
  'mi.storage.bunnycdn.com',
]

export function normalizeBunnyStorageHost(host: string | null | undefined): string {
  const raw = (host || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  return raw || 'storage.bunnycdn.com'
}

/** Mã vùng Bunny (DE, SG, …) → hostname API Storage. */
export function bunnyStorageHostForRegion(region: string | null | undefined): string {
  const code = (region || '').trim().toUpperCase()
  if (!code) return 'storage.bunnycdn.com'
  return REGION_HOSTS[code] || 'storage.bunnycdn.com'
}

/** Vùng lúc tạo ổ shop. Khớp `BUNNY_STORAGE_REGION` (mặc định SG). */
export function partnerBunnyStorageRegionCode(): string {
  const region = (process.env.BUNNY_STORAGE_REGION || 'SG').trim().toUpperCase()
  return region || 'SG'
}

/** Vùng zone nền tảng `BUNNY_STORAGE_*`. Mặc định Frankfurt. */
export function platformBunnyStorageRegionCode(): string {
  const region = (process.env.BUNNY_PLATFORM_STORAGE_REGION || 'DE').trim().toUpperCase()
  return region || 'DE'
}

export function bunnyStorageObjectUrl(host: string, zone: string, remotePath: string): string {
  const base = normalizeBunnyStorageHost(host)
  const path = remotePath.replace(/^\/+/, '')
  return `https://${base}/${encodeURIComponent(zone)}/${path}`
}

/** Host ưu tiên đứng đầu; các vùng còn lại để thử khi 401. */
export function bunnyStorageHostCandidates(preferredHost: string): string[] {
  const preferred = normalizeBunnyStorageHost(preferredHost)
  const out: string[] = []
  for (const host of [preferred, ...FALLBACK_HOSTS]) {
    if (!out.includes(host)) out.push(host)
  }
  return out
}
