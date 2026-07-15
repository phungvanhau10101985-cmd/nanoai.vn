import { createHash, randomInt } from 'node:crypto'

export type StepUpScope = 'admin' | 'account'

export const STEP_UP_REQUIRED = 'STEP_UP_REQUIRED' as const

export const STEP_UP_OTP_TTL_MINUTES = 10
export const STEP_UP_SESSION_TTL_MINUTES = 15

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

export function normalizeStepUpOtp(raw: string): string | null {
  const o = raw.replace(/\D/g, '').trim()
  return o.length === 6 ? o : null
}

export function isStepUpRequiredError(value: unknown): boolean {
  if (value == null || typeof value !== 'object') return false
  const err = (value as { error?: unknown; code?: unknown }).error
  const code = (value as { code?: unknown }).code
  return err === STEP_UP_REQUIRED || code === STEP_UP_REQUIRED
}

export function stepUpCooldownSeconds(): number {
  const raw = parseInt(process.env.STEP_UP_OTP_COOLDOWN_SECONDS || '90', 10)
  return Number.isFinite(raw) ? Math.min(600, Math.max(0, raw)) : 90
}
