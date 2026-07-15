export type StepUpScope = 'admin' | 'account'

export const STEP_UP_REQUIRED = 'STEP_UP_REQUIRED' as const

export const STEP_UP_OTP_TTL_MINUTES = 10
export const STEP_UP_SESSION_TTL_MINUTES = 15

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
