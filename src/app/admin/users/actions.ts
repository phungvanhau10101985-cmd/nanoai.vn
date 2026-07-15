'use server'

import { getUserForAction } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { setUserCreditBalanceAbsolute } from '@/lib/db/credits-balance'
import { getProfileRoleWithFallback } from '@/lib/db/read-user-dashboard-pg'
import { assertStepUp, STEP_UP_REQUIRED } from '@/lib/auth/step-up-guard'

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
