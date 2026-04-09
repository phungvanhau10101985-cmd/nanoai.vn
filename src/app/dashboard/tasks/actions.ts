'use server'

import { getUserOrBypass } from '@/lib/auth'
import { buildTaskHubSnapshot, type TaskHubSnapshot } from './task-hub-snapshot'

export async function refreshTaskHubSnapshot(): Promise<
  { ok: true; data: TaskHubSnapshot } | { ok: false; error: 'unauthorized' }
> {
  const user = await getUserOrBypass()
  if (!user) return { ok: false, error: 'unauthorized' }
  const data = await buildTaskHubSnapshot(user.id)
  return { ok: true, data }
}
