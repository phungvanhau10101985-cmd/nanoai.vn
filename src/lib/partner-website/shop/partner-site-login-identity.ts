import { isGenericGuestAccountLabel } from '@/lib/messaging/guest-customer-display-name'
import {
  fetchPartnerCustomerProfileByEmailFromPg,
  upsertPartnerCustomerProfileByEmailFromPg,
} from '@/lib/db/messaging-partner-customer-profiles-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'

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

function httpAvatarUrl(raw: string | null | undefined): string | null {
  const url = String(raw ?? '').trim()
  if (!/^https?:\/\//i.test(url)) return null
  if (url.length > 2000) return null
  return url
}

export async function resolveShopCustomerLoginIdentity(input: {
  partnerId: string
  email?: string | null
  linkedUserId?: string | null
}): Promise<ShopCustomerLoginIdentity> {
  const email = String(input.email ?? '').trim().toLowerCase()
  const linkedUserId = String(input.linkedUserId ?? '').trim()
  let customerName = ''
  if (email) {
    const row = await fetchPartnerCustomerProfileByEmailFromPg({
      partnerId: input.partnerId,
      emailNormalized: email,
    })
    customerName = String(row?.customer_name ?? '').trim()
  }

  let profileName = ''
  let avatarUrl: string | null = null
  if (isPgConfigured() && (linkedUserId || email)) {
    try {
      const row = linkedUserId
        ? await pgQueryOne<{ full_name: string | null; avatar_url: string | null; picture: string | null }>(
            `select p.full_name, p.avatar_url,
                    nullif(trim(coalesce(u.raw_user_meta_data->>'picture', u.raw_user_meta_data->>'avatar_url')), '') as picture
             from auth.users u
             left join public.profiles p on p.id = u.id
             where u.id = $1::uuid
             limit 1`,
            [linkedUserId]
          )
        : await pgQueryOne<{ full_name: string | null; avatar_url: string | null; picture: string | null }>(
            `select p.full_name, p.avatar_url,
                    nullif(trim(coalesce(u.raw_user_meta_data->>'picture', u.raw_user_meta_data->>'avatar_url')), '') as picture
             from auth.users u
             left join public.profiles p on p.id = u.id
             where lower(coalesce(u.email, '')) = $1
             order by u.created_at asc
             limit 1`,
            [email]
          )
      profileName = String(row?.full_name ?? '').trim()
      avatarUrl = httpAvatarUrl(row?.avatar_url) || httpAvatarUrl(row?.picture)
    } catch (e) {
      console.warn('[resolveShopCustomerLoginIdentity]', e)
    }
  }

  return {
    name: shopCustomerLoginLabel({ customerName, profileName, email }),
    avatarUrl,
  }
}

export async function persistShopCustomerGoogleIdentity(input: {
  userId: string
  partnerId?: string | null
  email: string
  name?: string | null
  picture?: string | null
}): Promise<void> {
  if (!isPgConfigured()) return
  const userId = input.userId.trim()
  const email = input.email.trim().toLowerCase()
  const name = String(input.name ?? '').trim().slice(0, 180)
  const picture = httpAvatarUrl(input.picture)
  if (!userId) return

  try {
    await pgQueryOne(
      `insert into public.profiles (id, full_name, avatar_url, updated_at)
       values ($1::uuid, $2, $3, now())
       on conflict (id) do update set
         full_name = coalesce(nullif(trim(public.profiles.full_name), ''), excluded.full_name),
         avatar_url = coalesce(nullif(trim(excluded.avatar_url), ''), public.profiles.avatar_url),
         updated_at = now()`,
      [userId, name || null, picture]
    )
  } catch (e) {
    console.warn('[persistShopCustomerGoogleIdentity] profiles', e)
  }

  const partnerId = String(input.partnerId ?? '').trim()
  if (!partnerId || !email || !name) return
  try {
    const existing = await fetchPartnerCustomerProfileByEmailFromPg({
      partnerId,
      emailNormalized: email,
    })
    if (existing?.customer_name?.trim()) return
    await upsertPartnerCustomerProfileByEmailFromPg({
      partnerId,
      emailNormalized: email,
      emailRaw: email,
      customerName: name,
      customerPhone: existing?.customer_phone ?? '',
      shippingAddress: existing?.shipping_address ?? '',
      gender: existing?.gender ?? null,
      dateOfBirth: existing?.date_of_birth ?? null,
    })
  } catch (e) {
    console.warn('[persistShopCustomerGoogleIdentity] shop profile', e)
  }
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
