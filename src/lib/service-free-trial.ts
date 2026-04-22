/**
 * Dùng thử 7 ngày: không trừ **phí tháng giáo trình** (`/api/account/monthly-service-credits`).
 * Không miễn credit AI theo lượt; học tiếng Anh AI vẫn trừ credit theo buổi/bài khi dùng.
 * Tính từ `auth.users.created_at` — 7×24h kể từ lúc đăng ký.
 */
export const SERVICE_FREE_TRIAL_DAYS = 7

/** Credit chào mừng khi tạo tài khoản — hiện đã tắt. */
export const SIGNUP_BONUS_CREDITS = 0

const MS_PER_DAY = 86400000

export function getServiceTrialEndsAt(userCreatedAtIso: string | undefined | null): Date | null {
  if (!userCreatedAtIso) return null
  const t = Date.parse(userCreatedAtIso)
  if (Number.isNaN(t)) return null
  return new Date(t + SERVICE_FREE_TRIAL_DAYS * MS_PER_DAY)
}

export function isServiceFreeTrialActive(
  userCreatedAtIso: string | undefined | null,
  now = new Date()
): boolean {
  const end = getServiceTrialEndsAt(userCreatedAtIso)
  if (!end) return false
  return now.getTime() < end.getTime()
}

/** Số ngày còn lại (làm tròn lên), 0 nếu hết trial. */
export function getServiceFreeTrialDaysRemaining(
  userCreatedAtIso: string | undefined | null,
  now = new Date()
): number {
  const end = getServiceTrialEndsAt(userCreatedAtIso)
  if (!end || now.getTime() >= end.getTime()) return 0
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / MS_PER_DAY))
}
