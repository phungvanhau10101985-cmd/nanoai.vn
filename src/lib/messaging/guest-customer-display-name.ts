import type { AppUser } from '@/lib/auth/app-user'
import { fetchGuestAccountEmailByIdPg } from '@/lib/db/messaging-guest-pg'
import { fetchPartnerCustomerProfileByEmailFromPg } from '@/lib/db/messaging-partner-customer-profiles-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isGenericGuestAccountLabel(label: string | null | undefined): boolean {
  const t = String(label ?? '').trim()
  if (!t) return true
  const head = (t.split('·')[0]?.split('-')[0] ?? '').trim().toLowerCase()
  return head === '' || head === 'guest' || head === 'khách' || head === 'khach'
}

export function labelFromAppUser(user: AppUser | null | undefined): string | null {
  if (!user) return null
  const meta = (user.user_metadata as Record<string, unknown> | undefined) ?? undefined
  const fullName =
    typeof meta?.full_name === 'string'
      ? meta.full_name
      : typeof meta?.name === 'string'
        ? meta.name
        : ''
  const email = user.email?.trim() ?? ''
  const label = (fullName || email).trim().slice(0, 48)
  return label || null
}

export function buildGuestConversationCustomerName(accountLabel: string, shopDisplayName: string): string {
  const account = accountLabel.trim().slice(0, 48) || 'Guest'
  const shop = shopDisplayName.trim().slice(0, 36) || 'Shop'
  return `${account} · ${shop}`
}

function emailLocalPart(email: string): string {
  const t = email.trim()
  const at = t.indexOf('@')
  if (at <= 0) return t.slice(0, 48)
  return t.slice(0, at).slice(0, 48)
}

async function labelFromLinkedUserPg(linkedUserId: string): Promise<string | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<{ full_name: string | null; email: string | null }>(
    `select p.full_name, u.email
     from auth.users u
     left join public.profiles p on p.id = u.id
     where u.id = $1::uuid
     limit 1`,
    [linkedUserId]
  )
  if (!row) return null
  const fullName = String(row.full_name ?? '').trim()
  if (fullName) return fullName.slice(0, 48)
  const email = String(row.email ?? '').trim()
  if (email) return emailLocalPart(email)
  return null
}

/** Tên hiển thị từ tài khoản guest (OTP / web shop 188) hoặc user đăng nhập NanoAI. */
export async function resolveGuestAccountLabelFromPg(input: {
  partnerId: string
  guestAccountId?: string | null
  linkedUserId?: string | null
  externalThreadId?: string | null
}): Promise<string | null> {
  if (!isPgConfigured()) return null

  const linked = input.linkedUserId?.trim()
  if (linked) {
    const fromUser = await labelFromLinkedUserPg(linked)
    if (fromUser) return fromUser
  }

  let accountId = input.guestAccountId?.trim() || ''
  const ext = input.externalThreadId?.trim() || ''
  if (!accountId && UUID_RE.test(ext)) {
    accountId = ext
  }
  if (!accountId) return null

  const ga = await fetchGuestAccountEmailByIdPg(input.partnerId, accountId)
  if (!ga) return null

  const profile = await fetchPartnerCustomerProfileByEmailFromPg({
    partnerId: input.partnerId,
    emailNormalized: ga.emailNormalized,
  })
  const profileName = profile?.customer_name?.trim()
  if (profileName) return profileName.slice(0, 48)

  const emailRaw = ga.emailRaw.trim()
  if (emailRaw) {
    const local = emailLocalPart(emailRaw)
    if (local) return local
    return emailRaw.slice(0, 48)
  }
  return null
}

export async function resolveGuestCustomerDisplayName(input: {
  partnerId: string
  shopDisplayName: string
  user?: AppUser | null
  guestAccountId?: string | null
  linkedUserId?: string | null
  externalThreadId?: string | null
}): Promise<string> {
  const fromSessionUser = labelFromAppUser(input.user ?? null)
  if (fromSessionUser) {
    return buildGuestConversationCustomerName(fromSessionUser, input.shopDisplayName)
  }

  const fromAccount = await resolveGuestAccountLabelFromPg({
    partnerId: input.partnerId,
    guestAccountId: input.guestAccountId,
    linkedUserId: input.linkedUserId,
    externalThreadId: input.externalThreadId,
  })
  if (fromAccount) {
    return buildGuestConversationCustomerName(fromAccount, input.shopDisplayName)
  }

  return buildGuestConversationCustomerName('Guest', input.shopDisplayName)
}

/** Gắn tên inbox từ profile/tài khoản khi DB vẫn lưu «Guest · shop». */
export function enrichStoredConversationCustomerName(input: {
  storedName: string | null | undefined
  resolvedAccountLabel: string | null | undefined
  partnerDisplayName: string | null | undefined
}): string {
  const shop = String(input.partnerDisplayName ?? '').trim().slice(0, 36) || 'Shop'
  const resolved = String(input.resolvedAccountLabel ?? '').trim()
  if (resolved) return buildGuestConversationCustomerName(resolved, shop)

  const stored = String(input.storedName ?? '').trim()
  if (stored && !isGenericGuestAccountLabel(stored.split('·')[0]?.split('-')[0])) {
    return stored
  }
  return buildGuestConversationCustomerName('Guest', shop)
}
