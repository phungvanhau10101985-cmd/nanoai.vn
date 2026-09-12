export const PW_LOGIN_IDENTITY_ATTR = 'data-pw-login-identity'
export const PW_LOGIN_SEED_LABEL_ATTR = 'data-pw-seed-login-label'

export const PW_LOGIN_IDENTITY_CSS = `
html [data-pw-chrome-btn="login"][data-pw-login-identity="1"],
html[data-pw-edit-device] [data-pw-chrome-btn="login"][data-pw-login-identity="1"],
html[data-pw-scene-lock] [data-pw-chrome-btn="login"][data-pw-login-identity="1"],
.pw-shop-topbar [data-pw-login-chrome="1"]{
  display:inline-flex!important;align-items:center;gap:6px;max-width:220px;
  aspect-ratio:auto!important;width:auto!important;height:auto!important;
  min-width:0!important;min-height:0!important;max-height:none!important
}
html [data-pw-chrome-btn="login"][data-pw-login-identity="1"] .pw-login-avatar,
html [data-pw-chrome-btn="login"][data-pw-login-identity="1"] .pw-login-avatar-fallback,
html[data-pw-edit-device] [data-pw-chrome-btn="login"][data-pw-login-identity="1"] .pw-login-avatar,
html[data-pw-edit-device] [data-pw-chrome-btn="login"][data-pw-login-identity="1"] .pw-login-avatar-fallback,
html[data-pw-scene-lock] [data-pw-chrome-btn="login"][data-pw-login-identity="1"] .pw-login-avatar,
html[data-pw-scene-lock] [data-pw-chrome-btn="login"][data-pw-login-identity="1"] .pw-login-avatar-fallback,
.pw-shop-topbar [data-pw-login-chrome="1"] .pw-login-avatar,
.pw-shop-topbar [data-pw-login-chrome="1"] .pw-login-avatar-fallback{
  display:inline-flex!important;align-items:center;justify-content:center;
  width:18px!important;height:18px!important;min-width:18px!important;min-height:18px!important;
  max-width:18px!important;max-height:18px!important;border-radius:999px!important;
  object-fit:cover!important;flex:0 0 18px!important;margin:0!important;padding:0!important;
  visibility:visible!important;overflow:hidden!important;background:var(--pw-primary);color:#fff;
  font-size:10px!important;font-weight:700;line-height:1!important
}
html [data-pw-chrome-btn="login"][data-pw-login-identity="1"] .pw-chrome-btn-label,
html [data-pw-chrome-btn="login"][data-pw-login-identity="1"] .pw-shop-nav-label,
html[data-pw-edit-device] [data-pw-chrome-btn="login"][data-pw-login-identity="1"] .pw-chrome-btn-label,
html[data-pw-edit-device] [data-pw-chrome-btn="login"][data-pw-login-identity="1"] .pw-shop-nav-label,
html[data-pw-scene-lock] [data-pw-chrome-btn="login"][data-pw-login-identity="1"] .pw-chrome-btn-label,
html[data-pw-scene-lock] [data-pw-chrome-btn="login"][data-pw-login-identity="1"] .pw-shop-nav-label,
.pw-shop-topbar [data-pw-login-chrome="1"] .pw-chrome-btn-label{
  display:inline!important;visibility:visible!important;font-size:inherit!important;
  width:auto!important;max-width:160px!important;height:auto!important;max-height:none!important;
  overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;
  flex:0 1 auto!important;margin:0!important;padding:0!important;line-height:1.2!important
}
`

export type ShopCustomerLoginIdentity = {
  name: string
  avatarUrl: string | null
}

function isGenericGuestAccountLabel(label: string | null | undefined): boolean {
  const t = String(label ?? '').trim()
  if (!t) return true
  const head = (t.split('·')[0]?.split('-')[0] ?? '').trim().toLowerCase()
  return head === '' || head === 'guest' || head === 'khách' || head === 'khach'
}

function emailLocalPart(email: string): string {
  const t = email.trim()
  const at = t.indexOf('@')
  if (at <= 0) return t.slice(0, 32)
  return t.slice(0, at).slice(0, 32)
}

export function shopCustomerLoginLabel(input: {
  customerName?: string | null
  profileName?: string | null
  email?: string | null
}): string {
  const customer = String(input.customerName ?? '').trim()
  if (customer && !isGenericGuestAccountLabel(customer.split('·')[0])) return customer.slice(0, 48)
  const profile = String(input.profileName ?? '').trim()
  if (profile && !isGenericGuestAccountLabel(profile.split('·')[0])) return profile.slice(0, 48)
  const email = String(input.email ?? '').trim()
  if (email) return emailLocalPart(email)
  return ''
}

export function shopCustomerInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  const a = parts[0][0] || ''
  const b = parts[parts.length - 1][0] || ''
  return `${a}${b}`.toUpperCase()
}

export function httpAvatarUrl(raw: string | null | undefined): string | null {
  const url = String(raw ?? '').trim()
  if (!/^https?:\/\//i.test(url)) return null
  if (url.length > 2000) return null
  return url
}

/** Lưu Sửa nhanh: trả chữ «Đăng nhập», bỏ tên/ảnh khách hydrate lúc live. */
export function restoreLoginIdentitySeedsInDocument(root: ParentNode): void {
  const nodes = root.querySelectorAll('[data-pw-chrome-btn="login"]')
  nodes.forEach((node) => {
    const el = node as Element
    const seed = el.getAttribute(PW_LOGIN_SEED_LABEL_ATTR)
    el.querySelectorAll('.pw-login-avatar, .pw-login-avatar-fallback').forEach((n) => n.remove())
    el.querySelectorAll('[data-pw-login-hide="1"]').forEach((n) => {
      n.removeAttribute('hidden')
      n.removeAttribute('data-pw-login-hide')
    })
    const identity = el.getAttribute(PW_LOGIN_IDENTITY_ATTR) === '1' || seed != null
    if (!identity) return
    const label = seed?.trim() || ''
    const labelEl = el.querySelector('.pw-chrome-btn-label, .pw-shop-nav-label')
    if (labelEl) labelEl.textContent = label
    else if (label) el.textContent = label
    el.removeAttribute(PW_LOGIN_IDENTITY_ATTR)
    el.removeAttribute(PW_LOGIN_SEED_LABEL_ATTR)
    el.removeAttribute('data-pw-login-name')
    el.removeAttribute('data-pw-login-avatar')
  })
}
