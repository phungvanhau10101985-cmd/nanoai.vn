import { createHash, randomInt } from 'node:crypto'

export type { StepUpScope } from '@/lib/auth/step-up-otp-shared'
export {
  STEP_UP_REQUIRED,
  STEP_UP_OTP_TTL_MINUTES,
  STEP_UP_SESSION_TTL_MINUTES,
  normalizeStepUpOtp,
  isStepUpRequiredError,
} from '@/lib/auth/step-up-otp-shared'

import type { StepUpScope } from '@/lib/auth/step-up-otp-shared'

export function sha256hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex')
}

export function hashStepUpOtp(userId: string, scope: StepUpScope, otp: string): string {
  const o = otp.replace(/\D/g, '').trim()
  return sha256hex(`user_step_up_otp:${userId}:${scope}:${o}`)
}

export function generateStepUpOtp6(): string {
  return String(randomInt(100000, 1000000))
}

export function stepUpCooldownSeconds(): number {
  const raw = parseInt(process.env.STEP_UP_OTP_COOLDOWN_SECONDS || '90', 10)
  return Number.isFinite(raw) ? Math.min(600, Math.max(0, raw)) : 90
}
