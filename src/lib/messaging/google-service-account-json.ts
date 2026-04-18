/** Kiểm tra nội dung file JSON key của Google service account (Sheets API). */
export function assertValidGoogleServiceAccountJson(
  raw: string
): { ok: true } | { ok: false; error: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, error: 'File JSON rỗng.' }
  let o: unknown
  try {
    o = JSON.parse(trimmed)
  } catch {
    return { ok: false, error: 'JSON không hợp lệ.' }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) {
    return { ok: false, error: 'JSON service account không đúng định dạng.' }
  }
  const rec = o as Record<string, unknown>
  const email = typeof rec.client_email === 'string' ? rec.client_email.trim() : ''
  if (!email.includes('@')) {
    return { ok: false, error: 'Thiếu hoặc sai trường client_email trong JSON.' }
  }
  const pk = typeof rec.private_key === 'string' ? rec.private_key : ''
  if (!pk.includes('BEGIN') || !pk.includes('PRIVATE KEY')) {
    return { ok: false, error: 'Thiếu hoặc sai trường private_key trong JSON.' }
  }
  return { ok: true }
}
