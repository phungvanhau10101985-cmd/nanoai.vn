/**
 * Cấu hình REST cho URL dạng `{origin}/storage/v1/object/...` (bucket/object HTTP API cũ).
 * Ưu tiên `STORAGE_LEGACY_*` / `NEXT_PUBLIC_STORAGE_LEGACY_*`, rồi `NEXT_PUBLIC_LEGACY_HTTP_ORIGIN` + `LEGACY_HTTP_SERVICE_ROLE_KEY`;
 * thêm các biến alias trong `.env.example` nếu chưa migrate tên env.
 */

function trimOrigin(url: string): string {
  return url.trim().replace(/\/$/, '')
}

/** Origin public + REST (server & client bundle: dùng NEXT_PUBLIC_*). */
export function getStorageLegacyRestOrigin(): string {
  return trimOrigin(
    process.env.NEXT_PUBLIC_STORAGE_LEGACY_REST_ORIGIN?.trim() ||
      process.env.STORAGE_LEGACY_REST_ORIGIN?.trim() ||
      process.env.NEXT_PUBLIC_LEGACY_HTTP_ORIGIN?.trim() ||
      ''
  )
}

/** Chỉ server: khóa gọi Storage REST (DELETE/authenticated GET). */
export function getStorageLegacyServiceKey(): string {
  return (
    process.env.STORAGE_LEGACY_SERVICE_KEY?.trim() ||
    process.env.LEGACY_HTTP_SERVICE_ROLE_KEY?.trim() ||
    ''
  )
}

export function getStorageLegacyRestConfig(): { base: string; key: string } | null {
  const base = getStorageLegacyRestOrigin()
  const key = getStorageLegacyServiceKey()
  if (!base || !key) return null
  return { base, key }
}
