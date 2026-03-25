import type { SupabaseClient, User } from '@supabase/supabase-js'
import { isSmtpConfigured, sendSmtpMail } from '@/lib/email/smtp'

/**
 * Email đăng nhập Google (và email/password) do Supabase lưu ở `user.email`.
 * Fallback: user_metadata.email hoặc identity_data (trường hợp hiếm / provider lệch).
 */
export function resolveAuthUserEmail(user: User | null | undefined): string | null {
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
export async function sendAccountNotificationEmail(
  adminSupabase: SupabaseClient,
  userId: string,
  payload: { title: string; body: string }
): Promise<void> {
  if (!isSmtpConfigured()) return

  try {
    const { data, error } = await adminSupabase.auth.admin.getUserById(userId)
    if (error) {
      console.error('[account-notification-email] getUserById:', error.message)
      return
    }
    const email = resolveAuthUserEmail(data.user)
    if (!email) {
      console.warn(
        '[account-notification-email] no email on auth user (OAuth/Google thường có email ở user.email — kiểm tra provider Supabase)',
        { userId }
      )
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
    console.error('[account-notification-email]', msg)
  }
}
