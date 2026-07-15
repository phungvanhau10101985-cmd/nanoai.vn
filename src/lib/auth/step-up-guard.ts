import {
  hasActiveStepUpSessionFromPg,
} from '@/lib/db/user-step-up-pg'
import { STEP_UP_REQUIRED, type StepUpScope } from '@/lib/auth/step-up-otp'

export { STEP_UP_REQUIRED }

export type StepUpGateResult = { ok: true } | { error: typeof STEP_UP_REQUIRED }

export async function assertStepUp(userId: string, scope: StepUpScope): Promise<StepUpGateResult> {
  const active = await hasActiveStepUpSessionFromPg(userId, scope)
  if (!active) return { error: STEP_UP_REQUIRED }
  return { ok: true }
}
