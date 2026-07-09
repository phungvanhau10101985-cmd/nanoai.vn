import { createHash, randomBytes } from 'node:crypto'
import type { Database } from '@/types/database.types'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { insertGuestEmailChallengePg } from '@/lib/db/messaging-guest-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { LOOSE_RFC4122_UUID_STRING_RE } from '@/lib/messaging/guest-session-id'

type ConvRow = Database['public']['Tables']['customer_care_conversations']['Row']

/** Mặc định 7 ngày — link trong email thông báo offline. */
const DEFAULT_OFFLINE_REPLY_MAGIC_TTL_HOURS = 168

function sha256(v: string): string {
  return createHash('sha256').update(v).digest('hex')
}

function plainGuestChatUrl(slug: string): string {
  const origin = getPublicAppUrlForServer().replace(/\/$/, '')
  return `${origin}/messaging/p/${encodeURIComponent(slug)}`
}

/** Neo phiên hội thoại — guest account, NanoAI user, hoặc thread ẩn danh đã merge. */
function resolveOfflineReplySessionAnchor(conv: ConvRow): string | null {
  for (const raw of [conv.guest_account_id, conv.linked_user_id, conv.external_thread_id]) {
    const t = String(raw ?? '').trim()
    if (t && LOOSE_RFC4122_UUID_STRING_RE.test(t)) return t
  }
  return null
}

/**
 * Link «Mở cuộc trò chuyện» trong email offline — một lần, có hạn.
 * Trình duyệt chưa đăng nhập: verify-magic gắn cookie guest + email session rồi redirect vào chat.
 */
export async function buildOfflineReplyAutoLoginChatUrl(input: {
  partnerId: string
  slug: string
  email: string
  conversation: ConvRow
}): Promise<string> {
  const slug = input.slug.trim()
  if (!slug) return plainGuestChatUrl(slug)

  const email = input.email.trim().toLowerCase()
  const anchor = resolveOfflineReplySessionAnchor(input.conversation)
  if (!email || !anchor || !isPgConfigured()) {
    return plainGuestChatUrl(slug)
  }

  const token = randomBytes(24).toString('hex')
  const magicTokenHash = sha256(`magic:${input.partnerId}:${email}:${token}`)
  const codeHash = sha256(`offline-reply-unused:${input.partnerId}:${email}:${token}`)

  const ttlHoursRaw = parseInt(process.env.OFFLINE_REPLY_MAGIC_LINK_TTL_HOURS || '', 10)
  const ttlHours = Number.isFinite(ttlHoursRaw)
    ? Math.min(720, Math.max(1, ttlHoursRaw))
    : DEFAULT_OFFLINE_REPLY_MAGIC_TTL_HOURS
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString()

  const inserted = await insertGuestEmailChallengePg({
    partnerId: input.partnerId,
    emailNormalized: email,
    sessionId: anchor,
    codeHash,
    magicTokenHash,
    expiresAt,
  })
  if (!inserted) return plainGuestChatUrl(slug)

  const origin = getPublicAppUrlForServer().replace(/\/$/, '')
  const u = new URL(
    `${origin}/api/messaging/guest/${encodeURIComponent(slug)}/auth/email/verify-magic`
  )
  u.searchParams.set('email', email)
  u.searchParams.set('token', token)
  u.searchParams.set('sid', anchor)
  return u.toString()
}
