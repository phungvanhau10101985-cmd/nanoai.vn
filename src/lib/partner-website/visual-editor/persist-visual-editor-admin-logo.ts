export function isPersistableAdminLogoUrl(url: string): boolean {
  return /^https?:\/\//i.test(String(url || '').trim())
}

/** Ghi ảnh logo vừa thiết kế vào mục logo quản trị (website.logoUrl), không đè HTML từng vị trí. */
export async function persistVisualEditorAdminLogo(
  partnerId: string,
  logoUrl: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = String(logoUrl || '').trim()
  if (!partnerId.trim() || !isPersistableAdminLogoUrl(url)) {
    return { ok: false, error: 'logoUrl required' }
  }
  const res = await fetch(`/api/messaging/partner-website/${encodeURIComponent(partnerId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ action: 'update_logo_url', logoUrl: url }),
  })
  const json = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) {
    return { ok: false, error: json.error || 'Could not save logo' }
  }
  return { ok: true }
}
