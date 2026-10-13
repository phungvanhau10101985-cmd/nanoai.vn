/**
 * Dùng thử 18 ngày: không trừ phí tháng giáo trình (`/api/account/monthly-service-credits`).
 * Gói học sinh có dùng thử riêng 6 ngày — không dùng mốc 18 ngày này.
 * Không miễn credit AI theo lượt; học tiếng Anh AI vẫn trừ credit theo buổi/bài khi dùng.
 * Mốc là lần đầu dùng giáo trình / phiếu / bài thi (`feature_trial_starts.curriculum`), không phải lúc tạo tài khoản.
 */
export const SERVICE_FREE_TRIAL_DAYS = 18

/** Credit chào mừng khi tạo tài khoản — hiện đã tắt. */
export const SIGNUP_BONUS_CREDITS = 0

const MS_PER_DAY = 86400000

export function getServiceTrialEndsAt(trialStartedAtIso: string | undefined | null): Date | null {
  if (!trialStartedAtIso) return null
  const t = Date.parse(trialStartedAtIso)
  if (Number.isNaN(t)) return null
  return new Date(t + SERVICE_FREE_TRIAL_DAYS * MS_PER_DAY)
}

export function isServiceFreeTrialActive(
  trialStartedAtIso: string | undefined | null,
  now = new Date()
): boolean {
  const end = getServiceTrialEndsAt(trialStartedAtIso)
  if (!end) return false
  return now.getTime() < end.getTime()
}

/** Số ngày còn lại (làm tròn lên), 0 nếu chưa bắt đầu hoặc đã hết. */
export function getServiceFreeTrialDaysRemaining(
  trialStartedAtIso: string | undefined | null,
  now = new Date()
): number {
  const end = getServiceTrialEndsAt(trialStartedAtIso)
  if (!end || now.getTime() >= end.getTime()) return 0
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / MS_PER_DAY))
}
