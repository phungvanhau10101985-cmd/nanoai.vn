'use server'

import { getUserForAction } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { setUserCreditBalanceAbsolute } from '@/lib/db/credits-balance'
import { getProfileRoleWithFallback } from '@/lib/db/read-user-dashboard-pg'
import { assertStepUp, STEP_UP_REQUIRED } from '@/lib/auth/step-up-guard'
import { isPgConfigured } from '@/lib/db/pool'
import { isValidUuidString } from '@/lib/validate-uuid'
import { sendSmtpMail, isSmtpConfigured } from '@/lib/email/smtp'
import {
  clearAdminDeleteUserOtpFromPg,
  consumeAdminDeleteUserOtpFromPg,
  generateAdminDeleteUserOtp6,
  hashAdminDeleteUserOtp,
  isAdminDeleteUserOtpCooldownActiveFromPg,
  replaceAdminDeleteUserOtpFromPg,
} from '@/lib/db/admin-user-deletion-otp-pg'
import {
  pgAdminDeleteUserById,
  precheckAdminDeleteUserFromPg,
} from '@/lib/db/admin-delete-user-pg'

async function requireAdmin() {
  const result = await getUserForAction()
  if ('error' in result) return { error: result.error as string }
  const { user } = result
  const role = await getProfileRoleWithFallback(user.id)
  if (role !== 'admin') return { error: 'Permission denied. You must be an admin.' }
  return { user }
}

export async function updateUserCredit(userId: string, newBalance: number) {
  const result = await getUserForAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  const role = await getProfileRoleWithFallback(user.id)
  if (role !== 'admin') {
    return { error: 'Permission denied. You must be an admin.' }
  }

  const step = await assertStepUp(user.id, 'admin')
  if ('error' in step) return { error: STEP_UP_REQUIRED }

  const r = await setUserCreditBalanceAbsolute(userId, newBalance)
  if (!r.ok) {
    return { error: 'Failed to update credit balance.' }
  }

  revalidatePath('/admin/users') // Refresh the admin page
  return { success: true }
}

/** Gửi OTP 6 số tới email admin — bắt buộc trước mỗi lần xóa user. */
export async function requestAdminDeleteUserOtp(targetUserId: string) {
  const gate = await requireAdmin()
  if ('error' in gate) return { error: gate.error }

  if (!isValidUuidString(targetUserId)) return { error: 'Invalid user id.' }
  const email = gate.user.email?.trim()
  if (!email) return { error: 'Tài khoản admin chưa có email — không gửi được OTP.' }
  if (!isSmtpConfigured()) return { error: 'Máy chủ chưa cấu hình gửi email (SMTP).' }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }

  const pre = await precheckAdminDeleteUserFromPg(targetUserId, gate.user.id)
  if (!pre.ok) return { error: pre.message }

  if (await isAdminDeleteUserOtpCooldownActiveFromPg(gate.user.id, targetUserId)) {
    return { error: 'Vui lòng đợi vài chục giây trước khi gửi lại mã.' }
  }

  const otp = generateAdminDeleteUserOtp6()
  const otpHash = hashAdminDeleteUserOtp(gate.user.id, targetUserId, otp)
  const saved = await replaceAdminDeleteUserOtpFromPg({
    adminUserId: gate.user.id,
    targetUserId,
    otpHash,
  })
  if (!saved) return { error: 'Không lưu được mã xác nhận.' }

  const targetLabel = pre.email || targetUserId
  const sent = await sendSmtpMail({
    to: email,
    subject: 'Mã OTP xóa tài khoản thành viên — NanoAI Admin',
    text: [
      `Bạn vừa yêu cầu xóa tài khoản: ${targetLabel}`,
      '',
      `Mã OTP của bạn: ${otp}`,
      '',
      'Mã có hiệu lực 10 phút. Nếu không phải bạn thao tác, hãy bỏ qua email này.',
    ].join('\n'),
    html: `<p>Bạn vừa yêu cầu <b>xóa tài khoản</b>: ${targetLabel}</p>
<p>Mã OTP của bạn: <b>${otp}</b></p>
<p>Mã có hiệu lực 10 phút. Nếu không phải bạn thao tác, hãy bỏ qua email này.</p>`,
  })

  if (!sent.ok) {
    await clearAdminDeleteUserOtpFromPg(gate.user.id, targetUserId)
    return { error: 'Không gửi được email. Kiểm tra SMTP hoặc thử lại sau.' }
  }

  return { ok: true as const }
}

/** Xác nhận OTP và xóa user (mỗi lần xóa cần OTP mới). */
export async function confirmAdminDeleteUserWithOtp(targetUserId: string, otpRaw: string) {
  const gate = await requireAdmin()
  if ('error' in gate) return { error: gate.error }

  if (!isValidUuidString(targetUserId)) return { error: 'Invalid user id.' }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }

  const pre = await precheckAdminDeleteUserFromPg(targetUserId, gate.user.id)
  if (!pre.ok) return { error: pre.message }

  const otpOk = await consumeAdminDeleteUserOtpFromPg({
    adminUserId: gate.user.id,
    targetUserId,
    otp: otpRaw,
  })
  if (!otpOk) return { error: 'Mã OTP không đúng hoặc đã hết hạn.' }

  const deleted = await pgAdminDeleteUserById(targetUserId)
  if ('error' in deleted) return { error: deleted.error }

  revalidatePath('/admin/users')
  return { ok: true as const }
}
