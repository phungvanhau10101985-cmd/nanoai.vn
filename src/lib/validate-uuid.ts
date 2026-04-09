/** Chuỗi UUID (RFC) — dùng trước khi truyền vào Postgres `::uuid`. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUuidString(s: string | null | undefined): boolean {
  const t = (s ?? '').trim()
  return t.length > 0 && UUID_RE.test(t)
}
