'use server'

import { getUserForAction } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { setUserCreditBalanceAbsolute } from '@/lib/db/credits-balance'
import { getProfileRoleWithFallback } from '@/lib/db/read-user-dashboard-pg'

export async function updateUserCredit(userId: string, newBalance: number) {
  const result = await getUserForAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  const role = await getProfileRoleWithFallback(user.id)
  if (role !== 'admin') {
    return { error: 'Permission denied. You must be an admin.' }
  }

  const r = await setUserCreditBalanceAbsolute(userId, newBalance)
  if (!r.ok) {
    return { error: 'Failed to update credit balance.' }
  }

  revalidatePath('/admin/users') // Refresh the admin page
  return { success: true }
}
