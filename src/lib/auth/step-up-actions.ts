'use server'

import { getUserForAction } from '@/lib/auth'
import { getProfileRoleWithFallback } from '@/lib/db/read-user-dashboard-pg'
import { isPgConfigured } from '@/lib/db/pool'
import {
  clearStepUpOtpFromPg,
  fetchActiveStepUpSessionFromPg,
  isStepUpOtpCooldownActiveFromPg,
  replaceStepUpOtpFromPg,
  verifyStepUpOtpAndCreateSessionFromPg,
} from '@/lib/db/user-step-up-pg'
import {
  generateStepUpOtp6,
  hashStepUpOtp,
  type StepUpScope,
} from '@/lib/auth/step-up-otp'
import { sendSmtpMail, isSmtpConfigured } from '@/lib/email/smtp'

async function resolveUserForScope(scope: StepUpScope) {
  const auth = await getUserForAction()
  if ('error' in auth) return { error: auth.error as string }
  const { user } = auth
  if (scope === 'admin') {
    const role = await getProfileRoleWithFallback(user.id)
    if (role !== 'admin') return { error: 'Permission denied. You must be an admin.' }
  }
  return { user }
}

function otpEmailSubject(scope: StepUpScope): string {
  return scope === 'admin'
    ? 'Mã OTP xác minh quản trị NanoAI'
    : 'Mã OTP xác minh tài khoản NanoAI'
}

function otpEmailBody(otp: string, scope: StepUpScope): { text: string; html: string } {
  const intro =
    scope === 'admin'
      ? 'Bạn vừa yêu cầu xác minh OTP để thực hiện thao tác quản trị nhạy cảm.'
      : 'Bạn vừa yêu cầu xác minh OTP để thực hiện thao tác tài khoản nhạy cảm.'
  const text = `${intro}\n\nMã OTP của bạn: ${otp}\n\nMã có hiệu lực 10 phút. Nếu không phải bạn yêu cầu, hãy bỏ qua email này.`
  const html = `<p>${intro}</p><p>Mã OTP của bạn: <b>${otp}</b></p><p>Mã có hiệu lực 10 phút. Nếu không phải bạn yêu cầu, hãy bỏ qua email này.</p>`
  return { text, html }
}

export async function checkStepUpSessionAction(
  scope: StepUpScope
): Promise<{ active: boolean; expiresAt?: string } | { error: string }> {
  const gate = await resolveUserForScope(scope)
  if ('error' in gate) return { error: gate.error ?? 'Unauthorized.' }
  const session = await fetchActiveStepUpSessionFromPg(gate.user.id, scope)
  if (!session) return { active: false }
  return { active: true, expiresAt: session.expiresAt }
}

export async function requestStepUpOtpAction(
  scope: StepUpScope
): Promise<{ ok: true } | { error: string }> {
  const gate = await resolveUserForScope(scope)
  if ('error' in gate) return { error: gate.error ?? 'Unauthorized.' }

  const email = gate.user.email?.trim()
  if (!email) return { error: 'Tài khoản chưa có email — không gửi được OTP.' }
  if (!isSmtpConfigured()) return { error: 'Máy chủ chưa cấu hình gửi email (SMTP).' }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }

  if (await isStepUpOtpCooldownActiveFromPg(gate.user.id, scope)) {
    return { error: 'Vui lòng đợi vài chục giây trước khi gửi lại mã.' }
  }

  const otp = generateStepUpOtp6()
  const otpHash = hashStepUpOtp(gate.user.id, scope, otp)
  const saved = await replaceStepUpOtpFromPg({
    userId: gate.user.id,
    scope,
    otpHash,
  })
  if (!saved) return { error: 'Không lưu được mã xác nhận.' }

  const mail = otpEmailBody(otp, scope)
  const sent = await sendSmtpMail({
    to: email,
    subject: otpEmailSubject(scope),
    text: mail.text,
    html: mail.html,
  })

  if (!sent.ok) {
    await clearStepUpOtpFromPg(gate.user.id, scope)
    return { error: 'Không gửi được email. Kiểm tra SMTP hoặc thử lại sau.' }
  }

  return { ok: true }
}

export async function verifyStepUpOtpAction(
  scope: StepUpScope,
  otpRaw: string
): Promise<{ ok: true; expiresAt: string } | { error: string }> {
  const gate = await resolveUserForScope(scope)
  if ('error' in gate) return { error: gate.error ?? 'Unauthorized.' }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }

  const verified = await verifyStepUpOtpAndCreateSessionFromPg({
    userId: gate.user.id,
    scope,
    otpRaw,
  })
  if (!verified) return { error: 'Mã OTP không đúng hoặc đã hết hạn.' }
  return { ok: true, expiresAt: verified.expiresAt }
}
