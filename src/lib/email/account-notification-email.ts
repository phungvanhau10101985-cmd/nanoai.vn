import type { AppUser } from '@/lib/auth/app-user'
import { getAuthUserEmailFromPg } from '@/lib/db/auth-user-email-pg'
import { isSmtpConfigured, sendSmtpMail } from '@/lib/email/smtp'

/**
 * Email đăng nhập Google (và email/password) lấy từ `user.email` trong `auth.users`.
 * Fallback: user_metadata.email hoặc identity_data (trường hợp hiếm / provider lệch).
 */
export function resolveAuthUserEmail(user: AppUser | null | undefined): string | null {
  if (!user) return null
  const direct = user.email?.trim()
  if (direct) return direct
  const meta = user.user_metadata as Record<string, unknown> | undefined
  const fromMeta = meta?.email
  if (typeof fromMeta === 'string' && fromMeta.trim()) return fromMeta.trim()
  const identities = user.identities
  if (!Array.isArray(identities)) return null
  for (const row of identities) {
    const data = row?.identity_data as Record<string, unknown> | undefined
    const em = data?.email
    if (typeof em === 'string' && em.trim()) return em.trim()
  }
  return null
}

function appBaseUrl(): string {
  const u = process.env.APP_URL || process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || ''
  return String(u).replace(/\/$/, '')
}

/**
 * Gửi email thông báo tài khoản (khi đã có nội dung tương ứng trong bảng notifications).
 * Bỏ qua nếu chưa cấu hình SMTP hoặc user không có email.
 * Không throw — chỉ log lỗi.
 */
/** Gửi email khi đã biết userId — ưu tiên đọc email từ Postgres `auth.users` (không gọi HTTP Auth hosted). */
export async function sendAccountNotificationEmailByUserIdPg(
  userId: string,
  payload: { title: string; body: string }
): Promise<void> {
  if (!isSmtpConfigured()) return
  try {
    const email = await getAuthUserEmailFromPg(userId)
    if (!email) {
      console.warn('[account-notification-email] no email in auth.users', { userId })
      return
    }
    const base = appBaseUrl()
    const lines = [
      payload.title,
      '',
      payload.body,
      '',
      '—',
      base ? `Mở NanoAI để xem thông báo trong ứng dụng: ${base}` : 'Xem thông báo trong ứng dụng NanoAI.',
    ]
    await sendSmtpMail({
      to: email,
      subject: `[NanoAI] ${payload.title}`,
      text: lines.join('\n'),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[account-notification-email] pg path', msg)
  }
}
