/**
 * node-pg returns `Date`. `String(date)` / `Date#toString()` is
 * `Thu Sep 24 2026 … GMT+0700 …`, which Postgres `timestamptz` rejects.
 * Always write ISO-8601.
 */
export function toPgTimestamptz(value: unknown): string | null {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    const time = value.getTime()
    return Number.isFinite(time) ? value.toISOString() : null
  }
  const text = String(value).trim()
  if (!text) return null
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}
