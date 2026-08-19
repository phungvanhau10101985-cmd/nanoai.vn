import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'

export function isPersistableChatIconLogoUrl(url: string): boolean {
  return /^https?:\/\//i.test(String(url || '').trim())
}

/** Ghi logo icon Chat mua vào theme + mọi HTML máy. Đổi một chỗ = mọi máy. */
export async function persistVisualEditorChatIconLogo(
  partnerId: string,
  chatIconLogoUrl: string
): Promise<{ ok: true; theme?: PartnerWebsiteTheme } | { ok: false; error: string }> {
  const url = String(chatIconLogoUrl || '').trim()
  if (!partnerId.trim() || !isPersistableChatIconLogoUrl(url)) {
    return { ok: false, error: 'chatIconLogoUrl required' }
  }
  const res = await fetch(`/api/messaging/partner-website/${encodeURIComponent(partnerId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ action: 'update_chat_icon_logo', chatIconLogoUrl: url }),
  })
  const json = (await res.json().catch(() => ({}))) as {
    error?: string
    website?: { theme?: PartnerWebsiteTheme }
  }
  if (!res.ok) {
    return { ok: false, error: json.error || 'Could not save chat icon logo' }
  }
  return { ok: true, theme: json.website?.theme }
}
