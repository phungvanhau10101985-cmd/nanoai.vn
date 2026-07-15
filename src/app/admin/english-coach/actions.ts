'use server'

import { revalidatePath } from 'next/cache'
import { getUserForAction } from '@/lib/auth'
import { getProfileRoleWithFallback } from '@/lib/db/read-user-dashboard-pg'
import { pgAdminDeleteCompletedLesson } from '@/lib/db/admin-english-coach-pg'
import { assertStepUp, STEP_UP_REQUIRED } from '@/lib/auth/step-up-guard'

export async function deleteCompletedLessonWithStepUp(
  lessonId: string
): Promise<{ ok: true } | { error: string }> {
  const auth = await getUserForAction()
  if ('error' in auth) return { error: auth.error }

  const role = await getProfileRoleWithFallback(auth.user.id)
  if (role !== 'admin') return { error: 'Permission denied. You must be an admin.' }

  const step = await assertStepUp(auth.user.id, 'admin')
  if ('error' in step) return { error: STEP_UP_REQUIRED }

  const id = String(lessonId || '').trim()
  if (!id) return { error: 'Missing lesson id.' }

  const r = await pgAdminDeleteCompletedLesson(id)
  if ('error' in r) return { error: r.error }
  revalidatePath('/admin/english-coach')
  return { ok: true }
}
