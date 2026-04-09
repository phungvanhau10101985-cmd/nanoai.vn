/**
 * Cấu hình REST cho URL dạng `{origin}/storage/v1/object/...` (S3-compatible Storage HTTP API).
 * Ưu tiên `STORAGE_LEGACY_*` / `NEXT_PUBLIC_STORAGE_LEGACY_*`; nếu thiếu, đọc cặp URL + service key theo convention biến cũ trong `.env`.
 */

function trimOrigin(url: string): string {
  return url.trim().replace(/\/$/, '')
}

/** Origin public + REST (server & client bundle: dùng NEXT_PUBLIC_*). */
export function getStorageLegacyRestOrigin(): string {
  return trimOrigin(
    process.env.NEXT_PUBLIC_STORAGE_LEGACY_REST_ORIGIN?.trim() ||
      process.env.STORAGE_LEGACY_REST_ORIGIN?.trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
      ''
  )
}

/** Chỉ server: khóa gọi Storage REST (DELETE/authenticated GET). */
export function getStorageLegacyServiceKey(): string {
  return (
    process.env.STORAGE_LEGACY_SERVICE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    ''
  )
}

export function getStorageLegacyRestConfig(): { base: string; key: string } | null {
  const base = getStorageLegacyRestOrigin()
  const key = getStorageLegacyServiceKey()
  if (!base || !key) return null
  return { base, key }
}
