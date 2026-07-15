import { getUserForAction } from '@/lib/auth'
import { getProfileRoleWithFallback } from '@/lib/db/read-user-dashboard-pg'
import { assertStepUp, STEP_UP_REQUIRED } from '@/lib/auth/step-up-guard'

export async function requireAdminWithStepUp(): Promise<
  { user: { id: string } } | { error: string; status: number; code?: typeof STEP_UP_REQUIRED }
> {
  const authResult = await getUserForAction()
  if ('error' in authResult) return { error: authResult.error, status: 401 }

  const role = await getProfileRoleWithFallback(authResult.user.id)
  if (role !== 'admin') {
    return { error: 'Permission denied. You must be an admin.', status: 403 }
  }

  const step = await assertStepUp(authResult.user.id, 'admin')
  if ('error' in step) {
    return {
      error: 'Cần xác minh OTP quản trị trước khi thực hiện thao tác này.',
      status: 403,
      code: STEP_UP_REQUIRED,
    }
  }

  return { user: authResult.user }
}

export async function requireAccountWithStepUp(): Promise<
  { user: { id: string; email?: string | null } } | { error: string; code?: typeof STEP_UP_REQUIRED }
> {
  const authResult = await getUserForAction()
  if ('error' in authResult) return { error: authResult.error }

  const step = await assertStepUp(authResult.user.id, 'account')
  if ('error' in step) {
    return {
      error: 'Cần xác minh OTP tài khoản trước khi thực hiện thao tác này.',
      code: STEP_UP_REQUIRED,
    }
  }

  return { user: authResult.user }
}
