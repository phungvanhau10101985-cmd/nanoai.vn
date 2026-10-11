'use server'

import { revalidatePath } from 'next/cache'
import { getUserForAction } from '@/lib/auth'
import { getProfileRoleWithFallback } from '@/lib/db/read-user-dashboard-pg'
import {
  pgDeleteResolvedCustomerErrors,
  pgSetCustomerErrorResolved,
} from '@/lib/errors/customer-error-report-pg'

async function requireAdmin(): Promise<{ user: { id: string } } | { error: string }> {
  const result = await getUserForAction()
  if ('error' in result) return { error: result.error }
  const role = await getProfileRoleWithFallback(result.user.id)
  if (role !== 'admin') return { error: 'Permission denied. You must be an admin.' }
  return { user: result.user }
}

export async function setCustomerErrorResolvedAction(
  ids: string[],
  resolved: boolean
): Promise<{ ok: true; count: number } | { error: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  try {
    const count = await pgSetCustomerErrorResolved(ids.slice(0, 500), resolved, auth.user.id)
    revalidatePath('/admin/error-reports')
    return { ok: true, count }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteResolvedCustomerErrorsAction(): Promise<{ ok: true; count: number } | { error: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  try {
    const count = await pgDeleteResolvedCustomerErrors()
    revalidatePath('/admin/error-reports')
    return { ok: true, count }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
